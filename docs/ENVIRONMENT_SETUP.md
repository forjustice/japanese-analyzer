# 环境变量配置指南

本项目支持两种认证模式：
1. **简单密码验证模式**（原有功能，向后兼容）
2. **完整用户账户管理模式**（新功能，包含用户注册、邮箱验证等）

## 认证模式说明

### 简单密码验证模式（默认）
如果只配置了 `CODE` 环境变量，系统将使用简单的密码验证模式，保持与之前版本的完全兼容。

### 完整用户账户管理模式
如果配置了数据库相关环境变量，系统将启用完整的用户账户管理功能，包括：
- 用户注册
- 邮箱验证
- 密码重置
- JWT token认证
- 用户会话管理

## 环境变量配置

### 基础配置（原有）

```bash
# Gemini API配置
API_KEY=your_gemini_api_key_here
API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent

# 访问控制（可选，简单密码验证模式）
CODE=your_access_password_here
```

### 用户认证系统配置（新增）

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=japanese_analyzer

# JWT配置
JWT_SECRET=your_jwt_secret_key_change_in_production
JWT_EXPIRES_IN=7d

# 邮件服务配置（SMTP）
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password_here
```

## 详细配置说明

### 1. 数据库配置

#### MySQL 设置
1. 安装MySQL 5.6+
2. 创建数据库和用户：
```sql
CREATE DATABASE japanese_analyzer DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'japanese_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON japanese_analyzer.* TO 'japanese_user'@'localhost';
FLUSH PRIVILEGES;
```

3. 导入数据库表结构：
```bash
mysql -u japanese_user -p japanese_analyzer < database/schema.sql
```

#### 环境变量设置
```bash
DB_HOST=localhost          # 数据库主机地址
DB_PORT=3306              # 数据库端口
DB_USER=japanese_user     # 数据库用户名
DB_PASSWORD=your_password # 数据库密码
DB_NAME=japanese_analyzer # 数据库名称
```

### 2. JWT配置

```bash
# JWT密钥（生产环境请使用强密钥）
JWT_SECRET=your_super_secret_jwt_key_change_in_production

# Token过期时间（支持格式：1d, 7d, 24h, 60m等）
JWT_EXPIRES_IN=7d
```

**注意：** 请在生产环境中使用强度足够的JWT密钥，建议至少32位随机字符串。

### 3. 邮件服务配置

#### Gmail SMTP设置
1. 开启Gmail的两步验证
2. 生成应用专用密码
3. 配置环境变量：

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_char_app_password
```

#### 其他邮件服务商

**Outlook/Hotmail:**
```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your_email@outlook.com
SMTP_PASS=your_password
```

**Yahoo Mail:**
```bash
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_USER=your_email@yahoo.com
SMTP_PASS=your_app_password
```

**QQ邮箱:**
```bash
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_USER=your_email@qq.com
SMTP_PASS=your_authorization_code
```

**163邮箱:**
```bash
SMTP_HOST=smtp.163.com
SMTP_PORT=25
SMTP_USER=your_email@163.com
SMTP_PASS=your_authorization_code
```

### 4. 部署环境配置

#### Vercel部署
在Vercel项目设置中添加以下环境变量：

**基础配置:**
- `API_KEY`: 你的Gemini API密钥

**用户认证系统（可选）:**
- `DB_HOST`: 数据库主机
- `DB_PORT`: 数据库端口
- `DB_USER`: 数据库用户名
- `DB_PASSWORD`: 数据库密码
- `DB_NAME`: 数据库名称
- `JWT_SECRET`: JWT密钥
- `JWT_EXPIRES_IN`: Token过期时间
- `SMTP_HOST`: 邮件服务器主机
- `SMTP_PORT`: 邮件服务器端口
- `SMTP_USER`: 邮件账户
- `SMTP_PASS`: 邮件密码

#### Docker部署
创建 `.env` 文件：
```bash
# 复制.env.example并修改
cp .env.example .env
# 编辑.env文件，填入你的配置
```

## 配置示例

### .env.example 文件
```bash
# Gemini API配置
API_KEY=your_gemini_api_key_here
API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent

# 简单密码验证（如果使用）
CODE=your_access_password

# 数据库配置（用户认证系统）
DB_HOST=localhost
DB_PORT=3306
DB_USER=japanese_user
DB_PASSWORD=your_database_password
DB_NAME=japanese_analyzer

# JWT配置
JWT_SECRET=your_jwt_secret_minimum_32_characters_long
JWT_EXPIRES_IN=7d

# 邮件服务配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
```

## 功能对比

| 功能 | 简单密码验证 | 用户认证系统 |
|------|-------------|-------------|
| 访问控制 | ✅ 全局密码 | ✅ 个人账户 |
| 用户注册 | ❌ | ✅ |
| 邮箱验证 | ❌ | ✅ |
| 密码重置 | ❌ | ✅ |
| 用户管理 | ❌ | ✅ |
| 使用统计 | ❌ | ✅ |
| 个性化设置 | ❌ | ✅ |

## 故障排除

### 数据库连接问题
1. 检查数据库服务是否运行
2. 验证数据库连接信息
3. 确认用户权限设置
4. 检查防火墙设置

### 邮件发送问题
1. 验证SMTP配置信息
2. 检查邮箱安全设置
3. 确认应用专用密码
4. 测试网络连通性

### JWT Token问题
1. 确认JWT_SECRET设置
2. 检查Token过期时间
3. 验证客户端Token存储

## 安全建议

1. **生产环境配置:**
   - 使用强密码和密钥
   - 启用SSL/TLS加密
   - 定期更换敏感信息

2. **数据库安全:**
   - 使用专用数据库用户
   - 限制用户权限
   - 启用连接加密

3. **邮件安全:**
   - 使用应用专用密码
   - 启用两步验证
   - 定期检查登录记录

## 升级指南

### 从简单模式升级到用户认证模式

1. **备份数据:**
   ```bash
   # 备份用户设置（如果需要）
   cp -r ~/.japanese-analyzer-backup ./backup/
   ```

2. **配置数据库:**
   - 按照上述步骤配置数据库
   - 导入数据库表结构

3. **配置环境变量:**
   - 添加数据库和邮件相关配置
   - 保留原有的API配置

4. **测试功能:**
   - 验证用户注册流程
   - 测试邮件发送功能
   - 确认登录认证正常

5. **数据迁移（可选）:**
   - 如果需要保留用户设置，可以手动迁移到数据库

现有用户无需任何操作，系统会自动检测并使用适当的认证模式。