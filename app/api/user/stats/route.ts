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
function formatDailyStats(dailyStats: Array<{
  usage_date: string;
  api_endpoint: string;
  total_tokens: number;
  request_count: number;
}>): Array<{
  date: string;
  totalTokens: number;
  totalRequests: number;
  analyzeTokens: number;
  translateTokens: number;
  ttsTokens: number;
  ocrTokens: number;
}> {
  const statsMap: { [key: string]: {
    date: string;
    totalTokens: number;
    totalRequests: number;
    analyzeTokens: number;
    translateTokens: number;
    ttsTokens: number;
    ocrTokens: number;
  } } = {};

  // 按日期分组统计
  dailyStats.forEach(stat => {
    const date = stat.usage_date;
    if (!statsMap[date]) {
      statsMap[date] = {
        date,
        totalTokens: 0,
        totalRequests: 0,
        analyzeTokens: 0,
        translateTokens: 0,
        ttsTokens: 0,
        ocrTokens: 0
      };
    }

    const tokens = stat.total_tokens || 0;
    const requests = stat.request_count || 0;
    
    statsMap[date].totalTokens += tokens;
    statsMap[date].totalRequests += requests;
    
    switch (stat.api_endpoint) {
      case 'analyze':
        statsMap[date].analyzeTokens += tokens;
        break;
      case 'translate':
        statsMap[date].translateTokens += tokens;
        break;
      case 'tts':
        statsMap[date].ttsTokens += tokens;
        break;
      case 'image-to-text':
      case 'file-to-text':
        statsMap[date].ocrTokens += tokens;
        break;
    }
  });

  // 转换为数组并按日期排序
  return Object.values(statsMap)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 31); // 最多返回当月31天的数据
}