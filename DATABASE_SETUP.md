# 数据库设置指南

## 🚨 快速修复数据库表缺失问题

根据错误信息，你的数据库名是 `janalyze`，但缺少必要的表结构。

### 方法1：使用MySQL命令行（推荐）

1. **连接到你的MySQL数据库**：
   ```bash
   mysql -u 你的用户名 -p
   ```

2. **执行建表脚本**：
   ```sql
   SOURCE /path/to/japanese-analyzer2/setup_database.sql;
   ```
   
   或者直接复制粘贴SQL内容：
   ```sql
   USE janalyze;
   
   -- 复制 setup_database.sql 中的所有CREATE TABLE语句
   ```

### 方法2：使用phpMyAdmin或其他数据库管理工具

1. 打开你的数据库管理界面
2. 选择 `janalyze` 数据库
3. 复制 `setup_database.sql` 文件中的SQL语句并执行

### 方法3：快速建表脚本

在MySQL中执行以下语句：

```sql
USE janalyze;

-- 用户表
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100) DEFAULT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    avatar_url VARCHAR(500) DEFAULT NULL,
    last_login_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 验证码表
CREATE TABLE verification_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    type ENUM('registration', 'password_reset', 'email_change') NOT NULL,
    expires_at DATETIME NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 会话表
CREATE TABLE user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    device_info VARCHAR(500) DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    expires_at DATETIME NOT NULL,
    last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 验证安装

执行完毕后，检查表是否创建成功：

```sql
SHOW TABLES;
DESCRIBE users;
```

你应该看到：
- users
- verification_codes  
- user_sessions

## 🔧 常见问题

### 1. 权限错误
如果出现权限错误，确保你的数据库用户有CREATE权限：
```sql
GRANT CREATE, SELECT, INSERT, UPDATE, DELETE ON janalyze.* TO '你的用户名'@'localhost';
FLUSH PRIVILEGES;
```

### 2. 字符集问题
如果出现字符集错误，可以先设置：
```sql
ALTER DATABASE janalyze CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. 外键约束错误
如果出现外键约束错误，按顺序创建表：
1. users (先创建)
2. verification_codes (依赖users)
3. user_sessions (依赖users)

## 完成后

创建表结构后，重新尝试注册账户，应该就能正常工作了！

如果还有问题，请检查：
1. 数据库连接配置是否正确
2. 用户权限是否足够
3. MySQL版本是否兼容（需要5.6+）