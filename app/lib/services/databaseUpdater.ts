import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';

class DatabaseUpdater {
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
      charset: 'utf8mb4',
      multipleStatements: true // 允许执行多个SQL语句
    });
  }

  /**
   * 执行数据库更新脚本
   */
  async executeUpdateScript(scriptPath: string): Promise<void> {
    try {
      console.log(`开始执行数据库更新脚本: ${scriptPath}`);
      
      // 读取SQL脚本文件
      const scriptContent = await fs.readFile(scriptPath, 'utf8');
      
      // 分割SQL语句（简单分割，按分号和换行）
      const statements = this.splitSqlStatements(scriptContent);
      
      const connection = await this.pool.getConnection();
      
      try {
        // 开始事务
        await connection.beginTransaction();
        
        let executedStatements = 0;
        
        for (const statement of statements) {
          const trimmedStatement = statement.trim();
          
          // 跳过空语句和注释
          if (!trimmedStatement || 
              trimmedStatement.startsWith('--') || 
              trimmedStatement.startsWith('#') ||
              trimmedStatement.toLowerCase().startsWith('use ')) {
            continue;
          }
          
          try {
            console.log(`执行SQL语句 ${++executedStatements}: ${trimmedStatement.substring(0, 100)}${trimmedStatement.length > 100 ? '...' : ''}`);
            await connection.execute(trimmedStatement);
          } catch (error) {
            console.warn(`SQL语句执行警告: ${error}`);
            // 对于某些可能失败的语句（如已存在的索引），我们继续执行
            if (this.isCriticalError(error as Error)) {
              throw error;
            }
          }
        }
        
        // 提交事务
        await connection.commit();
        console.log(`数据库更新完成，成功执行了 ${executedStatements} 条SQL语句`);
        
      } catch (error) {
        // 回滚事务
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      
    } catch (error) {
      console.error('数据库更新失败:', error);
      throw error;
    }
  }

  /**
   * 分割SQL语句
   */
  private splitSqlStatements(scriptContent: string): string[] {
    // 移除注释行
    const lines = scriptContent.split('\n');
    const cleanedLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('--') && !trimmed.startsWith('#');
    });
    
    const cleanedScript = cleanedLines.join('\n');
    
    // 处理分隔符变更（DELIMITER）
    const parts = cleanedScript.split(/DELIMITER\s+/i);
    const statements: string[] = [];
    
    let currentDelimiter = ';';
    
    for (let i = 0; i < parts.length; i++) {
      if (i === 0) {
        // 第一部分使用默认分隔符
        const stmts = parts[i].split(currentDelimiter);
        statements.push(...stmts.filter(s => s.trim()));
      } else {
        // 找到新的分隔符
        const delimiterMatch = parts[i].match(/^(\S+)/);
        if (delimiterMatch) {
          currentDelimiter = delimiterMatch[1];
          const remaining = parts[i].substring(delimiterMatch[0].length);
          
          if (remaining.trim()) {
            const stmts = remaining.split(currentDelimiter);
            statements.push(...stmts.filter(s => s.trim()));
          }
        }
      }
    }
    
    return statements;
  }

  /**
   * 判断是否为关键错误
   */
  private isCriticalError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    
    // 这些错误可以忽略（非关键）
    const ignorableErrors = [
      'duplicate key name',
      'duplicate column name', 
      'table already exists',
      'view already exists',
      'index already exists',
      'procedure already exists',
      'event already exists'
    ];
    
    return !ignorableErrors.some(ignorableError => 
      errorMessage.includes(ignorableError)
    );
  }

  /**
   * 检查月度统计表是否存在
   */
  async checkMonthlyStatsExists(): Promise<boolean> {
    try {
      const connection = await this.pool.getConnection();
      try {
        const [rows] = await connection.execute(
          `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_monthly_stats'`,
          [process.env.DB_NAME]
        );
        
        const result = rows as Array<{ count: number }>;
        return result[0].count > 0;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('检查月度统计表失败:', error);
      return false;
    }
  }

  /**
   * 自动更新数据库到月度统计模式
   */
  async updateToMonthlyStats(): Promise<void> {
    try {
      console.log('检查是否需要更新数据库结构...');
      
      // 检查是否已经更新过
      const monthlyStatsExists = await this.checkMonthlyStatsExists();
      
      if (monthlyStatsExists) {
        console.log('月度统计表已存在，跳过数据库更新');
        return;
      }
      
      // 执行更新脚本
      const scriptPath = path.join(process.cwd(), 'database', 'monthly_stats_update.sql');
      await this.executeUpdateScript(scriptPath);
      
      console.log('数据库已成功更新为月度统计模式');
      
    } catch (error) {
      console.error('自动更新数据库失败:', error);
      throw error;
    }
  }

  /**
   * 手动触发月度统计更新
   */
  async updateCurrentMonthStats(): Promise<void> {
    try {
      const connection = await this.pool.getConnection();
      try {
        console.log('更新当月统计数据...');
        await connection.execute('CALL UpdateMonthlyStats(NULL)');
        console.log('当月统计数据更新完成');
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('更新当月统计失败:', error);
      throw error;
    }
  }
}

// 导出单例实例
export const databaseUpdater = new DatabaseUpdater();