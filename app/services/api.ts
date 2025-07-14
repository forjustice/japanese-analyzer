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

// 分析日语句子
export async function analyzeSentence(
  sentence: string
): Promise<TokenData[]> {
  if (!sentence) {
    throw new Error('缺少句子');
  }

  // 如果文本过长，提醒用户可能需要更多时间
  if (sentence.length > 1000) {
    console.log('检测到长文本，正在完整解析...');
  }

  try {
    const apiUrl = getApiEndpoint('/analyze');
    // 获取用户认证token用于统计
    const authToken = localStorage.getItem('authToken') || '';
    const headers = getHeaders(authToken);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        prompt: `请对以下完整的日语文本进行词法分析，必须解析所有内容，不要遗漏任何部分。

输入文本：${sentence}

要求：
1. 解析文本中的每一个词汇，包括标点符号
2. 返回JSON数组格式，每个对象包含4个字段："word", "pos", "furigana", "romaji"
3. 助动词与动词结合（如"食べた"为一个词）
4. 正确处理换行符：{"word": "\\n", "pos": "改行", "furigana": "", "romaji": ""}
5. 确保输出完整的JSON数组，必须以']'结束
6. 不要添加任何解释文字，只输出JSON

重要：必须完整解析所有输入内容，不能遗漏！

JSON数组：`, 
        model: MODEL_NAME
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error (Analysis):', errorData);
      throw new Error(`解析失败：${errorData.error?.message || response.statusText || '未知错误'}`);
    }
    
    const result = await response.json();

    if (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) {
      let responseContent = result.choices[0].message.content;
      
      try {
        // Try to find JSON in markdown code blocks first
        let jsonMatch = responseContent.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
          responseContent = jsonMatch[1];
        } else {
          // Try to find JSON array without markdown
          jsonMatch = responseContent.match(/\[[\s\S]*\]/);
          if (jsonMatch && jsonMatch[0]) {
            responseContent = jsonMatch[0];
          } else {
            // Try to find incomplete JSON and fix it
            const incompleteMatch = responseContent.match(/\[([\s\S]*)/);
            if (incompleteMatch) {
              let incompleteJson = incompleteMatch[0];
              
              console.log('Fixing incomplete JSON, original length:', incompleteJson.length);
              
              // Strategy 1: Find the last complete object and truncate after it
              const objects = [];
              let currentObj = '';
              let braceCount = 0;
              let inString = false;
              let escapeNext = false;
              
              for (let i = 1; i < incompleteJson.length; i++) { // Skip opening [
                const char = incompleteJson[i];
                
                if (escapeNext) {
                  escapeNext = false;
                  currentObj += char;
                  continue;
                }
                
                if (char === '\\') {
                  escapeNext = true;
                  currentObj += char;
                  continue;
                }
                
                if (char === '"' && !escapeNext) {
                  inString = !inString;
                }
                
                if (!inString) {
                  if (char === '{') {
                    if (braceCount === 0) {
                      currentObj = '{';
                    } else {
                      currentObj += char;
                    }
                    braceCount++;
                  } else if (char === '}') {
                    currentObj += char;
                    braceCount--;
                    
                    if (braceCount === 0) {
                      // Complete object found
                      try {
                        JSON.parse(currentObj);
                        objects.push(currentObj);
                        currentObj = '';
                      } catch {
                        // Invalid object, skip it
                        currentObj = '';
                      }
                    }
                  } else if (braceCount > 0) {
                    currentObj += char;
                  }
                } else {
                  currentObj += char;
                }
              }
              
              if (objects.length > 0) {
                responseContent = '[' + objects.join(',') + ']';
                console.log('Fixed JSON with', objects.length, 'complete objects');
              } else {
                // Fallback: simple truncation approach
                const lastCommaIndex = incompleteJson.lastIndexOf(',');
                const lastBraceIndex = incompleteJson.lastIndexOf('}');
                
                if (lastCommaIndex > lastBraceIndex && lastBraceIndex > 0) {
                  incompleteJson = incompleteJson.substring(0, lastCommaIndex) + ']';
                } else if (lastBraceIndex > 0) {
                  incompleteJson = incompleteJson.substring(0, lastBraceIndex + 1) + ']';
                } else {
                  incompleteJson = '[]'; // Empty array as last resort
                }
                responseContent = incompleteJson;
                console.log('Used fallback JSON repair');
              }
            }
          }
        }
        
        // Clean up the response content
        responseContent = responseContent.trim();
        
        return JSON.parse(responseContent) as TokenData[];
      } catch (e) {
        console.error("Failed to parse JSON from analysis response:", e);
        console.error("Response content length:", responseContent.length);
        console.error("Response preview:", responseContent.substring(0, 200) + "...");
        throw new Error('解析结果JSON格式错误，请重试');
      }
    } else {
      console.error('Unexpected API response structure (Analysis):', result);
      throw new Error('解析结果格式错误，请重试');
    }
  } catch (error) {
    console.error('Error analyzing sentence:', error);
    throw error;
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

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, voice })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'TTS 请求失败');
  }

  return response.json();
}