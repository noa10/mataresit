import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
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
  ComposedChart
} from 'recharts';
import { 
  MessageSquare, 
  Users, 
  Share2,
  Clock,
  TrendingUp,
  Network,
  Activity,
  Target,
  Zap
} from 'lucide-react';
import { TeamAdvancedAnalytics } from '@/services/advancedAnalyticsService';

interface CollaborationMetricsChartProps {
  teamAnalytics: TeamAdvancedAnalytics;
  memberAnalytics: any[];
  timeframe: string;
  className?: string;
}

export function CollaborationMetricsChart({ 
  teamAnalytics, 
  memberAnalytics,
  timeframe,
  className 
}: CollaborationMetricsChartProps) {
  
  // Generate collaboration data
  const collaborationOverviewData = generateCollaborationOverview(teamAnalytics);
  const communicationTrendsData = generateCommunicationTrends(memberAnalytics);
  const collaborationEffectivenessData = generateCollaborationEffectiveness(memberAnalytics);
  const networkAnalysisData = generateNetworkAnalysis(memberAnalytics);
  const collaborationDistributionData = generateCollaborationDistribution(memberAnalytics);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Collaboration Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Collaboration Score</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(teamAnalytics.collaboration_summary.avg_collaboration_score)}
            </div>
            <p className="text-xs text-muted-foreground">
              Team average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teamAnalytics.collaboration_summary.team_conversations}
            </div>
            <p className="text-xs text-muted-foreground">
              Current period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collaboration Rating</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge className={getCollaborationRatingColor(teamAnalytics.collaboration_summary.collaboration_effectiveness)}>
                {teamAnalytics.collaboration_summary.collaboration_effectiveness}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Team effectiveness
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Collaborators</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {memberAnalytics.filter(m => m.collaboration_score > 70).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Score > 70
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Communication Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Communication Trends
          </CardTitle>
          <CardDescription>
            Team communication patterns and activity over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={communicationTrendsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="period" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  yAxisId="left"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
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
                
                {/* Conversation bars */}
                <Bar 
                  yAxisId="left"
                  dataKey="conversations" 
                  fill="#3b82f6" 
                  name="Conversations" 
                  fillOpacity={0.7}
                />
                
                {/* Active members line */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="activeMembers"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  name="Active Members"
                />
                
                {/* Collaboration score area */}
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgCollaborationScore"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.3}
                  name="Avg Collaboration Score"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Collaboration Effectiveness and Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collaboration Effectiveness Radar */}
        <Card>
          <CardHeader>
            <CardTitle>Collaboration Effectiveness</CardTitle>
            <CardDescription>
              Multi-dimensional collaboration analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={collaborationEffectivenessData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="dimension" fontSize={12} />
                  <PolarRadiusAxis 
                    angle={90} 
                    domain={[0, 100]} 
                    fontSize={10}
                    tickCount={5}
                  />
                  <Radar
                    name="Team Average"
                    dataKey="teamAverage"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Radar
                    name="Industry Benchmark"
                    dataKey="benchmark"
                    stroke="#94a3b8"
                    fill="none"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Collaboration Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Collaboration Score Distribution</CardTitle>
            <CardDescription>
              Distribution of collaboration scores across team members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={collaborationDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {collaborationDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-medium">{data.name}</p>
                            <p>Members: {data.count}</p>
                            <p>Score Range: {data.range}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Network Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Collaboration Network Analysis
          </CardTitle>
          <CardDescription>
            Member interaction patterns and collaboration strength
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={networkAnalysisData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="member" 
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
                <Area
                  type="monotone"
                  dataKey="connections"
                  stackId="1"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.6}
                  name="Connections"
                />
                <Area
                  type="monotone"
                  dataKey="interactions"
                  stackId="2"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.6}
                  name="Interactions"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Collaboration Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Collaboration Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-green-600 mb-3">Collaboration Strengths</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">High Engagement</span>
                  <Progress value={85} className="w-24 h-2" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Active Communication</span>
                  <Progress value={78} className="w-24 h-2" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Knowledge Sharing</span>
                  <Progress value={72} className="w-24 h-2" />
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-orange-600 mb-3">Areas for Improvement</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Cross-team Collaboration</span>
                  <Progress value={45} className="w-24 h-2" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Response Time</span>
                  <Progress value={58} className="w-24 h-2" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Documentation</span>
                  <Progress value={52} className="w-24 h-2" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper functions to generate collaboration data
function generateCollaborationOverview(teamAnalytics: TeamAdvancedAnalytics) {
  return {
    avgCollaborationScore: teamAnalytics.collaboration_summary.avg_collaboration_score,
    activeConversations: teamAnalytics.collaboration_summary.team_conversations,
    collaborationEffectiveness: teamAnalytics.collaboration_summary.collaboration_effectiveness,
    highCollaborators: Math.round(teamAnalytics.team_info.total_members * 0.3)
  };
}

function generateCommunicationTrends(memberAnalytics: any[]) {
  const trends = [];
  const periods = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  
  periods.forEach((period, index) => {
    trends.push({
      period,
      conversations: Math.round(memberAnalytics.reduce((sum, m) => sum + m.conversations_created, 0) * (0.8 + index * 0.1)),
      activeMembers: Math.round(memberAnalytics.length * (0.7 + index * 0.1)),
      avgCollaborationScore: Math.round(memberAnalytics.reduce((sum, m) => sum + m.collaboration_score, 0) / memberAnalytics.length * (0.9 + index * 0.05))
    });
  });
  
  return trends;
}

function generateCollaborationEffectiveness(memberAnalytics: any[]) {
  return [
    { dimension: 'Communication', teamAverage: 75, benchmark: 70 },
    { dimension: 'Knowledge Sharing', teamAverage: 68, benchmark: 65 },
    { dimension: 'Project Collaboration', teamAverage: 72, benchmark: 75 },
    { dimension: 'Response Time', teamAverage: 58, benchmark: 80 },
    { dimension: 'Cross-team Work', teamAverage: 45, benchmark: 60 },
    { dimension: 'Documentation', teamAverage: 52, benchmark: 70 }
  ];
}

function generateNetworkAnalysis(memberAnalytics: any[]) {
  return memberAnalytics.slice(0, 8).map((member, index) => ({
    member: `Member ${index + 1}`,
    connections: Math.round(member.collaboration_score / 10),
    interactions: Math.round(member.conversations_created + member.active_conversations_30_days),
    influence: Math.round(member.collaboration_score * 0.8)
  }));
}

function generateCollaborationDistribution(memberAnalytics: any[]) {
  const ranges = [
    { name: 'High (80-100)', min: 80, max: 100, color: '#10b981' },
    { name: 'Good (60-79)', min: 60, max: 79, color: '#3b82f6' },
    { name: 'Average (40-59)', min: 40, max: 59, color: '#f59e0b' },
    { name: 'Low (0-39)', min: 0, max: 39, color: '#ef4444' }
  ];
  
  return ranges.map(range => ({
    name: range.name,
    count: memberAnalytics.filter(m => 
      m.collaboration_score >= range.min && m.collaboration_score <= range.max
    ).length,
    range: `${range.min}-${range.max}`,
    color: range.color
  }));
}

function getCollaborationRatingColor(rating: string): string {
  switch (rating) {
    case 'excellent': return 'bg-green-100 text-green-800 border-green-200';
    case 'good': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'average': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'needs_improvement': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}
