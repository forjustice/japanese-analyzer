import { NextRequest, NextResponse } from 'next/server';
import { initDatabase, db } from '../../../lib/database';

export async function GET(request: NextRequest) {
  try {
    const dbConnected = await initDatabase();
    if (!dbConnected) {
      return NextResponse.json({ error: '数据库连接失败' }, { status: 500 });
    }

    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    const type = url.searchParams.get('type') || 'registration';

    if (!email) {
      return NextResponse.json({ error: '需要提供邮箱参数' }, { status: 400 });
    }

    // 查询该邮箱的所有验证码
    const allCodesSql = `
      SELECT id, email, code, type, is_used, expires_at, created_at,
             UTC_TIMESTAMP() as current_utc_time,
             NOW() as current_local_time,
             (expires_at > UTC_TIMESTAMP()) as is_not_expired_utc,
             (expires_at > NOW()) as is_not_expired_local,
             TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), expires_at) as minutes_until_expiry_utc,
             TIMESTAMPDIFF(MINUTE, NOW(), expires_at) as minutes_until_expiry_local
      FROM verification_codes 
      WHERE email = ? AND type = ?
      ORDER BY created_at DESC 
      LIMIT 10
    `;

    const codes = await db.query(allCodesSql, [email, type]);

    // 查询表结构
    const tableStructure = await db.query('DESCRIBE verification_codes');

    // 查询时区设置
    const timezoneInfo = await db.query(`
      SELECT 
        @@global.time_zone as global_timezone,
        @@session.time_zone as session_timezone,
        UTC_TIMESTAMP() as utc_time,
        NOW() as local_time
    `);

    return NextResponse.json({
      email,
      type,
      codes,
      tableStructure,
      timezoneInfo
    });

  } catch (error) {
    console.error('调试查询失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}