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
  onChunk: (chunk: string) => void,
  maxRetries: number = 3
): Promise<void> {
  if (!sentence) {
    throw new Error('缺少句子');
  }

  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`解析尝试 ${attempt}/${maxRetries}`);
      
      const apiUrl = getApiEndpoint('/analyze');
      const authToken = localStorage.getItem('authToken') || '';
      const headers = getHeaders(authToken);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: `你是专业的日语形态分析专家。请对以下日语文本进行完整的形态学解析，输出标准JSON数组格式。

【输入文本】：${sentence}

【解析要求】：
1. 🔍 完整性：解析文本中的每个字符，包括汉字、假名、标点符号、空格、换行符等
2. 📊 输出格式：JSON数组，每个对象包含4个必需字段：word、pos、furigana、romaji
3. 🏷️ 词性标记：使用标准日语词性标记（名詞、動詞、形容詞、助詞、助動詞、句読点、記号、改行等）
4. 🔤 读音标注：汉字必须提供准确的假名读音，假名字符furigana与word相同
5. 🌐 罗马音：提供标准的罗马字转写
6. ✅ 格式要求：严格的JSON格式，使用双引号，无额外文本或markdown标记
7. 🔚 结束标记：解析完成后添加结束标记对象
8. 🔄 换行处理：对于换行符（\n），请输出 {"word": "\n", "pos": "改行", "furigana": "", "romaji": ""}

【输出示例】：
[
{"word": "私", "pos": "名詞", "furigana": "わたし", "romaji": "watashi"},
{"word": "は", "pos": "助詞", "furigana": "は", "romaji": "wa"},
{"word": "学生", "pos": "名詞", "furigana": "がくせい", "romaji": "gakusei"},
{"word": "です", "pos": "助動詞", "furigana": "です", "romaji": "desu"},
{"word": "\n", "pos": "改行", "furigana": "", "romaji": ""},
{"word": "。", "pos": "句読点", "furigana": "", "romaji": ""},
{"word": "END_OF_ANALYSIS", "pos": "MARKER", "furigana": "", "romaji": ""}
]

【重要提醒】：
- 输出字符总计应匹配输入文本长度（${sentence.length}字符）
- 每个对象必须包含所有4个字段
- 直接输出JSON数组，无需代码块标记或说明文字
- 确保JSON格式正确，可被JavaScript解析
- 对于换行符，请使用“改行”作为词性标记

现在开始解析：`,
          model: MODEL_NAME
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message || errorData.error?.message || errorData.error || response.statusText || '未知错误';
        throw new Error(`解析失败：${errorMessage}`);
      }

      if (!response.body) {
        throw new Error('响应体为空');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let completeResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log(`Stream completed. Response length: ${completeResponse.length} characters`);
          break;
        }
        
        // 直接将解码后的文本块传递给上层
        const chunk = decoder.decode(value, { stream: true });
        completeResponse += chunk;
        onChunk(chunk);
      }
      
      // 验证响应完整性 - 更健壮的检查
      if (!completeResponse) {
        throw new Error('服务器返回空响应');
      }
      
      // 检查是否包含JSON数组结构
      const hasJsonStructure = completeResponse.includes('[') && completeResponse.includes(']');
      const hasEndMarker = completeResponse.includes('END_OF_ANALYSIS');
      
      if (hasJsonStructure) {
        console.log(`✅ 解析完成，响应长度: ${completeResponse.length}字符，结束标记: ${hasEndMarker ? '存在' : '缺失'}`);
        return; // 成功，退出重试循环
      } else {
        // 如果响应不完整，则抛出错误以触发重试
        throw new Error('响应内容不完整，未找到有效的JSON结构');
      }
      
    } catch (error) {
      lastError = error as Error;
      console.error(`尝试 ${attempt} 失败:`, error);
      
      if (attempt < maxRetries) {
        console.log(`等待 ${attempt * 1000}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }
  
  // 如果所有重试都失败了
  throw lastError || new Error('解析失败，已达到最大重试次数');
}

// 获取词汇详情
export async function getWordDetails(
  word: string, 
  pos?: string, 
  sentence?: string, 
  furigana?: string, 
  romaji?: string, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _userApiKey?: string, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _userApiUrl?: string
): Promise<WordDetail> {
  const apiUrl = getApiEndpoint('/translate');
  const authToken = localStorage.getItem('authToken') || '';
  const headers = getHeaders(authToken);

  const prompt = `作为专业的日语词典，请详细解释单词"${word}"${sentence ? `在句子"${sentence}"中` : ''}的含义、词性、发音和用法。

请以JSON格式输出一个对象，包含以下字段：
- originalWord: 原始单词
- chineseTranslation: 中文翻译
- pos: 词性（如：名詞、動詞、形容詞等）
- furigana: 假名读音
- romaji: 罗马音
- dictionaryForm: 词典形式（如果与原词不同）
- explanation: 详细解释和用法示例

示例格式：
{
  "originalWord": "${word}",
  "chineseTranslation": "中文翻译",
  "pos": "${pos || ''}",
  "furigana": "${furigana || ''}",
  "romaji": "${romaji || ''}",
  "dictionaryForm": "词典形式",
  "explanation": "详细解释和用法"
}

请直接输出JSON，不要添加其他说明。`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    const errorMessage = errorData.message || errorData.error?.message || errorData.error || response.statusText || '未知错误';
    throw new Error(`获取词汇详情失败：${errorMessage}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message || '翻译服务出错');
  }

  try {
    // 兼容后端返回的OpenAI格式
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('响应中缺少有效的词汇详情内容');
    }
    
    let resultText = content;
    
    // 清理可能的markdown标记
    resultText = resultText.replace(/^```json?\s*/, '').replace(/\s*```$/, '').trim();
    
    // 解析JSON
    const wordDetail: WordDetail = JSON.parse(resultText);
    
    return wordDetail;
  } catch (parseError) {
    console.error('解析词汇详情JSON失败:', parseError);
    console.error('原始响应:', data);
    
    // 返回一个基础的词汇信息
    return {
      originalWord: word,
      chineseTranslation: '无法获取翻译',
      pos: pos || '未知',
      furigana: furigana || '',
      romaji: romaji || '',
      explanation: '详细信息解析失败，请重试'
    };
  }
}

