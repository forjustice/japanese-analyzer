'use client';

import { useState, useEffect } from 'react';
import InputSection from './components/InputSection';
import AnalysisResult from './components/AnalysisResult';
import TranslationSection from './components/TranslationSection';
import SettingsModal from './components/SettingsModal';
import LoginModal from './components/LoginModal';
import { analyzeSentence, TokenData, DEFAULT_API_URL, streamAnalyzeSentence } from './services/api';
import { FaExclamationTriangle, FaExclamationCircle } from 'react-icons/fa';

export default function Home() {
  const [currentSentence, setCurrentSentence] = useState('');
  const [analyzedTokens, setAnalyzedTokens] = useState<TokenData[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [useStream, setUseStream] = useState<boolean>(true);
  const [streamContent, setStreamContent] = useState('');
  const [isJsonParseError, setIsJsonParseError] = useState(false);
  const [translationTrigger, setTranslationTrigger] = useState(0);
  const [showFurigana, setShowFurigana] = useState(true);
  
  // API设置相关状态
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [userApiKey, setUserApiKey] = useState('');
  const [userApiUrl, setUserApiUrl] = useState(DEFAULT_API_URL);
  const [ttsProvider, setTtsProvider] = useState<'system' | 'gemini'>('gemini');
  
  // 设置下拉菜单状态
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.settings-dropdown')) {
        setIsSettingsDropdownOpen(false);
      }
    };

    if (isSettingsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsDropdownOpen]);

  // 初始化主题状态
  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };
    
    // 初始检查
    checkTheme();
    
    // 监听主题变化
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);
  
  // 密码验证相关状态
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [authError, setAuthError] = useState('');

  // 检查是否需要密码验证
  useEffect(() => {
    const checkAuthRequirement = async () => {
      try {
        const response = await fetch('/api/auth');
        const data = await response.json();
        setRequiresAuth(data.requiresAuth);
        
        // 如果不需要验证，直接设置为已认证
        if (!data.requiresAuth) {
          setIsAuthenticated(true);
        } else {
          // 检查是否已经有有效的认证状态
          const authStatus = localStorage.getItem('isAuthenticated');
          if (authStatus === 'true') {
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        console.error('检查认证状态失败:', error);
        // 出错时默认不需要认证
        setRequiresAuth(false);
        setIsAuthenticated(true);
      }
    };
    
    checkAuthRequirement();
  }, []);

  // 从本地存储加载用户API设置
  useEffect(() => {
    const storedApiKey = localStorage.getItem('userApiKey') || '';
    const storedApiUrl = localStorage.getItem('userApiUrl') || DEFAULT_API_URL;
    const storedUseStream = localStorage.getItem('useStream');
    const storedTtsProvider = localStorage.getItem('ttsProvider') as 'system' | 'gemini' || 'gemini';
    
    setUserApiKey(storedApiKey);
    setUserApiUrl(storedApiUrl);
    setTtsProvider(storedTtsProvider);
    
    // 只有当明确设置了值时才更新，否则保持默认值
    if (storedUseStream !== null) {
      setUseStream(storedUseStream === 'true');
    }
  }, []);
  
  // 保存用户API设置
  const handleSaveSettings = (apiKey: string, apiUrl: string, streamEnabled: boolean) => {
    localStorage.setItem('userApiKey', apiKey);
    localStorage.setItem('userApiUrl', apiUrl);
    localStorage.setItem('useStream', streamEnabled.toString());
    
    setUserApiKey(apiKey);
    setUserApiUrl(apiUrl);
    setUseStream(streamEnabled);
  };

  // 处理TTS提供商变更
  const handleTtsProviderChange = (provider: 'system' | 'gemini') => {
    setTtsProvider(provider);
    localStorage.setItem('ttsProvider', provider);
  };

  // 处理密码验证
  const handleLogin = async (password: string) => {
    try {
      setAuthError('');
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.success) {
        setIsAuthenticated(true);
        localStorage.setItem('isAuthenticated', 'true');
      } else {
        setAuthError(data.message || '验证失败');
      }
    } catch (error) {
      console.error('验证过程中出错:', error);
      setAuthError('验证过程中发生错误，请重试');
    }
  };

  // 解析流式内容中的JSON数据
  const parseStreamContent = (content: string): TokenData[] => {
    try {
      // 如果内容为空，返回空数组
      if (!content || content.trim() === '') {
        return [];
      }
      
      // 尝试整理内容
      let processedContent = content;
      
      // 如果内容包含markdown代码块，尝试提取
      const jsonMatch = content.match(/```json\n([\s\S]*?)(\n```|$)/);
      if (jsonMatch && jsonMatch[1]) {
        processedContent = jsonMatch[1].trim();
        
        // 检查是否是完整的JSON数组
        if (!processedContent.endsWith(']') && processedContent.startsWith('[')) {
          console.log("发现不完整的JSON块，尝试补全");
          // 尝试找到最后一个完整的对象结束位置
          const lastObjectEnd = processedContent.lastIndexOf('},');
          if (lastObjectEnd !== -1) {
            // 截取到最后一个完整对象
            processedContent = processedContent.substring(0, lastObjectEnd + 1) + ']';
          } else {
            // 找不到完整对象，可能只有部分第一个对象
            const firstObjectStart = processedContent.indexOf('{');
            if (firstObjectStart !== -1) {
              const partialObject = processedContent.substring(firstObjectStart);
              // 检查是否至少包含一个完整的字段
              if (partialObject.includes('":')) {
                return []; // 返回空数组，等待更多内容
              }
            }
            return []; // 返回空数组，等待更多内容
          }
        }
      } else {
        // 直接查找JSON数组
        const arrayStart = processedContent.indexOf('[');
        const arrayEnd = processedContent.lastIndexOf(']');
        
        if (arrayStart !== -1 && arrayEnd === -1) {
          // 找到开始但没找到结束，是不完整的
          const lastObjectEnd = processedContent.lastIndexOf('},');
          if (lastObjectEnd !== -1 && lastObjectEnd > arrayStart) {
            // 有至少一个完整对象
            processedContent = processedContent.substring(arrayStart, lastObjectEnd + 1) + ']';
          } else {
            return []; // 没有完整对象，返回空等待更多内容
          }
        } else if (arrayStart !== -1 && arrayEnd !== -1) {
          // 提取数组部分
          processedContent = processedContent.substring(arrayStart, arrayEnd + 1);
        }
      }
      
      // 尝试解析处理后的内容
      try {
        const parsed = JSON.parse(processedContent) as TokenData[];
        // 验证数组中的对象是否有必要的字段
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validTokens = parsed.filter(item => 
            item && typeof item === 'object' && 'word' in item && 'pos' in item
          );
          if (validTokens.length > 0) {
            return validTokens;
          }
        }
        return [];
      } catch (e) {
        console.log("无法解析处理后的JSON:", processedContent);
        console.error(e);
        return [];
      }
    } catch (e) {
      console.error("解析JSON时出错:", e);
      console.debug("尝试解析的内容:", content);
      setIsJsonParseError(true);
      return [];
    }
  };

  // 监听流式内容变化，尝试解析TokenData
  useEffect(() => {
    if (streamContent && isAnalyzing) {
      const tokens = parseStreamContent(streamContent);
      if (tokens.length > 0) {
        setAnalyzedTokens(tokens);
        setIsJsonParseError(false);
      } else if (streamContent.includes('{') && streamContent.includes('"word":')) {
        // 有内容但解析失败，可能是不完整的JSON
        setIsJsonParseError(true);
      }
    }
  }, [streamContent, isAnalyzing]);

  // 添加函数，检查是否显示分析器
  const shouldShowAnalyzer = (): boolean => {
    // 如果已经有解析结果，显示
    if (analyzedTokens.length > 0) return true;
    
    // 如果没有内容，不显示
    if (!streamContent) return false;
    
    // 如果有内容但解析失败，看情况
    if (isJsonParseError) {
      // 如果内容已经包含了完整的单词信息，可能是接近完成了
      return streamContent.includes('"word":') && streamContent.includes('"pos":');
    }
    
    return false;
  };

  const handleAnalyze = async (text: string) => {
    if (!text) return;

    setIsAnalyzing(true);
    setAnalysisError('');
    setCurrentSentence(text);
    setTranslationTrigger(Date.now());
    setStreamContent('');
    setAnalyzedTokens([]);
    setIsJsonParseError(false);
    
    try {
      if (useStream) {
        // 使用流式API进行分析
        streamAnalyzeSentence(
          text,
          (chunk, isDone) => {
            setStreamContent(chunk);
            if (isDone) {
              setIsAnalyzing(false);
              // 最终解析完整的内容
              const tokens = parseStreamContent(chunk);
              if (tokens.length > 0) {
                setAnalyzedTokens(tokens);
                setIsJsonParseError(false);
              } else if (chunk && chunk.includes('{') && chunk.includes('"word":')) {
                // 最终内容仍然解析失败
                setIsJsonParseError(true);
              }
            }
          },
          (error) => {
            console.error('Stream analysis error:', error);
            setAnalysisError(error.message || '流式解析错误');
            setIsAnalyzing(false);
          },
          userApiKey,
          userApiUrl
        );
      } else {
        // 使用传统API进行分析
        const tokens = await analyzeSentence(text, userApiKey, userApiUrl);
        setAnalyzedTokens(tokens);
        setIsAnalyzing(false);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisError(error instanceof Error ? error.message : '未知错误');
      setAnalyzedTokens([]);
      setIsAnalyzing(false);
    }
  };

  // 如果需要认证但未认证，只显示登录界面
  if (requiresAuth && !isAuthenticated) {
    return (
      <>
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-gray-100 transition-colors duration-200">
              日本語<span className="text-[#007AFF] dark:text-blue-400">文章</span>解析器
            </h1>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 mt-2 transition-colors duration-200">
              AI驱动・深入理解日语句子结构与词义
            </p>
          </div>
        </div>
        <LoginModal
          isOpen={true}
          onLogin={handleLogin}
          error={authError}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-4 sm:pt-8 lg:pt-16 p-3 sm:p-4 bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="w-full max-w-3xl">
        {/* 设置下拉菜单 - 固定在右上角 */}
        <div className="fixed top-6 right-6 z-1000 settings-dropdown">
          <button
            onClick={() => setIsSettingsDropdownOpen(!isSettingsDropdownOpen)}
            className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
            title="设置"
          >
            <i className="fas fa-cog text-lg"></i>
          </button>
          
          {/* 下拉菜单 */}
          {isSettingsDropdownOpen && (
            <div className="absolute top-12 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-2 min-w-48 z-50">
              {/* 主题切换选项 */}
              <button
                onClick={() => {
                  const newTheme = isDarkMode ? 'light' : 'dark';
                  if (newTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                    localStorage.setItem('theme', 'dark');
                    setIsDarkMode(true);
                  } else {
                    document.documentElement.classList.remove('dark');
                    localStorage.setItem('theme', 'light');
                    setIsDarkMode(false);
                  }
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between"
              >
                <div className="flex items-center">
                  <i className={`fas ${isDarkMode ? 'fa-moon' : 'fa-sun'} mr-2`}></i>
                  深色模式
                </div>
                <div className="relative inline-block w-10 h-5">
                  <div className={`absolute inset-0 rounded-full transition-colors duration-200 ${isDarkMode ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                  <div className={`absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${isDarkMode ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
              </button>
              
              {/* API设置选项 */}
              <button
                onClick={() => {
                  setIsSettingsModalOpen(true);
                  setIsSettingsDropdownOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
              >
                <i className="fas fa-cog mr-2"></i>
                API设置
              </button>
              
              {/* GitHub仓库选项 */}
              <a
                href="https://github.com/cokice/japanese-analyzer"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsSettingsDropdownOpen(false)}
                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 no-underline"
              >
                <i className="fab fa-github mr-2"></i>
                GitHub仓库
              </a>
            </div>
          )}
        </div>
        
        <header className="text-center mb-6 sm:mb-8 mt-12 sm:mt-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-gray-100 transition-colors duration-200">
            日本語<span className="text-[#007AFF] dark:text-blue-400">文章</span>解析器
          </h1>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 mt-2 transition-colors duration-200">
            AI驱动・深入理解日语句子结构与词义
          </p>
        </header>

        <main>
          <InputSection 
            onAnalyze={handleAnalyze}
            userApiKey={userApiKey}
            userApiUrl={userApiUrl}
            useStream={useStream}
            ttsProvider={ttsProvider}
            onTtsProviderChange={handleTtsProviderChange}
          />

          {isAnalyzing && (!analyzedTokens.length || !useStream) && (
            <div className="premium-card">
              <div className="flex items-center justify-center py-6">
                <div className="loading-spinner"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400 transition-colors duration-200">正在解析中，请稍候...</span>
              </div>
            </div>
          )}

          {isJsonParseError && streamContent && (
            <div className="premium-card">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-3 sm:p-4 mb-4 transition-colors duration-200">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <FaExclamationTriangle className="text-yellow-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 transition-colors duration-200">
                      解析中，已经收到部分内容，但尚未形成完整的结果。
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md overflow-auto max-h-96 text-xs font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-200 transition-colors duration-200">
                {streamContent}
              </div>
            </div>
          )}

          {analysisError && (
            <div className="premium-card">
              <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-3 sm:p-4 transition-colors duration-200">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <FaExclamationCircle className="text-red-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700 dark:text-red-300 transition-colors duration-200">
                      解析错误：{analysisError}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {shouldShowAnalyzer() && (
            <AnalysisResult 
              tokens={analyzedTokens}
              originalSentence={currentSentence}
              userApiKey={userApiKey}
              userApiUrl={userApiUrl}
              showFurigana={showFurigana}
              onShowFuriganaChange={setShowFurigana}
            />
          )}

          {currentSentence && (
            <TranslationSection
              japaneseText={currentSentence}
              userApiKey={userApiKey}
              userApiUrl={userApiUrl}
              useStream={useStream}
              trigger={translationTrigger}
            />
          )}
        </main>

        <footer className="text-center mt-8 sm:mt-12 py-4 sm:py-6 border-t border-gray-200 dark:border-gray-700 transition-colors duration-200">
          <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm transition-colors duration-200">&copy; 2025 高级日语解析工具 by Howen. All rights reserved.</p>
          
        </footer>
      </div>
      
      {/* 设置模态框 */}
      <SettingsModal
        userApiKey={userApiKey}
        userApiUrl={userApiUrl}
        defaultApiUrl={DEFAULT_API_URL}
        useStream={useStream}
        onSaveSettings={handleSaveSettings}
        isModalOpen={isSettingsModalOpen}
        onModalClose={() => setIsSettingsModalOpen(!isSettingsModalOpen)}
      />
    </div>
  );
}
