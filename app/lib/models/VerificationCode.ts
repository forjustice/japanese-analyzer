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
    
    // 设置过期时间：注册验证码15分钟，密码重置验证码30分钟
    const expirationMinutes = type === 'registration' ? 15 : 30;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);

    // 先删除该邮箱的旧验证码（同类型）
    await this.deleteByEmailAndType(email, type);

    const sql = `
      INSERT INTO verification_codes (user_id, email, code, type, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const id = await db.insert(sql, [user_id || null, email, code, type, expiresAt]);
    
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