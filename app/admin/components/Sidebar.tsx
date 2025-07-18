'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Home, Users, Key, Settings, TrendingUp, LogOut, User, ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Separator } from '@/app/components/ui/separator';
import { Badge } from '@/app/components/ui/badge';

interface AdminUser {
  id: number;
  username: string;
  email?: string;
  role: 'super_admin' | 'admin';
}

const navItems = [
  { href: '/admin', label: '仪表板', icon: Home },
  { href: '/admin/users', label: '用户管理', icon: Users },
  { href: '/admin/keys', label: '密钥管理', icon: Key },
  { href: '/admin/products', label: '商品管理', icon: ShoppingCart },
  { href: '/admin/orders', label: '订单管理', icon: ShoppingCart },
  { href: '/admin/analytics', label: '数据分析', icon: TrendingUp },
  { href: '/admin/config', label: '系统配置', icon: Settings },
];

interface SidebarProps {
  isCollapsed: boolean;
  isMobile?: boolean;
  onLogout: () => void;
  onToggle?: () => void;
  onLinkClick?: () => void;
}

export function Sidebar({ isCollapsed, isMobile = false, onLogout, onToggle, onLinkClick }: SidebarProps) {
  const pathname = usePathname();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    // 从localStorage获取token并解析管理员信息
    const token = localStorage.getItem('admin_token');
    if (token) {
      try {
        // 解析JWT token (简单解析，不验证签名)
        const payload = JSON.parse(atob(token.split('.')[1]));
        setAdminUser({
          id: payload.id,
          username: payload.username,
          email: payload.email,
          role: payload.role
        });
      } catch (error) {
        console.error('解析管理员token失败:', error);
      }
    }
  }, []);

  return (
    <aside className={`relative flex flex-col border-r bg-card transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'} ${isMobile ? 'h-full' : 'hidden lg:flex'}`}>
      <div className="flex flex-col h-full">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3 p-6 border-b">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Settings className="w-4 h-4 text-primary-foreground" />
          </div>
          {(!isCollapsed || isMobile) && (
            <div>
              <h2 className="text-lg font-semibold">管理后台</h2>
              <p className="text-xs text-muted-foreground">Japanese Analyzer</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-4 py-6">
          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onLinkClick}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {(!isCollapsed || isMobile) && <span>{item.label}</span>}
                  {isActive && (!isCollapsed || isMobile) && (
                    <Badge variant="secondary" className="ml-auto">•</Badge>
                  )}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* User Profile */}
        <div className="p-4 border-t">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src="/admin-avatar.png" />
              <AvatarFallback>
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            {(!isCollapsed || isMobile) && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {adminUser?.username || '管理员'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {adminUser?.role === 'super_admin' ? '超级管理员' : 
                   adminUser?.role === 'admin' ? '管理员' : '未知角色'}
                </p>
              </div>
            )}
          </div>
          <Separator className="my-3" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4" />
            {(!isCollapsed || isMobile) && <span>退出登录</span>}
          </Button>
        </div>
      </div>
      
      {/* Collapse Toggle */}
      {!isMobile && onToggle && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full border bg-background shadow-md"
        >
          {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </Button>
      )}
    </aside>
  );
}