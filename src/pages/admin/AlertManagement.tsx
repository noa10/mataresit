/**
 * Alert Management Admin Page
 * Main admin interface for comprehensive alert system management
 * Task 5: Develop Configurable Alert Rules Interface - Main Page
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Settings,
  Bell,
  Users,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Activity,
  Target,
  Zap,
  Shield,
  Clock,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AlertRulesInterface } from '@/components/admin/AlertRulesInterface';
import { NotificationChannelConfig } from '@/components/admin/NotificationChannelConfig';
import { EscalationPolicyConfig } from '@/components/admin/EscalationPolicyConfig';
import { AlertAnalyticsDashboard } from '@/components/admin/AlertAnalyticsDashboard';
import { useAlertEngine } from '@/hooks/useAlertEngine';
import { useAlertEscalation } from '@/hooks/useAlertEscalation';
import { useNotificationChannels } from '@/hooks/useNotificationChannels';
import { useAuth } from '@/contexts/AuthContext';

export default function AlertManagement() {
  // Hooks
  const { user } = useAuth();
  const {
    alerts,
    alertStatistics,
    isEngineHealthy,
    isLoading: engineLoading,
    error: engineError
  } = useAlertEngine({ autoRefresh: true });

  const {
    escalationStatistics,
    activeEscalations,
    severityRules,
    onCallSchedules,
    isLoading: escalationLoading
  } = useAlertEscalation({ autoRefresh: true });

  const {
    channels,
    isLoading: channelsLoading
  } = useNotificationChannels({ autoRefresh: true });

  // State
  const [activeTab, setActiveTab] = useState('overview');

  // Calculate system health metrics
  const systemHealth = React.useMemo(() => {
    const totalChannels = channels.length;
    const activeChannels = channels.filter(c => c.enabled).length;
    const totalRules = severityRules.length;
    const activeRules = severityRules.filter(r => r.enabled).length;
    const totalSchedules = onCallSchedules.length;
    const activeSchedules = onCallSchedules.filter(s => s.enabled).length;

    const healthScore = Math.round(
      (isEngineHealthy ? 25 : 0) +
      (activeChannels / Math.max(totalChannels, 1) * 25) +
      (activeRules / Math.max(totalRules, 1) * 25) +
      (activeSchedules / Math.max(totalSchedules, 1) * 25)
    );

    return {
      score: healthScore,
      status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical',
      components: {
        engine: isEngineHealthy,
        channels: activeChannels,
        rules: activeRules,
        schedules: activeSchedules
      }
    };
  }, [isEngineHealthy, channels, severityRules, onCallSchedules]);

  const isLoading = engineLoading || escalationLoading || channelsLoading;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alert Management</h1>
          <p className="text-muted-foreground">
            Configure and monitor your comprehensive alerting system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={
            systemHealth.status === 'healthy' ? 'default' :
            systemHealth.status === 'warning' ? 'secondary' : 'destructive'
          }>
            System Health: {systemHealth.score}%
          </Badge>
        </div>
      </div>

      {/* System Status Alert */}
      {engineError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Alert system error: {engineError}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Alert Rules
          </TabsTrigger>
          <TabsTrigger value="channels" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Channels
          </TabsTrigger>
          <TabsTrigger value="escalation" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Escalation
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* System Health Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">System Health</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      systemHealth.status === 'healthy' ? 'text-green-600' :
                      systemHealth.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                    )}>
                      {systemHealth.score}%
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {systemHealth.status}
                    </p>
                  </div>
                  {systemHealth.status === 'healthy' ? (
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  ) : systemHealth.status === 'warning' ? (
                    <AlertTriangle className="h-8 w-8 text-yellow-500" />
                  ) : (
                    <AlertTriangle className="h-8 w-8 text-red-500" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Alerts</p>
                    <p className="text-2xl font-bold">
                      {alertStatistics?.active_alerts || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {alertStatistics?.critical_alerts || 0} critical
                    </p>
                  </div>
                  <Bell className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Escalations</p>
                    <p className="text-2xl font-bold">
                      {escalationStatistics?.activeEscalations || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Currently active
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg Response</p>
                    <p className="text-2xl font-bold">
                      {alertStatistics?.avg_resolution_time_minutes 
                        ? `${Math.round(alertStatistics.avg_resolution_time_minutes)}m`
                        : 'N/A'
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Resolution time
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Components Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Alert Engine</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  {isEngineHealthy ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">
                    {isEngineHealthy ? 'Operational' : 'Issues Detected'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Notification Channels</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">
                    {systemHealth.components.channels}/{channels.length} Active
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Alert Rules</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">
                    {systemHealth.components.rules}/{severityRules.length} Active
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">On-Call Schedules</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-500" />
                  <span className="text-sm">
                    {systemHealth.components.schedules}/{onCallSchedules.length} Active
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-center gap-2"
                  onClick={() => setActiveTab('rules')}
                >
                  <Target className="h-6 w-6" />
                  <span>Create Alert Rule</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-center gap-2"
                  onClick={() => setActiveTab('channels')}
                >
                  <Bell className="h-6 w-6" />
                  <span>Add Channel</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-center gap-2"
                  onClick={() => setActiveTab('escalation')}
                >
                  <Users className="h-6 w-6" />
                  <span>Setup On-Call</span>
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

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Alert Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">All Clear</h3>
                  <p className="text-muted-foreground">
                    No active alerts at this time. Your system is running smoothly.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.slice(0, 5).map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle className={cn(
                          "h-4 w-4",
                          alert.severity === 'critical' ? 'text-red-500' :
                          alert.severity === 'high' ? 'text-orange-500' :
                          alert.severity === 'medium' ? 'text-yellow-500' :
                          'text-blue-500'
                        )} />
                        <div>
                          <p className="font-medium">{alert.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(alert.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          alert.severity === 'critical' ? 'destructive' :
                          alert.severity === 'high' ? 'destructive' :
                          'default'
                        }>
                          {alert.severity}
                        </Badge>
                        <Badge variant="outline">{alert.status}</Badge>
                      </div>
                    </div>
                  ))}
                  {alerts.length > 5 && (
                    <div className="text-center pt-4">
                      <Button variant="outline" size="sm">
                        View All Alerts
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alert Rules Tab */}
        <TabsContent value="rules">
          <AlertRulesInterface />
        </TabsContent>

        {/* Notification Channels Tab */}
        <TabsContent value="channels">
          <NotificationChannelConfig />
        </TabsContent>

        {/* Escalation Policies Tab */}
        <TabsContent value="escalation">
          <EscalationPolicyConfig />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <AlertAnalyticsDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
