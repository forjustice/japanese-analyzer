'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X,
  Check,
  AlertTriangle,
  Coins as RmbIcon,
  Clock,
  Coins
} from 'lucide-react';

import ShadcnAdminTheme from '../components/ShadcnAdminTheme';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Switch } from '@/app/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';
import { Skeleton } from '@/app/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';

interface Product {
  id?: number;
  name: string;
  description: string;
  price: number;
  duration_days: number;
  token_amount: number;
  status: 'active' | 'inactive';
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

const initialProduct: Product = {
  name: '',
  description: '',
  price: 0,
  duration_days: 0,
  token_amount: 0,
  status: 'active',
  sort_order: 0
};

export default function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 编辑状态
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product>(initialProduct);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // 删除确认状态
  const [deleteConfirm, setDeleteConfirm] = useState<{open: boolean, product: Product | null}>({
    open: false,
    product: null
  });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setError('Authentication token not found.');
        return;
      }

      const response = await fetch('/api/admin/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setProducts(data.products);
      } else {
        const res = await response.json();
        setError(res.error || 'Failed to load products.');
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleCreateProduct = () => {
    setEditingProduct(initialProduct);
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const url = isEditing ? '/api/admin/products' : '/api/admin/products';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(editingProduct)
      });

      if (response.ok) {
        setSuccess(isEditing ? '商品更新成功' : '商品创建成功');
        setTimeout(() => setSuccess(''), 3000);
        setIsDialogOpen(false);
        fetchProducts();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save product.');
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setSuccess('商品删除成功');
        setTimeout(() => setSuccess(''), 3000);
        setDeleteConfirm({ open: false, product: null });
        fetchProducts();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete product.');
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'An unexpected error occurred.');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY'
    }).format(price);
  };

  const formatTokenAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount);
  };

  const renderLoadingSkeleton = () => (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <ShadcnAdminTheme
      title="商品管理"
      subtitle="管理商城商品信息，包括价格、时长和TOKEN配额"
      actions={
        <Button onClick={handleCreateProduct}>
          <Plus className="w-4 h-4 mr-2" />
          新增商品
        </Button>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert variant="default" className="mb-4 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertTitle className="text-green-800 dark:text-green-200">成功</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">{success}</AlertDescription>
        </Alert>
      )}

      {loading ? renderLoadingSkeleton() : (
        <Card>
          <CardHeader>
            <CardTitle>商品列表</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品名称</TableHead>
                  <TableHead>价格</TableHead>
                  <TableHead>时长</TableHead>
                  <TableHead>TOKEN额度</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>排序</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-xs">
                          {product.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <span className="w-4 h-4 mr-1 text-green-600 dark:text-green-400 text-sm font-bold">¥</span>
                        {formatPrice(product.price)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1 text-blue-600 dark:text-blue-400" />
                        {product.duration_days} 天
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Coins className="w-4 h-4 mr-1 text-orange-600 dark:text-orange-400" />
                        {formatTokenAmount(product.token_amount)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                        {product.status === 'active' ? '上架' : '下架'}
                      </Badge>
                    </TableCell>
                    <TableCell>{product.sort_order}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditProduct(product)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteConfirm({ open: true, product })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {products.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      暂无商品数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 编辑/新增对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl admin-dialog-content">
          <DialogHeader>
            <DialogTitle>{isEditing ? '编辑商品' : '新增商品'}</DialogTitle>
            <DialogDescription>
              {isEditing ? '修改商品信息' : '创建新的商品'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                商品名称 *
              </Label>
              <Input
                id="name"
                value={editingProduct.name}
                onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="description" className="text-right pt-2">
                商品介绍
              </Label>
              <Textarea
                id="description"
                value={editingProduct.description}
                onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})}
                className="col-span-3"
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price" className="text-right">
                价格 (¥) *
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={editingProduct.price}
                onChange={(e) => setEditingProduct({...editingProduct, price: parseFloat(e.target.value) || 0})}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="duration_days" className="text-right">
                时长 (天) *
              </Label>
              <Input
                id="duration_days"
                type="number"
                min="0"
                value={editingProduct.duration_days}
                onChange={(e) => setEditingProduct({...editingProduct, duration_days: parseInt(e.target.value) || 0})}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="token_amount" className="text-right">
                TOKEN数量 *
              </Label>
              <Input
                id="token_amount"
                type="number"
                min="0"
                value={editingProduct.token_amount}
                onChange={(e) => setEditingProduct({...editingProduct, token_amount: parseInt(e.target.value) || 0})}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="sort_order" className="text-right">
                排序权重
              </Label>
              <Input
                id="sort_order"
                type="number"
                min="0"
                value={editingProduct.sort_order}
                onChange={(e) => setEditingProduct({...editingProduct, sort_order: parseInt(e.target.value) || 0})}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                状态
              </Label>
              <div className="col-span-3 flex items-center space-x-2">
                <Switch
                  id="status"
                  checked={editingProduct.status === 'active'}
                  onCheckedChange={(checked) => setEditingProduct({
                    ...editingProduct, 
                    status: checked ? 'active' : 'inactive'
                  })}
                />
                <Label htmlFor="status">
                  {editingProduct.status === 'active' ? '上架' : '下架'}
                </Label>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
              <X className="w-4 h-4 mr-2" />
              取消
            </Button>
            <Button onClick={handleSaveProduct} disabled={saving || !editingProduct.name}>
              <Save className={`w-4 h-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm({ open, product: null })}>
        <DialogContent className="admin-dialog-content">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除商品 &quot;{deleteConfirm.product?.name}&quot; 吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirm({ open: false, product: null })}
            >
              取消
            </Button>
            <Button 
              variant="destructive"
              onClick={() => deleteConfirm.product && handleDeleteProduct(deleteConfirm.product)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ShadcnAdminTheme>
  );
}