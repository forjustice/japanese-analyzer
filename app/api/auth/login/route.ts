import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '../../../lib/models/User';
import { AuthUtils } from '../../../lib/utils/auth';
import { initDatabase } from '../../../lib/database';

// 用户登录API
export async function POST(request: NextRequest) {
  try {
    // 初始化数据库连接
    const dbConnected = await initDatabase();
    if (!dbConnected) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('数据库连接失败'),
        { status: 500 }
      );
    }

    const { email, password } = await request.json();

    // 验证输入参数
    if (!email || !password) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('邮箱和密码为必填项'),
        { status: 400 }
      );
    }

    // 验证邮箱格式
    if (!AuthUtils.isValidEmail(email)) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('邮箱格式不正确'),
        { status: 400 }
      );
    }

    // 尝试用户认证
    let user;
    try {
      user = await UserModel.authenticate(email.toLowerCase(), password);
    } catch (error: unknown) {
      // 处理特定的认证错误
      if (error instanceof Error && error.message === '账户已被禁用') {
        return NextResponse.json(
          AuthUtils.formatErrorResponse('你的账户已被禁用，请联系管理员'),
          { status: 403 }
        );
      }
      throw error; // 重新抛出其他错误
    }

    if (!user) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('邮箱或密码错误'),
        { status: 401 }
      );
    }

    // 检查用户是否已验证邮箱
    if (!user.is_verified) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('请先验证你的邮箱地址', {
          needVerification: true,
          userId: user.id
        }),
        { status: 403 }
      );
    }

    // 生成JWT token
    const token = AuthUtils.generateToken({
      userId: user.id,
      email: user.email
    });

    // 获取用户资料（不包含敏感信息）
    const userProfile = AuthUtils.sanitizeUserData(user);

    // 获取客户端信息（用于日志记录）
    const clientIP = AuthUtils.getClientIP(request);

    console.log(`用户登录成功: ${user.email} from ${clientIP}`);

    // 返回成功响应
    return NextResponse.json(
      AuthUtils.formatSuccessResponse({
        message: '登录成功',
        token,
        user: userProfile
      })
    );

  } catch (error) {
    console.error('登录过程中发生错误:', error);
    return NextResponse.json(
      AuthUtils.formatErrorResponse('登录过程中发生错误'),
      { status: 500 }
    );
  }
}

// 验证token并获取用户信息
export async function GET(request: NextRequest) {
  try {
    // 初始化数据库连接
    const dbConnected = await initDatabase();
    if (!dbConnected) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('数据库连接失败'),
        { status: 500 }
      );
    }

    // 验证token
    const authResult = await authMiddleware(true)(request);
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse(authResult.error || '认证失败'),
        { status: 401 }
      );
    }

    // 获取用户完整信息
    const user = await UserModel.findById(authResult.user.userId);
    if (!user) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('用户不存在'),
        { status: 404 }
      );
    }

    // 检查用户状态
    if (!user.is_active) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('账户已被禁用'),
        { status: 403 }
      );
    }

    // 获取用户资料
    const userProfile = AuthUtils.sanitizeUserData(user);

    return NextResponse.json(
      AuthUtils.formatSuccessResponse({
        user: userProfile
      })
    );

  } catch (error) {
    console.error('获取用户信息时发生错误:', error);
    return NextResponse.json(
      AuthUtils.formatErrorResponse('获取用户信息时发生错误'),
      { status: 500 }
    );
  }
}

// 导入认证中间件
import { authMiddleware } from '../../../lib/utils/auth';