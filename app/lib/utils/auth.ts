import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWTPayload, UserProfile } from '../types/user';

// JWT配置
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export class AuthUtils {
  // 生成JWT token
  static generateToken(payload: { userId: number; email: string }): string {
    return jwt.sign(payload, JWT_SECRET);
  }

  // 验证JWT token
  static verifyToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      
      return decoded;
    } catch (error) {
      console.error('Token验证失败:', error);
      return null;
    }
  }

  // 从请求头获取token
  static extractTokenFromHeader(authHeader: string | null): string | null {
    if (!authHeader) {
      return null;
    }

    // 支持 "Bearer token" 格式
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // 直接返回token
    return authHeader;
  }

  // 生成token哈希（用于存储在数据库中）
  static generateTokenHash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // 验证邮箱格式
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // 验证密码强度
  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('密码长度至少8位');
    }

    if (password.length > 100) {
      errors.push('密码长度不能超过100位');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('密码必须包含小写字母');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('密码必须包含大写字母');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('密码必须包含数字');
    }

    // 检查是否包含特殊字符（可选）
    // if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    //   errors.push('密码建议包含特殊字符');
    // }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // 生成安全的随机字符串
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // 获取客户端IP地址
  static getClientIP(request: Request): string {
    const headers = request.headers;
    
    // 检查各种可能的IP头
    const forwardedFor = headers.get('x-forwarded-for');
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }

    const realIP = headers.get('x-real-ip');
    if (realIP) {
      return realIP;
    }

    const cfConnectingIP = headers.get('cf-connecting-ip');
    if (cfConnectingIP) {
      return cfConnectingIP;
    }

    // 如果都没有，返回默认值
    return 'unknown';
  }

  // 获取用户代理信息
  static getUserAgent(request: Request): string {
    return request.headers.get('user-agent') || 'unknown';
  }

  // 清理用户数据（移除敏感信息）
  static sanitizeUserData(user: UserProfile | Record<string, unknown>): UserProfile {
    const userData = user as UserProfile;
    return {
      id: userData.id,
      email: userData.email,
      username: userData.username,
      is_verified: userData.is_verified,
      avatar_url: userData.avatar_url,
      created_at: userData.created_at,
      last_login_at: userData.last_login_at
    };
  }

  // 检查是否为强密码
  static isStrongPassword(password: string): boolean {
    // 至少8位，包含大小写字母、数字
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return strongPasswordRegex.test(password);
  }

  // 生成密码安全提示
  static getPasswordStrengthTips(password: string): string[] {
    const tips: string[] = [];
    
    if (password.length < 8) {
      tips.push('增加密码长度到至少8位');
    }
    
    if (!/[a-z]/.test(password)) {
      tips.push('添加小写字母');
    }
    
    if (!/[A-Z]/.test(password)) {
      tips.push('添加大写字母');
    }
    
    if (!/[0-9]/.test(password)) {
      tips.push('添加数字');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      tips.push('考虑添加特殊字符增强安全性');
    }
    
    return tips;
  }

  // 检查邮箱域名是否在黑名单中
  static isEmailDomainBlocked(email: string): boolean {
    const blockedDomains = [
      '10minutemail.com',
      'guerrillamail.com',
      'tempmail.org',
      // 可以添加更多临时邮箱域名
    ];
    
    const domain = email.split('@')[1]?.toLowerCase();
    return blockedDomains.includes(domain);
  }

  // 验证用户名格式
  static isValidUsername(username: string): boolean {
    // 用户名：3-30位，只能包含字母、数字、下划线、中文
    const usernameRegex = /^[\w\u4e00-\u9fa5]{3,30}$/;
    return usernameRegex.test(username);
  }

  // 格式化错误响应
  static formatErrorResponse(message: string, details?: Record<string, unknown>) {
    return {
      success: false,
      message,
      ...(details && { details })
    };
  }

  // 格式化成功响应
  static formatSuccessResponse(data?: Record<string, unknown>, message?: string) {
    return {
      success: true,
      ...(message && { message }),
      ...(data && { data })
    };
  }
}

// 中间件：验证请求中的JWT token
export function authMiddleware(requireAuth: boolean = true) {
  return async (request: Request): Promise<{ user: JWTPayload | null; error: string | null }> => {
    try {
      const authHeader = request.headers.get('authorization');
      const token = AuthUtils.extractTokenFromHeader(authHeader);

      if (!token) {
        if (requireAuth) {
          return { user: null, error: '缺少认证token' };
        }
        return { user: null, error: null };
      }

      const payload = AuthUtils.verifyToken(token);
      if (!payload) {
        return { user: null, error: 'token无效或已过期' };
      }

      return { user: payload, error: null };
    } catch (error) {
      console.error('认证中间件错误:', error);
      return { user: null, error: '认证过程中发生错误' };
    }
  };
}