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
  const [showHtmlModal, setShowHtmlModal] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');

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
    
    let formattedText = text
      .replace(/\n/g, '<br />')
      .replace(/【([^】]+)】/g, '<strong class="text-indigo-600">$1</strong>')
      .replace(/「([^」]+)」/g, '<strong class="text-indigo-600">$1</strong>');
    
    // 为日语例句添加furigana支持
    // 匹配"漢字（ひらがな）"格式并转换为ruby标签（全角括号）
    formattedText = formattedText.replace(/([一-龯々〇ヶ]+)（([ぁ-ゖゝゞァ-ヺー]+)）/g, '<ruby>$1<rt>$2</rt></ruby>');
    
    // 匹配"漢字(ひらがな)"格式（半角括号）
    formattedText = formattedText.replace(/([一-龯々〇ヶ]+)\(([ぁ-ゖゝゞァ-ヺー]+)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    
    // 也支持片假名读音
    formattedText = formattedText.replace(/([一-龯々〇ヶ]+)（([ァ-ヺー]+)）/g, '<ruby>$1<rt>$2</rt></ruby>');
    formattedText = formattedText.replace(/([一-龯々〇ヶ]+)\(([ァ-ヺー]+)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    
    return { __html: formattedText };
  };

  const handleCopy = async () => {
    const plainText = tokens.map(token => token.pos === '改行' ? '\n' : token.word).join('');
    let contentToCopy: string;
    let isHtml = false;

    if (showFurigana) {
      isHtml = true;
      contentToCopy = tokens.map((token) => {
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

    try {
      if (isHtml) {
        // 显示自定义弹窗供用户复制HTML代码
        setHtmlContent(contentToCopy);
        setShowHtmlModal(true);
      } else {
        // 复制纯文本
        const textarea = document.createElement('textarea');
        textarea.value = contentToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }
    } catch (err) {
      console.error('复制失败:', err);
      alert('复制功能不可用');
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
          <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>解析结果</h2>
          <button 
            onClick={handleCopy} 
            className="p-2 rounded-full transition-all duration-200" 
            style={{
              backgroundColor: isCopied ? '#22c55e' : 'var(--button-bg)',
              color: isCopied ? 'white' : 'var(--button-text)'
            }}
            onMouseEnter={(e) => {
              if (!isCopied) {
                e.currentTarget.style.backgroundColor = 'var(--button-hover-bg)';
                e.currentTarget.style.color = 'var(--button-hover-text)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isCopied) {
                e.currentTarget.style.backgroundColor = 'var(--button-bg)';
                e.currentTarget.style.color = 'var(--button-text)';
              }
            }}
            title={isCopied ? "已复制!" : (showFurigana ? "以带注音的HTML格式复制" : "以纯文本格式复制")}
          >
            {isCopied ? <FaCheck /> : <FaCopy />}
          </button>
        </div>
        <div className="flex items-center">
          <label htmlFor="furiganaToggle" className="text-sm font-medium mr-2" style={{ color: 'var(--text-secondary)' }}>显示假名:</label>
          <label className="inline-flex items-center cursor-pointer">
            <input type="checkbox" id="furiganaToggle" className="sr-only peer" checked={showFurigana} onChange={(e) => onShowFuriganaChange(e.target.checked)} />
            <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
      <div id="analyzedSentenceOutput" className="mb-2 p-3 rounded-lg min-h-[70px]" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}>
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
      
      <p className="text-sm italic mt-3" style={{ color: 'var(--text-tertiary)' }}>点击词汇查看详细释义。悬停词汇可查看词性。</p>
      
      {/* HTML复制弹窗 */}
      {showHtmlModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowHtmlModal(false)}>
          <div className="rounded-lg p-8 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto" 
               style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }} 
               onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Ruby HTML 代码</h3>
              <button 
                onClick={() => setShowHtmlModal(false)}
                className="text-xl"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
              >
                ×
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>请复制以下HTML代码在支持Ruby标签的编辑器中使用：</p>
              <textarea 
                className="w-full h-48 p-3 border rounded text-sm font-mono resize-none focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-secondary)', 
                  color: 'var(--text-primary)'
                }}
                value={htmlContent}
                readOnly
                onClick={(e) => e.currentTarget.select()}
              />
            </div>
            
            <div className="mb-4 p-3 border rounded" style={{ borderColor: 'var(--border-secondary)', backgroundColor: 'var(--bg-secondary)' }}>
              <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>预览效果：</p>
              <div 
                className="text-base leading-relaxed"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  const copyWithFallback = () => {
                    try {
                      const modal = document.querySelector('.fixed.inset-0');
                      const textarea = modal?.querySelector('textarea');
                      if (textarea) {
                        textarea.focus();
                        textarea.select();
                        textarea.setSelectionRange(0, textarea.value.length);
                        const success = document.execCommand('copy');
                        if (success) {
                          setIsCopied(true);
                          setTimeout(() => setIsCopied(false), 2000);
                          setShowHtmlModal(false);
                        } else {
                          alert('复制失败，请手动选择文本复制');
                        }
                      }
                    } catch {
                      alert('复制失败，请手动选择文本复制');
                    }
                  };

                  try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      navigator.clipboard.writeText(htmlContent).then(() => {
                        setIsCopied(true);
                        setTimeout(() => setIsCopied(false), 2000);
                        setShowHtmlModal(false);
                      }).catch(() => {
                        copyWithFallback();
                      });
                    } else {
                      copyWithFallback();
                    }
                  } catch {
                    copyWithFallback();
                  }
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                复制HTML代码
              </button>
              <button
                onClick={() => setShowHtmlModal(false)}
                className="px-4 py-2 rounded focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--button-bg)', 
                  color: 'var(--button-text)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--button-hover-bg)';
                  e.currentTarget.style.color = 'var(--button-hover-text)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--button-bg)';
                  e.currentTarget.style.color = 'var(--button-text)';
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}