import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Database, 
  Clock, 
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Zap,
  BarChart3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { optimizedTeamAnalyticsService } from '@/services/optimizedTeamAnalyticsService';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface PerformanceMetric {
  function_name: string;
  avg_execution_time_ms: number;
  max_execution_time_ms: number;
  total_queries: number;
  cache_hit_rate: number;
  performance_grade: string;
}

interface PerformanceRecommendation {
  recommendation_type: string;
  priority: string;
  description: string;
  action_required: string;
  estimated_impact: string;
}

export function MemberAnalyticsPerformanceDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [recommendations, setRecommendations] = useState<PerformanceRecommendation[]>([]);
  const [viewFreshness, setViewFreshness] = useState<any>(null);
  const [analyticsMetrics, setAnalyticsMetrics] = useState<any[]>([]);
  
  const { toast } = useToast();

  const loadDashboardData = async (showToast = false) => {
    try {
      setRefreshing(true);
      
      const [
        performanceResponse,
        recommendationsResponse,
        freshnessResponse,
        metricsResponse
      ] = await Promise.all([
        optimizedTeamAnalyticsService.getPerformanceAnalysis(24),
        optimizedTeamAnalyticsService.getPerformanceRecommendations(),
        optimizedTeamAnalyticsService.checkViewFreshness(),
        optimizedTeamAnalyticsService.getAnalyticsMetrics(undefined, undefined, 24)
      ]);

      if (performanceResponse.success) {
        setPerformanceMetrics(performanceResponse.data);
      }

      if (recommendationsResponse.success) {
        setRecommendations(recommendationsResponse.data);
      }

      if (freshnessResponse.success) {
        setViewFreshness(freshnessResponse.data);
      }

      if (metricsResponse.success) {
        setAnalyticsMetrics(metricsResponse.data);
      }

      if (showToast) {
        toast({
          title: "Dashboard Updated",
          description: "Performance data has been refreshed.",
        });
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Error Loading Data",
        description: "Failed to load performance dashboard data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefreshViews = async () => {
    try {
      setRefreshing(true);
      
      const response = await optimizedTeamAnalyticsService.refreshAnalyticsViews();
      
      if (response.success) {
        toast({
          title: "Views Refreshed",
          description: "Materialized views have been refreshed successfully.",
        });
        
        // Reload dashboard data
        await loadDashboardData();
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh materialized views.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const getGradeColor = (grade: string): string => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100';
      case 'B': return 'text-blue-600 bg-blue-100';
      case 'C': return 'text-yellow-600 bg-yellow-100';
      case 'D': return 'text-orange-600 bg-orange-100';
      case 'F': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority.toLowerCase()) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatExecutionTime = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Member Analytics Performance</h2>
          <p className="text-muted-foreground">
            Database performance monitoring and optimization dashboard
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
          
          <Button
            onClick={handleRefreshViews}
            disabled={refreshing}
          >
            <Database className="h-4 w-4 mr-2" />
            Refresh Views
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Query Time</p>
                <p className="text-2xl font-bold">
                  {performanceMetrics.length > 0 
                    ? formatExecutionTime(performanceMetrics.reduce((sum, m) => sum + m.avg_execution_time_ms, 0) / performanceMetrics.length)
                    : '0ms'
                  }
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cache Hit Rate</p>
                <p className="text-2xl font-bold">
                  {performanceMetrics.length > 0 
                    ? `${Math.round(performanceMetrics.reduce((sum, m) => sum + m.cache_hit_rate, 0) / performanceMetrics.length)}%`
                    : '0%'
                  }
                </p>
              </div>
              <Zap className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Queries</p>
                <p className="text-2xl font-bold">
                  {performanceMetrics.reduce((sum, m) => sum + m.total_queries, 0)}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">View Freshness</p>
                <p className="text-2xl font-bold">
                  {viewFreshness?.memberActivityView?.needsRefresh || viewFreshness?.teamEngagementView?.needsRefresh 
                    ? 'Stale' 
                    : 'Fresh'
                  }
                </p>
              </div>
              {viewFreshness?.memberActivityView?.needsRefresh || viewFreshness?.teamEngagementView?.needsRefresh ? (
                <AlertTriangle className="h-8 w-8 text-orange-600" />
              ) : (
                <CheckCircle className="h-8 w-8 text-green-600" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="freshness">View Status</TabsTrigger>
          <TabsTrigger value="metrics">Query Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Function Performance Analysis</CardTitle>
              <CardDescription>
                Performance metrics for analytics functions over the last 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {performanceMetrics.map((metric, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{metric.function_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {metric.total_queries} queries • {Math.round(metric.cache_hit_rate)}% cache hit rate
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-sm font-medium">
                          {formatExecutionTime(metric.avg_execution_time_ms)}
                        </div>
                        <div className="text-xs text-muted-foreground">Avg Time</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-sm font-medium">
                          {formatExecutionTime(metric.max_execution_time_ms)}
                        </div>
                        <div className="text-xs text-muted-foreground">Max Time</div>
                      </div>
                      
                      <Badge className={getGradeColor(metric.performance_grade)}>
                        Grade {metric.performance_grade}
                      </Badge>
                    </div>
                  </div>
                ))}
                
                {performanceMetrics.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No performance data available for the last 24 hours
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Recommendations</CardTitle>
              <CardDescription>
                Automated recommendations for optimizing analytics performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recommendations.map((rec, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={getPriorityColor(rec.priority)}>
                          {rec.priority} priority
                        </Badge>
                        <span className="font-medium capitalize">{rec.recommendation_type}</span>
                      </div>
                      <Badge variant="outline">
                        {rec.estimated_impact} impact
                      </Badge>
                    </div>
                    
                    <p className="text-sm mb-2">{rec.description}</p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Action:</strong> {rec.action_required}
                    </p>
                  </div>
                ))}
                
                {recommendations.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No recommendations available - performance is optimal
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="freshness" className="space-y-4">
          {viewFreshness && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Member Activity View</CardTitle>
                  <CardDescription>
                    Status of the member activity summary materialized view
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Status</span>
                      <Badge className={viewFreshness.memberActivityView.needsRefresh ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}>
                        {viewFreshness.memberActivityView.needsRefresh ? 'Needs Refresh' : 'Fresh'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Last Updated</span>
                      <span className="text-sm text-muted-foreground">
                        {viewFreshness.memberActivityView.lastUpdated !== 'never' 
                          ? new Date(viewFreshness.memberActivityView.lastUpdated).toLocaleString()
                          : 'Never'
                        }
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Age</span>
                      <span className="text-sm text-muted-foreground">
                        {viewFreshness.memberActivityView.ageMinutes === Infinity 
                          ? 'Unknown' 
                          : `${viewFreshness.memberActivityView.ageMinutes} minutes`
                        }
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Team Engagement View</CardTitle>
                  <CardDescription>
                    Status of the team engagement metrics materialized view
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Status</span>
                      <Badge className={viewFreshness.teamEngagementView.needsRefresh ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}>
                        {viewFreshness.teamEngagementView.needsRefresh ? 'Needs Refresh' : 'Fresh'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Last Updated</span>
                      <span className="text-sm text-muted-foreground">
                        {viewFreshness.teamEngagementView.lastUpdated !== 'never' 
                          ? new Date(viewFreshness.teamEngagementView.lastUpdated).toLocaleString()
                          : 'Never'
                        }
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Age</span>
                      <span className="text-sm text-muted-foreground">
                        {viewFreshness.teamEngagementView.ageMinutes === Infinity 
                          ? 'Unknown' 
                          : `${viewFreshness.teamEngagementView.ageMinutes} minutes`
                        }
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Query Execution Metrics</CardTitle>
              <CardDescription>
                Detailed execution metrics for analytics queries
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsMetrics.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsMetrics.slice(0, 50)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="created_at" 
                        tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                        fontSize={12}
                      />
                      <YAxis fontSize={12} />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleString()}
                        formatter={(value, name) => [
                          name === 'execution_time_ms' ? `${value}ms` : value,
                          name
                        ]}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="execution_time_ms"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="Execution Time (ms)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No query metrics available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
