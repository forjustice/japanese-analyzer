import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '../../../lib/models/User';
import { VerificationCodeModel } from '../../../lib/models/VerificationCode';
import { emailService } from '../../../lib/services/emailService';
import { AuthUtils } from '../../../lib/utils/auth';
import { initDatabase } from '../../../lib/database';

// 请求密码重置（发送验证码）
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

    const { email, code, verifyOnly } = await request.json();

    // 如果是验证验证码的请求
    if (verifyOnly) {
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

      // 验证验证码格式
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

      // 验证验证码（但不标记为已使用）
      const verificationCode = await VerificationCodeModel.verify(
        email.toLowerCase(),
        code,
        'password_reset'
      );

      if (!verificationCode) {
        return NextResponse.json(
          AuthUtils.formatErrorResponse('验证码无效或已过期'),
          { status: 400 }
        );
      }

      return NextResponse.json(
        AuthUtils.formatSuccessResponse({
          message: '验证码验证成功'
        })
      );
    }

    // 验证输入参数
    if (!email) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('邮箱为必填项'),
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

    // 查找用户
    const user = await UserModel.findByEmail(email.toLowerCase());
    if (!user) {
      // 为了安全考虑，不透露用户是否存在
      return NextResponse.json(
        AuthUtils.formatSuccessResponse({
          message: '如果该邮箱已注册，密码重置链接将发送到你的邮箱'
        })
      );
    }

    // 检查用户是否已验证
    if (!user.is_verified) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('请先验证你的邮箱地址'),
        { status: 403 }
      );
    }

    // 检查用户是否被禁用
    if (!user.is_active) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('账户已被禁用，请联系管理员'),
        { status: 403 }
      );
    }

    // 检查是否可以重发验证码（防止频繁发送）
    const canResend = await VerificationCodeModel.canResend(email, 'password_reset', 2); // 2分钟间隔
    if (!canResend) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('密码重置请求过于频繁，请稍后再试'),
        { status: 429 }
      );
    }

    // 创建密码重置验证码
    const { code: verificationCode } = await VerificationCodeModel.create({
      email: email.toLowerCase(),
      type: 'password_reset',
      user_id: user.id
    });

    // 发送密码重置邮件
    if (emailService.isAvailable()) {
      try {
        await emailService.sendPasswordResetCode(email, verificationCode, user.username);
      } catch (emailError) {
        console.error('密码重置邮件发送失败:', emailError);
        return NextResponse.json(
          AuthUtils.formatErrorResponse('密码重置邮件发送失败，请稍后重试'),
          { status: 500 }
        );
      }
    } else {
      // 如果邮件服务不可用，返回验证码（仅开发环境）
      if (process.env.NODE_ENV === 'development') {
        console.log('开发环境 - 密码重置验证码:', verificationCode);
        return NextResponse.json(
          AuthUtils.formatSuccessResponse({
            message: '密码重置验证码已生成',
            code: verificationCode // 仅开发环境返回
          })
        );
      } else {
        return NextResponse.json(
          AuthUtils.formatErrorResponse('邮件服务暂不可用，请稍后重试'),
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      AuthUtils.formatSuccessResponse({
        message: '密码重置验证码已发送到你的邮箱'
      })
    );

  } catch (error) {
    console.error('密码重置请求过程中发生错误:', error);
    return NextResponse.json(
      AuthUtils.formatErrorResponse('密码重置请求过程中发生错误'),
      { status: 500 }
    );
  }
}

// 重置密码（使用验证码）
export async function PUT(request: NextRequest) {
  try {
    // 初始化数据库连接
    const dbConnected = await initDatabase();
    if (!dbConnected) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('数据库连接失败'),
        { status: 500 }
      );
    }

    const { email, code, newPassword } = await request.json();

    // 验证输入参数
    if (!email || !code || !newPassword) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('邮箱、验证码和新密码为必填项'),
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

    // 验证验证码格式
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('验证码格式不正确'),
        { status: 400 }
      );
    }

    // 验证新密码强度
    const passwordValidation = AuthUtils.validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('新密码不符合要求', {
          errors: passwordValidation.errors
        }),
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
      'password_reset'
    );

    if (!verificationCode) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('验证码无效、已过期或已使用'),
        { status: 400 }
      );
    }

    // 更新密码
    const updateResult = await UserModel.updatePassword(user.id, newPassword);
    if (!updateResult) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('密码更新失败'),
        { status: 500 }
      );
    }

    // 标记验证码为已使用
    await VerificationCodeModel.markAsUsed(verificationCode.id);

    // 记录密码重置操作
    console.log(`用户 ${user.email} 成功重置密码`);

    return NextResponse.json(
      AuthUtils.formatSuccessResponse({
        message: '密码重置成功，请使用新密码登录'
      })
    );

  } catch (error) {
    console.error('密码重置过程中发生错误:', error);
    return NextResponse.json(
      AuthUtils.formatErrorResponse('密码重置过程中发生错误'),
      { status: 500 }
    );
  }
}