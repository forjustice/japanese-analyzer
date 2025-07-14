import { NextRequest, NextResponse } from 'next/server';
import { ApiClient } from '../../utils/api-client';
import { tokenUsageService } from '../../lib/services/tokenUsageService';
import { authMiddleware } from '../../lib/utils/auth';

const API_KEY = process.env.API_KEY || '';
const TTS_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';
const MODEL_NAME = 'models/gemini-2.5-flash-preview-tts';

// 创建API客户端实例
const apiClient = new ApiClient(API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'Kore', model = MODEL_NAME } = await req.json();

    // 从请求头中获取用户认证token（不再支持用户自定义API密钥）
    // const authHeader = req.headers.get('Authorization');
    // const _userAuthToken = authHeader ? authHeader.replace('Bearer ', '') : '';
    
    // 使用服务器端API密钥进行API调用
    const userApiKey = '';

    if (!text) {
      return NextResponse.json(
        { error: { message: '缺少必要的文本内容' } },
        { status: 400 }
      );
    }

    // 获取当前用户信息（用于统计）
    const authResult = await authMiddleware(false)(req);
    const currentUser = authResult.user;

    // 估算输入TOKEN数量
    const tokenEstimate = tokenUsageService.estimateTokens(text);

    const payload = {
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } }
        }
      },
      model
    };

    // 调试信息
    console.log('TTS Request:', {
      url: TTS_URL,
      payload: JSON.stringify(payload),
      userApiKey: userApiKey ? 'PROVIDED' : 'NOT_PROVIDED',
      serverApiKey: API_KEY ? 'PROVIDED' : 'NOT_PROVIDED'
    });

    // 使用API客户端发送请求，支持多KEY自动切换
    const result = await apiClient.makeRequest({
      url: TTS_URL,
      method: 'POST',
      body: payload
    }, userApiKey);

    if (!result.success) {
      console.error('TTS API error:', result.error);
      
      // 记录失败的TOKEN使用量
      if (currentUser?.userId) {
        try {
          await tokenUsageService.recordTokenUsage({
            userId: currentUser.userId,
            apiEndpoint: 'tts',
            inputTokens: tokenEstimate.inputTokens,
            outputTokens: 0,
            modelName: 'gemini-2.5-flash-preview-tts',
            success: false
          });
        } catch (error) {
          console.error('TOKEN使用量记录失败:', error);
        }
      }
      
      return NextResponse.json(
        { error: { message: result.error } },
        { status: 500 }
      );
    }

    const ttsResponse = result.data as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: {
              data: string;
              mimeType: string;
            };
          }>;
        };
      }>;
    };
    const inlineData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData) {
      return NextResponse.json(
        { error: { message: '无有效音频数据' } },
        { status: 500 }
      );
    }

    // 记录成功的TOKEN使用量（TTS输出用音频大小估算）
    if (currentUser?.userId) {
      const outputTokens = Math.ceil(inlineData.data.length / 100); // 简单估算
      try {
        await tokenUsageService.recordTokenUsage({
          userId: currentUser.userId,
          apiEndpoint: 'tts',
          inputTokens: tokenEstimate.inputTokens,
          outputTokens: outputTokens,
          modelName: 'gemini-2.5-flash-preview-tts',
          success: true
        });
      } catch (error) {
        console.error('TOKEN使用量记录失败:', error);
      }
    }

    return NextResponse.json({ audio: inlineData.data, mimeType: inlineData.mimeType });
  } catch (error) {
    console.error('Server error (TTS):', error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : '服务器错误' } },
      { status: 500 }
    );
  }
}
