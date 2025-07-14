-- 用户分析历史记录表
CREATE TABLE IF NOT EXISTS user_analysis_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    original_text TEXT NOT NULL,
    tokens_json JSON NOT NULL,
    translation TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- 外键约束
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- 索引
    INDEX idx_user_created (user_id, created_at DESC),
    INDEX idx_user_text (user_id, original_text(100)),
    INDEX idx_created_at (created_at DESC)
);

-- 为JSON字段添加虚拟列和索引（用于搜索）
ALTER TABLE user_analysis_history 
ADD COLUMN token_count INT GENERATED ALWAYS AS (JSON_LENGTH(tokens_json)) VIRTUAL,
ADD INDEX idx_token_count (token_count);

-- 添加全文搜索索引
ALTER TABLE user_analysis_history 
ADD FULLTEXT(original_text, translation);