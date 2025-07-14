import { NextRequest, NextResponse } from 'next/server';
import { analysisHistoryService } from '../../lib/services/analysisHistoryService';
import { authMiddleware } from '../../lib/utils/auth';

// GET - 获取用户历史记录
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
    const { searchParams } = new URL(req.url);
    
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const query = searchParams.get('query');

    let history;
    if (query) {
      history = await analysisHistoryService.searchHistory(userId, query, limit);
    } else {
      history = await analysisHistoryService.getUserHistory(userId, limit, offset);
    }

    return NextResponse.json({
      success: true,
      history
    });

  } catch (error) {
    console.error('获取历史记录失败:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}

// POST - 保存新的历史记录
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
    const { originalText, tokens, translation } = await req.json();

    if (!originalText || !tokens || !Array.isArray(tokens)) {
      return NextResponse.json(
        { error: '缺少必要的参数' },
        { status: 400 }
      );
    }

    const historyId = await analysisHistoryService.saveHistory(userId, {
      originalText,
      tokens,
      translation
    });

    return NextResponse.json({
      success: true,
      id: historyId
    });

  } catch (error) {
    console.error('保存历史记录失败:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}

// DELETE - 删除历史记录或清空所有历史记录
export async function DELETE(req: NextRequest) {
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
    const { searchParams } = new URL(req.url);
    const historyId = searchParams.get('id');
    const clearAll = searchParams.get('clearAll') === 'true';

    if (clearAll) {
      const deletedCount = await analysisHistoryService.clearUserHistory(userId);
      return NextResponse.json({
        success: true,
        deletedCount
      });
    } else if (historyId) {
      const success = await analysisHistoryService.deleteHistory(userId, historyId);
      return NextResponse.json({
        success,
        message: success ? '删除成功' : '记录不存在'
      });
    } else {
      return NextResponse.json(
        { error: '缺少必要的参数' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('删除历史记录失败:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}