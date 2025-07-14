import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '../../../lib/models/User';
import { VerificationCodeModel } from '../../../lib/models/VerificationCode';
import { emailService } from '../../../lib/services/emailService';
import { AuthUtils } from '../../../lib/utils/auth';
import { initDatabase, db } from '../../../lib/database';
import type { UserProfile } from '../../../lib/types/user';
import bcrypt from 'bcryptjs';

// 验证码验证API
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substr(2, 9);
  
  try {
    console.log(`🚀 [Verify:${requestId}] 开始处理验证请求`);
    
    const dbConnected = await initDatabase();
    if (!dbConnected) {
      console.error(`❌ [Verify:${requestId}] 数据库连接失败`);
      return NextResponse.json(AuthUtils.formatErrorResponse('数据库连接失败'), { status: 500 });
    }

    const requestBody = await request.json();
    const { email, code, type = 'registration', password, username } = requestBody;
    
    console.log(`📨 [Verify:${requestId}] 请求参数:`, {
      email,
      code,
      type,
      hasPassword: !!password,
      hasUsername: !!username,
      rawBody: requestBody
    });

    if (!email || !code) {
      return NextResponse.json(AuthUtils.formatErrorResponse('邮箱和验证码为必填项'), { status: 400 });
    }
    if (!AuthUtils.isValidEmail(email)) {
      return NextResponse.json(AuthUtils.formatErrorResponse('邮箱格式不正确'), { status: 400 });
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(AuthUtils.formatErrorResponse('验证码格式不正确'), { status: 400 });
    }

    // 原子性验证验证码并标记为已使用（防止重复提交）
    console.log(`🔐 [Verify:${requestId}] 开始验证码校验`);
    const verificationCode = await VerificationCodeModel.verifyAndMarkUsed(email.toLowerCase(), code, type);
    if (!verificationCode) {
      console.error(`❌ [Verify:${requestId}] 验证码验证失败 - 邮箱:`, email, '验证码:', code, '类型:', type);
      return NextResponse.json(AuthUtils.formatErrorResponse('验证码无效、已过期或已使用'), { status: 400 });
    }

    console.log(`✅ [Verify:${requestId}] 验证码验证通过，验证码ID:`, verificationCode.id, '已自动标记为已使用');

    switch (type) {
      case 'registration':
        console.log(`👤 [Verify:${requestId}] 开始注册验证流程，邮箱:`, email);
        
        // 1. 先进行所有前置验证（不涉及数据库修改）
        if (!password) {
          console.error(`❌ [Verify:${requestId}] 密码为空`);
          return NextResponse.json(AuthUtils.formatErrorResponse('密码为必填项'), { status: 400 });
        }
        
        const passwordValidation = AuthUtils.validatePassword(password);
        if (!passwordValidation.isValid) {
          console.error(`❌ [Verify:${requestId}] 密码验证失败:`, passwordValidation.errors);
          return NextResponse.json(AuthUtils.formatErrorResponse('密码不符合要求', { errors: passwordValidation.errors }), { status: 400 });
        }

        if (username && !AuthUtils.isValidUsername(username)) {
          console.error(`❌ [Verify:${requestId}] 用户名格式不正确:`, username);
          return NextResponse.json(AuthUtils.formatErrorResponse('用户名格式不正确'), { status: 400 });
        }

        // 2. 检查邮箱是否已被注册
        console.log(`📧 [Verify:${requestId}] 检查邮箱是否已注册:`, email);
        const existingUser = await UserModel.findByEmail(email.toLowerCase());
        if (existingUser && existingUser.is_verified) {
          console.error(`❌ [Verify:${requestId}] 邮箱已被注册:`, { userId: existingUser.id, isVerified: existingUser.is_verified });
          return NextResponse.json(AuthUtils.formatErrorResponse('该邮箱已被注册'), { status: 409 });
        }
        
        console.log(`✅ [Verify:${requestId}] 所有前置验证通过，现有用户状态:`, existingUser ? { id: existingUser.id, isVerified: existingUser.is_verified } : null);
        console.log(`🔄 [Verify:${requestId}] 开始数据库事务`);
        
        // 3. 使用数据库事务确保原子性
        const connection = await db.beginTransaction();
        
        try {
          // 验证码已经在前面被原子性标记为已使用，这里直接进行用户操作
          
          // 3.1 清理可能存在的未验证用户
          if (existingUser && !existingUser.is_verified) {
            await connection.execute('DELETE FROM users WHERE id = ?', [existingUser.id]);
            console.log('删除未验证的用户:', existingUser.id);
          }
          
          // 3.2 创建用户
          const saltRounds = 12;
          const passwordHash = await bcrypt.hash(password, saltRounds);
          
          const [userResult] = await connection.execute(
            'INSERT INTO users (email, password_hash, username, is_verified, is_active) VALUES (?, ?, ?, TRUE, TRUE)',
            [email.toLowerCase(), passwordHash, username]
          );
          
          const userId = (userResult as { insertId: number }).insertId;
          console.log('用户创建成功，用户ID:', userId);
          
          // 3.3 更新最后登录时间
          await connection.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [userId]);
          
          // 3.4 提交事务
          await db.commitTransaction(connection);
          console.log('数据库事务提交成功');
          
          // 4. 生成token和获取用户资料（事务外）
          const token = AuthUtils.generateToken({ userId, email: email.toLowerCase() });
          const userProfile: UserProfile | null = await UserModel.getProfile(userId);
          
          // 5. 发送欢迎邮件（可选）
          if (emailService.isAvailable()) {
            try {
              await emailService.sendWelcomeEmail(email, username);
              console.log('欢迎邮件发送成功');
            } catch (emailError) {
              console.error('欢迎邮件发送失败:', emailError);
            }
          }
          
          // 6. 返回成功结果
          return NextResponse.json(AuthUtils.formatSuccessResponse({
            message: '注册成功，欢迎加入日语分析器！',
            token,
            user: userProfile
          }));
          
        } catch (transactionError) {
          // 回滚事务
          await db.rollbackTransaction(connection);
          console.error('数据库事务失败，已回滚:', transactionError);
          
          return NextResponse.json(AuthUtils.formatErrorResponse('注册过程中发生错误，请重试'), { status: 500 });
        }

      case 'password_reset':
        // This logic remains mostly the same
        const userForReset = await UserModel.findByEmail(email.toLowerCase());
        if (!userForReset) {
            return NextResponse.json(AuthUtils.formatErrorResponse('用户不存在'), { status: 404 });
        }
        const resetToken = AuthUtils.generateSecureToken(32);
        // 验证码已在 verifyAndMarkUsed 中被标记为已使用，无需重复调用
        // In a real app, you'd save this resetToken to the DB with an expiry
        return NextResponse.json(AuthUtils.formatSuccessResponse({
            message: '验证码验证成功，请设置新密码',
            resetToken,
            userId: userForReset.id
        }));

      case 'email_change':
        // This logic remains mostly the same
        // 验证码已在 verifyAndMarkUsed 中被标记为已使用，无需重复调用
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