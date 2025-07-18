// 用户相关类型定义

export interface User {
  id: number;
  email: string;
  password_hash: string;
  username?: string;
  is_verified: boolean;
  is_active: boolean;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserInput {
  email: string;
  password: string;
  username?: string;
  is_verified?: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UserProfile {
  id: number;
  email: string;
  username?: string;
  is_verified: boolean;
  created_at: Date;
  last_login_at?: Date;
}

export interface VerificationCode {
  id: number;
  user_id?: number;
  email: string;
  code: string;
  type: 'registration' | 'password_reset' | 'email_change';
  expires_at: Date;
  is_used: boolean;
  created_at: Date;
}

export interface CreateVerificationCodeInput {
  email: string;
  type: 'registration' | 'password_reset' | 'email_change';
  user_id?: number;
}

export interface UserSession {
  id: number;
  user_id: number;
  token_hash: string;
  device_info?: string;
  ip_address?: string;
  expires_at: Date;
  last_used_at: Date;
  created_at: Date;
}

export interface JWTPayload {
  userId: number;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: UserProfile;
  message?: string;
}