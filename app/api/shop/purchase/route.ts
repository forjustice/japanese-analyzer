import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import Stripe from 'stripe';
import jwt from 'jsonwebtoken';

interface UserPayload {
  id?: number;
  userId?: number;
  email: string;
  username?: string;
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

    // 调试：检查product对象和用户信息
    console.log('Product data:', product);
    console.log('User data:', user);
    console.log('stripeCurrency:', stripeCurrency);
    console.log('orderType:', orderType);

    // 创建订单
    const orderNo = generateOrderNo();
    
    // 获取用户ID（支持两种字段名）
    const userId = user.id || user.userId;
    
    // 验证必需的字段
    if (!userId) {
      console.error('用户ID验证失败:', { user, hasId: !!user.id, hasUserId: !!user.userId });
      return NextResponse.json(
        { error: '用户ID无效' },
        { status: 400 }
      );
    }
    
    if (!product.id) {
      return NextResponse.json(
        { error: '商品ID无效' },
        { status: 400 }
      );
    }
    
    // 准备插入参数并验证 - 确保没有undefined值
    const insertParams = [
      orderNo,
      userId,
      product.id,
      product.name || `商品${product.id}`,
      product.price || 0,
      product.duration_days || 30,
      product.token_amount || 0,
      stripeCurrency,
      orderType,
      'pending'
    ];
    
    console.log('Insert parameters:', insertParams);
    
    // 检查是否有undefined值
    const undefinedParams = insertParams.map((param, index) => ({ index, value: param, isUndefined: param === undefined }))
                                       .filter(item => item.isUndefined);
    
    if (undefinedParams.length > 0) {
      console.error('Found undefined parameters:', undefinedParams);
      return NextResponse.json(
        { error: `缺少必要参数: ${undefinedParams.map(p => p.index).join(', ')}` },
        { status: 400 }
      );
    }
    
    const [orderResult] = await connection.execute(
      `INSERT INTO orders (order_no, user_id, product_id, product_name, product_price, 
       duration_days, token_amount, currency, order_type, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) `,
      insertParams
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
      success_url: `${req.headers.get('origin') || 'http://localhost:3000'}${stripeSuccessUrl}?order_no=${orderNo}`,
      cancel_url: `${req.headers.get('origin') || 'http://localhost:3000'}${stripeCancelUrl}?order_no=${orderNo}`,
      metadata: {
        order_id: orderId.toString(),
        order_no: orderNo,
        user_id: userId.toString(),
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
      { error: '创建订单失败，请稍后重试' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}