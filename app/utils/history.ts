// 历史记录相关的工具函数

export interface AnalysisHistoryItem {
  id: string;
  timestamp: number;
  originalText: string;
  tokens: Array<{
    word: string;
    pos: string;
    furigana?: string;
    romaji?: string;
  }>;
  translation?: string;
}

const HISTORY_STORAGE_KEY = 'japanese_analyzer_history';
const MAX_HISTORY_ITEMS = 100; // 最多保存100条历史记录

/**
 * 获取所有历史记录
 */
export function getAnalysisHistory(): AnalysisHistoryItem[] {
  try {
    const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!storedHistory) return [];
    
    const history = JSON.parse(storedHistory) as AnalysisHistoryItem[];
    // 按时间戳降序排列（最新的在前面）
    return history.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Failed to load history:', error);
    return [];
  }
}

/**
 * 保存新的分析记录到历史
 */
export function saveAnalysisToHistory(
  originalText: string,
  tokens: Array<{
    word: string;
    pos: string;
    furigana?: string;
    romaji?: string;
  }>,
  translation?: string
): void {
  try {
    const existingHistory = getAnalysisHistory();
    
    // 检查是否已存在相同的文本（避免重复保存）
    const existingItem = existingHistory.find(item => item.originalText === originalText);
    if (existingItem) {
      // 更新现有记录的时间戳
      existingItem.timestamp = Date.now();
      existingItem.tokens = tokens;
      if (translation) {
        existingItem.translation = translation;
      }
    } else {
      // 创建新的历史记录项
      const newItem: AnalysisHistoryItem = {
        id: generateHistoryId(),
        timestamp: Date.now(),
        originalText,
        tokens,
        translation
      };
      
      existingHistory.unshift(newItem);
    }
    
    // 限制历史记录数量
    const limitedHistory = existingHistory.slice(0, MAX_HISTORY_ITEMS);
    
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(limitedHistory));
  } catch (error) {
    console.error('Failed to save history:', error);
  }
}

/**
 * 删除指定的历史记录
 */
export function deleteHistoryItem(id: string): void {
  try {
    const existingHistory = getAnalysisHistory();
    const updatedHistory = existingHistory.filter(item => item.id !== id);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error('Failed to delete history item:', error);
  }
}

/**
 * 清除所有历史记录
 */
export function clearAllHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear history:', error);
  }
}

/**
 * 根据文本搜索历史记录
 */
export function searchHistory(query: string): AnalysisHistoryItem[] {
  const history = getAnalysisHistory();
  if (!query.trim()) return history;
  
  const lowerQuery = query.toLowerCase();
  return history.filter(item => 
    item.originalText.toLowerCase().includes(lowerQuery) ||
    (item.translation && item.translation.toLowerCase().includes(lowerQuery))
  );
}

/**
 * 生成唯一的历史记录ID
 */
function generateHistoryId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 格式化时间戳为可读字符串
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 1) {
    const diffInMinutes = Math.floor(diffInHours * 60);
    return diffInMinutes <= 0 ? '刚刚' : `${diffInMinutes}分钟前`;
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)}小时前`;
  } else if (diffInHours < 24 * 7) {
    return `${Math.floor(diffInHours / 24)}天前`;
  } else {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

/**
 * 导出历史记录为JSON文件
 */
export function exportHistory(): void {
  try {
    const history = getAnalysisHistory();
    const dataStr = JSON.stringify(history, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `japanese_analyzer_history_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Failed to export history:', error);
  }
}

/**
 * 从文件导入历史记录
 */
export function importHistory(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedHistory = JSON.parse(content) as AnalysisHistoryItem[];
        
        // 验证数据格式
        if (!Array.isArray(importedHistory)) {
          throw new Error('Invalid history format');
        }
        
        const existingHistory = getAnalysisHistory();
        const combinedHistory = [...importedHistory, ...existingHistory];
        
        // 去重（基于originalText）
        const uniqueHistory = combinedHistory.reduce((acc, item) => {
          const existing = acc.find(h => h.originalText === item.originalText);
          if (!existing) {
            acc.push(item);
          } else if (item.timestamp > existing.timestamp) {
            // 如果导入的记录更新，替换现有记录
            const index = acc.indexOf(existing);
            acc[index] = item;
          }
          return acc;
        }, [] as AnalysisHistoryItem[]);
        
        // 按时间排序并限制数量
        const sortedHistory = uniqueHistory
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, MAX_HISTORY_ITEMS);
        
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(sortedHistory));
        resolve(importedHistory.length);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}