import { ApiKeyManager } from './api-key-manager';

export interface ApiRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  usedKey?: string;
}

export class ApiClient {
  private keyManager: ApiKeyManager | null = null;
  private defaultTimeout = 30000; // 30秒超时

  constructor(apiKeysString?: string) {
    if (apiKeysString) {
      this.keyManager = new ApiKeyManager(apiKeysString);
    }
  }

  public async makeRequest<T = unknown>(
    config: ApiRequestConfig,
    userApiKey?: string
  ): Promise<ApiResponse<T>> {
    // 如果用户提供了API KEY，优先使用用户的KEY
    if (userApiKey) {
      return this.makeRequestWithKey(config, userApiKey);
    }

    // 如果没有配置KEY管理器，返回错误
    if (!this.keyManager) {
      return {
        success: false,
        error: '未配置API密钥'
      };
    }

    // 尝试使用服务器配置的多个KEY
    const maxRetries = this.keyManager.getAllKeys().length;
    let lastError = '';

    for (let i = 0; i < maxRetries; i++) {
      const apiKey = this.keyManager.getWorkingKey();
      
      if (!apiKey) {
        return {
          success: false,
          error: '暂无可用的API密钥，请稍后重试'
        };
      }

      const result = await this.makeRequestWithKey(config, apiKey);
      
      if (result.success) {
        this.keyManager.markKeyAsWorking(apiKey);
        return result as ApiResponse<T>;
      }

      // 检查是否是密钥相关的错误
      if (this.isKeyRelatedError(result.error || '')) {
        this.keyManager.markKeyAsFailed(apiKey);
        lastError = result.error || '';
        continue;
      }

      // 非密钥相关错误，直接返回
      return result as ApiResponse<T>;
    }

    return {
      success: false,
      error: `所有API密钥均不可用: ${lastError}`
    };
  }

  private async makeRequestWithKey<T = unknown>(
    config: ApiRequestConfig,
    apiKey: string
  ): Promise<ApiResponse<T>> {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...config.headers
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout || this.defaultTimeout);

      const response = await fetch(config.url, {
        method: config.method,
        headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorData}`,
          usedKey: apiKey.substring(0, 8) + '...'
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
        usedKey: apiKey.substring(0, 8) + '...'
      };

    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: '请求超时',
          usedKey: apiKey.substring(0, 8) + '...'
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : '网络请求失败',
        usedKey: apiKey.substring(0, 8) + '...'
      };
    }
  }

  private isKeyRelatedError(error: string): boolean {
    const keyErrorPatterns = [
      'API key',
      'unauthorized',
      'authentication',
      'invalid token',
      'quota exceeded',
      '401',
      '403',
      'rate limit'
    ];

    return keyErrorPatterns.some(pattern => 
      error.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  public getKeyStatus() {
    return this.keyManager?.getKeyStatus() || [];
  }

  public getWorkingKeysCount(): number {
    return this.keyManager?.getWorkingKeysCount() || 0;
  }
}