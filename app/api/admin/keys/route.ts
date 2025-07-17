import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '../../../lib/middleware/adminAuth';
import { systemConfigService } from '../../../lib/services/systemConfigService';

export async function GET(req: NextRequest) {
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

    // 获取API密钥列表
    const apiKeys = await systemConfigService.getAllApiKeys();
    
    // 转换为前端需要的格式
    const keys = apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      key: key.key_value.substring(0, 8) + '...' + key.key_value.substring(key.key_value.length - 4),
      fullKey: key.key_value, // 完整密钥，用于编辑
      provider: key.provider,
      models: key.models,
      isWorking: true, // 假设都是工作状态，可以后续加入状态检查
      failureCount: 0
    }));

    return NextResponse.json({ keys });
  } catch (error) {
    console.error('获取API密钥失败:', error);
    return NextResponse.json(
      { error: '获取API密钥失败' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('POST /api/admin/keys called');
    
    // 验证管理员权限
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      console.log('No token provided');
      return NextResponse.json(
        { error: '未提供认证token' },
        { status: 401 }
      );
    }

    const adminUser = verifyAdminToken(token);
    if (!adminUser) {
      console.log('Invalid token');
      return NextResponse.json(
        { error: '无效的认证token' },
        { status: 401 }
      );
    }

    console.log('Admin user verified:', adminUser);

    const body = await req.json();
    console.log('Request body:', body);
    
    const { key_value, name, provider, models } = body;

    // 验证输入
    if (!key_value || !provider || !models || !Array.isArray(models)) {
      console.log('Invalid input data:', { key_value: !!key_value, name, provider, models });
      return NextResponse.json(
        { error: '请提供有效的API密钥、提供商和模型列表' },
        { status: 400 }
      );
    }

    if (!['gemini', 'openai', 'claude'].includes(provider)) {
      console.log('Invalid provider:', provider);
      return NextResponse.json(
        { error: '无效的提供商，必须是 gemini、openai 或 claude' },
        { status: 400 }
      );
    }

    console.log('Adding API key...');
    // 添加API密钥
    const result = await systemConfigService.addApiKey({
      key_value,
      name,
      provider,
      models
    });

    console.log('Add result:', result);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '添加API密钥失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'API密钥添加成功',
      id: result.id
    });
  } catch (error) {
    console.error('添加API密钥失败:', error);
    return NextResponse.json(
      { error: `添加API密钥失败: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
