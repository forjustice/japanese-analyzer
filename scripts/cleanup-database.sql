-- 数据库清理脚本
-- 删除未使用的表、字段和配置项

USE janalyze;

-- 备份当前数据库结构
-- 在删除之前，建议先备份数据库

-- 1. 删除未使用的表
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS user_usage_stats;
DROP TABLE IF EXISTS user_monthly_stats;

-- 2. 删除未使用的字段
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;

-- 3. 删除未使用的配置项 (已改为数据库认证的管理员配置)
DELETE FROM system_configs WHERE config_key IN (
    'ADMIN_USERNAME',
    'ADMIN_PASSWORD', 
    'SUPER_ADMIN_USERNAME',
    'SUPER_ADMIN_PASSWORD'
);

-- 4. 删除未使用的视图 (如果存在)
DROP VIEW IF EXISTS admin_user_stats;

-- 5. 清理相关的存储过程和函数
DROP PROCEDURE IF EXISTS CleanExpiredVerificationCodes;
DROP PROCEDURE IF EXISTS CleanExpiredSessions;

-- 6. 删除相关的事件调度器
DROP EVENT IF EXISTS ev_clean_expired_codes;
DROP EVENT IF EXISTS ev_clean_expired_sessions;

-- 验证删除结果
SELECT 'Cleanup completed successfully' as message;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'janalyze' ORDER BY table_name;