import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface EmailProvider {
  name: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  enabled: boolean;
}

interface EmailContent {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class MultiEmailService {
  private static instance: MultiEmailService;
  private providers: EmailProvider[] = [];
  private currentProvider: EmailProvider | null = null;
  private transporter: Transporter | null = null;

  private constructor() {
    this.initProviders();
  }

  public static getInstance(): MultiEmailService {
    if (!MultiEmailService.instance) {
      MultiEmailService.instance = new MultiEmailService();
    }
    return MultiEmailService.instance;
  }

  private initProviders(): void {
    // 从环境变量加载邮件服务商配置
    const providers: EmailProvider[] = [];

    // Brevo 配置
    if (process.env.SMTP_HOST?.includes('brevo.com') && process.env.SMTP_USER && process.env.SMTP_PASS) {
      providers.push({
        name: 'Brevo',
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        enabled: true
      });
    }

    // Gmail 备用配置
    if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
      providers.push({
        name: 'Gmail',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
        enabled: true
      });
    }

    // QQ 邮箱备用配置
    if (process.env.QQ_USER && process.env.QQ_PASS) {
      providers.push({
        name: 'QQ Mail',
        host: 'smtp.qq.com',
        port: 587,
        secure: false,
        user: process.env.QQ_USER,
        pass: process.env.QQ_PASS,
        enabled: true
      });
    }

    this.providers = providers;
    console.log(`发现 ${providers.length} 个邮件服务商:`, providers.map(p => p.name));
  }

  private async createTransporter(provider: EmailProvider): Promise<Transporter> {
    const isBrevo = provider.host.includes('brevo.com');
    const isGmail = provider.host.includes('gmail.com');

    const config = {
      host: provider.host,
      port: provider.port,
      secure: provider.secure,
      auth: {
        user: provider.user,
        pass: provider.pass,
        ...(isBrevo && { type: 'login' })
      },
      ...(isBrevo && {
        authMethod: 'LOGIN',
        tls: { rejectUnauthorized: false }
      }),
      ...(isGmail && {
        tls: { rejectUnauthorized: true }
      })
    };

    return nodemailer.createTransport(config);
  }

  private async testProvider(provider: EmailProvider): Promise<boolean> {
    try {
      console.log(`测试邮件服务商: ${provider.name}`);
      const transporter = await this.createTransporter(provider);
      await transporter.verify();
      console.log(`✅ ${provider.name} 连接成功`);
      return true;
    } catch (error) {
      console.log(`❌ ${provider.name} 连接失败:`, (error as Error).message);
      return false;
    }
  }

  public async selectWorkingProvider(): Promise<boolean> {
    for (const provider of this.providers.filter(p => p.enabled)) {
      if (await this.testProvider(provider)) {
        this.currentProvider = provider;
        this.transporter = await this.createTransporter(provider);
        console.log(`🎉 选择邮件服务商: ${provider.name}`);
        return true;
      }
    }
    
    console.error('❌ 没有可用的邮件服务商');
    return false;
  }

  public async sendEmail(content: EmailContent): Promise<boolean> {
    if (!this.currentProvider || !this.transporter) {
      // 尝试选择一个可用的服务商
      const hasProvider = await this.selectWorkingProvider();
      if (!hasProvider) {
        throw new Error('没有可用的邮件服务商');
      }
    }

    try {
      const mailOptions = {
        from: `"日语分析器" <${this.currentProvider!.user}>`,
        to: content.to,
        subject: content.subject,
        html: content.html,
        text: content.text,
      };

      console.log(`使用 ${this.currentProvider!.name} 发送邮件到: ${content.to}`);
      const result = await this.transporter!.sendMail(mailOptions);
      console.log(`✅ 邮件发送成功 (${this.currentProvider!.name}):`, result.messageId);
      return true;
    } catch (error) {
      console.error(`❌ ${this.currentProvider!.name} 发送失败:`, (error as Error).message);
      
      // 标记当前服务商为不可用，尝试下一个
      this.currentProvider!.enabled = false;
      this.currentProvider = null;
      this.transporter = null;
      
      // 递归尝试其他服务商
      const remainingProviders = this.providers.filter(p => p.enabled);
      if (remainingProviders.length > 0) {
        console.log('尝试切换到其他邮件服务商...');
        return await this.sendEmail(content);
      }
      
      throw error;
    }
  }

  public getCurrentProvider(): string {
    return this.currentProvider?.name || '无';
  }

  public getAvailableProviders(): string[] {
    return this.providers.filter(p => p.enabled).map(p => p.name);
  }

  // 重置所有服务商状态
  public resetProviders(): void {
    this.providers.forEach(p => p.enabled = true);
    this.currentProvider = null;
    this.transporter = null;
  }
}

// 导出单例实例
export const multiEmailService = MultiEmailService.getInstance();