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

// 检查用户是否已登录
function isUserLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('authToken');
}

// 获取API请求头
function getApiHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const authToken = localStorage.getItem('authToken');
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

/**
 * 获取所有历史记录
 */
export async function getAnalysisHistory(): Promise<AnalysisHistoryItem[]> {
  if (isUserLoggedIn()) {
    return getServerHistory();
  } else {
    return getLocalHistory();
  }
}

// 从服务器获取历史记录
async function getServerHistory(): Promise<AnalysisHistoryItem[]> {
  try {
    const response = await fetch('/api/history', {
      method: 'GET',
      headers: getApiHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch server history');
    }

    const data = await response.json();
    if (data.success && data.history) {
      // 转换服务器格式到本地格式
      interface ServerHistoryItem {
        id: string;
        updatedAt: string;
        originalText: string;
        tokens: Array<{
          word: string;
          pos: string;
          furigana?: string;
          romaji?: string;
        }>;
        translation?: string;
      }

      return data.history.map((item: ServerHistoryItem) => ({
        id: item.id,
        timestamp: new Date(item.updatedAt).getTime(),
        originalText: item.originalText,
        tokens: item.tokens,
        translation: item.translation
      }));
    }
    return [];
  } catch (error) {
    console.error('Failed to load server history, falling back to local:', error);
    return getLocalHistory();
  }
}

// 从本地存储获取历史记录
function getLocalHistory(): AnalysisHistoryItem[] {
  try {
    const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!storedHistory) return [];
    
    const history = JSON.parse(storedHistory) as AnalysisHistoryItem[];
    // 按时间戳降序排列（最新的在前面）
    return history.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Failed to load local history:', error);
    return [];
  }
}

/**
 * 保存新的分析记录到历史
 */
export async function saveAnalysisToHistory(
  originalText: string,
  tokens: Array<{
    word: string;
    pos: string;
    furigana?: string;
    romaji?: string;
  }>,
  translation?: string
): Promise<void> {
  if (isUserLoggedIn()) {
    return saveToServerHistory(originalText, tokens, translation);
  } else {
    return saveToLocalHistory(originalText, tokens, translation);
  }
}

