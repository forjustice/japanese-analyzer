import { NextRequest, NextResponse } from 'next/server';
import { analysisHistoryService } from '../../../lib/services/analysisHistoryService';
import { authMiddleware } from '../../../lib/utils/auth';

// POST - 导入历史记录（用于从本地存储迁移）
export async function POST(req: NextRequest) {
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
    const { historyItems } = await req.json();

    if (!historyItems || !Array.isArray(historyItems)) {
      return NextResponse.json(
        { error: '无效的历史记录数据' },
        { status: 400 }
      );
    }

    // 转换本地存储格式到服务器格式
    interface ImportHistoryItem {
      originalText: string;
      tokens: Array<{
        word: string;
        pos: string;
        furigana?: string;
        romaji?: string;
      }>;
      translation?: string;
    }

    const convertedItems = historyItems.map((item: ImportHistoryItem) => ({
      originalText: item.originalText,
      tokens: item.tokens,
      translation: item.translation
    }));

    const importedCount = await analysisHistoryService.importHistory(userId, convertedItems);

    return NextResponse.json({
      success: true,
      importedCount,
      totalItems: historyItems.length
    });

  } catch (error) {
    console.error('导入历史记录失败:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}