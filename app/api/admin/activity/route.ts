import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '../../../lib/middleware/adminAuth';
import { db } from '../../../lib/database';

async function getRecentActivity() {
  try {
    const activities = [];

    // 获取最近用户注册
    const recentUsers = await db.query<{id: number; username: string; created_at: string}>(`
      SELECT id, username, created_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    for (const user of recentUsers) {
      activities.push({
        id: `user_${user.id}`,
        type: 'user_register',
        message: `新用户注册: ${user.username}`,
        timestamp: user.created_at
      });
    }

    // 获取最近API请求统计
    const recentRequests = await db.query<{api_endpoint: string; count: number; latest_time: string}>(`
      SELECT api_endpoint, COUNT(*) as count, MAX(request_time) as latest_time
      FROM user_token_usage 
      WHERE request_time >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
      GROUP BY api_endpoint
      ORDER BY latest_time DESC
      LIMIT 5
    `);

    for (const request of recentRequests) {
      activities.push({
        id: `request_${request.api_endpoint}_${Date.now()}`,
        type: 'api_request',
        message: `${request.api_endpoint} API调用 ${request.count} 次`,
        timestamp: request.latest_time
      });
    }

    // 按时间戳排序并限制数量
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return activities.slice(0, 10);
  } catch (error) {
    console.error('获取活动日志失败:', error);
    return [];
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

    // 获取最近活动
    const activities = await getRecentActivity();

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('获取活动日志失败:', error);
    return NextResponse.json(
      { error: '获取活动日志失败' },
      { status: 500 }
    );
  }
}