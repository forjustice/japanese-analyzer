'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FaCheckCircle, FaSpinner, FaHome, FaReceipt } from 'react-icons/fa';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const orderNo = searchParams.get('order_no');
  const [loading, setLoading] = useState(true);
  const [orderInfo, setOrderInfo] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  const fetchOrderInfo = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('请先登录');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/orders/${orderNo}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOrderInfo(data.order);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '获取订单信息失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [orderNo]);

  useEffect(() => {
    if (orderNo) {
      fetchOrderInfo();
    } else {
      setLoading(false);
      setError('订单号不存在');
    }
  }, [orderNo, fetchOrderInfo]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const formatTokenAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">正在确认支付结果...</p>
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
            获取订单信息失败
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <div className="text-green-500 text-6xl mb-6">
          <FaCheckCircle className="mx-auto" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          支付成功！
        </h1>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          感谢您的购买，您的TOKEN额度已更新
        </p>

        {orderInfo && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
              <FaReceipt className="mr-2" />
              订单详情
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">订单号:</span>
                <span className="font-mono text-gray-900 dark:text-gray-100">{orderInfo.order_no as string}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">商品:</span>
                <span className="text-gray-900 dark:text-gray-100">{orderInfo.product_name as string}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">价格:</span>
                <span className="text-gray-900 dark:text-gray-100">{formatPrice(orderInfo.product_price as number)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">有效期:</span>
                <span className="text-gray-900 dark:text-gray-100">{orderInfo.duration_days as number} 天</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">TOKEN:</span>
                <span className="text-gray-900 dark:text-gray-100">{formatTokenAmount(orderInfo.token_amount as number)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Link
            href="/"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            <FaHome className="inline mr-2" />
            返回首页
          </Link>
          
          <Link
            href="/orders"
            className="block w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 font-medium py-3 px-4 rounded-lg transition-colors"
          >
            <FaReceipt className="inline mr-2" />
            查看我的订单
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}