#!/usr/bin/env node

/**
 * 注册流程调试工具
 * 用于模拟和调试完整的用户注册流程
 */

const testEmail = 'test@example.com';
const testPassword = 'TestPassword123';
const testUsername = 'testuser';

console.log('🚀 开始调试注册流程...');
console.log('测试邮箱:', testEmail);
console.log('测试密码:', testPassword);
console.log('测试用户名:', testUsername);

async function debugRegistration() {
  const baseUrl = 'http://localhost:3000';
  
  try {
    console.log('\n📤 步骤 1: 发送验证码');
    console.log('请求 URL:', `${baseUrl}/api/auth/register`);
    
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Debug-Tool/1.0'
      },
      body: JSON.stringify({
        email: testEmail
      })
    });
    
    const registerData = await registerResponse.json();
    console.log('发送验证码响应状态:', registerResponse.status);
    console.log('发送验证码响应数据:', JSON.stringify(registerData, null, 2));
    
    if (!registerData.success) {
      console.error('❌ 发送验证码失败，停止调试');
      return;
    }
    
    // 从响应中获取验证码（开发环境）
    let verificationCode = registerData.data?.code;
    if (!verificationCode) {
      verificationCode = prompt('请输入收到的验证码（6位数字）:');
    }
    
    console.log('\n🔐 步骤 2: 验证码验证和注册');
    console.log('使用验证码:', verificationCode);
    console.log('请求 URL:', `${baseUrl}/api/auth/verify`);
    
    const verifyRequestBody = {
      email: testEmail,
      code: verificationCode,
      password: testPassword,
      username: testUsername,
      type: 'registration'
    };
    
    console.log('验证请求体:', JSON.stringify(verifyRequestBody, null, 2));
    
    const verifyResponse = await fetch(`${baseUrl}/api/auth/verify`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Debug-Tool/1.0'
      },
      body: JSON.stringify(verifyRequestBody)
    });
    
    const verifyData = await verifyResponse.json();
    console.log('验证响应状态:', verifyResponse.status);
    console.log('验证响应数据:', JSON.stringify(verifyData, null, 2));
    
    if (verifyData.success) {
      console.log('✅ 注册成功！');
      console.log('用户信息:', verifyData.data.user);
      console.log('认证令牌:', verifyData.data.token ? '已生成' : '未生成');
    } else {
      console.error('❌ 注册失败:', verifyData.message);
    }
    
  } catch (error) {
    console.error('❌ 调试过程中发生错误:', error);
  }
}

// 如果在 Node.js 环境中运行
if (typeof require !== 'undefined' && require.main === module) {
  // 添加 fetch polyfill
  const { fetch } = require('node-fetch');
  global.fetch = fetch;
  
  debugRegistration();
}

// 如果在浏览器中运行
if (typeof window !== 'undefined') {
  window.debugRegistration = debugRegistration;
  console.log('👉 在浏览器控制台运行: debugRegistration()');
}