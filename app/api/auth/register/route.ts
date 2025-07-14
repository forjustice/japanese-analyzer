import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '../../../lib/models/User';
import { VerificationCodeModel } from '../../../lib/models/VerificationCode';
import { emailService } from '../../../lib/services/emailService';
import { AuthUtils } from '../../../lib/utils/auth';
import { initDatabase } from '../../../lib/database';

// 用户注册API
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

    const { email, password, username } = await request.json();

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

    // 检查邮箱域名是否被屏蔽
    if (AuthUtils.isEmailDomainBlocked(email)) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('不支持临时邮箱，请使用常规邮箱注册'),
        { status: 400 }
      );
    }

    // 验证密码强度
    const passwordValidation = AuthUtils.validatePassword(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('密码不符合要求', {
          errors: passwordValidation.errors
        }),
        { status: 400 }
      );
    }

    // 验证用户名格式（如果提供）
    if (username && !AuthUtils.isValidUsername(username)) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('用户名格式不正确，只能包含字母、数字、下划线和中文，长度3-30位'),
        { status: 400 }
      );
    }

    // 检查邮箱是否已被注册
    const existingUser = await UserModel.findByEmail(email.toLowerCase());
    if (existingUser) {
      // 如果用户已存在但未验证，允许重新发送验证码
      if (!existingUser.is_verified) {
        // 检查是否可以重发验证码（防止频繁发送）
        const canResend = await VerificationCodeModel.canResend(email, 'registration', 1);
        if (!canResend) {
          return NextResponse.json(
            AuthUtils.formatErrorResponse('验证码发送过于频繁，请稍后再试'),
            { status: 429 }
          );
        }

        // 重新发送验证码
        const { code } = await VerificationCodeModel.create({
          email: email.toLowerCase(),
          type: 'registration',
          user_id: existingUser.id
        });

        // 发送验证码邮件
        if (emailService.isAvailable()) {
          try {
            await emailService.sendRegistrationCode(email, code, username || existingUser.username);
          } catch (emailError) {
            console.error('邮件发送失败:', emailError);
            return NextResponse.json(
              AuthUtils.formatErrorResponse('验证码邮件发送失败，请稍后重试'),
              { status: 500 }
            );
          }
        } else {
          // 如果邮件服务不可用，返回验证码（仅开发环境）
          if (process.env.NODE_ENV === 'development') {
            console.log('开发环境 - 验证码:', code);
            return NextResponse.json(
              AuthUtils.formatSuccessResponse({
                message: '用户已存在但未验证，已重新发送验证码',
                userId: existingUser.id,
                code // 仅开发环境返回
              })
            );
          }
        }

        return NextResponse.json(
          AuthUtils.formatSuccessResponse({
            message: '验证码已重新发送到你的邮箱',
            userId: existingUser.id
          })
        );
      } else {
        return NextResponse.json(
          AuthUtils.formatErrorResponse('该邮箱已被注册'),
          { status: 409 }
        );
      }
    }

    // 创建新用户
    let userId: number;
    try {
      userId = await UserModel.create({
        email: email.toLowerCase(),
        password,
        username
      });
    } catch (error: unknown) {
      console.error('用户创建失败:', error);
      if (error instanceof Error && error.message?.includes('邮箱已经被注册')) {
        return NextResponse.json(
          AuthUtils.formatErrorResponse('该邮箱已被注册'),
          { status: 409 }
        );
      }
      return NextResponse.json(
        AuthUtils.formatErrorResponse('用户创建失败'),
        { status: 500 }
      );
    }

    // 创建验证码
    const { code } = await VerificationCodeModel.create({
      email: email.toLowerCase(),
      type: 'registration',
      user_id: userId
    });

    // 发送验证码邮件
    console.log('检查邮件服务可用性...');
    console.log('emailService.isAvailable():', emailService.isAvailable());
    
    if (emailService.isAvailable()) {
      try {
        console.log('=== 开始发送邮件 ===');
        console.log('目标邮箱:', email);
        console.log('验证码:', code);
        console.log('用户名:', username);
        
        const emailSent = await emailService.sendRegistrationCode(email, code, username);
        console.log('=== 邮件发送完成 ===');
        console.log('邮件发送结果:', emailSent);
        console.log('邮件发送类型:', typeof emailSent);
        
        if (!emailSent) {
          console.error('❌ 邮件发送函数返回 false');
          throw new Error('邮件发送函数返回失败');
        }
        
        console.log('✅ 邮件发送成功确认');
      } catch (emailError) {
        console.error('详细邮件发送错误:', {
          error: emailError instanceof Error ? emailError.message : emailError,
          stack: emailError instanceof Error ? emailError.stack : undefined,
          email,
          code,
          timestamp: new Date().toISOString()
        });
        
        // 删除创建的用户（因为无法发送验证码）
        try {
          await UserModel.deleteById(userId);
          console.log('已删除无法验证的用户:', userId);
        } catch (deleteError) {
          console.error('删除用户失败:', deleteError);
        }
        
        return NextResponse.json(
          AuthUtils.formatErrorResponse('验证码邮件发送失败，请检查邮箱地址或稍后重试'),
          { status: 500 }
        );
      }
    } else {
      // 如果邮件服务不可用，返回验证码（仅开发环境）
      if (process.env.NODE_ENV === 'development') {
        console.log('开发环境 - 验证码:', code);
        return NextResponse.json(
          AuthUtils.formatSuccessResponse({
            message: '注册成功，验证码已生成',
            userId,
            code // 仅开发环境返回
          })
        );
      } else {
        return NextResponse.json(
          AuthUtils.formatErrorResponse('邮件服务暂不可用，请稍后重试'),
          { status: 503 }
        );
      }
    }

    // 成功响应
    return NextResponse.json(
      AuthUtils.formatSuccessResponse({
        message: '注册成功，验证码已发送到你的邮箱',
        userId
      })
    );

  } catch (error) {
    console.error('注册过程中发生错误:', error);
    return NextResponse.json(
      AuthUtils.formatErrorResponse('注册过程中发生错误'),
      { status: 500 }
    );
  }
}

