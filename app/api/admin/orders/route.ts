import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '../../../lib/middleware/adminAuth';
import { db } from '../../../lib/database';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: '未提供认证token' }, { status: 401 });
    }

    const admin = verifyAdminToken(token);
    if (!admin) {
      return NextResponse.json({ error: '无效的管理token' }, { status: 403 });
    }

    const orders = await db.query(
      `SELECT o.*, u.username, u.email 
       FROM orders o
       JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC`
    );

    return NextResponse.json({ orders });

  } catch (error) {
    console.error('获取订单列表失败:', error);
    return NextResponse.json(
      { error: '获取订单列表失败' },
      { status: 500 }
    );
  }
}
