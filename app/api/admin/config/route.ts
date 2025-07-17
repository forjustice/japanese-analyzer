import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '../../../lib/middleware/adminAuth';
import fs from 'fs';
import path from 'path';

// 定义可配置的环境变量
const CONFIGURABLE_VARS = [
  // 数据库配置
  { key: 'DB_HOST', description: '数据库主机地址', type: 'text', category: '数据库配置', required: true, sensitive: false },
  { key: 'DB_PORT', description: '数据库端口', type: 'number', category: '数据库配置', required: true, sensitive: false },
  { key: 'DB_USER', description: '数据库用户名', type: 'text', category: '数据库配置', required: true, sensitive: false },
  { key: 'DB_PASSWORD', description: '数据库密码', type: 'password', category: '数据库配置', required: true, sensitive: true },
  { key: 'DB_NAME', description: '数据库名称', type: 'text', category: '数据库配置', required: true, sensitive: false },
  
  // 系统配置
  { key: 'JWT_SECRET', description: 'JWT密钥 (用于Token签名)', type: 'password', category: '系统配置', required: true, sensitive: true },
  { key: 'MONTHLY_TOKEN_LIMIT', description: '用户月度免费Token使用限额', type: 'number', category: '系统配置', required: true, sensitive: false },

  // 邮件配置
  { key: 'SMTP_HOST', description: 'SMTP服务器地址', type: 'text', category: '邮件配置', required: false, sensitive: false },
  { key: 'SMTP_PORT', description: 'SMTP端口', type: 'number', category: '邮件配置', required: false, sensitive: false },
  { key: 'SMTP_USER', description: 'SMTP用户名', type: 'text', category: '邮件配置', required: false, sensitive: false },
  { key: 'SMTP_PASS', description: 'SMTP密码', type: 'password', category: '邮件配置', required: false, sensitive: true },
  { key: 'FROM_EMAIL', description: '发件人邮箱地址', type: 'text', category: '邮件配置', required: false, sensitive: false },
  
  // Stripe配置
  { key: 'STRIPE_CURRENCY', description: '支付货币 (例如 USD, JPY)', type: 'text', category: 'Stripe配置', required: false, sensitive: false },
  { key: 'STRIPE_SK_LIVE', description: 'Stripe Secret Key (SK_LIVE)', type: 'password', category: 'Stripe配置', required: false, sensitive: true },
  { key: 'STRIPE_PK_LIVE', description: 'Stripe Publishable Key (PK_LIVE)', type: 'password', category: 'Stripe配置', required: false, sensitive: true },
  { key: 'STRIPE_WEBHOOK_SECRET', description: 'Stripe Webhook 密钥签名', type: 'password', category: 'Stripe配置', required: false, sensitive: true }
];

function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    '数据库配置': '数据库连接和访问配置',
    '系统配置': '系统核心功能和安全配置',
    '邮件配置': 'SMTP邮件服务，用于发送验证码等',
    'Stripe配置': 'Stripe支付网关，用于在线收款',
  };
  return descriptions[category] || '相关配置';
}

function getConfigsFromEnv(host: string) {
  const categories = new Map();
  
  CONFIGURABLE_VARS.forEach(config => {
    if (!categories.has(config.category)) {
      categories.set(config.category, {
        name: config.category,
        description: getCategoryDescription(config.category),
        items: []
      });
    }
    
    categories.get(config.category).items.push({
      ...config,
      value: process.env[config.key] || ''
    });
  });

  // 注入只读的Stripe Webhook URL
  if (categories.has('Stripe配置')) {
    const webhookUrl = new URL('/api/stripe/webhook', `https://${host}`).toString();
    categories.get('Stripe配置').items.push({
      key: 'STRIPE_WEBHOOK_URL',
      value: webhookUrl,
      description: 'Stripe Webhook的固定通知URL。请将其复制并粘贴到Stripe后台的Webhook端点设置中。',
      type: 'readonly',
      category: 'Stripe配置',
      required: false,
      sensitive: false,
    });
  }
  
  return Array.from(categories.values());
}

async function updateEnvFile(configs: {[key: string]: string}) {
  try {
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    const envVars = new Map();
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const separatorIndex = trimmedLine.indexOf('=');
        if (separatorIndex !== -1) {
          const key = trimmedLine.substring(0, separatorIndex).trim();
          const value = trimmedLine.substring(separatorIndex + 1).trim();
          envVars.set(key, value);
        }
      }
    });
    
    // 更新传入的配置
    Object.entries(configs).forEach(([key, value]) => {
      if (CONFIGURABLE_VARS.some(config => config.key === key)) {
        envVars.set(key, value);
      }
    });
    
    // 重新生成.env文件内容，只包含在CONFIGURABLE_VARS中定义的key
    const newEnvContent = CONFIGURABLE_VARS
      .map(config => {
        const key = config.key;
        const value = envVars.get(key) || '';
        return `${key}=${value}`;
      })
      .join('\n');
    
    fs.writeFileSync(envPath, newEnvContent);
    
    // 更新当前进程的 process.env
    Object.entries(configs).forEach(([key, value]) => {
      if (CONFIGURABLE_VARS.some(config => config.key === key)) {
        process.env[key] = value;
      }
    });
    
    return true;
  } catch (error) {
    console.error('更新.env文件失败:', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EACCES') {
      const e = error as { code: string; path: string; };
      console.error(`权限错误: 没有写入 ${e.path} 的权限。`);
    }
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: '未提供认证token' }, { status: 401 });
    }

    const adminUser = verifyAdminToken(token);
    if (!adminUser) {
      return NextResponse.json({ error: '无效的认证token' }, { status: 401 });
    }

    const host = req.headers.get('host') || 'localhost';
    const categories = getConfigsFromEnv(host);

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('获取配置失败:', error);
    return NextResponse.json({ error: '获取配置失败' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: '未提供认证token' }, { status: 401 });
    }

    const adminUser = verifyAdminToken(token);
    if (!adminUser || adminUser.role !== 'super_admin') {
      return NextResponse.json({ error: '需要超级管理员权限' }, { status: 403 });
    }

    const { configs } = await req.json();

    if (!configs || typeof configs !== 'object') {
      return NextResponse.json({ error: '无效的配置数据' }, { status: 400 });
    }

    const updateSuccess = await updateEnvFile(configs);
    
    if (!updateSuccess) {
      return NextResponse.json({ error: '更新.env文件失败' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: '配置更新成功。请注意，某些更改可能需要重启应用才能生效。'
    });
  } catch (error) {
    console.error('保存配置失败:', error);
    return NextResponse.json({ error: '保存配置失败' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}