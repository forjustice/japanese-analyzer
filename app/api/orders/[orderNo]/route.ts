import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

interface UserPayload {
  id: number;
  email: string;
  username: string;
}

async function getConnection() {
  try {
    return await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'japanese_analyzer'
    });
  } catch (error) {
    console.error('数据库连接失败:', error);
    throw error;
  }
}

async function verifyUserToken(token: string): Promise<UserPayload | null> {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      throw new Error('JWT secret not configured');
    }

    const decoded = jwt.verify(token, jwtSecret) as UserPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> }
) {
  let connection;
  try {
    // 验证用户身份
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: '未提供认证token' },
        { status: 401 }
      );
    }

    const user = await verifyUserToken(token);
    if (!user) {
      return NextResponse.json(
        { error: '无效的认证token' },
        { status: 401 }
      );
    }

    const { orderNo } = await params;

    connection = await getConnection();

    // 查询订单（只能查询自己的订单）
    const [orderRows] = await connection.execute(
      'SELECT * FROM orders WHERE order_no = ? AND user_id = ?',
      [orderNo, user.id]
    );

    const orders = orderRows as Record<string, unknown>[];
    if (orders.length === 0) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      );
    }

    const order = orders[0];

    return NextResponse.json({ order });
  } catch (error) {
    console.error('获取订单详情失败:', error);
    return NextResponse.json(
      { error: '获取订单详情失败' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}