import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Users, 
  Receipt,
  Target,
  Calendar,
  BarChart3,
  RefreshCw,
  Download,
  Filter,
  Eye,
  Clock,
  Award
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { teamService } from '@/services/teamService';
import { 
  MemberAnalytics, 
  MemberPerformanceInsights, 
  TeamEngagementMetrics,
  TeamMemberRole 
} from '@/types/team';
import { MemberPerformanceChart } from './MemberPerformanceChart';
import { TeamEngagementChart } from './TeamEngagementChart';
import { MemberActivityTimeline } from './MemberActivityTimeline';

interface MemberAnalyticsDashboardProps {
  teamId: string;
  selectedMemberId?: string;
  onMemberSelect?: (memberId: string) => void;
}

export function MemberAnalyticsDashboard({ 
  teamId, 
  selectedMemberId, 
  onMemberSelect 
}: MemberAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'quarter'>('month');
  const [viewMode, setViewMode] = useState<'individual' | 'team'>('team');
  
  // Analytics data state
  const [memberAnalytics, setMemberAnalytics] = useState<MemberAnalytics | null>(null);
  const [performanceInsights, setPerformanceInsights] = useState<MemberPerformanceInsights | null>(null);
  const [teamEngagement, setTeamEngagement] = useState<TeamEngagementMetrics | null>(null);
  
  const { toast } = useToast();

  const loadAnalyticsData = async (showToast = false) => {
    try {
      setRefreshing(true);
      
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - getDaysForTimeframe(timeframe) * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];

      if (viewMode === 'individual' && selectedMemberId) {
        // Load individual member analytics
        const [analyticsResponse, insightsResponse] = await Promise.all([
          teamService.getMemberAnalytics(teamId, selectedMemberId, { startDate, endDate }),
          teamService.getMemberPerformanceInsights(teamId, selectedMemberId, getDaysForTimeframe(timeframe))
        ]);

        if (analyticsResponse.success) {
          setMemberAnalytics(analyticsResponse.data);
        }
        if (insightsResponse.success) {
          setPerformanceInsights(insightsResponse.data);
        }
      } else {
        // Load team-wide analytics
        const engagementResponse = await teamService.getTeamEngagementMetrics(teamId, getDaysForTimeframe(timeframe));

        if (engagementResponse.success) {
          setTeamEngagement(engagementResponse.data);
        }
      }

      if (showToast) {
        toast({
          title: "Analytics Updated",
          description: "Member analytics data has been refreshed.",
        });
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        title: "Error Loading Analytics",
        description: "Failed to load analytics data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getDaysForTimeframe = (timeframe: string): number => {
    switch (timeframe) {
      case 'week': return 7;
      case 'month': return 30;
      case 'quarter': return 90;
      default: return 30;
    }
  };



  useEffect(() => {
    loadAnalyticsData();
  }, [teamId, selectedMemberId, timeframe, viewMode]);

  const handleRefresh = () => {
    loadAnalyticsData(true);
  };

  const handleExport = async () => {
    try {
      // TODO: Implement export functionality
      toast({
        title: "Export Started",
        description: "Analytics data export will be available shortly.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export analytics data.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-10 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Member Analytics</h2>
          <p className="text-muted-foreground">
            {viewMode === 'individual' 
              ? 'Individual member performance insights' 
              : 'Team-wide engagement and performance metrics'
            }
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Select value={viewMode} onValueChange={(value: 'individual' | 'team') => setViewMode(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="team">Team View</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={timeframe} onValueChange={(value: 'week' | 'month' | 'quarter') => setTimeframe(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="quarter">Last Quarter</SelectItem>
            </SelectContent>
          </Select>
          
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
      {viewMode === 'team' ? (
        <TeamAnalyticsView 
          teamEngagement={teamEngagement}
          timeframe={timeframe}
          onMemberSelect={onMemberSelect}
        />
      ) : (
        <IndividualAnalyticsView
          teamId={teamId}
          memberAnalytics={memberAnalytics}
          performanceInsights={performanceInsights}
          timeframe={timeframe}
        />
      )}
    </div>
  );
}

// Sub-components for different views
interface TeamAnalyticsViewProps {
  teamEngagement: TeamEngagementMetrics | null;
  timeframe: string;
  onMemberSelect?: (memberId: string) => void;
}

function TeamAnalyticsView({ teamEngagement, timeframe, onMemberSelect }: TeamAnalyticsViewProps) {
  if (!teamEngagement) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No team engagement data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Members</p>
                <p className="text-2xl font-bold">{teamEngagement.team_overview.total_members}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Members</p>
                <p className="text-2xl font-bold">{teamEngagement.team_overview.very_active_members + teamEngagement.team_overview.active_members}</p>
              </div>
              <Activity className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Receipts</p>
                <p className="text-2xl font-bold">{teamEngagement.receipt_metrics.total_receipts}</p>
              </div>
              <Receipt className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Health Score</p>
                <p className="text-2xl font-bold">{Math.round(teamEngagement.team_health_score)}%</p>
              </div>
              <Target className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Engagement Chart */}
      <TeamEngagementChart
        engagementData={teamEngagement}
        timeframe={timeframe}
      />

      {/* Top Performers Quick View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Top Performers
          </CardTitle>
          <CardDescription>
            Most active team members this {timeframe}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {teamEngagement.top_performers.slice(0, 5).map((performer, index) => (
              <div
                key={performer.user_id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onMemberSelect?.(performer.user_id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">
                      {performer.full_name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium">{performer.full_name}</div>
                    <div className="text-sm text-muted-foreground capitalize">{performer.role}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-sm font-medium">{performer.receipt_count}</div>
                    <div className="text-xs text-muted-foreground">Receipts</div>
                  </div>
                  <Badge
                    variant={performer.engagement_level === 'high' ? 'default' : 'secondary'}
                    className="capitalize"
                  >
                    {performer.engagement_level}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface IndividualAnalyticsViewProps {
  teamId: string;
  memberAnalytics: MemberAnalytics | null;
  performanceInsights: MemberPerformanceInsights | null;
  timeframe: string;
}

function IndividualAnalyticsView({ teamId, memberAnalytics, performanceInsights, timeframe }: IndividualAnalyticsViewProps) {
  if (!memberAnalytics) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No member analytics data available</p>
        </CardContent>
      </Card>
    );
  }

  const getActivityStatusColor = (status: string): string => {
    switch (status) {
      case 'very_active': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'moderate': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-orange-100 text-orange-800';
      case 'dormant': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEngagementColor = (level: string): string => {
    switch (level) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-orange-100 text-orange-800';
      case 'minimal': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Individual Member Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {memberAnalytics.member_info.full_name}
          </CardTitle>
          <CardDescription>
            {memberAnalytics.member_info.role} • Joined {new Date(memberAnalytics.member_info.joined_at).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Activity Level</p>
              <Badge className={getActivityStatusColor(memberAnalytics.performance_data.member_status)}>
                {memberAnalytics.performance_data.member_status.replace('_', ' ')}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Engagement</p>
              <Badge className={getEngagementColor(memberAnalytics.engagement_metrics.engagement_level)}>
                {memberAnalytics.engagement_metrics.engagement_level}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Last Active</p>
              <p className="text-sm">
                {memberAnalytics.performance_data.days_since_last_active} days ago
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Chart */}
      <MemberPerformanceChart
        memberAnalytics={memberAnalytics}
        performanceInsights={performanceInsights}
        timeframe={timeframe}
      />

      {/* Activity Timeline */}
      <MemberActivityTimeline
        teamId={teamId}
        memberId={memberAnalytics.member_info.user_id}
        limit={20}
      />
    </div>
  );
}
