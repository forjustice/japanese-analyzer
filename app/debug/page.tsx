'use client';

import { useState } from 'react';

export default function DebugPage() {
  const [environmentResult, setEnvironmentResult] = useState<any>(null);
  const [sendCodeResult, setSendCodeResult] = useState<any>(null);
  const [debugResult, setDebugResult] = useState<any>(null);
  const [fullRegResult, setFullRegResult] = useState<any>(null);
  const [diagnosticData, setDiagnosticData] = useState<any>({});

  const [testEmail, setTestEmail] = useState('test@example.com');
  const [debugEmail, setDebugEmail] = useState('test@example.com');
  const [debugCode, setDebugCode] = useState('');
  const [regEmail, setRegEmail] = useState('test@example.com');
  const [regPassword, setRegPassword] = useState('TestPassword123');
  const [regUsername, setRegUsername] = useState('testuser');
  const [regCode, setRegCode] = useState('');

  const log = (message: string, setter?: (value: any) => void) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    
    if (setter) {
      setter((prev: any) => prev + logMessage + '\n');
    }
    
    console.log(logMessage);
  };

  const checkEnvironment = async () => {
    log('🔍 检查环境信息...', setEnvironmentResult);
    
    try {
      const response = await fetch('/api/debug/environment');
      const data = await response.json();
      
      setDiagnosticData(prev => ({ ...prev, environment: data.data }));
      
      log(`📊 环境检查完成`, setEnvironmentResult);
      log(`Node环境: ${data.data.environment.nodeEnv}`, setEnvironmentResult);
      log(`Vercel环境: ${data.data.environment.vercel.env}`, setEnvironmentResult);
      log(`时区: ${data.data.environment.timezone}`, setEnvironmentResult);
      log(`数据库状态: ${data.data.database.status}`, setEnvironmentResult);
      
      if (data.data.database.error) {
        log(`❌ 数据库错误: ${data.data.database.error.message}`, setEnvironmentResult);
      }
      
      log(JSON.stringify(data.data, null, 2), setEnvironmentResult);
      
    } catch (error) {
      log(`❌ 环境检查失败: ${(error as Error).message}`, setEnvironmentResult);
    }
  };

  const testSendCode = async () => {
    log(`🚀 测试发送验证码: ${testEmail}`, setSendCodeResult);
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail })
      });
      
      const data = await response.json();
      
      log(`📨 响应状态: ${response.status}`, setSendCodeResult);
      log(`📨 响应数据: ${JSON.stringify(data, null, 2)}`, setSendCodeResult);
      
      if (data.success && data.data?.code) {
        setDebugCode(data.data.code);
        setRegCode(data.data.code);
        log(`✅ 验证码已自动填入: ${data.data.code}`, setSendCodeResult);
      }
      
    } catch (error) {
      log(`❌ 发送验证码失败: ${(error as Error).message}`, setSendCodeResult);
    }
  };

  const debugVerifyCode = async () => {
    log(`🔍 调试验证码: ${debugEmail} - ${debugCode}`, setDebugResult);
    
    try {
      const response = await fetch('/api/debug/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: debugEmail, code: debugCode, type: 'registration' })
      });
      
      const data = await response.json();
      
      setDiagnosticData(prev => ({ ...prev, verifyCode: data.data }));
      
      log(`📊 验证码调试完成`, setDebugResult);
      log(JSON.stringify(data.data, null, 2), setDebugResult);
      
    } catch (error) {
      log(`❌ 验证码调试失败: ${(error as Error).message}`, setDebugResult);
    }
  };

  const testFullRegistration = async () => {
    log(`🧪 完整注册测试: ${regEmail}`, setFullRegResult);
    
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: regEmail, 
          code: regCode, 
          password: regPassword, 
          username: regUsername, 
          type: 'registration' 
        })
      });
      
      const data = await response.json();
      
      log(`📨 注册响应状态: ${response.status}`, setFullRegResult);
      log(`📨 注册响应数据: ${JSON.stringify(data, null, 2)}`, setFullRegResult);
      
      if (data.success) {
        log(`✅ 注册成功!`, setFullRegResult);
      } else {
        log(`❌ 注册失败: ${data.message}`, setFullRegResult);
      }
      
    } catch (error) {
      log(`❌ 注册测试失败: ${(error as Error).message}`, setFullRegResult);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-center text-gray-800 dark:text-gray-100">
        🔍 Vercel环境调试工具
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 环境信息检查 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-blue-600 dark:text-blue-400">
            📊 环境信息检查
          </h2>
          <button
            onClick={checkEnvironment}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mb-4"
          >
            检查环境
          </button>
          {environmentResult && (
            <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded text-sm overflow-auto max-h-64">
              {environmentResult}
            </pre>
          )}
        </div>

        {/* 发送验证码测试 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-green-600 dark:text-green-400">
            📤 发送验证码测试
          </h2>
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="邮箱"
            className="w-full p-2 border rounded mb-4 dark:bg-gray-700 dark:border-gray-600"
          />
          <button
            onClick={testSendCode}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded mb-4"
          >
            发送验证码
          </button>
          {sendCodeResult && (
            <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded text-sm overflow-auto max-h-64">
              {sendCodeResult}
            </pre>
          )}
        </div>

        {/* 验证码调试 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-purple-600 dark:text-purple-400">
            🔐 验证码调试
          </h2>
          <input
            type="email"
            value={debugEmail}
            onChange={(e) => setDebugEmail(e.target.value)}
            placeholder="邮箱"
            className="w-full p-2 border rounded mb-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <input
            type="text"
            value={debugCode}
            onChange={(e) => setDebugCode(e.target.value)}
            placeholder="验证码"
            maxLength={6}
            className="w-full p-2 border rounded mb-4 dark:bg-gray-700 dark:border-gray-600"
          />
          <button
            onClick={debugVerifyCode}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded mb-4"
          >
            调试验证码
          </button>
          {debugResult && (
            <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded text-sm overflow-auto max-h-64">
              {debugResult}
            </pre>
          )}
        </div>

        {/* 完整注册测试 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-red-600 dark:text-red-400">
            🧪 完整注册测试
          </h2>
          <input
            type="email"
            value={regEmail}
            onChange={(e) => setRegEmail(e.target.value)}
            placeholder="邮箱"
            className="w-full p-2 border rounded mb-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <input
            type="password"
            value={regPassword}
            onChange={(e) => setRegPassword(e.target.value)}
            placeholder="密码"
            className="w-full p-2 border rounded mb-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <input
            type="text"
            value={regUsername}
            onChange={(e) => setRegUsername(e.target.value)}
            placeholder="用户名"
            className="w-full p-2 border rounded mb-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <input
            type="text"
            value={regCode}
            onChange={(e) => setRegCode(e.target.value)}
            placeholder="验证码"
            maxLength={6}
            className="w-full p-2 border rounded mb-4 dark:bg-gray-700 dark:border-gray-600"
          />
          <button
            onClick={testFullRegistration}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded mb-4"
          >
            完整注册测试
          </button>
          {fullRegResult && (
            <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded text-sm overflow-auto max-h-64">
              {fullRegResult}
            </pre>
          )}
        </div>
      </div>

      {/* 诊断报告 */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
          📋 诊断报告
        </h2>
        <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded">
          {Object.keys(diagnosticData).length > 0 ? (
            <pre className="text-sm overflow-auto max-h-96">
              {JSON.stringify(diagnosticData, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">
              点击各个测试按钮收集诊断信息...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}