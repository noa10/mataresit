import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { analyticsService } from '@/services/analyticsService';
import { 
  RefreshCw, 
  TrendingUp, 
  Clock, 
  Target, 
  Lightbulb, 
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';

export function ProductivityInsights() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProductivityData();
  }, []);

  const loadProductivityData = async () => {
    try {
      setLoading(true);
      const productivityData = await analyticsService.getProductivityInsights();
      setData(productivityData);
    } catch (error) {
      console.error('Error loading productivity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { variant: 'default' as const, label: 'Excellent' };
    if (score >= 60) return { variant: 'secondary' as const, label: 'Good' };
    return { variant: 'destructive' as const, label: 'Needs Improvement' };
  };

  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'medium':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'hard':
        return <Info className="h-4 w-4 text-red-600" />;
      default:
        return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Productivity Insights</CardTitle>
          <CardDescription>Your efficiency and optimization opportunities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading productivity insights...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const scoreBadge = getScoreBadge(data?.productivityScore || 0);

  return (
    <div className="space-y-6">
      {/* Productivity Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Target className="h-5 w-5" />
              Productivity Score
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className={`text-4xl font-bold ${getScoreColor(data?.productivityScore || 0)}`}>
              {Math.round(data?.productivityScore || 0)}%
            </div>
            <Progress value={data?.productivityScore || 0} className="mt-4" />
            <Badge {...scoreBadge} className="mt-2">
              {scoreBadge.label}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Efficiency Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.efficiencyTrends || []}>
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Tooltip 
                    formatter={(value) => [`${value}%`, 'Efficiency']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center mt-2">
              <span className="text-sm text-muted-foreground">
                Last 14 days trend
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Time Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-green-600">
                {data?.timeOptimization?.reduce((total: number, item: any) => {
                  const savings = item.potentialSavings.match(/(\d+)/);
                  return total + (savings ? parseInt(savings[1]) : 0);
                }, 0) || 0} min
              </div>
              <div className="text-sm text-muted-foreground">
                Potential daily savings
              </div>
              <div className="text-xs text-muted-foreground">
                Based on optimization suggestions
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Optimization Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Time Optimization Suggestions
          </CardTitle>
          <CardDescription>
            Quick wins to improve your productivity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data?.timeOptimization?.map((suggestion: any, index: number) => (
              <div key={index} className="flex items-start gap-3 p-4 border rounded-lg">
                <div className="mt-1">
                  {getDifficultyIcon(suggestion.difficulty)}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">{suggestion.suggestion}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Potential savings: {suggestion.potentialSavings}
                  </p>
                  <Badge 
                    variant="outline" 
                    className="mt-2"
                  >
                    {suggestion.difficulty} to implement
                  </Badge>
                </div>
              </div>
            )) || (
              <div className="text-center py-8 text-muted-foreground">
                No optimization suggestions available yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Workflow Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Workflow Recommendations
          </CardTitle>
          <CardDescription>
            Suggested workflows based on your usage patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.workflowRecommendations?.map((workflow: any, index: number) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-lg">{workflow.workflow}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {workflow.description}
                  </p>
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm">Benefits:</h5>
                    <ul className="text-xs space-y-1">
                      {workflow.benefits?.map((benefit: string, benefitIndex: number) => (
                        <li key={benefitIndex} className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-4">
                    Learn More
                  </Button>
                </CardContent>
              </Card>
            )) || (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No workflow recommendations available yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
