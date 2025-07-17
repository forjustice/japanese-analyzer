import { NextRequest, NextResponse } from 'next/server';
import { ApiClient } from '../../utils/api-client';
import { tokenUsageService } from '../../lib/services/tokenUsageService';
import { authMiddleware } from '../../lib/utils/auth';
import { createTokenLimitMiddleware } from '../../lib/middleware/tokenLimitMiddleware';
import { DatabaseApiKeyManager } from '../../utils/database-api-key-manager';
import pdfParse from 'pdf-parse-new';
import mammoth from 'mammoth';

// 处理PDF提取的文本，改善格式和完整性
function processPdfText(rawText: string): string {
  if (!rawText) return '';
  
  let processed = rawText;
  
  // 1. 修复常见的PDF文本问题
  
  // 移除过多的空白字符，但保留基本格式
  processed = processed.replace(/[ \t]+/g, ' '); // 多个空格/制表符合并为一个空格
  
  // 处理换行符 - 保留段落分隔但移除不必要的换行
  processed = processed.replace(/\n{3,}/g, '\n\n'); // 多个换行符合并为两个
  processed = processed.replace(/\n +/g, '\n'); // 移除行首空格
  processed = processed.replace(/ +\n/g, '\n'); // 移除行尾空格
  
  // 2. 修复可能的编码问题
  
  // 修复常见的Unicode问题
  processed = processed.replace(/\uFFFD/g, ''); // 移除替换字符
  processed = processed.replace(/\u00A0/g, ' '); // 将不间断空格替换为普通空格
  
  // 3. 处理PDF特有的格式问题
  
  // 修复可能被分割的单词（特别是日语文本）
  // 这个比较复杂，暂时保持简单处理
  
  // 移除页眉页脚等重复内容的模式（基础版本）
  const lines = processed.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    // 过滤掉纯数字行（可能是页码）
    if (/^\d+$/.test(trimmed)) return false;
    // 过滤掉过短的行（可能是页眉页脚）
    if (trimmed.length < 3) return false;
    return true;
  });
  
  processed = filteredLines.join('\n');
  
  // 4. 最终清理
  processed = processed.trim();
  
  return processed;
}

// API密钥从环境变量获取，支持逗号分隔的多个密钥
// 使用数据库密钥管理器
const apiClient = new ApiClient();
const databaseKeyManager = new DatabaseApiKeyManager();

// 配置API路由支持大尺寸请求
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

