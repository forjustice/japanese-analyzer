import { db } from '../database';
import { VerificationCode, CreateVerificationCodeInput } from '../types/user';

export class VerificationCodeModel {
  // 生成6位数字验证码
  static generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // 创建验证码
  static async create(input: CreateVerificationCodeInput): Promise<{ id: number; code: string }> {
    const { email, type, user_id } = input;
    const code = this.generateCode();
    
    console.log('📝 [VerificationCode] 开始创建验证码:', { email, type, user_id, code });
    
    // 设置过期时间：注册验证码15分钟，密码重置验证码30分钟
    const expirationMinutes = type === 'registration' ? 15 : 30;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);

    console.log('⏰ [VerificationCode] 验证码过期时间:', expiresAt.toISOString());

    // 先删除该邮箱的旧验证码（同类型）
    const deletedCount = await this.deleteByEmailAndType(email, type);
    console.log('🗑️ [VerificationCode] 删除旧验证码数量:', deletedCount);

    const sql = `
      INSERT INTO verification_codes (user_id, email, code, type, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const id = await db.insert(sql, [user_id || null, email, code, type, expiresAt]);
    console.log('✅ [VerificationCode] 验证码创建成功:', { id, code, expiresAt });
    
    return { id, code };
  }

  // 验证验证码
  static async verify(email: string, code: string, type: string): Promise<VerificationCode | null> {
    const sql = `
      SELECT * FROM verification_codes 
      WHERE email = ? AND code = ? AND type = ? AND is_used = FALSE AND expires_at > NOW()
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    return await db.queryOne<VerificationCode>(sql, [email, code, type]);
  }

  // 原子性验证并标记验证码为已使用（防止竞态条件）
  static async verifyAndMarkUsed(email: string, code: string, type: string): Promise<VerificationCode | null> {
    console.log('🔍 [VerificationCode] 开始原子性验证:', { email, code, type });
    
    // 先查询当前状态用于调试
    const debugSql = `
      SELECT id, email, code, type, is_used, expires_at, created_at,
             NOW() as \`current_time\`,
             (expires_at > NOW()) as is_not_expired
      FROM verification_codes 
      WHERE email = ? AND type = ?
      ORDER BY created_at DESC 
      LIMIT 3
    `;
    const debugResult = await db.query(debugSql, [email, type]);
    console.log('🔍 [VerificationCode] 当前邮箱的验证码状态:', debugResult);
    
    const connection = await db.beginTransaction();
    
    try {
      // 先查询验证码
      const sql = `
        SELECT * FROM verification_codes 
        WHERE email = ? AND code = ? AND type = ? AND is_used = FALSE AND expires_at > NOW()
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
      console.log('✅ [VerificationCode] 验证码已标记为已使用:', verificationCode.id, 'affectedRows:', (updateResult as any).affectedRows);
      
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
    const sql = 'DELETE FROM verification_codes WHERE expires_at < NOW()';
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
    const expiredSql = 'SELECT COUNT(*) as count FROM verification_codes WHERE expires_at < NOW()';
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