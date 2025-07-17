import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import Stripe from 'stripe';

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

async function handlePaymentSuccess(sessionId: string, paymentIntentId: string) {
  let connection;
  try {
    connection = await getConnection();

    // 根据session_id查找订单
    const [orderRows] = await connection.execute(
      'SELECT * FROM orders WHERE stripe_session_id = ?',
      [sessionId]
    );

    const orders = orderRows as Record<string, unknown>[];
    if (orders.length === 0) {
      console.error('找不到对应的订单:', sessionId);
      return;
    }

    const order = orders[0];

    // 更新订单状态
    await connection.execute(
      'UPDATE orders SET payment_status = ?, stripe_payment_intent_id = ?, paid_at = NOW() WHERE id = ?',
      ['paid', paymentIntentId, order.id]
    );

    // 更新用户额度
    await updateUserQuota(connection, order.user_id as number, order.duration_days as number, order.token_amount as number);

    console.log(`订单 ${order.order_no} 支付成功，已更新用户额度`);
  } catch (error) {
    console.error('处理支付成功事件失败:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function updateUserQuota(connection: mysql.Connection, userId: number, durationDays: number, tokenAmount: number) {
  try {
    // 检查用户是否已有额度记录
    const [quotaRows] = await connection.execute(
      'SELECT * FROM user_quotas WHERE user_id = ?',
      [userId]
    );

    const quotas = quotaRows as Record<string, unknown>[];
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + durationDays);

    if (quotas.length === 0) {
      // 创建新的额度记录
      await connection.execute(
        'INSERT INTO user_quotas (user_id, token_quota, expires_at, last_reset_at) VALUES (?, ?, ?, NOW())',
        [userId, tokenAmount, newExpiresAt]
      );
    } else {
      // 重置现有额度（购买或续费都会重置）
      await connection.execute(
        'UPDATE user_quotas SET token_quota = ?, expires_at = ?, last_reset_at = NOW() WHERE user_id = ?',
        [tokenAmount, newExpiresAt, userId]
      );
    }
  } catch (error) {
    console.error('更新用户额度失败:', error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe signature' },
        { status: 400 }
      );
    }

    // 获取Stripe配置
    const stripeSecretKey = process.env.STRIPE_SK_LIVE;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecretKey || !webhookSecret) {
      return NextResponse.json(
        { error: 'Stripe configuration missing' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey);

    // 验证webhook签名
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // 处理不同类型的事件
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === 'paid') {
          await handlePaymentSuccess(
            session.id,
            session.payment_intent as string
          );
        }
        break;

      case 'payment_intent.succeeded':
        // 可以在这里添加额外的支付成功处理逻辑
        console.log('Payment succeeded:', event.data.object.id);
        break;

      case 'payment_intent.payment_failed':
        // 处理支付失败
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        console.log('Payment failed:', failedPayment.id);
        
        // 可以在这里更新订单状态为失败
        let fail_connection;
        try {
          fail_connection = await getConnection();
          await fail_connection.execute(
            'UPDATE orders SET payment_status = ? WHERE stripe_payment_intent_id = ?',
            ['failed', failedPayment.id]
          );
        } catch (error) {
          console.error('更新失败订单状态失败:', error);
        } finally {
          if (fail_connection) {
            await fail_connection.end();
          }
        }
        break;

      default:
        console.log(`未处理的事件类型: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook处理失败:', error);
    return NextResponse.json(
      { error: 'Webhook处理失败' },
      { status: 500 }
    );
  }
}
