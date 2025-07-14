import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '../../../lib/models/User';
import { VerificationCodeModel } from '../../../lib/models/VerificationCode';
import { emailService } from '../../../lib/services/emailService';
import { AuthUtils } from '../../../lib/utils/auth';
import { initDatabase } from '../../../lib/database';

// 验证码验证API
export async function POST(request: NextRequest) {
  try {
    const dbConnected = await initDatabase();
    if (!dbConnected) {
      return NextResponse.json(AuthUtils.formatErrorResponse('数据库连接失败'), { status: 500 });
    }

    const { email, code, type = 'registration', password, username } = await request.json();

    if (!email || !code) {
      return NextResponse.json(AuthUtils.formatErrorResponse('邮箱和验证码为必填项'), { status: 400 });
    }
    if (!AuthUtils.isValidEmail(email)) {
      return NextResponse.json(AuthUtils.formatErrorResponse('邮箱格式不正确'), { status: 400 });
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(AuthUtils.formatErrorResponse('验证码格式不正确'), { status: 400 });
    }

    // Verify the code first for all types
    const verificationCode = await VerificationCodeModel.verify(email.toLowerCase(), code, type);
    if (!verificationCode) {
      return NextResponse.json(AuthUtils.formatErrorResponse('验证码无效、已过期或已使用'), { status: 400 });
    }

    switch (type) {
      case 'registration':
        // This is the new logic for registration
        if (!password) {
          return NextResponse.json(AuthUtils.formatErrorResponse('密码为必填项'), { status: 400 });
        }
        
        const passwordValidation = AuthUtils.validatePassword(password);
        if (!passwordValidation.isValid) {
          return NextResponse.json(AuthUtils.formatErrorResponse('密码不符合要求', { errors: passwordValidation.errors }), { status: 400 });
        }

        if (username && !AuthUtils.isValidUsername(username)) {
          return NextResponse.json(AuthUtils.formatErrorResponse('用户名格式不正确'), { status: 400 });
        }

        const existingUser = await UserModel.findByEmail(email.toLowerCase());
        if (existingUser && existingUser.is_verified) {
          return NextResponse.json(AuthUtils.formatErrorResponse('该邮箱已被注册'), { status: 409 });
        }
        
        // If an unverified user exists from an old flow, remove it before creating the new one.
        if (existingUser) {
            await UserModel.hardDelete(existingUser.id);
        }

        let userId: number;
        try {
          userId = await UserModel.create({
            email: email.toLowerCase(),
            password,
            username,
            is_verified: true
          });
          console.log('用户创建成功，用户ID:', userId);
        } catch (error: unknown) {
          console.error('用户创建失败:', error);
          // 如果是数据库唯一约束错误，可能用户已经存在
          if (error instanceof Error && (error.message?.includes('UNIQUE constraint failed') || error.message?.includes('邮箱已经被注册'))) {
            // 检查是否已经有一个已验证的用户
            const existingVerifiedUser = await UserModel.findByEmail(email.toLowerCase());
            if (existingVerifiedUser && existingVerifiedUser.is_verified) {
              return NextResponse.json(
                AuthUtils.formatErrorResponse('该邮箱已被注册'),
                { status: 409 }
              );
            }
            // 如果用户存在但未验证，使用现有用户ID
            if (existingVerifiedUser) {
              userId = existingVerifiedUser.id;
              console.log('使用现有用户ID:', userId);
            } else {
              return NextResponse.json(AuthUtils.formatErrorResponse('用户创建失败'), { status: 500 });
            }
          } else {
            return NextResponse.json(AuthUtils.formatErrorResponse('用户创建失败'), { status: 500 });
          }
        }

        try {
          await VerificationCodeModel.markAsUsed(verificationCode.id);
          console.log('验证码标记为已使用');
        } catch (error) {
          console.error('标记验证码失败:', error);
        }

        if (emailService.isAvailable()) {
          try {
            await emailService.sendWelcomeEmail(email, username);
            console.log('欢迎邮件发送成功');
          } catch (emailError) {
            console.error('欢迎邮件发送失败:', emailError);
          }
        }

        try {
          const token = AuthUtils.generateToken({ userId, email: email.toLowerCase() });
          await UserModel.updateLastLogin(userId);
          const userProfile = await UserModel.getProfile(userId);
          
          console.log('注册成功，用户资料:', userProfile);
          
          return NextResponse.json(AuthUtils.formatSuccessResponse({
            message: '注册成功，欢迎加入日语分析器！',
            token,
            user: userProfile
          }));
        } catch (error) {
          console.error('生成token或获取用户资料失败:', error);
          return NextResponse.json(AuthUtils.formatErrorResponse('注册过程中发生错误'), { status: 500 });
        }

      case 'password_reset':
        // This logic remains mostly the same
        const userForReset = await UserModel.findByEmail(email.toLowerCase());
        if (!userForReset) {
            return NextResponse.json(AuthUtils.formatErrorResponse('用户不存在'), { status: 404 });
        }
        const resetToken = AuthUtils.generateSecureToken(32);
        await VerificationCodeModel.markAsUsed(verificationCode.id);
        // In a real app, you'd save this resetToken to the DB with an expiry
        return NextResponse.json(AuthUtils.formatSuccessResponse({
            message: '验证码验证成功，请设置新密码',
            resetToken,
            userId: userForReset.id
        }));

      case 'email_change':
        // This logic remains mostly the same
        await VerificationCodeModel.markAsUsed(verificationCode.id);
        return NextResponse.json(AuthUtils.formatSuccessResponse({
            message: '邮箱变更验证成功'
        }));

      default:
        return NextResponse.json(AuthUtils.formatErrorResponse('不支持的验证类型'), { status: 400 });
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