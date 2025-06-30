import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { usePersonalizationContext } from '@/contexts/PersonalizationContext';
import { 
  BarChart3, 
  TrendingUp, 
  Activity, 
  Brain,
  ArrowLeft,
  TestTube
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TestAnalyticsPage() {
  const { 
    trackInteraction, 
    trackChatMessage, 
    trackSearchQuery, 
    trackUIAction 
  } = usePersonalizationContext();

  const generateTestData = async () => {
    try {
      // Generate some test interactions
      await trackChatMessage("How can I categorize my receipts better?", "test-conversation", 1500);
      await trackChatMessage("Show me receipts from last month", "test-conversation", 800);
      await trackChatMessage("What's my spending pattern for food?", "test-conversation", 2200);
      
      await trackSearchQuery("food receipts", "semantic", 15);
      await trackSearchQuery("total > 50", "filter", 8);
      await trackSearchQuery("restaurant expenses", "keyword", 12);
      
      await trackUIAction("upload_receipt", "UploadZone", true);
      await trackUIAction("batch_upload", "BatchUpload", true);
      await trackUIAction("export_data", "ExportDropdown", true);
      
      await trackInteraction('feature_usage', {
        feature_name: 'receipt_upload',
        duration: 45,
        success: true
      });
      
      await trackInteraction('feature_usage', {
        feature_name: 'semantic_search',
        duration: 12,
        success: true
      });
      
      console.log('Test data generated successfully!');
    } catch (error) {
      console.error('Error generating test data:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link to="/test/integration">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Integration Test
            </Button>
          </Link>
          
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-8 w-8" />
              Analytics Dashboard Test
            </h1>
            <p className="text-muted-foreground">
              Test the long-term interaction tracking and analytics system
            </p>
          </div>
        </div>
        
        <Badge variant="outline" className="flex items-center gap-1">
          <TestTube className="h-3 w-3" />
          Test Environment
        </Badge>
      </div>

      {/* Test Controls */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Test Data Generation
          </CardTitle>
          <CardDescription>
            Generate sample interaction data to test the analytics dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button onClick={generateTestData}>
              Generate Test Interactions
            </Button>
            <p className="text-sm text-muted-foreground">
              This will create sample chat messages, search queries, and UI actions for testing
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Feature Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Interaction Tracking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Comprehensive tracking of user interactions including chat messages, 
              search queries, UI actions, and feature usage with detailed analytics.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-green-600" />
              Pattern Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Intelligent analysis of user behavior patterns to identify usage trends, 
              productivity insights, and personalized recommendations.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              Visual Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Rich visualizations including trend charts, feature usage analytics, 
              productivity insights, and personalized recommendations dashboard.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Dashboard */}
      <AnalyticsDashboard />

      {/* Implementation Notes */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Implementation Notes</CardTitle>
          <CardDescription>
            Technical details about the analytics system implementation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Database Functions</h4>
              <p className="text-sm text-muted-foreground">
                Created comprehensive Supabase functions for analytics aggregation, pattern analysis, 
                and insights generation including get_user_analytics, get_usage_statistics, 
                get_personalized_insights, and more.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Service Layer</h4>
              <p className="text-sm text-muted-foreground">
                Implemented analyticsService.ts with methods for retrieving user analytics, 
                usage statistics, interaction trends, feature usage analytics, and productivity insights.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">UI Components</h4>
              <p className="text-sm text-muted-foreground">
                Built comprehensive dashboard components including InteractionTrendsChart, 
                FeatureUsageChart, ProductivityInsights, and PersonalizedRecommendations 
                with rich visualizations using Recharts.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Integration</h4>
              <p className="text-sm text-muted-foreground">
                Seamlessly integrated with existing personalization system, leveraging 
                the user_interactions table and preferenceLearningService for comprehensive 
                long-term interaction tracking and analysis.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
