# 🔧 日语分析器环境变量完整清单

## 📋 必需的环境变量

### 1. 🤖 AI服务配置
```env
# Gemini API配置（必需）
API_KEY=your_gemini_api_key_here
API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent
```

### 2. 🗄️ 数据库配置
```env
# MySQL数据库连接（用户管理功能必需）
DB_HOST=your_database_host
DB_PORT=3306
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name

# 可选：数据库SSL配置
DB_SSL=false
```

### 3. 🔐 JWT认证配置
```env
# JWT密钥（用户认证必需）
JWT_SECRET=your_jwt_secret_minimum_32_characters
JWT_EXPIRES_IN=7d
```

### 4. 📧 邮件服务配置
```env
# SMTP邮件服务（用户注册验证必需）
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
FROM_EMAIL=your_sender_email

# 可选：多邮件服务配置
GMAIL_USER=your_gmail_address
GMAIL_PASS=your_gmail_app_password
QQ_USER=your_qq_email
QQ_PASS=your_qq_auth_code
```

## 🌍 Vercel部署专用环境变量

### Vercel自动环境变量（自动设置）
```env
# Vercel自动设置的环境变量
VERCEL_ENV=production|preview|development
VERCEL_REGION=your_deployment_region
VERCEL_URL=your_app_url
VERCEL_DEPLOYMENT_ID=deployment_id
```

### 时区配置（推荐）
```env
# 时区设置
TZ=UTC
```

## 🔍 环境变量检查清单

### ✅ 你的.env文件已配置的变量：
- ✅ `API_KEY` - 已配置（多个KEY）
- ✅ `API_URL` - 已配置
- ✅ `DB_HOST` - 已配置
- ✅ `DB_PORT` - 已配置
- ✅ `DB_USER` - 已配置
- ✅ `DB_PASSWORD` - 已配置
- ✅ `DB_NAME` - 已配置
- ✅ `JWT_SECRET` - 已配置
- ✅ `JWT_EXPIRES_IN` - 已配置
- ✅ `SMTP_HOST` - 已配置
- ✅ `SMTP_PORT` - 已配置
- ✅ `SMTP_USER` - 已配置
- ✅ `SMTP_PASS` - 已配置
- ✅ `FROM_EMAIL` - 已配置

### ❌ 缺失的环境变量：
- ❌ `DB_SSL` - 建议添加（可能需要在生产环境中）
- ❌ `TZ` - 建议添加（时区同步）

## 🚨 Vercel部署注意事项

### 1. 环境变量配置位置
在Vercel Dashboard中配置环境变量：
- 项目设置 → Environment Variables
- 确保所有变量都正确配置

### 2. 时区同步问题
```env
# 添加到Vercel环境变量
TZ=UTC
```

### 3. 数据库连接优化
```env
# 如果数据库要求SSL连接
DB_SSL=true
```

## 🔧 完整的.env文件模板

```env
# =================================
# AI服务配置
# =================================
API_KEY=your_gemini_api_key_here
API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent

# =================================
# 数据库配置
# =================================
DB_HOST=your_database_host
DB_PORT=3306
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name
DB_SSL=false

# =================================
# JWT认证配置
# =================================
JWT_SECRET=your_jwt_secret_minimum_32_characters
JWT_EXPIRES_IN=7d

# =================================
# 邮件服务配置
# =================================
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
FROM_EMAIL=your_sender_email

# =================================
# 时区配置
# =================================
TZ=UTC
```

## 🛠️ 快速修复建议

根据你的配置，建议添加以下环境变量到Vercel：

1. **时区配置**：
   ```env
   TZ=UTC
   ```

2. **数据库SSL配置**（如果需要）：
   ```env
   DB_SSL=true
   ```

3. **验证所有变量**：
   - 确保所有变量都在Vercel Dashboard中正确配置
   - 检查变量值是否与本地.env文件一致
   - 确保没有多余的空格或特殊字符