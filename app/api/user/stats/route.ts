import { NextRequest, NextResponse } from 'next/server';
import { tokenUsageService } from '../../../lib/services/tokenUsageService';
import { authMiddleware } from '../../../lib/utils/auth';

export async function GET(req: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await authMiddleware(true)(req);
    
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || '用户未认证' },
        { status: 401 }
      );
    }

    const userId = authResult.user.userId;

    // 获取用户TOKEN使用统计
    const stats = await tokenUsageService.getUserTokenStats(userId);
    
    if (!stats) {
      return NextResponse.json(
        { error: '无法获取用户统计数据' },
        { status: 404 }
      );
    }

    // 获取每日使用统计
    const dailyStats = await tokenUsageService.getUserDailyStats(userId);

    // 格式化每日统计数据
    const formattedDailyStats = formatDailyStats(dailyStats);

    return NextResponse.json({
      success: true,
      stats,
      dailyStats: formattedDailyStats
    });

  } catch (error) {
    console.error('获取用户统计失败:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}

// 格式化每日统计数据
function formatDailyStats(dailyStats: any[]): any[] {
  const statsMap: { [key: string]: any } = {};

  // 按日期分组统计
  dailyStats.forEach(stat => {
    const date = stat.usage_date;
    if (!statsMap[date]) {
      statsMap[date] = {
        date,
        analyze: 0,
        translate: 0,
        tts: 0,
        ocr: 0,
        total: 0
      };
    }

    const tokens = stat.daily_tokens || 0;
    switch (stat.api_endpoint) {
      case 'analyze':
        statsMap[date].analyze += tokens;
        break;
      case 'translate':
        statsMap[date].translate += tokens;
        break;
      case 'tts':
        statsMap[date].tts += tokens;
        break;
      case 'image-to-text':
      case 'file-to-text':
        statsMap[date].ocr += tokens;
        break;
    }
    statsMap[date].total += tokens;
  });

  // 转换为数组并按日期排序
  return Object.values(statsMap)
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 30); // 最多返回30天的数据
}