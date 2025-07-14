import { NextRequest, NextResponse } from 'next/server';
import { VerificationCodeModel } from '../../../lib/models/VerificationCode';
import { initDatabase } from '../../../lib/database';

export async function POST(request: NextRequest) {
  try {
    const dbConnected = await initDatabase();
    if (!dbConnected) {
      return NextResponse.json({ error: '数据库连接失败' }, { status: 500 });
    }

    const { email, code, type = 'registration' } = await request.json();
    
    if (!email || !code) {
      return NextResponse.json({ error: '需要提供邮箱和验证码' }, { status: 400 });
    }

    console.log('🧪 [VerifyTest] 开始验证码测试:', { email, code, type });

    // 步骤1：先创建一个新的验证码
    const createResult = await VerificationCodeModel.create({
      email,
      type,
      user_id: null
    });
    
    console.log('🧪 [VerifyTest] 创建验证码结果:', createResult);

    // 步骤2：立即尝试验证这个验证码
    const verifyResult = await VerificationCodeModel.verifyAndMarkUsed(email, createResult.code, type);
    
    console.log('🧪 [VerifyTest] 验证结果:', verifyResult);

    // 步骤3：尝试验证用户提供的验证码
    let userCodeResult = null;
    if (code !== createResult.code) {
      userCodeResult = await VerificationCodeModel.verifyAndMarkUsed(email, code, type);
      console.log('🧪 [VerifyTest] 用户验证码结果:', userCodeResult);
    }

    return NextResponse.json({
      testCode: {
        code: createResult.code,
        created: true,
        verified: !!verifyResult
      },
      userCode: {
        code: code,
        verified: !!userCodeResult
      },
      message: '测试完成'
    });

  } catch (error) {
    console.error('验证码测试失败:', error);
    return NextResponse.json({ error: '测试失败', details: error.message }, { status: 500 });
  }
}