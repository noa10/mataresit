import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Receipt,
  Target,
  Calendar,
  Award,
  Brain,
  Clock
} from 'lucide-react';
import { MemberAnalytics, MemberPerformanceInsights } from '@/types/team';

interface MemberPerformanceChartProps {
  memberAnalytics: MemberAnalytics;
  performanceInsights: MemberPerformanceInsights | null;
  timeframe: string;
}

export function MemberPerformanceChart({ 
  memberAnalytics, 
  performanceInsights, 
  timeframe 
}: MemberPerformanceChartProps) {
  
  // Prepare performance data for charts
  const activityData = [
    { name: 'Total Activities', value: memberAnalytics.activity_stats.total_activities, color: '#3b82f6' },
    { name: 'Receipt Activities', value: memberAnalytics.activity_stats.receipt_activities, color: '#10b981' },
    { name: 'Team Activities', value: memberAnalytics.activity_stats.team_activities, color: '#f59e0b' }
  ];

  const engagementData = [
    { name: 'Receipts Created', value: memberAnalytics.engagement_metrics.receipts_created, max: 100 },
    { name: 'AI Processed', value: memberAnalytics.engagement_metrics.ai_processed_receipts, max: memberAnalytics.engagement_metrics.receipts_created || 1 },
    { name: 'Categories Used', value: memberAnalytics.engagement_metrics.categories_used, max: 20 },
    { name: 'Recent Receipts', value: memberAnalytics.engagement_metrics.recent_receipts, max: 50 }
  ];

  const performanceMetrics = [
    {
      label: 'Activity Consistency',
      value: memberAnalytics.performance_data.activity_consistency,
      max: 100,
      color: '#3b82f6'
    },
    {
      label: 'AI Adoption Rate',
      value: memberAnalytics.engagement_metrics.ai_adoption_rate,
      max: 100,
      color: '#10b981'
    }
  ];

  // Prepare trends data if performance insights are available
  const trendsData = performanceInsights?.engagement_trends.map(trend => ({
    date: new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    receipts: trend.receipts,
    amount: trend.amount,
    categories: trend.categories
  })) || [];

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Activity className="h-4 w-4 text-gray-600" />;
  };

  const getChangeColor = (change: number): string => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Performance Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Activities</p>
                <p className="text-2xl font-bold">{memberAnalytics.activity_stats.total_activities}</p>
                <p className="text-xs text-muted-foreground">
                  {memberAnalytics.activity_stats.active_days} active days
                </p>
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Receipts Created</p>
                <p className="text-2xl font-bold">{memberAnalytics.engagement_metrics.receipts_created}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(memberAnalytics.engagement_metrics.total_amount_processed)} total
                </p>
              </div>
              <Receipt className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">AI Adoption</p>
                <p className="text-2xl font-bold">{Math.round(memberAnalytics.engagement_metrics.ai_adoption_rate)}%</p>
                <p className="text-xs text-muted-foreground">
                  {memberAnalytics.engagement_metrics.ai_processed_receipts} AI processed
                </p>
              </div>
              <Brain className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Interval</p>
                <p className="text-2xl font-bold">{Math.round(memberAnalytics.activity_stats.avg_activity_interval_minutes)}m</p>
                <p className="text-xs text-muted-foreground">
                  Between activities
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Insights Cards */}
      {performanceInsights && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Period Comparison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Receipts</span>
                <div className="flex items-center gap-2">
                  {getChangeIcon(performanceInsights.changes.receipts_change)}
                  <span className={`text-sm font-medium ${getChangeColor(performanceInsights.changes.receipts_change)}`}>
                    {performanceInsights.changes.receipts_change > 0 ? '+' : ''}{performanceInsights.changes.receipts_change}
                    ({performanceInsights.changes.receipts_change_percent > 0 ? '+' : ''}{Math.round(performanceInsights.changes.receipts_change_percent)}%)
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Amount</span>
                <div className="flex items-center gap-2">
                  {getChangeIcon(performanceInsights.changes.amount_change)}
                  <span className={`text-sm font-medium ${getChangeColor(performanceInsights.changes.amount_change)}`}>
                    {formatCurrency(performanceInsights.changes.amount_change)}
                    ({performanceInsights.changes.amount_change_percent > 0 ? '+' : ''}{Math.round(performanceInsights.changes.amount_change_percent)}%)
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Categories</span>
                <div className="flex items-center gap-2">
                  {getChangeIcon(performanceInsights.changes.categories_change)}
                  <span className={`text-sm font-medium ${getChangeColor(performanceInsights.changes.categories_change)}`}>
                    {performanceInsights.changes.categories_change > 0 ? '+' : ''}{performanceInsights.changes.categories_change}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Team Comparison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Receipts vs Avg</span>
                <span className={`text-sm font-medium ${performanceInsights.team_comparison.receipts_vs_avg >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {performanceInsights.team_comparison.receipts_vs_avg > 0 ? '+' : ''}{Math.round(performanceInsights.team_comparison.receipts_vs_avg)}%
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Amount vs Avg</span>
                <span className={`text-sm font-medium ${performanceInsights.team_comparison.amount_vs_avg >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {performanceInsights.team_comparison.amount_vs_avg > 0 ? '+' : ''}{Math.round(performanceInsights.team_comparison.amount_vs_avg)}%
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Categories vs Avg</span>
                <span className={`text-sm font-medium ${performanceInsights.team_comparison.categories_vs_avg >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {performanceInsights.team_comparison.categories_vs_avg > 0 ? '+' : ''}{Math.round(performanceInsights.team_comparison.categories_vs_avg)}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Current Period</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Receipts</span>
                <span className="text-sm font-medium">{performanceInsights.current_period.receipts}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Amount</span>
                <span className="text-sm font-medium">{formatCurrency(performanceInsights.current_period.amount)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Days</span>
                <span className="text-sm font-medium">{performanceInsights.current_period.active_days}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Activity Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Breakdown</CardTitle>
                <CardDescription>
                  Distribution of member activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Engagement Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Engagement Metrics</CardTitle>
                <CardDescription>
                  Key engagement indicators
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {engagementData.map((metric, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{metric.name}</span>
                      <span className="font-medium">{metric.value}</span>
                    </div>
                    <Progress 
                      value={(metric.value / metric.max) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Indicators</CardTitle>
              <CardDescription>
                Key performance metrics and consistency scores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {performanceMetrics.map((metric, index) => (
                  <div key={index} className="text-center">
                    <div className="h-40 mb-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart 
                          cx="50%" 
                          cy="50%" 
                          innerRadius="60%" 
                          outerRadius="90%" 
                          data={[{ value: metric.value, max: metric.max }]}
                        >
                          <RadialBar 
                            dataKey="value" 
                            cornerRadius={10} 
                            fill={metric.color}
                          />
                        </RadialBarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-2xl font-bold" style={{ color: metric.color }}>
                      {Math.round(metric.value)}%
                    </div>
                    <div className="text-sm text-muted-foreground">{metric.label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          {performanceInsights && trendsData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Performance Trends</CardTitle>
                <CardDescription>
                  Activity trends over the selected period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-background border rounded-lg p-3 shadow-lg">
                                <p className="font-medium">{label}</p>
                                {payload.map((entry, index) => (
                                  <p key={index} style={{ color: entry.color }}>
                                    {entry.name}: {entry.name === 'amount' ? formatCurrency(entry.value as number) : entry.value}
                                  </p>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="receipts"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Receipts"
                      />
                      <Line
                        type="monotone"
                        dataKey="categories"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Categories"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No trend data available for the selected period</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
