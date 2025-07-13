'use client';

import { useState, useEffect, useCallback } from 'react';
import { containsKanji, getPosClass, posChineseMap, speakJapanese, generateFuriganaParts } from '../utils/helpers';
import { getWordDetails, TokenData, WordDetail } from '../services/api';
import { FaVolumeUp, FaCopy, FaCheck } from 'react-icons/fa';

interface AnalysisResultProps {
  tokens: TokenData[];
  originalSentence: string;
  userApiKey?: string;
  userApiUrl?: string;
  showFurigana: boolean;
  onShowFuriganaChange: (show: boolean) => void;
}

export default function AnalysisResult({
  tokens,
  originalSentence,
  userApiKey,
  userApiUrl,
  showFurigana,
  onShowFuriganaChange
}: AnalysisResultProps) {
  const [wordDetail, setWordDetail] = useState<WordDetail | null>(null);
  const [activeWordToken, setActiveWordToken] = useState<HTMLElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => setIsMobile(window.innerWidth <= 768);
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const handleWordClick = async (e: React.MouseEvent<HTMLSpanElement>, token: TokenData) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    
    if (activeWordToken === target) {
      setActiveWordToken(null);
      setWordDetail(null);
      if (isMobile) setIsModalOpen(false);
      return;
    }

    if (activeWordToken) activeWordToken.classList.remove('active-word');
    target.classList.add('active-word');
    setActiveWordToken(target);
    
    setIsLoading(true);
    if (isMobile) setIsModalOpen(true);
    
    try {
      const details = await getWordDetails(token.word, token.pos, originalSentence, token.furigana, token.romaji, userApiKey, userApiUrl);
      setWordDetail(details);
    } catch (error) {
      console.error('Error fetching word details:', error);
      setWordDetail({ 
        originalWord: token.word, 
        pos: token.pos, 
        furigana: (token.furigana && token.furigana !== token.word && containsKanji(token.word)) ? token.furigana : '', 
        romaji: token.romaji || '', 
        dictionaryForm: '', 
        chineseTranslation: '错误', 
        explanation: `查询释义时发生错误: ${error instanceof Error ? error.message : '未知错误'}。`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseWordDetail = useCallback(() => {
    if (activeWordToken) {
      activeWordToken.classList.remove('active-word');
      setActiveWordToken(null);
    }
    setWordDetail(null);
    setIsModalOpen(false);
  }, [activeWordToken]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const wordDetailElement = document.getElementById('wordDetailInlineContainer') || document.getElementById('wordDetailModal');
      if (activeWordToken && !activeWordToken.contains(event.target as Node) && wordDetailElement && !wordDetailElement.contains(event.target as Node)) {
        handleCloseWordDetail();
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeWordToken, handleCloseWordDetail]);

  const handleWordSpeak = (word: string) => {
    try {
      speakJapanese(word);
    } catch (error) {
      console.error('朗读失败:', error);
    }
  };

  const formatExplanation = (text: string | undefined): { __html: string } => {
    if (!text) return { __html: '' };
    const formattedText = text
      .replace(/\n/g, '<br />')
      .replace(/【([^】]+)】/g, '<strong class="text-indigo-600">$1</strong>')
      .replace(/「([^」]+)」/g, '<strong class="text-indigo-600">$1</strong>');
    return { __html: formattedText };
  };

  const handleCopy = async () => {
    const plainText = tokens.map(token => token.pos === '改行' ? '\n' : token.word).join('');
    let contentToCopy: string;
    let isHtml = false;

    if (showFurigana) {
      isHtml = true;
      contentToCopy = tokens.map((token, index) => {
        if (token.pos === '改行') return '<br>';
        const shouldUseFurigana = token.furigana && token.furigana !== token.word && containsKanji(token.word) && token.pos !== '記号';
        
        if (shouldUseFurigana && token.furigana) {
          const parts = generateFuriganaParts(token.word, token.furigana);
          const rubyHtml = parts
            .map(part => part.ruby ? `<ruby>${part.base}<rt>${part.ruby}</rt></ruby>` : part.base)
            .join('');
          return rubyHtml;
        }
        return token.word;
      }).join('');
    } else {
      contentToCopy = plainText;
    }

    console.log('复制内容:', showFurigana ? 'HTML格式' : '纯文本格式');

    // 检查是否支持现代Clipboard API
    const hasClipboardAPI = navigator.clipboard && navigator.clipboard.write && navigator.clipboard.writeText;
    
    if (hasClipboardAPI) {
      try {
        if (isHtml) {
          console.log('尝试使用Clipboard API复制HTML...');
          const blobHtml = new Blob([contentToCopy], { type: 'text/html' });
          const blobText = new Blob([plainText], { type: 'text/plain' });
          await navigator.clipboard.write([new ClipboardItem({ 
            'text/html': blobHtml, 
            'text/plain': blobText 
          })]);
          console.log('Clipboard API复制成功');
        } else {
          console.log('复制纯文本...');
          await navigator.clipboard.writeText(contentToCopy);
        }
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        return;
      } catch (e) {
        console.warn('Clipboard API 失败，回退到旧方法。', e);
      }
    } else {
      console.log('Clipboard API 不可用，直接使用回退方案');
    }

    // 回退方案
    if (isHtml) {
        console.log('使用回退方案复制HTML...');
        console.log('HTML内容:', contentToCopy);
        
        // 方法1: 尝试使用可编辑div复制HTML格式
        try {
          const div = document.createElement('div');
          div.innerHTML = contentToCopy;
          div.style.position = 'fixed';
          div.style.left = '-9999px';
          div.style.top = '-9999px';
          div.contentEditable = 'true';
          document.body.appendChild(div);
          
          // 设置焦点并选择所有内容
          div.focus();
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(div);
          selection?.removeAllRanges();
          selection?.addRange(range);
          
          console.log('选择的内容:', selection?.toString());
          console.log('div innerHTML:', div.innerHTML);
          
          const success = document.execCommand('copy');
          console.log('第一次复制尝试 success:', success);
          
          document.body.removeChild(div);
          
          if (success) {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
            return;
          }
        } catch (err1) {
          console.warn('方法1失败:', err1);
        }
        
        // 方法2: 如果第一种方法失败，提示用户手动复制HTML
        console.log('方法1失败，提供HTML代码供用户手动复制');
        
        // 创建一个弹窗显示HTML代码
        const confirmed = confirm(
          `自动复制HTML格式失败。点击确定查看HTML代码，您可以手动复制：\n\n${contentToCopy.substring(0, 100)}${contentToCopy.length > 100 ? '...' : ''}`
        );
        
        if (confirmed) {
          // 显示完整的HTML代码
          const htmlWindow = window.open('', '_blank', 'width=600,height=400');
          if (htmlWindow) {
            htmlWindow.document.write(`
              <html>
                <head>
                  <title>Ruby HTML 代码</title>
                  <style>
                    body { font-family: monospace; padding: 20px; }
                    .html-code { background: #f5f5f5; padding: 15px; border: 1px solid #ddd; margin: 10px 0; word-break: break-all; }
                    .preview { border: 1px solid #ccc; padding: 15px; margin: 10px 0; }
                    button { padding: 10px 20px; margin: 5px; cursor: pointer; }
                  </style>
                </head>
                <body>
                  <h2>带Ruby标签的HTML代码：</h2>
                  <div class="html-code" id="htmlCode">${contentToCopy}</div>
                  <button onclick="navigator.clipboard.writeText(document.getElementById('htmlCode').textContent).then(() => alert('HTML代码已复制到剪贴板！')).catch(() => alert('复制失败，请手动选择复制'))">复制HTML代码</button>
                  
                  <h2>预览效果：</h2>
                  <div class="preview">${contentToCopy}</div>
                  
                  <h2>使用说明：</h2>
                  <p>1. 点击"复制HTML代码"按钮复制HTML格式的文本</p>
                  <p>2. 在支持HTML的编辑器中粘贴（如富文本编辑器、HTML编辑器等）</p>
                  <p>3. Ruby标签将正确显示假名注音</p>
                </body>
              </html>
            `);
            htmlWindow.document.close();
          }
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
          return;
        }
        
        // 方法3: 最后回退到纯文本
        console.log('HTML复制失败，使用纯文本回退');
        const textarea = document.createElement('textarea');
        textarea.value = plainText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        } catch (textErr) {
          console.error('纯文本复制也失败:', textErr);
          alert('复制功能在此浏览器中不受支持。');
        } finally {
          document.body.removeChild(textarea);
        }
      } else {
        // 纯文本复制的原有逻辑
        const textarea = document.createElement('textarea');
        textarea.value = contentToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
          console.error('后备复制方案失败:', err);
          alert('复制功能在此浏览器中不受支持。');
        } finally {
          document.body.removeChild(textarea);
        }
      }
  };

  const WordDetailContent = () => wordDetail && (
    <>
      <h3 className="text-xl font-semibold text-[#007AFF] mb-3">词汇详解</h3>
      <p className="mb-1">
        <strong>原文:</strong> 
        <span className="font-mono text-lg text-gray-800">{wordDetail.originalWord}</span> 
        <button className="read-aloud-button" title="朗读此词汇" onClick={() => handleWordSpeak(wordDetail.originalWord)}>
          <FaVolumeUp />
        </button>
      </p>
      {wordDetail.furigana && <p className="mb-1"><strong>读音:</strong> <span className="text-sm text-purple-700">{wordDetail.furigana}</span></p>}
      {wordDetail.romaji && <p className="mb-1"><strong>罗马音:</strong> <span className="text-sm text-cyan-700">{wordDetail.romaji}</span></p>}
      {wordDetail.dictionaryForm && wordDetail.dictionaryForm !== wordDetail.originalWord && <p className="mb-2"><strong>辞书形:</strong> <span className="text-md text-blue-700 font-medium">{wordDetail.dictionaryForm}</span></p>}
      <p className="mb-2"><strong>词性:</strong> <span className={`detail-pos-tag ${getPosClass(wordDetail.pos)}`}>{wordDetail.pos} ({posChineseMap[wordDetail.pos.split('-')[0]] || posChineseMap['default']})</span></p>
      <p className="mb-2"><strong>中文译文:</strong> <span className="text-lg text-green-700 font-medium">{wordDetail.chineseTranslation}</span></p>
      <div className="mb-1"><strong>解释:</strong></div>
      <div className="text-gray-700 bg-gray-50 p-3 rounded-md text-base leading-relaxed" dangerouslySetInnerHTML={formatExplanation(wordDetail.explanation)} />
    </>
  );

  if (!tokens || tokens.length === 0) return null;

  return (
    <div className="premium-card">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold text-gray-700">解析结果</h2>
          <button onClick={handleCopy} className={`p-2 rounded-full transition-all duration-200 ${isCopied ? 'bg-green-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`} title={isCopied ? "已复制!" : (showFurigana ? "以带注音的HTML格式复制" : "以纯文本格式复制")}>
            {isCopied ? <FaCheck /> : <FaCopy />}
          </button>
        </div>
        <div className="flex items-center">
          <label htmlFor="furiganaToggle" className="text-sm font-medium text-gray-700 mr-2">显示假名:</label>
          <label className="inline-flex items-center cursor-pointer">
            <input type="checkbox" id="furiganaToggle" className="sr-only peer" checked={showFurigana} onChange={(e) => onShowFuriganaChange(e.target.checked)} />
            <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
      <div id="analyzedSentenceOutput" className="text-gray-800 mb-2 p-3 bg-gray-50 rounded-lg min-h-[70px]">
        {tokens.map((token, index) => 
          token.pos === '改行' ? <br key={index} /> : (
            <span key={index} className="word-unit-wrapper tooltip">
              <span className={`word-token ${getPosClass(token.pos)}`} onClick={(e) => handleWordClick(e, token)}>
                {showFurigana && token.furigana && token.furigana !== token.word && containsKanji(token.word) && token.pos !== '記号'
                  ? generateFuriganaParts(token.word, token.furigana).map((part, i) =>
                      part.ruby ? <ruby key={i}>{part.base}<rt>{part.ruby}</rt></ruby> : <span key={i}>{part.base}</span>
                    )
                  : token.word}
              </span>
              {token.romaji && token.pos !== '記号' && <span className="romaji-text">{token.romaji}</span>}
              <span className="tooltiptext">{posChineseMap[token.pos.split('-')[0]] || posChineseMap['default']}</span>
            </span>
          )
        )}
      </div>
      
      {!isMobile && (isLoading || wordDetail) && (
        <div id="wordDetailInlineContainer" className="relative mt-4 p-4 border rounded-lg bg-white shadow-md">
          <button className="detail-close-button" title="关闭详情" onClick={handleCloseWordDetail}>&times;</button>
          {isLoading ? <div className="flex items-center justify-center py-5"><div className="loading-spinner"></div><span className="ml-2 text-gray-600">正在查询释义...</span></div> : <WordDetailContent />}
        </div>
      )}
      
      {isMobile && isModalOpen && (
        <div id="wordDetailModal" className="word-detail-modal" onClick={(e) => { if (e.target === e.currentTarget) handleCloseWordDetail(); }}>
          <div className="word-detail-modal-content">
            <button className="modal-close-button" title="关闭详情" onClick={handleCloseWordDetail}>&times;</button>
            {isLoading ? <div className="flex items-center justify-center py-5"><div className="loading-spinner"></div><span className="ml-2 text-gray-600">正在查询释义...</span></div> : <WordDetailContent />}
          </div>
        </div>
      )}
      
      <p className="text-sm text-gray-500 italic mt-3">点击词汇查看详细释义。悬停词汇可查看词性。</p>
    </div>
  );
}