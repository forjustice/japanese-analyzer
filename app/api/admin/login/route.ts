import { NextRequest, NextResponse } from 'next/server';
import { validateAdminCredentials, generateAdminToken } from '../../../lib/middleware/adminAuth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    // 验证管理员凭据
    const adminUser = await validateAdminCredentials(username, password);
    
    if (!adminUser) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 生成JWT token
    const token = generateAdminToken(adminUser);

    // 创建响应
    const response = NextResponse.json({
      success: true,
      token,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        username: adminUser.username,
        role: adminUser.role
      }
    });

    // 设置Cookie（可选，作为备用认证方式）
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 // 24小时
    });

    return response;
  } catch (error) {
    console.error('管理员登录失败:', error);
    return NextResponse.json(
      { error: '登录过程中发生错误' },
      { status: 500 }
    );
  }
}