// API与分析相关的服务函数

export interface TokenData {
  word: string;
  pos: string;
  furigana?: string;
  romaji?: string;
}

export interface WordDetail {
  originalWord: string;
  chineseTranslation: string;
  pos: string;
  furigana?: string;
  romaji?: string;
  dictionaryForm?: string;
  explanation: string;
}

// 默认API地址 - 使用本地API路由
export const DEFAULT_API_URL = "/api";
export const MODEL_NAME = "gemini-2.5-flash-preview-05-20";

// 获取API请求URL
export function getApiEndpoint(endpoint: string): string {
  return `${DEFAULT_API_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
}

// 构建请求头
function getHeaders(authToken?: string): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  
  // 使用用户认证token
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  return headers;
}

export async function analyzeSentence(
  sentence: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  if (!sentence) {
    throw new Error('缺少句子');
  }

  const apiUrl = getApiEndpoint('/analyze');
  const authToken = localStorage.getItem('authToken') || '';
  const headers = getHeaders(authToken);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt: `请对以下完整的日语文本进行词法分析，必须解析所有内容，不要遗漏任何部分。

输入文本：${sentence}

重要要求：
1. 解析文本中的每一个词汇，包括标点符号
2. 返回JSON数组格式，每个对象包含4个字段:"word", "pos", "furigana", "romaji"
3. 助动词与动词结合（如"食べた"为一个词）
4. 正确处理换行符:{"word": "\\n", "pos": "改行", "furigana": "", "romaji": ""}
5. 确保输出完整的JSON数组，必须以']'结束
6. 不要添加任何解释文字，只输出JSON
7. 无论文本多长，都必须完整解析每一个字符，不能因为长度而截断
8. 解析完成后，在JSON数组末尾添加特殊标记：{"word": "END_OF_ANALYSIS", "pos": "标记", "furigana": "", "romaji": ""}

关键：这是一个完整性测试，必须解析所有输入内容并添加结束标记！如果没有结束标记，说明解析不完整！

开始输出JSON数组：`,
      model: MODEL_NAME
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`解析失败：${errorData.error?.message || response.statusText || '未知错误'}`);
  }

  if (!response.body) {
    throw new Error('响应体为空');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let chunkCount = 0;
  let totalChunkSize = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log(`Stream completed. Total chunks: ${chunkCount}, Total size: ${totalChunkSize} bytes`);
      break;
    }
    
    chunkCount++;
    totalChunkSize += value.length;
    const chunk = decoder.decode(value, { stream: true });
    console.log(`Chunk ${chunkCount} (${value.length} bytes):`, chunk.substring(0, 100) + "...");

    // 处理Gemini流式响应
    // 解析每个JSON chunk并提取text内容
    const lines = chunk.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        // 尝试解析每一行为JSON
        const parsed = JSON.parse(line);
        
        // 提取candidates中的text内容
        if (parsed.candidates && Array.isArray(parsed.candidates)) {
          for (const candidate of parsed.candidates) {
            if (candidate.content && candidate.content.parts && Array.isArray(candidate.content.parts)) {
              for (const part of candidate.content.parts) {
                if (part.text) {
                  onChunk(part.text);
                }
              }
            }
          }
        }
      } catch {
        // 如果不是完整的JSON，尝试用正则表达式提取text字段
        const textMatches = line.match(/"text":\s*"((?:[^"\\]|\\.)*)"/g);
        
        if (textMatches) {
          for (const match of textMatches) {
            try {
              const textMatch = match.match(/"text":\s*"((?:[^"\\]|\\.)*)"/);
              if (textMatch && textMatch[1]) {
                const textContent = JSON.parse(`"${textMatch[1]}"`);
                onChunk(textContent);
              }
            } catch {
              console.warn('Failed to extract text from match:', match);
            }
          }
        }
      }
    }
  }
}

// 获取词汇详情
export async function getWordDetails(
  word: string, 
  pos: string, 
  sentence: string, 
  furigana?: string, 
  romaji?: string
): Promise<WordDetail> {
  try {
    const apiUrl = getApiEndpoint('/word-detail');
    // 获取用户认证token用于统计
    const authToken = localStorage.getItem('authToken') || '';
    const headers = getHeaders(authToken);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        word, 
        pos, 
        sentence, 
        furigana, 
        romaji,
        model: MODEL_NAME
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`查询释义失败：${errorData.error?.message || response.statusText || '未知错误'}`);
    }

    const result = await response.json();
    
    if (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) {
      let responseContent = result.choices[0].message.content;
      try {
        const jsonMatch = responseContent.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
          responseContent = jsonMatch[1];
        }
        return JSON.parse(responseContent) as WordDetail;
      } catch {
        throw new Error('释义结果JSON格式错误');
      }
    } else {
      throw new Error('释义结果格式错误');
    }
  }
  catch (error) {
    console.error('Error fetching word details:', error);
    throw error;
  }
}

// 翻译文本
export async function translateText(
  japaneseText: string
): Promise<string> {
  try {
    const apiUrl = getApiEndpoint('/translate');
    // 获取用户认证token用于统计
    const authToken = localStorage.getItem('authToken') || '';
    const headers = getHeaders(authToken);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        text: japaneseText,
        model: MODEL_NAME
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`翻译失败：${errorData.error?.message || response.statusText || '未知错误'}`);
    }

    const result = await response.json();
    
    if (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) {
      return result.choices[0].message.content.trim();
    } else {
      throw new Error('翻译结果格式错误');
    }
  } catch (error) {
    console.error('Error translating text:', error);
    throw error;
  }
}

// 从图片提取文本
export async function extractTextFromImage(
  imageData: string, 
  prompt?: string
): Promise<string> {
  try {
    const apiUrl = getApiEndpoint('/image-to-text');
    // 获取用户认证token用于统计
    const authToken = localStorage.getItem('authToken') || '';
    const headers = getHeaders(authToken);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        imageData, 
        prompt,
        model: MODEL_NAME
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`图片文字提取失败：${errorData.error?.message || response.statusText || '未知错误'}`);
    }

    const result = await response.json();
    
    if (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) {
      return result.choices[0].message.content.trim();
    } else {
      throw new Error('图片文字提取结果格式错误');
    }
  }
  catch (error) {
    console.error('Error extracting text from image:', error);
    throw error;
  }
}

// 从文件提取文本
export async function extractTextFromFile(
  file: File, 
  prompt?: string
): Promise<string> {
  try {
    const apiUrl = getApiEndpoint('/file-to-text');
    
    const formData = new FormData();
    formData.append('file', file);
    if (prompt) formData.append('prompt', prompt);
    formData.append('model', MODEL_NAME);
    
    const headers: HeadersInit = {};
    // 获取用户认证token用于统计
    const authToken = localStorage.getItem('authToken') || '';
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`文件文字提取失败：${errorData.error?.message || response.statusText || '未知错误'}`);
    }

    const result = await response.json();
    
    if (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) {
      return result.choices[0].message.content.trim();
    } else {
      throw new Error('文件文字提取结果格式错误');
    }
  } catch (error) {
    console.error('Error extracting text from file:', error);
    throw error;
  }
}

// 使用Gemini TTS合成语音
export async function synthesizeSpeech(
  text: string,
  voice = 'Kore'
): Promise<{ audio: string; mimeType: string }> {
  const apiUrl = getApiEndpoint('/tts');
  // 获取用户认证token用于统计
  const authToken = localStorage.getItem('authToken') || '';
  const headers = getHeaders(authToken);

  // 创建AbortController来处理超时
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, voice }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'TTS 请求失败');
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('请求超时');
    }
    throw error;
  }
}