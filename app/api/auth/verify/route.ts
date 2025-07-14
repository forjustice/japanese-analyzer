import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '../../../lib/models/User';
import { VerificationCodeModel } from '../../../lib/models/VerificationCode';
import { emailService } from '../../../lib/services/emailService';
import { AuthUtils } from '../../../lib/utils/auth';
import { initDatabase } from '../../../lib/database';

// 验证码验证API
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

    const { email, code, type = 'registration' } = await request.json();

    // 验证输入参数
    if (!email || !code) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('邮箱和验证码为必填项'),
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

    // 验证验证码格式（6位数字）
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('验证码格式不正确'),
        { status: 400 }
      );
    }

    // 查找用户
    const user = await UserModel.findByEmail(email.toLowerCase());
    if (!user) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('用户不存在'),
        { status: 404 }
      );
    }

    // 验证验证码
    const verificationCode = await VerificationCodeModel.verify(
      email.toLowerCase(),
      code,
      type
    );

    if (!verificationCode) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('验证码无效、已过期或已使用'),
        { status: 400 }
      );
    }

    // 根据验证码类型执行不同操作
    switch (type) {
      case 'registration':
        // 注册验证：激活用户账户
        if (user.is_verified) {
          return NextResponse.json(
            AuthUtils.formatErrorResponse('该账户已经验证过了'),
            { status: 400 }
          );
        }

        // 验证邮箱
        const verifyResult = await UserModel.verifyEmail(user.id);
        if (!verifyResult) {
          return NextResponse.json(
            AuthUtils.formatErrorResponse('账户激活失败'),
            { status: 500 }
          );
        }

        // 标记验证码为已使用
        await VerificationCodeModel.markAsUsed(verificationCode.id);

        // 发送欢迎邮件
        if (emailService.isAvailable()) {
          try {
            await emailService.sendWelcomeEmail(email, user.username);
          } catch (emailError) {
            console.error('欢迎邮件发送失败:', emailError);
            // 不影响验证流程，只记录错误
          }
        }

        // 生成登录token
        const token = AuthUtils.generateToken({
          userId: user.id,
          email: user.email
        });

        // 更新最后登录时间
        await UserModel.updateLastLogin(user.id);

        // 获取用户资料
        const userProfile = await UserModel.getProfile(user.id);

        return NextResponse.json(
          AuthUtils.formatSuccessResponse({
            message: '邮箱验证成功，欢迎加入日语分析器！',
            token,
            user: userProfile
          })
        );

      case 'password_reset':
        // 密码重置验证：返回重置token
        const resetToken = AuthUtils.generateSecureToken(32);
        
        // 这里可以将重置token存储到数据库或缓存中
        // 为了简化，我们直接返回token，实际使用中应该存储到数据库
        
        // 标记验证码为已使用
        await VerificationCodeModel.markAsUsed(verificationCode.id);

        return NextResponse.json(
          AuthUtils.formatSuccessResponse({
            message: '验证码验证成功，请设置新密码',
            resetToken,
            userId: user.id
          })
        );

      case 'email_change':
        // 邮箱变更验证：更新用户邮箱
        // 这里需要额外的逻辑来处理邮箱变更
        // 暂时返回成功
        await VerificationCodeModel.markAsUsed(verificationCode.id);

        return NextResponse.json(
          AuthUtils.formatSuccessResponse({
            message: '邮箱变更验证成功'
          })
        );

      default:
        return NextResponse.json(
          AuthUtils.formatErrorResponse('不支持的验证类型'),
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('验证码验证过程中发生错误:', error);
    return NextResponse.json(
      AuthUtils.formatErrorResponse('验证过程中发生错误'),
      { status: 500 }
    );
  }
}

// 获取验证码状态API（检查验证码是否有效）
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

    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    const type = url.searchParams.get('type') || 'registration';

    if (!email) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('邮箱参数为必填项'),
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

    // 获取最新的验证码
    const latestCode = await VerificationCodeModel.getLatestByEmail(email, type);

    if (!latestCode) {
      return NextResponse.json(
        AuthUtils.formatSuccessResponse({
          hasCode: false,
          message: '没有找到验证码'
        })
      );
    }

    // 检查验证码是否过期
    const now = new Date();
    const isExpired = now > new Date(latestCode.expires_at);
    const isUsed = latestCode.is_used;

    // 检查是否可以重发
    const canResend = await VerificationCodeModel.canResend(email, type, 1);

    return NextResponse.json(
      AuthUtils.formatSuccessResponse({
        hasCode: true,
        isExpired,
        isUsed,
        canResend,
        createdAt: latestCode.created_at,
        expiresAt: latestCode.expires_at
      })
    );

  } catch (error) {
    console.error('获取验证码状态时发生错误:', error);
    return NextResponse.json(
      AuthUtils.formatErrorResponse('获取验证码状态时发生错误'),
      { status: 500 }
    );
  }
}