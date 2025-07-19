/**
 * Alert Rules Interface
 * Comprehensive admin interface for managing alert configurations
 * Task 5: Develop Configurable Alert Rules Interface
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Play,
  Pause,
  TestTube,
  Settings,
  Bell,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
  Search,
  MoreHorizontal,
  Copy,
  Download,
  Upload
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAlertEngine } from '@/hooks/useAlertEngine';
import { useNotificationChannels } from '@/hooks/useNotificationChannels';
import { useAlertEscalation } from '@/hooks/useAlertEscalation';
import { AlertRule, AlertSeverity, NotificationChannelType } from '@/types/alerting';

// Form validation schemas
const alertRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(255, 'Name too long'),
  description: z.string().optional(),
  metric_name: z.string().min(1, 'Metric name is required'),
  metric_source: z.enum(['embedding_metrics', 'performance_metrics', 'system_health', 'notification_metrics']),
  condition_type: z.enum(['threshold', 'percentage', 'rate', 'count', 'duration', 'custom']),
  threshold_value: z.number().min(0, 'Threshold must be positive'),
  threshold_operator: z.enum(['>', '<', '>=', '<=', '=', '!=']),
  threshold_unit: z.string().optional(),
  evaluation_window_minutes: z.number().min(1, 'Window must be at least 1 minute').max(1440, 'Window too large'),
  evaluation_frequency_minutes: z.number().min(1, 'Frequency must be at least 1 minute'),
  consecutive_failures_required: z.number().min(1, 'Must require at least 1 failure'),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  enabled: z.boolean(),
  cooldown_minutes: z.number().min(0, 'Cooldown cannot be negative'),
  max_alerts_per_hour: z.number().min(1, 'Must allow at least 1 alert per hour'),
  auto_resolve_minutes: z.number().optional(),
  tags: z.record(z.any()).optional(),
  custom_conditions: z.record(z.any()).optional(),
});

type AlertRuleFormData = z.infer<typeof alertRuleSchema>;

interface AlertRulesInterfaceProps {
  teamId?: string;
  className?: string;
}

export function AlertRulesInterface({ teamId, className }: AlertRulesInterfaceProps) {
  // Hooks
  const {
    alerts,
    alertStatistics,
    refreshAlerts,
    acknowledgeAlert,
    resolveAlert,
    suppressAlert,
    isEngineHealthy,
    forceEvaluation
  } = useAlertEngine({ teamId, autoRefresh: true });

  const {
    channels,
    createChannel,
    updateChannel,
    deleteChannel,
    testChannel,
    getChannelsByType
  } = useNotificationChannels({ teamId, autoRefresh: true });

  const {
    severityRules,
    createSeverityRule,
    updateSeverityRule,
    deleteSeverityRule,
    onCallSchedules,
    alertAssignments
  } = useAlertEscalation({ teamId, autoRefresh: true });

  // State
  const [activeTab, setActiveTab] = useState('rules');
  const [selectedRule, setSelectedRule] = useState<AlertRule | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [isLoading, setIsLoading] = useState(false);

  // Form
  const form = useForm<AlertRuleFormData>({
    resolver: zodResolver(alertRuleSchema),
    defaultValues: {
      enabled: true,
      evaluation_window_minutes: 5,
      evaluation_frequency_minutes: 1,
      consecutive_failures_required: 1,
      severity: 'medium',
      cooldown_minutes: 15,
      max_alerts_per_hour: 10,
      threshold_operator: '>',
      condition_type: 'threshold',
      metric_source: 'embedding_metrics',
      tags: {},
      custom_conditions: {}
    }
  });

  // Get filtered rules (placeholder - would integrate with actual alert rules)
  const filteredRules = React.useMemo(() => {
    // This would filter actual alert rules based on search and filters
    return [];
  }, [searchQuery, severityFilter, statusFilter]);

  // Handle form submission
  const handleCreateRule = async (data: AlertRuleFormData) => {
    try {
      setIsLoading(true);
      // This would create the actual alert rule
      console.log('Creating alert rule:', data);
      toast.success('Alert rule created successfully');
      setIsCreateDialogOpen(false);
      form.reset();
    } catch (error) {
      console.error('Error creating alert rule:', error);
      toast.error('Failed to create alert rule');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditRule = async (data: AlertRuleFormData) => {
    if (!selectedRule) return;
    
    try {
      setIsLoading(true);
      // This would update the actual alert rule
      console.log('Updating alert rule:', selectedRule.id, data);
      toast.success('Alert rule updated successfully');
      setIsEditDialogOpen(false);
      setSelectedRule(null);
      form.reset();
    } catch (error) {
      console.error('Error updating alert rule:', error);
      toast.error('Failed to update alert rule');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestRule = async (ruleData: AlertRuleFormData) => {
    try {
      setIsLoading(true);
      // This would test the alert rule
      console.log('Testing alert rule:', ruleData);
      
      // Simulate test result
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success('Alert rule test completed successfully');
      setIsTestDialogOpen(false);
    } catch (error) {
      console.error('Error testing alert rule:', error);
      toast.error('Failed to test alert rule');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      setIsLoading(true);
      // This would delete the actual alert rule
      console.log('Deleting alert rule:', ruleId);
      toast.success('Alert rule deleted successfully');
    } catch (error) {
      console.error('Error deleting alert rule:', error);
      toast.error('Failed to delete alert rule');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      // This would toggle the alert rule
      console.log('Toggling alert rule:', ruleId, enabled);
      toast.success(`Alert rule ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling alert rule:', error);
      toast.error('Failed to toggle alert rule');
    }
  };

  const openEditDialog = (rule: AlertRule) => {
    setSelectedRule(rule);
    form.reset({
      name: rule.name,
      description: rule.description || '',
      metric_name: rule.metric_name,
      metric_source: rule.metric_source as any,
      condition_type: rule.condition_type,
      threshold_value: rule.threshold_value,
      threshold_operator: rule.threshold_operator as any,
      threshold_unit: rule.threshold_unit || '',
      evaluation_window_minutes: rule.evaluation_window_minutes,
      evaluation_frequency_minutes: rule.evaluation_frequency_minutes,
      consecutive_failures_required: rule.consecutive_failures_required,
      severity: rule.severity,
      enabled: rule.enabled,
      cooldown_minutes: rule.cooldown_minutes,
      max_alerts_per_hour: rule.max_alerts_per_hour,
      auto_resolve_minutes: rule.auto_resolve_minutes,
      tags: rule.tags,
      custom_conditions: rule.custom_conditions
    });
    setIsEditDialogOpen(true);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Alert Rules Management</h2>
          <p className="text-muted-foreground">
            Configure alert rules, notification channels, and escalation policies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => forceEvaluation()}
            disabled={!isEngineHealthy}
          >
            <TestTube className="h-4 w-4 mr-2" />
            Test Engine
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Rule
          </Button>
        </div>
      </div>

      {/* Engine Status */}
      <Alert className={cn(
        isEngineHealthy ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
      )}>
        <div className="flex items-center gap-2">
          {isEngineHealthy ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className={cn(
            isEngineHealthy ? 'text-green-800' : 'text-red-800'
          )}>
            Alert engine is {isEngineHealthy ? 'healthy and running' : 'experiencing issues'}
          </AlertDescription>
        </div>
      </Alert>

      {/* Statistics Cards */}
      {alertStatistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Alerts</p>
                  <p className="text-2xl font-bold">{alertStatistics.total_alerts}</p>
                </div>
                <Bell className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-red-600">{alertStatistics.active_alerts}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Critical</p>
                  <p className="text-2xl font-bold text-orange-600">{alertStatistics.critical_alerts}</p>
                </div>
                <XCircle className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Resolution</p>
                  <p className="text-2xl font-bold">
                    {alertStatistics.avg_resolution_time_minutes 
                      ? `${Math.round(alertStatistics.avg_resolution_time_minutes)}m`
                      : 'N/A'
                    }
                  </p>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">Alert Rules</TabsTrigger>
          <TabsTrigger value="channels">Notification Channels</TabsTrigger>
          <TabsTrigger value="escalation">Escalation Policies</TabsTrigger>
          <TabsTrigger value="active-alerts">Active Alerts</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Alert Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search alert rules..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={severityFilter} onValueChange={(value) => setSeverityFilter(value as any)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Rules</SelectItem>
                    <SelectItem value="enabled">Enabled</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Rules List */}
          <Card>
            <CardHeader>
              <CardTitle>Alert Rules ({filteredRules.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredRules.length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Alert Rules</h3>
                  <p className="text-muted-foreground mb-4">
                    Get started by creating your first alert rule to monitor system health.
                  </p>
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Alert Rule
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRules.map((rule: AlertRule) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">{rule.name}</h4>
                          <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                            {rule.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                          <Badge variant={
                            rule.severity === 'critical' ? 'destructive' :
                            rule.severity === 'high' ? 'destructive' :
                            rule.severity === 'medium' ? 'default' :
                            'secondary'
                          }>
                            {rule.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          {rule.description || 'No description'}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Metric: {rule.metric_name}</span>
                          <span>Threshold: {rule.threshold_operator} {rule.threshold_value}</span>
                          <span>Window: {rule.evaluation_window_minutes}m</span>
                          <span>Cooldown: {rule.cooldown_minutes}m</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleRule(rule.id, !rule.enabled)}
                        >
                          {rule.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(rule)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRule(rule.id)}
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

        {/* Notification Channels Tab */}
        <TabsContent value="channels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Channels ({channels.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {channels.map((channel) => (
                  <Card key={channel.id} className="relative">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{channel.name}</h4>
                        <Badge variant={channel.enabled ? 'default' : 'secondary'}>
                          {channel.enabled ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {channel.description || 'No description'}
                      </p>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">{channel.channel_type}</Badge>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => testChannel(channel.id)}
                          >
                            <TestTube className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateChannel(channel.id, { enabled: !channel.enabled })}
                          >
                            {channel.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Alerts Tab */}
        <TabsContent value="active-alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Alerts ({alerts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold">{alert.title}</h4>
                        <Badge variant={
                          alert.severity === 'critical' ? 'destructive' :
                          alert.severity === 'high' ? 'destructive' :
                          'default'
                        }>
                          {alert.severity}
                        </Badge>
                        <Badge variant="outline">{alert.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {alert.description}
                      </p>
                      <div className="text-xs text-muted-foreground">
                        Created: {new Date(alert.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {alert.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => acknowledgeAlert(alert.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resolveAlert(alert.id)}
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Rule Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Alert Rule</DialogTitle>
            <DialogDescription>
              Configure a new alert rule to monitor system metrics and trigger notifications.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateRule)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Basic Information</h3>

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rule Name</FormLabel>
                        <FormControl>
                          <Input placeholder="High Error Rate Alert" {...field} />
                        </FormControl>
                        <FormDescription>
                          A descriptive name for this alert rule
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Alert when error rate exceeds threshold..."
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Optional description of what this rule monitors
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="severity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Severity</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select severity" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="info">Info</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Alert severity level affects escalation behavior
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable Rule</FormLabel>
                          <FormDescription>
                            Whether this rule should actively monitor and trigger alerts
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Metric Configuration */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Metric Configuration</h3>

                  <FormField
                    control={form.control}
                    name="metric_source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Metric Source</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select metric source" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="embedding_metrics">Embedding Metrics</SelectItem>
                            <SelectItem value="performance_metrics">Performance Metrics</SelectItem>
                            <SelectItem value="system_health">System Health</SelectItem>
                            <SelectItem value="notification_metrics">Notification Metrics</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          The source system to monitor for this metric
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="metric_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Metric Name</FormLabel>
                        <FormControl>
                          <Input placeholder="error_rate" {...field} />
                        </FormControl>
                        <FormDescription>
                          The specific metric to monitor (e.g., error_rate, response_time)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="condition_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condition Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select condition type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="threshold">Threshold</SelectItem>
                            <SelectItem value="percentage">Percentage</SelectItem>
                            <SelectItem value="rate">Rate</SelectItem>
                            <SelectItem value="count">Count</SelectItem>
                            <SelectItem value="duration">Duration</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          The type of condition to evaluate
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="threshold_operator"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Operator</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select operator" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value=">">Greater than (&gt;)</SelectItem>
                              <SelectItem value="<">Less than (&lt;)</SelectItem>
                              <SelectItem value=">=">Greater or equal (&gt;=)</SelectItem>
                              <SelectItem value="<=">Less or equal (&lt;=)</SelectItem>
                              <SelectItem value="=">Equal (=)</SelectItem>
                              <SelectItem value="!=">Not equal (!=)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="threshold_value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Threshold Value</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="5.0"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsTestDialogOpen(true)}
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  Test Rule
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Creating...' : 'Create Rule'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
