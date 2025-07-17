'use client';

import { useState, useEffect } from 'react';
import InputSection from './components/InputSection';
import AnalysisResult from './components/AnalysisResult';
import TranslationSection from './components/TranslationSection';
import AuthModal from './components/AuthModal';
import UserDashboard from './components/UserDashboard';
import ShopModal from './components/ShopModal';
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
  const [analysisWarning, setAnalysisWarning] = useState('');
  const [translationTrigger, setTranslationTrigger] = useState(0);
  const [showFurigana, setShowFurigana] = useState(true);
  const [currentTranslation, setCurrentTranslation] = useState('');
  
  const [ttsProvider, setTtsProvider] = useState<'system' | 'gemini'>('gemini');
  
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isUserDashboardOpen, setIsUserDashboardOpen] = useState(false);
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  
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

  // 辅助方法：从Gemini响应中提取token数据
  const extractTokensFromGeminiResponse = (responseText: string): string | null => {
    try {
      // 先尝试从流式响应中提取所有text部分
      const streamingBlocks = responseText.split('\n').filter(line => line.trim());
      const allTextParts = [];
      
      for (const block of streamingBlocks) {
        try {
          const parsed = JSON.parse(block);
          if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content && parsed.candidates[0].content.parts) {
            for (const part of parsed.candidates[0].content.parts) {
              if (part.text) {
                allTextParts.push(part.text);
              }
            }
          }
        } catch {
          // 忽略无法解析的块
          continue;
        }
      }
      
      if (allTextParts.length > 0) {
        const combinedText = allTextParts.join('');
        
        // 尝试修复常见的JSON问题
        let fixedText = combinedText.trim();
        
        // 修复可能的末尾逗号问题
        if (fixedText.endsWith(',')) {
          fixedText = fixedText.slice(0, -1);
        }
        
        // 确保以数组结束
        if (!fixedText.endsWith(']')) {
          fixedText += ']';
        }
        
        // 确保以数组开始
        if (!fixedText.startsWith('[')) {
          fixedText = '[' + fixedText;
        }
        
        return fixedText;
      }
      
      // 如果上面的方法失败，尝试直接从响应中匹配JSON数组
      const patterns = [
        /\[\s*\{[^\}]*"word"[^\}]*\}[\s\S]*?\]/g,
        /\[\s*\{[^\}]*"pos"[^\}]*\}[\s\S]*?\]/g,
        /\[\s*\{[^\}]*"furigana"[^\}]*\}[\s\S]*?\]/g
      ];
      
      for (const pattern of patterns) {
        const matches = responseText.match(pattern);
        if (matches && matches.length > 0) {
          return matches[0];
        }
      }
      
      return null;
    } catch (error) {
      console.error('提取token数据时出错:', error);
      return null;
    }
  };
  
  const handleAnalyze = async (text: string) => {
    if (!text) return;

    setIsAnalyzing(true);
    setAnalysisError('');
    setAnalysisWarning('');
    setCurrentSentence(text);
    setAnalyzedTokens([]);
    setTranslationTrigger(Date.now());
    
    let accumulatedData = '';
    let isStreamComplete = false;
    
    try {
      await analyzeSentence(text, (chunk) => {
        accumulatedData += chunk;
      });
      
      isStreamComplete = true;

      // 深度清理和验证累积的响应数据
      const cleanedResponse = accumulatedData.trim();
      if (!cleanedResponse) {
        throw new Error("AI返回的解析结果为空，请检查输入或稍后重试。");
      }
      
      // 提取JSON内容：处理流式响应中的各种格式
      let jsonContent = '';
      
      // 首先检查是否cleanedResponse直接包含有效的JSON数组
      if (cleanedResponse.includes('[') && cleanedResponse.includes(']') && cleanedResponse.includes('"word"')) {
        jsonContent = cleanedResponse;
        console.log('直接使用原始响应，发现包含token结构');
      } else {
        // 尝试从Gemini流式响应中提取内容
        console.log('Attempting to parse streaming response...');
        console.log('Response sample:', cleanedResponse.substring(0, 500));
        
        const extractedTexts: string[] = [];
        
        // 流式响应是一个JSON数组，每个元素是一个响应块
        try {
          const responseBlocks = JSON.parse(cleanedResponse);
          console.log('解析成功的responseBlocks:', responseBlocks);
          if (Array.isArray(responseBlocks)) {
            for (const block of responseBlocks) {
              if (block.candidates && block.candidates[0] && block.candidates[0].content && block.candidates[0].content.parts) {
                const parts = block.candidates[0].content.parts;
                for (const part of parts) {
                  if (part.text) {
                    console.log('从数组块中提取文本:', part.text);
                    extractedTexts.push(part.text);
                  }
                }
              }
            }
          }
        } catch (parseError) {
          console.error('Failed to parse response as JSON array:', parseError);
          console.error('尝试解析的内容:', cleanedResponse.substring(0, 500));
          // 回退到逐行解析
          const jsonChunks = cleanedResponse.split('\n').filter(line => line.trim());
          console.log('切分得到的块数量:', jsonChunks.length);
          
          for (const chunk of jsonChunks) {
            try {
              const parsed = JSON.parse(chunk);
              if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content && parsed.candidates[0].content.parts) {
                const parts = parsed.candidates[0].content.parts;
                for (const part of parts) {
                  if (part.text) {
                    console.log('从单个块中提取文本:', part.text);
                    extractedTexts.push(part.text);
                  }
                }
              }
            } catch {
              // 跳过无法解析的块
              continue;
            }
          }
        }
        
        if (extractedTexts.length > 0) {
          jsonContent = extractedTexts.join('');
          console.log('从Gemini流式响应中提取的内容数量:', extractedTexts.length);
          console.log('提取的内容长度:', jsonContent.length);
        } else {
          // 最后使用原始内容
          jsonContent = cleanedResponse;
          console.log('无法提取，使用原始响应内容，长度:', jsonContent.length);
        }
        
        // 新增：尝试从全部响应中直接提取token数据
        if (!jsonContent || jsonContent.length < 10) {
          console.log('尝试从全部响应中直接提取token数据');
          // 使用辅助方法提取token数据
          const extractedTokens = extractTokensFromGeminiResponse(cleanedResponse);
          if (extractedTokens) {
            jsonContent = extractedTokens;
            console.log('从直接匹配中提取token数据，长度:', jsonContent.length);
          }
        }
      }
      
      console.log('最终jsonContent前200字符:', jsonContent.substring(0, 200));
      
      // 清理可能的格式化标记
      jsonContent = jsonContent
        .replace(/^```json\s*/gmi, '')
        .replace(/```\s*$/gmi, '')
        .replace(/^```\s*/gmi, '')
        .trim();
      
      // 查找JSON数组的边界
      let arrayStart = jsonContent.indexOf('[');
      let arrayEnd = jsonContent.lastIndexOf(']');
      
      // 如果找不到标准边界，尝试修复常见问题
      if (arrayStart === -1 || arrayEnd === -1 || arrayStart >= arrayEnd) {
        console.log('未找到标准JSON数组边界，尝试修复...');
        
        // 尝试修复被截断的JSON
        if (arrayStart !== -1 && arrayEnd === -1) {
          // 如果有开始但没有结束，尝试添加结束
          if (jsonContent.includes('"word"') && jsonContent.includes('"pos"')) {
            const lastCompleteObject = jsonContent.lastIndexOf('}');
            if (lastCompleteObject > arrayStart) {
              jsonContent = jsonContent.substring(0, lastCompleteObject + 1) + ']';
              arrayEnd = jsonContent.lastIndexOf(']');
              console.log('尝试修复JSON结束符号');
            }
          }
        }
        
        // 再次检查
        arrayStart = jsonContent.indexOf('[');
        arrayEnd = jsonContent.lastIndexOf(']');
        
        if (arrayStart === -1 || arrayEnd === -1 || arrayStart >= arrayEnd) {
          console.error('无法修复JSON数组格式');
          console.error('Content sample:', jsonContent.substring(0, 500));
          throw new Error("解析结果中未找到有效的JSON数组格式。");
        }
      }
      
      const jsonArrayContent = jsonContent.substring(arrayStart, arrayEnd + 1);
      console.log('提取的JSON数组内容长度:', jsonArrayContent.length);
      console.log('JSON数组内容前300字符:', jsonArrayContent.substring(0, 300));
      
      let finalTokens: unknown[];
      try {
        finalTokens = JSON.parse(jsonArrayContent);
        console.log('JSON解析成功，解析出的数组长度:', finalTokens.length);
      } catch (parseError) {
        console.error("JSON解析失败:", parseError);
        console.error("提取的JSON内容长度:", jsonArrayContent.length);
        console.error("JSON内容示例:", jsonArrayContent.substring(0, 500));
        console.error("完整原始响应:", cleanedResponse.substring(0, 1000));
        throw new Error("AI返回的解析结果格式不正确。请尝试缩短输入文本、简化句子结构，或稍后重试。");
      }

      if (!Array.isArray(finalTokens)) {
        throw new Error("解析结果不是有效的数组格式。");
      }
      
      // 检查是否每个元素都是Gemini API响应格式而不是token
      if (finalTokens.length > 0 && finalTokens[0] && typeof finalTokens[0] === 'object' && 'candidates' in (finalTokens[0] as Record<string, unknown>)) {
        console.log('检测到Gemini API响应格式，尝试从中提取token数据...');
        console.log('finalTokens结构:', finalTokens);
        console.log('第一个元素:', finalTokens[0]);
        
        // 从Gemini响应中提取实际的token数据
        let extractedTokenArray: unknown[] = [];
        
        // 从Gemini流式响应中提取所有text部分
        const allTextParts: string[] = [];
        
        for (const response of finalTokens) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const resp = response as Record<string, any>;
          console.log('处理响应对象:', resp);
          if (resp.candidates && resp.candidates[0] && resp.candidates[0].content && resp.candidates[0].content.parts) {
            const parts = resp.candidates[0].content.parts;
            console.log('提取到的parts:', parts);
            for (const part of parts) {
              if (part.text) {
                console.log('处理part.text:', part.text);
                allTextParts.push(part.text);
              }
            }
          }
        }
        
        // 拼接所有text部分
        const combinedText = allTextParts.join('');
        console.log('拼接后的文本总长度:', combinedText.length);
        console.log('拼接后的文本示例:', combinedText.substring(0, 500));
        
        // 尝试解析拼接后的文本为JSON数组
        try {
          const parsedArray = JSON.parse(combinedText);
          if (Array.isArray(parsedArray)) {
            extractedTokenArray = parsedArray;
            console.log('成功解析拼接后的JSON数组，包含', parsedArray.length, '个元素');
          } else {
            console.log('拼接后的文本不是数组格式');
          }
        } catch (combineError) {
          console.log('拼接后的文本解析失败:', combineError);
          
          // 如果直接解析失败，尝试修复常见问题
          let fixedText = combinedText;
          
          // 修复可能的末尾逗号问题
          if (fixedText.endsWith(',')) {
            fixedText = fixedText.slice(0, -1);
          }
          
          // 确保以数组结束
          if (!fixedText.endsWith(']')) {
            fixedText += ']';
          }
          
          // 确保以数组开始
          if (!fixedText.startsWith('[')) {
            fixedText = '[' + fixedText;
          }
          
          console.log('尝试修复后的文本示例:', fixedText.substring(0, 200));
          
          try {
            const fixedArray = JSON.parse(fixedText);
            if (Array.isArray(fixedArray)) {
              extractedTokenArray = fixedArray;
              console.log('修复后成功解析JSON数组，包含', fixedArray.length, '个元素');
            }
          } catch (fixError) {
            console.log('修复后仍然解析失败:', fixError);
          }
        }
        
        if (extractedTokenArray.length > 0) {
          console.log('从Gemini响应中提取出', extractedTokenArray.length, '个token');
          finalTokens = extractedTokenArray;
        } else {
          console.error('无法从Gemini API响应中提取token数据');
          console.error('finalTokens内容:', finalTokens);
          console.error('extractedTokenArray内容:', extractedTokenArray);
          console.error('原始响应长度:', cleanedResponse.length);
          console.error('响应内容示例:', cleanedResponse.substring(0, 1000));
          
          // 尝试作为最后的后备方案，使用原始数据直接作为token数组
          if (Array.isArray(finalTokens) && finalTokens.length > 0) {
            console.log('尝试使用原始数据作为token数组');
            // 尝试从原始数据中提取有效的token对象
            const backupTokens = finalTokens.filter((item: unknown) => {
              if (typeof item === 'object' && item !== null) {
                const token = item as Record<string, unknown>;
                return token.word && typeof token.word === 'string';
              }
              return false;
            });
            
            if (backupTokens.length > 0) {
              console.log('从原始数据中发现', backupTokens.length, '个有效token');
              finalTokens = backupTokens;
            } else {
              throw new Error('无法从Gemini API响应中提取有效的token数据。调试信息已记录到控制台。');
            }
          } else {
            throw new Error('无法从Gemini API响应中提取有效的token数据。调试信息已记录到控制台。');
          }
        }
      }
      
      // 调试：输出解析结果信息
      console.log('解析的finalTokens:', finalTokens);
      console.log('finalTokens类型:', typeof finalTokens);
      console.log('finalTokens长度:', finalTokens.length);
      if (finalTokens.length > 0) {
        console.log('第一个项目示例:', finalTokens[0]);
        console.log('第一个项目的属性:', Object.keys(finalTokens[0] || {}));
        
        // 检查是否是Gemini API响应格式
        if (finalTokens[0] && typeof finalTokens[0] === 'object' && 'candidates' in finalTokens[0]) {
          console.error('错误：finalTokens包含的是Gemini API响应对象，而不是token数组！');
          console.error('需要重新处理JSON内容提取逻辑');
          throw new Error('数据提取错误：获得的是API响应对象而不是解析的token数组。');
        }
      }
      
      // 验证和清理tokens - 使用更宽松的验证
      const validTokens = finalTokens.filter((token: unknown) => {
        if (!token || typeof token !== 'object') {
          console.log('跳过非对象token:', token);
          return false;
        }
        
        const t = token as Record<string, unknown>;
        
        // 检查必需的字段
        const hasWord = 'word' in t && typeof t.word === 'string';
        const hasPos = 'pos' in t && typeof t.pos === 'string';
        const isNotEndMarker = t.word !== "END_OF_ANALYSIS";
        
        if (!hasWord) {
          console.log('缺少word字段的token:', t);
        }
        if (!hasPos) {
          console.log('缺少pos字段的token:', t);
        }
        
        return hasWord && hasPos && isNotEndMarker;
      }) as TokenData[];
      
      console.log(`过滤后的有效tokens数量: ${validTokens.length}`);
      
      if (validTokens.length === 0) {
        console.error('没有找到有效的tokens。原始finalTokens:', finalTokens);
        
        // 尝试更宽松的过滤条件作为后备方案
        const fallbackTokens = finalTokens.filter((token: unknown) => {
          if (!token || typeof token !== 'object') return false;
          const t = token as Record<string, unknown>;
          // 只要有word字段就接受
          return 'word' in t && typeof t.word === 'string' && t.word !== "END_OF_ANALYSIS" && t.word.trim() !== '';
        }).map((token: unknown) => {
          const t = token as Record<string, unknown>;
          return {
            word: t.word as string,
            pos: (t.pos as string) || '未知',
            furigana: (t.furigana as string) || '',
            romaji: (t.romaji as string) || ''
          } as TokenData;
        });
        
        if (fallbackTokens.length > 0) {
          console.log('使用后备方案，找到', fallbackTokens.length, '个tokens');
          setAnalyzedTokens(fallbackTokens);
          
          // 异步保存历史记录
          saveAnalysisToHistory(text, fallbackTokens, currentTranslation || '').catch(error => {
            console.error('保存历史记录失败:', error);
          });
          
          return; // 直接返回，跳过后续验证
        } else {
          throw new Error(`解析结果中未找到有效的词汇数据。原始数据包含 ${finalTokens.length} 个项目，但没有符合格式要求的词汇数据。请检查AI响应格式。`);
        }
      }
      
      // 验证解析完整性
      const hasEndMarker = jsonContent.includes('END_OF_ANALYSIS');
      const originalLength = text.replace(/\s+/g, '').length;
      const parsedCharCount = validTokens.reduce((count: number, token: TokenData) => {
        return count + (token.word ? token.word.replace(/\s+/g, '').length : 0);
      }, 0);
      
      const completenessRatio = originalLength > 0 ? parsedCharCount / originalLength : 0;
      console.log(`解析统计: 原文${originalLength}字符，解析${parsedCharCount}字符，完整度${(completenessRatio * 100).toFixed(1)}%，结束标记${hasEndMarker ? '存在' : '缺失'}`);
      
      // 更严格的完整性检查
      if (completenessRatio < 0.8) {
        setAnalysisWarning(`解析完整度较低(${(completenessRatio * 100).toFixed(1)}%)，部分内容可能丢失。建议分段处理长文本。`);
      } else if (!hasEndMarker && completenessRatio < 0.95) {
        setAnalysisWarning(`解析可能不完整，请检查结果。如有遗漏，建议重新解析。`);
      }
      
      setAnalyzedTokens(validTokens);
      
      // 异步保存历史记录
      saveAnalysisToHistory(text, validTokens, currentTranslation || '').catch(error => {
        console.error('保存历史记录失败:', error);
      });

    } catch (error) {
      console.error('解析错误:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      // 提供更具体的错误信息和建议
      if (!isStreamComplete) {
        setAnalysisError(`网络连接中断或服务器响应超时: ${errorMessage}。请检查网络连接并重试。`);
      } else {
        setAnalysisError(errorMessage);
      }
      
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
                <>
                  <button onClick={() => { setIsUserDashboardOpen(true); setIsSettingsDropdownOpen(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center">
                    <i className="fas fa-user mr-2"></i>
                    用户中心
                  </button>
                  <button onClick={() => { setIsShopModalOpen(true); setIsSettingsDropdownOpen(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center">
                    <i className="fas fa-shopping-cart mr-2"></i>
                    TOKEN商城
                  </button>
                </>
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
          {analysisWarning && !analysisError && (
            <div className="premium-card">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-3 sm:p-4 transition-colors duration-200">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <FaExclamationCircle className="text-yellow-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 transition-colors duration-200">
                      解析提醒：{analysisWarning}
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
              userApiKey={undefined}
              userApiUrl={undefined}
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
          onOpenShop={() => setIsShopModalOpen(true)}
          userInfo={{
            email: authState.user.email,
            username: authState.user.username,
            created_at: authState.user.created_at ? new Date(authState.user.created_at).toISOString() : new Date().toISOString()
          }}
        />
      )}
      
      <ShopModal
        isOpen={isShopModalOpen}
        onClose={() => setIsShopModalOpen(false)}
      />
    </div>
  );
}