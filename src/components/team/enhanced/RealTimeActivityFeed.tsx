import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Receipt, 
  Users, 
  Settings, 
  Clock,
  Calendar,
  RefreshCw,
  Filter,
  Bell,
  Eye,
  UserPlus,
  UserMinus,
  Shield,
  Mail,
  Zap,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/contexts/NotificationContext';
import { teamService } from '@/services/teamService';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface ActivityItem {
  id: string;
  type: 'member_activity' | 'team_event' | 'system_event';
  activity_type: string;
  title: string;
  description: string;
  actor: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  target?: {
    id: string;
    name: string;
    email: string;
  };
  metadata: Record<string, any>;
  created_at: string;
  priority: 'low' | 'medium' | 'high';
  read: boolean;
}

interface RealTimeActivityFeedProps {
  teamId: string;
  userId?: string;
  maxItems?: number;
  autoRefresh?: boolean;
  showFilters?: boolean;
}

export function RealTimeActivityFeed({ 
  teamId, 
  userId, 
  maxItems = 50,
  autoRefresh = true,
  showFilters = true
}: RealTimeActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'member' | 'team' | 'system'>('all');
  const [isConnected, setIsConnected] = useState(true);
  const [newActivityCount, setNewActivityCount] = useState(0);
  
  const subscriptionRef = useRef<any>(null);
  const { toast } = useToast();
  const { isConnected: notificationConnected } = useNotifications();

  // Load initial activities
  const loadActivities = async (showToast = false) => {
    try {
      setRefreshing(true);
      
      // Get recent team audit logs and member activities
      const [auditResponse, timelineResponse] = await Promise.all([
        teamService.getAuditLogsEnhanced(teamId, {
          limit: maxItems,
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // Last 7 days
        }),
        userId ? teamService.getMemberActivityTimeline(teamId, {
          userId,
          limit: maxItems / 2
        }) : Promise.resolve({ success: true, data: { activities: [] } })
      ]);

      const activities: ActivityItem[] = [];

      // Process audit logs
      if (auditResponse.success && auditResponse.data?.logs) {
        auditResponse.data.logs.forEach((log: any) => {
          activities.push({
            id: `audit-${log.id}`,
            type: 'team_event',
            activity_type: log.action,
            title: getActivityTitle(log.action, log),
            description: getActivityDescription(log.action, log),
            actor: {
              id: log.performed_by,
              name: log.performed_by_name || 'Unknown User',
              email: log.performed_by_email || '',
            },
            target: log.target_user_id ? {
              id: log.target_user_id,
              name: log.target_user_name || 'Unknown User',
              email: log.target_user_email || '',
            } : undefined,
            metadata: log.metadata || {},
            created_at: log.created_at,
            priority: getActivityPriority(log.action),
            read: false
          });
        });
      }

      // Process member timeline activities
      if (timelineResponse.success && timelineResponse.data?.activities) {
        timelineResponse.data.activities.forEach((activity: any) => {
          activities.push({
            id: `timeline-${activity.id}`,
            type: 'member_activity',
            activity_type: activity.activity_type,
            title: activity.description || getActivityTitle(activity.activity_type, activity),
            description: activity.details || '',
            actor: {
              id: activity.user_id || activity.performed_by,
              name: activity.user_name || activity.performed_by_name || 'Unknown User',
              email: activity.user_email || activity.performed_by_email || '',
            },
            metadata: activity.metadata || {},
            created_at: activity.created_at,
            priority: 'medium',
            read: false
          });
        });
      }

      // Sort by timestamp and limit
      const sortedActivities = activities
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, maxItems);

      setActivities(sortedActivities);
      
      if (showToast) {
        toast({
          title: "Activity Feed Updated",
          description: `Loaded ${sortedActivities.length} recent activities.`,
        });
      }
    } catch (error) {
      console.error('Error loading activities:', error);
      toast({
        title: "Error Loading Activities",
        description: "Failed to load activity feed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Set up real-time subscriptions
  useEffect(() => {
    if (!autoRefresh) return;

    const setupRealtimeSubscription = async () => {
      try {
        // Subscribe to team audit logs
        const auditSubscription = supabase
          .channel(`team-audit-${teamId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'team_audit_logs',
              filter: `team_id=eq.${teamId}`
            },
            (payload) => {
              const newLog = payload.new as any;
              const newActivity: ActivityItem = {
                id: `audit-${newLog.id}`,
                type: 'team_event',
                activity_type: newLog.action,
                title: getActivityTitle(newLog.action, newLog),
                description: getActivityDescription(newLog.action, newLog),
                actor: {
                  id: newLog.performed_by,
                  name: newLog.performed_by_name || 'Unknown User',
                  email: newLog.performed_by_email || '',
                },
                target: newLog.target_user_id ? {
                  id: newLog.target_user_id,
                  name: newLog.target_user_name || 'Unknown User',
                  email: newLog.target_user_email || '',
                } : undefined,
                metadata: newLog.metadata || {},
                created_at: newLog.created_at,
                priority: getActivityPriority(newLog.action),
                read: false
              };

              setActivities(prev => [newActivity, ...prev].slice(0, maxItems));
              setNewActivityCount(prev => prev + 1);
              
              // Show toast for high priority activities
              if (newActivity.priority === 'high') {
                toast({
                  title: "New Team Activity",
                  description: newActivity.title,
                });
              }
            }
          )
          .subscribe((status) => {
            setIsConnected(status === 'SUBSCRIBED');
          });

        subscriptionRef.current = auditSubscription;
      } catch (error) {
        console.error('Error setting up real-time subscription:', error);
        setIsConnected(false);
      }
    };

    setupRealtimeSubscription();

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [teamId, autoRefresh, maxItems]);

  // Auto-refresh every 30 seconds as fallback
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadActivities();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Initial load
  useEffect(() => {
    loadActivities();
  }, [teamId, userId]);

  const getActivityIcon = (activityType: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      'member_joined': <UserPlus className="h-4 w-4" />,
      'member_left': <UserMinus className="h-4 w-4" />,
      'member_role_changed': <Shield className="h-4 w-4" />,
      'member_invited': <Mail className="h-4 w-4" />,
      'receipt_created': <Receipt className="h-4 w-4" />,
      'receipt_updated': <Receipt className="h-4 w-4" />,
      'team_settings_updated': <Settings className="h-4 w-4" />,
      'team_created': <Users className="h-4 w-4" />,
      'default': <Activity className="h-4 w-4" />
    };
    
    return iconMap[activityType] || iconMap.default;
  };

  const getActivityColor = (activityType: string, priority: string): string => {
    if (priority === 'high') return 'text-red-600 bg-red-100';
    if (priority === 'low') return 'text-gray-600 bg-gray-100';
    
    const colorMap: Record<string, string> = {
      'member_joined': 'text-green-600 bg-green-100',
      'member_left': 'text-orange-600 bg-orange-100',
      'member_role_changed': 'text-purple-600 bg-purple-100',
      'member_invited': 'text-blue-600 bg-blue-100',
      'receipt_created': 'text-emerald-600 bg-emerald-100',
      'receipt_updated': 'text-blue-600 bg-blue-100',
      'team_settings_updated': 'text-indigo-600 bg-indigo-100',
      'default': 'text-blue-600 bg-blue-100'
    };
    
    return colorMap[activityType] || colorMap.default;
  };

  const getActivityTitle = (action: string, data: any): string => {
    const titleMap: Record<string, string> = {
      'member_joined': `${data.performed_by_name || 'Someone'} joined the team`,
      'member_left': `${data.performed_by_name || 'Someone'} left the team`,
      'member_role_changed': `${data.target_user_name || 'Member'} role changed to ${data.new_values?.role || 'unknown'}`,
      'member_invited': `${data.performed_by_name || 'Someone'} invited a new member`,
      'receipt_created': `${data.performed_by_name || 'Someone'} created a receipt`,
      'receipt_updated': `${data.performed_by_name || 'Someone'} updated a receipt`,
      'team_settings_updated': `${data.performed_by_name || 'Someone'} updated team settings`,
      'team_created': `Team was created`,
    };
    
    return titleMap[action] || `${action.replace('_', ' ')} activity`;
  };

  const getActivityDescription = (action: string, data: any): string => {
    const metadata = data.metadata || {};
    
    switch (action) {
      case 'member_role_changed':
        return `Role changed from ${data.old_values?.role || 'unknown'} to ${data.new_values?.role || 'unknown'}`;
      case 'receipt_created':
        return metadata.merchant ? `Receipt from ${metadata.merchant}` : 'New receipt created';
      case 'receipt_updated':
        return metadata.changes ? `Updated: ${Object.keys(metadata.changes).join(', ')}` : 'Receipt updated';
      case 'team_settings_updated':
        return data.new_values ? `Updated: ${Object.keys(data.new_values).join(', ')}` : 'Settings updated';
      default:
        return data.action_description || 'Activity occurred';
    }
  };

  const getActivityPriority = (action: string): 'low' | 'medium' | 'high' => {
    const highPriority = ['member_role_changed', 'team_settings_updated'];
    const lowPriority = ['receipt_created', 'receipt_updated'];
    
    if (highPriority.includes(action)) return 'high';
    if (lowPriority.includes(action)) return 'low';
    return 'medium';
  };

  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true;
    if (filter === 'member') return activity.type === 'member_activity';
    if (filter === 'team') return activity.type === 'team_event';
    if (filter === 'system') return activity.type === 'system_event';
    return true;
  });

  const handleMarkAllAsRead = () => {
    setActivities(prev => prev.map(activity => ({ ...activity, read: true })));
    setNewActivityCount(0);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-24 bg-gray-200 rounded animate-pulse" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Real-time Activity Feed
              {newActivityCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {newActivityCount} new
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              Recent team activities and member updates
              {isConnected && notificationConnected ? (
                <Wifi className="h-4 w-4 text-green-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-600" />
              )}
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            {newActivityCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
              >
                <Eye className="h-4 w-4 mr-2" />
                Mark All Read
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadActivities(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {showFilters && (
          <Tabs value={filter} onValueChange={(value: any) => setFilter(value)} className="mb-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="member">Members</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
              <TabsTrigger value="system">System</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <ScrollArea className="h-96">
          <div className="space-y-4">
            {filteredActivities.map((activity) => (
              <div 
                key={activity.id} 
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  activity.read ? 'bg-gray-50' : 'bg-white border-blue-200'
                }`}
              >
                {/* Activity Icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getActivityColor(activity.activity_type, activity.priority)}`}>
                  {getActivityIcon(activity.activity_type)}
                </div>
                
                {/* Activity Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{activity.title}</p>
                      {activity.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {activity.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {activity.type.replace('_', ' ')}
                        </Badge>
                        {activity.priority === 'high' && (
                          <Badge variant="destructive" className="text-xs">
                            High Priority
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {filteredActivities.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No activities found for the selected filter</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
