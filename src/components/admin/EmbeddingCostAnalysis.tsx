/**
 * Embedding Cost Analysis
 * Component for displaying cost breakdown and budget tracking
 * Placeholder component - will be implemented in Task 7
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DollarSign, TrendingUp, PieChart, AlertTriangle } from 'lucide-react';
import { EmbeddingCostBreakdown } from '@/types/embedding-metrics';

interface EmbeddingCostAnalysisProps {
  costBreakdown: EmbeddingCostBreakdown | null;
  isLoading?: boolean;
}

export function EmbeddingCostAnalysis({ 
  costBreakdown, 
  isLoading = false 
}: EmbeddingCostAnalysisProps) {
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
      {/* Cost Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold">${costBreakdown?.totalCost.toFixed(4) || '0.0000'}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Current period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Projected Monthly</p>
                <p className="text-2xl font-bold">${costBreakdown?.projectedMonthlyCost.toFixed(2) || '0.00'}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Based on current usage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Budget Usage</p>
                <p className="text-2xl font-bold">{costBreakdown?.budgetUtilization.toFixed(1) || '0.0'}%</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
            <Progress value={costBreakdown?.budgetUtilization || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Single vs Batch</p>
                <p className="text-2xl font-bold">
                  {costBreakdown ? 
                    (costBreakdown.costByContext.single / (costBreakdown.costByContext.single + costBreakdown.costByContext.batch) * 100).toFixed(0) 
                    : '0'
                  }%
                </p>
              </div>
              <PieChart className="h-8 w-8 text-purple-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Single upload ratio
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cost Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost by Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {costBreakdown?.costByModel ? (
                Object.entries(costBreakdown.costByModel).map(([model, cost]) => (
                  <div key={model} className="flex justify-between items-center">
                    <span className="text-sm font-medium">{model}</span>
                    <Badge variant="outline">${cost.toFixed(4)}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">No cost data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Cost by Context
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {costBreakdown && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Single Upload</span>
                    <Badge variant="outline">${costBreakdown.costByContext.single.toFixed(4)}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Batch Upload</span>
                    <Badge variant="outline">${costBreakdown.costByContext.batch.toFixed(4)}</Badge>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Cost Trend Analysis
            <Badge variant="secondary">Coming Soon</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded border-2 border-dashed border-gray-200">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 font-medium">Cost Trend Chart</p>
              <p className="text-sm text-gray-400">Interactive cost analysis will be implemented in Task 7</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Cost Data */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Cost Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {costBreakdown?.costTrend.slice(-7).map((trend, index) => (
              <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-sm font-mono">
                  {new Date(trend.date).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{trend.tokens} tokens</Badge>
                  <Badge className="bg-green-100 text-green-800">
                    ${trend.cost.toFixed(4)}
                  </Badge>
                </div>
              </div>
            )) || (
              <p className="text-center text-muted-foreground py-4">No cost trend data available</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
