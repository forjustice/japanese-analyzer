import { NextRequest, NextResponse } from 'next/server';
import { ApiClient } from '../../utils/api-client';
import { tokenUsageService } from '../../lib/services/tokenUsageService';
import { authMiddleware } from '../../lib/utils/auth';
import { createTokenLimitMiddleware } from '../../lib/middleware/tokenLimitMiddleware';
import { DatabaseApiKeyManager } from '../../utils/database-api-key-manager';

// 使用数据库密钥管理器
const apiClient = new ApiClient();
const databaseKeyManager = new DatabaseApiKeyManager();

export async function POST(req: NextRequest) {
  try {
    // 首先检查TOKEN使用量限制（不强制要求认证）
    const tokenLimitCheck = createTokenLimitMiddleware(false);
    const limitResult = await tokenLimitCheck(req);
    if (limitResult) {
      return limitResult; // 如果超出限制，直接返回错误响应
    }

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
    const { prompt, text, apiUrl, stream = false } = requestData;
    const effectivePrompt = prompt || text;
    
    // 优先使用用户提供的API URL，否则使用数据库中配置的URL
    const effectiveApiUrl = apiUrl || await databaseKeyManager.getProviderUrl('gemini') || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent';

    if (!effectivePrompt) {
      return NextResponse.json(
        { error: { message: '缺少必要的文本内容' } },
        { status: 400 }
      );
    }

    // 估算输入TOKEN数量
    const tokenEstimate = tokenUsageService.estimateTokens(effectivePrompt);

    // 构建发送到Gemini API的请求
    const payload = {
      contents: [{
        parts: [{ text: effectivePrompt }]
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
      const workingKeysCount = await apiClient.getWorkingKeysCount();
      if (!userApiKey && workingKeysCount === 0) {
        return NextResponse.json(
          { error: { message: '未提供API密钥，无法进行流式请求' } },
          { status: 401 }
        );
      }

      try {
        const streamResponse = await apiClient.makeStreamingRequest({
          url: effectiveApiUrl,
          method: 'POST',
          body: payload
        }, userApiKey);

        // 创建流的拷贝以便进行TOKEN计算
        const [streamForClient, streamForTokenCounting] = streamResponse.tee();

        // 异步统计TOKEN使用量
        if (currentUser?.userId) {
          (async () => {
            try {
              const reader = streamForTokenCounting.getReader();
              const decoder = new TextDecoder();
              let fullResponseText = '';
              
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                fullResponseText += decoder.decode(value, { stream: true });
              }
              
              // 提取翻译文本
              let translatedText = '';
              const chunks = fullResponseText.match(/{[\s\S]*?}/g) || [];
              for (const chunkStr of chunks) {
                try {
                  const chunk = JSON.parse(chunkStr);
                  if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content) {
                    const parts = chunk.candidates[0].content.parts;
                    if (parts && parts[0] && parts[0].text) {
                      translatedText += parts[0].text;
                    }
                  }
                } catch {
                  // 忽略解析错误
                }
              }

              const outputTokens = tokenUsageService.estimateTokens(translatedText).inputTokens;
              await tokenUsageService.recordTokenUsage({
                userId: currentUser.userId,
                apiEndpoint: 'translate',
                inputTokens: tokenEstimate.inputTokens,
                outputTokens: outputTokens,
                modelName: 'gemini-2.5-flash',
                success: true
              });
              console.log('流式响应TOKEN使用量记录成功');
            } catch (error) {
              console.error('流式响应TOKEN使用量记录失败:', error);
            }
          })();
        }

        return new NextResponse(streamForClient, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
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