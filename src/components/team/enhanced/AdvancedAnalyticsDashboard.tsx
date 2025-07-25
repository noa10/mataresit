import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Activity, 
  TrendingUp,
  Users,
  Brain,
  DollarSign,
  RefreshCw,
  Download,
  Settings,
  BarChart3,
  Eye,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { advancedAnalyticsService, AdvancedMemberAnalytics, TeamAdvancedAnalytics, PredictiveAnalytics } from '@/services/advancedAnalyticsService';
import { TeamMemberRole } from '@/types/team';
import { PredictiveAnalyticsChart } from './PredictiveAnalyticsChart';
import { ROIAnalysisChart } from './ROIAnalysisChart';
import { CollaborationMetricsChart } from './CollaborationMetricsChart';
import { ComparativeAnalyticsChart } from './ComparativeAnalyticsChart';

interface AdvancedAnalyticsDashboardProps {
  teamId: string;
  userRole?: TeamMemberRole;
  selectedMemberId?: string;
  onMemberSelect?: (memberId: string) => void;
  className?: string;
}

export function AdvancedAnalyticsDashboard({ 
  teamId, 
  userRole = 'member',
  selectedMemberId, 
  onMemberSelect,
  className 
}: AdvancedAnalyticsDashboardProps) {
  // State management
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'quarter'>('month');
  const [viewMode, setViewMode] = useState<'overview' | 'individual'>('overview');
  const [realTimeEnabled, setRealTimeEnabled] = useState(true);

  // Analytics data state
  const [teamAnalytics, setTeamAnalytics] = useState<TeamAdvancedAnalytics | null>(null);
  const [memberAnalytics, setMemberAnalytics] = useState<AdvancedMemberAnalytics | null>(null);
  const [predictiveAnalytics, setPredictiveAnalytics] = useState<PredictiveAnalytics | null>(null);
  const [analyticsSummary, setAnalyticsSummary] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { toast } = useToast();

  // Load analytics data
  const loadAnalyticsData = async (showToast = false) => {
    try {
      setRefreshing(true);
      const periodDays = getDaysForTimeframe(timeframe);

      if (viewMode === 'individual' && selectedMemberId) {
        // Load individual member analytics
        const memberResponse = await advancedAnalyticsService.getAdvancedMemberAnalytics(
          teamId, 
          selectedMemberId, 
          periodDays
        );

        if (memberResponse.success) {
          setMemberAnalytics(memberResponse.data);
        } else {
          throw new Error(memberResponse.error || 'Failed to load member analytics');
        }
      } else {
        // Load team-wide analytics
        const [teamResponse, summaryResponse, predictiveResponse] = await Promise.all([
          advancedAnalyticsService.getTeamAdvancedAnalytics(teamId, periodDays),
          advancedAnalyticsService.getAnalyticsSummary(teamId),
          userRole === 'owner' || userRole === 'admin' 
            ? advancedAnalyticsService.getPredictiveAnalytics(teamId, 30)
            : Promise.resolve({ success: false, error: 'Insufficient permissions' })
        ]);

        if (teamResponse.success) {
          setTeamAnalytics(teamResponse.data);
        }

        if (summaryResponse.success) {
          setAnalyticsSummary(summaryResponse.data);
        }

        if (predictiveResponse.success) {
          setPredictiveAnalytics(predictiveResponse.data);
        }
      }

      if (showToast) {
        toast({
          title: "Analytics Updated",
          description: "Advanced analytics data has been refreshed.",
        });
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading advanced analytics:', error);
      toast({
        title: "Error Loading Analytics",
        description: "Failed to load advanced analytics data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Real-time analytics subscription
  useEffect(() => {
    if (!realTimeEnabled || !teamId) return;

    const unsubscribe = advancedAnalyticsService.subscribeToAnalyticsUpdates(
      teamId,
      (payload) => {
        console.log('Real-time analytics update:', payload);
        // Refresh data when updates are received
        loadAnalyticsData();

        toast({
          title: "Analytics Updated",
          description: "Real-time data update received.",
          duration: 2000,
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [teamId, realTimeEnabled]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!realTimeEnabled) return;

    const interval = setInterval(() => {
      loadAnalyticsData();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [teamId, timeframe, viewMode, selectedMemberId, realTimeEnabled]);

  const getDaysForTimeframe = (timeframe: string): number => {
    switch (timeframe) {
      case 'week': return 7;
      case 'month': return 30;
      case 'quarter': return 90;
      default: return 30;
    }
  };

  const handleRefresh = () => {
    loadAnalyticsData(true);
  };

  const handleExport = async () => {
    try {
      const exportResponse = await advancedAnalyticsService.exportAnalyticsData(teamId, {
        format: 'json',
        include_charts: true,
        include_recommendations: true
      });

      if (exportResponse.success) {
        // Create download link
        const link = document.createElement('a');
        link.href = exportResponse.data.download_url;
        link.download = `advanced-analytics-${teamId}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: "Export Successful",
          description: "Analytics data has been exported successfully.",
        });
      } else {
        throw new Error(exportResponse.error || 'Export failed');
      }
    } catch (error) {
      console.error('Error exporting analytics:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export analytics data. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadAnalyticsData();
  }, [teamId, selectedMemberId, timeframe, viewMode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-pulse" />
          <h3 className="text-lg font-semibold mb-2">Loading Advanced Analytics</h3>
          <p className="text-muted-foreground">Gathering comprehensive analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Advanced Analytics</h2>
          <div className="flex items-center gap-4">
            <p className="text-muted-foreground">
              Comprehensive insights, predictions, and performance analytics
            </p>
            {lastUpdated && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Last updated: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={timeframe} onValueChange={(value: any) => setTimeframe(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="quarter">Last Quarter</SelectItem>
            </SelectContent>
          </Select>

          <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Team Overview</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={realTimeEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setRealTimeEnabled(!realTimeEnabled)}
          >
            <Zap className={`h-4 w-4 mr-2 ${realTimeEnabled ? 'text-yellow-400' : ''}`} />
            Real-time
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Analytics Content */}
      {viewMode === 'overview' ? (
        <TeamOverviewAnalytics 
          teamAnalytics={teamAnalytics}
          analyticsSummary={analyticsSummary}
          predictiveAnalytics={predictiveAnalytics}
          timeframe={timeframe}
          userRole={userRole}
          onMemberSelect={onMemberSelect}
        />
      ) : (
        <IndividualMemberAnalytics
          teamId={teamId}
          memberAnalytics={memberAnalytics}
          timeframe={timeframe}
        />
      )}
    </div>
  );
}

// Team Overview Analytics Component
interface TeamOverviewAnalyticsProps {
  teamAnalytics: TeamAdvancedAnalytics | null;
  analyticsSummary: any[];
  predictiveAnalytics: PredictiveAnalytics | null;
  timeframe: string;
  userRole: TeamMemberRole;
  onMemberSelect?: (memberId: string) => void;
}

function TeamOverviewAnalytics({ 
  teamAnalytics, 
  analyticsSummary, 
  predictiveAnalytics,
  timeframe,
  userRole,
  onMemberSelect 
}: TeamOverviewAnalyticsProps) {
  if (!teamAnalytics) {
    return (
      <div className="text-center py-8">
        <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No team analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge className={getHealthStatusColor(teamAnalytics.team_info.team_health_status)}>
                {teamAnalytics.team_info.team_health_status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {teamAnalytics.team_info.total_members} total members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(teamAnalytics.activity_summary.avg_engagement_score)}
            </div>
            <p className="text-xs text-muted-foreground">
              Average team engagement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Performers</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teamAnalytics.performance_distribution.high_performers}
            </div>
            <p className="text-xs text-muted-foreground">
              {teamAnalytics.performance_distribution.performance_percentages.high_performers_pct.toFixed(1)}% of team
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At Risk Members</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teamAnalytics.performance_distribution.at_risk_members}
            </div>
            <p className="text-xs text-muted-foreground">
              {teamAnalytics.performance_distribution.performance_percentages.at_risk_pct.toFixed(1)}% of team
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Analytics Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="collaboration">Collaboration</TabsTrigger>
          {(userRole === 'owner' || userRole === 'admin') && (
            <TabsTrigger value="predictive">Predictive</TabsTrigger>
          )}
          {(userRole === 'owner' || userRole === 'admin') && (
            <TabsTrigger value="roi">ROI Analysis</TabsTrigger>
          )}
          <TabsTrigger value="comparative">Comparative</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <PerformanceAnalyticsView 
            teamAnalytics={teamAnalytics}
            analyticsSummary={analyticsSummary}
            onMemberSelect={onMemberSelect}
          />
        </TabsContent>

        <TabsContent value="collaboration" className="space-y-4">
          <CollaborationMetricsChart
            teamAnalytics={teamAnalytics}
            memberAnalytics={analyticsSummary}
            timeframe={timeframe}
          />
        </TabsContent>

        {(userRole === 'owner' || userRole === 'admin') && (
          <TabsContent value="predictive" className="space-y-4">
            {predictiveAnalytics ? (
              <PredictiveAnalyticsChart
                predictiveData={predictiveAnalytics}
              />
            ) : (
              <PredictiveAnalyticsView
                predictiveAnalytics={predictiveAnalytics}
                teamAnalytics={teamAnalytics}
              />
            )}
          </TabsContent>
        )}

        {(userRole === 'owner' || userRole === 'admin') && (
          <TabsContent value="roi" className="space-y-4">
            <ROIAnalysisChart
              teamAnalytics={teamAnalytics}
              timeframe={timeframe}
            />
          </TabsContent>
        )}

        <TabsContent value="comparative" className="space-y-4">
          <ComparativeAnalyticsChart
            teamAnalytics={teamAnalytics}
            memberAnalytics={analyticsSummary}
            timeframe={timeframe}
          />
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <InsightsAnalyticsView
            teamAnalytics={teamAnalytics}
            timeframe={timeframe}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Individual Member Analytics Component
interface IndividualMemberAnalyticsProps {
  teamId: string;
  memberAnalytics: AdvancedMemberAnalytics | null;
  timeframe: string;
}

function IndividualMemberAnalytics({
  teamId,
  memberAnalytics,
  timeframe
}: IndividualMemberAnalyticsProps) {
  if (!memberAnalytics) {
    return (
      <div className="text-center py-8">
        <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No member analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Member Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Member Analytics
          </CardTitle>
          <CardDescription>
            {memberAnalytics.member_info.role} • Performance Category: {memberAnalytics.member_info.performance_category}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Activity Trend</p>
              <Badge className={getActivityTrendColor(memberAnalytics.member_info.activity_trend)}>
                {memberAnalytics.member_info.activity_trend}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Engagement Score</p>
              <p className="text-2xl font-bold">{memberAnalytics.activity_metrics.engagement_score}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Collaboration Score</p>
              <p className="text-2xl font-bold">{memberAnalytics.collaboration_metrics.collaboration_score}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Member Analytics Tabs */}
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="collaboration">Collaboration</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Activity Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Receipts Created</span>
                  <span className="font-bold">{memberAnalytics.activity_metrics.receipts_created}</span>
                </div>
                <div className="flex justify-between">
                  <span>AI Processed</span>
                  <span className="font-bold">{memberAnalytics.activity_metrics.receipts_ai_processed}</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Days (30d)</span>
                  <span className="font-bold">{memberAnalytics.activity_metrics.active_days_last_30_days}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Amount</span>
                  <span className="font-bold">${memberAnalytics.activity_metrics.total_receipt_amount.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Last 30 Days</span>
                  <span className="font-bold">{memberAnalytics.activity_metrics.receipts_last_30_days}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last 7 Days</span>
                  <span className="font-bold">{memberAnalytics.activity_metrics.receipts_last_7_days}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last 1 Day</span>
                  <span className="font-bold">{memberAnalytics.activity_metrics.receipts_last_1_day}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="collaboration" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Collaboration Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Conversations Created</span>
                  <span className="font-bold">{memberAnalytics.collaboration_metrics.conversations_created}</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Conversations</span>
                  <span className="font-bold">{memberAnalytics.collaboration_metrics.active_conversations_30_days}</span>
                </div>
                <div className="flex justify-between">
                  <span>Projects Involved</span>
                  <span className="font-bold">{memberAnalytics.collaboration_metrics.projects_involved}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tasks Completed</span>
                  <span className="font-bold">{memberAnalytics.collaboration_metrics.tasks_completed}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Collaboration Effectiveness</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2">
                    {memberAnalytics.performance_indicators.collaboration_effectiveness}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Collaboration Rating
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Indicators</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Productivity Trend</p>
                  <Badge className={getProductivityTrendColor(memberAnalytics.performance_indicators.productivity_trend)}>
                    {memberAnalytics.performance_indicators.productivity_trend}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Project Success Rate</p>
                  <p className="text-lg font-bold">{(memberAnalytics.performance_indicators.project_success_rate * 100).toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Predictive Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Performance Forecast</p>
                <Badge className="mb-4">{memberAnalytics.predictive_insights.performance_forecast}</Badge>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Growth Potential</p>
                <Badge className={getGrowthPotentialColor(memberAnalytics.predictive_insights.growth_potential)}>
                  {memberAnalytics.predictive_insights.growth_potential}
                </Badge>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Recommended Actions</p>
                <ul className="space-y-1">
                  {memberAnalytics.predictive_insights.recommended_actions.map((action, index) => (
                    <li key={index} className="text-sm flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper functions
function getHealthStatusColor(status: string): string {
  switch (status) {
    case 'excellent': return 'bg-green-100 text-green-800 border-green-200';
    case 'good': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'concerning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'needs_improvement': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getActivityTrendColor(trend: string): string {
  switch (trend) {
    case 'increasing': return 'bg-green-100 text-green-800 border-green-200';
    case 'decreasing': return 'bg-red-100 text-red-800 border-red-200';
    case 'stable': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getProductivityTrendColor(trend: string): string {
  switch (trend) {
    case 'improving': return 'bg-green-100 text-green-800 border-green-200';
    case 'declining': return 'bg-red-100 text-red-800 border-red-200';
    case 'stable': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getGrowthPotentialColor(potential: string): string {
  switch (potential) {
    case 'high': return 'bg-green-100 text-green-800 border-green-200';
    case 'moderate': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'requires_support': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'stable': return 'bg-gray-100 text-gray-800 border-gray-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

// Performance Analytics View Component
interface PerformanceAnalyticsViewProps {
  teamAnalytics: TeamAdvancedAnalytics;
  analyticsSummary: any[];
  onMemberSelect?: (memberId: string) => void;
}

function PerformanceAnalyticsView({
  teamAnalytics,
  analyticsSummary,
  onMemberSelect
}: PerformanceAnalyticsViewProps) {
  return (
    <div className="space-y-6">
      {/* Performance Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Distribution</CardTitle>
          <CardDescription>Team member performance categories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {teamAnalytics.performance_distribution.high_performers}
              </div>
              <p className="text-sm text-muted-foreground">High Performers</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {teamAnalytics.performance_distribution.solid_contributors}
              </div>
              <p className="text-sm text-muted-foreground">Solid Contributors</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {teamAnalytics.performance_distribution.developing_members}
              </div>
              <p className="text-sm text-muted-foreground">Developing</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {teamAnalytics.performance_distribution.needs_attention}
              </div>
              <p className="text-sm text-muted-foreground">Needs Attention</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {teamAnalytics.performance_distribution.at_risk_members}
              </div>
              <p className="text-sm text-muted-foreground">At Risk</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Performers */}
      <Card>
        <CardHeader>
          <CardTitle>Team Member Performance</CardTitle>
          <CardDescription>Individual member analytics summary</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analyticsSummary.slice(0, 10).map((member, index) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                onClick={() => onMemberSelect?.(member.user_id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium">{index + 1}</span>
                  </div>
                  <div>
                    <p className="font-medium">{member.user_id.slice(0, 8)}...</p>
                    <p className="text-sm text-muted-foreground">{member.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">Engagement: {member.engagement_score}</p>
                    <Badge className={getPerformanceCategoryColor(member.performance_category)}>
                      {member.performance_category.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">Collaboration: {member.collaboration_score}</p>
                    <p className="text-sm text-muted-foreground">
                      {member.receipts_created} receipts
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Collaboration Analytics View Component
interface CollaborationAnalyticsViewProps {
  teamAnalytics: TeamAdvancedAnalytics;
  analyticsSummary: any[];
}

function CollaborationAnalyticsView({
  teamAnalytics,
  analyticsSummary
}: CollaborationAnalyticsViewProps) {
  return (
    <div className="space-y-6">
      {/* Collaboration Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Collaboration Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {Math.round(teamAnalytics.collaboration_summary.avg_collaboration_score)}
            </div>
            <p className="text-sm text-muted-foreground">Average team collaboration</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {teamAnalytics.collaboration_summary.team_conversations}
            </div>
            <p className="text-sm text-muted-foreground">Team conversations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Collaboration Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              <Badge className={getCollaborationEffectivenessColor(teamAnalytics.collaboration_summary.collaboration_effectiveness)}>
                {teamAnalytics.collaboration_summary.collaboration_effectiveness}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Team effectiveness</p>
          </CardContent>
        </Card>
      </div>

      {/* Collaboration Details */}
      <Card>
        <CardHeader>
          <CardTitle>Member Collaboration Metrics</CardTitle>
          <CardDescription>Individual collaboration contributions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analyticsSummary
              .sort((a, b) => b.collaboration_score - a.collaboration_score)
              .slice(0, 8)
              .map((member, index) => (
                <div key={member.user_id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium">{member.user_id.slice(0, 8)}...</p>
                      <p className="text-sm text-muted-foreground">{member.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">Score: {member.collaboration_score}</p>
                      <p className="text-sm text-muted-foreground">
                        {member.conversations_created} conversations
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Activity: {member.activity_trend}</p>
                      <p className="text-sm text-muted-foreground">
                        {member.active_conversations_30_days} active
                      </p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getPerformanceCategoryColor(category: string): string {
  switch (category) {
    case 'high_performer': return 'bg-green-100 text-green-800 border-green-200';
    case 'solid_contributor': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'developing': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'needs_attention': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'at_risk': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getCollaborationEffectivenessColor(effectiveness: string): string {
  switch (effectiveness) {
    case 'excellent': return 'bg-green-100 text-green-800 border-green-200';
    case 'good': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'average': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'needs_improvement': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

// Predictive Analytics View Component
interface PredictiveAnalyticsViewProps {
  predictiveAnalytics: PredictiveAnalytics | null;
  teamAnalytics: TeamAdvancedAnalytics;
}

function PredictiveAnalyticsView({
  predictiveAnalytics,
  teamAnalytics
}: PredictiveAnalyticsViewProps) {
  if (!predictiveAnalytics) {
    return (
      <div className="text-center py-8">
        <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Predictive analytics not available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Forecast Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Team Trajectory</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={getTrajectoryColor(predictiveAnalytics.predictive_analytics.team_trajectory)}>
              {predictiveAnalytics.predictive_analytics.team_trajectory.replace('_', ' ')}
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              Forecast: {predictiveAnalytics.forecast_period.forecast_days} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Success Probability</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={getSuccessProbabilityColor(predictiveAnalytics.predictive_analytics.success_probability)}>
              {predictiveAnalytics.predictive_analytics.success_probability}
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              Project success likelihood
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Growth Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={getForecastColor(predictiveAnalytics.predictive_analytics.growth_forecast)}>
              {predictiveAnalytics.predictive_analytics.growth_forecast}
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              Team growth direction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Risk Assessment */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Assessment</CardTitle>
          <CardDescription>Potential risks and mitigation strategies</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Member Attrition Risk</p>
              <Badge className={getRiskColor(predictiveAnalytics.risk_assessment.member_attrition_risk)}>
                {predictiveAnalytics.risk_assessment.member_attrition_risk}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Productivity Decline Risk</p>
              <Badge className={getRiskColor(predictiveAnalytics.risk_assessment.productivity_decline_risk)}>
                {predictiveAnalytics.risk_assessment.productivity_decline_risk}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Team Cohesion Risk</p>
              <Badge className={getRiskColor(predictiveAnalytics.risk_assessment.team_cohesion_risk)}>
                {predictiveAnalytics.risk_assessment.team_cohesion_risk}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Immediate Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {predictiveAnalytics.recommendations.immediate_actions.map((action, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  {action}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Strategic Initiatives</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {predictiveAnalytics.recommendations.strategic_initiatives.map((initiative, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <Target className="h-4 w-4 text-blue-500" />
                  {initiative}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Success Indicators */}
      <Card>
        <CardHeader>
          <CardTitle>Key Metrics to Watch</CardTitle>
          <CardDescription>Important indicators for team success</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-3">Metrics to Monitor</p>
              <ul className="space-y-2">
                {predictiveAnalytics.success_indicators.key_metrics_to_watch.map((metric, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <Eye className="h-4 w-4 text-green-500" />
                    {metric}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-3">Target Improvements</p>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Activity Target</span>
                  <span className="text-sm font-bold">
                    {predictiveAnalytics.success_indicators.target_improvements.activity_increase_target.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Collaboration Target</span>
                  <span className="text-sm font-bold">
                    {predictiveAnalytics.success_indicators.target_improvements.collaboration_score_target.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">At-Risk Reduction</span>
                  <span className="text-sm font-bold">
                    {predictiveAnalytics.success_indicators.target_improvements.at_risk_reduction_target}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Insights Analytics View Component
interface InsightsAnalyticsViewProps {
  teamAnalytics: TeamAdvancedAnalytics;
  timeframe: string;
}

function InsightsAnalyticsView({
  teamAnalytics,
  timeframe
}: InsightsAnalyticsViewProps) {
  return (
    <div className="space-y-6">
      {/* Team Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Team Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {teamAnalytics.team_insights.strengths.map((strength, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  {strength}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Areas for Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {teamAnalytics.team_insights.areas_for_improvement.map((area, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-orange-500 rounded-full" />
                  {area}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Recommended Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            Recommended Actions
          </CardTitle>
          <CardDescription>Strategic recommendations for team improvement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamAnalytics.team_insights.recommended_actions.map((action, index) => (
              <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                  <span className="text-xs font-medium text-blue-600">{index + 1}</span>
                </div>
                <p className="text-sm">{action}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Team Composition Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Team Composition Analysis</CardTitle>
          <CardDescription>Leadership and member distribution insights</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-3">Role Distribution</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Owners</span>
                  <span className="text-sm font-bold">{teamAnalytics.member_composition.owners_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Admins</span>
                  <span className="text-sm font-bold">{teamAnalytics.member_composition.admins_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Members</span>
                  <span className="text-sm font-bold">{teamAnalytics.member_composition.members_count}</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-3">Composition Ratios</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Leadership Ratio</span>
                  <span className="text-sm font-bold">
                    {teamAnalytics.member_composition.composition_ratio.leadership_ratio.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Member Ratio</span>
                  <span className="text-sm font-bold">
                    {teamAnalytics.member_composition.composition_ratio.member_ratio.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Additional helper functions for predictive analytics
function getTrajectoryColor(trajectory: string): string {
  switch (trajectory) {
    case 'high_growth_potential': return 'bg-green-100 text-green-800 border-green-200';
    case 'stable_growth': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'intervention_required': return 'bg-red-100 text-red-800 border-red-200';
    case 'monitoring_needed': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getSuccessProbabilityColor(probability: string): string {
  switch (probability) {
    case 'high': return 'bg-green-100 text-green-800 border-green-200';
    case 'moderate': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'low': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'very_low': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getForecastColor(forecast: string): string {
  switch (forecast) {
    case 'positive': return 'bg-green-100 text-green-800 border-green-200';
    case 'neutral': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'negative': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getRiskColor(risk: string): string {
  switch (risk) {
    case 'low': return 'bg-green-100 text-green-800 border-green-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'high': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}
