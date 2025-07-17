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

export async function GET(req: NextRequest) {
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

    connection = await getConnection();

    // 查询用户的所有订单（按创建时间倒序）
    const [orderRows] = await connection.execute(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [user.id]
    );

    return NextResponse.json({ orders: orderRows });
  } catch (error) {
    console.error('获取订单列表失败:', error);
    return NextResponse.json(
      { error: '获取订单列表失败' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}