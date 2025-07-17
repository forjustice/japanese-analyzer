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
  let requestData: { prompt?: string; apiUrl?: string } | undefined;
  let authResult: Awaited<ReturnType<ReturnType<typeof authMiddleware>>> | undefined;
  
  try {
    // 首先检查TOKEN使用量限制（不强制要求认证）
    const tokenLimitCheck = createTokenLimitMiddleware(false);
    const limitResult = await tokenLimitCheck(req);
    if (limitResult) {
      return limitResult; // 如果超出限制，直接返回错误响应
    }

    requestData = await req.json();
    const { prompt, apiUrl } = requestData || {};
    
    // 获取数据库中配置的API URL，默认使用Gemini 2.5 Flash
    const effectiveApiUrl = apiUrl || await databaseKeyManager.getProviderUrl('gemini', 'gemini-2.5-flash') || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent';

    if (!prompt) {
      return NextResponse.json({ error: { message: '缺少必要的prompt参数' } }, { status: 400 });
    }

    authResult = await authMiddleware(false)(req);
    const currentUser = authResult.user;
    const tokenEstimate = tokenUsageService.estimateTokens(prompt);

    // Create a structured prompt for Japanese language analysis
    const analysisPrompt = `请对以下日语文本进行详细的形态学分析，对每个词语（包括助词、语尾变化等）进行分词，并返回JSON格式的分析结果。

输入文本：${prompt}

要求：
1. 对文本进行准确的分词
2. 为每个词语提供词性、读音、罗马字等信息
3. 返回格式必须是JSON数组，每个元素包含以下字段：
   - word: 词语本身
   - pos: 词性（名词、动词、形容词、助词等）
   - furigana: 假名读音（如果是汉字）
   - romaji: 罗马字读音

示例输出格式：
[
  {"word": "私", "pos": "代名词", "furigana": "わたし", "romaji": "watashi"},
  {"word": "は", "pos": "助词", "furigana": "は", "romaji": "wa"},
  {"word": "学生", "pos": "名词", "furigana": "がくせい", "romaji": "gakusei"},
  {"word": "です", "pos": "助动词", "furigana": "です", "romaji": "desu"}
]

请严格按照JSON数组格式返回，不要添加任何解释文字。`;

    const payload = {
      contents: [{
        parts: [{ text: analysisPrompt }]
      }],
      generationConfig: {
        temperature: 0.1, // 轻微随机性以确保自然输出
        topK: 1,
        topP: 0.1,
        maxOutputTokens: 4194304, // 4M tokens for very long texts
        stopSequences: [], // 确保不会意外停止
        candidateCount: 1, // 确保单一候选结果
        responseMimeType: "application/json", // 强制JSON输出格式
      }
    };

    const stream = await apiClient.makeStreamingRequest({
      url: effectiveApiUrl,
      method: 'POST',
      body: payload
    });

    // Tee the stream to allow reading it twice
    const [streamForClient, streamForTokenCounting] = stream.tee();

    // Asynchronously count tokens from the second stream
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
          
          // Extract text from the streamed chunks
          let analysisText = '';
          const chunks = fullResponseText.match(/{[\s\S]*?}/g) || [];
          for (const chunkStr of chunks) {
            try {
              const chunk = JSON.parse(chunkStr);
              if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content) {
                const parts = chunk.candidates[0].content.parts;
                if (parts && parts[0] && parts[0].text) {
                  analysisText += parts[0].text;
                }
              }
            } catch {
              // Ignore parsing errors for individual chunks
            }
          }

          const outputTokens = tokenUsageService.estimateTokens(analysisText).inputTokens;
          await tokenUsageService.recordTokenUsage({
            userId: currentUser.userId,
            apiEndpoint: 'analyze',
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
      },
    });

  } catch (error) {
    console.error('Server error in /api/analyze:', error);
    const errorMessage = error instanceof Error ? error.message : '服务器错误';
    // Also record failed token usage on stream setup failure
    try {
      if (!authResult) {
        authResult = await authMiddleware(false)(req);
      }
      if (authResult.user?.userId && requestData?.prompt) {
        const tokenEstimate = tokenUsageService.estimateTokens(requestData.prompt);
        await tokenUsageService.recordTokenUsage({
          userId: authResult.user.userId,
          apiEndpoint: 'analyze',
          inputTokens: tokenEstimate.inputTokens,
          outputTokens: 0,
          modelName: 'gemini-1.5-pro',
          success: false
        });
      }
    } catch (recordError) {
      console.error('Failed to record token usage in error handler:', recordError);
    }
    return NextResponse.json({ error: { message: errorMessage } }, { status: 500 });
  }
}
