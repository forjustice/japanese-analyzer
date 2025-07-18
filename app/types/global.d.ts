// 全局类型声明

// 添加ruby相关元素到JSX.IntrinsicElements
declare namespace JSX {
  interface IntrinsicElements {
    ruby: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    rt: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    rb: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
  }
}

// 用户认证相关类型
interface AuthUser {
  id: number;
  email: string;
  username?: string;
  is_verified: boolean;
  created_at: Date;
  last_login_at?: Date;
}

interface AuthResponse {
  success: boolean;
  token?: string;
  user?: AuthUser;
  message?: string;
  data?: Record<string, unknown>;
}

interface RegisterData {
  email: string;
  password: string;
  username?: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface VerifyCodeData {
  email: string;
  code: string;
  type?: 'registration' | 'password_reset' | 'email_change';
}

interface ResetPasswordData {
  email: string;
  code: string;
  newPassword: string;
} 