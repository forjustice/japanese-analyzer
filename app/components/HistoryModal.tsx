'use client';

import { useState, useEffect } from 'react';
import { 
  getAnalysisHistory, 
  deleteHistoryItem, 
  clearAllHistory, 
  searchHistory, 
  formatTimestamp,
  exportHistory,
  importHistory,
  AnalysisHistoryItem 
} from '../utils/history';
import { FaTrash, FaDownload, FaUpload, FaSearch, FaTimes, FaPlay, FaHistory } from 'react-icons/fa';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectHistory: (item: AnalysisHistoryItem) => void;
}

export default function HistoryModal({ isOpen, onClose, onSelectHistory }: HistoryModalProps) {
  const [, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredHistory, setFilteredHistory] = useState<AnalysisHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 加载历史记录
  const loadHistory = () => {
    setIsLoading(true);
    const historyData = getAnalysisHistory();
    setHistory(historyData);
    setFilteredHistory(historyData);
    setIsLoading(false);
  };

  // 搜索历史记录
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const filtered = searchHistory(query);
    setFilteredHistory(filtered);
  };

  // 删除单个历史记录
  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这条历史记录吗？')) {
      deleteHistoryItem(id);
      loadHistory();
    }
  };

  // 清空所有历史记录
  const handleClearAll = () => {
    if (confirm('确定要清空所有历史记录吗？此操作不可恢复。')) {
      clearAllHistory();
      loadHistory();
    }
  };

  // 导出历史记录
  const handleExport = () => {
    try {
      exportHistory();
    } catch (error) {
      alert('导出失败：' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  // 导入历史记录
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    importHistory(file)
      .then((count) => {
        alert(`成功导入 ${count} 条历史记录`);
        loadHistory();
      })
      .catch((error) => {
        alert('导入失败：' + (error instanceof Error ? error.message : '文件格式错误'));
      });

    // 清空文件输入
    e.target.value = '';
  };

  // 选择历史记录
  const handleSelectHistory = (item: AnalysisHistoryItem) => {
    onSelectHistory(item);
    onClose();
  };

  // 截断文本显示
  const truncateText = (text: string, maxLength: number = 50) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // 打开模态框时加载历史记录
  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center">
            <FaHistory className="text-blue-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              解析历史记录
            </h2>
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              ({filteredHistory.length} 条记录)
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl"
          >
            <FaTimes />
          </button>
        </div>

        {/* 搜索和操作栏 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* 搜索框 */}
            <div className="flex-1 relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="搜索历史记录..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* 操作按钮 */}
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 
                         transition-colors flex items-center gap-1 text-sm"
                title="导出历史记录"
              >
                <FaDownload />
                导出
              </button>
              
              <label className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 
                              transition-colors flex items-center gap-1 text-sm cursor-pointer"
                     title="导入历史记录">
                <FaUpload />
                导入
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
              
              <button
                onClick={handleClearAll}
                className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 
                         transition-colors flex items-center gap-1 text-sm"
                title="清空所有历史记录"
              >
                <FaTrash />
                清空
              </button>
            </div>
          </div>
        </div>

        {/* 历史记录列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="loading-spinner"></div>
              <span className="ml-2 text-gray-600 dark:text-gray-400">加载中...</span>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {searchQuery ? '没有找到匹配的历史记录' : '暂无历史记录'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((item) => (
                <div
                  key={item.id}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 cursor-pointer 
                           hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors
                           border border-gray-200 dark:border-gray-600"
                  onClick={() => handleSelectHistory(item)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* 原文 */}
                      <div className="flex items-center gap-2 mb-2">
                        <FaPlay className="text-blue-500 text-sm flex-shrink-0" />
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {truncateText(item.originalText)}
                        </span>
                      </div>
                      
                      {/* 翻译 */}
                      {item.translation && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2 ml-6">
                          {truncateText(item.translation)}
                        </div>
                      )}
                      
                      {/* 词汇数量和时间 */}
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 ml-6">
                        <span>
                          {item.tokens.length} 个词汇
                        </span>
                        <span>
                          {formatTimestamp(item.timestamp)}
                        </span>
                      </div>
                    </div>
                    
                    {/* 删除按钮 */}
                    <button
                      onClick={(e) => handleDeleteItem(item.id, e)}
                      className="ml-3 p-2 text-red-500 hover:text-red-700 dark:text-red-400 
                               dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 
                               rounded transition-colors flex-shrink-0"
                      title="删除此记录"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            点击历史记录可重新加载，历史记录保存在浏览器本地存储中
          </p>
        </div>
      </div>
    </div>
  );
}