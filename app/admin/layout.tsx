'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { RefreshCw, Home, Users, Key, Settings, TrendingUp } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ThemeProvider } from '../contexts/ThemeContext';

const navItems = [
  { href: '/admin', label: '仪表板', icon: Home },
  { href: '/admin/users', label: '用户管理', icon: Users },
  { href: '/admin/keys', label: '密钥管理', icon: Key },
  { href: '/admin/analytics', label: '数据分析', icon: TrendingUp },
  { href: '/admin/config', label: '系统配置', icon: Settings },
];

import { Toaster } from 'sonner';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    
    const token = localStorage.getItem('admin_token');
    if (!token && !isLoginPage) {
      router.push('/admin/login');
    }
  }, [pathname, router, isLoginPage, isMounted]);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    router.push('/admin/login');
  };

  const pageTitle = useMemo(() => {
    return navItems.find(item => item.href === pathname)?.label || '管理后台';
  }, [pathname]);

  if (isLoginPage) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-background">
          <Toaster richColors />
          {children}
        </div>
      </ThemeProvider>
    );
  }

  if (!isMounted) {
    return (
      <ThemeProvider>
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">加载中...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="flex h-screen bg-background">
        <Toaster richColors />
        <Sidebar 
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onLogout={handleLogout}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header 
            isMobileMenuOpen={isMobileMenuOpen}
            onMobileMenuOpenChange={setIsMobileMenuOpen}
            onLogout={handleLogout}
            pageTitle={pageTitle}
          />
          <main className="flex-1 overflow-y-auto bg-muted/50">
            <div className="container mx-auto p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
