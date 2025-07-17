import { NextRequest, NextResponse } from 'next/server';
import { tokenUsageService } from '../services/tokenUsageService';
import { authMiddleware } from '../utils/auth';

/**
 * TOKEN使用量限制中间件
 * 检查用户当月TOKEN使用量是否超过限制
 */
export function createTokenLimitMiddleware(requireAuth: boolean = true) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    try {
      // 获取用户身份信息
      const authResult = await authMiddleware(requireAuth)(req);
      
      if (requireAuth && (authResult.error || !authResult.user)) {
        return NextResponse.json(
          { error: authResult.error || '用户未认证' },
          { status: 401 }
        );
      }

      // 如果用户未认证，跳过TOKEN限制检查
      if (!authResult.user) {
        return null;
      }

      const userId = authResult.user.userId;
        
      // 检查用户TOKEN使用量限制
      const monthlyLimit = parseInt(process.env.MONTHLY_TOKEN_LIMIT || '150000');
      const limitCheck = await tokenUsageService.checkUserLimit(userId, monthlyLimit);
        
      if (limitCheck.isExceeded) {
        return NextResponse.json(
          { 
            error: 'TOKEN使用量已超出限制',
            message: `您本月的TOKEN使用量已达到上限（${limitCheck.limit.toLocaleString()}），无法继续使用AI功能。请联系管理员获取更多额度。`,
            details: {
              currentUsage: limitCheck.currentUsage,
              limit: limitCheck.limit,
              usagePercentage: Math.round((limitCheck.currentUsage / limitCheck.limit) * 100)
            }
          },
          { status: 429 } // Too Many Requests
        );
      }
        
      // 如果接近限制（90%以上），返回警告信息
      const usagePercentage = (limitCheck.currentUsage / limitCheck.limit) * 100;
      if (usagePercentage >= 90) {
        // 在响应头中添加警告信息，前端可以显示提醒
        const response = NextResponse.next();
        response.headers.set('X-Token-Usage-Warning', 'true');
        response.headers.set('X-Token-Usage-Percentage', usagePercentage.toFixed(1));
        response.headers.set('X-Token-Remaining', (limitCheck.limit - limitCheck.currentUsage).toString());
        return response;
      }
      
      // 通过检查，继续处理请求
      return null;
    } catch (error) {
      console.error('TOKEN限制检查失败:', error);
      // 如果检查失败，为了不影响用户体验，允许请求继续（但会记录错误）
      return null;
    }
  };
}

/**
 * 用于前端检查TOKEN使用量状态的工具函数
 */
export async function checkTokenUsageStatus(userId: number): Promise<{
  isExceeded: boolean;
  currentUsage: number;
  limit: number;
  usagePercentage: number;
  warningLevel: 'safe' | 'warning' | 'danger' | 'exceeded';
}> {
  try {
    const monthlyLimit = parseInt(process.env.MONTHLY_TOKEN_LIMIT || '150000');
    const limitCheck = await tokenUsageService.checkUserLimit(userId, monthlyLimit);
    
    const usagePercentage = (limitCheck.currentUsage / limitCheck.limit) * 100;
    
    let warningLevel: 'safe' | 'warning' | 'danger' | 'exceeded' = 'safe';
    if (limitCheck.isExceeded) {
      warningLevel = 'exceeded';
    } else if (usagePercentage >= 90) {
      warningLevel = 'danger';
    } else if (usagePercentage >= 70) {
      warningLevel = 'warning';
    }
    
    return {
      isExceeded: limitCheck.isExceeded,
      currentUsage: limitCheck.currentUsage,
      limit: limitCheck.limit,
      usagePercentage,
      warningLevel
    };
  } catch (error) {
    console.error('检查TOKEN使用状态失败:', error);
    return {
      isExceeded: false,
      currentUsage: 0,
      limit: parseInt(process.env.MONTHLY_TOKEN_LIMIT || '150000'),
      usagePercentage: 0,
      warningLevel: 'safe'
    };
  }
}