import React, { useState, useEffect } from 'react';
import { useSecurity } from '@/contexts/SecurityContext';
import { useTeam } from '@/contexts/TeamContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Settings,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
  Lock,
  Unlock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface SecurityDashboardProps {
  className?: string;
}

export function SecurityDashboard({ className }: SecurityDashboardProps) {
  const { currentTeam, hasPermission } = useTeam();
  const {
    securityDashboard,
    securityConfig,
    rateLimitConfig,
    refreshSecurityDashboard,
    updateSecurityConfig,
    loading,
    error
  } = useSecurity();
  const { toast } = useToast();

  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [configForm, setConfigForm] = useState({
    require2FAForAdmin: false,
    sessionTimeoutMinutes: 480,
    maxFailedAttempts: 5,
    lockoutDurationMinutes: 30,
    requireApprovalForBulkOps: true,
    auditAllActions: true,
  });

  useEffect(() => {
    if (securityConfig) {
      setConfigForm({
        require2FAForAdmin: securityConfig.require2FAForAdmin,
        sessionTimeoutMinutes: securityConfig.sessionTimeoutMinutes,
        maxFailedAttempts: securityConfig.maxFailedAttempts,
        lockoutDurationMinutes: securityConfig.lockoutDurationMinutes,
        requireApprovalForBulkOps: securityConfig.requireApprovalForBulkOps,
        auditAllActions: securityConfig.auditAllActions,
      });
    }
  }, [securityConfig]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshSecurityDashboard();
    } catch (err: any) {
      toast({
        title: 'Refresh Failed',
        description: err.message || 'Failed to refresh security dashboard',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleUpdateConfig = async () => {
    try {
      await updateSecurityConfig(configForm);
      setSettingsDialogOpen(false);
    } catch (err: any) {
      // Error handling is done in the context
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!hasPermission('view_security_events')) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
          <p className="text-muted-foreground">
            You don't have permission to view security information.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading && !securityDashboard) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading security dashboard...</p>
        </CardContent>
      </Card>
    );
  }

  if (error && !securityDashboard) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error Loading Security Data</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const stats = securityDashboard?.security_stats || {};
  const rateLimitStats = securityDashboard?.rate_limit_stats || [];
  const recentEvents = securityDashboard?.recent_events || [];

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Security Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor security events and manage team security settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
          {hasPermission('manage_security_settings') && (
            <Button onClick={() => setSettingsDialogOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          )}
        </div>
      </div>

      {/* Security Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_events || 0}</div>
            <p className="text-xs text-muted-foreground">
              Last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Events</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.critical_events || 0}</div>
            <p className="text-xs text-muted-foreground">
              Requires immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Limit Violations</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rate_limit_violations || 0}</div>
            <p className="text-xs text-muted-foreground">
              Blocked requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Lockouts</CardTitle>
            <Lock className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.user_lockouts || 0}</div>
            <p className="text-xs text-muted-foreground">
              Temporary blocks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">Recent Events</TabsTrigger>
          <TabsTrigger value="rate-limits">Rate Limits</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Security Events</CardTitle>
              <CardDescription>
                Latest security events and activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentEvents.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Recent Events</h3>
                  <p className="text-muted-foreground">
                    No security events recorded in the selected time period.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentEvents.slice(0, 10).map((event: any) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getSeverityIcon(event.severity)}
                            <span className="font-medium capitalize">
                              {event.event_type.replace('_', ' ')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getSeverityColor(event.severity)}>
                            {event.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-md">
                            <div className="text-sm">{event.event_description}</div>
                            {event.metadata && Object.keys(event.metadata).length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Additional details available
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rate-limits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rate Limit Statistics</CardTitle>
              <CardDescription>
                Current rate limit usage and statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rateLimitStats.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Rate Limit Data</h3>
                  <p className="text-muted-foreground">
                    No rate limit activity recorded in the selected time period.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rateLimitStats.map((stat: any) => (
                    <div key={stat.operation_type} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium capitalize">
                          {stat.operation_type.replace('_', ' ')}
                        </h4>
                        <Badge variant="outline">
                          {stat.total_requests} requests
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Avg per window</div>
                          <div className="font-medium">{Math.round(stat.avg_requests_per_window)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Peak usage</div>
                          <div className="font-medium">{stat.max_requests_per_window}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Blocked windows</div>
                          <div className="font-medium text-red-600">{stat.blocked_windows}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Configuration</CardTitle>
              <CardDescription>
                Current security settings and policies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {securityConfig ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <Label>2FA Required for Admins</Label>
                      <Badge variant={securityConfig.require2FAForAdmin ? "default" : "secondary"}>
                        {securityConfig.require2FAForAdmin ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Session Timeout</Label>
                      <Badge variant="outline">
                        {securityConfig.sessionTimeoutMinutes} minutes
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Max Failed Attempts</Label>
                      <Badge variant="outline">
                        {securityConfig.maxFailedAttempts}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Lockout Duration</Label>
                      <Badge variant="outline">
                        {securityConfig.lockoutDurationMinutes} minutes
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Bulk Op Approval Required</Label>
                      <Badge variant={securityConfig.requireApprovalForBulkOps ? "default" : "secondary"}>
                        {securityConfig.requireApprovalForBulkOps ? "Required" : "Not Required"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Audit All Actions</Label>
                      <Badge variant={securityConfig.auditAllActions ? "default" : "secondary"}>
                        {securityConfig.auditAllActions ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Configuration</h3>
                  <p className="text-muted-foreground">
                    Security configuration not available.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Security Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Security Settings</DialogTitle>
            <DialogDescription>
              Configure security policies for {currentTeam?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="require-2fa">Require 2FA for Admins</Label>
              <Switch
                id="require-2fa"
                checked={configForm.require2FAForAdmin}
                onCheckedChange={(checked) => 
                  setConfigForm(prev => ({ ...prev, require2FAForAdmin: checked }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
              <Input
                id="session-timeout"
                type="number"
                value={configForm.sessionTimeoutMinutes}
                onChange={(e) => 
                  setConfigForm(prev => ({ ...prev, sessionTimeoutMinutes: parseInt(e.target.value) || 480 }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-attempts">Max Failed Attempts</Label>
              <Input
                id="max-attempts"
                type="number"
                value={configForm.maxFailedAttempts}
                onChange={(e) => 
                  setConfigForm(prev => ({ ...prev, maxFailedAttempts: parseInt(e.target.value) || 5 }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lockout-duration">Lockout Duration (minutes)</Label>
              <Input
                id="lockout-duration"
                type="number"
                value={configForm.lockoutDurationMinutes}
                onChange={(e) => 
                  setConfigForm(prev => ({ ...prev, lockoutDurationMinutes: parseInt(e.target.value) || 30 }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="require-approval">Require Approval for Bulk Ops</Label>
              <Switch
                id="require-approval"
                checked={configForm.requireApprovalForBulkOps}
                onCheckedChange={(checked) => 
                  setConfigForm(prev => ({ ...prev, requireApprovalForBulkOps: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="audit-all">Audit All Actions</Label>
              <Switch
                id="audit-all"
                checked={configForm.auditAllActions}
                onCheckedChange={(checked) => 
                  setConfigForm(prev => ({ ...prev, auditAllActions: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateConfig}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
