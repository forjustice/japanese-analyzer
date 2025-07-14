import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  requireTLS?: boolean;
  auth: {
    user: string;
    pass: string;
  };
  tls?: {
    rejectUnauthorized?: boolean;
    ciphers?: string;
  };
  debug?: boolean;
  logger?: boolean;
  connectionTimeout?: number;
  greetingTimeout?: number;
  socketTimeout?: number;
}

interface EmailContent {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private static instance: EmailService;
  private transporter: Transporter | null = null;
  private config: EmailConfig | null = null;

  private constructor() {
    this.initTransporter();
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private initTransporter(): void {
    try {
      // 从环境变量获取SMTP配置
      const host = process.env.SMTP_HOST;
      const port = parseInt(process.env.SMTP_PORT || '587');
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;

      console.log('SMTP配置检查:', {
        host: host ? `已配置(${host})` : '未配置',
        port: port || '默认587',
        user: user ? `已配置(${user})` : '未配置',
        pass: pass ? `已配置(长度:${pass.length})` : '未配置',
        allEnvVars: {
          SMTP_HOST: process.env.SMTP_HOST,
          SMTP_PORT: process.env.SMTP_PORT,
          SMTP_USER: process.env.SMTP_USER,
          SMTP_PASS_LENGTH: process.env.SMTP_PASS?.length
        }
      });

      if (!host || !user || !pass) {
        console.warn('SMTP配置不完整，邮件服务将不可用');
        return;
      }

      this.config = {
        host,
        port,
        secure: false, // false for 587 (STARTTLS), true for 465 (SSL/TLS)
        requireTLS: true, // 强制使用TLS
        auth: {
          user,
          pass
        },
        // TLS配置
        tls: {
          rejectUnauthorized: false, // 允许自签名证书
          ciphers: 'SSLv3'
        },
        // 调试和兼容性选项
        debug: process.env.NODE_ENV === 'development',
        logger: process.env.NODE_ENV === 'development',
        // 增加超时时间
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000
      };

      this.transporter = nodemailer.createTransport(this.config);

      console.log('邮件服务初始化成功，配置:', {
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        user: this.config.auth.user
      });
    } catch (error) {
      console.error('邮件服务初始化失败:', error);
    }
  }

  // 检查邮件服务是否可用
  public isAvailable(): boolean {
    return this.transporter !== null && this.config !== null;
  }

  // 测试邮件连接
  public async testConnection(): Promise<{ success: boolean; error?: string; config?: object }> {
    if (!this.transporter) {
      return { success: false, error: 'SMTP传输器未初始化' };
    }

    try {
      await this.transporter.verify();
      console.log('SMTP连接测试成功');
      return { 
        success: true, 
        config: {
          host: this.config?.host,
          port: this.config?.port,
          secure: this.config?.secure,
          user: this.config?.auth.user
        }
      };
    } catch (error) {
      console.error('SMTP连接测试失败:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误',
        config: {
          host: this.config?.host,
          port: this.config?.port,
          secure: this.config?.secure,
          user: this.config?.auth.user
        }
      };
    }
  }

  // 发送邮件
  private async sendEmail(content: EmailContent): Promise<boolean> {
    if (!this.transporter) {
      throw new Error('邮件服务不可用，请检查SMTP配置');
    }

    try {
      // 使用已验证的发送者邮箱地址
      const fromEmail = process.env.FROM_EMAIL || this.config?.auth.user;
      
      const mailOptions = {
        from: `"Japanese Analyzer" <${fromEmail}>`,  // 使用已验证的发送者邮箱
        to: content.to,
        subject: content.subject,
        html: content.html,
        text: content.text,
      };

      console.log('准备发送邮件:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        smtpConfig: {
          host: this.config?.host,
          port: this.config?.port,
          secure: this.config?.secure,
          user: this.config?.auth.user
        }
      });

      const result = await this.transporter.sendMail(mailOptions);
      console.log('邮件发送成功:', result.messageId);
      return true;
    } catch (error) {
      console.error('邮件发送失败:', {
        error: error instanceof Error ? error.message : error,
        code: (error as { code?: string })?.code,
        command: (error as { command?: string })?.command,
        response: (error as { response?: string })?.response,
        responseCode: (error as { responseCode?: number })?.responseCode,
        smtpConfig: {
          host: this.config?.host,
          port: this.config?.port,
          secure: this.config?.secure,
          user: this.config?.auth.user
        }
      });
      throw error;
    }
  }

  // 发送注册验证码邮件
  public async sendRegistrationCode(email: string, code: string, username?: string): Promise<boolean> {
    const subject = '验证码 - 日语学习工具';  // 简化主题，避免垃圾邮件关键词
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>邮箱验证</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%); color: white; padding: 40px 20px; text-align: center; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .content { padding: 40px 30px; }
          .code-container { background-color: #f8f9fa; border: 2px dashed #007AFF; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
          .code { font-size: 32px; font-weight: bold; color: #007AFF; letter-spacing: 5px; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .button { display: inline-block; background-color: #007AFF; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin: 20px 0; color: #856404; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🈁 日语分析器</div>
            <div>AI驱动的日语学习工具</div>
          </div>
          
          <div class="content">
            <h2>邮箱验证</h2>
            <p>你好${username ? ' ' + username : ''}，</p>
            <p>感谢你注册日语分析器！请使用以下验证码完成邮箱验证：</p>
            
            <div class="code-container">
              <div style="font-size: 14px; color: #666; margin-bottom: 10px;">验证码</div>
              <div class="code">${code}</div>
            </div>
            
            <div class="warning">
              <strong>⚠️ 重要提示：</strong><br>
              • 此验证码将在 <strong>15分钟</strong> 后过期<br>
              • 请勿向任何人分享此验证码<br>
              • 如果你没有注册此账户，请忽略此邮件
            </div>
            
            <p>验证成功后，你将可以：</p>
            <ul>
              <li>✨ 使用AI分析日语句子结构</li>
              <li>📚 获得详细的词性和语法解释</li>
              <li>🔈 享受TTS朗读功能</li>
              <li>🖼️ 体验OCR图像识别</li>
            </ul>
            
            <p>如有任何问题，请联系我们的技术支持。</p>
          </div>
          
          <div class="footer">
            <p>© 2025 日语分析器. All rights reserved.</p>
            <p>这是一封自动发送的邮件，请勿回复。</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      【日语分析器】邮箱验证码
      
      你好${username ? ' ' + username : ''}，
      
      感谢你注册日语分析器！你的验证码是：${code}
      
      此验证码将在15分钟后过期，请尽快使用。
      如果你没有注册此账户，请忽略此邮件。
      
      © 2025 日语分析器
    `;

    return await this.sendEmail({ to: email, subject, html, text });
  }

  // 发送密码重置验证码邮件
  public async sendPasswordResetCode(email: string, code: string, username?: string): Promise<boolean> {
    const subject = '【日语分析器】密码重置验证码';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>密码重置</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #FF6B6B 0%, #FF8E8E 100%); color: white; padding: 40px 20px; text-align: center; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .content { padding: 40px 30px; }
          .code-container { background-color: #f8f9fa; border: 2px dashed #FF6B6B; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
          .code { font-size: 32px; font-weight: bold; color: #FF6B6B; letter-spacing: 5px; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin: 20px 0; color: #856404; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🔐 密码重置</div>
            <div>日语分析器</div>
          </div>
          
          <div class="content">
            <h2>重置你的密码</h2>
            <p>你好${username ? ' ' + username : ''}，</p>
            <p>我们收到了你的密码重置请求。请使用以下验证码重置你的密码：</p>
            
            <div class="code-container">
              <div style="font-size: 14px; color: #666; margin-bottom: 10px;">验证码</div>
              <div class="code">${code}</div>
            </div>
            
            <div class="warning">
              <strong>🔒 安全提示：</strong><br>
              • 此验证码将在 <strong>30分钟</strong> 后过期<br>
              • 请勿向任何人分享此验证码<br>
              • 如果你没有请求重置密码，请立即联系我们<br>
              • 建议使用强密码，包含字母、数字和特殊字符
            </div>
            
            <p>如果你没有请求重置密码，可能是有人尝试访问你的账户。建议你：</p>
            <ul>
              <li>🔍 检查你的账户安全</li>
              <li>🔄 更改为更强的密码</li>
              <li>📧 联系我们报告可疑活动</li>
            </ul>
          </div>
          
          <div class="footer">
            <p>© 2025 日语分析器. All rights reserved.</p>
            <p>这是一封自动发送的邮件，请勿回复。</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      【日语分析器】密码重置验证码
      
      你好${username ? ' ' + username : ''}，
      
      我们收到了你的密码重置请求。你的验证码是：${code}
      
      此验证码将在30分钟后过期，请尽快使用。
      如果你没有请求重置密码，请忽略此邮件或联系我们。
      
      © 2025 日语分析器
    `;

    return await this.sendEmail({ to: email, subject, html, text });
  }

  // 发送欢迎邮件
  public async sendWelcomeEmail(email: string, username?: string): Promise<boolean> {
    const subject = '🎉 欢迎加入日语分析器！';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>欢迎使用日语分析器</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 40px 20px; text-align: center; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .content { padding: 40px 30px; }
          .feature { background-color: #f8f9fa; border-left: 4px solid #28a745; padding: 15px; margin: 15px 0; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .button { display: inline-block; background-color: #28a745; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: bold; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🈁 日语分析器</div>
            <div>欢迎加入我们！</div>
          </div>
          
          <div class="content">
            <h2>🎉 欢迎，${username || ''}！</h2>
            <p>恭喜你成功注册日语分析器！现在你可以开始探索强大的日语学习功能了。</p>
            
            <h3>✨ 你现在可以使用：</h3>
            
            <div class="feature">
              <h4>🔍 智能句法分析</h4>
              <p>输入任何日语句子，AI会帮你分析词性、语法结构和含义</p>
            </div>
            
            <div class="feature">
              <h4>🖼️ OCR图像识别</h4>
              <p>上传图片或截图，自动识别并分析其中的日语文本</p>
            </div>
            
            <div class="feature">
              <h4>🔈 TTS语音朗读</h4>
              <p>听取标准的日语发音，提升你的听力和发音</p>
            </div>
            
            <div class="feature">
              <h4>🔄 智能翻译</h4>
              <p>获得准确的中文翻译，更好地理解日语内容</p>
            </div>
            
            <p>开始你的日语学习之旅吧！</p>
            
            <div style="text-align: center;">
              <a href="#" class="button">立即开始使用</a>
            </div>
            
            <p><strong>小贴士：</strong>建议将日语分析器添加到浏览器书签，随时随地学习日语！</p>
          </div>
          
          <div class="footer">
            <p>© 2025 日语分析器. All rights reserved.</p>
            <p>如有任何问题，请联系我们的客服团队。</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      欢迎加入日语分析器！
      
      恭喜你成功注册！现在你可以使用以下功能：
      
      ✨ 智能句法分析 - 分析日语句子结构
      🖼️ OCR图像识别 - 识别图片中的日语
      🔈 TTS语音朗读 - 听取标准日语发音
      🔄 智能翻译 - 准确的中文翻译
      
      开始你的日语学习之旅吧！
      
      © 2025 日语分析器
    `;

    return await this.sendEmail({ to: email, subject, html, text });
  }
}

// 导出单例实例
export const emailService = EmailService.getInstance();