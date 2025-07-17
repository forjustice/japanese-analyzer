import { systemConfigService } from './systemConfigService';

// Define the ApiKey type, mirroring the one in systemConfigService
// to ensure type safety at this layer.
type ApiKey = {
  id?: number;
  key_value: string;
  name?: string;
  provider: 'gemini' | 'openai' | 'claude';
  models: string[];
};

class ApiKeyService {
  async getApiKeys() {
    return systemConfigService.getAllApiKeys();
  }

  async addApiKey(apiKey: Omit<ApiKey, 'id'>) {
    return systemConfigService.addApiKey(apiKey);
  }

  async updateApiKey(id: number, apiKey: Partial<ApiKey>) {
    return systemConfigService.updateApiKey(id, apiKey);
  }

  async deleteApiKey(id: number) {
    return systemConfigService.deleteApiKey(id);
  }
}

export const apiKeyService = new ApiKeyService();
