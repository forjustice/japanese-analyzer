import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

interface UserPayload {
  id: number;
  email: string;
  username: string;
}

async function getConnection() {
  try {
    return await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'japanese_analyzer'
    });
  } catch (error) {
    console.error('数据库连接失败:', error);
    throw error;
  }
}

async function verifyUserToken(token: string): Promise<UserPayload | null> {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      throw new Error('JWT secret not configured');
    }

    const decoded = jwt.verify(token, jwtSecret) as UserPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  let connection;
  try {
    // 验证用户身份
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: '未提供认证token' },
        { status: 401 }
      );
    }

    const user = await verifyUserToken(token);
    if (!user) {
      return NextResponse.json(
        { error: '无效的认证token' },
        { status: 401 }
      );
    }

    connection = await getConnection();

    // 查询用户额度
    const [quotaRows] = await connection.execute(
      'SELECT * FROM user_quotas WHERE user_id = ?',
      [user.id]
    );

    const quotas = quotaRows as Record<string, unknown>[];
    
    if (quotas.length === 0) {
      // 用户还没有额度记录
      return NextResponse.json({
        quota: {
          token_quota: 0,
          expires_at: null,
          last_reset_at: null,
          is_expired: true
        }
      });
    }

    const quota = quotas[0];
    const now = new Date();
    const expiresAt = quota.expires_at ? new Date(quota.expires_at as string) : null;
    const isExpired = expiresAt ? now > expiresAt : true;

    return NextResponse.json({
      quota: {
        token_quota: quota.token_quota,
        expires_at: quota.expires_at,
        last_reset_at: quota.last_reset_at,
        is_expired: isExpired,
        days_remaining: expiresAt && !isExpired ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0
      }
    });
  } catch (error) {
    console.error('获取用户额度失败:', error);
    return NextResponse.json(
      { error: '获取用户额度失败' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}