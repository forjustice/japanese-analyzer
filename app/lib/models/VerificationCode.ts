import { db } from '../database';
import { VerificationCode, CreateVerificationCodeInput } from '../types/user';
import mysql from 'mysql2/promise';

export class VerificationCodeModel {
  // 生成6位数字验证码
  static generateCode(): string {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('🔢 [VerificationCode] 生成验证码:', { code, length: code.length, type: typeof code });
    return code;
  }

  // 创建验证码
  static async create(input: CreateVerificationCodeInput): Promise<{ id: number; code: string }> {
    const { email, type, user_id } = input;
    const code = this.generateCode();
    
    console.log('📝 [VerificationCode] 开始创建验证码:', { email, type, user_id, code });
    
    // 设置过期时间：注册验证码15分钟，密码重置验证码30分钟
    const expirationMinutes = type === 'registration' ? 15 : 30;
    
    // 先删除该邮箱的旧验证码（同类型）
    const deletedCount = await this.deleteByEmailAndType(email, type);
    console.log('🗑️ [VerificationCode] 删除旧验证码数量:', deletedCount);

    // 使用 MySQL 的 UTC_TIMESTAMP() 和 DATE_ADD() 来确保时区一致性
    const sql = `
      INSERT INTO verification_codes (user_id, email, code, type, expires_at)
      VALUES (?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))
    `;
    
    console.log('📝 [VerificationCode] 执行SQL:', { sql, params: [user_id || null, email, code, type, expirationMinutes] });
    
    const id = await db.insert(sql, [user_id || null, email, code, type, expirationMinutes]);
    
    // 获取实际创建的验证码记录进行验证
    const createdCode = await db.queryOne<{ 
      id: number; 
      email: string; 
      code: string; 
      type: string; 
      expires_at: string; 
      is_used: boolean; 
      created_at: string 
    }>('SELECT id, email, code, type, expires_at, is_used, created_at FROM verification_codes WHERE id = ?', [id]);
    
    console.log('✅ [VerificationCode] 验证码创建成功，数据库记录:', JSON.stringify(createdCode, null, 2));
    
    // 立即验证创建的验证码是否能被查询到
    const verifyTestSql = `
      SELECT * FROM verification_codes 
      WHERE email = ? AND code = ? AND type = ? AND is_used = FALSE AND expires_at > UTC_TIMESTAMP()
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const verifyTest = await db.queryOne(verifyTestSql, [email, code, type]);
    console.log('🔍 [VerificationCode] 创建后立即验证查询结果:', JSON.stringify(verifyTest, null, 2));
    
    return { id, code };
  }

  // 验证验证码
  static async verify(email: string, code: string, type: string): Promise<VerificationCode | null> {
    const sql = `
      SELECT * FROM verification_codes 
      WHERE email = ? AND code = ? AND type = ? AND is_used = FALSE AND expires_at > UTC_TIMESTAMP()
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    return await db.queryOne<VerificationCode>(sql, [email, code, type]);
  }

  // 原子性验证并标记验证码为已使用（防止竞态条件）
  static async verifyAndMarkUsed(email: string, code: string, type: string): Promise<VerificationCode | null> {
    console.log('🔍 [VerificationCode] 开始原子性验证:', { email, code, type });
    
    // 先查询当前状态用于调试（使用UTC时间）
    const debugSql = `
      SELECT id, email, code, type, is_used, expires_at, created_at,
             UTC_TIMESTAMP() as \`current_utc_time\`,
             NOW() as \`current_local_time\`,
             (expires_at > UTC_TIMESTAMP()) as is_not_expired_utc,
             (expires_at > NOW()) as is_not_expired_local,
             TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), expires_at) as minutes_until_expiry_utc,
             TIMESTAMPDIFF(MINUTE, NOW(), expires_at) as minutes_until_expiry_local
      FROM verification_codes 
      WHERE email = ? AND type = ?
      ORDER BY created_at DESC 
      LIMIT 3
    `;
    const debugResult = await db.query(debugSql, [email, type]);
    console.log('🔍 [VerificationCode] 当前邮箱的验证码状态:', JSON.stringify(debugResult, null, 2));
    
    // 如果是Vercel环境，添加更多调试信息
    if (process.env.VERCEL_ENV) {
      console.log('🌐 [VerificationCode] Vercel环境调试信息:', {
        vercelEnv: process.env.VERCEL_ENV,
        vercelRegion: process.env.VERCEL_REGION,
        timezone: process.env.TZ,
        nodeEnv: process.env.NODE_ENV,
        currentTime: new Date().toISOString(),
        timezoneOffset: new Date().getTimezoneOffset()
      });
    }
    
    const connection = await db.beginTransaction();
    
    try {
      // 使用 UTC_TIMESTAMP() 替代 NOW() 来避免时区问题
      const sql = `
        SELECT * FROM verification_codes 
        WHERE email = ? AND code = ? AND type = ? AND is_used = FALSE AND expires_at > UTC_TIMESTAMP()
        ORDER BY created_at DESC 
        LIMIT 1
        FOR UPDATE
      `;
      
      console.log('🔍 [VerificationCode] 执行验证查询:', { email, code, type });
      const [rows] = await connection.execute(sql, [email, code, type]);
      const verificationCode = Array.isArray(rows) && rows.length > 0 ? rows[0] as VerificationCode : null;
      
      if (!verificationCode) {
        console.log('❌ [VerificationCode] 验证码验证失败 - 未找到有效验证码');
        console.log('🔍 [VerificationCode] 查询结果:', rows);
        
        // 如果没有找到有效验证码，查询所有相关验证码进行调试
        const allCodesSql = `
          SELECT id, email, code, type, is_used, expires_at, created_at,
                 UTC_TIMESTAMP() as current_utc_time,
                 (expires_at > UTC_TIMESTAMP()) as is_not_expired_utc,
                 TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), expires_at) as minutes_until_expiry_utc,
                 (code = ?) as code_matches
          FROM verification_codes 
          WHERE email = ? AND type = ?
          ORDER BY created_at DESC 
          LIMIT 5
        `;
        const allCodesResult = await connection.execute(allCodesSql, [code, email, type]);
        console.log('🔍 [VerificationCode] 所有相关验证码:', JSON.stringify(allCodesResult[0], null, 2));
        
        // 单独检查是否存在匹配的验证码（忽略时间和使用状态）
        const codeExistsSql = `
          SELECT id, email, code, type, is_used, expires_at, created_at
          FROM verification_codes 
          WHERE email = ? AND code = ? AND type = ?
          ORDER BY created_at DESC 
          LIMIT 1
        `;
        const codeExistsResult = await connection.execute(codeExistsSql, [email, code, type]);
        console.log('🔍 [VerificationCode] 匹配的验证码查询结果:', JSON.stringify(codeExistsResult[0], null, 2));
        
        await db.rollbackTransaction(connection);
        return null;
      }
      
      console.log('✅ [VerificationCode] 找到有效验证码:', {
        id: verificationCode.id,
        email: verificationCode.email,
        code: verificationCode.code,
        expires_at: verificationCode.expires_at,
        is_used: verificationCode.is_used
      });
      
      // 立即标记为已使用
      const [updateResult] = await connection.execute('UPDATE verification_codes SET is_used = TRUE WHERE id = ?', [verificationCode.id]);
      console.log('✅ [VerificationCode] 验证码已标记为已使用:', verificationCode.id, 'affectedRows:', (updateResult as mysql.ResultSetHeader).affectedRows);
      
      await db.commitTransaction(connection);
      console.log('✅ [VerificationCode] 事务提交成功');
      return verificationCode;
      
    } catch (error) {
      console.error('❌ [VerificationCode] 原子性验证失败:', error);
      await db.rollbackTransaction(connection);
      throw error;
    }
  }

