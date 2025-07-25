import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  Receipt, 
  Users, 
  Settings, 
  Clock,
  Calendar,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { teamService } from '@/services/teamService';
import { MemberActivityTimeline as ActivityTimelineType } from '@/types/team';
import { formatDistanceToNow } from 'date-fns';

interface MemberActivityTimelineProps {
  teamId: string;
  memberId: string;
  limit?: number;
}

export function MemberActivityTimeline({ 
  teamId, 
  memberId, 
  limit = 50 
}: MemberActivityTimelineProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeline, setTimeline] = useState<ActivityTimelineType | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  
  const { toast } = useToast();

  const loadTimeline = async (showToast = false) => {
    try {
      setRefreshing(true);
      
      const response = await teamService.getMemberActivityTimeline(teamId, {
        userId: memberId,
        limit,
        activityTypes: filterType === 'all' ? undefined : [filterType]
      });

      if (response.success) {
        setTimeline(response.data);
        
        if (showToast) {
          toast({
            title: "Timeline Updated",
            description: "Activity timeline has been refreshed.",
          });
        }
      } else {
        throw new Error(response.error || 'Failed to load timeline');
      }
    } catch (error) {
      console.error('Error loading timeline:', error);
      toast({
        title: "Error Loading Timeline",
        description: "Failed to load activity timeline. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTimeline();
  }, [teamId, memberId, limit, filterType]);

  const handleRefresh = () => {
    loadTimeline(true);
  };

  const toggleExpanded = (activityId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(activityId)) {
      newExpanded.delete(activityId);
    } else {
      newExpanded.add(activityId);
    }
    setExpandedItems(newExpanded);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'receipt_created':
      case 'receipt_updated':
      case 'receipt_deleted':
        return <Receipt className="h-4 w-4" />;
      case 'team_joined':
      case 'team_left':
      case 'role_updated':
        return <Users className="h-4 w-4" />;
      case 'settings_updated':
      case 'profile_updated':
        return <Settings className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string): string => {
    switch (type) {
      case 'receipt_created':
        return 'text-green-600 bg-green-100';
      case 'receipt_updated':
        return 'text-blue-600 bg-blue-100';
      case 'receipt_deleted':
        return 'text-red-600 bg-red-100';
      case 'team_joined':
        return 'text-purple-600 bg-purple-100';
      case 'team_left':
        return 'text-orange-600 bg-orange-100';
      case 'role_updated':
        return 'text-indigo-600 bg-indigo-100';
      case 'settings_updated':
      case 'profile_updated':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-blue-600 bg-blue-100';
    }
  };

  const getActivityTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'receipt_created': 'Receipt Created',
      'receipt_updated': 'Receipt Updated',
      'receipt_deleted': 'Receipt Deleted',
      'team_joined': 'Joined Team',
      'team_left': 'Left Team',
      'role_updated': 'Role Updated',
      'settings_updated': 'Settings Updated',
      'profile_updated': 'Profile Updated'
    };
    return labels[type] || type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatActivityDetails = (activity: any): string => {
    if (activity.details) {
      if (typeof activity.details === 'string') {
        return activity.details;
      }
      if (typeof activity.details === 'object') {
        return Object.entries(activity.details)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
      }
    }
    return '';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
            </div>
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

  if (!timeline) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No activity timeline available</p>
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
              <Clock className="h-5 w-5" />
              Activity Timeline
            </CardTitle>
            <CardDescription>
              Recent activities for {timeline.member_info.full_name}
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilterType(filterType === 'all' ? 'receipt_created' : 'all')}
            >
              <Filter className="h-4 w-4 mr-2" />
              {filterType === 'all' ? 'All' : 'Receipts'}
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
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Timeline Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {timeline.summary.total_activities}
            </div>
            <div className="text-sm text-muted-foreground">Total Activities</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {timeline.summary.receipt_activities}
            </div>
            <div className="text-sm text-muted-foreground">Receipt Activities</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {timeline.summary.team_activities}
            </div>
            <div className="text-sm text-muted-foreground">Team Activities</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {timeline.summary.active_days}
            </div>
            <div className="text-sm text-muted-foreground">Active Days</div>
          </div>
        </div>

        {/* Activity Timeline */}
        <ScrollArea className="h-96">
          <div className="space-y-4">
            {timeline.activities.map((activity, index) => (
              <div key={activity.id} className="flex items-start gap-3">
                {/* Activity Icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getActivityColor(activity.activity_type)}`}>
                  {getActivityIcon(activity.activity_type)}
                </div>
                
                {/* Activity Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {getActivityTypeLabel(activity.activity_type)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {activity.activity_type}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  
                  {activity.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {activity.description}
                    </p>
                  )}
                  
                  {/* Expandable Details */}
                  {(activity.details || activity.metadata) && (
                    <div className="mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(activity.id)}
                        className="h-6 px-2 text-xs"
                      >
                        {expandedItems.has(activity.id) ? (
                          <>
                            <ChevronUp className="h-3 w-3 mr-1" />
                            Hide Details
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3 mr-1" />
                            Show Details
                          </>
                        )}
                      </Button>
                      
                      {expandedItems.has(activity.id) && (
                        <div className="mt-2 p-3 bg-gray-50 rounded text-xs">
                          {activity.details && (
                            <div className="mb-2">
                              <span className="font-medium">Details:</span>
                              <pre className="mt-1 whitespace-pre-wrap">
                                {formatActivityDetails(activity)}
                              </pre>
                            </div>
                          )}
                          
                          {activity.metadata && (
                            <div>
                              <span className="font-medium">Metadata:</span>
                              <pre className="mt-1 whitespace-pre-wrap">
                                {JSON.stringify(activity.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {timeline.activities.length === 0 && (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No activities found for the selected filter</p>
              </div>
            )}
          </div>
        </ScrollArea>
        
        {/* Load More */}
        {timeline.activities.length >= limit && (
          <div className="text-center mt-4">
            <Button variant="outline" size="sm">
              Load More Activities
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
