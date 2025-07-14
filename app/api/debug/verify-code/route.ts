import { NextRequest, NextResponse } from 'next/server';
import { VerificationCodeModel } from '../../../lib/models/VerificationCode';
import { db, initDatabase } from '../../../lib/database';

export async function POST(request: NextRequest) {
  try {
    const { email, code, type = 'registration' } = await request.json();
    
    if (!email || !code) {
      return NextResponse.json({
        success: false,
        message: '邮箱和验证码为必填项'
      }, { status: 400 });
    }

    console.log('🔍 [Debug] 开始验证码调试:', { email, code, type });

    // 初始化数据库
    const dbConnected = await initDatabase();
    if (!dbConnected) {
      return NextResponse.json({
        success: false,
        message: '数据库连接失败'
      }, { status: 500 });
    }

    // 获取当前时间信息
    const timeInfo = {
      jsCurrentTime: new Date().toISOString(),
      jsTimezoneOffset: new Date().getTimezoneOffset(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    // 获取MySQL时间
    const mysqlTimeResult = await db.query('SELECT NOW() as mysql_time');
    timeInfo.mysqlCurrentTime = mysqlTimeResult[0]?.mysql_time;

    // 查询所有相关验证码
    const allCodes = await db.query(`
      SELECT id, email, code, type, is_used, expires_at, created_at,
             NOW() as current_mysql_time,
             (expires_at > NOW()) as is_not_expired,
             TIMESTAMPDIFF(MINUTE, NOW(), expires_at) as minutes_until_expiry
      FROM verification_codes 
      WHERE email = ? AND type = ?
      ORDER BY created_at DESC 
      LIMIT 5
    `, [email, type]);

    // 查找精确匹配的验证码
    const exactMatch = await db.query(`
      SELECT id, email, code, type, is_used, expires_at, created_at,
             NOW() as current_mysql_time,
             (expires_at > NOW()) as is_not_expired,
             TIMESTAMPDIFF(MINUTE, NOW(), expires_at) as minutes_until_expiry
      FROM verification_codes 
      WHERE email = ? AND code = ? AND type = ?
      ORDER BY created_at DESC 
      LIMIT 1
    `, [email, code, type]);

    // 查找有效的验证码（应该用于验证的）
    const validCodes = await db.query(`
      SELECT id, email, code, type, is_used, expires_at, created_at,
             NOW() as current_mysql_time,
             (expires_at > NOW()) as is_not_expired,
             TIMESTAMPDIFF(MINUTE, NOW(), expires_at) as minutes_until_expiry
      FROM verification_codes 
      WHERE email = ? AND code = ? AND type = ? AND is_used = FALSE AND expires_at > NOW()
      ORDER BY created_at DESC 
      LIMIT 1
    `, [email, code, type]);

    // 测试原子性验证方法
    let atomicVerifyResult = null;
    let atomicVerifyError = null;
    
    try {
      atomicVerifyResult = await VerificationCodeModel.verifyAndMarkUsed(email, code, type);
    } catch (error) {
      atomicVerifyError = (error as Error).message;
    }

    // 检查验证码格式
    const codeFormatCheck = {
      isString: typeof code === 'string',
      length: code.length,
      isNumeric: /^\d+$/.test(code),
      is6Digits: /^\d{6}$/.test(code),
    };

    return NextResponse.json({
      success: true,
      data: {
        input: { email, code, type },
        timeInfo,
        codeFormatCheck,
        databaseResults: {
          allCodes,
          exactMatch,
          validCodes,
        },
        atomicVerifyResult: atomicVerifyResult ? {
          id: atomicVerifyResult.id,
          email: atomicVerifyResult.email,
          code: atomicVerifyResult.code,
          expires_at: atomicVerifyResult.expires_at,
          is_used: atomicVerifyResult.is_used,
        } : null,
        atomicVerifyError,
        environment: {
          nodeEnv: process.env.NODE_ENV,
          vercelEnv: process.env.VERCEL_ENV,
          timezone: process.env.TZ,
        }
      }
    });

  } catch (error) {
    console.error('验证码调试错误:', error);
    return NextResponse.json({
      success: false,
      message: '调试过程中发生错误',
      error: (error as Error).message
    }, { status: 500 });
  }
}