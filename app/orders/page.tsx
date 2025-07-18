'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FaReceipt, FaSpinner, FaHome, FaCheckCircle, FaClock, FaTimes, FaRedo } from 'react-icons/fa';
// import { authClient } from '../utils/auth-client';

interface Order {
  id: number;
  order_no: string;
  product_name: string;
  product_price: number;
  duration_days: number;
  token_amount: number;
  currency: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  order_type: 'purchase' | 'renewal';
  created_at: string;
  paid_at?: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setError('请先登录');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/orders', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '获取订单列表失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryPayment = async (orderId: number) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        alert('请先登录');
        return;
      }

      const response = await fetch('/api/orders/retry-payment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderId })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.paymentUrl) {
          window.location.href = data.paymentUrl;
        }
      } else {
        const errorData = await response.json();
        alert(errorData.error || '重新支付失败');
      }
    } catch {
      alert('网络错误，请稍后重试');
    }
  };

  const formatPrice = (price: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(price);
  };

  const formatTokenAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <FaCheckCircle className="text-green-500" />;
      case 'pending':
        return <FaClock className="text-yellow-500" />;
      case 'failed':
        return <FaTimes className="text-red-500" />;
      case 'refunded':
        return <FaRedo className="text-gray-500" />;
      default:
        return <FaClock className="text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return '已支付';
      case 'pending':
        return '待支付';
      case 'failed':
        return '支付失败';
      case 'refunded':
        return '已退款';
      default:
        return '未知状态';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'refunded':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">正在加载订单...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            加载失败
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            <FaHome className="mr-2" />
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 dark:bg-blue-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FaReceipt className="text-white text-xl mr-3" />
                <h1 className="text-xl font-semibold text-white">我的订单</h1>
              </div>
              <Link
                href="/"
                className="text-blue-100 hover:text-white transition-colors"
              >
                <FaHome className="text-lg" />
              </Link>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {orders.length === 0 ? (
              <div className="text-center py-12">
                <FaReceipt className="text-4xl text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">暂无订单记录</p>
                <Link
                  href="/"
                  className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  <FaHome className="mr-2" />
                  返回首页
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {order.product_name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                          订单号: {order.order_no}
                        </p>
                      </div>
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(order.payment_status)}`}>
                        {getStatusIcon(order.payment_status)}
                        <span className="ml-1">{getStatusText(order.payment_status)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">价格:</span>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {formatPrice(order.product_price, order.currency)}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">有效期:</span>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {order.duration_days} 天
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">TOKEN:</span>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {formatTokenAmount(order.token_amount)}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">订单类型:</span>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {order.order_type === 'purchase' ? '购买' : '续费'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          创建时间: {formatDate(order.created_at)}
                          {order.paid_at && (
                            <span className="ml-4">
                              支付时间: {formatDate(order.paid_at)}
                            </span>
                          )}
                        </div>
                        {order.payment_status === 'pending' && (
                          <button
                            onClick={() => handleRetryPayment(order.id)}
                            className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1 px-3 rounded transition-colors"
                          >
                            <FaRedo className="mr-1" />
                            重新支付
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}