export async function POST(req: NextRequest) {
  try {
    // 首先检查TOKEN使用量限制
    const tokenLimitCheck = createTokenLimitMiddleware(true);
    const limitResult = await tokenLimitCheck(req);
    if (limitResult) {
      return limitResult; // 如果超出限制，直接返回错误响应
    }
    // 解析multipart/form-data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const prompt = formData.get('prompt') as string;
    // const model = formData.get('model') as string || MODEL_NAME;
    const apiUrl = formData.get('apiUrl') as string;
    const stream = formData.get('stream') === 'true';
    
    // 从请求头中获取用户认证token（不再支持用户自定义API密钥）
    // const authHeader = req.headers.get('Authorization');
    // const _userAuthToken = authHeader ? authHeader.replace('Bearer ', '') : '';
    
    // 使用服务器端API密钥进行API调用
    const userApiKey = '';
    
    // 优先使用用户提供的API URL，否则使用环境变量中的URL
    const effectiveApiUrl = apiUrl || await databaseKeyManager.getProviderUrl('gemini') || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent';

    if (!file) {
      return NextResponse.json(
        { error: { message: '缺少必要的文件数据' } },
        { status: 400 }
      );
    }

    // 获取当前用户信息（用于统计）
    const authResult = await authMiddleware(false)(req);
    const currentUser = authResult.user;

    // 检查文件大小限制（50MB）
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: { message: '文件大小超过50MB限制，请选择较小的文件' } },
        { status: 413 }
      );
    }

    let extractedText = '';
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    try {
      // 根据文件类型进行处理
      if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        console.log('开始处理PDF文件:', { fileName, fileType, size: file.size });
        
        if (!pdfParse) {
          throw new Error('PDF解析库加载失败');
        }
        
        // 处理PDF文件
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        console.log('PDF文件buffer大小:', buffer.length);
        
        try {
          // 使用pdf-parse-new解析PDF，添加更多选项
          const options = {
            // 最大页面数限制，避免过大文件
            max: 50,
            // 版本号，确保兼容性
            version: 'v1.10.100'
          };
          
          const pdfData = await pdfParse(buffer, options);
          const rawText = pdfData.text;
          
          console.log('PDF原始提取文本长度:', rawText.length);
          console.log('PDF页数信息:', pdfData.numpages);
          console.log('PDF信息:', JSON.stringify(pdfData.info, null, 2));
          
          // 改进文本处理
          extractedText = processPdfText(rawText);
          
          console.log('PDF处理后文本长度:', extractedText.length);
          console.log('PDF处理后文本预览:', extractedText.substring(0, 300));
          
          if (!extractedText.trim()) {
            throw new Error('PDF文件中未找到可读取的文本内容');
          }
        } catch (pdfError) {
          console.error('PDF解析具体错误:', pdfError);
          throw new Error(`PDF解析失败: ${pdfError instanceof Error ? pdfError.message : '未知错误'}`);
        }
      } else if (
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileName.endsWith('.docx') ||
        (fileType === 'application/zip' && fileName.endsWith('.docx')) ||
        (fileType === '' && fileName.endsWith('.docx'))
      ) {
        console.log('开始处理Word文档:', { fileName, fileType, size: file.size });
        
        if (!mammoth) {
          throw new Error('Word解析库加载失败');
        }
        
        // 处理Word文档(.docx)
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        console.log('Word文档buffer大小:', buffer.length);
        
        // 尝试使用不同的方法提取文本
        let result;
        try {
          // 首先尝试extractRawText
          result = await mammoth.extractRawText({ buffer });
          extractedText = result.value;
        } catch (extractError) {
          console.log('extractRawText失败，尝试convertToHtml:', extractError);
          // 如果extractRawText失败，尝试convertToHtml然后提取文本
          const htmlResult = await mammoth.convertToHtml({ buffer });
          // 简单地去除HTML标签来获取文本
          extractedText = htmlResult.value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          result = htmlResult;
        }
        
        console.log('Word文档提取的原始文本长度:', extractedText.length);
        console.log('Word文档提取的文本预览:', extractedText.substring(0, 200));
        
        // 检查是否有警告信息
        if (result.messages && result.messages.length > 0) {
          console.log('Word文档解析警告:', result.messages);
        }
        
        if (!extractedText.trim()) {
          throw new Error('Word文档中未找到可读取的文本内容');
        }
      } else if (
        fileType === 'application/msword' ||
        fileName.endsWith('.doc')
      ) {
        return NextResponse.json(
          { error: { message: '暂不支持旧版Word文档(.doc)格式，请转换为.docx格式后重试' } },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { error: { message: '不支持的文件格式。请上传PDF(.pdf)或Word文档(.docx)文件' } },
          { status: 400 }
        );
      }
    } catch (parseError) {
      console.error('文件解析错误:', parseError);
      console.error('文件信息:', {
        name: file.name,
        type: file.type,
        size: file.size
      });
      return NextResponse.json(
        { error: { message: `文件解析失败: ${parseError instanceof Error ? parseError.message : '未知错误'}` } },
        { status: 400 }
      );
    }

    // 记录提取的原始文本用于调试
    console.log('最终提取的文本长度:', extractedText.length);
    console.log('最终提取的文本内容（前500字符）:', extractedText.substring(0, 500));
    
    // 检查文本中的日文字符
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    const hasJapanese = japaneseRegex.test(extractedText);
    console.log('原始文本中是否包含日文字符:', hasJapanese);
    if (hasJapanese) {
      const japaneseMatches = extractedText.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g);
      console.log('找到的日文字符示例:', japaneseMatches ? japaneseMatches.slice(0, 10) : '无');
    }
    
    // 如果提取的文本过长，进行截断处理
    const maxLength = 50000; // 限制最大文本长度
    if (extractedText.length > maxLength) {
      extractedText = extractedText.substring(0, maxLength) + '\n...(文本过长，已截断)';
    }
    
    // 如果用户只想要原始文本而不经过AI处理，可以直接返回
    if (prompt && prompt.includes('RETURN_RAW_TEXT')) {
      return NextResponse.json({
        choices: [{
          message: {
            content: extractedText
          }
        }]
      });
    }


    // 使用AI进行文本优化和日语提取
    const defaultPrompt = `请从以下文档内容中提取并整理文字，并进行以下处理：

1. 首先提取所有日文文字内容（平假名、片假名、汉字）
2. 如果有日文内容，请：
   - 保持日文句子的自然分段和完整性
   - 去除多余的空白和换行符，但保持段落结构
   - 确保语句的连贯性和可读性
3. 如果文档中没有日文内容，请提取文档的主要文字内容并说明："此文档不包含日文内容，以下是提取的文档内容："
4. 如果文档完全无法读取或为空，请说明："无法从此文档中提取到可读的文字内容"

文档内容：
${extractedText}`;

    // 估算输入TOKEN数量
    const fileTokens = 1000; // 文件处理固定消耗
    const promptTokens = tokenUsageService.estimateTokens(prompt || defaultPrompt).inputTokens;
    const totalInputTokens = fileTokens + promptTokens;

    // 构建发送到Gemini API的请求（native格式）
    const payload = {
      contents: [{
        parts: [{ text: prompt || defaultPrompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.1,
        maxOutputTokens: 4096,
      }
    };

    // 使用API客户端发送请求，支持多KEY自动切换
    const result = await apiClient.makeRequest({
      url: effectiveApiUrl,
      method: 'POST',
      body: payload
    }, userApiKey);

    if (!result.success) {
      console.error('AI API error (File):', result.error);
      
      // 记录失败的TOKEN使用量
      if (currentUser?.userId) {
        try {
          await tokenUsageService.recordTokenUsage({
            userId: currentUser.userId,
            apiEndpoint: 'file-to-text',
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
      // 暂时不支持文件的流式处理，返回错误
      return NextResponse.json(
        { error: { message: '文件处理暂不支持流式响应' } },
        { status: 400 }
      );
    } else {
      // 非流式输出，转换响应格式
      const geminiResponse = result.data as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
      };
      
      // 从Gemini响应中提取文本
      let extractedAiText = '';
      if (geminiResponse.candidates && geminiResponse.candidates[0] && geminiResponse.candidates[0].content) {
        const parts = geminiResponse.candidates[0].content.parts;
        if (parts && parts[0] && parts[0].text) {
          extractedAiText = parts[0].text;
        }
      }
      
      // 记录AI处理结果用于调试
      if (extractedAiText) {
        console.log('AI处理后的响应长度:', extractedAiText.length);
        console.log('AI处理后的响应内容（前300字符）:', extractedAiText.substring(0, 300));
        
        // 检查AI响应中的日文字符
        const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
        const aiHasJapanese = japaneseRegex.test(extractedAiText);
        console.log('AI响应中是否包含日文字符:', aiHasJapanese);
      }
      
      // 记录成功的TOKEN使用量
      if (currentUser?.userId) {
        const outputTokens = tokenUsageService.estimateTokens(extractedAiText).inputTokens;
        try {
          await tokenUsageService.recordTokenUsage({
            userId: currentUser.userId,
            apiEndpoint: 'file-to-text',
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
            content: extractedAiText || '文件文字提取失败：未找到有效的文字内容'
          }
        }]
      };
      
      return NextResponse.json(compatibleResponse);
    }
  } catch (error) {
    console.error('Server error (File):', error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : '服务器错误' } },
      { status: 500 }
    );
  }
}