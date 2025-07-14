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
  totalTokensCurrentMonth: number;
  analyzeTokens: number;
  translateTokens: number;
  ttsTokens: number;
  ocrTokens: number;
  totalRequestsCurrentMonth: number;
  daysRemainingInMonth: number;
  currentMonthEnd: string;
  registrationDate: string;
  monthlyLimit: number;
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

    // 自动更新数据库结构
    this.initializeMonthlyStats();
  }

  /**
   * 初始化月度统计功能
   */
  private async initializeMonthlyStats() {
    try {
      const { databaseUpdater } = await import('./databaseUpdater');
      await databaseUpdater.updateToMonthlyStats();
    } catch (error) {
      console.error('初始化月度统计失败:', error);
    }
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
        // 获取当月TOKEN使用统计
        const [rows] = await connection.execute(
          `SELECT 
             SUM(CASE WHEN api_endpoint = 'analyze' THEN input_tokens + output_tokens ELSE 0 END) as analyze_tokens,
             SUM(CASE WHEN api_endpoint = 'translate' THEN input_tokens + output_tokens ELSE 0 END) as translate_tokens,
             SUM(CASE WHEN api_endpoint = 'tts' THEN input_tokens + output_tokens ELSE 0 END) as tts_tokens,
             SUM(CASE WHEN api_endpoint IN ('image-to-text', 'file-to-text') THEN input_tokens + output_tokens ELSE 0 END) as ocr_tokens,
             SUM(input_tokens + output_tokens) as total_tokens,
             COUNT(*) as total_requests
           FROM user_token_usage 
           WHERE user_id = ? 
             AND created_at >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') 
             AND created_at < DATE_ADD(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH)`,
          [userId]
        );

        // 获取用户注册信息
        const [userRows] = await connection.execute(
          `SELECT created_at FROM users WHERE id = ?`,
          [userId]
        );

        if (Array.isArray(rows) && rows.length > 0) {
          const row = rows[0] as {
            analyze_tokens?: number;
            translate_tokens?: number;
            tts_tokens?: number;
            ocr_tokens?: number;
            total_tokens?: number;
            total_requests?: number;
          };

          const userRow = Array.isArray(userRows) && userRows.length > 0 ? userRows[0] as { created_at: Date } : null;

          // 计算当月剩余天数
          const now = new Date();
          const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          const daysRemainingInMonth = Math.max(0, currentMonthEnd.getDate() - now.getDate());

          // 获取月度限制
          const monthlyLimit = parseInt(process.env.MONTHLY_TOKEN_LIMIT || '150000');

          return {
            totalTokensCurrentMonth: row.total_tokens || 0,
            analyzeTokens: row.analyze_tokens || 0,
            translateTokens: row.translate_tokens || 0,
            ttsTokens: row.tts_tokens || 0,
            ocrTokens: row.ocr_tokens || 0,
            totalRequestsCurrentMonth: row.total_requests || 0,
            daysRemainingInMonth,
            currentMonthEnd: currentMonthEnd.toISOString(),
            registrationDate: userRow?.created_at ? new Date(userRow.created_at).toISOString() : '',
            monthlyLimit
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
   * 获取用户每日TOKEN使用量（当月）
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
             DATE(created_at) as usage_date,
             api_endpoint,
             SUM(input_tokens + output_tokens) as total_tokens,
             COUNT(*) as request_count
           FROM user_token_usage 
           WHERE user_id = ? 
             AND created_at >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') 
             AND created_at < DATE_ADD(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
           GROUP BY DATE(created_at), api_endpoint
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
   * 检查用户是否超出月度限制
   */
  async checkUserLimit(userId: number, maxTokens?: number): Promise<{ isExceeded: boolean; currentUsage: number; limit: number }> {
    const monthlyLimit = maxTokens || parseInt(process.env.MONTHLY_TOKEN_LIMIT || '150000');
    try {
      const stats = await this.getUserTokenStats(userId);
      if (!stats) {
        return { isExceeded: false, currentUsage: 0, limit: monthlyLimit };
      }

      return {
        isExceeded: stats.totalTokensCurrentMonth >= monthlyLimit,
        currentUsage: stats.totalTokensCurrentMonth,
        limit: monthlyLimit
      };
    } catch (error) {
      console.error('检查用户限制失败:', error);
      return { isExceeded: false, currentUsage: 0, limit: monthlyLimit };
    }
  }
}

// 单例实例
export const tokenUsageService = new TokenUsageService();