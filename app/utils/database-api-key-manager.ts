import { systemConfigService } from '../lib/services/systemConfigService';

export interface DatabaseApiKeyConfig {
  key_value: string;
  provider: 'gemini' | 'openai' | 'claude';
  models: string[];
  isWorking: boolean;
  lastUsed: number;
  failureCount: number;
}

export class DatabaseApiKeyManager {
  private apiKeys: DatabaseApiKeyConfig[] = [];
  private currentIndex = 0;
  private maxFailures = 3;
  private retryDelay = 60000; // 1分钟后重试失败的KEY
  private lastRefresh = 0;
  private refreshInterval = 300000; // 5分钟刷新一次

  constructor() {
    this.loadApiKeys();
  }

  private async loadApiKeys(): Promise<void> {
    try {
            const dbKeys = await systemConfigService.getAllApiKeys();
      this.apiKeys = dbKeys.map(key => ({
        key_value: key.key_value,
        provider: key.provider,
        models: key.models,
        isWorking: true,
        lastUsed: 0,
        failureCount: 0
      }));
      this.lastRefresh = Date.now();
      console.log(`加载了 ${this.apiKeys.length} 个API密钥`);
    } catch (error) {
      console.error('加载API密钥失败:', error);
      this.apiKeys = [];
    }
  }

  private async refreshKeysIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.lastRefresh > this.refreshInterval) {
      await this.loadApiKeys();
    }
  }

  public async getWorkingKey(provider?: 'gemini' | 'openai' | 'claude'): Promise<string | null> {
    await this.refreshKeysIfNeeded();
    
    if (this.apiKeys.length === 0) {
      return null;
    }

    // 重置超时的失败KEY
    const now = Date.now();
    this.apiKeys.forEach(config => {
      if (!config.isWorking && (now - config.lastUsed) > this.retryDelay) {
        config.isWorking = true;
        config.failureCount = 0;
      }
    });

    // 筛选可用的KEY
    let workingKeys = this.apiKeys.filter(config => config.isWorking);
    
    // 如果指定了provider，只使用该provider的KEY
    if (provider) {
      workingKeys = workingKeys.filter(config => config.provider === provider);
    }

    if (workingKeys.length === 0) {
      return null;
    }

    // 使用轮询策略选择KEY
    this.currentIndex = this.currentIndex % workingKeys.length;
    const selectedKey = workingKeys[this.currentIndex];
    
    // 更新使用时间
    selectedKey.lastUsed = now;
    this.currentIndex++;

    return selectedKey.key_value;
  }

  public async markKeyAsFailed(key: string): Promise<void> {
    const config = this.apiKeys.find(c => c.key_value === key);
    if (config) {
      config.failureCount++;
      config.lastUsed = Date.now();
      
      if (config.failureCount >= this.maxFailures) {
        config.isWorking = false;
      }
    }
  }

  public async markKeyAsWorking(key: string): Promise<void> {
    const config = this.apiKeys.find(c => c.key_value === key);
    if (config) {
      config.failureCount = 0;
      config.isWorking = true;
      config.lastUsed = Date.now();
    }
  }

  public async getAllKeys(): Promise<string[]> {
    await this.refreshKeysIfNeeded();
    return this.apiKeys.map(config => config.key_value);
  }

  public async getWorkingKeysCount(): Promise<number> {
    await this.refreshKeysIfNeeded();
    const now = Date.now();
    return this.apiKeys.filter(config => 
      config.isWorking || (now - config.lastUsed) > this.retryDelay
    ).length;
  }

  public async getKeyStatus(): Promise<Array<{key: string, isWorking: boolean, failureCount: number, provider: string}>> {
    await this.refreshKeysIfNeeded();
    return this.apiKeys.map(config => ({
      key: config.key_value.substring(0, 8) + '...',
      isWorking: config.isWorking,
      failureCount: config.failureCount,
      provider: config.provider
    }));
  }

  public async getKeyByProvider(provider: 'gemini' | 'openai' | 'claude'): Promise<string | null> {
    return this.getWorkingKey(provider);
  }

  public async getProviderUrl(provider: 'gemini' | 'openai' | 'claude', model?: string): Promise<string | null> {
    const urls = {
      'gemini': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent',
      'openai': 'https://api.openai.com/v1/chat/completions',
      'claude': 'https://api.anthropic.com/v1/messages'
    };

    // 如果指定了模型，可以根据模型调整URL
    if (provider === 'gemini' && model) {
      return `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`;
    }

    return urls[provider] || null;
  }

  public async getAvailableModels(provider: 'gemini' | 'openai' | 'claude'): Promise<string[]> {
    await this.refreshKeysIfNeeded();
    const providerKeys = this.apiKeys.filter(key => key.provider === provider && key.isWorking);
    if (providerKeys.length === 0) {
      return [];
    }
    
    // 返回该provider所有密钥支持的模型的并集
    const allModels = new Set<string>();
    providerKeys.forEach(key => {
      key.models.forEach(model => allModels.add(model));
    });
    
    return Array.from(allModels);
  }
}

export const apiKeyManager = new DatabaseApiKeyManager();
