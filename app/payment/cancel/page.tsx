'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FaTimesCircle, FaHome, FaShoppingCart, FaSpinner } from 'react-icons/fa';

function PaymentCancelContent() {
  const searchParams = useSearchParams();
  const orderNo = searchParams.get('order_no');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <div className="text-orange-500 text-6xl mb-6">
          <FaTimesCircle className="mx-auto" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          支付已取消
        </h1>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          您的支付已被取消，订单仍在等待支付中
        </p>

        {orderNo && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              订单号: <span className="font-mono text-gray-900 dark:text-gray-100">{orderNo}</span>
            </p>
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
          
          <button
            onClick={() => window.history.back()}
            className="block w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 font-medium py-3 px-4 rounded-lg transition-colors"
          >
            <FaShoppingCart className="inline mr-2" />
            重新购买
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    }>
      <PaymentCancelContent />
    </Suspense>
  );
}