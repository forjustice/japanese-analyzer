import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

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

export async function GET() {
  let connection;
  try {
    connection = await getConnection();
    
    // 只获取上架的商品
    const [rows] = await connection.execute(
      'SELECT id, name, description, price, duration_days, token_amount, sort_order FROM products WHERE status = ? ORDER BY sort_order ASC, created_at DESC',
      ['active']
    );

    return NextResponse.json({ products: rows });
  } catch (error) {
    console.error('获取商品列表失败:', error);
    return NextResponse.json(
      { error: '获取商品列表失败' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}