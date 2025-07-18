// app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  Activity, 
  Key, 
  TrendingUp,
  Server,
  Clock,
  Settings,
  BarChart3,
  RefreshCw,
  UserPlus,
  FileCog
} from 'lucide-react';
import Link from 'next/link';
import ShadcnAdminTheme from './components/ShadcnAdminTheme';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';
import { Skeleton } from '@/app/components/ui/skeleton';
import { formatDistance } from 'date-fns';

interface RecentActivity {
  type: 'new_user' | 'api_key_update' | 'config_update';
  description: string;
  timestamp: string;
}

interface SystemStats {
  totalUsers: number;
  totalRequests: number;
  totalTokenUsage: number;
  activeKeys: number;
  systemStatus: 'healthy' | 'warning' | 'error';
  uptime: string;
  serverTime?: string;
  monthlyGrowth?: {
    users: number;
    requests: number;
    tokens: number;
  };
  recentActivity?: RecentActivity[];
}

interface QuickLinkProps {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}

const StatCard = ({ title, value, icon: Icon, change, trend }: { title: string, value: string | number, icon: React.ElementType, change?: string, trend?: 'up' | 'down' }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {change && (
        <p className={`text-xs text-muted-foreground ${trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {change} vs last month
        </p>
      )}
    </CardContent>
  </Card>
);

const QuickLinkCard: React.FC<QuickLinkProps> = ({ href, icon: Icon, title, description }) => (
  <Link href={href} className="block hover:bg-muted/50 rounded-lg transition-colors">
    <Card className="h-full border-0 shadow-none bg-transparent">
      <CardContent className="flex flex-col items-center text-center p-6 space-y-3">
        <div className="p-3 bg-primary/10 rounded-lg">
          <Icon className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </CardContent>
    </Card>
  </Link>
);

const ActivityIcon = ({ type }: { type: RecentActivity['type'] }) => {
  switch (type) {
    case 'new_user':
      return <UserPlus className="w-4 h-4 text-green-600 dark:text-green-400" />;
    case 'api_key_update':
      return <Key className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    case 'config_update':
      return <FileCog className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />;
    default:
      return <Activity className="w-4 h-4 text-muted-foreground" />;
  }
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setError('Authentication token not found.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const renderLoading = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );

  if (error) {
    return (
      <ShadcnAdminTheme
        title="Admin Dashboard"
        subtitle="An error occurred while loading the dashboard."
      >
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </ShadcnAdminTheme>
    );
  }

  return (
    <ShadcnAdminTheme 
      title="Admin Dashboard" 
      subtitle="Overview of system metrics and quick actions."
      actions={
        <Button 
          variant="outline" 
          size="sm"
          onClick={fetchDashboardData}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      }
    >
      {loading ? renderLoading() : (
        <div className="space-y-6">
          {/* 统计卡片 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Users"
              value={stats?.totalUsers ?? 0}
              icon={Users}
              change={stats?.monthlyGrowth?.users ? 
                `${stats.monthlyGrowth.users > 0 ? '+' : ''}${stats.monthlyGrowth.users.toFixed(1)}%` : 
                undefined}
              trend={stats?.monthlyGrowth?.users && stats.monthlyGrowth.users > 0 ? "up" : "down"}
            />
            <StatCard
              title="Total Requests"
              value={stats?.totalRequests ?? 0}
              icon={Activity}
              change={stats?.monthlyGrowth?.requests ? 
                `${stats.monthlyGrowth.requests > 0 ? '+' : ''}${stats.monthlyGrowth.requests.toFixed(1)}%` : 
                undefined}
              trend={stats?.monthlyGrowth?.requests && stats.monthlyGrowth.requests > 0 ? "up" : "down"}
            />
            <StatCard
              title="Token Usage"
              value={(stats?.totalTokenUsage ?? 0).toLocaleString()}
              icon={TrendingUp}
              change={stats?.monthlyGrowth?.tokens ? 
                `${stats.monthlyGrowth.tokens > 0 ? '+' : ''}${stats.monthlyGrowth.tokens.toFixed(1)}%` : 
                undefined}
              trend={stats?.monthlyGrowth?.tokens && stats.monthlyGrowth.tokens > 0 ? "up" : "down"}
            />
            <StatCard
              title="Active Keys"
              value={stats?.activeKeys ?? 0}
              icon={Key}
            />
          </div>

          {/* 快捷操作和系统状态 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 快捷操作 */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Quick Management</CardTitle>
                <CardDescription>Quickly access main management functions.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <QuickLinkCard 
                    href="/admin/users" 
                    icon={Users} 
                    title="User Management" 
                    description="Manage user accounts"
                  />
                  <QuickLinkCard 
                    href="/admin/keys" 
                    icon={Key} 
                    title="API Keys" 
                    description="Manage API keys"
                  />
                  <QuickLinkCard 
                    href="/admin/analytics" 
                    icon={BarChart3} 
                    title="Analytics" 
                    description="View usage statistics"
                  />
                  <QuickLinkCard 
                    href="/admin/config" 
                    icon={Settings} 
                    title="System Config" 
                    description="System settings"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 系统状态 */}
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
                <CardDescription>Current system operational status.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Server className="w-5 h-5 text-muted-foreground" />
                    <span className="font-medium">Service Status</span>
                  </div>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    stats?.systemStatus === 'healthy' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                      : stats?.systemStatus === 'warning'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                  }`}>
                    {stats?.systemStatus === 'healthy' ? '正常' : 
                     stats?.systemStatus === 'warning' ? '警告' : '错误'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <span className="font-medium">Uptime</span>
                  </div>
                  <span className="text-sm font-mono">
                    {stats?.uptime ?? 'N/A'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Activity className="w-5 h-5 text-muted-foreground" />
                    <span className="font-medium">System Load</span>
                  </div>
                  <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                    Low
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 最近活动 */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Recent important activities and events in the system.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <ActivityIcon type={activity.type} />
                      <span className="text-sm">{activity.description}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {stats.serverTime ? formatDistance(new Date(activity.timestamp), new Date(stats.serverTime), { addSuffix: true }) : ''}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground p-4">
                  No recent activity to display.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </ShadcnAdminTheme>
  );
}