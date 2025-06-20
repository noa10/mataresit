/**
 * Search Ranking Dashboard
 * Comprehensive analytics and optimization for search result ranking
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  Target, 
  Award, 
  BarChart3, 
  PieChart, 
  Lightbulb,
  Download,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useSearchRankingAnalytics } from '@/hooks/useSearchRankingAnalytics';
import { toast } from 'sonner';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  status?: 'good' | 'warning' | 'critical';
  icon: React.ReactNode;
  description?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  unit, 
  trend, 
  status = 'good', 
  icon, 
  description 
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'good': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />;
      default: return null;
    }
  };

  return (
    <Card className={`${getStatusColor()}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {icon}
            <div>
              <p className="text-sm font-medium text-gray-600">{title}</p>
              <div className="flex items-center space-x-1">
                <p className="text-2xl font-bold">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </p>
                {unit && <span className="text-sm text-gray-500">{unit}</span>}
                {getTrendIcon()}
              </div>
              {description && (
                <p className="text-xs text-gray-500 mt-1">{description}</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const SearchRankingDashboard: React.FC = () => {
  const {
    analytics,
    optimization,
    recentSessions,
    loading,
    error,
    analyzeRankingPerformance,
    generateOptimizationSuggestions,
    exportAnalytics,
    clearAnalytics
  } = useSearchRankingAnalytics();

  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto-refresh analytics
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        analyzeRankingPerformance();
      }, 60000); // Every minute

      return () => clearInterval(interval);
    }
  }, [autoRefresh, analyzeRankingPerformance]);

  // Handle export
  const handleExport = () => {
    try {
      const data = exportAnalytics();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-ranking-analytics-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Analytics data exported successfully');
    } catch (err) {
      toast.error('Failed to export analytics data');
    }
  };

  // Get overall ranking health
  const getRankingHealth = () => {
    if (!analytics) return { score: 0, status: 'unknown' };
    
    const highQualityRatio = analytics.rankingDistribution.highQuality / 100;
    const avgSourceScore = analytics.topPerformingSources.reduce((sum, s) => sum + s.averageScore, 0) / 
                          (analytics.topPerformingSources.length || 1);
    
    const healthScore = Math.round((highQualityRatio * 0.6 + avgSourceScore * 0.4) * 100);
    
    let status: 'good' | 'warning' | 'critical' = 'good';
    if (healthScore < 60) status = 'critical';
    else if (healthScore < 80) status = 'warning';
    
    return { score: healthScore, status };
  };

  const rankingHealth = getRankingHealth();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Search Ranking Analytics</h2>
          <p className="text-muted-foreground">
            Advanced analytics and optimization for search result ranking
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={autoRefresh ? "default" : "secondary"}>
            {autoRefresh ? "Auto-refresh On" : "Auto-refresh Off"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? "Disable" : "Enable"} Auto-refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={analyzeRankingPerformance}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Key Metrics Grid */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Ranking Health"
            value={rankingHealth.score}
            unit="%"
            status={rankingHealth.status}
            icon={<Award className="h-5 w-5" />}
            description="Overall ranking quality"
          />
          
          <MetricCard
            title="Total Searches"
            value={analytics.totalSearches}
            status="good"
            icon={<BarChart3 className="h-5 w-5" />}
            description="Analyzed search sessions"
          />
          
          <MetricCard
            title="High Quality Results"
            value={analytics.rankingDistribution.highQuality}
            unit="%"
            status={analytics.rankingDistribution.highQuality > 70 ? 'good' : 'warning'}
            icon={<Target className="h-5 w-5" />}
            description="Results with score > 0.8"
          />
          
          <MetricCard
            title="Avg Results per Search"
            value={Math.round(analytics.averageResultCount * 10) / 10}
            status={analytics.averageResultCount > 5 ? 'good' : 'warning'}
            icon={<PieChart className="h-5 w-5" />}
            description="Results returned per query"
          />
        </div>
      )}

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sources">Source Performance</TabsTrigger>
          <TabsTrigger value="patterns">Search Patterns</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {analytics ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Quality Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Result Quality Distribution</CardTitle>
                  <CardDescription>
                    Distribution of search result quality scores
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">High Quality (>0.8)</span>
                      <span className="text-sm text-green-600 font-medium">
                        {analytics.rankingDistribution.highQuality}%
                      </span>
                    </div>
                    <Progress value={analytics.rankingDistribution.highQuality} className="h-2" />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Medium Quality (0.5-0.8)</span>
                      <span className="text-sm text-yellow-600 font-medium">
                        {analytics.rankingDistribution.mediumQuality}%
                      </span>
                    </div>
                    <Progress value={analytics.rankingDistribution.mediumQuality} className="h-2" />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Low Quality (<0.5)</span>
                      <span className="text-sm text-red-600 font-medium">
                        {analytics.rankingDistribution.lowQuality}%
                      </span>
                    </div>
                    <Progress value={analytics.rankingDistribution.lowQuality} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* Search Patterns */}
              <Card>
                <CardHeader>
                  <CardTitle>Search Pattern Analysis</CardTitle>
                  <CardDescription>
                    Types of searches being performed
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">
                        {analytics.searchPatterns.exactMatches}
                      </p>
                      <p className="text-blue-700">Exact Matches</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">
                        {analytics.searchPatterns.semanticMatches}
                      </p>
                      <p className="text-green-700">Semantic</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600">
                        {analytics.searchPatterns.crossLanguageMatches}
                      </p>
                      <p className="text-purple-700">Cross-Language</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">
                        {analytics.searchPatterns.businessMatches}
                      </p>
                      <p className="text-orange-700">Business</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Info className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">No analytics data available yet.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Perform some searches to start collecting ranking analytics.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          {analytics && analytics.topPerformingSources.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Source Performance Ranking</CardTitle>
                <CardDescription>
                  Average ranking scores by data source
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.topPerformingSources.map((source, index) => (
                    <div key={source.source} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                          <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium capitalize">{source.source.replace('_', ' ')}</p>
                          <p className="text-sm text-gray-500">{source.searchCount} searches</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{(source.averageScore * 100).toFixed(1)}%</p>
                        <p className="text-sm text-gray-500">Avg Score</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">No source performance data available.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Search Sessions</CardTitle>
              <CardDescription>
                Latest search ranking sessions and their performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentSessions.length > 0 ? (
                <div className="space-y-3">
                  {recentSessions.slice(0, 10).map((session, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">"{session.query}"</p>
                        <p className="text-sm text-gray-500">
                          {session.results.length} results • {session.context.searchType} search
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {new Date(session.timestamp).toLocaleTimeString()}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {session.context.language}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <PieChart className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">No search sessions recorded yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Optimization Suggestions</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={generateOptimizationSuggestions}
              disabled={loading}
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              Generate Suggestions
            </Button>
          </div>

          {optimization ? (
            <div className="space-y-4">
              {/* Performance Impact */}
              <Card>
                <CardHeader>
                  <CardTitle>Expected Performance Impact</CardTitle>
                  <CardDescription>
                    Estimated improvements from optimization suggestions
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      +{(optimization.performanceImpact.averageScoreImprovement * 100).toFixed(1)}%
                    </p>
                    <p className="text-sm text-gray-600">Score Improvement</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {optimization.performanceImpact.topResultAccuracy}%
                    </p>
                    <p className="text-sm text-gray-600">Top Result Accuracy</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">
                      {optimization.performanceImpact.userSatisfactionEstimate}%
                    </p>
                    <p className="text-sm text-gray-600">User Satisfaction</p>
                  </div>
                </CardContent>
              </Card>

              {/* Suggestions */}
              <div className="space-y-3">
                {optimization.suggestions.map((suggestion, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge variant="outline">{suggestion.type.replace('_', ' ')}</Badge>
                            <Badge variant="secondary">
                              {Math.round(suggestion.confidence * 100)}% confidence
                            </Badge>
                          </div>
                          <p className="font-medium mb-1">{suggestion.description}</p>
                          <p className="text-sm text-gray-600">{suggestion.expectedImprovement}</p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-gray-500">Current: {suggestion.currentValue}</p>
                          <p className="text-green-600 font-medium">Suggested: {suggestion.suggestedValue}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Lightbulb className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">No optimization suggestions available.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Generate suggestions based on current analytics data.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SearchRankingDashboard;
