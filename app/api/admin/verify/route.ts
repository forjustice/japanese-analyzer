import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '../../../lib/middleware/adminAuth';

export async function GET(req: NextRequest) {
  try {
    // 获取token
    const authHeader = req.headers.get('authorization');
    const cookieToken = req.cookies.get('admin_token')?.value;
    const token = authHeader?.replace('Bearer ', '') || cookieToken;

    if (!token) {
      return NextResponse.json(
        { error: '未提供认证token' },
        { status: 401 }
      );
    }

    // 验证token
    const adminUser = verifyAdminToken(token);
    
    if (!adminUser) {
      return NextResponse.json(
        { error: 'token无效或已过期' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      admin: {
        id: adminUser.id,
        username: adminUser.username,
        role: adminUser.role
      }
    });
  } catch (error) {
    console.error('验证管理员token失败:', error);
    return NextResponse.json(
      { error: '验证过程中发生错误' },
      { status: 500 }
    );
  }
}