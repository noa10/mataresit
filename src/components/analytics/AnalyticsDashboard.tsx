import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  MessageSquare, 
  Search, 
  Mouse,
  Brain,
  Clock,
  Target,
  Lightbulb,
  Download,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyticsService, UserAnalytics, UsageStatistics, PersonalizedInsights } from '@/services/analyticsService';
import { InteractionTrendsChart } from './InteractionTrendsChart';
import { FeatureUsageChart } from './FeatureUsageChart';
import { ProductivityInsights } from './ProductivityInsights';
import { PersonalizedRecommendations } from './PersonalizedRecommendations';

interface AnalyticsDashboardProps {
  className?: string;
}

export function AnalyticsDashboard({ className }: AnalyticsDashboardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStatistics | null>(null);
  const [insights, setInsights] = useState<PersonalizedInsights | null>(null);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'quarter'>('month');

  const loadAnalyticsData = async (showToast = false) => {
    try {
      setRefreshing(true);
      
      const [analyticsData, statsData, insightsData] = await Promise.all([
        analyticsService.getUserAnalytics(timeframe),
        analyticsService.getUsageStatistics(timeframe === 'week' ? 'week' : 'month'),
        analyticsService.getPersonalizedInsights()
      ]);

      setAnalytics(analyticsData);
      setUsageStats(statsData);
      setInsights(insightsData);

      if (showToast) {
        toast({
          title: "Analytics Updated",
          description: "Your analytics data has been refreshed.",
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

  useEffect(() => {
    loadAnalyticsData();
  }, [timeframe]);

  const handleExportData = async () => {
    try {
      const exportData = await analyticsService.exportAnalyticsData('json');
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mataresit-analytics-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: "Your analytics data has been exported successfully.",
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export analytics data. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading analytics...</span>
        </div>
      </div>
    );
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'batch_processor': return <Target className="h-4 w-4" />;
      case 'power_searcher': return <Search className="h-4 w-4" />;
      case 'conversational': return <MessageSquare className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'high': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            Insights into your receipt management patterns and productivity
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Tabs value={timeframe} onValueChange={(value) => setTimeframe(value as any)}>
            <TabsList>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="quarter">Quarter</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAnalyticsData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Interactions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalInteractions || 0}</div>
            <p className="text-xs text-muted-foreground">
              {usageStats?.trends.interactionTrend === 'increasing' ? (
                <span className="text-green-600 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Increasing
                </span>
              ) : usageStats?.trends.interactionTrend === 'decreasing' ? (
                <span className="text-red-600 flex items-center">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  Decreasing
                </span>
              ) : (
                <span className="text-blue-600">Stable</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chat Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.interactionsByType?.chat_message || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {insights?.chatPatterns.messageLength} messages
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Search Queries</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.interactionsByType?.search_query || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {insights?.searchPatterns.queryComplexity} complexity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement Score</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(usageStats?.trends.engagementScore || 0)}%
            </div>
            <Progress 
              value={usageStats?.trends.engagementScore || 0} 
              className="mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* User Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Management Style
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Receipt Processing</span>
                <Badge variant="secondary" className="flex items-center gap-1">
                  {getInsightIcon(analytics?.insights.receiptManagementStyle || '')}
                  {analytics?.insights.receiptManagementStyle?.replace('_', ' ') || 'Unknown'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Search Behavior</span>
                <Badge variant="secondary" className="flex items-center gap-1">
                  {getInsightIcon(analytics?.insights.searchBehavior || '')}
                  {analytics?.insights.searchBehavior?.replace('_', ' ') || 'Unknown'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Chat Engagement</span>
                <Badge variant="secondary" className="flex items-center gap-1">
                  {getInsightIcon(analytics?.insights.chatEngagement || '')}
                  {analytics?.insights.chatEngagement?.replace('_', ' ') || 'Unknown'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Activity Patterns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Most Active Hour</span>
                <Badge variant="outline">
                  {analytics?.patterns.mostActiveHour || 0}:00
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Most Active Day</span>
                <Badge variant="outline">
                  {analytics?.patterns.mostActiveDay || 'Unknown'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Avg Session</span>
                <Badge variant="outline">
                  {Math.round(analytics?.patterns.averageSessionDuration || 0)}min
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Efficiency Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-2">
              <div className="text-3xl font-bold">
                {analytics?.insights.efficiency === 'high' ? '85%' :
                 analytics?.insights.efficiency === 'medium' ? '65%' : '45%'}
              </div>
              <div className={`w-3 h-3 rounded-full mx-auto ${getInsightColor(analytics?.insights.efficiency || 'low')}`} />
              <p className="text-sm text-muted-foreground capitalize">
                {analytics?.insights.efficiency || 'Unknown'} efficiency
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="productivity">Productivity</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <InteractionTrendsChart timeframe={timeframe} />
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <FeatureUsageChart />
        </TabsContent>

        <TabsContent value="productivity" className="space-y-4">
          <ProductivityInsights />
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <PersonalizedRecommendations insights={insights} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
