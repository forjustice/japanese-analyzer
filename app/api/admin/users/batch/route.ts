import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '../../../../lib/middleware/adminAuth';
import { db } from '../../../../lib/database';

async function batchUpdateUsers(userIds: number[], action: string) {
  try {
    let updateQuery = '';
    let updateValue: string | boolean;

    switch (action) {
      case 'activate':
        updateQuery = 'UPDATE users SET status = ? WHERE id IN (?)';
        updateValue = 'active';
        break;
        
      case 'suspend':
        updateQuery = 'UPDATE users SET status = ? WHERE id IN (?)';
        updateValue = 'suspended';
        break;
        
      case 'verify':
        updateQuery = 'UPDATE users SET is_verified = ? WHERE id IN (?)';
        updateValue = true;
        break;
        
      case 'unverify':
        updateQuery = 'UPDATE users SET is_verified = ? WHERE id IN (?)';
        updateValue = false;
        break;
        
      default:
        throw new Error(`不支持的批量操作: ${action}`);
    }

    // 构建IN查询的占位符
    const placeholders = userIds.map(() => '?').join(',');
    const finalQuery = updateQuery.replace('(?)', `(${placeholders})`);

    const affectedRows = await db.update(finalQuery, [updateValue, ...userIds]);
    return affectedRows;
  } catch (error) {
    console.error('批量更新用户失败:', error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
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

    const { action, userIds } = await req.json();

    if (!action) {
      return NextResponse.json(
        { error: '缺少操作类型' },
        { status: 400 }
      );
    }

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: '缺少用户ID列表' },
        { status: 400 }
      );
    }

    // 验证用户ID都是数字
    const validUserIds = userIds.filter(id => typeof id === 'number' && id > 0);
    if (validUserIds.length !== userIds.length) {
      return NextResponse.json(
        { error: '用户ID列表包含无效值' },
        { status: 400 }
      );
    }

    // 限制批量操作的数量
    if (validUserIds.length > 100) {
      return NextResponse.json(
        { error: '批量操作最多支持100个用户' },
        { status: 400 }
      );
    }

    // 执行批量操作
    const affectedRows = await batchUpdateUsers(validUserIds, action);

    return NextResponse.json({ 
      success: true,
      message: `成功操作了 ${affectedRows} 个用户`,
      affectedRows
    });
  } catch (error) {
    console.error('批量操作失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '批量操作失败' },
      { status: 500 }
    );
  }
}