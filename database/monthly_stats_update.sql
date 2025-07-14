-- 月度统计优化更新脚本
-- 将30天试用统计改为月度统计系统
-- 执行时间：2025年更新

USE janalyze;

-- 1. 首先确保基础表结构存在
CREATE TABLE IF NOT EXISTS user_token_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '用户ID',
    api_endpoint VARCHAR(100) NOT NULL COMMENT 'API端点（analyze, translate, tts等）',
    input_tokens INT DEFAULT 0 COMMENT '输入token数量',
    output_tokens INT DEFAULT 0 COMMENT '输出token数量',
    model_name VARCHAR(100) DEFAULT NULL COMMENT '使用的模型名称',
    success BOOLEAN DEFAULT TRUE COMMENT '请求是否成功',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_user_id (user_id),
    INDEX idx_api_endpoint (api_endpoint),
    INDEX idx_created_at (created_at),
    INDEX idx_user_created_at (user_id, created_at),
    INDEX idx_user_endpoint_created (user_id, api_endpoint, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户TOKEN使用量统计表';

-- 2. 添加复合索引优化月度查询性能
-- 注意：MySQL在索引中使用函数有限制，这里使用日期范围查询

-- 3. 创建月度TOKEN使用量汇总视图（替换30天视图）
DROP VIEW IF EXISTS user_30day_token_usage;

CREATE OR REPLACE VIEW user_monthly_token_usage AS
SELECT 
    u.id as user_id,
    u.email,
    u.username,
    u.created_at as registration_date,
    YEAR(CURRENT_DATE()) as current_year,
    MONTH(CURRENT_DATE()) as current_month,
    COALESCE(SUM(CASE WHEN utu.request_time >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') AND utu.request_time < DATE_ADD(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH) THEN utu.input_tokens + utu.output_tokens END), 0) as total_tokens_current_month,
    COALESCE(SUM(CASE WHEN utu.request_time >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') AND utu.request_time < DATE_ADD(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH) AND utu.api_endpoint = 'analyze' THEN utu.input_tokens + utu.output_tokens END), 0) as analyze_tokens,
    COALESCE(SUM(CASE WHEN utu.request_time >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') AND utu.request_time < DATE_ADD(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH) AND utu.api_endpoint = 'translate' THEN utu.input_tokens + utu.output_tokens END), 0) as translate_tokens,
    COALESCE(SUM(CASE WHEN utu.request_time >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') AND utu.request_time < DATE_ADD(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH) AND utu.api_endpoint = 'tts' THEN utu.input_tokens + utu.output_tokens END), 0) as tts_tokens,
    COALESCE(SUM(CASE WHEN utu.request_time >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') AND utu.request_time < DATE_ADD(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH) AND utu.api_endpoint IN ('image-to-text', 'file-to-text') THEN utu.input_tokens + utu.output_tokens END), 0) as ocr_tokens,
    COALESCE(COUNT(CASE WHEN utu.request_time >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') AND utu.request_time < DATE_ADD(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH) THEN 1 END), 0) as total_requests_current_month,
    LAST_DAY(CURRENT_DATE()) as current_month_end,
    DAY(LAST_DAY(CURRENT_DATE())) - DAY(CURRENT_DATE()) as days_remaining_in_month
FROM users u
LEFT JOIN user_token_usage utu ON u.id = utu.user_id
GROUP BY u.id, u.email, u.username, u.created_at;

-- 4. 更新每日TOKEN使用量统计视图，添加月度过滤
DROP VIEW IF EXISTS user_daily_token_usage;

CREATE OR REPLACE VIEW user_daily_token_usage AS
SELECT 
    user_id,
    DATE(request_time) as usage_date,
    api_endpoint,
    SUM(input_tokens + output_tokens) as daily_tokens,
    COUNT(*) as daily_requests,
    YEAR(request_time) as usage_year,
    MONTH(request_time) as usage_month
FROM user_token_usage
GROUP BY user_id, DATE(request_time), api_endpoint
ORDER BY user_id, usage_date DESC, api_endpoint;

-- 5. 创建月度汇总表（可选，用于缓存月度统计）
CREATE TABLE IF NOT EXISTS user_monthly_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '用户ID',
    year YEAR NOT NULL COMMENT '年份',
    month TINYINT NOT NULL COMMENT '月份(1-12)',
    total_tokens INT DEFAULT 0 COMMENT '当月总token使用量',
    analyze_tokens INT DEFAULT 0 COMMENT '分析功能token使用量',
    translate_tokens INT DEFAULT 0 COMMENT '翻译功能token使用量',
    tts_tokens INT DEFAULT 0 COMMENT 'TTS功能token使用量',
    ocr_tokens INT DEFAULT 0 COMMENT 'OCR功能token使用量',
    total_requests INT DEFAULT 0 COMMENT '当月总请求次数',
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
    
    UNIQUE KEY unique_user_month (user_id, year, month),
    INDEX idx_year_month (year, month),
    INDEX idx_user_year_month (user_id, year, month),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户月度统计汇总表';

-- 6. 创建存储过程来更新月度统计缓存
DELIMITER //

DROP PROCEDURE IF EXISTS UpdateMonthlyStats//

CREATE PROCEDURE UpdateMonthlyStats(IN target_user_id INT DEFAULT NULL)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_user_id INT;
    DECLARE user_cursor CURSOR FOR 
        SELECT DISTINCT user_id FROM user_token_usage 
        WHERE (target_user_id IS NULL OR user_id = target_user_id);
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN user_cursor;
    
    user_loop: LOOP
        FETCH user_cursor INTO v_user_id;
        IF done THEN
            LEAVE user_loop;
        END IF;
        
        -- 更新当前月度统计
        INSERT INTO user_monthly_stats (
            user_id, year, month, total_tokens, analyze_tokens, 
            translate_tokens, tts_tokens, ocr_tokens, total_requests
        )
        SELECT 
            v_user_id,
            YEAR(CURRENT_DATE()),
            MONTH(CURRENT_DATE()),
            COALESCE(SUM(input_tokens + output_tokens), 0),
            COALESCE(SUM(CASE WHEN api_endpoint = 'analyze' THEN input_tokens + output_tokens ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN api_endpoint = 'translate' THEN input_tokens + output_tokens ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN api_endpoint = 'tts' THEN input_tokens + output_tokens ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN api_endpoint IN ('image-to-text', 'file-to-text') THEN input_tokens + output_tokens ELSE 0 END), 0),
            COUNT(*)
        FROM user_token_usage 
        WHERE user_id = v_user_id 
          AND request_time >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') 
          AND request_time < DATE_ADD(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
        ON DUPLICATE KEY UPDATE
            total_tokens = VALUES(total_tokens),
            analyze_tokens = VALUES(analyze_tokens),
            translate_tokens = VALUES(translate_tokens),
            tts_tokens = VALUES(tts_tokens),
            ocr_tokens = VALUES(ocr_tokens),
            total_requests = VALUES(total_requests),
            last_updated = CURRENT_TIMESTAMP;
            
    END LOOP;
    
    CLOSE user_cursor;
END//

DELIMITER ;

-- 7. 初始化当前月度统计数据
CALL UpdateMonthlyStats(NULL);

-- 8. 创建每日定时任务来更新月度统计（可选）
-- 注意：需要确保事件调度器已启用：SET GLOBAL event_scheduler = ON;

DROP EVENT IF EXISTS ev_update_monthly_stats;

CREATE EVENT IF NOT EXISTS ev_update_monthly_stats
ON SCHEDULE EVERY 1 DAY STARTS '2025-01-01 01:00:00'
DO CALL UpdateMonthlyStats(NULL);

-- 9. 显示更新结果
SELECT 'Monthly statistics optimization completed successfully!' as Status;

-- 显示相关表和视图
SHOW TABLES LIKE '%token%';
SHOW TABLES LIKE '%monthly%';

-- 显示视图结构
DESCRIBE user_monthly_token_usage;
DESCRIBE user_daily_token_usage;

-- 显示索引信息
SHOW INDEX FROM user_token_usage WHERE Key_name LIKE '%month%' OR Key_name LIKE '%year%';

SELECT 'Database update script completed. The system now supports monthly token usage statistics.' as Final_Status;