import mysql from 'mysql2/promise';

export interface TokenUsageRecord {
  userId: number;
  apiEndpoint: string;
  inputTokens: number;
  outputTokens: number;
  modelName?: string;
  success: boolean;
}

export interface UserTokenStats {
  totalTokens30Days: number;
  analyzeTokens: number;
  translateTokens: number;
  ttsTokens: number;
  ocrTokens: number;
  totalRequests30Days: number;
  daysRemaining: number;
  trialEndDate: string;
  registrationDate: string;
}

class TokenUsageService {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'janalyze',
      port: parseInt(process.env.DB_PORT || '3306'),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4'
    });
  }

  /**
   * 记录TOKEN使用量
   */
  async recordTokenUsage(record: TokenUsageRecord): Promise<void> {
    try {
      const connection = await this.pool.getConnection();
      try {
        await connection.execute(
          `INSERT INTO user_token_usage 
           (user_id, api_endpoint, input_tokens, output_tokens, model_name, success) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            record.userId,
            record.apiEndpoint,
            record.inputTokens,
            record.outputTokens,
            record.modelName,
            record.success
          ]
        );
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('记录TOKEN使用量失败:', error);
      // 不抛出错误，避免影响主要功能
    }
  }

  /**
   * 获取用户30天内的TOKEN使用统计
   */
  async getUserTokenStats(userId: number): Promise<UserTokenStats | null> {
    try {
      const connection = await this.pool.getConnection();
      try {
        const [rows] = await connection.execute(
          `SELECT 
             total_tokens_30days,
             analyze_tokens,
             translate_tokens,
             tts_tokens,
             ocr_tokens,
             total_requests_30days,
             days_remaining,
             trial_end_date,
             registration_date
           FROM user_30day_token_usage 
           WHERE user_id = ?`,
          [userId]
        );

        if (Array.isArray(rows) && rows.length > 0) {
          const row = rows[0] as {
            total_tokens_30days?: number;
            analyze_tokens?: number;
            translate_tokens?: number;
            tts_tokens?: number;
            ocr_tokens?: number;
            total_requests_30days?: number;
            days_remaining?: number;
            trial_end_date?: string;
            registration_date?: string;
          };
          return {
            totalTokens30Days: row.total_tokens_30days || 0,
            analyzeTokens: row.analyze_tokens || 0,
            translateTokens: row.translate_tokens || 0,
            ttsTokens: row.tts_tokens || 0,
            ocrTokens: row.ocr_tokens || 0,
            totalRequests30Days: row.total_requests_30days || 0,
            daysRemaining: row.days_remaining || 0,
            trialEndDate: row.trial_end_date ? new Date(row.trial_end_date).toISOString() : '',
            registrationDate: row.registration_date ? new Date(row.registration_date).toISOString() : ''
          };
        }
        return null;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('获取用户TOKEN统计失败:', error);
      return null;
    }
  }

  /**
   * 获取用户每日TOKEN使用量（最近30天）
   */
  async getUserDailyStats(userId: number): Promise<Array<{
    usage_date: string;
    api_endpoint: string;
    total_tokens: number;
    request_count: number;
  }>> {
    try {
      const connection = await this.pool.getConnection();
      try {
        const [rows] = await connection.execute(
          `SELECT 
             usage_date,
             api_endpoint,
             daily_tokens as total_tokens,
             daily_requests as request_count
           FROM user_daily_token_usage 
           WHERE user_id = ? 
             AND usage_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
           ORDER BY usage_date DESC, api_endpoint`,
          [userId]
        );
        return rows as Array<{
          usage_date: string;
          api_endpoint: string;
          total_tokens: number;
          request_count: number;
        }>;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('获取用户每日统计失败:', error);
      return [];
    }
  }

  /**
   * 估算TOKEN使用量（基于文本长度的简单估算）
   */
  estimateTokens(text: string): { inputTokens: number; estimatedOutputTokens: number } {
    // 简单的TOKEN估算：大约每4个字符为1个token
    const inputTokens = Math.ceil(text.length / 4);
    
    // 根据不同类型API估算输出token
    let estimatedOutputTokens = 0;
    
    // 对于分析类请求，输出通常是输入的1-2倍
    estimatedOutputTokens = Math.ceil(inputTokens * 1.5);
    
    return { inputTokens, estimatedOutputTokens };
  }

  /**
   * 检查用户是否超出30天试用限制
   */
  async checkUserLimit(userId: number, maxTokens: number = 100000): Promise<{ isExceeded: boolean; currentUsage: number; limit: number }> {
    try {
      const stats = await this.getUserTokenStats(userId);
      if (!stats) {
        return { isExceeded: false, currentUsage: 0, limit: maxTokens };
      }

      return {
        isExceeded: stats.totalTokens30Days >= maxTokens,
        currentUsage: stats.totalTokens30Days,
        limit: maxTokens
      };
    } catch (error) {
      console.error('检查用户限制失败:', error);
      return { isExceeded: false, currentUsage: 0, limit: maxTokens };
    }
  }
}

// 单例实例
export const tokenUsageService = new TokenUsageService();