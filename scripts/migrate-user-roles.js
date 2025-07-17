#!/usr/bin/env node
/**
 * 数据库迁移脚本：为现有用户表添加角色字段
 * 用法: node scripts/migrate-user-roles.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateUserRoles() {
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

    // 检查用户表是否存在
    const [tables] = await connection.execute(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
      [process.env.DB_NAME || 'japanese_analyzer']
    );

    if (tables[0].count === 0) {
      console.log('用户表不存在，请先运行数据库初始化脚本');
      return;
    }

    // 检查角色字段是否已存在
    const [columns] = await connection.execute(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`,
      [process.env.DB_NAME || 'japanese_analyzer']
    );

    if (columns[0].count > 0) {
      console.log('角色字段已存在，跳过迁移');
      return;
    }

    console.log('正在为用户表添加角色字段...');

    // 添加角色字段
    await connection.execute(
      `ALTER TABLE users ADD COLUMN role ENUM('user', 'admin', 'super_admin') DEFAULT 'user' COMMENT '用户角色'`
    );

    console.log('✓ 角色字段添加成功');

    // 添加角色字段的索引
    await connection.execute(
      `ALTER TABLE users ADD INDEX idx_role (role)`
    );

    console.log('✓ 角色索引添加成功');

    // 创建管理员统计视图
    await connection.execute(`
      CREATE OR REPLACE VIEW admin_user_stats AS
      SELECT 
        role,
        COUNT(*) as user_count,
        SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN is_verified = TRUE THEN 1 ELSE 0 END) as verified_count,
        MAX(created_at) as last_registered
      FROM users
      GROUP BY role
    `);

    console.log('✓ 管理员统计视图创建成功');

    console.log('数据库迁移完成');
    
  } catch (error) {
    console.error('数据库迁移失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 如果脚本直接运行
if (require.main === module) {
  migrateUserRoles();
}

module.exports = { migrateUserRoles };