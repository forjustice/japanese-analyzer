'use client';

import { useState, useEffect } from 'react';
import { FaLock, FaEye, FaEyeSlash, FaUser, FaEnvelope, FaArrowLeft, FaCheck } from 'react-icons/fa';

// 认证模式类型
type AuthMode = 'login' | 'register' | 'verify' | 'reset';

export interface AuthUser {
  id: number;
  email: string;
  username?: string;
  is_verified: boolean;
  created_at: Date;
  last_login_at?: Date;
}

interface AuthModalProps {
  isOpen: boolean;
  onAuth: (data: { token: string, user: AuthUser }) => void;
  error?: string;
  mode?: 'user'; // 只支持完整用户认证
  onModeChange?: (mode: AuthMode) => void;
}

// 简化的用户认证模态框
export default function AuthModal({ 
  isOpen, 
  onAuth, 
  error, 
  mode = 'user',
  onModeChange 
}: AuthModalProps) {
  const [currentMode, setCurrentMode] = useState<AuthMode>('login');
  const [formData, setFormData] = useState({
    password: '',
    email: '',
    username: '',
    code: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isCodeSent, setIsCodeSent] = useState(false); // 是否已发送验证码
  const [isCodeVerified, setIsCodeVerified] = useState(false); // 验证码是否已验证通过
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<{ isValid: boolean; errors: string[] }>({ isValid: false, errors: [] });

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

  // 重置表单数据
  const resetForm = () => {
    setFormData({
      password: '',
      email: '',
      username: '',
      code: '',
      newPassword: '',
      confirmPassword: ''
    });
    setLocalError('');
    setSuccessMessage('');
    setPasswordStrength({ isValid: false, errors: [] });
    setIsCodeSent(false); // 重置验证码发送状态
    setIsCodeVerified(false); // 重置验证码验证状态
  };

  // 模式切换
  const handleModeChange = (newMode: AuthMode) => {
    setCurrentMode(newMode);
    resetForm();
    onModeChange?.(newMode);
  };

  // 验证密码强度
  const validatePassword = (password: string) => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('密码长度至少8位');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('包含小写字母');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('包含大写字母');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('包含数字');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // 监听密码变化
  useEffect(() => {
    if (currentMode === 'register' && formData.password) {
      setPasswordStrength(validatePassword(formData.password));
    } else if (currentMode === 'reset' && isCodeVerified && formData.newPassword) {
      setPasswordStrength(validatePassword(formData.newPassword));
    }
  }, [formData.password, formData.newPassword, currentMode, isCodeVerified]);

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLocalError('');
    // 只有在不是重置密码验证码验证阶段时才清空成功消息
    if (!(currentMode === 'reset' && successMessage && !isCodeVerified)) {
      setSuccessMessage('');
    }

    try {
      switch (currentMode) {
        case 'login':
          // 用户登录
          const loginResponse = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password
            })
          });
          
          const loginData = await loginResponse.json();
          
          if (loginData.success) {
            // 登录成功，保存token和用户信息
            localStorage.setItem('authToken', loginData.data.token);
            localStorage.setItem('user', JSON.stringify(loginData.data.user));
            setSuccessMessage('登录成功！');
            setTimeout(() => {
              onAuth(loginData.data);
            }, 1000);
          } else {
            if (loginData.data?.needVerification) {
              // 需要邮箱验证
              setLocalError('请先验证你的邮箱地址');
              setTimeout(() => {
                handleModeChange('verify');
              }, 2000);
            } else {
              setLocalError(loginData.message || '登录失败');
            }
          }
          break;

        case 'register':
          // 验证码验证并完成注册
          if (!formData.code) {
            setLocalError('请输入验证码');
            break;
          }

          console.log('准备发送注册验证请求:', {
            email: formData.email,
            code: formData.code,
            username: formData.username,
            type: 'registration',
            hasPassword: !!formData.password
          });

          const verifyResponse = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.email,
              code: formData.code,
              password: formData.password,
              username: formData.username,
              type: 'registration'
            })
          });
          
          const verifyData = await verifyResponse.json();
          console.log('注册验证响应:', verifyData);
          console.log('响应状态:', verifyResponse.status);
          console.log('响应头:', Object.fromEntries(verifyResponse.headers.entries()));
          
          if (verifyData.success) {
            // 验证成功，自动登录
            localStorage.setItem('authToken', verifyData.data.token);
            localStorage.setItem('user', JSON.stringify(verifyData.data.user));
            setSuccessMessage('注册成功！欢迎使用日语分析器');
            setTimeout(() => {
              onAuth(verifyData.data);
            }, 1000);
          } else {
            console.error('注册失败详情:', verifyData);
            setLocalError(verifyData.message || '验证失败');
          }
          break;

        case 'verify':
          // 验证码验证
          const verifyCodeResponse = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.email,
              code: formData.code,
              type: 'registration'
            })
          });
          
          const verifyCodeData = await verifyCodeResponse.json();
          
          if (verifyCodeData.success) {
            // 验证成功，自动登录
            localStorage.setItem('authToken', verifyCodeData.data.token);
            localStorage.setItem('user', JSON.stringify(verifyCodeData.data.user));
            setSuccessMessage('验证成功！欢迎使用日语分析器');
            setTimeout(() => {
              onAuth(verifyCodeData.data);
            }, 1000);
          } else {
            setLocalError(verifyCodeData.message || '验证失败');
          }
          break;

        case 'reset':
          // 密码重置
          if (!successMessage) {
            // 第一步：请求重置验证码
            const resetRequestResponse = await fetch('/api/auth/reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: formData.email
              })
            });
            
            const resetRequestData = await resetRequestResponse.json();
            
            if (resetRequestData.success) {
              setSuccessMessage('密码重置验证码已发送到你的邮箱');
            } else {
              setLocalError(resetRequestData.message || '发送失败');
            }
          } else if (!isCodeVerified) {
            // 第二步：验证验证码
            if (!formData.code) {
              setLocalError('请输入验证码');
              break;
            }

            const verifyResponse = await fetch('/api/auth/reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: formData.email,
                code: formData.code,
                verifyOnly: true // 标识这只是验证验证码
              })
            });
            
            const verifyData = await verifyResponse.json();
            
            if (verifyData.success) {
              setIsCodeVerified(true);
              setSuccessMessage('验证码验证成功！请设置新密码');
            } else {
              setLocalError(verifyData.message || '验证码错误');
              // 验证码错误时不清空验证码，让用户可以修改
            }
          } else {
            // 第三步：使用验证码重置密码
            if (!formData.newPassword || !formData.confirmPassword) {
              setLocalError('请输入新密码');
              break;
            }

            if (formData.newPassword !== formData.confirmPassword) {
              setLocalError('两次输入的密码不一致');
              break;
            }

            // 验证新密码强度
            const passwordValidation = validatePassword(formData.newPassword);
            if (!passwordValidation.isValid) {
              setLocalError('新密码不符合要求：' + passwordValidation.errors.join('、'));
              break;
            }

            const resetResponse = await fetch('/api/auth/reset-password', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: formData.email,
                code: formData.code,
                newPassword: formData.newPassword
              })
            });
            
            const resetData = await resetResponse.json();
            
            if (resetData.success) {
              setSuccessMessage('密码重置成功！请使用新密码登录');
              setTimeout(() => {
                handleModeChange('login');
              }, 1500);
            } else {
              setLocalError(resetData.message || '重置失败');
            }
          }
          break;
      }
    } catch (error) {
      console.error('认证错误:', error);
      setLocalError('网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 发送验证码（注册时）
  const handleSendCode = async () => {
    console.log('🚀 [Frontend] 开始发送验证码流程');
    console.log('📝 [Frontend] 当前表单数据:', {
      email: formData.email,
      hasPassword: !!formData.password,
      hasConfirmPassword: !!formData.confirmPassword,
      passwordsMatch: formData.password === formData.confirmPassword,
      passwordStrength: passwordStrength
    });

    if (!formData.email || !formData.password) {
      console.error('❌ [Frontend] 邮箱或密码为空');
      setLocalError('请先填写邮箱和密码');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      console.error('❌ [Frontend] 两次密码不一致');
      setLocalError('两次输入的密码不一致');
      return;
    }

    if (!passwordStrength.isValid) {
      console.error('❌ [Frontend] 密码强度不够:', passwordStrength.errors);
      setLocalError('密码强度不够：' + passwordStrength.errors.join('、'));
      return;
    }

    setIsLoading(true);
    setLocalError('');
    
    try {
      console.log('📤 [Frontend] 发送验证码请求:', { email: formData.email });
      
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email
        })
      });
      
      const data = await response.json();
      console.log('📨 [Frontend] 验证码发送响应:', {
        status: response.status,
        success: data.success,
        message: data.message,
        data: data.data
      });
      
      if (data.success) {
        setSuccessMessage('验证码已发送到你的邮箱');
        setIsCodeSent(true);
        console.log('✅ [Frontend] 验证码发送成功');
      } else {
        console.error('❌ [Frontend] 验证码发送失败:', data.message);
        setLocalError(data.message || '发送验证码失败');
      }
    } catch (error) {
      console.error('❌ [Frontend] 发送验证码网络错误:', error);
      setLocalError('网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 重发验证码
  const handleResendCode = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccessMessage('验证码已重新发送');
      } else {
        setLocalError(data.message || '重发失败');
      }
    } catch {
      setLocalError('网络错误，请稍后重试');
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

  // 获取当前模式的标题和描述
  const getModeInfo = () => {
    switch (currentMode) {
      case 'login':
        return {
          title: '用户登录',
          description: '欢迎回来，请登录你的账户',
          icon: <FaUser className="text-primary text-2xl" />
        };
      case 'register':
        return {
          title: '注册账户',
          description: '创建你的日语分析器账户',
          icon: <FaUser className="text-green-600 dark:text-green-400 text-2xl" />
        };
      case 'verify':
        return {
          title: '邮箱验证',
          description: '请输入发送到你邮箱的验证码',
          icon: <FaEnvelope className="text-primary text-2xl" />
        };
      case 'reset':
        return {
          title: '重置密码',
          description: isCodeVerified ? '设置新密码' : (successMessage ? '输入验证码进行验证' : '找回你的密码'),
          icon: <FaLock className="text-primary text-2xl" />
        };
      default:
        return {
          title: '认证',
          description: '',
          icon: <FaLock className="text-primary text-2xl" />
        };
    }
  };

  const modeInfo = getModeInfo();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full mx-auto transition-colors duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* 返回按钮 */}
          {currentMode !== 'login' && (
            <button
              onClick={() => handleModeChange('login')}
              className="mb-4 flex items-center text-muted-foreground hover:text-foreground transition-colors"
              disabled={isLoading}
            >
              <FaArrowLeft className="mr-2" />
              返回登录
            </button>
          )}

          {/* 标题区域 */}
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 transition-colors duration-200">
              {modeInfo.icon}
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2 transition-colors duration-200">
              {modeInfo.title}
            </h2>
            <p className="text-muted-foreground transition-colors duration-200">
              {modeInfo.description}
            </p>
          </div>

          {/* 表单区域 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 邮箱输入 */}
            {(currentMode === 'login' || currentMode === 'register' || currentMode === 'verify' || currentMode === 'reset') && (
              <div>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  onKeyPress={handleKeyPress}
                  placeholder="请输入邮箱地址"
                  className="w-full px-4 py-3 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-ring transition duration-150 ease-in-out"
                  disabled={isLoading}
                  required
                />
              </div>
            )}

            {/* 用户名输入（仅注册时） */}
            {currentMode === 'register' && (
              <div>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  onKeyPress={handleKeyPress}
                  placeholder="用户名（可选）"
                  className="w-full px-4 py-3 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-ring transition duration-150 ease-in-out"
                  disabled={isLoading}
                />
              </div>
            )}

            {/* 密码输入 */}
            {(currentMode === 'login' || currentMode === 'register') && (
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  onKeyPress={handleKeyPress}
                  placeholder="请输入密码"
                  className="w-full px-4 py-3 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-ring transition duration-150 ease-in-out pr-12"
                  disabled={isLoading}
                  required
                  autoFocus={currentMode === 'login'}
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
            )}

            {/* 确认密码输入（仅注册和重置密码验证通过时） */}
            {(currentMode === 'register' || (currentMode === 'reset' && isCodeVerified)) && (
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  onKeyPress={handleKeyPress}
                  placeholder="确认密码"
                  className="w-full px-4 py-3 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-ring transition duration-150 ease-in-out pr-12"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors duration-200"
                  disabled={isLoading}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            )}

            {/* 新密码输入（重置密码时，且验证码已验证通过） */}
            {currentMode === 'reset' && isCodeVerified && (
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                  onKeyPress={handleKeyPress}
                  placeholder="新密码"
                  className="w-full px-4 py-3 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-ring transition duration-150 ease-in-out pr-12"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors duration-200"
                  disabled={isLoading}
                >
                  {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            )}

            {/* 验证码输入 */}
            {(currentMode === 'verify' || currentMode === 'register' || (currentMode === 'reset' && successMessage && !isCodeVerified)) && (
              <div>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, code: e.target.value.replace(/\D/g, '').slice(0, 6) }));
                    // 用户重新输入验证码时清除错误信息
                    if (localError) {
                      setLocalError('');
                    }
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder="请输入6位验证码"
                  className="w-full px-4 py-3 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-ring transition duration-150 ease-in-out text-center text-2xl tracking-widest"
                  disabled={isLoading}
                  required
                  maxLength={6}
                />
                {(currentMode === 'verify' || currentMode === 'register') && (
                  <div className="mt-2 text-center space-y-2">
                    {currentMode === 'register' && (
                      <div className="flex gap-2 justify-center">
                        <button
                          type="button"
                          onClick={handleSendCode}
                          className="text-sm bg-primary text-primary-foreground px-3 py-1 rounded hover:bg-primary/90 disabled:opacity-50"
                          disabled={isLoading || !formData.email || !formData.password || !passwordStrength.isValid}
                        >
                          {isCodeSent ? '重新发送验证码' : '发送验证码'}
                        </button>
                      </div>
                    )}
                    {currentMode === 'verify' && (
                      <button
                        type="button"
                        onClick={handleResendCode}
                        className="text-sm text-primary hover:underline"
                        disabled={isLoading}
                      >
                        重新发送验证码
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 密码强度提示 */}
            {((currentMode === 'register' && formData.password) || (currentMode === 'reset' && isCodeVerified && formData.newPassword)) && (
              <div className="text-sm">
                <div className="flex items-center mb-1">
                  <span className="text-muted-foreground">密码强度:</span>
                  {passwordStrength.isValid ? (
                    <FaCheck className="ml-2 text-green-500" />
                  ) : (
                    <span className="ml-2 text-red-500">不足</span>
                  )}
                </div>
                {!passwordStrength.isValid && (
                  <ul className="text-red-500 text-xs space-y-1">
                    {passwordStrength.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* 错误信息 */}
            {(error || localError) && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 transition-colors duration-200">
                <p className="text-red-700 dark:text-red-300 text-sm transition-colors duration-200">
                  {error || localError}
                </p>
              </div>
            )}

            {/* 成功信息 */}
            {successMessage && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 transition-colors duration-200">
                <p className="text-green-700 dark:text-green-300 text-sm transition-colors duration-200">
                  {successMessage}
                </p>
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={isLoading || (currentMode === 'register' && (!formData.code || !isCodeSent))}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 px-4 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground mr-2"></div>
                  处理中...
                </>
              ) : (
                (() => {
                  switch (currentMode) {
                    case 'login': return '登录';
                    case 'register': return '注册';
                    case 'verify': return '验证';
                    case 'reset': return isCodeVerified ? '重置密码' : (successMessage ? '验证验证码' : '发送验证码');
                    default: return '确认';
                  }
                })()
              )}
            </button>
          </form>

          {/* 底部链接 */}
          {mode === 'user' && (
            <div className="mt-6 text-center space-y-2">
              {currentMode === 'login' && (
                <>
                  <p className="text-sm text-muted-foreground">
                    还没有账户？
                    <button
                      onClick={() => handleModeChange('register')}
                      className="ml-1 text-primary hover:underline"
                      disabled={isLoading}
                    >
                      立即注册
                    </button>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    忘记密码？
                    <button
                      onClick={() => handleModeChange('reset')}
                      className="ml-1 text-primary hover:underline"
                      disabled={isLoading}
                    >
                      重置密码
                    </button>
                  </p>
                </>
              )}
              {currentMode === 'register' && (
                <p className="text-sm text-muted-foreground">
                  已有账户？
                  <button
                    onClick={() => handleModeChange('login')}
                    className="ml-1 text-primary hover:underline"
                    disabled={isLoading}
                  >
                    立即登录
                  </button>
                </p>
              )}
            </div>
          )}

          {/* 底部说明 */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground transition-colors duration-200">
              注册即表示你同意我们的服务条款和隐私政策
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}