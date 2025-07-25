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
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Activity, 
  Receipt,
  Award,
  Target
} from 'lucide-react';
import { TeamEngagementMetrics } from '@/types/team';

interface TeamEngagementChartProps {
  engagementData: TeamEngagementMetrics;
  timeframe: string;
}

export function TeamEngagementChart({ engagementData, timeframe }: TeamEngagementChartProps) {
  // Prepare data for charts
  const engagementDistributionData = [
    { name: 'Very Active', value: engagementData.team_overview.very_active_members, color: '#10b981' },
    { name: 'Active', value: engagementData.team_overview.active_members, color: '#3b82f6' },
    { name: 'Moderate', value: engagementData.team_overview.moderate_members, color: '#f59e0b' },
    { name: 'Inactive', value: engagementData.team_overview.inactive_members, color: '#ef4444' }
  ];

  const trendsData = engagementData.engagement_trends.map(trend => ({
    date: new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    activeMembers: trend.active_members,
    activities: trend.activities,
    receipts: trend.receipts,
    amount: trend.amount
  }));

  const topPerformersData = engagementData.top_performers.slice(0, 10).map(performer => ({
    name: performer.full_name.split(' ').map(n => n[0]).join(''),
    fullName: performer.full_name,
    activityScore: performer.activity_score,
    receipts: performer.receipt_count,
    amount: performer.total_amount,
    role: performer.role,
    engagementLevel: performer.engagement_level
  }));

  const getEngagementColor = (level: string): string => {
    switch (level) {
      case 'high': return '#10b981';
      case 'medium': return '#f59e0b';
      case 'low': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Team Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Team Health Overview
          </CardTitle>
          <CardDescription>
            Overall team engagement and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Health Score</span>
                <span className="text-2xl font-bold text-green-600">
                  {Math.round(engagementData.team_health_score)}%
                </span>
              </div>
              <Progress value={engagementData.team_health_score} className="h-2" />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Participation Rate</span>
                <span className="text-2xl font-bold text-blue-600">
                  {Math.round(engagementData.activity_metrics.contributor_participation_rate)}%
                </span>
              </div>
              <Progress value={engagementData.activity_metrics.contributor_participation_rate} className="h-2" />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">AI Adoption</span>
                <span className="text-2xl font-bold text-purple-600">
                  {Math.round(engagementData.receipt_metrics.ai_adoption_rate)}%
                </span>
              </div>
              <Progress value={engagementData.receipt_metrics.ai_adoption_rate} className="h-2" />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Avg Tenure</span>
                <span className="text-2xl font-bold text-orange-600">
                  {Math.round(engagementData.team_overview.avg_member_tenure_days)}d
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Tabs */}
      <Tabs defaultValue="engagement" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="performers">Top Performers</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="engagement" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Engagement Distribution Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Member Engagement Distribution</CardTitle>
                <CardDescription>
                  Breakdown of member activity levels
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={engagementDistributionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {engagementDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Legend */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {engagementDistributionData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm">{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Activity Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Metrics</CardTitle>
                <CardDescription>
                  Recent team activity summary
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <Activity className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-blue-600">
                      {engagementData.activity_metrics.recent_activities}
                    </div>
                    <div className="text-sm text-muted-foreground">Recent Activities</div>
                  </div>
                  
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <Users className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-green-600">
                      {engagementData.activity_metrics.recent_contributors}
                    </div>
                    <div className="text-sm text-muted-foreground">Active Contributors</div>
                  </div>
                  
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <Receipt className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-purple-600">
                      {engagementData.receipt_metrics.recent_receipts}
                    </div>
                    <div className="text-sm text-muted-foreground">Recent Receipts</div>
                  </div>
                  
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <Award className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-orange-600">
                      {formatCurrency(engagementData.receipt_metrics.recent_amount)}
                    </div>
                    <div className="text-sm text-muted-foreground">Recent Amount</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Trends</CardTitle>
              <CardDescription>
                Team activity and engagement over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendsData}>
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
                                  {entry.name}: {entry.value}
                                </p>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="activeMembers"
                      stackId="1"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.6}
                      name="Active Members"
                    />
                    <Area
                      type="monotone"
                      dataKey="activities"
                      stackId="2"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.6}
                      name="Activities"
                    />
                    <Area
                      type="monotone"
                      dataKey="receipts"
                      stackId="3"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                      fillOpacity={0.6}
                      name="Receipts"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Performers</CardTitle>
              <CardDescription>
                Most active and engaged team members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topPerformersData.map((performer, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="font-medium text-blue-600">{performer.name}</span>
                      </div>
                      <div>
                        <div className="font-medium">{performer.fullName}</div>
                        <div className="text-sm text-muted-foreground capitalize">{performer.role}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-sm font-medium">{performer.activityScore}</div>
                        <div className="text-xs text-muted-foreground">Score</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium">{performer.receipts}</div>
                        <div className="text-xs text-muted-foreground">Receipts</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium">{formatCurrency(performer.amount)}</div>
                        <div className="text-xs text-muted-foreground">Amount</div>
                      </div>
                      <Badge 
                        style={{ 
                          backgroundColor: getEngagementColor(performer.engagementLevel),
                          color: 'white'
                        }}
                      >
                        {performer.engagementLevel}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Insights</CardTitle>
              <CardDescription>
                AI-generated insights and recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {engagementData.insights.map((insight, index) => (
                  <div key={index} className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
                    <p className="text-sm">{insight}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
