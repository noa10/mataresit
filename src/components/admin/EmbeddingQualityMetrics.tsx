/**
 * Embedding Quality Metrics
 * Component for displaying embedding quality and content analysis
 * Placeholder component - will be implemented in Task 4
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, PieChart, CheckCircle, AlertTriangle } from 'lucide-react';
import { EmbeddingQualityMetrics as QualityMetricsType } from '@/types/embedding-metrics';

interface EmbeddingQualityMetricsProps {
  qualityMetrics: QualityMetricsType | null;
  isLoading?: boolean;
}

export function EmbeddingQualityMetrics({ 
  qualityMetrics, 
  isLoading = false 
}: EmbeddingQualityMetricsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-32 bg-gray-100 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quality Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Quality Score</p>
                <p className="text-2xl font-bold">{qualityMetrics?.qualityScore || 0}/100</p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
            <Progress value={qualityMetrics?.qualityScore || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Synthetic Content</p>
                <p className="text-2xl font-bold">{qualityMetrics?.syntheticContentUsage.toFixed(1) || 0}%</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              AI-generated content usage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Content Types</p>
                <p className="text-2xl font-bold">{qualityMetrics?.avgContentTypesPerReceipt.toFixed(1) || 0}</p>
              </div>
              <PieChart className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Per receipt
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Quality Trend</p>
                <p className="text-2xl font-bold capitalize">{qualityMetrics?.qualityTrend || 'stable'}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-purple-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Overall direction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quality Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Content Type Success Rates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {qualityMetrics?.contentTypeSuccessRates ? (
                Object.entries(qualityMetrics.contentTypeSuccessRates).map(([type, rate]) => (
                  <div key={type} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium capitalize">{type.replace('_', ' ')}</span>
                      <span className="text-sm font-mono">{rate.toFixed(1)}%</span>
                    </div>
                    <Progress value={rate} className="h-2" />
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">No content type data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Embedding Dimensions
              <Badge variant="secondary">Coming Soon</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center bg-gray-50 rounded border-2 border-dashed border-gray-200">
              <div className="text-center">
                <PieChart className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 font-medium">Dimensions Chart</p>
                <p className="text-sm text-gray-400">Will be implemented in Task 4</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quality Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Quality Analysis
            <Badge variant="secondary">Coming Soon</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded border-2 border-dashed border-gray-200">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 font-medium">Quality Insights</p>
              <p className="text-sm text-gray-400">Detailed quality analysis will be implemented in Task 4</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
