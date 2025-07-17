import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '../../../lib/middleware/adminAuth';
import { db } from '../../../lib/database';

async function getUsersList(filters: {
  search?: string;
  status?: string;
  verified?: string;
  page: number;
  pageSize: number;
}) {
  try {
    // 构建查询条件
    let whereClause = '1=1';
    const queryParams: (string | number | boolean)[] = [];

    if (filters.search) {
      whereClause += ' AND (u.username LIKE ? OR u.email LIKE ?)';
      queryParams.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'active') {
        whereClause += ' AND u.is_verified = ?';
        queryParams.push(true);
      } else if (filters.status === 'suspended') {
        whereClause += ' AND u.is_verified = ?';
        queryParams.push(false);
      }
    }

    if (filters.verified && filters.verified !== 'all') {
      const isVerified = filters.verified === 'verified';
      whereClause += ' AND u.is_verified = ?';
      queryParams.push(isVerified);
    }

    // 获取总数
    const countResult = await db.queryOne<{total: number}>(
      `SELECT COUNT(*) as total FROM users u WHERE ${whereClause}`,
      queryParams
    );
    const total = countResult?.total || 0;

    // 获取用户列表
    const offset = (filters.page - 1) * filters.pageSize;
    
    // 使用简单查询，不依赖可能不存在的字段
    const usersResult = await db.query<{
      id: number;
      username: string;
      email: string;
      isVerified: boolean;
      createdAt: string;
      lastLoginAt: string | null;
      status: string;
      totalTokenUsage: number;
      totalRequests: number;
      role: string;
    }>(
      `SELECT 
         u.id,
         u.username,
         u.email,
         u.is_verified as isVerified,
         u.created_at as createdAt,
         u.last_login_at as lastLoginAt,
         u.role,
         CASE 
           WHEN u.is_verified = 1 THEN 'active'
           ELSE 'pending'
         END as status,
         COALESCE(
           (SELECT SUM(input_tokens + output_tokens) 
            FROM user_token_usage 
            WHERE user_id = u.id), 0
         ) as totalTokenUsage,
         COALESCE(
           (SELECT COUNT(*) 
            FROM user_token_usage 
            WHERE user_id = u.id), 0
         ) as totalRequests
       FROM users u
       WHERE ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, filters.pageSize, offset]
    );

    return {
      users: usersResult,
      total
    };
  } catch (error) {
    console.error('获取用户列表失败:', error);
    throw error;
  }
}

export async function GET(req: NextRequest) {
  try {
    // 验证管理员权限
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: '未提供认证token' },
        { status: 401 }
      );
    }

    const adminUser = verifyAdminToken(token);
    if (!adminUser) {
      return NextResponse.json(
        { error: '无效的认证token' },
        { status: 401 }
      );
    }

    // 获取查询参数
    const { searchParams } = new URL(req.url);
    const filters = {
      search: searchParams.get('search') || '',
      status: searchParams.get('status') || 'all',
      verified: searchParams.get('verified') || 'all',
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20')
    };

    // 获取用户列表
    const result = await getUsersList(filters);

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json(
      { error: '获取用户列表失败' },
      { status: 500 }
    );
  }
}