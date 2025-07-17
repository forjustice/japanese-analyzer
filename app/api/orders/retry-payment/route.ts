import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import Stripe from 'stripe';
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

export async function POST(req: NextRequest) {
  let connection;
  try {
    // Get Stripe configs from environment variables
    const stripeSecretKey = process.env.STRIPE_SK_LIVE;
    const stripeSuccessUrl = '/payment/success';
    const stripeCancelUrl = '/payment/cancel';

    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe支付配置不完整' },
        { status: 500 }
      );
    }

    connection = await getConnection();

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

    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json(
        { error: '订单ID不能为空' },
        { status: 400 }
      );
    }

    const stripe = new Stripe(stripeSecretKey);

    // 查询订单（只能重新支付自己的未支付订单）
    const [orderRows] = await connection.execute(
      'SELECT * FROM orders WHERE id = ? AND user_id = ? AND payment_status = ?',
      [orderId, user.id, 'pending']
    );

    const orders = orderRows as Record<string, unknown>[];
    if (orders.length === 0) {
      return NextResponse.json(
        { error: '订单不存在或不可重新支付' },
        { status: 404 }
      );
    }

    const order = orders[0];

    // 创建新的Stripe支付会话
    const priceInCents = Math.round((order.product_price as number) * 100);
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: (order.currency as string).toLowerCase(),
            product_data: {
              name: order.product_name as string,
              description: `有效期：${order.duration_days as number}天\nTOKEN数量：${(order.token_amount as number).toLocaleString()}`,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.get('origin')}${stripeSuccessUrl}?order_no=${order.order_no as string}`,
      cancel_url: `${req.headers.get('origin')}${stripeCancelUrl}?order_no=${order.order_no as string}`,
      metadata: {
        order_id: (order.id as number).toString(),
        order_no: order.order_no as string,
        user_id: user.id.toString(),
      },
    });

    // 更新订单的Stripe会话ID
    await connection.execute(
      'UPDATE orders SET stripe_session_id = ? WHERE id = ?',
      [session.id, order.id as number]
    );

    return NextResponse.json({
      success: true,
      paymentUrl: session.url,
      orderNo: order.order_no
    });

  } catch (error) {
    console.error('重新支付失败:', error);
    return NextResponse.json(
      { error: '重新支付失败' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
