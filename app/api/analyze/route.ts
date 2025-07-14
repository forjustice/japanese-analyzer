import { NextRequest, NextResponse } from 'next/server';
import { ApiClient } from '../../utils/api-client';
import { tokenUsageService } from '../../lib/services/tokenUsageService';
import { authMiddleware } from '../../lib/utils/auth';
import { createTokenLimitMiddleware } from '../../lib/middleware/tokenLimitMiddleware';

const API_KEY = process.env.API_KEY || '';
const API_URL = process.env.API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent';

const apiClient = new ApiClient(API_KEY);

export async function POST(req: NextRequest) {
  try {
    // 首先检查TOKEN使用量限制
    const tokenLimitCheck = createTokenLimitMiddleware(false);
    const limitResult = await tokenLimitCheck(req);
    if (limitResult) {
      return limitResult; // 如果超出限制，直接返回错误响应
    }

    const requestData = await req.json();
    const { prompt, apiUrl } = requestData;
    const effectiveApiUrl = apiUrl || API_URL;

    if (!prompt) {
      return NextResponse.json({ error: { message: '缺少必要的prompt参数' } }, { status: 400 });
    }

    const authResult = await authMiddleware(false)(req);
    const currentUser = authResult.user;
    const tokenEstimate = tokenUsageService.estimateTokens(prompt);

    const payload = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.1,
        maxOutputTokens: 65536, // Maximum for very long content
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
    const authResult = await authMiddleware(false)(req);
    if (authResult.user?.userId) {
        const { prompt } = await req.json();
        const tokenEstimate = tokenUsageService.estimateTokens(prompt);
        await tokenUsageService.recordTokenUsage({
            userId: authResult.user.userId,
            apiEndpoint: 'analyze',
            inputTokens: tokenEstimate.inputTokens,
            outputTokens: 0,
            modelName: 'gemini-2.5-flash',
            success: false
        });
    }
    return NextResponse.json({ error: { message: errorMessage } }, { status: 500 });
  }
}
