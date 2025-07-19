/**
 * Alert Suppression Interface
 * Comprehensive interface for managing alert suppression, rate limiting, and maintenance windows
 * Task 6: Implement Alert Suppression and Rate Limiting - Admin Interface
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Plus,
  Edit,
  Trash2,
  Shield,
  Clock,
  Settings,
  AlertTriangle,
  CheckCircle,
  Pause,
  Play,
  Calendar,
  BarChart3,
  Filter,
  Search,
  Wrench,
  Ban,
  Activity
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAlertSuppression } from '@/hooks/useAlertSuppression';
import { AlertSeverity } from '@/types/alerting';

// Form validation schemas
const suppressionRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(255, 'Name too long'),
  description: z.string().optional(),
  rule_type: z.enum(['duplicate', 'rate_limit', 'maintenance', 'grouping', 'threshold', 'custom']),
  conditions: z.record(z.any()).optional(),
  suppression_duration_minutes: z.number().min(1, 'Duration must be at least 1 minute'),
  max_alerts_per_window: z.number().min(1, 'Must allow at least 1 alert per window'),
  window_size_minutes: z.number().min(1, 'Window size must be at least 1 minute'),
  enabled: z.boolean(),
  priority: z.number().min(1, 'Priority must be at least 1'),
});

const maintenanceWindowSchema = z.object({
  name: z.string().min(1, 'Window name is required').max(255, 'Name too long'),
  description: z.string().optional(),
  start_time: z.string(),
  end_time: z.string(),
  timezone: z.string(),
  affected_systems: z.array(z.string()).optional(),
  affected_severities: z.array(z.enum(['critical', 'high', 'medium', 'low', 'info'])),
  suppress_all: z.boolean(),
  notify_before_minutes: z.number().min(0, 'Notification time cannot be negative'),
  notify_after_completion: z.boolean(),
  recurring: z.boolean(),
  recurrence_config: z.record(z.any()).optional(),
});

type SuppressionRuleFormData = z.infer<typeof suppressionRuleSchema>;
type MaintenanceWindowFormData = z.infer<typeof maintenanceWindowSchema>;

interface AlertSuppressionInterfaceProps {
  teamId?: string;
  className?: string;
}

export function AlertSuppressionInterface({ teamId, className }: AlertSuppressionInterfaceProps) {
  // Hooks
  const {
    suppressionRules,
    createSuppressionRule,
    updateSuppressionRule,
    deleteSuppressionRule,
    maintenanceWindows,
    maintenanceStatus,
    createMaintenanceWindow,
    updateMaintenanceWindow,
    deleteMaintenanceWindow,
    suppressionStatistics,
    rateLimitStatistics,
    isLoading,
    error,
    refreshData
  } = useAlertSuppression({ teamId, autoRefresh: true });

  // State
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedRule, setSelectedRule] = useState<any>(null);
  const [selectedWindow, setSelectedWindow] = useState<any>(null);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [isWindowDialogOpen, setIsWindowDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Forms
  const ruleForm = useForm<SuppressionRuleFormData>({
    resolver: zodResolver(suppressionRuleSchema),
    defaultValues: {
      rule_type: 'duplicate',
      suppression_duration_minutes: 60,
      max_alerts_per_window: 5,
      window_size_minutes: 60,
      enabled: true,
      priority: 1,
      conditions: {}
    }
  });

  const windowForm = useForm<MaintenanceWindowFormData>({
    resolver: zodResolver(maintenanceWindowSchema),
    defaultValues: {
      timezone: 'UTC',
      affected_severities: ['critical', 'high', 'medium', 'low', 'info'],
      suppress_all: false,
      notify_before_minutes: 30,
      notify_after_completion: true,
      recurring: false,
      recurrence_config: {}
    }
  });

  // Handle form submissions
  const handleCreateRule = async (data: SuppressionRuleFormData) => {
    try {
      await createSuppressionRule({ ...data, team_id: teamId });
      setIsRuleDialogOpen(false);
      ruleForm.reset();
    } catch (error) {
      console.error('Error creating suppression rule:', error);
    }
  };

  const handleEditRule = async (data: SuppressionRuleFormData) => {
    if (!selectedRule) return;
    
    try {
      await updateSuppressionRule(selectedRule.id, data);
      setIsRuleDialogOpen(false);
      setSelectedRule(null);
      setIsEditMode(false);
      ruleForm.reset();
    } catch (error) {
      console.error('Error updating suppression rule:', error);
    }
  };

  const handleCreateWindow = async (data: MaintenanceWindowFormData) => {
    try {
      await createMaintenanceWindow({ ...data, team_id: teamId });
      setIsWindowDialogOpen(false);
      windowForm.reset();
    } catch (error) {
      console.error('Error creating maintenance window:', error);
    }
  };

  const handleEditWindow = async (data: MaintenanceWindowFormData) => {
    if (!selectedWindow) return;
    
    try {
      await updateMaintenanceWindow(selectedWindow.id, data);
      setIsWindowDialogOpen(false);
      setSelectedWindow(null);
      setIsEditMode(false);
      windowForm.reset();
    } catch (error) {
      console.error('Error updating maintenance window:', error);
    }
  };

  const openRuleEditDialog = (rule: any) => {
    setSelectedRule(rule);
    setIsEditMode(true);
    ruleForm.reset({
      name: rule.name,
      description: rule.description || '',
      rule_type: rule.rule_type,
      conditions: rule.conditions || {},
      suppression_duration_minutes: rule.suppression_duration_minutes,
      max_alerts_per_window: rule.max_alerts_per_window,
      window_size_minutes: rule.window_size_minutes,
      enabled: rule.enabled,
      priority: rule.priority
    });
    setIsRuleDialogOpen(true);
  };

  const openWindowEditDialog = (window: any) => {
    setSelectedWindow(window);
    setIsEditMode(true);
    windowForm.reset({
      name: window.name,
      description: window.description || '',
      start_time: window.start_time.split('T')[0] + 'T' + window.start_time.split('T')[1].substring(0, 5),
      end_time: window.end_time.split('T')[0] + 'T' + window.end_time.split('T')[1].substring(0, 5),
      timezone: window.timezone,
      affected_systems: window.affected_systems || [],
      affected_severities: window.affected_severities,
      suppress_all: window.suppress_all,
      notify_before_minutes: window.notify_before_minutes,
      notify_after_completion: window.notify_after_completion,
      recurring: window.recurring,
      recurrence_config: window.recurrence_config || {}
    });
    setIsWindowDialogOpen(true);
  };

  // Filter rules based on search
  const filteredRules = suppressionRules.filter(rule =>
    rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rule.rule_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Alert Suppression</h2>
          <p className="text-muted-foreground">
            Manage alert suppression rules, rate limiting, and maintenance windows
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={isLoading}
          >
            <Activity className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="suppression-rules">Suppression Rules</TabsTrigger>
          <TabsTrigger value="maintenance-windows">Maintenance Windows</TabsTrigger>
          <TabsTrigger value="rate-limiting">Rate Limiting</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Rules</p>
                    <p className="text-2xl font-bold">
                      {suppressionRules.filter(r => r.enabled).length}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {suppressionRules.length} total
                    </p>
                  </div>
                  <Shield className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Maintenance Status</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      maintenanceStatus.isActive ? 'text-orange-600' : 'text-green-600'
                    )}>
                      {maintenanceStatus.isActive ? 'Active' : 'Normal'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {maintenanceStatus.activeWindows.length} active windows
                    </p>
                  </div>
                  <Wrench className={cn(
                    "h-8 w-8",
                    maintenanceStatus.isActive ? 'text-orange-500' : 'text-green-500'
                  )} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Suppressions (24h)</p>
                    <p className="text-2xl font-bold">
                      {suppressionStatistics?.totalSuppressions || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Avg: {Math.round(suppressionStatistics?.averageSuppressionDuration || 0)}m
                    </p>
                  </div>
                  <Ban className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Rate Limits</p>
                    <p className="text-2xl font-bold">
                      {rateLimitStatistics?.activeLimits || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {rateLimitStatistics?.totalLimits || 0} configured
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Current Maintenance Status */}
          {maintenanceStatus.isActive && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-orange-500" />
                  Active Maintenance Windows
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {maintenanceStatus.activeWindows.map((window) => (
                    <div
                      key={window.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-orange-50"
                    >
                      <div>
                        <h4 className="font-semibold">{window.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Until: {new Date(window.end_time).toLocaleString()}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={window.suppress_all ? 'destructive' : 'secondary'}>
                            {window.suppress_all ? 'Full Suppression' : 'Partial Suppression'}
                          </Badge>
                          <Badge variant="outline">
                            {window.affected_systems.length} systems
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-center gap-2"
                  onClick={() => {
                    setIsEditMode(false);
                    setIsRuleDialogOpen(true);
                  }}
                >
                  <Shield className="h-6 w-6" />
                  <span>Create Suppression Rule</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-center gap-2"
                  onClick={() => {
                    setIsEditMode(false);
                    setIsWindowDialogOpen(true);
                  }}
                >
                  <Calendar className="h-6 w-6" />
                  <span>Schedule Maintenance</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-center gap-2"
                  onClick={() => setActiveTab('analytics')}
                >
                  <BarChart3 className="h-6 w-6" />
                  <span>View Analytics</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Suppression Rules Tab */}
        <TabsContent value="suppression-rules" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search suppression rules..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-[300px]"
                />
              </div>
            </div>
            <Button onClick={() => {
              setIsEditMode(false);
              setIsRuleDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </div>

          <Card>
            <CardContent className="p-6">
              {filteredRules.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Suppression Rules</h3>
                  <p className="text-muted-foreground mb-4">
                    Create suppression rules to automatically manage alert noise and prevent spam.
                  </p>
                  <Button onClick={() => {
                    setIsEditMode(false);
                    setIsRuleDialogOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Rule
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">{rule.name}</h4>
                          <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                            {rule.enabled ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant="outline" className="capitalize">
                            {rule.rule_type.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline">
                            Priority {rule.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          {rule.description || 'No description'}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Duration: {rule.suppression_duration_minutes}m</span>
                          <span>Max alerts: {rule.max_alerts_per_window}/{rule.window_size_minutes}m</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateSuppressionRule(rule.id, { enabled: !rule.enabled })}
                        >
                          {rule.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openRuleEditDialog(rule)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSuppressionRule(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance Windows Tab */}
        <TabsContent value="maintenance-windows" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Maintenance Windows</h3>
            <Button onClick={() => {
              setIsEditMode(false);
              setIsWindowDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Schedule Maintenance
            </Button>
          </div>

          <Card>
            <CardContent className="p-6">
              {maintenanceWindows.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Maintenance Windows</h3>
                  <p className="text-muted-foreground mb-4">
                    Schedule maintenance windows to suppress alerts during planned downtime.
                  </p>
                  <Button onClick={() => {
                    setIsEditMode(false);
                    setIsWindowDialogOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Schedule First Window
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {maintenanceWindows.map((window) => (
                    <div
                      key={window.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">{window.name}</h4>
                          <Badge variant={window.enabled ? 'default' : 'secondary'}>
                            {window.enabled ? 'Scheduled' : 'Disabled'}
                          </Badge>
                          {window.suppress_all && (
                            <Badge variant="destructive">Full Suppression</Badge>
                          )}
                          {window.recurring && (
                            <Badge variant="outline">Recurring</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          {window.description || 'No description'}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Start: {new Date(window.start_time).toLocaleString()}</span>
                          <span>End: {new Date(window.end_time).toLocaleString()}</span>
                          <span>Systems: {window.affected_systems.length}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateMaintenanceWindow(window.id, { enabled: !window.enabled })}
                        >
                          {window.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openWindowEditDialog(window)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMaintenanceWindow(window.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
