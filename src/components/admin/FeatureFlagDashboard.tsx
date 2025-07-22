// Feature Flag Admin Dashboard Component
// Comprehensive admin interface for managing feature flags

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Settings, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  Target,
  BarChart3
} from 'lucide-react';
import { FeatureFlag, FeatureFlagUsageStats, FeatureFlagAuditLog } from '@/lib/feature-flags/types';
import { FeatureFlagService } from '@/lib/feature-flags/manager';
import { Phase5FeatureFlagEvaluator, Phase5RolloutManager, PHASE5_ROLLOUT_STRATEGY } from '@/lib/feature-flags/phase5-flags';

interface FeatureFlagDashboardProps {
  flagService: FeatureFlagService;
  userId: string;
  userRole: 'admin' | 'developer' | 'viewer';
}

export const FeatureFlagDashboard: React.FC<FeatureFlagDashboardProps> = ({
  flagService,
  userId,
  userRole
}) => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [usageStats, setUsageStats] = useState<FeatureFlagUsageStats | null>(null);
  const [auditLog, setAuditLog] = useState<FeatureFlagAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phase5Status, setPhase5Status] = useState<any>(null);

  const phase5Evaluator = new Phase5FeatureFlagEvaluator(flagService);
  const rolloutManager = new Phase5RolloutManager(flagService);

  useEffect(() => {
    loadFeatureFlags();
    loadPhase5Status();
  }, []);

  const loadFeatureFlags = async () => {
    try {
      setLoading(true);
      const flagList = await flagService.listFlags();
      setFlags(flagList);
      
      if (flagList.length > 0 && !selectedFlag) {
        setSelectedFlag(flagList[0]);
        await loadFlagDetails(flagList[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  };

  const loadPhase5Status = async () => {
    try {
      const status = await rolloutManager.getPhase5Status();
      setPhase5Status(status);
    } catch (err) {
      console.error('Failed to load Phase 5 status:', err);
    }
  };

  const loadFlagDetails = async (flagId: string) => {
    try {
      const [stats, audit] = await Promise.all([
        flagService.getUsageStats(flagId, {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString()
        }),
        flagService.getAuditLog(flagId, {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString()
        })
      ]);
      
      setUsageStats(stats);
      setAuditLog(audit);
    } catch (err) {
      console.error('Failed to load flag details:', err);
    }
  };

  const handleFlagToggle = async (flagId: string, enabled: boolean) => {
    if (userRole === 'viewer') return;
    
    try {
      await flagService.updateFlag(flagId, { enabled });
      await loadFeatureFlags();
      
      if (selectedFlag?.id === flagId) {
        setSelectedFlag({ ...selectedFlag, enabled });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update feature flag');
    }
  };

  const handleRolloutChange = async (flagId: string, percentage: number) => {
    if (userRole === 'viewer') return;
    
    try {
      await flagService.updateRolloutPercentage(flagId, percentage);
      await loadFeatureFlags();
      
      if (selectedFlag?.id === flagId) {
        setSelectedFlag({ ...selectedFlag, rolloutPercentage: percentage });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rollout percentage');
    }
  };

  const handlePhase5WeeklyRollout = async (week: number) => {
    if (userRole !== 'admin') return;
    
    try {
      await rolloutManager.executeWeeklyRollout(week);
      await loadFeatureFlags();
      await loadPhase5Status();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute weekly rollout');
    }
  };

  const handleEmergencyDisable = async () => {
    if (userRole !== 'admin') return;
    
    try {
      await rolloutManager.emergencyDisableAll();
      await loadFeatureFlags();
      await loadPhase5Status();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to emergency disable');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'monitoring': return <Activity className="h-4 w-4" />;
      case 'processing': return <Settings className="h-4 w-4" />;
      case 'optimization': return <TrendingUp className="h-4 w-4" />;
      case 'ui': return <Users className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Feature Flag Dashboard</h1>
          <p className="text-gray-600">Manage and monitor feature flag rollouts</p>
        </div>
        
        {userRole === 'admin' && (
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={() => handlePhase5WeeklyRollout(1)}
            >
              Execute Week 1 Rollout
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleEmergencyDisable}
            >
              Emergency Disable All
            </Button>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Phase 5 Status Overview */}
      {phase5Status && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Phase 5 Rollout Status</span>
            </CardTitle>
            <CardDescription>
              Current status of Phase 5 feature rollout
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Embedding Monitoring</span>
                  <Badge variant={phase5Status.embeddingMonitoring.enabled ? "default" : "secondary"}>
                    {phase5Status.embeddingMonitoring.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <Progress value={phase5Status.embeddingMonitoring.rolloutPercentage} className="h-2" />
                <span className="text-xs text-gray-500">
                  {phase5Status.embeddingMonitoring.rolloutPercentage}% rollout
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Queue Processing</span>
                  <Badge variant={phase5Status.queueBasedProcessing.enabled ? "default" : "secondary"}>
                    {phase5Status.queueBasedProcessing.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <Progress value={phase5Status.queueBasedProcessing.rolloutPercentage} className="h-2" />
                <span className="text-xs text-gray-500">
                  {phase5Status.queueBasedProcessing.rolloutPercentage}% rollout
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Batch Optimization</span>
                  <Badge variant={phase5Status.batchOptimization.enabled ? "default" : "secondary"}>
                    {phase5Status.batchOptimization.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <Progress value={phase5Status.batchOptimization.rolloutPercentage} className="h-2" />
                <span className="text-xs text-gray-500">
                  {phase5Status.batchOptimization.rolloutPercentage}% rollout
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Feature Flags List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Feature Flags</CardTitle>
            <CardDescription>
              {flags.length} flags configured
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {flags.map((flag) => (
              <div
                key={flag.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedFlag?.id === flag.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => {
                  setSelectedFlag(flag);
                  loadFlagDetails(flag.id);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getCategoryIcon(flag.metadata.category)}
                    <span className="font-medium text-sm">{flag.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {flag.enabled ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>
                
                <div className="mt-2 flex items-center justify-between">
                  <Badge className={getPriorityColor(flag.metadata.priority)}>
                    {flag.metadata.priority}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {flag.rolloutPercentage}% rollout
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Flag Details */}
        <div className="lg:col-span-2">
          {selectedFlag ? (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
                <TabsTrigger value="audit">Audit Log</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center space-x-2">
                          {getCategoryIcon(selectedFlag.metadata.category)}
                          <span>{selectedFlag.name}</span>
                        </CardTitle>
                        <CardDescription>{selectedFlag.description}</CardDescription>
                      </div>
                      
                      {userRole !== 'viewer' && (
                        <Switch
                          checked={selectedFlag.enabled}
                          onCheckedChange={(enabled) => handleFlagToggle(selectedFlag.id, enabled)}
                        />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Rollout Percentage */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Rollout Percentage</label>
                        <span className="text-sm text-gray-500">{selectedFlag.rolloutPercentage}%</span>
                      </div>
                      {userRole !== 'viewer' ? (
                        <Slider
                          value={[selectedFlag.rolloutPercentage]}
                          onValueChange={([value]) => handleRolloutChange(selectedFlag.id, value)}
                          max={100}
                          step={5}
                          className="w-full"
                        />
                      ) : (
                        <Progress value={selectedFlag.rolloutPercentage} className="h-2" />
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Category</label>
                        <p className="text-sm">{selectedFlag.metadata.category}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Priority</label>
                        <Badge className={getPriorityColor(selectedFlag.metadata.priority)}>
                          {selectedFlag.metadata.priority}
                        </Badge>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Strategy</label>
                        <p className="text-sm">{selectedFlag.metadata.rolloutStrategy}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Impact</label>
                        <p className="text-sm">{selectedFlag.metadata.estimatedImpact}</p>
                      </div>
                    </div>

                    {/* Dependencies */}
                    {selectedFlag.metadata.dependencies && selectedFlag.metadata.dependencies.length > 0 && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Dependencies</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {selectedFlag.metadata.dependencies.map((dep) => (
                            <Badge key={dep} variant="outline">{dep}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    {selectedFlag.metadata.tags && selectedFlag.metadata.tags.length > 0 && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Tags</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {selectedFlag.metadata.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analytics" className="space-y-4">
                {usageStats && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                          <Activity className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium">Total Evaluations</span>
                        </div>
                        <p className="text-2xl font-bold mt-2">{usageStats.totalEvaluations}</p>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">Enabled</span>
                        </div>
                        <p className="text-2xl font-bold mt-2">{usageStats.enabledEvaluations}</p>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-purple-500" />
                          <span className="text-sm font-medium">Unique Users</span>
                        </div>
                        <p className="text-2xl font-bold mt-2">{usageStats.uniqueUsers}</p>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="h-4 w-4 text-orange-500" />
                          <span className="text-sm font-medium">Success Rate</span>
                        </div>
                        <p className="text-2xl font-bold mt-2">
                          {((usageStats.enabledEvaluations / usageStats.totalEvaluations) * 100).toFixed(1)}%
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="audit" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Audit Log</CardTitle>
                    <CardDescription>Recent changes to this feature flag</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {auditLog.map((entry) => (
                        <div key={entry.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                          <Clock className="h-4 w-4 text-gray-400 mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline">{entry.action}</Badge>
                              <span className="text-sm font-medium">{entry.userName}</span>
                              <span className="text-xs text-gray-500">
                                {new Date(entry.timestamp).toLocaleString()}
                              </span>
                            </div>
                            {entry.reason && (
                              <p className="text-sm text-gray-600 mt-1">{entry.reason}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <p className="text-gray-500">Select a feature flag to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
