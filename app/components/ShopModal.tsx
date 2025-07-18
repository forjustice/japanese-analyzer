'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaShoppingCart, FaClock, FaCoins, FaDollarSign, FaSpinner } from 'react-icons/fa';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  duration_days: number;
  token_amount: number;
  status: 'active' | 'inactive';
  sort_order: number;
}

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShopModal({ isOpen, onClose }: ShopModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [purchaseLoading, setPurchaseLoading] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  const fetchProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/shop/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '获取商品列表失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (productId: number) => {
    setPurchaseLoading(productId);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        alert('请先登录');
        return;
      }

      const response = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ productId, orderType: 'purchase' })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.paymentUrl) {
          window.location.href = data.paymentUrl;
        }
      } else {
        const errorData = await response.json();
        alert(errorData.error || '购买失败，请稍后重试');
      }
    } catch {
      alert('网络错误，请稍后重试');
    } finally {
      setPurchaseLoading(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const formatTokenAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <FaShoppingCart className="text-blue-600 dark:text-blue-400 mr-3 text-xl" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">TOKEN商城</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="text-red-700 dark:text-red-300 text-sm">{error}</div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <FaSpinner className="animate-spin text-2xl text-gray-400" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">加载中...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <div key={product.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {product.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 min-h-[3rem]">
                      {product.description}
                    </p>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-center text-2xl font-bold text-green-600 dark:text-green-400">
                        <FaDollarSign className="text-lg mr-1" />
                        {formatPrice(product.price)}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-center text-sm text-gray-600 dark:text-gray-400">
                          <FaClock className="mr-2" />
                          有效期：{product.duration_days} 天
                        </div>
                        <div className="flex items-center justify-center text-sm text-gray-600 dark:text-gray-400">
                          <FaCoins className="mr-2" />
                          TOKEN：{formatTokenAmount(product.token_amount)}
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handlePurchase(product.id)}
                      disabled={purchaseLoading === product.id}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
                    >
                      {purchaseLoading === product.id ? (
                        <>
                          <FaSpinner className="animate-spin mr-2" />
                          处理中...
                        </>
                      ) : (
                        <>
                          <FaShoppingCart className="mr-2" />
                          立即购买
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
              
              {products.length === 0 && !loading && (
                <div className="col-span-full text-center py-12">
                  <FaShoppingCart className="text-4xl text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">暂无商品</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}