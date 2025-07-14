-- 为日语分析器创建数据库表结构
-- 适配当前数据库配置

-- 使用当前数据库（janalyze）
USE janalyze;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL COMMENT '用户邮箱',
    password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希值',
    username VARCHAR(100) DEFAULT NULL COMMENT '用户名（可选）',
    is_verified BOOLEAN DEFAULT FALSE COMMENT '邮箱是否已验证',
    is_active BOOLEAN DEFAULT TRUE COMMENT '账户是否激活',
    avatar_url VARCHAR(500) DEFAULT NULL COMMENT '头像URL（可选）',
    last_login_at DATETIME DEFAULT NULL COMMENT '最后登录时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_email (email),
    INDEX idx_is_verified (is_verified),
    INDEX idx_is_active (is_active),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 邮箱验证码表
CREATE TABLE IF NOT EXISTS verification_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL COMMENT '用户ID（注册验证时可能为空）',
    email VARCHAR(255) NOT NULL COMMENT '邮箱地址',
    code VARCHAR(10) NOT NULL COMMENT '验证码',
    type ENUM('registration', 'password_reset', 'email_change') NOT NULL COMMENT '验证码类型',
    expires_at DATETIME NOT NULL COMMENT '过期时间',
    is_used BOOLEAN DEFAULT FALSE COMMENT '是否已使用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    INDEX idx_email (email),
    INDEX idx_code (code),
    INDEX idx_type (type),
    INDEX idx_expires_at (expires_at),
    INDEX idx_is_used (is_used),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='邮箱验证码表';

-- 用户会话表（JWT token管理）
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '用户ID',
    token_hash VARCHAR(255) NOT NULL COMMENT 'JWT token哈希值',
    device_info VARCHAR(500) DEFAULT NULL COMMENT '设备信息（User-Agent等）',
    ip_address VARCHAR(45) DEFAULT NULL COMMENT 'IP地址',
    expires_at DATETIME NOT NULL COMMENT '过期时间',
    last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '最后使用时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    INDEX idx_user_id (user_id),
    INDEX idx_token_hash (token_hash),
    INDEX idx_expires_at (expires_at),
    INDEX idx_last_used_at (last_used_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户会话表';

-- 用户使用统计表（可选，用于统计用户使用情况）
CREATE TABLE IF NOT EXISTS user_usage_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '用户ID',
    date DATE NOT NULL COMMENT '日期',
    analysis_count INT DEFAULT 0 COMMENT '分析次数',
    translation_count INT DEFAULT 0 COMMENT '翻译次数',
    tts_count INT DEFAULT 0 COMMENT 'TTS使用次数',
    ocr_count INT DEFAULT 0 COMMENT 'OCR使用次数',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    UNIQUE KEY unique_user_date (user_id, date),
    INDEX idx_date (date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户使用统计表';

-- 显示创建结果
SELECT 'Database tables created successfully!' as Status;
SHOW TABLES;