import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '../../../../lib/middleware/adminAuth';
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: '无效的商品ID' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // 检查是否有相关订单
    const [orderRows] = await connection.execute(
      'SELECT COUNT(*) as count FROM orders WHERE product_id = ?',
      [id]
    );
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderCount = (orderRows as any)[0].count;
    
    if (orderCount > 0) {
      return NextResponse.json(
        { error: '该商品存在相关订单，无法删除' },
        { status: 400 }
      );
    }

    // 删除商品
    const [result] = await connection.execute(
      'DELETE FROM products WHERE id = ?',
      [id]
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deleteResult = result as any;
    
    if (deleteResult.affectedRows === 0) {
      return NextResponse.json(
        { error: '商品不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '商品删除成功'
    });
  } catch (error) {
    console.error('删除商品失败:', error);
    return NextResponse.json(
      { error: '删除商品失败' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}