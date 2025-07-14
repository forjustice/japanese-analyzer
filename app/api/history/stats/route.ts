import { NextRequest, NextResponse } from 'next/server';
import { analysisHistoryService } from '../../../lib/services/analysisHistoryService';
import { authMiddleware } from '../../../lib/utils/auth';

// GET - 获取用户历史记录统计
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
    const stats = await analysisHistoryService.getUserHistoryStats(userId);

    return NextResponse.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('获取历史记录统计失败:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}