import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSettingsTranslation } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import {
  Key,
  Plus,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  Edit,
  Calendar,
  Activity,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Settings,
  Code
} from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  description?: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  usageCount: number;
  createdAt: string;
  teamId?: string;
  teams?: { name: string };
}

interface ApiKeyUsageStats {
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  avgResponseTimeMs: number;
  requestsByDay: Array<{ date: string; count: number }>;
  topEndpoints: Array<{ endpoint: string; count: number }>;
}

// This will be moved inside the component to access translations

const ACCESS_LEVELS = {
  read: ['receipts:read', 'claims:read', 'search:read', 'analytics:read', 'teams:read'],
  write: ['receipts:read', 'receipts:write', 'claims:read', 'claims:write', 'search:read', 'analytics:read', 'teams:read'],
  admin: ['admin:all']
};

export default function ApiKeyManagement() {
  const { t } = useSettingsTranslation();
  const { i18n } = useTranslation();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showKeyValue, setShowKeyValue] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [usageStats, setUsageStats] = useState<Record<string, ApiKeyUsageStats>>({});

  // Available scopes with translations
  // Direct access to translation resources to avoid namespace separator issues
  const getScopeTranslation = (scopeId: string, field: 'name' | 'description') => {
    const currentLang = i18n.language || 'en';
    const resources = i18n.getResourceBundle(currentLang, 'settings');

    if (resources?.apiKeys?.scopes?.[scopeId]?.[field]) {
      return resources.apiKeys.scopes[scopeId][field];
    }

    // Fallback to English if current language doesn't have the translation
    if (currentLang !== 'en') {
      const enResources = i18n.getResourceBundle('en', 'settings');
      if (enResources?.apiKeys?.scopes?.[scopeId]?.[field]) {
        return enResources.apiKeys.scopes[scopeId][field];
      }
    }

    // Final fallback
    return `${scopeId}.${field}`;
  };

  const AVAILABLE_SCOPES = [
    { id: 'receipts:read', name: getScopeTranslation('receipts:read', 'name'), description: getScopeTranslation('receipts:read', 'description') },
    { id: 'receipts:write', name: getScopeTranslation('receipts:write', 'name'), description: getScopeTranslation('receipts:write', 'description') },
    { id: 'receipts:delete', name: getScopeTranslation('receipts:delete', 'name'), description: getScopeTranslation('receipts:delete', 'description') },
    { id: 'claims:read', name: getScopeTranslation('claims:read', 'name'), description: getScopeTranslation('claims:read', 'description') },
    { id: 'claims:write', name: getScopeTranslation('claims:write', 'name'), description: getScopeTranslation('claims:write', 'description') },
    { id: 'claims:delete', name: getScopeTranslation('claims:delete', 'name'), description: getScopeTranslation('claims:delete', 'description') },
    { id: 'search:read', name: getScopeTranslation('search:read', 'name'), description: getScopeTranslation('search:read', 'description') },
    { id: 'analytics:read', name: getScopeTranslation('analytics:read', 'name'), description: getScopeTranslation('analytics:read', 'description') },
    { id: 'teams:read', name: getScopeTranslation('teams:read', 'name'), description: getScopeTranslation('teams:read', 'description') },
    { id: 'admin:all', name: getScopeTranslation('admin:all', 'name'), description: getScopeTranslation('admin:all', 'description') }
  ];

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    scopes: [] as string[],
    expiresAt: '',
    teamId: ''
  });

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      setLoading(true);
      const response = await supabase.functions.invoke('manage-api-keys', {
        method: 'GET'
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setApiKeys(response.data?.data?.apiKeys || []);
    } catch (error) {
      console.error('Error loading API keys:', error);
      toast.error(t('apiKeys.notifications.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const loadUsageStats = async (keyId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_api_usage_stats', {
        _user_id: (await supabase.auth.getUser()).data.user?.id,
        _days: 30
      });

      if (error) throw error;

      setUsageStats(prev => ({
        ...prev,
        [keyId]: data
      }));
    } catch (error) {
      console.error('Error loading usage stats:', error);
    }
  };

  const createApiKey = async () => {
    try {
      if (!formData.name.trim()) {
        toast.error(t('apiKeys.notifications.nameRequired'));
        return;
      }

      if (formData.scopes.length === 0) {
        toast.error(t('apiKeys.notifications.scopeRequired'));
        return;
      }

      const response = await supabase.functions.invoke('manage-api-keys', {
        method: 'POST',
        body: {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          scopes: formData.scopes,
          expiresAt: formData.expiresAt || null,
          teamId: formData.teamId || null
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const newKey = response.data?.data;
      setApiKeys(prev => [newKey, ...prev]);
      setShowKeyValue(newKey.apiKey);
      setShowCreateDialog(false);
      resetForm();
      toast.success(t('apiKeys.notifications.createSuccess'));
    } catch (error) {
      console.error('Error creating API key:', error);
      toast.error(t('apiKeys.notifications.createFailed'));
    }
  };

  const updateApiKey = async (keyId: string, updates: Partial<ApiKey>) => {
    try {
      console.log('Updating API key:', { keyId, updates });

      const response = await supabase.functions.invoke('manage-api-keys', {
        method: 'PUT',
        body: {
          keyId,
          ...updates
        }
      });

      if (response.error) {
        console.error('API key update error:', response.error);
        throw new Error(response.error.message);
      }

      console.log('API key update response:', response.data);

      setApiKeys(prev => prev.map(key =>
        key.id === keyId ? { ...key, ...updates } : key
      ));
      toast.success(t('apiKeys.notifications.updateSuccess'));
    } catch (error) {
      console.error('Error updating API key:', error);
      toast.error(t('apiKeys.notifications.updateFailed'));
    }
  };

  const deleteApiKey = async (keyId: string) => {
    try {
      console.log('Deleting API key:', keyId);

      const response = await supabase.functions.invoke('manage-api-keys', {
        method: 'DELETE',
        body: {
          keyId
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setApiKeys(prev => prev.filter(key => key.id !== keyId));
      toast.success(t('apiKeys.notifications.deleteSuccess'));
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast.error(t('apiKeys.notifications.deleteFailed'));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('apiKeys.notifications.copied'));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      scopes: [],
      expiresAt: '',
      teamId: ''
    });
  };

  const handleScopeChange = (scope: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      scopes: checked 
        ? [...prev.scopes, scope]
        : prev.scopes.filter(s => s !== scope)
    }));
  };

  const handleAccessLevelChange = (level: string) => {
    setFormData(prev => ({
      ...prev,
      scopes: ACCESS_LEVELS[level as keyof typeof ACCESS_LEVELS] || []
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (key: ApiKey) => {
    if (!key.isActive) {
      return <Badge variant="secondary">{t('apiKeys.status.inactive')}</Badge>;
    }

    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return <Badge variant="destructive">{t('apiKeys.status.expired')}</Badge>;
    }

    return <Badge variant="default" className="bg-green-100 text-green-800">{t('apiKeys.status.active')}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('apiKeys.header.title')}</h2>
          <p className="text-muted-foreground">
            {t('apiKeys.header.description')}
          </p>
          <div className="mt-2">
            <Link
              to="/api-reference"
              className="text-sm text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
            >
              <Code className="h-4 w-4" />
              {t('apiKeys.header.viewReference')}
            </Link>
          </div>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('apiKeys.create.button')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('apiKeys.create.title')}</DialogTitle>
              <DialogDescription>
                {t('apiKeys.create.description')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('apiKeys.create.fields.nameRequired')}</Label>
                  <Input
                    id="name"
                    placeholder={t('apiKeys.create.fields.namePlaceholder')}
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expires">{t('apiKeys.create.fields.expires')}</Label>
                  <Input
                    id="expires"
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('apiKeys.create.fields.description')}</Label>
                <Textarea
                  id="description"
                  placeholder={t('apiKeys.create.fields.descriptionPlaceholder')}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="space-y-4">
                <Label>{t('apiKeys.create.fields.accessLevel')}</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAccessLevelChange('read')}
                  >
                    {t('apiKeys.create.accessLevels.readOnly')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAccessLevelChange('write')}
                  >
                    {t('apiKeys.create.accessLevels.readWrite')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAccessLevelChange('admin')}
                  >
                    {t('apiKeys.create.accessLevels.admin')}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Label>{t('apiKeys.create.fields.permissions')}</Label>
                <div className="grid grid-cols-2 gap-3">
                  {AVAILABLE_SCOPES.map((scope) => (
                    <div key={scope.id} className="flex items-start space-x-2">
                      <Checkbox
                        id={scope.id}
                        checked={formData.scopes.includes(scope.id)}
                        onCheckedChange={(checked) => handleScopeChange(scope.id, checked as boolean)}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label
                          htmlFor={scope.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {scope.name}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {scope.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                {t('apiKeys.create.actions.cancel')}
              </Button>
              <Button onClick={createApiKey}>
                {t('apiKeys.create.actions.create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* API Key Display Dialog */}
      {showKeyValue && (
        <Dialog open={!!showKeyValue} onOpenChange={() => setShowKeyValue(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                {t('apiKeys.success.title')}
              </DialogTitle>
              <DialogDescription>
                {t('apiKeys.success.description')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <code className="text-sm font-mono break-all">{showKeyValue}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(showKeyValue)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800">{t('apiKeys.success.warning.title')}</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      {t('apiKeys.success.warning.description')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setShowKeyValue(null)}>
                {t('apiKeys.success.actions.close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* API Keys List */}
      <div className="grid gap-4">
        {apiKeys.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">{t('apiKeys.list.empty.title')}</h3>
                <p className="text-muted-foreground mb-4">
                  {t('apiKeys.list.empty.description')}
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('apiKeys.list.empty.action')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          apiKeys.map((key) => (
            <Card key={key.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{key.name}</h3>
                      {getStatusBadge(key)}
                      {key.teams && (
                        <Badge variant="outline">{t('apiKeys.list.team')}: {key.teams.name}</Badge>
                      )}
                    </div>
                    
                    {key.description && (
                      <p className="text-sm text-muted-foreground">{key.description}</p>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Key className="h-3 w-3" />
                        {key.keyPrefix}...
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {t('apiKeys.list.created')} {formatDate(key.createdAt)}
                      </span>
                      {key.lastUsedAt && (
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          {t('apiKeys.list.lastUsed')} {formatDate(key.lastUsedAt)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        {key.usageCount} {t('apiKeys.list.requests')}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-2">
                      {key.scopes.map((scope) => (
                        <Badge key={scope} variant="secondary" className="text-xs">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedKey(key);
                        loadUsageStats(key.id);
                      }}
                    >
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateApiKey(key.id, { isActive: !key.isActive })}
                    >
                      {key.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('apiKeys.delete.title')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('apiKeys.delete.description', { name: key.name })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('apiKeys.delete.actions.cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteApiKey(key.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {t('apiKeys.delete.actions.delete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Usage Stats Dialog */}
      {selectedKey && (
        <Dialog open={!!selectedKey} onOpenChange={() => setSelectedKey(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{t('apiKeys.usage.title')}</DialogTitle>
              <DialogDescription>
                {t('apiKeys.usage.description', { name: selectedKey.name })}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {usageStats[selectedKey.id] ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {usageStats[selectedKey.id].totalRequests}
                    </div>
                    <div className="text-sm text-muted-foreground">{t('apiKeys.usage.stats.totalRequests')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {usageStats[selectedKey.id].successfulRequests}
                    </div>
                    <div className="text-sm text-muted-foreground">{t('apiKeys.usage.stats.successful')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {usageStats[selectedKey.id].errorRequests}
                    </div>
                    <div className="text-sm text-muted-foreground">{t('apiKeys.usage.stats.errors')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {usageStats[selectedKey.id].avgResponseTimeMs}ms
                    </div>
                    <div className="text-sm text-muted-foreground">{t('apiKeys.usage.stats.avgResponse')}</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-2">{t('apiKeys.usage.loading')}</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={() => setSelectedKey(null)}>{t('apiKeys.usage.actions.close')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