// 文本转语音
export async function textToSpeech(
  text: string,
  provider: 'gemini' | 'elevenlabs' = 'gemini'
): Promise<ArrayBuffer> {
  const apiUrl = getApiEndpoint('/tts');
  const authToken = localStorage.getItem('authToken') || '';
  const headers = getHeaders(authToken);

  console.log('调用TTS API:', { apiUrl, text, provider });

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text,
      provider
    })
  });

  console.log('TTS API响应状态:', response.status);

  if (!response.ok) {
    const errorData = await response.json();
    const errorMessage = errorData.message || errorData.error?.message || errorData.error || response.statusText || '未知错误';
    console.error('TTS API错误:', errorMessage);
    throw new Error(`语音合成失败：${errorMessage}`);
  }

  const responseData = await response.json();
  console.log('TTS API响应数据:', responseData);
  
  // 检查响应格式
  if (responseData.error) {
    throw new Error(`语音合成失败：${responseData.error.message}`);
  }
  
  if (!responseData.audio) {
    throw new Error('响应中缺少音频数据');
  }
  
  // 将Base64音频数据转换为ArrayBuffer
  const binaryString = atob(responseData.audio);
  const pcmData = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    pcmData[i] = binaryString.charCodeAt(i);
  }
  
  console.log('PCM数据转换完成，大小:', pcmData.length);
  console.log('MIME类型:', responseData.mimeType);
  
  // 检查是否是PCM格式，需要转换为WAV
  if (responseData.mimeType && responseData.mimeType.includes('audio/L16') || responseData.mimeType.includes('pcm')) {
    console.log('检测到PCM格式，开始转换为WAV...');
    const wavBuffer = convertPcmToWav(pcmData, 24000); // 24kHz采样率
    console.log('WAV转换完成，大小:', wavBuffer.byteLength);
    return wavBuffer;
  }
  
  return pcmData.buffer;
}

