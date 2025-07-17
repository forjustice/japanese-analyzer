import { NextRequest, NextResponse } from 'next/server';
import { databaseUpdater } from '../../../lib/services/databaseUpdater';
import { verifyAdminToken } from '../../../lib/middleware/adminAuth';

export async function POST(req: NextRequest) {
  try {
    // 使用管理后台的认证系统
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: '未提供认证token' },
        { status: 401 }
      );
    }

    const adminUser = verifyAdminToken(token);
    if (!adminUser || adminUser.role !== 'super_admin') {
      return NextResponse.json(
        { error: '需要超级管理员权限' },
        { status: 403 }
      );
    }

    const { action } = await req.json();

    switch (action) {
      case 'update_monthly_stats':
        await databaseUpdater.updateToMonthlyStats();
        return NextResponse.json({
          success: true,
          message: '数据库已成功更新为月度统计模式'
        });

      case 'refresh_current_month':
        await databaseUpdater.updateCurrentMonthStats();
        return NextResponse.json({
          success: true,
          message: '当月统计数据已刷新'
        });

      default:
        return NextResponse.json(
          { error: '未知操作' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('数据库更新失败:', error);
    return NextResponse.json(
      { error: '数据库更新失败: ' + (error instanceof Error ? error.message : '未知错误') },
      { status: 500 }
    );
  }
}