import { NextRequest, NextResponse } from 'next/server';
import { ApiClient } from '../../utils/api-client';
import { tokenUsageService } from '../../lib/services/tokenUsageService';
import { authMiddleware } from '../../lib/utils/auth';

// API密钥从环境变量获取，支持逗号分隔的多个密钥
const API_KEY = process.env.API_KEY || '';
const API_URL = process.env.API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent';

// 创建API客户端实例
const apiClient = new ApiClient(API_KEY);

export async function POST(req: NextRequest) {
  try {
    const requestData = await req.json();
    const { prompt, apiUrl } = requestData;
    const effectiveApiUrl = apiUrl || API_URL;

    if (!prompt) {
      return NextResponse.json({ error: { message: '缺少必要的prompt参数' } }, { status: 400 });
    }

    // 尝试获取当前用户信息（用于统计，但不强制要求认证）
    const authResult = await authMiddleware(false)(req);
    const currentUser = authResult.user;

    console.log('Analyze API - 用户信息:', {
      hasUser: !!currentUser,
      userId: currentUser?.userId,
      email: currentUser?.email,
      authError: authResult.error
    });

    // 不再支持用户自定义API密钥，使用服务器端API密钥
    const userApiKey = '';

    // 估算输入TOKEN数量
    const tokenEstimate = tokenUsageService.estimateTokens(prompt);
    console.log('TOKEN估算:', tokenEstimate);

    const payload = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.1,
        maxOutputTokens: 32768, // 增加到32K tokens
      }
    };

    // Stream mode is not currently supported for analysis
    // Process the request normally without streaming

    const result = await apiClient.makeRequest({
      url: effectiveApiUrl,
      method: 'POST',
      body: payload
    }, userApiKey);

    if (!result.success) {
      console.error('AI API error:', result.error);
      
      // 记录失败的TOKEN使用量
      if (currentUser?.userId) {
        console.log('记录失败的TOKEN使用量:', {
          userId: currentUser.userId,
          inputTokens: tokenEstimate.inputTokens,
          error: result.error
        });
        
        try {
          await tokenUsageService.recordTokenUsage({
            userId: currentUser.userId,
            apiEndpoint: 'analyze',
            inputTokens: tokenEstimate.inputTokens,
            outputTokens: 0,
            modelName: 'gemini-2.0-flash-exp',
            success: false
          });
          console.log('失败TOKEN使用量记录成功');
        } catch (error) {
          console.error('失败TOKEN使用量记录失败:', error);
        }
      }
      
      return NextResponse.json({ error: { message: result.error } }, { status: 500 });
    }

    const geminiResponse = result.data;
    let analysisText = '';

    if (Array.isArray(geminiResponse)) {
      for (const chunk of geminiResponse) {
        if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content) {
          const parts = chunk.candidates[0].content.parts;
          if (parts && parts[0] && parts[0].text) {
            analysisText += parts[0].text;
          }
        }
      }
    } else if (geminiResponse.candidates && geminiResponse.candidates[0] && geminiResponse.candidates[0].content) {
      const parts = geminiResponse.candidates[0].content.parts;
      if (parts && parts[0] && parts[0].text) {
        analysisText = parts[0].text;
      }
    }

    const compatibleResponse = {
      choices: [{
        message: {
          content: analysisText || '解析失败：未找到有效的分析结果'
        }
      }]
    };

    // 记录TOKEN使用量（如果有用户信息）
    if (currentUser?.userId) {
      const outputTokens = tokenUsageService.estimateTokens(analysisText).inputTokens;
      console.log('记录TOKEN使用量:', {
        userId: currentUser.userId,
        inputTokens: tokenEstimate.inputTokens,
        outputTokens: outputTokens,
        analysisTextLength: analysisText.length
      });
      
      try {
        await tokenUsageService.recordTokenUsage({
          userId: currentUser.userId,
          apiEndpoint: 'analyze',
          inputTokens: tokenEstimate.inputTokens,
          outputTokens: outputTokens,
          modelName: 'gemini-2.0-flash-exp',
          success: true
        });
        console.log('TOKEN使用量记录成功');
      } catch (error) {
        console.error('TOKEN使用量记录失败:', error);
      }
    } else {
      console.log('未找到用户信息，跳过TOKEN统计:', { authResult: authResult.error, currentUser });
    }
    
    return NextResponse.json(compatibleResponse);

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: { message: error instanceof Error ? error.message : '服务器错误' } }, { status: 500 });
  }
}