'use client';

import { useState, useEffect } from 'react';
import { FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';

interface LoginModalProps {
  isOpen: boolean;
  onLogin: (password: string) => void;
  error?: string;
}

export default function LoginModal({ isOpen, onLogin, error }: LoginModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 防止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    try {
      await onLogin(password);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSubmit(e as React.FormEvent);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full mx-auto transition-colors duration-200">
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 transition-colors duration-200">
              <FaLock className="text-primary text-2xl" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2 transition-colors duration-200">访问验证</h2>
            <p className="text-muted-foreground transition-colors duration-200">请输入访问密码以继续使用</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="请输入访问密码"
                className="w-full px-4 py-3 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-ring transition duration-150 ease-in-out pr-12"
                disabled={isLoading}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors duration-200"
                disabled={isLoading}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 transition-colors duration-200">
                <p className="text-destructive text-sm transition-colors duration-200">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!password.trim() || isLoading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 px-4 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground mr-2"></div>
                  验证中...
                </>
              ) : (
                '验证密码'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground transition-colors duration-200">
              请联系管理员获取访问密码
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 