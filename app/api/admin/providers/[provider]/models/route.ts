import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '../../../../../lib/middleware/adminAuth';

// 最新的模型列表 (2025年1月更新)
const modelsByProvider = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o (最新)' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (推荐)' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-4', name: 'GPT-4' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    { id: 'gpt-3.5-turbo-instruct', name: 'GPT-3.5 Turbo Instruct' },
    { id: 'o1-preview', name: 'o1-preview (推理模型)' },
    { id: 'o1-mini', name: 'o1-mini (推理模型)' },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (最新)' },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (实验版)' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8B' },
    { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro' },
    { id: 'gemini-pro-vision', name: 'Gemini Pro Vision' },
  ],
  claude: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (最新)' },
    { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (最新)' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
  ],
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ provider: keyof typeof modelsByProvider }> }
) {
  let params;
  try {
    params = await context.params;
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

    const provider = params.provider;
    const models = modelsByProvider[provider] || [];

    return NextResponse.json({ models });
  } catch (error) {
    console.error(`获取 ${params?.provider || 'unknown'} 模型列表失败:`, error);
    return NextResponse.json(
      { error: '获取模型列表失败' },
      { status: 500 }
    );
  }
}