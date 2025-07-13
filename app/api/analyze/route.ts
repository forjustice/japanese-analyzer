import { NextRequest, NextResponse } from 'next/server';
import { ApiClient } from '../../utils/api-client';

// API密钥从环境变量获取，支持逗号分隔的多个密钥
const API_KEY = process.env.API_KEY || '';
const API_URL = process.env.API_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const MODEL_NAME = "gemini-2.5-flash-preview-05-20";

// 创建API客户端实例
const apiClient = new ApiClient(API_KEY);


export async function POST(req: NextRequest) {
  try {
    // 解析请求体
    const requestData = await req.json();
    
    // 从请求头中获取用户提供的API密钥（如果有）
    const authHeader = req.headers.get('Authorization');
    const userApiKey = authHeader ? authHeader.replace('Bearer ', '') : '';
    
    // 从请求中提取数据
    const { prompt, model = MODEL_NAME, apiUrl, stream = false } = requestData;
    
    // 优先使用用户提供的API URL，否则使用环境变量中的URL
    const effectiveApiUrl = apiUrl || API_URL;
    
    if (!prompt) {
      return NextResponse.json(
        { error: { message: '缺少必要的prompt参数' } },
        { status: 400 }
      );
    }

    // 构建发送到AI服务的请求
    const payload = {
      model: model,
      reasoning_effort: "none", 
      messages: [{ role: "user", content: prompt }],
      stream: stream,
    };

    // 使用API客户端发送请求，支持多KEY自动切换
    const result = await apiClient.makeRequest({
      url: effectiveApiUrl,
      method: 'POST',
      body: payload
    }, userApiKey);

    if (!result.success) {
      console.error('AI API error:', result.error);
      return NextResponse.json(
        { error: { message: result.error } },
        { status: 500 }
      );
    }

    // 处理流式响应（需要直接使用fetch来处理流）
    if (stream) {
      // 对于流式响应，我们需要直接使用fetch
      const streamApiKey = userApiKey || apiClient.getWorkingKeysCount() > 0;
      if (!streamApiKey && !userApiKey) {
        return NextResponse.json(
          { error: { message: '暂无可用的API密钥用于流式响应' } },
          { status: 500 }
        );
      }

      // 如果用户没有提供KEY，从多KEY中获取一个
      let effectiveApiKey = userApiKey;
      if (!effectiveApiKey) {
        // 这里简化处理，实际使用时建议扩展ApiClient来支持流式响应
        effectiveApiKey = API_KEY.split(',')[0]?.trim();
      }

      const response = await fetch(effectiveApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveApiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.text();
        return NextResponse.json(
          { error: { message: `流式请求失败: ${data}` } },
          { status: response.status }
        );
      }

      const readableStream = response.body;
      if (!readableStream) {
        return NextResponse.json(
          { error: { message: '流式响应创建失败' } },
          { status: 500 }
        );
      }

      return new NextResponse(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    } else {
      // 非流式输出，返回结果数据
      return NextResponse.json(result.data);
    }
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : '服务器错误' } },
      { status: 500 }
    );
  }
} 