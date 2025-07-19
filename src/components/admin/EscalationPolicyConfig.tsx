/**
 * Escalation Policy Configuration Component
 * Interface for configuring alert escalation policies and severity routing
 * Task 5: Develop Configurable Alert Rules Interface - Escalation Configuration
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
import { Separator } from '@/components/ui/separator';
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
  Users,
  Clock,
  ArrowUp,
  ArrowDown,
  Settings,
  AlertTriangle,
  CheckCircle,
  Calendar,
  User,
  Target
} from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAlertEscalation } from '@/hooks/useAlertEscalation';
import { AlertSeverity } from '@/types/alerting';

// Validation schemas
const severityRuleSchema = z.object({
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  assigned_users: z.array(z.string()).optional(),
  assigned_channels: z.array(z.string()).optional(),
  initial_delay_minutes: z.number().min(0, 'Delay cannot be negative'),
  escalation_interval_minutes: z.number().min(1, 'Interval must be at least 1 minute'),
  max_escalation_level: z.number().min(1, 'Must have at least 1 escalation level'),
  business_hours_only: z.boolean(),
  weekend_escalation: z.boolean(),
  auto_acknowledge_minutes: z.number().optional(),
  auto_resolve_minutes: z.number().optional(),
  conditions: z.record(z.any()).optional(),
  enabled: z.boolean(),
  priority: z.number().min(1, 'Priority must be at least 1'),
});

const onCallScheduleSchema = z.object({
  name: z.string().min(1, 'Schedule name is required').max(255, 'Name too long'),
  description: z.string().optional(),
  schedule_type: z.enum(['rotation', 'fixed', 'follow_the_sun']),
  rotation_config: z.record(z.any()).optional(),
  timezone: z.string(),
  effective_from: z.string(),
  effective_until: z.string().optional(),
  applicable_severities: z.array(z.enum(['critical', 'high', 'medium', 'low', 'info'])),
  override_business_hours: z.boolean(),
  enabled: z.boolean(),
});

type SeverityRuleFormData = z.infer<typeof severityRuleSchema>;
type OnCallScheduleFormData = z.infer<typeof onCallScheduleSchema>;

interface EscalationPolicyConfigProps {
  teamId?: string;
  className?: string;
}

export function EscalationPolicyConfig({ teamId, className }: EscalationPolicyConfigProps) {
  // Hooks
  const {
    severityRules,
    createSeverityRule,
    updateSeverityRule,
    deleteSeverityRule,
    onCallSchedules,
    createOnCallSchedule,
    updateOnCallSchedule,
    deleteOnCallSchedule,
    escalationStatistics,
    isLoading,
    error
  } = useAlertEscalation({ teamId, autoRefresh: true });

  // State
  const [activeTab, setActiveTab] = useState('severity-routing');
  const [selectedRule, setSelectedRule] = useState<any>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Forms
  const ruleForm = useForm<SeverityRuleFormData>({
    resolver: zodResolver(severityRuleSchema),
    defaultValues: {
      initial_delay_minutes: 0,
      escalation_interval_minutes: 30,
      max_escalation_level: 3,
      business_hours_only: false,
      weekend_escalation: true,
      enabled: true,
      priority: 1,
      assigned_users: [],
      assigned_channels: [],
      conditions: {}
    }
  });

  const scheduleForm = useForm<OnCallScheduleFormData>({
    resolver: zodResolver(onCallScheduleSchema),
    defaultValues: {
      schedule_type: 'rotation',
      timezone: 'UTC',
      effective_from: new Date().toISOString().split('T')[0],
      applicable_severities: ['critical', 'high'],
      override_business_hours: false,
      enabled: true,
      rotation_config: {}
    }
  });

  // Get severity badge variant
  const getSeverityVariant = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      case 'info': return 'outline';
      default: return 'secondary';
    }
  };

  // Handle severity rule operations
  const handleCreateSeverityRule = async (data: SeverityRuleFormData) => {
    try {
      await createSeverityRule({ ...data, team_id: teamId! });
      setIsRuleDialogOpen(false);
      ruleForm.reset();
    } catch (error) {
      console.error('Error creating severity rule:', error);
    }
  };

  const handleEditSeverityRule = async (data: SeverityRuleFormData) => {
    if (!selectedRule) return;
    
    try {
      await updateSeverityRule(selectedRule.id, data);
      setIsRuleDialogOpen(false);
      setSelectedRule(null);
      setIsEditMode(false);
      ruleForm.reset();
    } catch (error) {
      console.error('Error updating severity rule:', error);
    }
  };

  const handleDeleteSeverityRule = async (ruleId: string) => {
    try {
      await deleteSeverityRule(ruleId);
    } catch (error) {
      console.error('Error deleting severity rule:', error);
    }
  };

  // Handle on-call schedule operations
  const handleCreateOnCallSchedule = async (data: OnCallScheduleFormData) => {
    try {
      await createOnCallSchedule({ ...data, team_id: teamId! });
      setIsScheduleDialogOpen(false);
      scheduleForm.reset();
    } catch (error) {
      console.error('Error creating on-call schedule:', error);
    }
  };

  const handleEditOnCallSchedule = async (data: OnCallScheduleFormData) => {
    if (!selectedSchedule) return;
    
    try {
      await updateOnCallSchedule(selectedSchedule.id, data);
      setIsScheduleDialogOpen(false);
      setSelectedSchedule(null);
      setIsEditMode(false);
      scheduleForm.reset();
    } catch (error) {
      console.error('Error updating on-call schedule:', error);
    }
  };

  const handleDeleteOnCallSchedule = async (scheduleId: string) => {
    try {
      await deleteOnCallSchedule(scheduleId);
    } catch (error) {
      console.error('Error deleting on-call schedule:', error);
    }
  };

  const openRuleEditDialog = (rule: any) => {
    setSelectedRule(rule);
    setIsEditMode(true);
    ruleForm.reset({
      severity: rule.severity,
      assigned_users: rule.assigned_users || [],
      assigned_channels: rule.assigned_channels || [],
      initial_delay_minutes: rule.initial_delay_minutes,
      escalation_interval_minutes: rule.escalation_interval_minutes,
      max_escalation_level: rule.max_escalation_level,
      business_hours_only: rule.business_hours_only,
      weekend_escalation: rule.weekend_escalation,
      auto_acknowledge_minutes: rule.auto_acknowledge_minutes,
      auto_resolve_minutes: rule.auto_resolve_minutes,
      conditions: rule.conditions || {},
      enabled: rule.enabled,
      priority: rule.priority
    });
    setIsRuleDialogOpen(true);
  };

  const openScheduleEditDialog = (schedule: any) => {
    setSelectedSchedule(schedule);
    setIsEditMode(true);
    scheduleForm.reset({
      name: schedule.name,
      description: schedule.description || '',
      schedule_type: schedule.schedule_type,
      rotation_config: schedule.rotation_config || {},
      timezone: schedule.timezone,
      effective_from: schedule.effective_from.split('T')[0],
      effective_until: schedule.effective_until?.split('T')[0],
      applicable_severities: schedule.applicable_severities,
      override_business_hours: schedule.override_business_hours,
      enabled: schedule.enabled
    });
    setIsScheduleDialogOpen(true);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Escalation Policies</h2>
          <p className="text-muted-foreground">
            Configure severity-based routing and escalation policies
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      {escalationStatistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Escalations</p>
                  <p className="text-2xl font-bold">{escalationStatistics.activeEscalations}</p>
                </div>
                <ArrowUp className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Severity Rules</p>
                  <p className="text-2xl font-bold">{severityRules.length}</p>
                </div>
                <Target className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">On-Call Schedules</p>
                  <p className="text-2xl font-bold">{onCallSchedules.length}</p>
                </div>
                <Calendar className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Critical Escalations</p>
                  <p className="text-2xl font-bold text-red-600">
                    {escalationStatistics.escalationsBySeverity?.critical || 0}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="severity-routing">Severity Routing</TabsTrigger>
          <TabsTrigger value="on-call-schedules">On-Call Schedules</TabsTrigger>
          <TabsTrigger value="escalation-analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Severity Routing Tab */}
        <TabsContent value="severity-routing" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Severity-Based Routing Rules</h3>
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
              {severityRules.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Severity Rules</h3>
                  <p className="text-muted-foreground mb-4">
                    Create routing rules to automatically assign alerts based on severity.
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
                  {severityRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant={getSeverityVariant(rule.severity)}>
                            {rule.severity}
                          </Badge>
                          <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                            {rule.enabled ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant="outline">
                            Priority {rule.priority}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Initial Delay: {rule.initial_delay_minutes}m</span>
                          <span>Escalation: {rule.escalation_interval_minutes}m</span>
                          <span>Max Level: {rule.max_escalation_level}</span>
                          <span>Users: {rule.assigned_users?.length || 0}</span>
                          <span>Channels: {rule.assigned_channels?.length || 0}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateSeverityRule(rule.id, { enabled: !rule.enabled })}
                        >
                          {rule.enabled ? <CheckCircle className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
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
                          onClick={() => handleDeleteSeverityRule(rule.id)}
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

        {/* On-Call Schedules Tab */}
        <TabsContent value="on-call-schedules" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">On-Call Schedules</h3>
            <Button onClick={() => {
              setIsEditMode(false);
              setIsScheduleDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Schedule
            </Button>
          </div>

          <Card>
            <CardContent className="p-6">
              {onCallSchedules.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No On-Call Schedules</h3>
                  <p className="text-muted-foreground mb-4">
                    Set up on-call schedules to automatically assign alerts to available team members.
                  </p>
                  <Button onClick={() => {
                    setIsEditMode(false);
                    setIsScheduleDialogOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Schedule
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {onCallSchedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">{schedule.name}</h4>
                          <Badge variant={schedule.enabled ? 'default' : 'secondary'}>
                            {schedule.enabled ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant="outline" className="capitalize">
                            {schedule.schedule_type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          {schedule.description || 'No description'}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Timezone: {schedule.timezone}</span>
                          <span>Severities: {schedule.applicable_severities.join(', ')}</span>
                          <span>From: {new Date(schedule.effective_from).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateOnCallSchedule(schedule.id, { enabled: !schedule.enabled })}
                        >
                          {schedule.enabled ? <CheckCircle className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openScheduleEditDialog(schedule)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteOnCallSchedule(schedule.id)}
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
