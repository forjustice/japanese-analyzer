import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '../../../../lib/middleware/adminAuth';
import { db } from '../../../../lib/database';
import bcrypt from 'bcryptjs';

async function updateUserStatus(userId: number, action: string) {
  try {
    let updateQuery = '';
    let updateParams: (string | number | boolean)[] = [];

    switch (action) {
      case 'activate':
        updateQuery = 'UPDATE users SET is_verified = ? WHERE id = ?';
        updateParams = [true, userId];
        break;
        
      case 'suspend':
        updateQuery = 'UPDATE users SET is_verified = ? WHERE id = ?';
        updateParams = [false, userId];
        break;
        
      case 'verify':
        updateQuery = 'UPDATE users SET is_verified = ? WHERE id = ?';
        updateParams = [true, userId];
        break;
        
      case 'unverify':
        updateQuery = 'UPDATE users SET is_verified = ? WHERE id = ?';
        updateParams = [false, userId];
        break;
        
      default:
        throw new Error(`不支持的操作: ${action}`);
    }

    const affectedRows = await db.update(updateQuery, updateParams);
    return affectedRows > 0;
  } catch (error) {
    console.error('更新用户状态失败:', error);
    throw error;
  }
}

async function getUserDetails(userId: number) {
  try {
    // 获取用户基本信息
    const user = await db.queryOne<{
      id: number;
      username: string;
      email: string;
      isVerified: boolean;
      createdAt: string;
      lastLoginAt: string | null;
      status: string;
    }>(
      `SELECT 
         id, username, email, is_verified as isVerified, 
         created_at as createdAt, last_login_at as lastLoginAt,
         CASE 
           WHEN is_verified = 1 THEN 'active'
           ELSE 'pending'
         END as status
       FROM users WHERE id = ?`,
      [userId]
    );

    if (!user) {
      return null;
    }

    // 获取用户使用统计
    const stats = await db.queryOne<{
      totalTokenUsage: number;
      totalRequests: number;
      lastRequestTime: string | null;
    }>(
      `SELECT 
         SUM(input_tokens + output_tokens) as totalTokenUsage,
         COUNT(*) as totalRequests,
         MAX(request_time) as lastRequestTime
       FROM user_token_usage WHERE user_id = ?`,
      [userId]
    );

    // 获取每日使用统计（最近30天）
    const dailyStats = await db.query<{
      date: string;
      tokens: number;
      requests: number;
    }>(
      `SELECT 
         DATE(request_time) as date,
         SUM(input_tokens + output_tokens) as tokens,
         COUNT(*) as requests
       FROM user_token_usage 
       WHERE user_id = ? AND request_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(request_time)
       ORDER BY date DESC`,
      [userId]
    );

    return {
      ...user,
      totalTokenUsage: stats?.totalTokenUsage || 0,
      totalRequests: stats?.totalRequests || 0,
      lastRequestTime: stats?.lastRequestTime || null,
      dailyStats: dailyStats
    };
  } catch (error) {
    console.error('获取用户详情失败:', error);
    throw error;
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const params = await context.params;
    const userId = parseInt(params.id);
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: '无效的用户ID' },
        { status: 400 }
      );
    }

    // 获取用户详情
    const userDetails = await getUserDetails(userId);
    
    if (!userDetails) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json(userDetails);
  } catch (error) {
    console.error('获取用户详情失败:', error);
    return NextResponse.json(
      { error: '获取用户详情失败' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const params = await context.params;
    const userId = parseInt(params.id);
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: '无效的用户ID' },
        { status: 400 }
      );
    }

    const { action, newPassword } = await req.json();
    if (!action) {
      return NextResponse.json(
        { error: '缺少操作类型' },
        { status: 400 }
      );
    }

    // 处理密码重置
    if (action === 'reset_password') {
      if (!newPassword) {
        return NextResponse.json(
          { error: '缺少新密码' },
          { status: 400 }
        );
      }

      try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        const affectedRows = await db.update(
          'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
          [hashedPassword, userId]
        );
        
        if (affectedRows === 0) {
          return NextResponse.json(
            { error: '用户不存在' },
            { status: 404 }
          );
        }
        
        return NextResponse.json({ 
          success: true,
          message: '密码重置成功'
        });
      } catch (error) {
        console.error('密码重置失败:', error);
        return NextResponse.json(
          { error: '密码重置失败' },
          { status: 500 }
        );
      }
    }

    // 执行用户操作
    const success = await updateUserStatus(userId, action);
    
    if (!success) {
      return NextResponse.json(
        { error: '操作失败，用户可能不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: '操作成功'
    });
  } catch (error) {
    console.error('用户操作失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '操作失败' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const params = await context.params;
    const userId = parseInt(params.id);
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: '无效的用户ID' },
        { status: 400 }
      );
    }

    const { username, email, avatar_url, is_verified } = await req.json();

    // 验证输入数据
    if (!username || !email) {
      return NextResponse.json(
        { error: '用户名和邮箱不能为空' },
        { status: 400 }
      );
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '邮箱格式不正确' },
        { status: 400 }
      );
    }

    // 更新用户信息
    try {
      // 检查邮箱是否已被其他用户使用
      const existingUser = await db.queryOne<{id: number}>(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );

      if (existingUser) {
        return NextResponse.json(
          { error: '该邮箱已被其他用户使用' },
          { status: 409 }
        );
      }

      // 更新用户资料
      const affectedRows = await db.update(
        `UPDATE users 
         SET username = ?, email = ?, avatar_url = ?, is_verified = ?, updated_at = NOW()
         WHERE id = ?`,
        [username, email, avatar_url || null, is_verified ?? false, userId]
      );

      if (affectedRows === 0) {
        return NextResponse.json(
          { error: '用户不存在' },
          { status: 404 }
        );
      }

      return NextResponse.json({ 
        success: true,
        message: '用户信息更新成功'
      });
    } catch (error) {
      console.error('更新用户信息失败:', error);
      return NextResponse.json(
        { error: '更新用户信息失败' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('更新用户信息失败:', error);
    return NextResponse.json(
      { error: '更新用户信息失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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
    if (!adminUser || adminUser.role !== 'super_admin') {
      return NextResponse.json(
        { error: '需要超级管理员权限' },
        { status: 403 }
      );
    }

    const params = await context.params;
    const userId = parseInt(params.id);
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: '无效的用户ID' },
        { status: 400 }
      );
    }

    // 删除用户（注意：这是危险操作）
    let connection;
    try {
      // 开始事务
      connection = await db.beginTransaction();

      // 删除用户的token使用记录
      await connection.execute(
        'DELETE FROM user_token_usage WHERE user_id = ?',
        [userId]
      );

      // 删除用户的验证码记录
      await connection.execute(
        'DELETE FROM verification_codes WHERE user_id = ?',
        [userId]
      );

      // 删除用户记录
      const [result] = await connection.execute(
        'DELETE FROM users WHERE id = ?',
        [userId]
      );

      if ((result as {affectedRows: number}).affectedRows === 0) {
        await db.rollbackTransaction(connection);
        return NextResponse.json(
          { error: '用户不存在' },
          { status: 404 }
        );
      }

      // 提交事务
      await db.commitTransaction(connection);

      return NextResponse.json({ 
        success: true,
        message: '用户删除成功'
      });
    } catch (error) {
      if (connection) {
        await db.rollbackTransaction(connection);
      }
      throw error;
    }
  } catch (error) {
    console.error('删除用户失败:', error);
    return NextResponse.json(
      { error: '删除用户失败' },
      { status: 500 }
    );
  }
}