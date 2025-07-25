import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ComposedChart,
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
  PieChart,
  Pie,
  Cell,
  ReferenceLine
} from 'recharts';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Clock,
  Target,
  Award,
  Calculator,
  BarChart3
} from 'lucide-react';
import { TeamAdvancedAnalytics } from '@/services/advancedAnalyticsService';

interface ROIAnalysisChartProps {
  teamAnalytics: TeamAdvancedAnalytics;
  timeframe: string;
  className?: string;
}

export function ROIAnalysisChart({ 
  teamAnalytics, 
  timeframe,
  className 
}: ROIAnalysisChartProps) {
  
  // Generate ROI data based on team analytics
  const roiData = generateROIData(teamAnalytics, timeframe);
  const costEfficiencyData = generateCostEfficiencyData(teamAnalytics);
  const productivityROIData = generateProductivityROIData(teamAnalytics);
  const investmentBreakdownData = generateInvestmentBreakdownData(teamAnalytics);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ROI Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total ROI</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {roiData.totalROI.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {roiData.totalROI > 0 ? 'Positive return' : 'Investment period'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost per Member</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${roiData.costPerMember.toFixed(0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Monthly average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productivity Gain</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {roiData.productivityGain.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Efficiency improvement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payback Period</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {roiData.paybackPeriod} mo
            </div>
            <p className="text-xs text-muted-foreground">
              Break-even timeline
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ROI Trend Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            ROI Trend Analysis
          </CardTitle>
          <CardDescription>
            Return on investment progression over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={roiData.trendData}>
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
                              {entry.name}: {entry.name.includes('$') ? `$${entry.value}` : `${entry.value}%`}
                            </p>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                
                {/* Investment bars */}
                <Bar 
                  yAxisId="right"
                  dataKey="investment" 
                  fill="#ef4444" 
                  name="Investment ($)" 
                  fillOpacity={0.7}
                />
                
                {/* Returns bars */}
                <Bar 
                  yAxisId="right"
                  dataKey="returns" 
                  fill="#10b981" 
                  name="Returns ($)" 
                  fillOpacity={0.7}
                />
                
                {/* ROI percentage line */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="roi"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  name="ROI (%)"
                />
                
                {/* Break-even reference line */}
                <ReferenceLine 
                  yAxisId="left"
                  y={0} 
                  stroke="#6b7280" 
                  strokeDasharray="3 3" 
                  label="Break-even" 
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Cost Efficiency and Productivity Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Efficiency Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Cost Efficiency Analysis</CardTitle>
            <CardDescription>
              Cost breakdown and efficiency metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={costEfficiencyData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {costEfficiencyData.map((entry, index) => (
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
                            <p>Cost: ${data.value}</p>
                            <p>Efficiency: {data.efficiency}%</p>
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

        {/* Productivity ROI */}
        <Card>
          <CardHeader>
            <CardTitle>Productivity ROI</CardTitle>
            <CardDescription>
              Productivity gains and time savings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={productivityROIData}>
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
                  <Area
                    type="monotone"
                    dataKey="baseline"
                    stackId="1"
                    stroke="#94a3b8"
                    fill="#94a3b8"
                    fillOpacity={0.6}
                    name="Baseline"
                  />
                  <Area
                    type="monotone"
                    dataKey="improved"
                    stackId="2"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.6}
                    name="Improved"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Investment Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Investment Breakdown</CardTitle>
          <CardDescription>
            Detailed analysis of investment allocation and returns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {investmentBreakdownData.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{item.category}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">${item.amount}</span>
                    <Badge className={getROIBadgeColor(item.roi)}>
                      {item.roi > 0 ? '+' : ''}{item.roi.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
                <Progress value={item.efficiency} className="h-2" />
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ROI Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            ROI Optimization Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-green-600 mb-2">High Impact Opportunities</h4>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-green-500" />
                  Increase high performer utilization
                </li>
                <li className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-green-500" />
                  Optimize collaboration workflows
                </li>
                <li className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-green-500" />
                  Reduce at-risk member count
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-blue-600 mb-2">Cost Optimization</h4>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-blue-500" />
                  Streamline team processes
                </li>
                <li className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-blue-500" />
                  Automate routine tasks
                </li>
                <li className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-blue-500" />
                  Improve resource allocation
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper functions to generate ROI data
function generateROIData(teamAnalytics: TeamAdvancedAnalytics, timeframe: string) {
  const baseInvestment = teamAnalytics.team_info.total_members * 100; // $100 per member per month
  const productivityValue = teamAnalytics.activity_summary.avg_engagement_score * 10; // Value from engagement
  const collaborationValue = teamAnalytics.collaboration_summary.avg_collaboration_score * 5; // Value from collaboration
  
  const totalValue = productivityValue + collaborationValue;
  const totalROI = ((totalValue - baseInvestment) / baseInvestment) * 100;
  
  // Generate trend data for the last 6 months
  const trendData = [];
  for (let i = 5; i >= 0; i--) {
    const month = new Date();
    month.setMonth(month.getMonth() - i);
    const monthName = month.toLocaleDateString('en-US', { month: 'short' });
    
    const investment = baseInvestment * (1 + i * 0.1); // Increasing investment
    const returns = totalValue * (1 + i * 0.15); // Increasing returns
    const roi = ((returns - investment) / investment) * 100;
    
    trendData.push({
      period: monthName,
      investment,
      returns,
      roi: Math.round(roi * 10) / 10
    });
  }
  
  return {
    totalROI,
    costPerMember: baseInvestment,
    productivityGain: (teamAnalytics.activity_summary.avg_engagement_score / 100) * 50, // Max 50% gain
    paybackPeriod: Math.max(1, Math.round(12 / (totalROI / 100 + 1))),
    trendData
  };
}

function generateCostEfficiencyData(teamAnalytics: TeamAdvancedAnalytics) {
  return [
    { name: 'Platform Costs', value: 500, efficiency: 85, color: '#3b82f6' },
    { name: 'Training', value: 200, efficiency: 75, color: '#10b981' },
    { name: 'Support', value: 150, efficiency: 90, color: '#f59e0b' },
    { name: 'Infrastructure', value: 300, efficiency: 80, color: '#ef4444' }
  ];
}

function generateProductivityROIData(teamAnalytics: TeamAdvancedAnalytics) {
  return [
    { metric: 'Receipt Processing', baseline: 60, improved: 85 },
    { metric: 'Team Collaboration', baseline: 45, improved: 70 },
    { metric: 'Data Analysis', baseline: 30, improved: 55 },
    { metric: 'Reporting', baseline: 40, improved: 75 }
  ];
}

function generateInvestmentBreakdownData(teamAnalytics: TeamAdvancedAnalytics) {
  return [
    {
      category: 'Team Management Platform',
      amount: 800,
      roi: 25.5,
      efficiency: 85,
      description: 'Core platform subscription and features'
    },
    {
      category: 'AI Processing',
      amount: 300,
      roi: 45.2,
      efficiency: 92,
      description: 'AI-powered receipt processing and analytics'
    },
    {
      category: 'Training & Onboarding',
      amount: 200,
      roi: 15.8,
      efficiency: 70,
      description: 'Team training and user adoption programs'
    },
    {
      category: 'Support & Maintenance',
      amount: 150,
      roi: 12.3,
      efficiency: 88,
      description: 'Technical support and system maintenance'
    }
  ];
}

function getROIBadgeColor(roi: number): string {
  if (roi > 20) return 'bg-green-100 text-green-800 border-green-200';
  if (roi > 10) return 'bg-blue-100 text-blue-800 border-blue-200';
  if (roi > 0) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-red-100 text-red-800 border-red-200';
}
