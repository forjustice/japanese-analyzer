import { NextResponse } from 'next/server';
import { initDatabase, db } from '../../../lib/database';

export async function GET() {
  try {
    const dbConnected = await initDatabase();
    if (!dbConnected) {
      return NextResponse.json({ error: '数据库连接失败' }, { status: 500 });
    }

    const jsNow = new Date();
    const jsExpires = new Date(jsNow.getTime() + 15 * 60 * 1000); // 15分钟后
    
    // 测试时间比较
    const testSql = `
      SELECT 
        ? as js_now,
        ? as js_expires,
        NOW() as mysql_now,
        UTC_TIMESTAMP() as mysql_utc,
        (? > ?) as js_time_valid,
        (? > NOW()) as js_vs_mysql_now,
        (? > UTC_TIMESTAMP()) as js_vs_mysql_utc
    `;
    
    const timeTest = await db.queryOne<{
      js_now: string;
      js_expires: string;
      mysql_now: string;
      mysql_utc: string;
      js_time_valid: number;
      js_vs_mysql_now: number;
      js_vs_mysql_utc: number;
    }>(testSql, [
      jsNow, 
      jsExpires, 
      jsExpires, 
      jsNow,
      jsExpires,
      jsExpires
    ]);

    // 测试创建一个临时验证码
    const tempCode = '999999';
    const tempEmail = 'test@example.com';
    
    // 删除可能存在的测试数据
    await db.delete('DELETE FROM verification_codes WHERE email = ? AND code = ?', [tempEmail, tempCode]);
    
    // 使用JavaScript时间创建验证码
    const insertSql = `
      INSERT INTO verification_codes (email, code, type, expires_at, is_used)
      VALUES (?, ?, 'registration', ?, FALSE)
    `;
    
    const insertId = await db.insert(insertSql, [tempEmail, tempCode, jsExpires]);
    
    // 立即查询验证码
    const verifySql = `
      SELECT id, email, code, expires_at, 
             ? as js_current_time,
             (expires_at > ?) as is_valid_js_time
      FROM verification_codes 
      WHERE id = ?
    `;
    
    const verifyResult = await db.queryOne<{
      id: number;
      email: string;
      code: string;
      expires_at: string;
      js_current_time: string;
      is_valid_js_time: number;
    }>(verifySql, [jsNow, jsNow, insertId]);
    
    // 清理测试数据
    await db.delete('DELETE FROM verification_codes WHERE id = ?', [insertId]);

    return NextResponse.json({
      jsNow: jsNow.toISOString(),
      jsExpires: jsExpires.toISOString(),
      timeTest,
      verifyResult
    });

  } catch (error) {
    console.error('时间测试失败:', error);
    return NextResponse.json({ 
      error: '测试失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}