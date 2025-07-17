
import { db } from '../database';
import { z } from 'zod';

const ApiKeySchema = z.object({
  id: z.number().optional(),
  key_value: z.string(),
  name: z.string().optional(),
  provider: z.enum(['gemini', 'openai', 'claude']),
  models: z.array(z.string()),
  isWorking: z.boolean().optional(),
  lastUsed: z.date().optional(),
  failureCount: z.number().optional(),
});

type ApiKey = z.infer<typeof ApiKeySchema>;

interface ApiKeyFromDb {
  id: number;
  name?: string;
  key_value: string;
  provider: 'gemini' | 'openai' | 'claude';
  models: string; // Stored as JSON string in the DB
}

class SystemConfigService {
  private tableInitialized = false;

  constructor() {
    // The constructor is now empty, as keys are fetched on demand from the database.
  }

  private async ensureTableExists() {
    if (this.tableInitialized) return;
    
    try {
      // 表已存在，只需要检查models字段是否为JSON类型
      try {
        const columns = await db.query(`
          SELECT DATA_TYPE 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'api_keys' 
          AND COLUMN_NAME = 'models'
        `);
        
        if (columns.length > 0 && columns[0].DATA_TYPE === 'text') {
          console.log('Models column is TEXT type, suitable for JSON storage');
        }
      } catch (error) {
        console.log('Error checking models column:', error);
      }
      
      console.log('API keys table initialized');
      this.tableInitialized = true;
    } catch (error) {
      console.error('Failed to initialize API keys table:', error);
      throw error;
    }
  }

  async getAllApiKeys(): Promise<ApiKey[]> {
    try {
      await this.ensureTableExists();
      console.log('Fetching API keys from database...');
      const keysFromDb = await db.query<ApiKeyFromDb>('SELECT id, name, key_value, provider, models FROM api_keys');
      console.log('Raw API keys from DB:', keysFromDb);
      
      // The 'models' column is expected to be a JSON string
      const parsedKeys = keysFromDb.map((row) => {
        let models;
        try {
          models = typeof row.models === 'string' ? JSON.parse(row.models) : row.models;
        } catch (e) {
          console.error('Error parsing models JSON:', e, 'Raw models:', row.models);
          models = [];
        }
        return {
          ...row,
          name: row.name,
          models
        };
      });

      console.log('Parsed API keys:', parsedKeys);
      return z.array(ApiKeySchema).parse(parsedKeys);
    } catch (error) {
      console.error('Failed to load API keys from database:', error);
      return [];
    }
  }

  async addApiKey(apiKey: Omit<ApiKey, 'id'>): Promise<{ success: boolean; id?: number; error?: string }> {
    try {
      await this.ensureTableExists();
      console.log('Adding API key:', apiKey);
      const { key_value, name, provider, models } = apiKey;
      const modelsJson = JSON.stringify(models);
      console.log('Models JSON:', modelsJson);
      
      const insertId = await db.insert(
        'INSERT INTO api_keys (name, key_value, provider, models, status) VALUES (?, ?, ?, ?, ?)',
        [name || null, key_value, provider, modelsJson, 'active']
      );
      console.log('API key added with ID:', insertId);
      return { success: true, id: insertId };
    } catch (error) {
      console.error('Failed to add API key to database:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async updateApiKey(id: number, apiKey: Partial<ApiKey>): Promise<{ success: boolean; error?: string }> {
    try {
      const updates: string[] = [];
      const values: (string | number | boolean | null)[] = [];
      
      if (apiKey.key_value) {
        updates.push('key_value = ?');
        values.push(apiKey.key_value);
      }
      if (apiKey.name !== undefined) {
        updates.push('name = ?');
        values.push(apiKey.name || null);
      }
      if (apiKey.provider) {
        updates.push('provider = ?');
        values.push(apiKey.provider);
      }
      if (apiKey.models) {
        updates.push('models = ?');
        values.push(JSON.stringify(apiKey.models));
      }

      if (updates.length === 0) {
        return { success: true }; // Nothing to update
      }

      values.push(id);
      const sql = `UPDATE api_keys SET ${updates.join(', ')} WHERE id = ?`;
      
      await db.update(sql, values);
      return { success: true };
    } catch (error) {
      console.error(`Failed to update API key with id ${id}:`, error);
      return { success: false, error: (error as Error).message };
    }
  }

  async deleteApiKey(id: number): Promise<{ success: boolean; error?: string }> {
    try {
      await db.delete('DELETE FROM api_keys WHERE id = ?', [id]);
      return { success: true };
    } catch (error) {
      console.error(`Failed to delete API key with id ${id}:`, error);
      return { success: false, error: (error as Error).message };
    }
  }
}

export const systemConfigService = new SystemConfigService();
