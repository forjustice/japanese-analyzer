// 测试多KEY功能的简单脚本
const { ApiKeyManager } = require('./app/utils/api-key-manager.ts');

// 测试单个KEY
console.log('=== 测试单个KEY ===');
const singleKeyManager = new ApiKeyManager('key1');
console.log('工作的KEY数量:', singleKeyManager.getWorkingKeysCount());
console.log('获取KEY:', singleKeyManager.getWorkingKey());

// 测试多个KEY
console.log('\n=== 测试多个KEY ===');
const multiKeyManager = new ApiKeyManager('key1,key2,key3');
console.log('工作的KEY数量:', multiKeyManager.getWorkingKeysCount());
console.log('获取KEY 1:', multiKeyManager.getWorkingKey());
console.log('获取KEY 2:', multiKeyManager.getWorkingKey());
console.log('获取KEY 3:', multiKeyManager.getWorkingKey());
console.log('获取KEY 4 (轮询):', multiKeyManager.getWorkingKey());

// 测试故障转移
console.log('\n=== 测试故障转移 ===');
const key1 = multiKeyManager.getWorkingKey();
console.log('标记KEY失败前:', multiKeyManager.getKeyStatus());
multiKeyManager.markKeyAsFailed(key1);
multiKeyManager.markKeyAsFailed(key1);
multiKeyManager.markKeyAsFailed(key1); // 第3次失败，应该被标记为不可用
console.log('标记KEY失败后:', multiKeyManager.getKeyStatus());
console.log('工作的KEY数量:', multiKeyManager.getWorkingKeysCount());

// 测试空KEY
console.log('\n=== 测试空KEY ===');
const emptyKeyManager = new ApiKeyManager('');
console.log('工作的KEY数量:', emptyKeyManager.getWorkingKeysCount());
console.log('获取KEY:', emptyKeyManager.getWorkingKey());

console.log('\n测试完成!');