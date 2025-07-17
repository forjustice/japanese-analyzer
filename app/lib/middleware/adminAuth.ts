import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '@/app/lib/database';

export interface AdminUser {
  id: number;
  email: string;
  username: string;
  role: 'super_admin' | 'admin';
}

/**
 * 管理员认证中间件
 */
export function createAdminAuthMiddleware() {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    try {
      // 检查是否是登录页面，允许通过
      if (req.nextUrl.pathname === '/admin/login') {
        return null;
      }

      // 获取管理员token
      const authHeader = req.headers.get('authorization');
      const cookieToken = req.cookies.get('admin_token')?.value;
      const token = authHeader?.replace('Bearer ', '') || cookieToken;

      if (!token) {
        // 重定向到登录页面
        return NextResponse.redirect(new URL('/admin/login', req.url));
      }

      // 验证token
      const jwtSecret = getJwtSecret();
      const decoded = jwt.verify(token, jwtSecret) as AdminUser;

      if (!decoded || (!decoded.role || !['super_admin', 'admin'].includes(decoded.role))) {
        return NextResponse.redirect(new URL('/admin/login', req.url));
      }

      // 将管理员信息添加到请求头中
      const response = NextResponse.next();
      response.headers.set('X-Admin-User-Id', decoded.id.toString());
      response.headers.set('X-Admin-Username', decoded.username);
      response.headers.set('X-Admin-Role', decoded.role);

      return response;
    } catch (error) {
      console.error('管理员认证失败:', error);
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
  };
}

/**
 * 验证管理员登录凭据 - 基于数据库
 */
export async function validateAdminCredentials(loginIdentifier: string, password: string): Promise<AdminUser | null> {
  try {
    // 查询数据库中的管理员用户（通过邮箱或用户名）
    const user = await db.queryOne<{
      id: number;
      email: string;
      username: string;
      password_hash: string;
      role: 'user' | 'admin' | 'super_admin';
      is_active: boolean;
      is_verified: boolean;
    }>(
      `SELECT id, email, username, password_hash, role, is_active, is_verified 
       FROM users 
       WHERE (email = ? OR username = ?) 
       AND role IN ('admin', 'super_admin') 
       AND is_active = TRUE`,
      [loginIdentifier, loginIdentifier]
    );

    if (!user) {
      return null;
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return null;
    }

    // 更新最后登录时间
    await db.update(
      'UPDATE users SET last_login_at = NOW() WHERE id = ?',
      [user.id]
    );

    return {
      id: user.id,
      email: user.email,
      username: user.username || user.email.split('@')[0],
      role: user.role as 'super_admin' | 'admin'
    };
  } catch (error) {
    console.error('管理员认证失败:', error);
    return null;
  }
}

/**
 * 获取JWT密钥（从.env文件读取）
 */
function getJwtSecret(): string {
  // 直接从环境变量获取JWT_SECRET
  return process.env.JWT_SECRET || 'your-secret-key';
}

/**
 * 生成管理员JWT token
 */
export function generateAdminToken(adminUser: AdminUser): string {
  const jwtSecret = getJwtSecret();
  return jwt.sign(
    {
      id: adminUser.id,
      username: adminUser.username,
      role: adminUser.role
    },
    jwtSecret,
    { expiresIn: '24h' }
  );
}

/**
 * 验证管理员token
 */
export function verifyAdminToken(token: string): AdminUser | null {
  try {
    if (!token || token.trim() === '') {
      console.error('Token为空或未定义');
      return null;
    }

    // 检查token格式是否正确（应该是三个部分用.分隔）
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      console.error('Token格式不正确，应该包含3个部分:', token);
      return null;
    }

    const jwtSecret = getJwtSecret();
    const decoded = jwt.verify(token, jwtSecret) as AdminUser;
    
    // 验证角色
    if (!decoded.role || !['super_admin', 'admin'].includes(decoded.role)) {
      console.error('Token中角色无效:', decoded.role);
      return null;
    }
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      console.error('JWT token格式错误:', error.message, 'Token:', token);
    } else if (error instanceof jwt.TokenExpiredError) {
      console.error('JWT token已过期:', error.message);
    } else {
      console.error('验证管理员token失败:', error);
    }
    return null;
  }
}