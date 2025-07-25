import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Activity, 
  Bell, 
  Users, 
  TrendingUp,
  Clock,
  Filter,
  Settings,
  Zap,
  BarChart3,
  Calendar,
  Eye,
  EyeOff
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/contexts/NotificationContext';
import { RealTimeActivityFeed } from './RealTimeActivityFeed';
import { MemberActivityTimeline } from './MemberActivityTimeline';
import { teamService } from '@/services/teamService';

interface TeamActivityDashboardProps {
  teamId: string;
  className?: string;
}

interface ActivityStats {
  totalActivities: number;
  activeMembers: number;
  recentNotifications: number;
  engagementScore: number;
  topActivityTypes: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  activityTrends: Array<{
    date: string;
    activities: number;
    members: number;
  }>;
}

export function TeamActivityDashboard({ teamId, className }: TeamActivityDashboardProps) {
  const [selectedMember, setSelectedMember] = useState<string | undefined>();
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(true);
  
  const { toast } = useToast();
  const { 
    notifications, 
    unreadCount, 
    isConnected,
    markAllAsRead 
  } = useNotifications();

  // Load activity statistics
  const loadActivityStats = async () => {
    try {
      setLoading(true);
      
      const endDate = new Date().toISOString();
      const startDate = new Date(
        Date.now() - (timeRange === '24h' ? 24 * 60 * 60 * 1000 : 
                     timeRange === '7d' ? 7 * 24 * 60 * 60 * 1000 : 
                     30 * 24 * 60 * 60 * 1000)
      ).toISOString();

      const [auditResponse, engagementResponse] = await Promise.all([
        teamService.getAuditLogsEnhanced(teamId, {
          startDate,
          endDate,
          limit: 1000
        }),
        teamService.getTeamEngagementMetrics(teamId, 
          timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30
        )
      ]);

      let stats: ActivityStats = {
        totalActivities: 0,
        activeMembers: 0,
        recentNotifications: 0,
        engagementScore: 0,
        topActivityTypes: [],
        activityTrends: []
      };

      // Process audit logs
      if (auditResponse.success && auditResponse.data?.logs) {
        const logs = auditResponse.data.logs;
        stats.totalActivities = logs.length;
        
        // Count unique active members
        const activeMembers = new Set(logs.map((log: any) => log.performed_by));
        stats.activeMembers = activeMembers.size;
        
        // Analyze activity types
        const activityCounts: Record<string, number> = {};
        logs.forEach((log: any) => {
          activityCounts[log.action] = (activityCounts[log.action] || 0) + 1;
        });
        
        const totalActivities = logs.length;
        stats.topActivityTypes = Object.entries(activityCounts)
          .map(([type, count]) => ({
            type,
            count,
            percentage: (count / totalActivities) * 100
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Generate activity trends (simplified)
        const trendDays = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30;
        const trends: Array<{ date: string; activities: number; members: number }> = [];
        
        for (let i = trendDays - 1; i >= 0; i--) {
          const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
          const dayStart = new Date(date.setHours(0, 0, 0, 0));
          const dayEnd = new Date(date.setHours(23, 59, 59, 999));
          
          const dayLogs = logs.filter((log: any) => {
            const logDate = new Date(log.created_at);
            return logDate >= dayStart && logDate <= dayEnd;
          });
          
          const dayMembers = new Set(dayLogs.map((log: any) => log.performed_by));
          
          trends.push({
            date: dayStart.toISOString().split('T')[0],
            activities: dayLogs.length,
            members: dayMembers.size
          });
        }
        
        stats.activityTrends = trends;
      }

      // Process engagement metrics
      if (engagementResponse.success && engagementResponse.data) {
        stats.engagementScore = Math.round(engagementResponse.data.team_health_score || 0);
      }

      // Count recent notifications
      const teamNotifications = notifications.filter(n => n.team_id === teamId);
      stats.recentNotifications = teamNotifications.length;

      setActivityStats(stats);
    } catch (error) {
      console.error('Error loading activity stats:', error);
      toast({
        title: "Error Loading Statistics",
        description: "Failed to load activity statistics.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivityStats();
  }, [teamId, timeRange]);

  const formatActivityType = (type: string): string => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getActivityTypeColor = (type: string): string => {
    const colorMap: Record<string, string> = {
      'member_joined': 'bg-green-100 text-green-800',
      'member_left': 'bg-orange-100 text-orange-800',
      'member_role_changed': 'bg-purple-100 text-purple-800',
      'receipt_created': 'bg-blue-100 text-blue-800',
      'receipt_updated': 'bg-indigo-100 text-indigo-800',
      'team_settings_updated': 'bg-gray-100 text-gray-800',
      'default': 'bg-gray-100 text-gray-800'
    };
    
    return colorMap[type] || colorMap.default;
  };

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
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
    <div className={`space-y-6 ${className}`}>
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Team Activity Dashboard</h2>
          <p className="text-muted-foreground">
            Real-time activity monitoring and member engagement insights
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            {showNotifications ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showNotifications ? 'Hide' : 'Show'} Notifications
          </Button>
        </div>
      </div>

      {/* Activity Statistics Cards */}
      {activityStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Activities</p>
                  <p className="text-2xl font-bold">{activityStats.totalActivities}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Members</p>
                  <p className="text-2xl font-bold">{activityStats.activeMembers}</p>
                </div>
                <Users className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Notifications</p>
                  <p className="text-2xl font-bold">{activityStats.recentNotifications}</p>
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="mt-1">
                      {unreadCount} unread
                    </Badge>
                  )}
                </div>
                <Bell className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Engagement Score</p>
                  <p className="text-2xl font-bold">{activityStats.engagementScore}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Activity Types */}
      {activityStats && activityStats.topActivityTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top Activity Types
            </CardTitle>
            <CardDescription>
              Most common activities in the selected time period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activityStats.topActivityTypes.map((activity, index) => (
                <div key={activity.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground">
                      #{index + 1}
                    </span>
                    <Badge className={getActivityTypeColor(activity.type)}>
                      {formatActivityType(activity.type)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{activity.count}</span>
                    <span className="text-sm text-muted-foreground">
                      ({activity.percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Feed and Timeline */}
      <Tabs defaultValue="feed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="feed">Activity Feed</TabsTrigger>
          <TabsTrigger value="timeline">Member Timeline</TabsTrigger>
          {showNotifications && <TabsTrigger value="notifications">Notifications</TabsTrigger>}
        </TabsList>

        <TabsContent value="feed" className="space-y-4">
          <RealTimeActivityFeed 
            teamId={teamId}
            maxItems={50}
            autoRefresh={true}
            showFilters={true}
          />
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <div className="mb-4">
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                {/* Member options would be populated from team data */}
              </SelectContent>
            </Select>
          </div>
          
          {selectedMember && selectedMember !== 'all' ? (
            <MemberActivityTimeline 
              teamId={teamId}
              memberId={selectedMember}
              limit={30}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Select a team member to view their activity timeline
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {showNotifications && (
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Team Notifications
                    {unreadCount > 0 && (
                      <Badge variant="destructive">
                        {unreadCount} unread
                      </Badge>
                    )}
                  </CardTitle>
                  {unreadCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={markAllAsRead}
                    >
                      Mark All Read
                    </Button>
                  )}
                </div>
                <CardDescription>
                  Recent notifications for this team
                  {!isConnected && (
                    <Badge variant="destructive" className="ml-2">
                      Disconnected
                    </Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {notifications
                    .filter(n => n.team_id === teamId)
                    .slice(0, 20)
                    .map((notification) => (
                      <div 
                        key={notification.id}
                        className={`p-3 border rounded-lg ${
                          notification.read_at ? 'bg-gray-50' : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{notification.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(notification.created_at).toLocaleString()}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {notification.priority}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  
                  {notifications.filter(n => n.team_id === teamId).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No notifications for this team</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
