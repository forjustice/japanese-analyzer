import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '../../../lib/middleware/adminAuth';
import mysql from 'mysql2/promise';

interface Product {
  id?: number;
  name: string;
  description: string;
  price: number;
  duration_days: number;
  token_amount: number;
  status: 'active' | 'inactive';
  sort_order: number;
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

export async function GET(req: NextRequest) {
  let connection;
  try {
    // 验证管理员权限
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: '未提供认证token' },
        { status: 401 }
      );
    }

    const adminUser = verifyAdminToken(token);
    if (!adminUser) {
      return NextResponse.json(
        { error: '无效的认证token' },
        { status: 401 }
      );
    }

    connection = await getConnection();
    
    const [rows] = await connection.execute(
      'SELECT * FROM products ORDER BY sort_order ASC, created_at DESC'
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

export async function POST(req: NextRequest) {
  let connection;
  try {
    // 验证管理员权限
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: '未提供认证token' },
        { status: 401 }
      );
    }

    const adminUser = verifyAdminToken(token);
    if (!adminUser) {
      return NextResponse.json(
        { error: '无效的认证token' },
        { status: 401 }
      );
    }

    const productData: Product = await req.json();

    // 验证数据
    if (!productData.name || !productData.price || productData.duration_days < 0 || productData.token_amount < 0) {
      return NextResponse.json(
        { error: '商品数据不完整或无效' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    const [result] = await connection.execute(
      `INSERT INTO products (name, description, price, duration_days, token_amount, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        productData.name,
        productData.description || '',
        productData.price,
        productData.duration_days,
        productData.token_amount,
        productData.status || 'active',
        productData.sort_order || 0
      ]
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertResult = result as any;
    
    return NextResponse.json({
      success: true,
      message: '商品创建成功',
      productId: insertResult.insertId
    });
  } catch (error) {
    console.error('创建商品失败:', error);
    return NextResponse.json(
      { error: '创建商品失败' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function PUT(req: NextRequest) {
  let connection;
  try {
    // 验证管理员权限
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: '未提供认证token' },
        { status: 401 }
      );
    }

    const adminUser = verifyAdminToken(token);
    if (!adminUser) {
      return NextResponse.json(
        { error: '无效的认证token' },
        { status: 401 }
      );
    }

    const productData: Product = await req.json();

    if (!productData.id) {
      return NextResponse.json(
        { error: '商品ID不能为空' },
        { status: 400 }
      );
    }

    // 验证数据
    if (!productData.name || !productData.price || productData.duration_days < 0 || productData.token_amount < 0) {
      return NextResponse.json(
        { error: '商品数据不完整或无效' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    const [result] = await connection.execute(
      `UPDATE products 
       SET name = ?, description = ?, price = ?, duration_days = ?, token_amount = ?, status = ?, sort_order = ?
       WHERE id = ?`,
      [
        productData.name,
        productData.description || '',
        productData.price,
        productData.duration_days,
        productData.token_amount,
        productData.status || 'active',
        productData.sort_order || 0,
        productData.id
      ]
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateResult = result as any;
    
    if (updateResult.affectedRows === 0) {
      return NextResponse.json(
        { error: '商品不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '商品更新成功'
    });
  } catch (error) {
    console.error('更新商品失败:', error);
    return NextResponse.json(
      { error: '更新商品失败' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}