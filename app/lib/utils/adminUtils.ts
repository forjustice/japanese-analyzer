import bcrypt from 'bcryptjs';
import { db } from '@/app/lib/database';

/**
 * 生成密码哈希
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * 创建管理员账户
 */
export async function createAdminUser(
  email: string,
  password: string,
  username: string,
  role: 'admin' | 'super_admin' = 'admin'
): Promise<{ success: boolean; message: string; userId?: number }> {
  try {
    // 检查邮箱是否已存在
    const existingUser = await db.queryOne<{ id: number }>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser) {
      return { success: false, message: '邮箱已被使用' };
    }

    // 生成密码哈希
    const passwordHash = await hashPassword(password);

    // 创建管理员用户
    const userId = await db.insert(
      `INSERT INTO users (email, username, password_hash, role, is_verified, is_active) 
       VALUES (?, ?, ?, ?, TRUE, TRUE)`,
      [email, username, passwordHash, role]
    );

    return { 
      success: true, 
      message: '管理员账户创建成功',
      userId: userId
    };
  } catch (error) {
    console.error('创建管理员账户失败:', error);
    return { success: false, message: '创建管理员账户失败' };
  }
}

/**
 * 更新管理员密码
 */
export async function updateAdminPassword(
  adminId: number,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    // 生成新的密码哈希
    const passwordHash = await hashPassword(newPassword);

    // 更新密码
    const affectedRows = await db.update(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ? AND role IN ("admin", "super_admin")',
      [passwordHash, adminId]
    );

    if (affectedRows === 0) {
      return { success: false, message: '管理员用户不存在' };
    }

    return { success: true, message: '密码更新成功' };
  } catch (error) {
    console.error('更新管理员密码失败:', error);
    return { success: false, message: '更新密码失败' };
  }
}

/**
 * 获取所有管理员用户
 */
export async function getAllAdminUsers(): Promise<{
  id: number;
  email: string;
  username: string;
  role: 'admin' | 'super_admin';
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
}[]> {
  try {
    const admins = await db.query<{
      id: number;
      email: string;
      username: string;
      role: 'admin' | 'super_admin';
      is_active: boolean;
      last_login_at: Date | null;
      created_at: Date;
    }>(
      `SELECT id, email, username, role, is_active, last_login_at, created_at 
       FROM users 
       WHERE role IN ('admin', 'super_admin') 
       ORDER BY created_at DESC`
    );

    return admins;
  } catch (error) {
    console.error('获取管理员用户失败:', error);
    return [];
  }
}

/**
 * 切换管理员账户状态
 */
export async function toggleAdminStatus(
  adminId: number,
  isActive: boolean
): Promise<{ success: boolean; message: string }> {
  try {
    const affectedRows = await db.update(
      'UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ? AND role IN ("admin", "super_admin")',
      [isActive, adminId]
    );

    if (affectedRows === 0) {
      return { success: false, message: '管理员用户不存在' };
    }

    return { 
      success: true, 
      message: `管理员账户已${isActive ? '启用' : '禁用'}` 
    };
  } catch (error) {
    console.error('切换管理员状态失败:', error);
    return { success: false, message: '操作失败' };
  }
}

/**
 * 删除管理员账户
 */
export async function deleteAdminUser(
  adminId: number
): Promise<{ success: boolean; message: string }> {
  try {
    // 防止删除最后一个超级管理员
    const superAdminCount = await db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM users WHERE role = "super_admin" AND is_active = TRUE'
    );

    const userToDelete = await db.queryOne<{ role: string }>(
      'SELECT role FROM users WHERE id = ?',
      [adminId]
    );

    if (userToDelete?.role === 'super_admin' && superAdminCount?.count === 1) {
      return { success: false, message: '不能删除最后一个超级管理员' };
    }

    const affectedRows = await db.delete(
      'DELETE FROM users WHERE id = ? AND role IN ("admin", "super_admin")',
      [adminId]
    );

    if (affectedRows === 0) {
      return { success: false, message: '管理员用户不存在' };
    }

    return { success: true, message: '管理员账户已删除' };
  } catch (error) {
    console.error('删除管理员账户失败:', error);
    return { success: false, message: '删除失败' };
  }
}

/**
 * 验证管理员权限
 */
export function checkAdminPermission(
  currentAdminRole: 'admin' | 'super_admin',
  requiredRole: 'admin' | 'super_admin'
): boolean {
  if (requiredRole === 'super_admin') {
    return currentAdminRole === 'super_admin';
  }
  return ['admin', 'super_admin'].includes(currentAdminRole);
}