// 重新发送验证码API
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

    const { email } = await request.json();

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

    // 检查用户是否存在
    const user = await UserModel.findByEmail(email.toLowerCase());
    if (!user) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('用户不存在'),
        { status: 404 }
      );
    }

    // 检查用户是否已验证
    if (user.is_verified) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('该邮箱已经验证过了'),
        { status: 400 }
      );
    }

    // 检查是否可以重发验证码（防止频繁发送）
    const canResend = await VerificationCodeModel.canResend(email, 'registration', 1);
    if (!canResend) {
      return NextResponse.json(
        AuthUtils.formatErrorResponse('验证码发送过于频繁，请稍后再试'),
        { status: 429 }
      );
    }

    // 创建新验证码
    const { code } = await VerificationCodeModel.create({
      email: email.toLowerCase(),
      type: 'registration',
      user_id: user.id
    });

    // 发送验证码邮件
    if (emailService.isAvailable()) {
      try {
        await emailService.sendRegistrationCode(email, code, user.username);
      } catch (emailError) {
        console.error('邮件发送失败:', emailError);
        return NextResponse.json(
          AuthUtils.formatErrorResponse('验证码邮件发送失败，请稍后重试'),
          { status: 500 }
        );
      }
    } else {
      // 如果邮件服务不可用，返回验证码（仅开发环境）
      if (process.env.NODE_ENV === 'development') {
        console.log('开发环境 - 验证码:', code);
        return NextResponse.json(
          AuthUtils.formatSuccessResponse({
            message: '验证码已重新生成',
            code // 仅开发环境返回
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
        message: '验证码已重新发送到你的邮箱'
      })
    );

  } catch (error) {
    console.error('重新发送验证码时发生错误:', error);
    return NextResponse.json(
      AuthUtils.formatErrorResponse('重新发送验证码时发生错误'),
      { status: 500 }
    );
  }
}