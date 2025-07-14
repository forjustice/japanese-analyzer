import { NextRequest, NextResponse } from 'next/server';
import { ApiClient } from '../../utils/api-client';
import { tokenUsageService } from '../../lib/services/tokenUsageService';
import { authMiddleware } from '../../lib/utils/auth';

// API密钥从环境变量获取，支持逗号分隔的多个密钥
const API_KEY = process.env.API_KEY || '';
const API_URL = process.env.API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// 创建API客户端实例
const apiClient = new ApiClient(API_KEY);

// 配置API路由支持大尺寸请求
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export async function POST(req: NextRequest) {
  try {
    // 获取请求内容
    const requestBody = await req.text();
    let parsedBody;
    
    try {
      // 尝试解析请求体为JSON
      parsedBody = JSON.parse(requestBody);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: { message: '请求体解析失败，请确保发送有效的JSON格式' } },
        { status: 400 }
      );
    }
    
    const { imageData, prompt, apiUrl, stream = false } = parsedBody;
    
    // 从请求头中获取用户认证token（不再支持用户自定义API密钥）
    // const authHeader = req.headers.get('Authorization');
    // const _userAuthToken = authHeader ? authHeader.replace('Bearer ', '') : '';
    
    // 使用服务器端API密钥进行API调用
    const userApiKey = '';
    
    // 优先使用用户提供的API URL，否则使用环境变量中的URL
    const effectiveApiUrl = apiUrl || API_URL;

    if (!imageData) {
      return NextResponse.json(
        { error: { message: '缺少必要的图片数据' } },
        { status: 400 }
      );
    }

    // 获取当前用户信息（用于统计）
    const authResult = await authMiddleware(false)(req);
    const currentUser = authResult.user;

    // 优化提示词，避免换行符
    const defaultPrompt = "请提取并返回这张图片中的所有日文文字。提取的文本应保持原始格式，但不要输出换行符，用空格替代。不要添加任何解释或说明。";
    
    // 估算输入TOKEN数量（图片按固定值估算）
    const imageTokens = 1000; // 图片识别固定消耗
    const promptTokens = tokenUsageService.estimateTokens(prompt || defaultPrompt).inputTokens;
    const totalInputTokens = imageTokens + promptTokens;
    
    // 处理图片数据
    const mimeType = imageData.startsWith('data:image/') ? imageData.split(';')[0].split(':')[1] : 'image/jpeg';
    const base64Data = imageData.startsWith('data:') ? imageData.split(',')[1] : imageData;
    
    console.log('Image processing debug:');
    console.log('- Detected MIME type:', mimeType);
    console.log('- Base64 data length:', base64Data.length);
    console.log('- Prompt:', prompt || defaultPrompt);
    
    // 构建发送到Gemini API的请求（native格式）
    const payload = {
      contents: [{
        parts: [
          { text: prompt || defaultPrompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.1,
        maxOutputTokens: 4096,
      }
    };

    // 验证imageData大小
    if (imageData.length > 1024 * 1024 * 8) { // 8MB限制
      return NextResponse.json(
        { error: { message: '图片数据太大，请压缩后重试' } },
        { status: 413 }
      );
    }

    // 使用API客户端发送请求，支持多KEY自动切换
    console.log('Making API request to:', effectiveApiUrl);
    console.log('Using user API key:', userApiKey ? 'Yes' : 'No');
    
    const result = await apiClient.makeRequest({
      url: effectiveApiUrl,
      method: 'POST',
      body: payload
    }, userApiKey);

    console.log('API result success:', result.success);
    if (!result.success) {
      console.error('AI API error (Image):', result.error);
      
      // 记录失败的TOKEN使用量
      if (currentUser?.userId) {
        try {
          await tokenUsageService.recordTokenUsage({
            userId: currentUser.userId,
            apiEndpoint: 'image-to-text',
            inputTokens: totalInputTokens,
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

    // 处理响应
    if (stream) {
      // 暂时不支持图片的流式处理，返回错误
      return NextResponse.json(
        { error: { message: '图片处理暂不支持流式响应' } },
        { status: 400 }
      );
    } else {
      // 非流式输出，转换响应格式
      type GeminiCandidate = {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
        text?: string;
      };

      const geminiResponse = result.data as GeminiCandidate | GeminiCandidate[];
      
      // 添加详细的调试日志
      console.log('Gemini API response structure:', JSON.stringify(geminiResponse, null, 2));
      
      // 从Gemini响应中提取文本
      let extractedText = '';
      if (Array.isArray(geminiResponse)) {
        // 处理类似流的数组响应
        for (const item of geminiResponse) {
          if (item.candidates && item.candidates[0] && item.candidates[0].content) {
            const parts = item.candidates[0].content.parts;
            if (parts && parts[0] && parts[0].text) {
              extractedText += parts[0].text;
            }
          }
        }
        console.log('从数组响应中提取的文本:', extractedText);
      } else if (geminiResponse.candidates && geminiResponse.candidates[0] && geminiResponse.candidates[0].content) {
        // 处理单个对象响应
        const parts = geminiResponse.candidates[0].content.parts;
        console.log('找到的内容部分:', parts);
        if (parts && parts[0] && parts[0].text) {
          extractedText = parts[0].text;
          console.log('从单个响应中提取的文本:', extractedText);
        } else {
          console.log('在parts[0]中未找到文本');
        }
      } else {
        console.log('在响应中未找到候选内容或内容');
      }
      
      // 检查是否有其他可能的响应格式
      if (!extractedText && !Array.isArray(geminiResponse) && geminiResponse.text) {
        extractedText = geminiResponse.text;
        console.log('在直接文本属性中找到文本:', extractedText);
      }
      
      // 记录成功的TOKEN使用量
      if (currentUser?.userId) {
        const outputTokens = tokenUsageService.estimateTokens(extractedText).inputTokens;
        try {
          await tokenUsageService.recordTokenUsage({
            userId: currentUser.userId,
            apiEndpoint: 'image-to-text',
            inputTokens: totalInputTokens,
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
            content: extractedText || '图片文字提取失败：未找到有效的文字内容'
          }
        }]
      };
      
      return NextResponse.json(compatibleResponse);
    }
  } catch (error) {
    console.error('Server error (Image):', error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : '服务器错误' } },
      { status: 500 }
    );
  }
} 