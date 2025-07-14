import { NextRequest, NextResponse } from 'next/server';
import { databaseUpdater } from '../../../lib/services/databaseUpdater';

export async function POST(req: NextRequest) {
  try {
    // 简单的管理员验证（可以根据需要改进）
    const authHeader = req.headers.get('authorization');
    const adminToken = process.env.ADMIN_TOKEN || 'admin123';
    
    if (!authHeader || !authHeader.includes(adminToken)) {
      return NextResponse.json(
        { error: '无管理员权限' },
        { status: 401 }
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