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

function generateOrderNo(): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD${timestamp}${random}`;
}

export async function POST(req: NextRequest) {
  let connection;
  try {
    // Get Stripe configs from environment variables
    const stripeSecretKey = process.env.STRIPE_SK_LIVE;
    const stripeSuccessUrl = '/payment/success';
    const stripeCancelUrl = '/payment/cancel';
    const stripeCurrency = process.env.STRIPE_CURRENCY || 'usd';

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

    const { productId, orderType = 'purchase' } = await req.json();

    if (!productId) {
      return NextResponse.json(
        { error: '商品ID不能为空' },
        { status: 400 }
      );
    }

    const stripe = new Stripe(stripeSecretKey);

    // 获取商品信息
    const [productRows] = await connection.execute(
      'SELECT * FROM products WHERE id = ? AND status = ?',
      [productId, 'active']
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const products = productRows as any[];
    if (products.length === 0) {
      return NextResponse.json(
        { error: '商品不存在或已下架' },
        { status: 404 }
      );
    }

    const product = products[0];

    // 创建订单
    const orderNo = generateOrderNo();
    const [orderResult] = await connection.execute(
      `INSERT INTO orders (order_no, user_id, product_id, product_name, product_price, 
       duration_days, token_amount, currency, order_type, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) `,
      [
        orderNo,
        user.id,
        product.id,
        product.name,
        product.price,
        product.duration_days,
        product.token_amount,
        stripeCurrency,
        orderType,
        'pending'
      ]
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertResult = orderResult as any;
    const orderId = insertResult.insertId;

    // 创建Stripe支付会话
    const priceInCents = Math.round(product.price * 100);
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: stripeCurrency,
            product_data: {
              name: product.name,
              description: `${product.description}\n有效期：${product.duration_days}天\nTOKEN数量：${product.token_amount.toLocaleString()}`,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.get('origin')}${stripeSuccessUrl}?order_no=${orderNo}`,
      cancel_url: `${req.headers.get('origin')}${stripeCancelUrl}?order_no=${orderNo}`,
      metadata: {
        order_id: orderId.toString(),
        order_no: orderNo,
        user_id: user.id.toString(),
      },
    });

    // 更新订单的Stripe会话ID
    await connection.execute(
      'UPDATE orders SET stripe_session_id = ? WHERE id = ?',
      [session.id, orderId]
    );

    return NextResponse.json({
      success: true,
      paymentUrl: session.url,
      orderNo: orderNo
    });

  } catch (error) {
    console.error('创建订单失败:', error);
    return NextResponse.json(
      { error: '创建订单失败' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}