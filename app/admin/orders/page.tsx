'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';
import { AlertTriangle, ShoppingCart } from 'lucide-react';
import ShadcnAdminTheme from '../components/ShadcnAdminTheme';

interface Order {
  id: number;
  order_no: string;
  user_id: number;
  product_name: string;
  product_price: number;
  payment_status: 'pending' | 'paid' | 'failed';
  created_at: string;
  user: {
    username: string;
    email: string;
  }
}

export default function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setError('Authentication token not found.');
        return;
      }

      const response = await fetch('/api/admin/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders);
      } else {
        const res = await response.json();
        setError(res.error || 'Failed to load orders.');
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const renderLoadingSkeleton = () => (
    <div className="space-y-4">
      {[...Array(10)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );

  const getStatusVariant = (status: Order['payment_status']) => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <ShadcnAdminTheme
      title="订单管理"
      subtitle="查看和管理所有用户订单"
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ShoppingCart className="w-5 h-5 mr-2" />
            订单列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? renderLoadingSkeleton() : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>订单号</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead>商品</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>下单时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono">{order.order_no}</TableCell>
                    <TableCell>
                      <div>{order.user.username}</div>
                      <div className="text-sm text-muted-foreground">{order.user.email}</div>
                    </TableCell>
                    <TableCell>{order.product_name}</TableCell>
                    <TableCell>{formatPrice(order.product_price)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(order.payment_status)}>
                        {order.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(order.created_at)}</TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      暂无订单数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </ShadcnAdminTheme>
  );
}
