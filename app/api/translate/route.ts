import { NextRequest, NextResponse } from 'next/server';
import { ApiClient } from '../../utils/api-client';
import { tokenUsageService } from '../../lib/services/tokenUsageService';
import { authMiddleware } from '../../lib/utils/auth';

// API密钥从环境变量获取，支持逗号分隔的多个密钥
const API_KEY = process.env.API_KEY || '';
const API_URL = process.env.API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent';

// 创建API客户端实例
const apiClient = new ApiClient(API_KEY);

export async function POST(req: NextRequest) {
  try {
    // 解析请求体
    const requestData = await req.json();
    
    // 从请求头中获取用户认证token（不再支持用户自定义API密钥）
    // const authHeader = req.headers.get('Authorization');
    // const _userAuthToken = authHeader ? authHeader.replace('Bearer ', '') : '';
    
    // 使用服务器端API密钥进行API调用
    const userApiKey = '';
    
    // 尝试获取当前用户信息（用于统计）
    const authResult = await authMiddleware(false)(req);
    const currentUser = authResult.user;
    
    // 从请求中提取数据
    const { text, apiUrl, stream = false } = requestData;
    
    // 优先使用用户提供的API URL，否则使用环境变量中的URL
    const effectiveApiUrl = apiUrl || API_URL;

    if (!text) {
      return NextResponse.json(
        { error: { message: '缺少必要的文本内容' } },
        { status: 400 }
      );
    }

    // 估算输入TOKEN数量
    const tokenEstimate = tokenUsageService.estimateTokens(text);

    // 构建翻译请求
    const translationPrompt = `请将以下日文文本翻译成简体中文。重要：请务必保持与原文完全相同的段落和换行结构。

原文：
${text}

请仅返回翻译后的中文文本。`;

    // 构建发送到Gemini API的请求
    const payload = {
      contents: [{
        parts: [{ text: translationPrompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.1,
        maxOutputTokens: 8192,
      }
    };

    // 使用API客户端发送请求，支持多KEY自动切换
    const result = await apiClient.makeRequest({
      url: effectiveApiUrl,
      method: 'POST',
      body: payload
    }, userApiKey);

    if (!result.success) {
      console.error('AI API error (Translation):', result.error);
      
      // 记录失败的TOKEN使用量
      if (currentUser?.userId) {
        try {
          await tokenUsageService.recordTokenUsage({
            userId: currentUser.userId,
            apiEndpoint: 'translate',
            inputTokens: tokenEstimate.inputTokens,
            outputTokens: 0,
            modelName: 'gemini-2.5-flash',
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

    // 处理流式响应（需要直接使用fetch来处理流）
    if (stream) {
      // 对于流式响应，我们需要直接使用fetch
      const streamApiKey = userApiKey || (apiClient.getWorkingKeysCount() > 0 ? API_KEY.split(',')[0] : '');
      if (!streamApiKey) {
        return NextResponse.json(
          { error: { message: '未提供API密钥，无法进行流式请求' } },
          { status: 401 }
        );
      }

      try {
        const streamUrl = effectiveApiUrl.includes('generativelanguage.googleapis.com') 
          ? `${effectiveApiUrl}?key=${streamApiKey}&alt=sse`
          : effectiveApiUrl;

        const streamResponse = await fetch(streamUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(effectiveApiUrl.includes('generativelanguage.googleapis.com') ? {} : { 'Authorization': `Bearer ${streamApiKey}` })
          },
          body: JSON.stringify(payload)
        });

        if (!streamResponse.ok) {
          const errorData = await streamResponse.text();
          console.error('Stream API error:', errorData);
          return NextResponse.json(
            { error: { message: `流式请求失败: ${errorData}` } },
            { status: streamResponse.status }
          );
        }

        return new NextResponse(streamResponse.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        });
      } catch (error) {
        console.error('Stream error:', error);
        return NextResponse.json(
          { error: { message: '流式请求过程中发生错误' } },
          { status: 500 }
        );
      }
    } else {
      // 非流式输出，转换响应格式以兼容前端
      type GeminiCandidate = {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
      };

      const geminiResponse = result.data as GeminiCandidate | GeminiCandidate[];
      
      // 从Gemini响应中提取翻译文本
      let translatedText = '';
      if (Array.isArray(geminiResponse)) {
        // 处理数组格式的响应，合并所有文本部分
        for (const chunk of geminiResponse) {
          if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content) {
            const parts = chunk.candidates[0].content.parts;
            if (parts && parts[0] && parts[0].text) {
              translatedText += parts[0].text;
            }
          }
        }
      } else if (geminiResponse.candidates && geminiResponse.candidates[0] && geminiResponse.candidates[0].content) {
        // 处理单个响应格式
        const parts = geminiResponse.candidates[0].content.parts;
        if (parts && parts[0] && parts[0].text) {
          translatedText = parts[0].text;
        }
      }
      
      // 记录成功的TOKEN使用量
      if (currentUser?.userId) {
        const outputTokens = tokenUsageService.estimateTokens(translatedText).inputTokens;
        try {
          await tokenUsageService.recordTokenUsage({
            userId: currentUser.userId,
            apiEndpoint: 'translate',
            inputTokens: tokenEstimate.inputTokens,
            outputTokens: outputTokens,
            modelName: 'gemini-2.5-flash',
            success: true
          });
        } catch (error) {
          console.error('TOKEN使用量记录失败:', error);
        }
      }

      // 转换为前端期望的格式（OpenAI兼容格式）
      const compatibleResponse = {
        choices: [{
          message: {
            content: translatedText || '翻译失败：未找到有效的翻译结果'
          }
        }]
      };
      
      return NextResponse.json(compatibleResponse);
    }
  } catch (error) {
    console.error('Server error (Translation):', error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : '服务器错误' } },
      { status: 500 }
    );
  }
} 