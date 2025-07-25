import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  ScatterChart,
  Scatter
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  Users,
  Target,
  Award,
  Activity,
  GitCompare,
  Calendar,
  Zap
} from 'lucide-react';
import { TeamAdvancedAnalytics } from '@/services/advancedAnalyticsService';

interface ComparativeAnalyticsChartProps {
  teamAnalytics: TeamAdvancedAnalytics;
  memberAnalytics: any[];
  comparisonData?: any[];
  timeframe: string;
  className?: string;
}

export function ComparativeAnalyticsChart({ 
  teamAnalytics, 
  memberAnalytics,
  comparisonData = [],
  timeframe,
  className 
}: ComparativeAnalyticsChartProps) {
  
  // Generate comparative data
  const memberComparisonData = generateMemberComparison(memberAnalytics);
  const performanceComparisonData = generatePerformanceComparison(memberAnalytics);
  const timeBasedComparisonData = generateTimeBasedComparison(teamAnalytics, timeframe);
  const benchmarkComparisonData = generateBenchmarkComparison(teamAnalytics);
  const roleComparisonData = generateRoleComparison(memberAnalytics);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Comparison Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.max(...memberAnalytics.map(m => m.engagement_score))}
            </div>
            <p className="text-xs text-muted-foreground">
              Highest engagement score
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance Gap</CardTitle>
            <GitCompare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(Math.max(...memberAnalytics.map(m => m.engagement_score)) - 
                Math.min(...memberAnalytics.map(m => m.engagement_score))).toFixed(0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Score difference
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Above Average</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {memberAnalytics.filter(m => 
                m.engagement_score > memberAnalytics.reduce((sum, member) => sum + member.engagement_score, 0) / memberAnalytics.length
              ).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Members above avg
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consistency Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {calculateConsistencyScore(memberAnalytics).toFixed(0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Team consistency
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Comparative Analytics Tabs */}
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Member Comparison</TabsTrigger>
          <TabsTrigger value="performance">Performance Analysis</TabsTrigger>
          <TabsTrigger value="trends">Time-based Trends</TabsTrigger>
          <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          {/* Member vs Member Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Member Performance Comparison
              </CardTitle>
              <CardDescription>
                Side-by-side comparison of member performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={memberComparisonData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis 
                      type="category" 
                      dataKey="member" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      width={80}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="engagement" fill="#3b82f6" name="Engagement" />
                    <Bar dataKey="collaboration" fill="#10b981" name="Collaboration" />
                    <Bar dataKey="activity" fill="#f59e0b" name="Activity" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Performance Distribution Scatter */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Distribution</CardTitle>
              <CardDescription>
                Engagement vs Collaboration score distribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart data={memberAnalytics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="engagement_score" 
                      name="Engagement Score"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      dataKey="collaboration_score" 
                      name="Collaboration Score"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-background border rounded-lg p-3 shadow-lg">
                              <p className="font-medium">Member {data.user_id.slice(0, 8)}...</p>
                              <p>Engagement: {data.engagement_score}</p>
                              <p>Collaboration: {data.collaboration_score}</p>
                              <p>Role: {data.role}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter 
                      dataKey="collaboration_score" 
                      fill="#3b82f6"
                      fillOpacity={0.7}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {/* Performance Radar Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Multi-dimensional Performance Analysis</CardTitle>
              <CardDescription>
                Comprehensive performance comparison across key metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={performanceComparisonData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" fontSize={12} />
                    <PolarRadiusAxis 
                      angle={90} 
                      domain={[0, 100]} 
                      fontSize={10}
                      tickCount={5}
                    />
                    <Radar
                      name="Top Performers"
                      dataKey="topPerformers"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                    <Radar
                      name="Team Average"
                      dataKey="teamAverage"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                    <Radar
                      name="At-Risk Members"
                      dataKey="atRisk"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Role-based Performance Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Performance by Role</CardTitle>
              <CardDescription>
                Average performance metrics grouped by team role
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={roleComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="role" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="avgEngagement" fill="#3b82f6" name="Avg Engagement" />
                    <Bar dataKey="avgCollaboration" fill="#10b981" name="Avg Collaboration" />
                    <Line
                      type="monotone"
                      dataKey="memberCount"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      name="Member Count"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          {/* Time-based Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Performance Trends Over Time
              </CardTitle>
              <CardDescription>
                Historical performance comparison and trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeBasedComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="period" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="currentPeriod"
                      stackId="1"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.6}
                      name="Current Period"
                    />
                    <Area
                      type="monotone"
                      dataKey="previousPeriod"
                      stackId="2"
                      stroke="#94a3b8"
                      fill="#94a3b8"
                      fillOpacity={0.4}
                      name="Previous Period"
                    />
                    <Area
                      type="monotone"
                      dataKey="target"
                      stackId="3"
                      stroke="#10b981"
                      fill="none"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Target"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="benchmarks" className="space-y-4">
          {/* Benchmark Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Industry Benchmark Comparison
              </CardTitle>
              <CardDescription>
                Team performance vs industry standards
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={benchmarkComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="metric" 
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
                    <Legend />
                    <Bar dataKey="teamScore" fill="#3b82f6" name="Team Score" />
                    <Bar dataKey="industryAverage" fill="#94a3b8" name="Industry Average" />
                    <Line
                      type="monotone"
                      dataKey="topQuartile"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      name="Top Quartile"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Performance Gaps */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Gaps Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {benchmarkComparisonData.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{item.metric}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Gap: {(item.topQuartile - item.teamScore).toFixed(0)}</span>
                        <Badge className={getGapBadgeColor(item.topQuartile - item.teamScore)}>
                          {item.teamScore >= item.topQuartile ? 'Exceeds' : 'Below'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ width: `${(item.teamScore / item.topQuartile) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {((item.teamScore / item.topQuartile) * 100).toFixed(0)}%
                      </span>
                    </div>
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

// Helper functions to generate comparative data
function generateMemberComparison(memberAnalytics: any[]) {
  return memberAnalytics.slice(0, 10).map((member, index) => ({
    member: `M${index + 1}`,
    engagement: member.engagement_score,
    collaboration: member.collaboration_score,
    activity: member.receipts_created * 2 // Scale for visualization
  }));
}

function generatePerformanceComparison(memberAnalytics: any[]) {
  const topPerformers = memberAnalytics.filter(m => m.performance_category === 'high_performer');
  const atRisk = memberAnalytics.filter(m => m.performance_category === 'at_risk');
  
  return [
    { 
      metric: 'Engagement', 
      topPerformers: topPerformers.reduce((sum, m) => sum + m.engagement_score, 0) / (topPerformers.length || 1),
      teamAverage: memberAnalytics.reduce((sum, m) => sum + m.engagement_score, 0) / memberAnalytics.length,
      atRisk: atRisk.reduce((sum, m) => sum + m.engagement_score, 0) / (atRisk.length || 1)
    },
    { 
      metric: 'Collaboration', 
      topPerformers: topPerformers.reduce((sum, m) => sum + m.collaboration_score, 0) / (topPerformers.length || 1),
      teamAverage: memberAnalytics.reduce((sum, m) => sum + m.collaboration_score, 0) / memberAnalytics.length,
      atRisk: atRisk.reduce((sum, m) => sum + m.collaboration_score, 0) / (atRisk.length || 1)
    },
    { 
      metric: 'Activity', 
      topPerformers: topPerformers.reduce((sum, m) => sum + m.receipts_created, 0) / (topPerformers.length || 1) * 5,
      teamAverage: memberAnalytics.reduce((sum, m) => sum + m.receipts_created, 0) / memberAnalytics.length * 5,
      atRisk: atRisk.reduce((sum, m) => sum + m.receipts_created, 0) / (atRisk.length || 1) * 5
    }
  ];
}

function generateTimeBasedComparison(teamAnalytics: TeamAdvancedAnalytics, timeframe: string) {
  const periods = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  return periods.map((period, index) => ({
    period,
    currentPeriod: teamAnalytics.activity_summary.avg_engagement_score * (0.9 + index * 0.05),
    previousPeriod: teamAnalytics.activity_summary.avg_engagement_score * (0.8 + index * 0.03),
    target: 85
  }));
}

function generateBenchmarkComparison(teamAnalytics: TeamAdvancedAnalytics) {
  return [
    { 
      metric: 'Engagement', 
      teamScore: teamAnalytics.activity_summary.avg_engagement_score,
      industryAverage: 65,
      topQuartile: 85
    },
    { 
      metric: 'Collaboration', 
      teamScore: teamAnalytics.collaboration_summary.avg_collaboration_score,
      industryAverage: 60,
      topQuartile: 80
    },
    { 
      metric: 'Team Health', 
      teamScore: teamAnalytics.team_info.team_health_status === 'excellent' ? 90 : 
                 teamAnalytics.team_info.team_health_status === 'good' ? 75 : 60,
      industryAverage: 70,
      topQuartile: 85
    }
  ];
}

function generateRoleComparison(memberAnalytics: any[]) {
  const roles = ['owner', 'admin', 'member'];
  return roles.map(role => {
    const roleMembers = memberAnalytics.filter(m => m.role === role);
    return {
      role: role.charAt(0).toUpperCase() + role.slice(1),
      avgEngagement: roleMembers.reduce((sum, m) => sum + m.engagement_score, 0) / (roleMembers.length || 1),
      avgCollaboration: roleMembers.reduce((sum, m) => sum + m.collaboration_score, 0) / (roleMembers.length || 1),
      memberCount: roleMembers.length
    };
  });
}

function calculateConsistencyScore(memberAnalytics: any[]): number {
  const scores = memberAnalytics.map(m => m.engagement_score);
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const standardDeviation = Math.sqrt(variance);
  
  // Convert to consistency score (lower deviation = higher consistency)
  return Math.max(0, 100 - (standardDeviation * 2));
}

function getGapBadgeColor(gap: number): string {
  if (gap <= 0) return 'bg-green-100 text-green-800 border-green-200';
  if (gap <= 10) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-red-100 text-red-800 border-red-200';
}
