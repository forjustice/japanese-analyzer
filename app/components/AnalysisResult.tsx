'use client';

import { useState, useCallback } from 'react';
import { containsKanji, getPosClass, posChineseMap, speakJapanese, speakJapaneseWithTTS, generateFuriganaParts } from '../utils/helpers';
import { getWordDetails, TokenData, WordDetail } from '../services/api';
import { FaVolumeUp, FaCopy, FaCheck } from 'react-icons/fa';

// --- 类型定义 ---
interface AnalysisResultProps {
  tokens: TokenData[];
  originalSentence: string;
  userApiKey?: string;
  userApiUrl?: string;
  showFurigana: boolean;
  onShowFuriganaChange: (show: boolean) => void;
  ttsProvider?: 'system' | 'gemini';
}

// --- 子组件 ---

/**
 * 顶部工具栏，包含复制和显示假名开关
 */
const AnalysisToolbar = ({
  isCopied,
  showFurigana,
  onCopy,
  onShowFuriganaChange,
}: {
  isCopied: boolean;
  showFurigana: boolean;
  onCopy: () => void;
  onShowFuriganaChange: (checked: boolean) => void;
}) => (
  <div className="flex justify-between items-center mb-4">
    <div className="flex items-center gap-2">
      <h2 className="text-2xl font-semibold text-foreground">解析结果</h2>
      <button
        onClick={onCopy}
        className={`p-2 rounded-full transition-all duration-200 ${
          isCopied
            ? 'bg-green-500 text-white'
            : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
        title={isCopied ? "已复制!" : (showFurigana ? "以带注音的HTML格式复制" : "以纯文本格式复制")}
      >
        {isCopied ? <FaCheck /> : <FaCopy />}
      </button>
    </div>
    <div className="flex items-center">
      <label htmlFor="furiganaToggle" className="text-sm font-medium mr-2 text-foreground">显示假名:</label>
      <label className="inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          id="furiganaToggle"
          className="sr-only peer"
          checked={showFurigana}
          onChange={(e) => onShowFuriganaChange(e.target.checked)}
        />
        <div className="relative w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ring/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
      </label>
    </div>
  </div>
);

/**
 * 渲染解析后的句子
 */
const AnalyzedSentence = ({
  tokens,
  showFurigana,
  onWordClick,
}: {
  tokens: TokenData[];
  showFurigana: boolean;
  onWordClick: (e: React.MouseEvent<HTMLSpanElement>, token: TokenData) => void;
}) => (
  <div id="analyzedSentenceOutput" className="mb-2 p-3 rounded-lg min-h-[70px] text-foreground bg-muted whitespace-pre-wrap">
    {tokens.map((token, index) => {
      // 处理换行符
      if (token.pos === '改行' || token.word === '\n') {
        return <br key={index} />;
      }
      
      return (
        <span key={index} className="word-unit-wrapper tooltip">
          <span className={`word-token ${getPosClass(token.pos)}`} onClick={(e) => onWordClick(e, token)}>
            {showFurigana && token.furigana && token.furigana !== token.word && containsKanji(token.word) && token.pos !== '记号'
              ? (() => {
                  try {
                    return generateFuriganaParts(token.word, token.furigana).map((part, i) =>
                      part.ruby ? <ruby key={i}>{part.base}<rt>{part.ruby}</rt></ruby> : <span key={i}>{part.base}</span>
                    );
                  } catch (error) {
                    console.error('生成注音失败:', error, token);
                    return token.word; // 错误时回退到原文
                  }
                })()
              : token.word}
          </span>
          {token.romaji && token.pos !== '记号' && <span className="romaji-text">{token.romaji}</span>}
          <span className="tooltiptext">{posChineseMap[token.pos.split('-')[0]] || posChineseMap['default']}</span>
        </span>
      );
    })}
  </div>
);


/**
 * 用于复制带注音的HTML的弹窗
 */
const HtmlCopyModal = ({
  htmlContent,
  onClose,
  onCopy,
}: {
  htmlContent: string;
  onClose: () => void;
  onCopy: () => void;
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
    <div
      className="rounded-lg p-8 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Ruby HTML 代码</h3>
        <button onClick={onClose} className="text-xl text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">×</button>
      </div>
      <div className="mb-4">
        <p className="text-sm mb-2 text-gray-700 dark:text-gray-300">请复制以下HTML代码在支持Ruby标签的编辑器中使用：</p>
        <textarea
          className="w-full h-48 p-3 border rounded text-sm font-mono resize-none focus:outline-none focus:ring-2 bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
          value={htmlContent}
          readOnly
          onClick={(e) => e.currentTarget.select()}
        />
      </div>
      <div className="mb-4 p-3 border rounded border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
        <p className="text-sm mb-2 text-gray-700 dark:text-gray-300">预览效果：</p>
        <div className="text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: htmlContent }} />
      </div>
      <div className="flex justify-end space-x-3">
        <button onClick={onCopy} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
          复制HTML代码
        </button>
        <button onClick={onClose} className="px-4 py-2 rounded focus:outline-none focus:ring-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
          关闭
        </button>
      </div>
    </div>
  </div>
);

/**
 * 底部弹出的词汇详解模态框
 */
const WordDetailModal = ({
  wordDetail,
  isLoading,
  isVisible,
  onClose,
  ttsProvider = 'gemini'
}: {
  wordDetail: WordDetail | null;
  isLoading: boolean;
  isVisible: boolean;
  onClose: () => void;
  ttsProvider?: 'system' | 'gemini';
}) => {
  const formatExplanation = (text: string | undefined): { __html: string } => {
    if (!text) return { __html: '' };
    const formattedText = text
      // 处理md标记符号
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>') // **粗体**
      .replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>') // *斜体*
      .replace(/`([^`]+)`/g, '<code class="bg-gray-200 dark:bg-gray-600 px-1 rounded text-sm">$1</code>') // `代码`
      .replace(/###\s*([^\n]+)/g, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>') // ### 三级标题
      .replace(/##\s*([^\n]+)/g, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>') // ## 二级标题
      .replace(/#\s*([^\n]+)/g, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>') // # 一级标题
      .replace(/^\s*[\-\*\+]\s+(.+)$/gm, '<li class="ml-4">• $1</li>') // - 列表项
      .replace(/^\s*\d+\.\s+(.+)$/gm, '<li class="ml-4">$1</li>') // 1. 数字列表项
      // 换行处理
      .replace(/\n/g, '<br />')
      // 日语特殊标记
      .replace(/【([^】]+)】/g, '<strong class="text-indigo-600 dark:text-indigo-400">$1</strong>')
      .replace(/「([^」]+)」/g, '<span class="text-blue-600 dark:text-blue-400 font-medium">$1</span>')
      // 假名注音
      .replace(/([一-龯々〇ヶ]+)（([ぁ-ゖゝゞァ-ヺー]+)）/g, '<ruby>$1<rt>$2</rt></ruby>')
      .replace(/([一-龯々〇ヶ]+)\(([ぁ-ゖゝゞァ-ヺー]+)\)/g, '<ruby>$1<rt>$2</rt></ruby>')
      .replace(/([一-龯々〇ヶ]+)（([ァ-ヺー]+)）/g, '<ruby>$1<rt>$2</rt></ruby>')
      .replace(/([一-龯々〇ヶ]+)\(([ァ-ヺー]+)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    return { __html: formattedText };
  };

  const handleWordSpeak = async (word: string) => {
    try {
      if (ttsProvider === 'gemini') {
        await speakJapaneseWithTTS(word);
      } else {
        speakJapanese(word);
      }
    } catch (error) {
      console.error('朗读失败:', error);
    }
  };

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 ${isVisible ? 'block' : 'hidden'}`}
      onClick={onClose}
    >
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black bg-opacity-50"></div>
      
      {/* 底部弹出的内容 */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-lg shadow-lg transform transition-transform duration-300 ease-out ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ height: '70vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 拖拽指示器 */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        </div>
        
        {/* 关闭按钮 */}
        <div className="flex justify-end px-4 pb-2">
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl font-semibold"
          >
            ×
          </button>
        </div>
        
        {/* 内容区域 */}
        <div className="px-6 pb-6 overflow-y-auto" style={{ height: 'calc(100% - 60px)' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="loading-spinner"></div>
              <span className="ml-2 text-gray-600 dark:text-gray-400">正在查询释义...</span>
            </div>
          ) : wordDetail ? (
            <>
              <h3 className="text-xl font-semibold text-blue-600 dark:text-blue-400 mb-4">词汇详解</h3>
              <div className="space-y-3">
                <p className="flex items-center">
                  <strong className="w-20 text-sm text-gray-700 dark:text-gray-300">原文:</strong>
                  <span className="font-mono text-lg text-gray-800 dark:text-gray-200">{wordDetail.originalWord}</span>
                  <button 
                    className="ml-2 p-1 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 transition-colors" 
                    title="朗读此词汇" 
                    onClick={() => handleWordSpeak(wordDetail.originalWord)}
                  >
                    <FaVolumeUp />
                  </button>
                </p>
                
                {wordDetail.furigana && (
                  <p className="flex items-center">
                    <strong className="w-20 text-sm text-gray-700 dark:text-gray-300">读音:</strong>
                    <span className="text-sm text-purple-700 dark:text-purple-400">{wordDetail.furigana}</span>
                  </p>
                )}
                
                {wordDetail.romaji && (
                  <p className="flex items-center">
                    <strong className="w-20 text-sm text-gray-700 dark:text-gray-300">罗马音:</strong>
                    <span className="text-sm text-cyan-700 dark:text-cyan-400">{wordDetail.romaji}</span>
                  </p>
                )}
                
                {wordDetail.dictionaryForm && wordDetail.dictionaryForm !== wordDetail.originalWord && (
                  <p className="flex items-center">
                    <strong className="w-20 text-sm text-gray-700 dark:text-gray-300">辞书形:</strong>
                    <span className="text-md text-blue-700 dark:text-blue-400 font-medium">{wordDetail.dictionaryForm}</span>
                  </p>
                )}
                
                <p className="flex items-center">
                  <strong className="w-20 text-sm text-gray-700 dark:text-gray-300">词性:</strong>
                  <span className={`detail-pos-tag ${getPosClass(wordDetail.pos)}`}>
                    {wordDetail.pos} ({posChineseMap[wordDetail.pos.split('-')[0]] || posChineseMap['default']})
                  </span>
                </p>
                
                <p className="flex items-center">
                  <strong className="w-20 text-sm text-gray-700 dark:text-gray-300">中文译文:</strong>
                  <span className="text-lg text-green-700 dark:text-green-400 font-medium">{wordDetail.chineseTranslation}</span>
                </p>
                
                {wordDetail.grammar && (
                  <div>
                    <strong className="text-sm text-gray-700 dark:text-gray-300">日语文法:</strong>
                    <div 
                      className="mt-2 text-gray-700 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md text-base leading-relaxed border-l-4 border-blue-400" 
                      dangerouslySetInnerHTML={formatExplanation(wordDetail.grammar)} 
                    />
                  </div>
                )}
                
                {wordDetail.examples && wordDetail.examples.length > 0 && (
                  <div>
                    <strong className="text-sm text-gray-700 dark:text-gray-300">例句:</strong>
                    <div className="mt-2 space-y-3">
                      {wordDetail.examples.map((example, index) => (
                        <div key={index} className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md border-l-4 border-green-400">
                          <div className="mb-2">
                            <span className="text-sm text-gray-600 dark:text-gray-400">日语:</span>
                            <div 
                              className="mt-1 text-lg leading-relaxed text-gray-800 dark:text-gray-200" 
                              dangerouslySetInnerHTML={{ __html: example.japanese }}
                            />
                            <button 
                              className="ml-2 p-1 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 transition-colors inline-flex" 
                              title="朗读例句" 
                              onClick={() => {
                                // 移除HTML标签用于朗读
                                const textOnly = example.japanese.replace(/<[^>]*>/g, '');
                                handleWordSpeak(textOnly);
                              }}
                            >
                              <FaVolumeUp />
                            </button>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">中文:</span>
                            <div className="mt-1 text-gray-700 dark:text-gray-300">{example.chinese}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div>
                  <strong className="text-sm text-gray-700 dark:text-gray-300">解释:</strong>
                  <div 
                    className="mt-2 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 p-3 rounded-md text-base leading-relaxed" 
                    dangerouslySetInnerHTML={formatExplanation(wordDetail.explanation)} 
                  />
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};


// --- 主组件 ---

export default function AnalysisResult({
  tokens,
  originalSentence,
  userApiKey,
  userApiUrl,
  showFurigana,
  onShowFuriganaChange,
  ttsProvider = 'gemini'
}: AnalysisResultProps) {
  const [wordDetail, setWordDetail] = useState<WordDetail | null>(null);
  const [activeWordToken, setActiveWordToken] = useState<HTMLElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showHtmlModal, setShowHtmlModal] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [showWordDetailModal, setShowWordDetailModal] = useState(false);

  const handleWordClick = async (e: React.MouseEvent<HTMLSpanElement>, token: TokenData) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;

    if (activeWordToken === target) {
      handleCloseWordDetail();
      return;
    }

    if (activeWordToken) activeWordToken.classList.remove('active-word');
    target.classList.add('active-word');
    setActiveWordToken(target);
    setIsLoading(true);
    setShowWordDetailModal(true);

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
    setShowWordDetailModal(false);
  }, [activeWordToken]);

  // 移除旧的点击外部关闭逻辑，因为现在使用模态框

  // 安全的剪贴板复制函数
  const safeCopyToClipboard = async (text: string): Promise<boolean> => {
    try {
      // 首先尝试使用现代的 Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      
      // 如果 Clipboard API 不可用，使用传统的 document.execCommand
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const result = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      return result;
    } catch (error) {
      console.error('复制失败:', error);
      return false;
    }
  };

  const handleCopy = async () => {
    if (showFurigana) {
      try {
        const html = tokens.map((token) => {
          if (token.pos === '改行' || token.word === '\n') return '<br>';
          const shouldUseFurigana = token.furigana && token.furigana !== token.word && containsKanji(token.word) && token.pos !== '记号';
          if (shouldUseFurigana && token.furigana) {
            try {
              return generateFuriganaParts(token.word, token.furigana)
                .map(part => part.ruby ? `<ruby>${part.base}<rt>${part.ruby}</rt></ruby>` : part.base)
                .join('');
            } catch (error) {
              console.error('生成注音失败:', error, token);
              return token.word; // 错误时回退到原文
            }
          }
          return token.word;
        }).join('');
        setHtmlContent(html);
        setShowHtmlModal(true);
      } catch (error) {
        console.error('生成HTML失败:', error);
        // 错误时回退到纯文本复制
        const plainText = tokens.map(token => token.pos === '改行' || token.word === '\n' ? '\n' : token.word).join('');
        const success = await safeCopyToClipboard(plainText);
        if (success) {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        }
      }
    } else {
      const plainText = tokens.map(token => token.pos === '改行' || token.word === '\n' ? '\n' : token.word).join('');
      const success = await safeCopyToClipboard(plainText);
      if (success) {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }
    }
  };

  const handleHtmlCopy = async () => {
    const success = await safeCopyToClipboard(htmlContent);
    if (success) {
      setIsCopied(true);
      setShowHtmlModal(false);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  if (!tokens || tokens.length === 0) return null;

  // 移动端和桌面端共享同一个详情视图，仅通过CSS控制其显示为内联或模态框
  // 注意：此简化方案需要您在CSS中添加对移动端的媒体查询来调整 #wordDetailContainer 的样式
  // 例如: @media (max-width: 768px) { #wordDetailContainer { position: fixed; ... } }
  return (
    <div className="premium-card">
      <AnalysisToolbar
        isCopied={isCopied}
        showFurigana={showFurigana}
        onCopy={handleCopy}
        onShowFuriganaChange={onShowFuriganaChange}
      />
      <AnalyzedSentence
        tokens={tokens}
        showFurigana={showFurigana}
        onWordClick={handleWordClick}
      />
      
      <p className="text-sm italic mt-3 text-gray-600 dark:text-gray-400">点击词汇查看详细释义。悬停词汇可查看词性。</p>
      
      {/* 底部弹出的词汇详解模态框 */}
      <WordDetailModal
        wordDetail={wordDetail}
        isLoading={isLoading}
        isVisible={showWordDetailModal}
        onClose={handleCloseWordDetail}
        ttsProvider={ttsProvider}
      />
      
      {showHtmlModal && (
        <HtmlCopyModal
          htmlContent={htmlContent}
          onClose={() => setShowHtmlModal(false)}
          onCopy={handleHtmlCopy}
        />
      )}
    </div>
  );
}