// 通用翻译接口
export async function translateText(text: string): Promise<string> {
  const apiUrl = getApiEndpoint('/translate');
  const authToken = localStorage.getItem('authToken') || '';
  const headers = getHeaders(authToken);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt: `请将以下日语文本翻译成中文：\n\n${text}\n\n请直接输出翻译结果，不要添加其他说明。`
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    const errorMessage = errorData.message || errorData.error?.message || errorData.error || response.statusText || '未知错误';
    throw new Error(`翻译失败：${errorMessage}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message || '翻译服务出错');
  }

  // 兼容后端返回的OpenAI格式
  const content = data.choices?.[0]?.message?.content;
  return content || '';
}

// 兼容性函数
export async function extractTextFromFile(file: File): Promise<string> {
  try {
    const apiUrl = getApiEndpoint('/file-to-text');
    const authToken = localStorage.getItem('authToken') || '';
    const headers = { 'Authorization': authToken ? `Bearer ${authToken}` : '' };
    
    // 使用FormData上传文件
    const formData = new FormData();
    formData.append('file', file);
    formData.append('prompt', 'RETURN_RAW_TEXT'); // 请求返回原始文本
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.message || errorData.error?.message || errorData.error || response.statusText || '未知错误';
      throw new Error(`文件文本提取失败：${errorMessage}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || '文件处理服务出错');
    }
    
    // 兼容后端返回的OpenAI格式
    const content = data.choices?.[0]?.message?.content;
    return content || '未找到文件内容';
  } catch (error) {
    console.error('文件文本提取失败:', error);
    throw new Error(error instanceof Error ? error.message : '文件文本提取失败');
  }
}

export async function extractTextFromImage(file: File): Promise<string> {
  try {
    // 将文件转换为Base64
    const base64Data = await fileToBase64(file);
    
    const apiUrl = getApiEndpoint('/image-to-text');
    const authToken = localStorage.getItem('authToken') || '';
    const headers = getHeaders(authToken);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        imageData: base64Data,
        prompt: '请提取并返回这张图片中的所有日文文字。保持原始格式，不要添加任何解释或说明。'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.message || errorData.error?.message || errorData.error || response.statusText || '未知错误';
      throw new Error(`图片文本提取失败：${errorMessage}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || '图片识别服务出错');
    }

    // 兼容后端返回的OpenAI格式
    const content = data.choices?.[0]?.message?.content;
    return content || '未找到文字内容';
  } catch (error) {
    console.error('图片文本提取失败:', error);
    throw new Error(error instanceof Error ? error.message : '图片文本提取失败');
  }
}

// 辅助函数：将文件转换为Base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      resolve(result);
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

// 辅助函数：将PCM数据转换为WAV格式
function convertPcmToWav(pcmData: Uint8Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1; // 单声道
  const bytesPerSample = 2; // 16-bit
  const byteRate = sampleRate * numChannels * bytesPerSample;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = pcmData.length;
  const fileSize = 36 + dataSize;
  
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  
  // WAV文件头
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  // RIFF头
  writeString(0, 'RIFF');
  view.setUint32(4, fileSize, true);
  writeString(8, 'WAVE');
  
  // fmt块
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt块大小
  view.setUint16(20, 1, true); // 音频格式 (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 每个样本的位数
  
  // data块
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  
  // 复制PCM数据
  const pcmView = new Uint8Array(buffer, 44);
  pcmView.set(pcmData);
  
  return buffer;
}

export async function synthesizeSpeech(text: string, provider: 'gemini' | 'elevenlabs' = 'gemini'): Promise<string> {
  try {
    console.log('开始语音合成:', { text, provider });
    // 调用TTS API
    const audioBuffer = await textToSpeech(text, provider);
    
    // 由于textToSpeech已经处理了PCM到WAV的转换，这里直接使用WAV格式
    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    console.log('语音合成成功，URL:', url);
    return url;
  } catch (error) {
    console.error('语音合成失败:', error);
    throw new Error(error instanceof Error ? error.message : '语音合成失败');
  }
}