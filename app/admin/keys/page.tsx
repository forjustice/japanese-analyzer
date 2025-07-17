'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Key, 
  CheckCircle,
  XCircle,
  Terminal,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';

import ShadcnAdminTheme from '../components/ShadcnAdminTheme';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { toast } from 'sonner';

interface ApiKeyStatus {
  id?: number;
  name?: string;
  key: string;
  fullKey?: string;
  isWorking: boolean;
  failureCount: number;
  provider: string;
  models?: string[];
}

export default function KeyManagement() {
  const [keys, setKeys] = useState<ApiKeyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKeyStatus | null>(null);
  const [showPasswords, setShowPasswords] = useState<{[key: number]: boolean}>({});
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<ApiKeyStatus | null>(null);
  
  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    key_value: '',
    provider: '',
    models: ''
  });

  // 预设的常用模型
  const providerModels = {
    openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini'],
    claude: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-3-5-sonnet'],
    gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro', 'gemini-pro-vision']
  };

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setError('Authentication token not found.');
        return;
      }

      const response = await fetch('/api/admin/keys', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setKeys(data.keys);
        setError('');
      } else {
        const res = await response.json();
        setError(res.error || 'Failed to load API keys.');
      }
    } catch (err) {
      const error = err as Error;
      console.error('Failed to fetch API keys:', error);
      setError(error.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setError('Authentication token not found.');
        return;
      }

      const modelsArray = formData.models.split(',').map(m => m.trim()).filter(m => m);
      
      const method = editingKey ? 'PUT' : 'POST';
      const url = editingKey ? `/api/admin/keys/${editingKey.id}` : '/api/admin/keys';
      
      const response = await fetch(url, {
        method,
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name || null,
          key_value: formData.key_value,
          provider: formData.provider,
          models: modelsArray
        })
      });

      if (response.ok) {
        toast.success(editingKey ? 'API密钥更新成功' : 'API密钥添加成功');
        closeDialog();
        fetchKeys();
      } else {
        const res = await response.json();
        toast.error(res.error || (editingKey ? '更新API密钥失败' : '添加API密钥失败'));
      }
    } catch (err) {
      const error = err as Error;
      toast.error(error.message || (editingKey ? '更新API密钥时发生错误' : '添加API密钥时发生错误'));
    }
  };

  const openAddDialog = () => {
    setEditingKey(null);
    setFormData({ name: '', key_value: '', provider: '', models: '' });
    setShowDialog(true);
  };

  const openEditDialog = (key: ApiKeyStatus) => {
    setEditingKey(key);
    setFormData({
      name: key.name || '',
      key_value: key.fullKey || '',
      provider: key.provider,
      models: key.models?.join(', ') || ''
    });
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingKey(null);
    setFormData({ name: '', key_value: '', provider: '', models: '' });
  };

  const handleProviderChange = (provider: string) => {
    setFormData(prev => ({ 
      ...prev, 
      provider, 
      models: providerModels[provider as keyof typeof providerModels]?.join(', ') || '' 
    }));
  };

  const triggerDeleteDialog = (key: ApiKeyStatus) => {
    setKeyToDelete(key);
    setShowDeleteAlert(true);
  };

  const handleDeleteConfirm = async () => {
    if (!keyToDelete) return;
    
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setError('Authentication token not found.');
        return;
      }

      const response = await fetch(`/api/admin/keys/${keyToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('API密钥删除成功');
        fetchKeys();
      } else {
        const res = await response.json();
        toast.error(res.error || '删除API密钥失败');
      }
    } catch (err) {
      const error = err as Error;
      toast.error(error.message || '删除API密钥时发生错误');
    } finally {
      setShowDeleteAlert(false);
      setKeyToDelete(null);
    }
  };

  const togglePasswordVisibility = (keyId: number) => {
    setShowPasswords(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  const getStatusVariant = (isWorking: boolean) => {
    return isWorking ? 'success' : 'destructive';
  };

  const renderLoadingSkeleton = () => (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
    </div>
  );

  return (
    <ShadcnAdminTheme
      title="API Key Management"
      subtitle="Manage and monitor AI service API keys."
    >
      <Alert>
        <Terminal className="h-4 w-4" />
        <AlertTitle>API密钥管理</AlertTitle>
        <AlertDescription>
          API密钥存储在数据库中，通过后台管理进行管理。这里显示所有已配置的API密钥的状态信息。
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive" className="mb-4 mt-4">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? renderLoadingSkeleton() : (
        <div className="space-y-6 mt-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Keys</CardTitle>
                <Key className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{keys.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Keys</CardTitle>
                <CheckCircle className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{keys.filter(k => k.isWorking).length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Failed Keys</CardTitle>
                <XCircle className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{keys.filter(k => !k.isWorking).length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Keys List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>API密钥列表</CardTitle>
              <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogTrigger asChild>
                  <Button onClick={openAddDialog}>
                    <Plus className="w-4 h-4 mr-2" />
                    添加API密钥
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingKey ? '编辑API密钥' : '添加新的API密钥'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">名称 (可选)</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="给密钥起个名字，方便识别"
                      />
                    </div>
                    <div>
                      <Label htmlFor="key_value">API密钥</Label>
                      <Input
                        id="key_value"
                        type="password"
                        value={formData.key_value}
                        onChange={(e) => setFormData({...formData, key_value: e.target.value})}
                        placeholder="输入API密钥"
                      />
                    </div>
                    <div>
                      <Label htmlFor="provider">提供商</Label>
                      <Select value={formData.provider} onValueChange={handleProviderChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择提供商" />
                        </SelectTrigger>
                        <SelectContent className="z-50">
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="claude">Claude</SelectItem>
                          <SelectItem value="gemini">Gemini</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="models">支持的模型</Label>
                      <Input
                        id="models"
                        value={formData.models}
                        onChange={(e) => setFormData({...formData, models: e.target.value})}
                        placeholder="选择提供商后会自动填充，也可以手动修改"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        用逗号分隔多个模型，例如: gpt-4, gpt-3.5-turbo
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={closeDialog}>
                        取消
                      </Button>
                      <Button 
                        onClick={handleSubmit} 
                        disabled={!formData.key_value || !formData.provider}
                      >
                        {editingKey ? '更新' : '添加'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {keys.map((key) => (
                  <div key={key.id || key.key} className="border p-4 rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {key.name && (
                              <h3 className="text-lg font-semibold text-foreground truncate">
                                {key.name}
                              </h3>
                            )}
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono text-muted-foreground">
                                {showPasswords[key.id!] ? key.fullKey : key.key}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => togglePasswordVisibility(key.id!)}
                              >
                                {showPasswords[key.id!] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="secondary">{key.provider.toUpperCase()}</Badge>
                            <Badge variant={getStatusVariant(key.isWorking) as 'default' | 'destructive' | 'secondary'}>
                              {key.isWorking ? '活跃' : '失败'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <XCircle className="w-4 h-4" />
                            <span>错误次数: {key.failureCount}</span>
                          </div>
                          {key.models && key.models.length > 0 && (
                            <div className="flex items-center gap-1">
                              <span>支持模型: {key.models.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 self-start sm:self-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(key)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => triggerDeleteDialog(key)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {keys.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Key className="w-12 h-12 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold">未找到API密钥</h3>
                    <p>点击上方&quot;添加API密钥&quot;按钮来添加第一个密钥。</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the API key
              named <span className="font-bold">{keyToDelete?.name || keyToDelete?.key}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setKeyToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ShadcnAdminTheme>
  );
}
