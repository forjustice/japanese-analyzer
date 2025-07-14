import { NextRequest, NextResponse } from 'next/server';
import { initDatabase, db } from '../../../lib/database';

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

    const jsNow = new Date();
    console.log('🔍 [DirectVerify] 开始直接验证:', { 
      email, 
      code, 
      type, 
      jsNow: jsNow.toISOString() 
    });

    // 使用JavaScript时间进行查询
    const sql = `
      SELECT id, email, code, type, is_used, expires_at, created_at,
             ? as js_current_time,
             (expires_at > ?) as is_valid_js_time
      FROM verification_codes 
      WHERE email = ? AND code = ? AND type = ? AND is_used = FALSE
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    const result = await db.queryOne(sql, [jsNow, jsNow, email, code, type]);
    
    console.log('🔍 [DirectVerify] 查询结果:', result);
    
    if (result && result.is_valid_js_time) {
      // 标记为已使用
      await db.update('UPDATE verification_codes SET is_used = TRUE WHERE id = ?', [result.id]);
      console.log('✅ [DirectVerify] 验证码验证成功并标记为已使用');
      
      return NextResponse.json({
        success: true,
        message: '验证码验证成功',
        verificationCode: result
      });
    } else {
      console.log('❌ [DirectVerify] 验证码验证失败');
      return NextResponse.json({
        success: false,
        message: '验证码无效、已过期或已使用',
        verificationCode: result
      });
    }

  } catch (error) {
    console.error('直接验证失败:', error);
    return NextResponse.json({ error: '验证失败', details: error.message }, { status: 500 });
  }
}