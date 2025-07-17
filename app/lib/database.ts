import mysql from 'mysql2/promise';

// 清理后的数据库连接配置 - 移除所有无效选项
const createDbConfig = () => {
  const baseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'japanese_analyzer',
    charset: 'utf8mb4',
    connectionLimit: process.env.VERCEL_ENV ? 5 : 10,
    timezone: 'Z', // 强制使用UTC时区
    connectTimeout: process.env.VERCEL_ENV ? 30000 : 60000,
  };

  // 只有明确设置为true时才启用SSL
  if (process.env.DB_SSL === 'true') {
    return {
      ...baseConfig,
      ssl: {
        rejectUnauthorized: false
      }
    };
  }

  return baseConfig;
};

// 创建连接池
const pool = mysql.createPool(createDbConfig());

// 数据库连接类
export class Database {
  private static instance: Database;
  private pool: mysql.Pool;

  private constructor() {
    this.pool = pool;
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  // 执行查询
  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows as T[];
    } catch (error) {
      console.error('数据库查询错误:', error);
      throw error;
    }
  }

  // 执行单条查询
  async queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  // 执行插入操作，返回插入ID
  async insert(sql: string, params?: unknown[]): Promise<number> {
    try {
      const [result] = await this.pool.execute(sql, params);
      return (result as mysql.ResultSetHeader).insertId;
    } catch (error) {
      console.error('数据库插入错误:', error);
      throw error;
    }
  }

  // 执行更新操作，返回影响行数
  async update(sql: string, params?: unknown[]): Promise<number> {
    try {
      const [result] = await this.pool.execute(sql, params);
      return (result as mysql.ResultSetHeader).affectedRows;
    } catch (error) {
      console.error('数据库更新错误:', error);
      throw error;
    }
  }

  // 执行删除操作，返回影响行数
  async delete(sql: string, params?: unknown[]): Promise<number> {
    try {
      const [result] = await this.pool.execute(sql, params);
      return (result as mysql.ResultSetHeader).affectedRows;
    } catch (error) {
      console.error('数据库删除错误:', error);
      throw error;
    }
  }

  // 开始事务
  async beginTransaction() {
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();
    return connection;
  }

  // 提交事务
  async commitTransaction(connection: mysql.PoolConnection) {
    await connection.commit();
    connection.release();
  }

  // 回滚事务
  async rollbackTransaction(connection: mysql.PoolConnection) {
    await connection.rollback();
    connection.release();
  }

  // 测试数据库连接
  async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('数据库连接测试失败:', error);
      return false;
    }
  }

  // 关闭连接池
  async close() {
    await this.pool.end();
  }
}

// 导出数据库实例
export const db = Database.getInstance();

// 数据库初始化函数
export async function initDatabase(): Promise<boolean> {
  try {
    const isConnected = await db.testConnection();
    if (isConnected) {
      console.log('数据库连接成功');
      return true;
    } else {
      console.error('数据库连接失败');
      return false;
    }
  } catch (error) {
    console.error('数据库初始化错误:', error);
    return false;
  }
}