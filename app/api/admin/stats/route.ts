import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '../../../lib/middleware/adminAuth';
import { db } from '@/app/lib/database';
import { getSystemUsage } from '@/app/lib/services/systemUsageService';

// Helper to calculate percentage change
const calculateGrowth = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return parseFloat((((current - previous) / previous) * 100).toFixed(1));
};

// --- 6. Recent Activity ---
async function getRecentActivity() {
  const [users, apiKeys] = await Promise.all([
    db.query<{ id: number; email: string; created_at: Date }>(
      'SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 5'
    ),
    db.query<{ id: number; key_value: string; updated_at: Date }>(
      'SELECT id, key_value, updated_at FROM api_keys ORDER BY updated_at DESC LIMIT 5'
    ),
  ]);

  const activities = [
    ...users.map(u => ({ type: 'new_user', description: `New user registered: ${u.email}`, timestamp: u.created_at })),
    ...apiKeys.map(k => ({ type: 'api_key_update', description: `API key updated: ${k.key_value.substring(0, 8)}...`, timestamp: k.updated_at })),
  ];

  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);
}


async function getSystemStats() {
  // --- 1. Basic System Stats ---
  const [
    totalUsersRes,
    totalRequestsRes,
    totalTokensRes,
    todayNewUsersRes,
    todayRequestsRes,
    activeKeysRes,
  ] = await Promise.all([
    db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users'),
    db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM user_analysis_history'),
    db.queryOne<{ sum: string }>('SELECT SUM(token_count) as sum FROM user_analysis_history'),
    db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users WHERE created_at >= CURDATE()'),
    db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM user_analysis_history WHERE created_at >= CURDATE()'),
    db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM api_keys WHERE status = "active"').catch(() => ({ count: 0 })),
  ]);

  const totalUsers = totalUsersRes?.count || 0;
  const totalRequests = totalRequestsRes?.count || 0;
  const totalTokenUsage = parseInt(totalTokensRes?.sum || '0', 10);
  const todayNewUsers = todayNewUsersRes?.count || 0;
  const todayRequests = todayRequestsRes?.count || 0;
  const activeKeys = activeKeysRes?.count || 0;

  // --- 2. Service Usage Stats ---
  // 临时解决方案：由于 user_analysis_history 表没有 service_type 字段，
  // 我们暂时使用所有数据作为 analyze 服务的统计
  const totalAnalysisRes = await db.queryOne<{ count: string; tokens: string }>(`
    SELECT 
      COUNT(*) as count,
      SUM(token_count) as tokens
    FROM user_analysis_history
  `);

  const serviceStats = {
    analyze: { 
      requests: parseInt(totalAnalysisRes?.count || '0', 10), 
      tokens: parseInt(totalAnalysisRes?.tokens || '0', 10) 
    },
    translate: { requests: 0, tokens: 0 },
    tts: { requests: 0, tokens: 0 },
    ocr: { requests: 0, tokens: 0 },
  };

  // --- 3. Daily Stats (Last 7 days) ---
  const dailyStatsRes = await db.query<{ date: Date; users: string; requests: string; tokens: string }>(`
    SELECT
      DATE(created_at) as date,
      COUNT(DISTINCT user_id) as users,
      COUNT(*) as requests,
      SUM(token_count) as tokens
    FROM user_analysis_history
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `);
  
  const dailyStats = dailyStatsRes.map((row) => ({
    date: new Date(row.date).toISOString().split('T')[0],
    users: parseInt(row.users, 10),
    requests: parseInt(row.requests, 10),
    tokens: parseInt(row.tokens, 10),
  }));

  // --- 4. Monthly Growth ---
  const [currentMonthRes, previousMonthRes] = await Promise.all([
      db.queryOne<{ requests: string; tokens: string; users: string }>(`
          SELECT COUNT(*) as requests, SUM(token_count) as tokens, COUNT(DISTINCT user_id) as users 
          FROM user_analysis_history WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      `),
      db.queryOne<{ requests: string; tokens: string; users: string }>(`
          SELECT COUNT(*) as requests, SUM(token_count) as tokens, COUNT(DISTINCT user_id) as users 
          FROM user_analysis_history WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) AND created_at < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      `)
  ]);

  const currentMonth = {
      requests: parseInt(currentMonthRes?.requests || '0', 10),
      tokens: parseInt(currentMonthRes?.tokens || '0', 10),
      users: parseInt(currentMonthRes?.users || '0', 10),
  };
  const previousMonth = {
      requests: parseInt(previousMonthRes?.requests || '0', 10),
      tokens: parseInt(previousMonthRes?.tokens || '0', 10),
      users: parseInt(previousMonthRes?.users || '0', 10),
  };

  const monthlyGrowth = {
    users: calculateGrowth(currentMonth.users, previousMonth.users),
    requests: calculateGrowth(currentMonth.requests, previousMonth.requests),
    tokens: calculateGrowth(currentMonth.tokens, previousMonth.tokens),
  };

  // --- 5. System Usage ---
  const { uptime, memoryUsage, diskUsage } = await getSystemUsage();
  
  // --- 6. Recent Activity ---
  const recentActivity = await getRecentActivity();

  return {
    systemStats: {
      totalUsers,
      totalRequests,
      totalTokenUsage,
      todayNewUsers,
      todayRequests,
      activeKeys,
      systemStatus: 'healthy', // Simplified, can be enhanced
      uptime,
      memoryUsage,
      diskUsage,
    },
    serviceStats,
    dailyStats,
    monthlyGrowth,
    recentActivity,
  };
}


export async function GET(req: NextRequest) {
  try {
    // 验证管理员权限
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: '未提供认证token' }, { status: 401 });
    }

    const adminUser = verifyAdminToken(token);
    if (!adminUser) {
      return NextResponse.json({ error: '无效的认证token' }, { status: 401 });
    }

    // 获取系统统计数据
    const stats = await getSystemStats();

    // 返回仪表盘期望的数据结构
    return NextResponse.json({
      totalUsers: stats.systemStats.totalUsers,
      totalRequests: stats.systemStats.totalRequests,
      totalTokenUsage: stats.systemStats.totalTokenUsage,
      activeKeys: stats.systemStats.activeKeys,
      systemStatus: stats.systemStats.systemStatus,
      uptime: stats.systemStats.uptime,
      serverTime: new Date().toISOString(),
      // 也包含完整的嵌套数据供其他页面使用
      ...stats
    });
  } catch (error) {
    console.error('获取系统统计失败:', error);
    return NextResponse.json({ error: '获取统计数据失败' }, { status: 500 });
  }
}
