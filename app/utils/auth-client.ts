// 客户端认证工具类

export interface AuthUser {
  id: number;
  email: string;
  username?: string;
  is_verified: boolean;
  avatar_url?: string;
  created_at: Date;
  last_login_at?: Date;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  authMode: 'user'; // 只支持用户认证
}

class AuthClientManager {
  private static instance: AuthClientManager;
  
  private constructor() {}

  public static getInstance(): AuthClientManager {
    if (!AuthClientManager.instance) {
      AuthClientManager.instance = new AuthClientManager();
    }
    return AuthClientManager.instance;
  }

  // 检查认证模式
  async checkAuthMode(): Promise<'user'> {
    try {
      // 简单密码验证已移除，只支持用户认证模式
      await fetch('/api/auth');
      
      // 只支持用户认证模式
      return 'user';
    } catch (error) {
      console.error('检查认证模式失败:', error);
      // 默认使用用户认证模式
      return 'user';
    }
  }

  // 检查当前认证状态
  getCurrentAuthState(): AuthState {
    if (typeof window === 'undefined') {
      return {
        isAuthenticated: false,
        user: null,
        token: null,
        authMode: 'user'
      };
    }

    // 只检查用户认证状态（简单密码验证已移除）
    const token = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        return {
          isAuthenticated: true,
          user,
          token,
          authMode: 'user'
        };
      } catch (error) {
        console.error('解析用户信息失败:', error);
        this.clearAuthData();
      }
    }

    return {
      isAuthenticated: false,
      user: null,
      token: null,
      authMode: 'user'
    };
  }

  // 设置用户认证状态
  setUserAuthState(token: string, user: AuthUser) {
    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    // 触发本地历史记录迁移（异步，不阻塞登录流程）
    this.migrateLocalHistory().catch(error => {
      console.error('自动迁移本地历史记录失败:', error);
    });
  }

  // 迁移本地历史记录到服务器
  private async migrateLocalHistory(): Promise<void> {
    try {
      // 动态导入以避免循环依赖
      const { migrateLocalHistoryToServer } = await import('./history');
      const migratedCount = await migrateLocalHistoryToServer();
      
      if (migratedCount > 0) {
        console.log(`成功迁移 ${migratedCount} 条历史记录到服务器`);
      }
    } catch (error) {
      console.error('迁移历史记录失败:', error);
    }
  }

  // 清除所有认证数据
  clearAuthData() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    // 清除遗留的简单认证状态
    localStorage.removeItem('isAuthenticated');
  }

  // 验证用户token是否有效
  async validateUserToken(): Promise<boolean> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      return false;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.user) {
          // 更新用户信息
          localStorage.setItem('user', JSON.stringify(data.data.user));
          return true;
        }
      }

      // Token无效，清除认证数据
      this.clearAuthData();
      return false;
    } catch (error) {
      console.error('验证token失败:', error);
      return false;
    }
  }

  // 退出登录
  logout() {
    this.clearAuthData();
    // 刷新页面或重定向到登录页面
    window.location.reload();
  }

  // 获取认证头
  getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('authToken');
    if (token) {
      return {
        'Authorization': `Bearer ${token}`
      };
    }
    return {};
  }

  // 检查是否需要认证
  async checkAuthRequirement(): Promise<{ 
    requiresAuth: boolean; 
    mode: 'user';
    isAuthenticated: boolean;
  }> {
    try {
      // 检查认证模式配置
      const authResponse = await fetch('/api/auth');
      
      if (authResponse.ok) {
        const authData = await authResponse.json();
        
        // 如果服务器指示使用用户认证模式
        if (authData.useUserAuth) {
          const authState = this.getCurrentAuthState();
          if (authState.authMode === 'user' && authState.token) {
            // 验证token是否仍然有效
            const isValid = await this.validateUserToken();
            return {
              requiresAuth: !isValid,
              mode: 'user',
              isAuthenticated: isValid
            };
          }

          // 需要用户认证
          return {
            requiresAuth: true,
            mode: 'user',
            isAuthenticated: false
          };
        }
        
        // 简单密码验证已移除，只使用用户认证模式
      }

      // 默认使用用户认证模式
      return {
        requiresAuth: true,
        mode: 'user',
        isAuthenticated: false
      };
    } catch (error) {
      console.error('检查认证需求失败:', error);
      // 出错时默认使用用户认证模式
      return {
        requiresAuth: true,
        mode: 'user',
        isAuthenticated: false
      };
    }
  }
}

// 导出单例实例
export const authClient = AuthClientManager.getInstance();