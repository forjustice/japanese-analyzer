import mysql from 'mysql2/promise';

export interface AnalysisHistoryItem {
  id: string;
  userId: number;
  originalText: string;
  tokens: Array<{
    word: string;
    pos: string;
    furigana?: string;
    romaji?: string;
  }>;
  translation?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateHistoryItem {
  originalText: string;
  tokens: Array<{
    word: string;
    pos: string;
    furigana?: string;
    romaji?: string;
  }>;
  translation?: string;
}

class AnalysisHistoryService {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4'
    });

    // 自动创建表
    this.initializeTable();
  }

  private async initializeTable() {
    try {
      const connection = await this.pool.getConnection();
      try {
        // 创建历史记录表
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS user_analysis_history (
              id BIGINT AUTO_INCREMENT PRIMARY KEY,
              user_id INT NOT NULL,
              original_text TEXT NOT NULL,
              tokens_json JSON NOT NULL,
              translation TEXT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              
              INDEX idx_user_created (user_id, created_at DESC),
              INDEX idx_user_text (user_id, original_text(100)),
              INDEX idx_created_at (created_at DESC)
          )
        `);

        // 检查并添加虚拟列
        const [columns] = await connection.execute(`
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_analysis_history' AND COLUMN_NAME = 'token_count'
        `, [process.env.DB_NAME]);

        if (Array.isArray(columns) && columns.length === 0) {
          await connection.execute(`
            ALTER TABLE user_analysis_history 
            ADD COLUMN token_count INT GENERATED ALWAYS AS (JSON_LENGTH(tokens_json)) VIRTUAL
          `);
          
          await connection.execute(`
            ALTER TABLE user_analysis_history 
            ADD INDEX idx_token_count (token_count)
          `);
        }

        // 检查并添加全文搜索索引
        const [indexes] = await connection.execute(`
          SHOW INDEX FROM user_analysis_history WHERE Key_name = 'original_text'
        `);

        if (Array.isArray(indexes) && indexes.length === 0) {
          await connection.execute(`
            ALTER TABLE user_analysis_history 
            ADD FULLTEXT(original_text, translation)
          `);
        }

        console.log('Analysis history table initialized successfully');
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Failed to initialize analysis history table:', error);
    }
  }

  /**
   * 保存分析历史记录
   */
  async saveHistory(userId: number, historyData: CreateHistoryItem): Promise<string> {
    try {
      const connection = await this.pool.getConnection();
      try {
        // 检查是否已存在相同的文本
        const [existingRows] = await connection.execute(
          'SELECT id FROM user_analysis_history WHERE user_id = ? AND original_text = ? LIMIT 1',
          [userId, historyData.originalText]
        );

        if (Array.isArray(existingRows) && existingRows.length > 0) {
          // 更新现有记录
          const existingRecord = existingRows[0] as { id: number };
          await connection.execute(
            `UPDATE user_analysis_history 
             SET tokens_json = ?, translation = ?, updated_at = NOW() 
             WHERE id = ?`,
            [JSON.stringify(historyData.tokens), historyData.translation || null, existingRecord.id]
          );
          return existingRecord.id.toString();
        } else {
          // 创建新记录
          const [result] = await connection.execute(
            `INSERT INTO user_analysis_history (user_id, original_text, tokens_json, translation) 
             VALUES (?, ?, ?, ?)`,
            [userId, historyData.originalText, JSON.stringify(historyData.tokens), historyData.translation || null]
          );
          
          const insertResult = result as mysql.ResultSetHeader;
          return insertResult.insertId.toString();
        }
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error saving analysis history:', error);
      throw new Error('保存历史记录失败');
    }
  }

  /**
   * 获取用户的历史记录
   */
  async getUserHistory(userId: number, limit: number = 100, offset: number = 0): Promise<AnalysisHistoryItem[]> {
    try {
      const connection = await this.pool.getConnection();
      try {
        const [rows] = await connection.execute(
          `SELECT id, user_id, original_text, tokens_json, translation, created_at, updated_at
           FROM user_analysis_history 
           WHERE user_id = ? 
           ORDER BY updated_at DESC 
           LIMIT ? OFFSET ?`,
          [userId, limit, offset]
        );

        interface HistoryRow {
          id: number;
          user_id: number;
          original_text: string;
          tokens_json: string;
          translation?: string;
          created_at: Date;
          updated_at: Date;
        }

        return (rows as HistoryRow[]).map(row => ({
          id: row.id.toString(),
          userId: row.user_id,
          originalText: row.original_text,
          tokens: JSON.parse(row.tokens_json),
          translation: row.translation,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        }));
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error fetching user history:', error);
      throw new Error('获取历史记录失败');
    }
  }

  /**
   * 搜索历史记录
   */
  async searchHistory(userId: number, query: string, limit: number = 50): Promise<AnalysisHistoryItem[]> {
    try {
      const connection = await this.pool.getConnection();
      try {
        const [rows] = await connection.execute(
          `SELECT id, user_id, original_text, tokens_json, translation, created_at, updated_at
           FROM user_analysis_history 
           WHERE user_id = ? AND (
             original_text LIKE ? OR 
             translation LIKE ? OR
             MATCH(original_text, translation) AGAINST(? IN NATURAL LANGUAGE MODE)
           )
           ORDER BY updated_at DESC 
           LIMIT ?`,
          [userId, `%${query}%`, `%${query}%`, query, limit]
        );

        interface HistoryRow {
          id: number;
          user_id: number;
          original_text: string;
          tokens_json: string;
          translation?: string;
          created_at: Date;
          updated_at: Date;
        }

        return (rows as HistoryRow[]).map(row => ({
          id: row.id.toString(),
          userId: row.user_id,
          originalText: row.original_text,
          tokens: JSON.parse(row.tokens_json),
          translation: row.translation,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        }));
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error searching history:', error);
      throw new Error('搜索历史记录失败');
    }
  }

  /**
   * 删除历史记录
   */
  async deleteHistory(userId: number, historyId: string): Promise<boolean> {
    try {
      const connection = await this.pool.getConnection();
      try {
        const [result] = await connection.execute(
          'DELETE FROM user_analysis_history WHERE id = ? AND user_id = ?',
          [historyId, userId]
        );

        const deleteResult = result as mysql.ResultSetHeader;
        return deleteResult.affectedRows > 0;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error deleting history:', error);
      throw new Error('删除历史记录失败');
    }
  }

  /**
   * 清除用户所有历史记录
   */
  async clearUserHistory(userId: number): Promise<number> {
    try {
      const connection = await this.pool.getConnection();
      try {
        const [result] = await connection.execute(
          'DELETE FROM user_analysis_history WHERE user_id = ?',
          [userId]
        );

        const deleteResult = result as mysql.ResultSetHeader;
        return deleteResult.affectedRows;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error clearing user history:', error);
      throw new Error('清除历史记录失败');
    }
  }

  /**
   * 获取用户历史记录统计
   */
  async getUserHistoryStats(userId: number): Promise<{
    totalCount: number;
    totalTokens: number;
    averageTokensPerAnalysis: number;
  }> {
    try {
      const connection = await this.pool.getConnection();
      try {
        const [rows] = await connection.execute(
          `SELECT 
             COUNT(*) as totalCount,
             SUM(token_count) as totalTokens,
             AVG(token_count) as averageTokens
           FROM user_analysis_history 
           WHERE user_id = ?`,
          [userId]
        );

        interface StatsRow {
          totalCount: string;
          totalTokens: string;
          averageTokens: string;
        }

        const stats = (rows as StatsRow[])[0];
        return {
          totalCount: parseInt(stats.totalCount) || 0,
          totalTokens: parseInt(stats.totalTokens) || 0,
          averageTokensPerAnalysis: parseFloat(stats.averageTokens) || 0
        };
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error fetching user history stats:', error);
      return {
        totalCount: 0,
        totalTokens: 0,
        averageTokensPerAnalysis: 0
      };
    }
  }

  /**
   * 批量导入历史记录（用于从本地存储迁移）
   */
  async importHistory(userId: number, historyItems: CreateHistoryItem[]): Promise<number> {
    try {
      const connection = await this.pool.getConnection();
      try {
        await connection.beginTransaction();

        let importedCount = 0;
        for (const item of historyItems) {
          try {
            await this.saveHistory(userId, item);
            importedCount++;
          } catch (error) {
            console.warn('Failed to import history item:', error);
          }
        }

        await connection.commit();
        return importedCount;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error importing history:', error);
      throw new Error('导入历史记录失败');
    }
  }
}

// 单例实例
export const analysisHistoryService = new AnalysisHistoryService();