'use client';

import { useState, useEffect } from 'react';
import { FaUser, FaChartLine, FaTimes, FaCalendarAlt, FaRobot, FaLanguage, FaVolumeUp, FaFileImage } from 'react-icons/fa';

interface UserTokenStats {
  totalTokens30Days: number;
  analyzeTokens: number;
  translateTokens: number;
  ttsTokens: number;
  ocrTokens: number;
  totalRequests30Days: number;
  daysRemaining: number;
  trialEndDate: string;
  registrationDate: string;
}

interface DailyStats {
  date: string;
  totalTokens: number;
  totalRequests: number;
  analyzeTokens: number;
  translateTokens: number;
  ttsTokens: number;
  ocrTokens: number;
}

interface UserDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  userInfo: {
    email: string;
    username?: string;
    created_at: string;
  };
}

export default function UserDashboard({ isOpen, onClose, userInfo }: UserDashboardProps) {
  const [stats, setStats] = useState<UserTokenStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const TOKEN_LIMIT = 100000; // 30天内的TOKEN限制

  useEffect(() => {
    if (isOpen) {
      fetchUserStats();
    }
  }, [isOpen]);

  const fetchUserStats = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('/api/user/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        }
      });

      if (!response.ok) {
        throw new Error('获取用户统计失败');
      }

      const data = await response.json();
      setStats(data.stats);
      setDailyStats(data.dailyStats || []);
    } catch (err) {
      console.error('获取用户统计错误:', err);
      setError('获取统计数据失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  const getUsagePercentage = () => {
    if (!stats) return 0;
    return Math.min((stats.totalTokens30Days / TOKEN_LIMIT) * 100, 100);
  };

  const getUsageColor = () => {
    const percentage = getUsagePercentage();
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  const aggregateDailyStats = (): DailyStats[] => {
    if (!dailyStats.length) {
      // 如果没有数据，返回最近7天的空数据
      const emptyDays: DailyStats[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        emptyDays.push({
          date: date.toISOString().split('T')[0],
          totalTokens: 0,
          totalRequests: 0,
          analyzeTokens: 0,
          translateTokens: 0,
          ttsTokens: 0,
          ocrTokens: 0
        });
      }
      return emptyDays;
    }
    
    return dailyStats.slice(0, 7); // 直接使用后端返回的数据，最多7天
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center">
            <FaUser className="text-blue-600 mr-3 text-xl" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">用户中心</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="loading-spinner mr-3"></div>
              <span className="text-gray-600 dark:text-gray-400">加载统计数据...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchUserStats}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                重新加载
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 用户信息卡片 */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">账户信息</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">邮箱</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{userInfo.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">用户名</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{userInfo.username || '未设置'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">注册时间</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(userInfo.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* TOKEN使用量概览 */}
              {stats && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 30天试用统计 */}
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">30天试用统计</h3>
                      <FaCalendarAlt className="text-blue-600" />
                    </div>
                    
                    {/* 总体使用量 */}
                    <div className="mb-6">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">TOKEN使用量</span>
                        <span className={`font-bold ${getUsageColor()}`}>
                          {stats.totalTokens30Days.toLocaleString()} / {TOKEN_LIMIT.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full transition-all duration-300 ${
                            getUsagePercentage() >= 90 ? 'bg-red-500' :
                            getUsagePercentage() >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${getUsagePercentage()}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        使用率: {getUsagePercentage().toFixed(1)}%
                      </p>
                    </div>

                    {/* 剩余天数 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-gray-50 dark:bg-gray-600 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600">{stats.daysRemaining}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">剩余天数</p>
                      </div>
                      <div className="text-center p-3 bg-gray-50 dark:bg-gray-600 rounded-lg">
                        <p className="text-2xl font-bold text-green-600">{stats.totalRequests30Days}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">总请求次数</p>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                      试用期至: {formatDate(stats.trialEndDate)}
                    </p>
                  </div>

                  {/* 功能使用分布 */}
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">功能使用分布</h3>
                      <FaChartLine className="text-green-600" />
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <FaRobot className="text-blue-600 mr-2" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">句子解析</span>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {stats.analyzeTokens.toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <FaLanguage className="text-green-600 mr-2" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">文本翻译</span>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {stats.translateTokens.toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <FaVolumeUp className="text-purple-600 mr-2" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">语音合成</span>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {stats.ttsTokens.toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <FaFileImage className="text-orange-600 mr-2" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">文字识别</span>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {stats.ocrTokens.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 最近使用趋势 */}
              {aggregateDailyStats().length > 0 && (
                <div className="bg-white dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">最近7天使用趋势</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-600">
                          <th className="text-left py-2 text-gray-600 dark:text-gray-400">日期</th>
                          <th className="text-right py-2 text-gray-600 dark:text-gray-400">TOKEN使用量</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aggregateDailyStats().map((day, index) => (
                          <tr key={index} className="border-b border-gray-100 dark:border-gray-600">
                            <td className="py-2 text-gray-900 dark:text-gray-100">{formatDate(day.date)}</td>
                            <td className="py-2 text-right font-medium text-gray-900 dark:text-gray-100">
                              {day.totalTokens.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 说明信息 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">使用说明</h4>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• 新用户可在注册后30天内免费使用{TOKEN_LIMIT.toLocaleString()}个TOKEN</li>
                  <li>• TOKEN消耗包括所有AI功能：句子解析、翻译、语音合成、文字识别等</li>
                  <li>• 使用量实时更新，建议合理分配使用</li>
                  <li>• 试用期结束后如需继续使用，请联系客服</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}