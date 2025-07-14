import { NextResponse } from 'next/server';
import { db, initDatabase } from '../../../lib/database';

export async function GET() {
  try {
    // 收集环境信息
    const environmentInfo = {
      // 基础环境信息
      nodeEnv: process.env.NODE_ENV,
      platform: process.platform,
      nodeVersion: process.version,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      currentTime: new Date().toISOString(),
      
      // 数据库配置（敏感信息脱敏）
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || '3306',
        user: process.env.DB_USER || 'root',
        database: process.env.DB_NAME || 'japanese_analyzer',
        hasPassword: !!process.env.DB_PASSWORD,
      },
      
      // Vercel相关环境变量
      vercel: {
        env: process.env.VERCEL_ENV,
        region: process.env.VERCEL_REGION,
        url: process.env.VERCEL_URL,
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
      },
      
      // 邮件服务配置
      email: {
        hasSmtpHost: !!process.env.SMTP_HOST,
        hasSmtpUser: !!process.env.SMTP_USER,
        hasSmtpPass: !!process.env.SMTP_PASS,
        smtpPort: process.env.SMTP_PORT,
      }
    };

    // 测试数据库连接
    let databaseStatus = 'unknown';
    let databaseError = null;
    let testQueryResult = null;

    try {
      const isConnected = await initDatabase();
      if (isConnected) {
        databaseStatus = 'connected';
        
        // 测试验证码相关查询
        try {
          const testQuery = await db.query('SELECT COUNT(*) as count FROM verification_codes');
          testQueryResult = testQuery[0];
        } catch (queryError) {
          databaseError = {
            message: (queryError as Error).message,
            type: 'query_error'
          };
        }
      } else {
        databaseStatus = 'failed';
      }
    } catch (error) {
      databaseStatus = 'error';
      databaseError = {
        message: (error as Error).message,
        type: 'connection_error'
      };
    }

    // 测试时区和时间
    const timeTest = {
      jsDate: new Date().toISOString(),
      mysqlNow: null as { current_time: string } | { error: string } | null,
      timezoneOffset: new Date().getTimezoneOffset(),
    };

    try {
      const mysqlTimeResult = await db.query<{ current_time: string }>('SELECT NOW() as current_time');
      timeTest.mysqlNow = mysqlTimeResult[0] || null;
    } catch (error) {
      timeTest.mysqlNow = { error: (error as Error).message };
    }

    return NextResponse.json({
      success: true,
      data: {
        environment: environmentInfo,
        database: {
          status: databaseStatus,
          error: databaseError,
          testQuery: testQueryResult,
        },
        timeTest,
        // 添加验证码测试数据
        verificationCodeTest: await testVerificationCodeFlow()
      }
    });

  } catch (error) {
    console.error('环境诊断错误:', error);
    return NextResponse.json({
      success: false,
      message: '环境诊断失败',
      error: (error as Error).message
    }, { status: 500 });
  }
}

// 测试验证码流程
async function testVerificationCodeFlow() {
  try {
    const testEmail = 'test@example.com';
    const testType = 'registration';
    
    // 查询现有验证码
    const existingCodes = await db.query(`
      SELECT id, email, code, type, is_used, expires_at, created_at,
             NOW() as current_time,
             (expires_at > NOW()) as is_not_expired
      FROM verification_codes 
      WHERE email = ? AND type = ?
      ORDER BY created_at DESC 
      LIMIT 3
    `, [testEmail, testType]);

    // 测试验证码创建时间计算
    const testExpirationTime = new Date();
    testExpirationTime.setMinutes(testExpirationTime.getMinutes() + 15);

    return {
      existingCodes,
      testExpirationTime: testExpirationTime.toISOString(),
      currentTime: new Date().toISOString(),
    };
  } catch (error) {
    return {
      error: (error as Error).message
    };
  }
}