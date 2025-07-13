import { NextRequest, NextResponse } from 'next/server';

// 静态导入以避免动态导入问题
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfParse: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mammoth: any = null;

// 延迟加载库
async function loadLibraries() {
  try {
    if (!pdfParse) {
      // 使用pdf-parse-new库
      pdfParse = (await import('pdf-parse-new')).default;
    }
    if (!mammoth) {
      mammoth = await import('mammoth');
    }
  } catch (error) {
    console.error('加载文档解析库失败:', error);
    throw error;
  }
}

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

// API密钥从环境变量获取，不暴露给前端
const API_KEY = process.env.API_KEY || '';
const API_URL = process.env.API_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const MODEL_NAME = "gemini-2.5-flash-preview-05-20";

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
    // 解析multipart/form-data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const prompt = formData.get('prompt') as string;
    const model = formData.get('model') as string || MODEL_NAME;
    const apiUrl = formData.get('apiUrl') as string;
    const stream = formData.get('stream') === 'true';
    
    // 从请求头中获取用户提供的API密钥（如果有）
    const authHeader = req.headers.get('Authorization');
    const userApiKey = authHeader ? authHeader.replace('Bearer ', '') : '';
    
    // 优先使用用户API密钥，如果没有则使用环境变量中的密钥
    const effectiveApiKey = userApiKey || API_KEY;
    
    // 优先使用用户提供的API URL，否则使用环境变量中的URL
    const effectiveApiUrl = apiUrl || API_URL;
    
    if (!effectiveApiKey) {
      return NextResponse.json(
        { error: { message: '未提供API密钥，请在设置中配置API密钥或联系管理员配置服务器密钥' } },
        { status: 500 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: { message: '缺少必要的文件数据' } },
        { status: 400 }
      );
    }

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
      // 先加载必要的库
      await loadLibraries();
      
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
    const defaultPrompt = `请从以下文档内容中提取所有日文文字，并进行以下处理：
1. 只保留日文文字内容（平假名、片假名、汉字）
2. 去除多余的空白和换行符
3. 保持句子的自然分段
4. 如果没有日文内容，请说明"未找到日文内容"

文档内容：
${extractedText}`;

    // 构建发送到AI服务的请求
    const payload = {
      model: model,
      reasoning_effort: "none",
      stream: stream,
      messages: [
        {
          role: "user",
          content: prompt || defaultPrompt
        }
      ]
    };

    // 发送到实际的AI API
    const response = await fetch(effectiveApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${effectiveApiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: '无法解析错误响应' };
      }
      
      console.error('AI API error (File):', errorData);
      return NextResponse.json(
        { error: errorData.error || { message: '处理文件请求时出错' } },
        { status: response.status }
      );
    }

    // 处理流式响应
    if (stream) {
      const readableStream = response.body;
      if (!readableStream) {
        return NextResponse.json(
          { error: { message: '流式响应创建失败' } },
          { status: 500 }
        );
      }

      // 创建一个新的流式响应
      return new NextResponse(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    } else {
      // 非流式输出，按原来方式处理
      // 获取AI API的响应
      let data;
      try {
        const responseText = await response.text();
        try {
          data = JSON.parse(responseText);
        } catch {
          console.error('Failed to parse API response:', responseText.substring(0, 200) + '...');
          return NextResponse.json(
            { error: { message: '无法解析API响应，请稍后重试' } },
            { status: 500 }
          );
        }
      } catch (readError) {
        console.error('Failed to read API response:', readError);
        return NextResponse.json(
          { error: { message: '读取API响应时出错，请稍后重试' } },
          { status: 500 }
        );
      }

      // 将AI API的响应传回给客户端
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('Server error (File):', error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : '服务器错误' } },
      { status: 500 }
    );
  }
}