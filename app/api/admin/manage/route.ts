import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/app/lib/middleware/adminAuth';
import { 
  createAdminUser, 
  updateAdminPassword, 
  getAllAdminUsers, 
  toggleAdminStatus, 
  deleteAdminUser,
  checkAdminPermission 
} from '@/app/lib/utils/adminUtils';

/**
 * 获取所有管理员用户
 */
export async function GET(req: NextRequest) {
  try {
    // 验证管理员权限
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: '未提供认证令牌' }, { status: 401 });
    }

    const adminUser = verifyAdminToken(token);
    if (!adminUser) {
      return NextResponse.json({ error: '认证令牌无效' }, { status: 401 });
    }

    // 只有超级管理员可以查看所有管理员
    if (!checkAdminPermission(adminUser.role, 'super_admin')) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const admins = await getAllAdminUsers();
    
    return NextResponse.json({
      success: true,
      admins: admins
    });
  } catch (error) {
    console.error('获取管理员列表失败:', error);
    return NextResponse.json({ error: '获取管理员列表失败' }, { status: 500 });
  }
}

/**
 * 创建新的管理员账户
 */
export async function POST(req: NextRequest) {
  try {
    // 验证管理员权限
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: '未提供认证令牌' }, { status: 401 });
    }

    const adminUser = verifyAdminToken(token);
    if (!adminUser) {
      return NextResponse.json({ error: '认证令牌无效' }, { status: 401 });
    }

    // 只有超级管理员可以创建管理员账户
    if (!checkAdminPermission(adminUser.role, 'super_admin')) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { email, username, password, role } = await req.json();

    // 验证必填字段
    if (!email || !username || !password || !role) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    // 验证角色
    if (!['admin', 'super_admin'].includes(role)) {
      return NextResponse.json({ error: '无效的角色' }, { status: 400 });
    }

    // 验证密码强度
    if (password.length < 8) {
      return NextResponse.json({ error: '密码长度至少为8位' }, { status: 400 });
    }

    const result = await createAdminUser(email, password, username, role);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        userId: result.userId
      });
    } else {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
  } catch (error) {
    console.error('创建管理员账户失败:', error);
    return NextResponse.json({ error: '创建管理员账户失败' }, { status: 500 });
  }
}

/**
 * 更新管理员信息
 */
export async function PUT(req: NextRequest) {
  try {
    // 验证管理员权限
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: '未提供认证令牌' }, { status: 401 });
    }

    const adminUser = verifyAdminToken(token);
    if (!adminUser) {
      return NextResponse.json({ error: '认证令牌无效' }, { status: 401 });
    }

    const { action, adminId, ...data } = await req.json();

    if (!action || !adminId) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    // 根据操作类型处理
    switch (action) {
      case 'update_password':
        // 管理员可以更新自己的密码，超级管理员可以更新任何人的密码
        if (adminUser.id !== adminId && !checkAdminPermission(adminUser.role, 'super_admin')) {
          return NextResponse.json({ error: '权限不足' }, { status: 403 });
        }

        if (!data.password || data.password.length < 8) {
          return NextResponse.json({ error: '密码长度至少为8位' }, { status: 400 });
        }

        const passwordResult = await updateAdminPassword(adminId, data.password);
        return NextResponse.json(passwordResult);

      case 'toggle_status':
        // 只有超级管理员可以切换状态
        if (!checkAdminPermission(adminUser.role, 'super_admin')) {
          return NextResponse.json({ error: '权限不足' }, { status: 403 });
        }

        if (typeof data.isActive !== 'boolean') {
          return NextResponse.json({ error: '无效的状态值' }, { status: 400 });
        }

        const statusResult = await toggleAdminStatus(adminId, data.isActive);
        return NextResponse.json(statusResult);

      default:
        return NextResponse.json({ error: '不支持的操作' }, { status: 400 });
    }
  } catch (error) {
    console.error('更新管理员信息失败:', error);
    return NextResponse.json({ error: '更新管理员信息失败' }, { status: 500 });
  }
}

/**
 * 删除管理员账户
 */
export async function DELETE(req: NextRequest) {
  try {
    // 验证管理员权限
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: '未提供认证令牌' }, { status: 401 });
    }

    const adminUser = verifyAdminToken(token);
    if (!adminUser) {
      return NextResponse.json({ error: '认证令牌无效' }, { status: 401 });
    }

    // 只有超级管理员可以删除管理员账户
    if (!checkAdminPermission(adminUser.role, 'super_admin')) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { adminId } = await req.json();

    if (!adminId) {
      return NextResponse.json({ error: '缺少管理员ID' }, { status: 400 });
    }

    // 防止删除自己
    if (adminUser.id === adminId) {
      return NextResponse.json({ error: '不能删除自己的账户' }, { status: 400 });
    }

    const result = await deleteAdminUser(adminId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('删除管理员账户失败:', error);
    return NextResponse.json({ error: '删除管理员账户失败' }, { status: 500 });
  }
}