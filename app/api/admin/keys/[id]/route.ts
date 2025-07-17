import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '../../../../lib/middleware/adminAuth';
import { systemConfigService } from '../../../../lib/services/systemConfigService';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: '无效的密钥ID' },
        { status: 400 }
      );
    }

    // 删除API密钥
    const result = await systemConfigService.deleteApiKey(id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '删除API密钥失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'API密钥删除成功'
    });
  } catch (error) {
    console.error('删除API密钥失败:', error);
    return NextResponse.json(
      { error: '删除API密钥失败' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: '无效的密钥ID' },
        { status: 400 }
      );
    }

    const { key_value, name, provider, models } = await req.json();

    // 构建更新对象
    const updateData: Record<string, unknown> = {};
    if (key_value) updateData.key_value = key_value;
    if (name !== undefined) updateData.name = name;
    if (provider) {
      if (!['gemini', 'openai', 'claude'].includes(provider)) {
        return NextResponse.json(
          { error: '无效的提供商，必须是 gemini、openai 或 claude' },
          { status: 400 }
        );
      }
      updateData.provider = provider;
    }
    if (models && Array.isArray(models)) updateData.models = models;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '没有提供要更新的数据' },
        { status: 400 }
      );
    }

    // 更新API密钥
    const result = await systemConfigService.updateApiKey(id, updateData);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '更新API密钥失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'API密钥更新成功'
    });
  } catch (error) {
    console.error('更新API密钥失败:', error);
    return NextResponse.json(
      { error: '更新API密钥失败' },
      { status: 500 }
    );
  }
}