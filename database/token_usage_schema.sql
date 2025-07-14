-- TOKEN使用量统计表结构
-- 适配当前数据库配置（janalyze）

USE janalyze;

-- TOKEN使用量统计表
CREATE TABLE IF NOT EXISTS user_token_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '用户ID',
    api_endpoint VARCHAR(100) NOT NULL COMMENT 'API端点（analyze, translate, tts等）',
    input_tokens INT DEFAULT 0 COMMENT '输入token数量',
    output_tokens INT DEFAULT 0 COMMENT '输出token数量',
    total_tokens INT GENERATED ALWAYS AS (input_tokens + output_tokens) STORED COMMENT '总token数量',
    request_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '请求时间',
    model_name VARCHAR(100) DEFAULT NULL COMMENT '使用的模型名称',
    success BOOLEAN DEFAULT TRUE COMMENT '请求是否成功',
    
    INDEX idx_user_id (user_id),
    INDEX idx_api_endpoint (api_endpoint),
    INDEX idx_request_time (request_time),
    INDEX idx_user_time (user_id, request_time),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户TOKEN使用量统计表';

-- 用户30天TOKEN使用量汇总视图
CREATE OR REPLACE VIEW user_30day_token_usage AS
SELECT 
    u.id as user_id,
    u.email,
    u.username,
    u.created_at as registration_date,
    COALESCE(SUM(CASE WHEN utu.request_time >= u.created_at AND utu.request_time <= DATE_ADD(u.created_at, INTERVAL 30 DAY) THEN utu.total_tokens END), 0) as total_tokens_30days,
    COALESCE(SUM(CASE WHEN utu.request_time >= u.created_at AND utu.request_time <= DATE_ADD(u.created_at, INTERVAL 30 DAY) AND utu.api_endpoint = 'analyze' THEN utu.total_tokens END), 0) as analyze_tokens,
    COALESCE(SUM(CASE WHEN utu.request_time >= u.created_at AND utu.request_time <= DATE_ADD(u.created_at, INTERVAL 30 DAY) AND utu.api_endpoint = 'translate' THEN utu.total_tokens END), 0) as translate_tokens,
    COALESCE(SUM(CASE WHEN utu.request_time >= u.created_at AND utu.request_time <= DATE_ADD(u.created_at, INTERVAL 30 DAY) AND utu.api_endpoint = 'tts' THEN utu.total_tokens END), 0) as tts_tokens,
    COALESCE(SUM(CASE WHEN utu.request_time >= u.created_at AND utu.request_time <= DATE_ADD(u.created_at, INTERVAL 30 DAY) AND utu.api_endpoint IN ('image-to-text', 'file-to-text') THEN utu.total_tokens END), 0) as ocr_tokens,
    COALESCE(COUNT(CASE WHEN utu.request_time >= u.created_at AND utu.request_time <= DATE_ADD(u.created_at, INTERVAL 30 DAY) THEN 1 END), 0) as total_requests_30days,
    DATE_ADD(u.created_at, INTERVAL 30 DAY) as trial_end_date,
    CASE 
        WHEN NOW() <= DATE_ADD(u.created_at, INTERVAL 30 DAY) THEN DATEDIFF(DATE_ADD(u.created_at, INTERVAL 30 DAY), NOW())
        ELSE 0 
    END as days_remaining
FROM users u
LEFT JOIN user_token_usage utu ON u.id = utu.user_id
GROUP BY u.id, u.email, u.username, u.created_at;

-- 每日TOKEN使用量统计视图
CREATE OR REPLACE VIEW user_daily_token_usage AS
SELECT 
    user_id,
    DATE(request_time) as usage_date,
    api_endpoint,
    SUM(total_tokens) as daily_tokens,
    COUNT(*) as daily_requests
FROM user_token_usage
GROUP BY user_id, DATE(request_time), api_endpoint
ORDER BY user_id, usage_date DESC, api_endpoint;

-- 显示创建结果
SELECT 'Token usage tables created successfully!' as Status;
SHOW TABLES LIKE '%token%';