export interface ApiKeyConfig {
  key: string;
  isWorking: boolean;
  lastUsed: number;
  failureCount: number;
}

export class ApiKeyManager {
  private apiKeys: ApiKeyConfig[] = [];
  private currentIndex = 0;
  private maxFailures = 3;
  private retryDelay = 60000; // 1分钟后重试失败的KEY

  constructor(apiKeysString: string) {
    this.parseApiKeys(apiKeysString);
  }

  private parseApiKeys(apiKeysString: string): void {
    if (!apiKeysString) {
      this.apiKeys = [];
      return;
    }

    const keys = apiKeysString.split(',').map(key => key.trim()).filter(key => key.length > 0);
    this.apiKeys = keys.map(key => ({
      key,
      isWorking: true,
      lastUsed: 0,
      failureCount: 0
    }));
  }

  public getWorkingKey(): string | null {
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

    // 寻找可用的KEY
    const workingKeys = this.apiKeys.filter(config => config.isWorking);
    if (workingKeys.length === 0) {
      return null;
    }

    // 使用轮询策略选择KEY
    this.currentIndex = this.currentIndex % workingKeys.length;
    const selectedKey = workingKeys[this.currentIndex];
    
    // 更新使用时间
    selectedKey.lastUsed = now;
    this.currentIndex++;

    return selectedKey.key;
  }

  public markKeyAsFailed(key: string): void {
    const config = this.apiKeys.find(c => c.key === key);
    if (config) {
      config.failureCount++;
      config.lastUsed = Date.now();
      
      if (config.failureCount >= this.maxFailures) {
        config.isWorking = false;
      }
    }
  }

  public markKeyAsWorking(key: string): void {
    const config = this.apiKeys.find(c => c.key === key);
    if (config) {
      config.failureCount = 0;
      config.isWorking = true;
      config.lastUsed = Date.now();
    }
  }

  public getAllKeys(): string[] {
    return this.apiKeys.map(config => config.key);
  }

  public getWorkingKeysCount(): number {
    const now = Date.now();
    return this.apiKeys.filter(config => 
      config.isWorking || (now - config.lastUsed) > this.retryDelay
    ).length;
  }

  public getKeyStatus(): Array<{key: string, isWorking: boolean, failureCount: number}> {
    return this.apiKeys.map(config => ({
      key: config.key.substring(0, 8) + '...',
      isWorking: config.isWorking,
      failureCount: config.failureCount
    }));
  }
}