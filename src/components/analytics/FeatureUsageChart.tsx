import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { analyticsService } from '@/services/analyticsService';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function FeatureUsageChart() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeatureData();
  }, []);

  const loadFeatureData = async () => {
    try {
      setLoading(true);
      const featureData = await analyticsService.getFeatureUsageAnalytics();
      setData(featureData);
    } catch (error) {
      console.error('Error loading feature data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-3 w-3 text-green-600" />;
      case 'decreasing':
        return <TrendingDown className="h-3 w-3 text-red-600" />;
      default:
        return <Minus className="h-3 w-3 text-gray-600" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return 'text-green-600';
      case 'decreasing':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0'];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Feature Usage</CardTitle>
          <CardDescription>How you use different features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading feature data...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.slice(0, 6).map(item => ({
    name: item.feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: item.usageCount,
    successRate: item.successRate,
    avgDuration: item.averageDuration
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Usage Distribution</CardTitle>
          <CardDescription>Most used features in your workflow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Success Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Success Rates</CardTitle>
          <CardDescription>How effectively you use each feature</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="name" type="category" width={100} fontSize={12} />
                <Tooltip 
                  formatter={(value) => [`${value}%`, 'Success Rate']}
                />
                <Bar dataKey="successRate" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Feature List */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Feature Details</CardTitle>
          <CardDescription>Comprehensive breakdown of feature usage and performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.map((feature, index) => (
              <div key={feature.feature} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">
                      {feature.feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </h4>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(feature.trend)}
                      <span className={`text-xs ${getTrendColor(feature.trend)}`}>
                        {feature.trend}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Usage Count</span>
                      <div className="font-medium">{feature.usageCount}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Success Rate</span>
                      <div className="font-medium">{feature.successRate.toFixed(1)}%</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Avg Duration</span>
                      <div className="font-medium">
                        {feature.averageDuration ? `${feature.averageDuration.toFixed(1)}s` : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last Used</span>
                      <div className="font-medium">
                        {new Date(feature.lastUsed).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <Progress value={feature.successRate} className="h-2" />
                  </div>
                </div>
                
                <div className="ml-4">
                  <Badge 
                    variant={
                      feature.successRate >= 80 ? 'default' :
                      feature.successRate >= 60 ? 'secondary' : 'destructive'
                    }
                  >
                    {feature.successRate >= 80 ? 'Excellent' :
                     feature.successRate >= 60 ? 'Good' : 'Needs Improvement'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          
          {data.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No feature usage data available yet. Start using Mataresit to see your analytics!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
