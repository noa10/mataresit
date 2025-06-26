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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, DialogDescription as AlertDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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

const AVAILABLE_SCOPES = [
  { id: 'receipts:read', name: 'Read Receipts', description: 'View and list receipts' },
  { id: 'receipts:write', name: 'Write Receipts', description: 'Create and update receipts' },
  { id: 'receipts:delete', name: 'Delete Receipts', description: 'Delete receipts' },
  { id: 'claims:read', name: 'Read Claims', description: 'View and list claims' },
  { id: 'claims:write', name: 'Write Claims', description: 'Create and update claims' },
  { id: 'claims:delete', name: 'Delete Claims', description: 'Delete claims' },
  { id: 'search:read', name: 'Search', description: 'Perform semantic searches' },
  { id: 'analytics:read', name: 'Analytics', description: 'Access analytics and reports' },
  { id: 'teams:read', name: 'Teams', description: 'Access team information' },
  { id: 'admin:all', name: 'Admin Access', description: 'Full administrative access' }
];

const ACCESS_LEVELS = {
  read: ['receipts:read', 'claims:read', 'search:read', 'analytics:read', 'teams:read'],
  write: ['receipts:read', 'receipts:write', 'claims:read', 'claims:write', 'search:read', 'analytics:read', 'teams:read'],
  admin: ['admin:all']
};

export default function ApiKeyManagement() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showKeyValue, setShowKeyValue] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [usageStats, setUsageStats] = useState<Record<string, ApiKeyUsageStats>>({});

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
      toast.error('Failed to load API keys');
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
        toast.error('API key name is required');
        return;
      }

      if (formData.scopes.length === 0) {
        toast.error('At least one scope is required');
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
      toast.success('API key created successfully');
    } catch (error) {
      console.error('Error creating API key:', error);
      toast.error('Failed to create API key');
    }
  };

  const updateApiKey = async (keyId: string, updates: Partial<ApiKey>) => {
    try {
      const response = await supabase.functions.invoke('manage-api-keys', {
        method: 'PUT',
        body: updates
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setApiKeys(prev => prev.map(key => 
        key.id === keyId ? { ...key, ...updates } : key
      ));
      toast.success('API key updated successfully');
    } catch (error) {
      console.error('Error updating API key:', error);
      toast.error('Failed to update API key');
    }
  };

  const deleteApiKey = async (keyId: string) => {
    try {
      const response = await supabase.functions.invoke('manage-api-keys', {
        method: 'DELETE'
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setApiKeys(prev => prev.filter(key => key.id !== keyId));
      toast.success('API key deleted successfully');
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast.error('Failed to delete API key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
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
      return <Badge variant="secondary">Inactive</Badge>;
    }
    
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    
    return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
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
          <h2 className="text-2xl font-bold tracking-tight">API Keys</h2>
          <p className="text-muted-foreground">
            Manage your API keys for external integrations
          </p>
          <div className="mt-2">
            <Link
              to="/api-reference"
              className="text-sm text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
            >
              <Code className="h-4 w-4" />
              View API Reference
            </Link>
          </div>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New API Key</DialogTitle>
              <DialogDescription>
                Create a new API key for external integrations. Choose the appropriate scopes for your use case.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    placeholder="My Integration"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expires">Expires (Optional)</Label>
                  <Input
                    id="expires"
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this API key will be used for..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="space-y-4">
                <Label>Access Level</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAccessLevelChange('read')}
                  >
                    Read Only
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAccessLevelChange('write')}
                  >
                    Read & Write
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAccessLevelChange('admin')}
                  >
                    Admin
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Permissions</Label>
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
                Cancel
              </Button>
              <Button onClick={createApiKey}>
                Create API Key
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
                API Key Created Successfully
              </DialogTitle>
              <DialogDescription>
                Your API key has been created. Copy it now as it won't be shown again.
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
                    <h4 className="font-medium text-yellow-800">Important</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Store this API key securely. It won't be displayed again and provides access to your account data.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setShowKeyValue(null)}>
                I've Saved My API Key
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
                <h3 className="text-lg font-medium mb-2">No API Keys</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first API key to start integrating with the Mataresit API.
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create API Key
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
                        <Badge variant="outline">Team: {key.teams.name}</Badge>
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
                        Created {formatDate(key.createdAt)}
                      </span>
                      {key.lastUsedAt && (
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          Last used {formatDate(key.lastUsedAt)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        {key.usageCount} requests
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
                          <AlertDialogTitle>Delete API Key</AlertDialogTitle>
                          <AlertDescription>
                            Are you sure you want to delete "{key.name}"? This action cannot be undone and will immediately revoke access for any applications using this key.
                          </AlertDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteApiKey(key.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
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
              <DialogTitle>API Key Usage Statistics</DialogTitle>
              <DialogDescription>
                Usage statistics for "{selectedKey.name}" over the last 30 days
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {usageStats[selectedKey.id] ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {usageStats[selectedKey.id].totalRequests}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Requests</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {usageStats[selectedKey.id].successfulRequests}
                    </div>
                    <div className="text-sm text-muted-foreground">Successful</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {usageStats[selectedKey.id].errorRequests}
                    </div>
                    <div className="text-sm text-muted-foreground">Errors</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {usageStats[selectedKey.id].avgResponseTimeMs}ms
                    </div>
                    <div className="text-sm text-muted-foreground">Avg Response</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-2">Loading usage statistics...</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={() => setSelectedKey(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