  // 标记验证码为已使用
  static async markAsUsed(id: number): Promise<boolean> {
    const sql = 'UPDATE verification_codes SET is_used = TRUE WHERE id = ?';
    const affectedRows = await db.update(sql, [id]);
    return affectedRows > 0;
  }

  // 根据邮箱和类型删除验证码
  static async deleteByEmailAndType(email: string, type: string): Promise<number> {
    const sql = 'DELETE FROM verification_codes WHERE email = ? AND type = ?';
    return await db.delete(sql, [email, type]);
  }

  // 根据邮箱获取最新的验证码（用于重发）
  static async getLatestByEmail(email: string, type: string): Promise<VerificationCode | null> {
    const sql = `
      SELECT * FROM verification_codes 
      WHERE email = ? AND type = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    return await db.queryOne<VerificationCode>(sql, [email, type]);
  }

  // 检查是否可以重发验证码（防止频繁发送）
  static async canResend(email: string, type: string, intervalMinutes: number = 1): Promise<boolean> {
    const latestCode = await this.getLatestByEmail(email, type);
    
    if (!latestCode) {
      return true;
    }

    const now = new Date();
    const lastSentTime = new Date(latestCode.created_at);
    const timeDiffMinutes = (now.getTime() - lastSentTime.getTime()) / (1000 * 60);
    
    return timeDiffMinutes >= intervalMinutes;
  }

  // 清理过期的验证码
  static async cleanExpired(): Promise<number> {
    const sql = 'DELETE FROM verification_codes WHERE expires_at < UTC_TIMESTAMP()';
    return await db.delete(sql);
  }

  // 获取验证码统计
  static async getStats(): Promise<{
    total: number;
    used: number;
    expired: number;
    byType: { [key: string]: number };
  }> {
    const totalSql = 'SELECT COUNT(*) as count FROM verification_codes';
    const usedSql = 'SELECT COUNT(*) as count FROM verification_codes WHERE is_used = TRUE';
    const expiredSql = 'SELECT COUNT(*) as count FROM verification_codes WHERE expires_at < UTC_TIMESTAMP()';
    const byTypeSql = 'SELECT type, COUNT(*) as count FROM verification_codes GROUP BY type';

    const [totalResult, usedResult, expiredResult, byTypeResults] = await Promise.all([
      db.queryOne<{ count: number }>(totalSql),
      db.queryOne<{ count: number }>(usedSql),
      db.queryOne<{ count: number }>(expiredSql),
      db.query<{ type: string; count: number }>(byTypeSql)
    ]);

    const byType: { [key: string]: number } = {};
    byTypeResults.forEach((row) => {
      byType[row.type] = row.count;
    });

    return {
      total: totalResult?.count || 0,
      used: usedResult?.count || 0,
      expired: expiredResult?.count || 0,
      byType
    };
  }

  // 撤销验证码（设置为已使用）
  static async revoke(email: string, type: string): Promise<number> {
    const sql = `
      UPDATE verification_codes 
      SET is_used = TRUE 
      WHERE email = ? AND type = ? AND is_used = FALSE
    `;
    return await db.update(sql, [email, type]);
  }
}