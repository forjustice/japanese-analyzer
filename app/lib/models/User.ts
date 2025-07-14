import bcrypt from 'bcryptjs';
import { db } from '../database';
import { User, CreateUserInput, UserProfile } from '../types/user';

export class UserModel {
  // 根据邮箱查找用户
  static async findByEmail(email: string): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE email = ?';
    return await db.queryOne<User>(sql, [email]);
  }

  // 根据ID查找用户
  static async findById(id: number): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE id = ?';
    return await db.queryOne<User>(sql, [id]);
  }

  // 创建新用户
  static async create(input: CreateUserInput): Promise<number> {
    const { email, password, username } = input;
    
    // 检查邮箱是否已存在
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new Error('邮箱已经被注册');
    }

    // 哈希密码
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const sql = `
      INSERT INTO users (email, password_hash, username, is_verified, is_active)
      VALUES (?, ?, ?, FALSE, TRUE)
    `;
    
    return await db.insert(sql, [email, passwordHash, username]);
  }

  // 验证密码
  static async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // 用户登录验证
  static async authenticate(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }

    // 检查账户是否激活
    if (!user.is_active) {
      throw new Error('账户已被禁用');
    }

    // 验证密码
    const isValidPassword = await this.validatePassword(password, user.password_hash);
    if (!isValidPassword) {
      return null;
    }

    // 更新最后登录时间
    await this.updateLastLogin(user.id);

    return user;
  }

  // 更新最后登录时间
  static async updateLastLogin(userId: number): Promise<void> {
    const sql = 'UPDATE users SET last_login_at = NOW() WHERE id = ?';
    await db.update(sql, [userId]);
  }

  // 验证用户邮箱
  static async verifyEmail(userId: number): Promise<boolean> {
    const sql = 'UPDATE users SET is_verified = TRUE WHERE id = ?';
    const affectedRows = await db.update(sql, [userId]);
    return affectedRows > 0;
  }

  // 更新用户密码
  static async updatePassword(userId: number, newPassword: string): Promise<boolean> {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    
    const sql = 'UPDATE users SET password_hash = ? WHERE id = ?';
    const affectedRows = await db.update(sql, [passwordHash, userId]);
    return affectedRows > 0;
  }

  // 更新用户信息
  static async updateProfile(userId: number, updates: { username?: string; avatar_url?: string }): Promise<boolean> {
    const fields = [];
    const values = [];

    if (updates.username !== undefined) {
      fields.push('username = ?');
      values.push(updates.username);
    }

    if (updates.avatar_url !== undefined) {
      fields.push('avatar_url = ?');
      values.push(updates.avatar_url);
    }

    if (fields.length === 0) {
      return false;
    }

    values.push(userId);
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    const affectedRows = await db.update(sql, values);
    return affectedRows > 0;
  }

  // 禁用/启用用户账户
  static async setActiveStatus(userId: number, isActive: boolean): Promise<boolean> {
    const sql = 'UPDATE users SET is_active = ? WHERE id = ?';
    const affectedRows = await db.update(sql, [isActive, userId]);
    return affectedRows > 0;
  }

  // 删除用户（软删除，设置为不激活）
  static async softDelete(userId: number): Promise<boolean> {
    return await this.setActiveStatus(userId, false);
  }

  // 硬删除用户（物理删除）
  static async hardDelete(userId: number): Promise<boolean> {
    const sql = 'DELETE FROM users WHERE id = ?';
    const affectedRows = await db.delete(sql, [userId]);
    return affectedRows > 0;
  }

  // 获取用户公开资料
  static async getProfile(userId: number): Promise<UserProfile | null> {
    const sql = `
      SELECT id, email, username, is_verified, avatar_url, created_at, last_login_at
      FROM users 
      WHERE id = ? AND is_active = TRUE
    `;
    return await db.queryOne<UserProfile>(sql, [userId]);
  }

  // 检查邮箱是否已被注册
  static async isEmailTaken(email: string): Promise<boolean> {
    const user = await this.findByEmail(email);
    return user !== null;
  }

  // 获取用户统计信息
  static async getUserStats(): Promise<{ total: number; verified: number; active: number }> {
    const sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_verified = TRUE THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active
      FROM users
    `;
    const result = await db.queryOne<{ total: number; verified: number; active: number }>(sql);
    return {
      total: result?.total || 0,
      verified: result?.verified || 0,
      active: result?.active || 0
    };
  }
}