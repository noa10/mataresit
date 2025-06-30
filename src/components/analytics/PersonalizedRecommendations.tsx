import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Lightbulb, 
  Settings, 
  Workflow, 
  Zap, 
  TrendingUp, 
  Clock, 
  Target,
  CheckCircle,
  ArrowRight,
  Star
} from 'lucide-react';
import { PersonalizedInsights } from '@/services/analyticsService';

interface PersonalizedRecommendationsProps {
  insights: PersonalizedInsights | null;
}

export function PersonalizedRecommendations({ insights }: PersonalizedRecommendationsProps) {
  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'feature':
        return <Zap className="h-5 w-5 text-blue-600" />;
      case 'workflow':
        return <Workflow className="h-5 w-5 text-green-600" />;
      case 'setting':
        return <Settings className="h-5 w-5 text-purple-600" />;
      default:
        return <Lightbulb className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case 'high':
        return { variant: 'destructive' as const, label: 'High Impact' };
      case 'medium':
        return { variant: 'default' as const, label: 'Medium Impact' };
      case 'low':
        return { variant: 'secondary' as const, label: 'Low Impact' };
      default:
        return { variant: 'outline' as const, label: 'Unknown Impact' };
    }
  };

  if (!insights) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Personalized Recommendations</CardTitle>
          <CardDescription>Loading your personalized insights...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No insights available yet. Use Mataresit more to get personalized recommendations!
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Receipt Management Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Receipt Management Patterns
          </CardTitle>
          <CardDescription>
            Insights about your receipt processing behavior
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Upload Frequency</h4>
              <div className="text-2xl font-bold text-blue-600">
                {insights.receiptPatterns.uploadFrequency}
              </div>
              <p className="text-sm text-muted-foreground">
                You typically upload receipts {insights.receiptPatterns.uploadFrequency}
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Preferred Time</h4>
              <div className="text-2xl font-bold text-green-600">
                {insights.receiptPatterns.preferredUploadTime}
              </div>
              <p className="text-sm text-muted-foreground">
                Most active during {insights.receiptPatterns.preferredUploadTime} hours
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Processing Efficiency</h4>
              <div className="text-2xl font-bold text-purple-600">
                {insights.receiptPatterns.processingEfficiency}%
              </div>
              <Progress value={insights.receiptPatterns.processingEfficiency} className="mt-2" />
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h5 className="font-medium mb-2">Top Categories</h5>
            <div className="flex flex-wrap gap-2">
              {insights.receiptPatterns.topCategories.map((category, index) => (
                <Badge key={index} variant="outline">
                  {category}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search & Chat Patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Search Behavior
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Query Complexity</span>
                <Badge variant="outline">
                  {insights.searchPatterns.queryComplexity}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Search Success Rate</span>
                <div className="text-right">
                  <div className="font-medium">{insights.searchPatterns.searchSuccess}%</div>
                  <Progress value={insights.searchPatterns.searchSuccess} className="w-20 mt-1" />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Preferred Search Type</span>
                <Badge variant="secondary">
                  {insights.searchPatterns.preferredSearchType}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Chat Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Message Length</span>
                <Badge variant="outline">
                  {insights.chatPatterns.messageLength}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Question Frequency</span>
                <div className="text-right">
                  <div className="font-medium">{insights.chatPatterns.questionFrequency}%</div>
                  <Progress value={insights.chatPatterns.questionFrequency} className="w-20 mt-1" />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Response Preference</span>
                <Badge variant="secondary">
                  {insights.chatPatterns.responsePreference}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Personalized Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Personalized Recommendations
          </CardTitle>
          <CardDescription>
            Tailored suggestions to improve your Mataresit experience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {insights.recommendations.map((recommendation, index) => {
              const impactBadge = getImpactBadge(recommendation.impact);
              
              return (
                <div key={index} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="mt-1">
                    {getRecommendationIcon(recommendation.type)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-medium">{recommendation.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {recommendation.description}
                        </p>
                      </div>
                      
                      <Badge {...impactBadge}>
                        {impactBadge.label}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="outline" className="text-xs">
                        {recommendation.type}
                      </Badge>
                      
                      <Button variant="ghost" size="sm" className="ml-auto">
                        Apply
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {insights.recommendations.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
                <h3 className="font-medium mb-2">You're doing great!</h3>
                <p>No specific recommendations at this time. Keep using Mataresit to unlock more insights.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
