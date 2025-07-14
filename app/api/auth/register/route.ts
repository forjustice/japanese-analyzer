import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '../../../lib/models/User';
import { VerificationCodeModel } from '../../../lib/models/VerificationCode';
import { emailService } from '../../../lib/services/emailService';
import { AuthUtils } from '../../../lib/utils/auth';
import { initDatabase } from '../../../lib/database';

// API to send a registration verification code
export async function POST(request: NextRequest) {
  try {
    const dbConnected = await initDatabase();
    if (!dbConnected) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('数据库连接失败'),
        { status: 500 }
      );
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('邮箱为必填项'),
        { status: 400 }
      );
    }

    if (!AuthUtils.isValidEmail(email)) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('邮箱格式不正确'),
        { status: 400 }
      );
    }

    if (AuthUtils.isEmailDomainBlocked(email)) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('不支持临时邮箱，请使用常规邮箱注册'),
        { status: 400 }
      );
    }

    const existingUser = await UserModel.findByEmail(email.toLowerCase());
    if (existingUser && existingUser.is_verified) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('该邮箱已被注册'),
        { status: 409 }
      );
    }

    const canResend = await VerificationCodeModel.canResend(email, 'registration', 1);
    if (!canResend) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('验证码发送过于频繁，请稍后再试'),
        { status: 429 }
      );
    }

    const { code } = await VerificationCodeModel.create({
      email: email.toLowerCase(),
      type: 'registration',
      user_id: existingUser ? existingUser.id : undefined // User may not exist yet
    });

    const responseMessage = '验证码已发送到你的邮箱';

    if (emailService.isAvailable()) {
      try {
        await emailService.sendRegistrationCode(email, code);
      } catch (emailError) {
        console.error('邮件发送失败:', emailError);
        return NextResponse.json(
          AuthUtils.formatErrorResponse('验证码邮件发送失败，请稍后重试'),
          { status: 500 }
        );
      }
    } else if (process.env.NODE_ENV === 'development') {
      console.log(`开发环境 - 注册验证码 for ${email}: ${code}`);
      return NextResponse.json(
          AuthUtils.formatSuccessResponse({
            message: '验证码已生成',
            code // 仅开发环境返回
          })
        );
    } else {
        return NextResponse.json(
          AuthUtils.formatErrorResponse('邮件服务暂不可用，请稍后重试'),
          { status: 503 }
        );
    }

    return NextResponse.json(
      AuthUtils.formatSuccessResponse({
        message: responseMessage
      })
    );

  } catch (error) {
    console.error('发送注册验证码时发生错误:', error);
    return NextResponse.json(
      AuthUtils.formatErrorResponse('发送验证码时发生错误'),
      { status: 500 }
    );
  }
}
