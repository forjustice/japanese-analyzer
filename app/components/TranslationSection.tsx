'use client';

import { useState, useEffect } from 'react';
import { translateText } from '../services/api';

interface TranslationSectionProps {
  japaneseText: string;
  trigger?: number;
  onTranslationUpdate?: (translation: string) => void;
}

export default function TranslationSection({
  japaneseText,
  trigger,
  onTranslationUpdate
}: TranslationSectionProps) {
  const [translation, setTranslation] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const handleTranslate = async () => {
    if (!japaneseText) {
      alert('请先输入或分析日语句子！');
      return;
    }

    setIsLoading(true);
    setIsVisible(true);
    setTranslation('');

    try {
      const translatedText = await translateText(japaneseText);
      setTranslation(translatedText);
      if (onTranslationUpdate) {
        onTranslationUpdate(translatedText);
      }
    } catch (error) {
      console.error('Error during full sentence translation:', error);
      setTranslation(`翻译时发生错误: ${error instanceof Error ? error.message : '未知错误'}。`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  useEffect(() => {
    if (trigger && japaneseText) {
      handleTranslate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return (
    <>
      <div className="mt-6 flex flex-col sm:flex-row sm:justify-center space-y-3 sm:space-y-0 sm:space-x-4">
        <button 
          id="translateSentenceButton" 
          className="premium-button premium-button-primary w-full sm:w-auto"
          onClick={handleTranslate}
          disabled={isLoading}
        >
          {!isLoading && <span className="button-text">翻译整句</span>}
          <div className="loading-spinner" style={{ display: isLoading ? 'inline-block' : 'none' }}></div>
          {isLoading && <span className="button-text">翻译中...</span>}
        </button>
      </div>

      {(isLoading || translation) && (
        <div id="fullTranslationCard" className="premium-card mt-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300" style={{ marginBottom: isVisible ? '0.75rem' : '0' }}>中文翻译</h2>
            <button 
              id="toggleFullTranslationButton" 
              className="premium-button premium-button-outlined text-sm px-3 py-1"
              onClick={toggleVisibility}
            >
              {isVisible ? '隐藏' : '显示'}
            </button>
          </div>
          
          {isVisible && (
            <div id="fullTranslationOutput" className="text-gray-800 dark:text-gray-200 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg min-h-[50px] whitespace-pre-wrap">
              {isLoading && !translation ? (
                <div className="flex items-center justify-center py-4">
                  <div className="loading-spinner"></div>
                  <span className="ml-2 text-gray-500 dark:text-gray-400">正在翻译，请稍候...</span>
                </div>
              ) : (
                translation
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
