# 数据库更新说明

## 月度统计系统更新

本次更新将系统从30天试用统计改为月度统计模式，优化了数据库结构和查询性能。

### 自动更新

系统会在启动时自动检查并执行数据库更新：

1. **自动检测**：系统启动时会检查`user_monthly_stats`表是否存在
2. **自动执行**：如果不存在，会自动执行`monthly_stats_update.sql`脚本
3. **安全机制**：更新过程使用事务，失败时会自动回滚

### 手动更新

如果需要手动更新数据库，可以使用以下方法：

#### 方法1：直接执行SQL脚本

```bash
mysql -h your_host -u your_user -p your_database < database/monthly_stats_update.sql
```

#### 方法2：使用API端点

```bash
# 更新数据库结构
curl -X POST "http://your-domain/api/admin/update-db" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_admin_token" \
  -d '{"action": "update_monthly_stats"}'

# 刷新当月统计
curl -X POST "http://your-domain/api/admin/update-db" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_admin_token" \
  -d '{"action": "refresh_current_month"}'
```

### 更新内容

#### 1. 数据库结构优化

- **新增索引**：`idx_user_year_month` 用于优化月度查询
- **新增表**：`user_monthly_stats` 用于缓存月度统计
- **更新视图**：替换30天视图为月度视图

#### 2. 新增功能

- **月度汇总表**：`user_monthly_stats` 缓存每月统计数据
- **存储过程**：`UpdateMonthlyStats` 用于更新月度缓存
- **定时任务**：每日自动更新月度统计

#### 3. 性能优化

- 添加复合索引优化年月查询
- 创建月度缓存表减少实时计算
- 优化视图查询逻辑

### 环境变量配置

更新后需要配置以下环境变量：

```env
# 月度TOKEN限制（默认150,000）
MONTHLY_TOKEN_LIMIT=150000

# 管理员访问令牌（生产环境请修改）
ADMIN_TOKEN=your_secure_admin_token
```

### 验证更新

更新完成后，可以通过以下方式验证：

1. **检查表结构**：
   ```sql
   SHOW TABLES LIKE '%monthly%';
   DESCRIBE user_monthly_stats;
   ```

2. **检查视图**：
   ```sql
   SHOW CREATE VIEW user_monthly_token_usage;
   ```

3. **检查索引**：
   ```sql
   SHOW INDEX FROM user_token_usage WHERE Key_name LIKE '%month%';
   ```

### 回滚方案

如果需要回滚更新，可以：

1. 删除新增的表和视图：
   ```sql
   DROP TABLE IF EXISTS user_monthly_stats;
   DROP VIEW IF EXISTS user_monthly_token_usage;
   DROP PROCEDURE IF EXISTS UpdateMonthlyStats;
   ```

2. 恢复原始30天视图（参考 `token_usage_schema.sql`）

### 注意事项

- 更新过程会自动处理数据兼容性
- 原有数据不会丢失
- 如果更新失败，系统会回滚到原始状态
- 建议在更新前备份数据库

### 技术支持

如有问题，请检查：

1. 数据库连接配置
2. 用户权限（需要CREATE/ALTER/DROP权限）
3. 环境变量配置
4. 应用日志中的错误信息