// 保存到服务器
async function saveToServerHistory(
  originalText: string,
  tokens: Array<{
    word: string;
    pos: string;
    furigana?: string;
    romaji?: string;
  }>,
  translation?: string
): Promise<void> {
  try {
    const response = await fetch('/api/history', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({
        originalText,
        tokens,
        translation
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save to server');
    }

    // 同时保存到本地作为备份
    saveToLocalHistory(originalText, tokens, translation);
  } catch (error) {
    console.error('Failed to save to server, saving locally:', error);
    saveToLocalHistory(originalText, tokens, translation);
  }
}

// 保存到本地存储
function saveToLocalHistory(
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
    const existingHistory = getLocalHistory();
    
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
    console.error('Failed to save local history:', error);
  }
}

/**
 * 删除指定的历史记录
 */
export async function deleteHistoryItem(id: string): Promise<void> {
  if (isUserLoggedIn()) {
    return deleteFromServerHistory(id);
  } else {
    return deleteFromLocalHistory(id);
  }
}

// 从服务器删除
async function deleteFromServerHistory(id: string): Promise<void> {
  try {
    const response = await fetch(`/api/history?id=${id}`, {
      method: 'DELETE',
      headers: getApiHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to delete from server');
    }

    // 同时从本地删除
    deleteFromLocalHistory(id);
  } catch (error) {
    console.error('Failed to delete from server:', error);
    deleteFromLocalHistory(id);
  }
}

// 从本地删除
function deleteFromLocalHistory(id: string): void {
  try {
    const existingHistory = getLocalHistory();
    const updatedHistory = existingHistory.filter(item => item.id !== id);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error('Failed to delete local history item:', error);
  }
}

/**
 * 清除所有历史记录
 */
export async function clearAllHistory(): Promise<void> {
  if (isUserLoggedIn()) {
    return clearServerHistory();
  } else {
    return clearLocalHistory();
  }
}

// 清除服务器历史记录
async function clearServerHistory(): Promise<void> {
  try {
    const response = await fetch('/api/history?clearAll=true', {
      method: 'DELETE',
      headers: getApiHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to clear server history');
    }

    // 同时清除本地
    clearLocalHistory();
  } catch (error) {
    console.error('Failed to clear server history:', error);
    clearLocalHistory();
  }
}

// 清除本地历史记录
function clearLocalHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear local history:', error);
  }
}

/**
 * 根据文本搜索历史记录
 */
export async function searchHistory(query: string): Promise<AnalysisHistoryItem[]> {
  if (isUserLoggedIn()) {
    return searchServerHistory(query);
  } else {
    return searchLocalHistory(query);
  }
}

// 搜索服务器历史记录
async function searchServerHistory(query: string): Promise<AnalysisHistoryItem[]> {
  try {
    const response = await fetch(`/api/history?query=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: getApiHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to search server history');
    }

    const data = await response.json();
    if (data.success && data.history) {
      interface ServerHistoryItem {
        id: string;
        updatedAt: string;
        originalText: string;
        tokens: Array<{
          word: string;
          pos: string;
          furigana?: string;
          romaji?: string;
        }>;
        translation?: string;
      }

      return data.history.map((item: ServerHistoryItem) => ({
        id: item.id,
        timestamp: new Date(item.updatedAt).getTime(),
        originalText: item.originalText,
        tokens: item.tokens,
        translation: item.translation
      }));
    }
    return [];
  } catch (error) {
    console.error('Failed to search server history, falling back to local:', error);
    return searchLocalHistory(query);
  }
}

// 搜索本地历史记录
function searchLocalHistory(query: string): AnalysisHistoryItem[] {
  const history = getLocalHistory();
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
export async function importHistory(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const importedHistory = JSON.parse(content) as AnalysisHistoryItem[];
        
        // 验证数据格式
        if (!Array.isArray(importedHistory)) {
          throw new Error('Invalid history format');
        }

        if (isUserLoggedIn()) {
          // 如果用户已登录，导入到服务器
          const importedCount = await importToServer(importedHistory);
          resolve(importedCount);
        } else {
          // 否则导入到本地存储
          const importedCount = importToLocal(importedHistory);
          resolve(importedCount);
        }
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// 导入到服务器
async function importToServer(importedHistory: AnalysisHistoryItem[]): Promise<number> {
  try {
    const response = await fetch('/api/history/import', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({
        historyItems: importedHistory
      })
    });

    if (!response.ok) {
      throw new Error('Failed to import to server');
    }

    const data = await response.json();
    return data.importedCount || 0;
  } catch (error) {
    console.error('Failed to import to server, falling back to local:', error);
    return importToLocal(importedHistory);
  }
}

// 导入到本地存储
function importToLocal(importedHistory: AnalysisHistoryItem[]): number {
  try {
    const existingHistory = getLocalHistory();
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
    return importedHistory.length;
  } catch (error) {
    console.error('Failed to import to local storage:', error);
    return 0;
  }
}

/**
 * 迁移本地历史记录到服务器（用户登录后自动调用）
 */
export async function migrateLocalHistoryToServer(): Promise<number> {
  if (!isUserLoggedIn()) {
    return 0;
  }

  try {
    const localHistory = getLocalHistory();
    if (localHistory.length === 0) {
      return 0;
    }

    const response = await fetch('/api/history/import', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({
        historyItems: localHistory
      })
    });

    if (!response.ok) {
      throw new Error('Failed to migrate to server');
    }

    const data = await response.json();
    const migratedCount = data.importedCount || 0;

    // 迁移成功后，可以选择清除本地历史记录
    // clearLocalHistory();

    console.log(`Successfully migrated ${migratedCount} history items to server`);
    return migratedCount;
  } catch (error) {
    console.error('Failed to migrate local history to server:', error);
    return 0;
  }
}