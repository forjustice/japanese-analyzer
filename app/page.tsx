'use client';

import { useState, useEffect } from 'react';
import InputSection from './components/InputSection';
import AnalysisResult from './components/AnalysisResult';
import TranslationSection from './components/TranslationSection';
import AuthModal from './components/AuthModal';
import UserDashboard from './components/UserDashboard';
import { authClient, AuthState } from './utils/auth-client';
import HistoryModal from './components/HistoryModal';
import { analyzeSentence, TokenData } from './services/api';
import { saveAnalysisToHistory, AnalysisHistoryItem } from './utils/history';
import { FaExclamationCircle } from 'react-icons/fa';

export default function Home() {
  const [currentSentence, setCurrentSentence] = useState('');
  const [analyzedTokens, setAnalyzedTokens] = useState<TokenData[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [translationTrigger, setTranslationTrigger] = useState(0);
  const [showFurigana, setShowFurigana] = useState(true);
  const [currentTranslation, setCurrentTranslation] = useState('');
  
  const [ttsProvider, setTtsProvider] = useState<'system' | 'gemini'>('gemini');
  
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isUserDashboardOpen, setIsUserDashboardOpen] = useState(false);
  
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

  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };
    
    checkTheme();
    
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);
  
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    authMode: 'user'
  });
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [authError, setAuthError] = useState('');


  useEffect(() => {
    const checkAuthRequirement = async () => {
      try {
        const authRequirement = await authClient.checkAuthRequirement();
        setRequiresAuth(authRequirement.requiresAuth);
        
        if (!authRequirement.requiresAuth) {
          const currentState = authClient.getCurrentAuthState();
          setAuthState({
            isAuthenticated: true,
            user: currentState.user,
            token: currentState.token,
            authMode: authRequirement.mode
          });
        } else {
          setAuthState({
            isAuthenticated: false,
            user: null,
            token: null,
            authMode: authRequirement.mode
          });
        }
      } catch (error) {
        console.error('检查认证状态失败:', error);
        setRequiresAuth(false);
        setAuthState({
          isAuthenticated: true,
          user: null,
          token: null,
          authMode: 'user'
        });
      }
    };
    
    checkAuthRequirement();
  }, []);

  useEffect(() => {
    const storedTtsProvider = localStorage.getItem('ttsProvider') as 'system' | 'gemini' || 'gemini';
    
    setTtsProvider(storedTtsProvider);
    
  }, []);

  const handleTtsProviderChange = (provider: 'system' | 'gemini') => {
    setTtsProvider(provider);
    localStorage.setItem('ttsProvider', provider);
  };

  const handleAuth = (data: { token: string; user: AuthState['user'] }) => {
    try {
      setAuthError('');
      if (data && data.token && data.user) {
        authClient.setUserAuthState(data.token, data.user);
        setAuthState({ isAuthenticated: true, user: data.user, token: data.token, authMode: 'user' });
        setRequiresAuth(false);
      } else {
        setAuthError('认证失败，返回数据格式不正确');
      }
    } catch (error) {
      console.error('认证过程中出错:', error);
      setAuthError('认证过程中发生错误，请重试');
    }
  };

  const handleAnalyze = async (text: string) => {
    if (!text) return;

    setIsAnalyzing(true);
    setAnalysisError('');
    setCurrentSentence(text);
    setAnalyzedTokens([]);
    setTranslationTrigger(Date.now());
    
    let accumulatedJson = '';
    try {
      await analyzeSentence(text, (chunk) => {
        console.log("Received chunk:", chunk);
        accumulatedJson += chunk;
        // We don't parse here anymore to avoid errors with incomplete data.
        // We will parse only once at the very end.
      });

      // Final, crucial validation and parsing after the stream is complete.
      let trimmedJson = accumulatedJson.trim();
      if (!trimmedJson) {
        throw new Error("AI返回的解析结果为空，请检查输入或稍后重试。");
      }
      
      console.log("Accumulated JSON:", trimmedJson);
      
      // 清理Markdown代码块标记
      trimmedJson = trimmedJson.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
      
      let finalTokens;
      try {
        // 清理和修复JSON格式
        let cleanedJson = trimmedJson;
        
        // 修复常见的JSON格式问题
        cleanedJson = cleanedJson
          // 修复缺少引号的情况
          .replace(/,\s*"pos":\s*,/g, ', "pos": "句読点",')
          .replace(/,\s*"pos":\s*"furigana"/g, ', "pos": "句読点", "furigana"')
          .replace(/,\s*"pos":\s*$/gm, ', "pos": "句読点"')
          // 修复缺少逗号的情况
          .replace(/}\s*{/g, '}, {')
          // 修复缺少字段名的情况
          .replace(/,\s*"([^"]+)"\s*}/g, ', "$1": ""}')
          // 修复多余的逗号
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          // 修复缺少开头的情况
          .replace(/^\s*{/, '[{')
          // 修复缺少结尾的情况
          .replace(/}\s*$/, '}]');
        
        console.log("Cleaned JSON:", cleanedJson);
        
        // 尝试直接解析
        if (cleanedJson.startsWith('[') && cleanedJson.endsWith(']')) {
          try {
            finalTokens = JSON.parse(cleanedJson);
          } catch {
            // 如果直接解析失败，尝试逐个提取对象
            const jsonObjects = [];
            const regex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
            let match;
            while ((match = regex.exec(cleanedJson)) !== null) {
              try {
                const obj = JSON.parse(match[0]);
                if (obj.word !== undefined) {
                  jsonObjects.push(obj);
                }
              } catch {
                console.warn('Failed to parse individual JSON object:', match[0]);
              }
            }
            
            if (jsonObjects.length > 0) {
              finalTokens = jsonObjects;
            } else {
              throw new Error("无法从AI响应中提取有效的JSON数据");
            }
          }
        } else {
          // 如果不是完整的数组格式，尝试提取所有对象
          const jsonObjects = [];
          const regex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
          let match;
          while ((match = regex.exec(cleanedJson)) !== null) {
            try {
              const obj = JSON.parse(match[0]);
              if (obj.word !== undefined) {
                jsonObjects.push(obj);
              }
            } catch {
              console.warn('Failed to parse individual JSON object:', match[0]);
            }
          }
          
          if (jsonObjects.length > 0) {
            finalTokens = jsonObjects;
          } else {
            throw new Error("无法从AI响应中提取有效的JSON数据");
          }
        }
      } catch (parseError) {
        console.error("JSON parsing failed:", parseError);
        console.error("Original response:", trimmedJson);
        throw new Error("AI返回的解析结果格式不正确，无法解析为有效的JSON数组。");
      }
      setAnalyzedTokens(finalTokens);
      saveAnalysisToHistory(text, finalTokens, currentTranslation);

    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisError(error instanceof Error ? error.message : '未知错误');
      setAnalyzedTokens([]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectHistory = (historyItem: AnalysisHistoryItem) => {
    setCurrentSentence(historyItem.originalText);
    setAnalyzedTokens(historyItem.tokens);
    if (historyItem.translation) {
      setCurrentTranslation(historyItem.translation);
    }
    setTranslationTrigger(Date.now());
  };

  if (requiresAuth && !authState.isAuthenticated) {
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
        <AuthModal isOpen={true} onAuth={handleAuth} error={authError} mode="user" />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-4 sm:pt-8 lg:pt-16 p-3 sm:p-4 bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="w-full max-w-3xl">
        <div className="fixed top-6 right-6 z-1000 settings-dropdown">
          <button
            onClick={() => setIsSettingsDropdownOpen(!isSettingsDropdownOpen)}
            className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
            title="设置"
          >
            <i className="fas fa-cog text-lg"></i>
          </button>
          
          {isSettingsDropdownOpen && (
            <div className="absolute top-12 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-2 min-w-48 z-50">
              {authState.authMode === 'user' && authState.user && (
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{authState.user.username || '用户'}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{authState.user.email}</div>
                </div>
              )}
              
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
              
              <button onClick={() => { setIsHistoryModalOpen(true); setIsSettingsDropdownOpen(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center">
                <i className="fas fa-history mr-2"></i>
                历史记录
              </button>
              
              {authState.authMode === 'user' && authState.user && (
                <button onClick={() => { setIsUserDashboardOpen(true); setIsSettingsDropdownOpen(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center">
                  <i className="fas fa-user mr-2"></i>
                  用户中心
                </button>
              )}
              
              <a href="https://github.com/cokice/japanese-analyzer" target="_blank" rel="noopener noreferrer" onClick={() => setIsSettingsDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 no-underline">
                <i className="fab fa-github mr-2"></i>
                GitHub仓库
              </a>
              
              {authState.authMode === 'user' && authState.user && (
                <button onClick={() => { authClient.logout(); setIsSettingsDropdownOpen(false); }} className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center border-t border-gray-200 dark:border-gray-600 mt-2 pt-2">
                  <i className="fas fa-sign-out-alt mr-2"></i>
                  退出登录
                </button>
              )}
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
            ttsProvider={ttsProvider}
            onTtsProviderChange={handleTtsProviderChange}
          />

          {isAnalyzing && (
            <div className="premium-card">
              <div className="flex items-center justify-center py-6">
                <div className="loading-spinner"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400 transition-colors duration-200">正在解析中，请稍候...</span>
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

          {analyzedTokens.length > 0 && !isAnalyzing && (
            <AnalysisResult 
              tokens={analyzedTokens}
              originalSentence={currentSentence}
              showFurigana={showFurigana}
              onShowFuriganaChange={setShowFurigana}
              ttsProvider={ttsProvider}
            />
          )}

          {currentSentence && (
            <TranslationSection
              japaneseText={currentSentence}
              trigger={translationTrigger}
              onTranslationUpdate={setCurrentTranslation}
            />
          )}
        </main>

        <footer className="text-center mt-8 sm:mt-12 py-4 sm:py-6 border-t border-gray-200 dark:border-gray-700 transition-colors duration-200">
          <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm transition-colors duration-200">&copy; 2025 高级日语解析工具 by Howen. All rights reserved.</p>
        </footer>
      </div>
      
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onSelectHistory={handleSelectHistory}
      />
      
      {authState.authMode === 'user' && authState.user && (
        <UserDashboard
          isOpen={isUserDashboardOpen}
          onClose={() => setIsUserDashboardOpen(false)}
          userInfo={{
            email: authState.user.email,
            username: authState.user.username,
            created_at: authState.user.created_at ? new Date(authState.user.created_at).toISOString() : new Date().toISOString()
          }}
        />
      )}
    </div>
  );
}
