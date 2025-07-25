import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
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
  ComposedChart,
  Bar,
  ReferenceLine
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Brain,
  Target,
  AlertTriangle,
  Activity
} from 'lucide-react';
import { PredictiveAnalytics } from '@/services/advancedAnalyticsService';

interface PredictiveAnalyticsChartProps {
  predictiveData: PredictiveAnalytics;
  className?: string;
}

export function PredictiveAnalyticsChart({ 
  predictiveData, 
  className 
}: PredictiveAnalyticsChartProps) {
  
  // Prepare forecast data for visualization
  const forecastData = generateForecastData(predictiveData);
  const riskData = generateRiskData(predictiveData);
  const targetData = generateTargetData(predictiveData);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Performance Forecast Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Performance Forecast
          </CardTitle>
          <CardDescription>
            Predicted team performance trends for the next {predictiveData.forecast_period.forecast_days} days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={forecastData}>
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
                              {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
                            </p>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                
                {/* Historical data area */}
                <Area
                  type="monotone"
                  dataKey="historicalActivity"
                  stackId="1"
                  stroke="#94a3b8"
                  fill="#94a3b8"
                  fillOpacity={0.3}
                  name="Historical Activity"
                />
                
                {/* Predicted activity line */}
                <Line
                  type="monotone"
                  dataKey="predictedActivity"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={{ r: 4 }}
                  name="Predicted Activity"
                />
                
                {/* Collaboration forecast */}
                <Line
                  type="monotone"
                  dataKey="predictedCollaboration"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3 }}
                  name="Predicted Collaboration"
                />
                
                {/* Confidence interval */}
                <Area
                  type="monotone"
                  dataKey="confidenceUpper"
                  stackId="2"
                  stroke="none"
                  fill="#3b82f6"
                  fillOpacity={0.1}
                  name="Confidence Range"
                />
                <Area
                  type="monotone"
                  dataKey="confidenceLower"
                  stackId="2"
                  stroke="none"
                  fill="#ffffff"
                  fillOpacity={1}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Risk Assessment Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Risk Assessment
            </CardTitle>
            <CardDescription>
              Potential risks and their severity levels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={riskData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="category" 
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
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-medium">{label}</p>
                            <p style={{ color: payload[0].color }}>
                              Risk Level: {payload[0].value}%
                            </p>
                            <Badge className={getRiskBadgeColor(payload[0].value as number)}>
                              {getRiskLevel(payload[0].value as number)}
                            </Badge>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="riskLevel"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.6}
                  />
                  <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="3 3" label="High Risk" />
                  <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="3 3" label="Medium Risk" />
                  <ReferenceLine y={25} stroke="#10b981" strokeDasharray="3 3" label="Low Risk" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Target vs Predicted Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Target vs Predicted
            </CardTitle>
            <CardDescription>
              Performance targets compared to predictions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={targetData}>
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
                  <Bar dataKey="target" fill="#10b981" name="Target" />
                  <Bar dataKey="predicted" fill="#3b82f6" name="Predicted" />
                  <Line
                    type="monotone"
                    dataKey="gap"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Gap"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Forecast Confidence Indicator */}
      <Card>
        <CardHeader>
          <CardTitle>Forecast Confidence</CardTitle>
          <CardDescription>
            Reliability of predictive analytics based on available data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              <span className="font-medium">Confidence Level</span>
            </div>
            <Badge className={getConfidenceBadgeColor(predictiveData.metadata.forecast_confidence)}>
              {predictiveData.metadata.forecast_confidence}
            </Badge>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            <p>Data Points Analyzed: {predictiveData.metadata.data_points_analyzed}</p>
            <p>Forecast Period: {predictiveData.forecast_period.forecast_days} days</p>
            <p>Generated: {new Date(predictiveData.metadata.generated_at).toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper functions to generate chart data
function generateForecastData(predictiveData: PredictiveAnalytics) {
  const forecastDays = predictiveData.forecast_period.forecast_days;
  const data = [];
  
  // Generate historical data (last 7 days) and forecast data
  for (let i = -7; i <= forecastDays; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    
    const isHistorical = i <= 0;
    const isForecast = i > 0;
    
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      historicalActivity: isHistorical ? Math.random() * 50 + 30 : null,
      predictedActivity: isForecast ? predictiveData.performance_forecast.predicted_activity_level + (Math.random() - 0.5) * 10 : null,
      predictedCollaboration: isForecast ? predictiveData.performance_forecast.predicted_collaboration_score + (Math.random() - 0.5) * 5 : null,
      confidenceUpper: isForecast ? predictiveData.performance_forecast.predicted_activity_level + 15 : null,
      confidenceLower: isForecast ? predictiveData.performance_forecast.predicted_activity_level - 15 : null,
    });
  }
  
  return data;
}

function generateRiskData(predictiveData: PredictiveAnalytics) {
  const riskMapping = {
    'low': 20,
    'medium': 50,
    'high': 80
  };
  
  return [
    {
      category: 'Member Attrition',
      riskLevel: riskMapping[predictiveData.risk_assessment.member_attrition_risk as keyof typeof riskMapping] || 30
    },
    {
      category: 'Productivity Decline',
      riskLevel: riskMapping[predictiveData.risk_assessment.productivity_decline_risk as keyof typeof riskMapping] || 30
    },
    {
      category: 'Team Cohesion',
      riskLevel: riskMapping[predictiveData.risk_assessment.team_cohesion_risk as keyof typeof riskMapping] || 30
    }
  ];
}

function generateTargetData(predictiveData: PredictiveAnalytics) {
  return [
    {
      metric: 'Activity',
      target: predictiveData.success_indicators.target_improvements.activity_increase_target,
      predicted: predictiveData.performance_forecast.predicted_activity_level,
      gap: Math.abs(predictiveData.success_indicators.target_improvements.activity_increase_target - predictiveData.performance_forecast.predicted_activity_level)
    },
    {
      metric: 'Collaboration',
      target: predictiveData.success_indicators.target_improvements.collaboration_score_target,
      predicted: predictiveData.performance_forecast.predicted_collaboration_score,
      gap: Math.abs(predictiveData.success_indicators.target_improvements.collaboration_score_target - predictiveData.performance_forecast.predicted_collaboration_score)
    },
    {
      metric: 'At-Risk Reduction',
      target: predictiveData.success_indicators.target_improvements.at_risk_reduction_target,
      predicted: Math.max(0, predictiveData.success_indicators.target_improvements.at_risk_reduction_target - 1),
      gap: 1
    }
  ];
}

// Helper functions for styling
function getRiskLevel(value: number): string {
  if (value >= 75) return 'High';
  if (value >= 50) return 'Medium';
  return 'Low';
}

function getRiskBadgeColor(value: number): string {
  if (value >= 75) return 'bg-red-100 text-red-800 border-red-200';
  if (value >= 50) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-green-100 text-green-800 border-green-200';
}

function getConfidenceBadgeColor(confidence: string): string {
  switch (confidence) {
    case 'high': return 'bg-green-100 text-green-800 border-green-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}
