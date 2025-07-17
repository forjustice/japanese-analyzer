#!/usr/bin/env node
/**
 * 创建管理员账户的脚本
 * 用法: node scripts/create-admin.js
 */

const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function createDefaultAdmins() {
  let connection;
  
  try {
    console.log('正在连接数据库...');
    
    // 创建数据库连接
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'japanese_analyzer',
      charset: 'utf8mb4'
    });

    console.log('数据库连接成功');

    // 默认管理员账户信息
    const defaultAdmins = [
      {
        email: 'admin@admin.com',
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin123',
        role: 'admin'
      },
      {
        email: 'superadmin@admin.com',
        username: 'superadmin',
        password: process.env.SUPER_ADMIN_PASSWORD || 'superadmin123',
        role: 'super_admin'
      }
    ];

    console.log('正在创建默认管理员账户...');

    for (const admin of defaultAdmins) {
      try {
        // 检查用户是否已存在
        const [existing] = await connection.execute(
          'SELECT id FROM users WHERE email = ?',
          [admin.email]
        );

        if (existing.length > 0) {
          console.log(`管理员 ${admin.email} 已存在，跳过创建`);
          continue;
        }

        // 生成密码哈希
        const passwordHash = await bcrypt.hash(admin.password, 12);

        // 创建管理员账户
        await connection.execute(
          `INSERT INTO users (email, username, password_hash, role, is_verified, is_active) 
           VALUES (?, ?, ?, ?, TRUE, TRUE)`,
          [admin.email, admin.username, passwordHash, admin.role]
        );

        console.log(`✓ 管理员账户创建成功: ${admin.email} (${admin.role})`);
        console.log(`  用户名: ${admin.username}`);
        console.log(`  密码: ${admin.password}`);
        console.log('');
      } catch (error) {
        console.error(`创建管理员 ${admin.email} 失败:`, error.message);
      }
    }

    console.log('默认管理员账户创建完成');
    
  } catch (error) {
    console.error('创建管理员账户失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 生成密码哈希的独立函数
async function generatePasswordHash(password) {
  const hash = await bcrypt.hash(password, 12);
  console.log(`Password: ${password}`);
  console.log(`Hash: ${hash}`);
  return hash;
}

// 如果脚本直接运行
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // 默认创建管理员账户
    createDefaultAdmins();
  } else if (args[0] === 'hash' && args[1]) {
    // 生成密码哈希
    generatePasswordHash(args[1]);
  } else {
    console.log('用法:');
    console.log('  node scripts/create-admin.js          # 创建默认管理员账户');
    console.log('  node scripts/create-admin.js hash <password>  # 生成密码哈希');
  }
}

module.exports = { createDefaultAdmins, generatePasswordHash };