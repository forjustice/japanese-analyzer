'use client';

import { useState, useEffect } from 'react';
import ShadcnAdminTheme from '../components/ShadcnAdminTheme';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Separator } from '@/app/components/ui/separator';
import { Terminal, Save, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface ConfigItem {
  key: string;
  value: string;
  description: string;
  type: string;
  category: string;
  required: boolean;
  sensitive: boolean;
}

interface ConfigCategory {
  name: string;
  description: string;
  items: ConfigItem[];
}

export default function ConfigManagement() {
  const [categories, setCategories] = useState<ConfigCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<{[key: string]: string}>({});
  const [showSensitive, setShowSensitive] = useState<{[key: string]: boolean}>({});
  const [copiedItems, setCopiedItems] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/config', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('获取配置失败');
      }

      const data = await response.json();
      setCategories(data.categories);
    } catch (error) {
      console.error('获取配置失败:', error);
      toast.error('获取配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setChanges(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const toggleSensitiveVisibility = (key: string) => {
    setShowSensitive(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems(prev => ({ ...prev, [key]: true }));
      toast.success('已复制到剪贴板');
      setTimeout(() => {
        setCopiedItems(prev => ({ ...prev, [key]: false }));
      }, 2000);
    } catch {
      toast.error('复制失败');
    }
  };

  const saveConfigs = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        throw new Error('认证token不存在，请重新登录');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
      
      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ configs: changes }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      toast.success(data.message || '配置保存成功');
      setChanges({});
      fetchConfigs(); // 重新获取配置
    } catch (error) {
      console.error('保存配置失败:', error);
      
      let errorMessage = '保存配置失败';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = '请求超时，请检查网络连接';
        } else if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
          errorMessage = '网络错误，请检查网络连接';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(changes).length > 0;

  if (loading) {
    return (
      <ShadcnAdminTheme title="系统配置" subtitle="管理系统环境变量和关键设置">
        <div className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </ShadcnAdminTheme>
    );
  }

  return (
    <ShadcnAdminTheme
      title="系统配置"
      subtitle="管理系统环境变量和关键设置"
    >
      <div className="space-y-6">
        <Alert>
          <Terminal className="h-4 w-4" />
          <AlertTitle>配置管理</AlertTitle>
          <AlertDescription>
            <p>通过此页面可以查看和修改系统配置。敏感信息默认隐藏，点击眼睛图标可以显示。</p>
            <p>配置保存后，某些更改可能需要重启应用程序才能生效。</p>
          </AlertDescription>
        </Alert>

        {hasChanges && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-orange-800">
                  您有未保存的更改
                </div>
                <Button onClick={saveConfigs} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? '保存中...' : '保存更改'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {categories.map((category) => (
          <Card key={category.name}>
            <CardHeader>
              <CardTitle>{category.name}</CardTitle>
              <CardDescription>{category.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {category.items.map((item, itemIndex) => (
                <div key={item.key}>
                  <div className="space-y-2">
                    <Label htmlFor={item.key} className="text-sm font-medium">
                      {item.description}
                      {item.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    <div className="flex gap-2">
                      {item.type === 'readonly' ? (
                        <div className="flex-1 flex items-center gap-2">
                          <Input
                            value={item.value}
                            readOnly
                            className="bg-muted"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(item.value, item.key)}
                          >
                            {copiedItems[item.key] ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center gap-2">
                          <Input
                            id={item.key}
                            type={item.sensitive && !showSensitive[item.key] ? 'password' : 'text'}
                            value={changes[item.key] !== undefined ? changes[item.key] : item.value}
                            onChange={(e) => handleInputChange(item.key, e.target.value)}
                            placeholder={item.description}
                          />
                          {item.sensitive && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleSensitiveVisibility(item.key)}
                            >
                              {showSensitive[item.key] ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      变量名: {item.key}
                    </div>
                  </div>
                  {itemIndex < category.items.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </ShadcnAdminTheme>
  );
}