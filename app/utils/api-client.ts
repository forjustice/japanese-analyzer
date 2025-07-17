import { DatabaseApiKeyManager } from './database-api-key-manager';

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
  private databaseKeyManager: DatabaseApiKeyManager;
  private defaultTimeout = 30000; // 30秒超时

  constructor() {
    this.databaseKeyManager = new DatabaseApiKeyManager();
  }

  public async makeRequest<T = unknown>(
    config: ApiRequestConfig,
    userApiKey?: string
  ): Promise<ApiResponse<T>> {
    // 如果用户提供了API KEY，优先使用用户的KEY
    if (userApiKey) {
      return this.makeRequestWithKey(config, userApiKey);
    }

    // 使用数据库密钥管理器
    return this.makeRequestWithDatabaseKeys(config);
  }

  private async makeRequestWithDatabaseKeys<T = unknown>(
    config: ApiRequestConfig
  ): Promise<ApiResponse<T>> {
    const maxRetries = await this.databaseKeyManager.getWorkingKeysCount();
    let lastError = '';

    if (maxRetries === 0) {
      return {
        success: false,
        error: '暂无可用的API密钥，请在管理后台配置'
      };
    }

    for (let i = 0; i < maxRetries; i++) {
      const apiKey = await this.databaseKeyManager.getWorkingKey();
      
      if (!apiKey) {
        return {
          success: false,
          error: '暂无可用的API密钥，请稍后重试'
        };
      }

      const result = await this.makeRequestWithKey(config, apiKey);
      
      if (result.success) {
        await this.databaseKeyManager.markKeyAsWorking(apiKey);
        return result as ApiResponse<T>;
      }

      // 检查是否是密钥相关的错误
      if (this.isKeyRelatedError(result.error || '')) {
        await this.databaseKeyManager.markKeyAsFailed(apiKey);
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
      // 对于Gemini API，需要在URL中添加key参数
      const url = config.url.includes('generativelanguage.googleapis.com') 
        ? `${config.url}?key=${apiKey}`
        : config.url;
      
      const headers = {
        'Content-Type': 'application/json',
        // 只有非Gemini API才使用Bearer token
        ...(config.url.includes('generativelanguage.googleapis.com') ? {} : { 'Authorization': `Bearer ${apiKey}` }),
        ...config.headers
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout || this.defaultTimeout);

      const response = await fetch(url, {
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
      
      // 检查Gemini API特有的错误响应格式
      if (Array.isArray(data) && data.length > 0 && data[0].error) {
        return {
          success: false,
          error: `Gemini API错误: ${data[0].error.message}`,
          usedKey: apiKey.substring(0, 8) + '...'
        };
      }
      
      // 检查单个错误对象格式
      if (data.error) {
        return {
          success: false,
          error: `API错误: ${data.error.message || data.error}`,
          usedKey: apiKey.substring(0, 8) + '...'
        };
      }
      
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

  public async makeStreamingRequest(
    config: ApiRequestConfig,
    userApiKey?: string
  ): Promise<ReadableStream<Uint8Array>> {
    let apiKey = userApiKey;
    
    // 如果没有用户提供的API密钥，从数据库获取
    if (!apiKey) {
      apiKey = await this.databaseKeyManager.getWorkingKey() || undefined;
    }

    if (!apiKey) {
      throw new Error('暂无可用的API密钥');
    }

    const url = config.url.includes('generativelanguage.googleapis.com')
      ? `${config.url}?key=${apiKey}`
      : config.url;

    const headers = {
      'Content-Type': 'application/json',
      ...(config.url.includes('generativelanguage.googleapis.com') ? {} : { 'Authorization': `Bearer ${apiKey}` }),
      ...config.headers
    };

    // 为长文本解析设置更长的超时时间
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn('Streaming request timeout after 10 minutes');
      controller.abort();
    }, 600000); // 10分钟超时，支持超长文本解析

    try {
      const response = await fetch(url, {
        method: config.method,
        headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`HTTP ${response.status}: ${errorData}`);
        
        // 如果是密钥相关错误，标记密钥为失败
        if (this.isKeyRelatedError(errorData)) {
          await this.databaseKeyManager.markKeyAsFailed(apiKey);
        }
        
        throw new Error(`API请求失败: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('响应体为空');
      }

      // 标记密钥为正常工作
      await this.databaseKeyManager.markKeyAsWorking(apiKey);

      return response.body;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
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

  public async getKeyStatus() {
    return await this.databaseKeyManager.getKeyStatus();
  }

  public async getWorkingKeysCount(): Promise<number> {
    return await this.databaseKeyManager.getWorkingKeysCount();
  }
}
