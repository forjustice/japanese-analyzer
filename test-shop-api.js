// 简单的API测试脚本
// 运行: node test-shop-api.js

const BASE_URL = 'http://localhost:3000';

async function testAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    console.log(`✓ ${endpoint}:`, response.status, data);
    return data;
  } catch (error) {
    console.log(`✗ ${endpoint}:`, error.message);
    return null;
  }
}

async function runTests() {
  console.log('开始测试商城API接口...\n');

  // 1. 测试获取商品列表
  console.log('1. 测试获取商品列表:');
  await testAPI('/api/shop/products');

  // 2. 测试管理员商品管理 (需要管理员token)
  console.log('\n2. 测试管理员商品管理:');
  await testAPI('/api/admin/products');

  // 3. 测试系统配置 (需要管理员token)
  console.log('\n3. 测试系统配置:');
  await testAPI('/api/admin/config');

  console.log('\n测试完成！');
  console.log('\n注意事项:');
  console.log('- 购买和订单相关的API需要用户登录token');
  console.log('- 管理后台相关API需要管理员token');
  console.log('- Stripe支付需要配置真实的Stripe密钥');
}

runTests();