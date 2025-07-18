'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  Users, 
  Activity, 
  MessageSquare,
  FileText,
  Volume2,
  Image,
  RefreshCw,
  Download,
  AlertTriangle,
  Key
} from 'lucide-react';

import ShadcnAdminTheme from '../components/ShadcnAdminTheme';
import { Button } from '@/app/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/app/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';
import { Skeleton } from '@/app/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import adminApiClient from '@/app/utils/admin-api-client';
import { toast } from 'sonner';

interface SystemStats {
  totalUsers: number;
  totalRequests: number;
  totalTokenUsage: number;
  activeKeys: number;
  systemStatus: 'healthy' | 'warning' | 'error';
  uptime: string;
}

interface ServiceStats {
  analyze: { requests: number; tokens: number };
  translate: { requests: number; tokens: number };
  tts: { requests: number; tokens: number };
  ocr: { requests: number; tokens: number };
}

interface DailyStats {
  date: string;
  users: number;
  requests: number;
  tokens: number;
}

interface AnalyticsData {
  systemStats: SystemStats;
  serviceStats: ServiceStats;
  dailyStats: DailyStats[];
  monthlyGrowth: {
    users: number;
    requests: number;
    tokens: number;
  };
}

const StatCard = ({ title, value, icon: Icon, change, trend }: { title: string, value: string | number, icon: React.ElementType, change?: string, trend?: 'up' | 'down' | 'neutral' }) => {
  const trendColor = trend === 'up' ? 'text-green-600 dark:text-green-400' : trend === 'down' ? 'text-red-600 dark:text-red-400' : '';
  const trendSymbol = trend === 'up' ? '+' : '';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <p className={`text-xs text-muted-foreground ${trendColor}`}>
            {trendSymbol}{change}% vs last month
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const ServiceCard = ({ icon: Icon, title, requests, tokens, color }: { icon: React.ElementType, title: string, requests: number, tokens: number, color: string }) => (
  <Card>
    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <CardTitle className="text-md font-medium">{title}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-sm text-muted-foreground">Requests</span>
        <span className="font-semibold">{requests.toLocaleString()}</span>
      </div>
      <div className="flex justify-between items-baseline">
        <span className="text-sm text-muted-foreground">Tokens</span>
        <span className="font-semibold">{tokens.toLocaleString()}</span>
      </div>
    </CardContent>
  </Card>
);

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('7d');

  const fetchAnalyticsData = useCallback(async (range: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await adminApiClient.get(`/admin/stats?range=${range}`);
      setData(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching analytics data.');
      toast.error('Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalyticsData(timeRange);
  }, [timeRange, fetchAnalyticsData]);

  const handleExport = () => {
    if (!data || !data.dailyStats || data.dailyStats.length === 0) {
      toast.warning('No data available to export.');
      return;
    }

    const headers = ['Date', 'Active Users', 'Requests', 'Token Usage', 'Avg. Tokens/User'];
    const rows = data.dailyStats.map(stat => [
      new Date(stat.date).toLocaleDateString(),
      stat.users,
      stat.requests,
      stat.tokens,
      stat.users > 0 ? Math.round(stat.tokens / stat.users) : 0
    ].join(','));

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `analytics_report_${timeRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Report exported successfully.');
  };

  const getTrend = (value: number): 'up' | 'down' | 'neutral' => {
    if (value > 0) return 'up';
    if (value < 0) return 'down';
    return 'neutral';
  };

  const renderLoadingSkeleton = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-96" />
    </div>
  );

  return (
    <ShadcnAdminTheme
      title="Data Analytics"
      subtitle="System usage insights and performance trends."
      actions={
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border shadow-md z-[60]">
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={loading || !data}>
            <Download className="w-4 h-4 mr-2" />Export Report
          </Button>
          <Button size="sm" onClick={() => fetchAnalyticsData(timeRange)} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? renderLoadingSkeleton() : !data ? (
        <Alert>
          <AlertTitle>No Data</AlertTitle>
          <AlertDescription>Could not load analytics data. Try refreshing.</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total Users" value={data.systemStats.totalUsers} icon={Users} change={`${data.monthlyGrowth.users}`} trend={getTrend(data.monthlyGrowth.users)} />
            <StatCard title="Total Requests" value={data.systemStats.totalRequests.toLocaleString()} icon={Activity} change={`${data.monthlyGrowth.requests}`} trend={getTrend(data.monthlyGrowth.requests)} />
            <StatCard title="Token Usage" value={data.systemStats.totalTokenUsage.toLocaleString()} icon={TrendingUp} change={`${data.monthlyGrowth.tokens}`} trend={getTrend(data.monthlyGrowth.tokens)} />
            <StatCard title="Active Keys" value={data.systemStats.activeKeys} icon={Key} />
          </div>

          {/* Service Usage */}
          <Card>
            <CardHeader>
              <CardTitle>Service Usage Analysis</CardTitle>
              <CardDescription>Breakdown of usage statistics by service.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <ServiceCard icon={MessageSquare} title="Text Analysis" requests={data.serviceStats.analyze.requests} tokens={data.serviceStats.analyze.tokens} color="bg-purple-500 dark:bg-purple-600" />
              <ServiceCard icon={FileText} title="Translation" requests={data.serviceStats.translate.requests} tokens={data.serviceStats.translate.tokens} color="bg-blue-500 dark:bg-blue-600" />
              <ServiceCard icon={Volume2} title="TTS" requests={data.serviceStats.tts.requests} tokens={data.serviceStats.tts.tokens} color="bg-green-500 dark:bg-green-600" />
              <ServiceCard icon={Image} title="OCR" requests={data.serviceStats.ocr.requests} tokens={data.serviceStats.ocr.tokens} color="bg-orange-500 dark:bg-orange-600" />
            </CardContent>
          </Card>

          {/* Detailed Usage Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Usage</CardTitle>
              <CardDescription>Daily breakdown of key metrics for the selected time range.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Active Users</TableHead>
                    <TableHead>Requests</TableHead>
                    <TableHead>Token Usage</TableHead>
                    <TableHead>Avg. Tokens/User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.dailyStats.map((stat) => (
                    <TableRow key={stat.date}>
                      <TableCell>{new Date(stat.date).toLocaleDateString()}</TableCell>
                      <TableCell>{stat.users.toLocaleString()}</TableCell>
                      <TableCell>{stat.requests.toLocaleString()}</TableCell>
                      <TableCell>{stat.tokens.toLocaleString()}</TableCell>
                      <TableCell>{stat.users > 0 ? Math.round(stat.tokens / stat.users).toLocaleString() : 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </ShadcnAdminTheme>
  );
}
