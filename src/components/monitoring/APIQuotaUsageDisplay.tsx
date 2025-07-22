/**
 * API Quota Usage Display Component
 * Phase 3: Batch Upload Optimization - Priority 3.2.2
 * 
 * Comprehensive monitoring displays for API quota consumption including:
 * - Detailed requests per minute tracking and visualization
 * - Token consumption monitoring with usage patterns
 * - Remaining quota displays with predictive analytics
 * - Historical usage trends and optimization recommendations
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Activity,
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  AlertCircle,
  CheckCircle,
  BarChart3,
  PieChart,
  RefreshCw,
  Settings,
  Lightbulb
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProgressFormatting } from '@/lib/progress-tracking';

interface QuotaUsageData {
  requests: {
    used: number;
    limit: number;
    remaining: number;
    resetTime: Date;
    usageRate: number; // requests per minute
  };
  tokens: {
    used: number;
    limit: number;
    remaining: number;
    resetTime: Date;
    usageRate: number; // tokens per minute
  };
  historical?: {
    timestamp: Date;
    requestsUsed: number;
    tokensUsed: number;
  }[];
}

interface UsagePrediction {
  timeToExhaustion: number; // milliseconds
  recommendedStrategy: 'conservative' | 'balanced' | 'aggressive';
  confidence: number;
  factors: string[];
}

interface APIQuotaUsageDisplayProps {
  quotaData: QuotaUsageData | null;
  apiProvider: string;
  className?: string;
  showPredictions?: boolean;
  showRecommendations?: boolean;
  showHistoricalTrends?: boolean;
  onRefresh?: () => void;
  onStrategyRecommendation?: (strategy: string) => void;
}

export function APIQuotaUsageDisplay({
  quotaData,
  apiProvider,
  className,
  showPredictions = true,
  showRecommendations = true,
  showHistoricalTrends = false,
  onRefresh,
  onStrategyRecommendation
}: APIQuotaUsageDisplayProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedView, setSelectedView] = useState<'overview' | 'detailed' | 'trends'>('overview');
  
  const { formatDuration, formatPercentage } = useProgressFormatting();

  // Calculate usage percentages and health status
  const usageAnalysis = useMemo(() => {
    if (!quotaData) return null;

    const requestsUsagePercent = (quotaData.requests.used / quotaData.requests.limit) * 100;
    const tokensUsagePercent = (quotaData.tokens.used / quotaData.tokens.limit) * 100;
    
    const overallUsage = Math.max(requestsUsagePercent, tokensUsagePercent);
    
    let healthStatus: 'healthy' | 'warning' | 'critical';
    let healthColor: string;
    
    if (overallUsage >= 90) {
      healthStatus = 'critical';
      healthColor = 'red';
    } else if (overallUsage >= 70) {
      healthStatus = 'warning';
      healthColor = 'orange';
    } else {
      healthStatus = 'healthy';
      healthColor = 'green';
    }

    return {
      requestsUsagePercent,
      tokensUsagePercent,
      overallUsage,
      healthStatus,
      healthColor,
      timeToReset: Math.max(
        quotaData.requests.resetTime.getTime() - Date.now(),
        quotaData.tokens.resetTime.getTime() - Date.now()
      )
    };
  }, [quotaData]);

  // Generate usage predictions
  const usagePrediction = useMemo((): UsagePrediction | null => {
    if (!quotaData || !showPredictions) return null;

    const requestsRate = quotaData.requests.usageRate;
    const tokensRate = quotaData.tokens.usageRate;
    
    const requestsTimeToExhaustion = requestsRate > 0 ? 
      (quotaData.requests.remaining / requestsRate) * 60000 : Infinity;
    const tokensTimeToExhaustion = tokensRate > 0 ? 
      (quotaData.tokens.remaining / tokensRate) * 60000 : Infinity;
    
    const timeToExhaustion = Math.min(requestsTimeToExhaustion, tokensTimeToExhaustion);
    
    let recommendedStrategy: 'conservative' | 'balanced' | 'aggressive';
    let confidence = 0.8;
    const factors: string[] = [];
    
    if (timeToExhaustion < 300000) { // Less than 5 minutes
      recommendedStrategy = 'conservative';
      factors.push('High usage rate detected');
      factors.push('Quota exhaustion imminent');
    } else if (timeToExhaustion < 900000) { // Less than 15 minutes
      recommendedStrategy = 'balanced';
      factors.push('Moderate usage rate');
      factors.push('Some quota pressure');
    } else {
      recommendedStrategy = 'aggressive';
      factors.push('Low usage rate');
      factors.push('Plenty of quota available');
    }

    // Adjust confidence based on historical data
    if (quotaData.historical && quotaData.historical.length > 5) {
      confidence = Math.min(0.95, confidence + 0.1);
      factors.push('Historical data available');
    }

    return {
      timeToExhaustion: isFinite(timeToExhaustion) ? timeToExhaustion : 0,
      recommendedStrategy,
      confidence,
      factors
    };
  }, [quotaData, showPredictions]);

  // Handle refresh with loading state
  const handleRefresh = async () => {
    if (!onRefresh) return;
    
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  if (!quotaData) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-center text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No quota data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">API Quota Usage</CardTitle>
            <Badge variant="outline" className="text-xs">
              {apiProvider}
            </Badge>
            {usageAnalysis && (
              <Badge 
                variant="outline"
                className={cn({
                  'border-green-200 text-green-700 bg-green-50': usageAnalysis.healthColor === 'green',
                  'border-orange-200 text-orange-700 bg-orange-50': usageAnalysis.healthColor === 'orange',
                  'border-red-200 text-red-700 bg-red-50': usageAnalysis.healthColor === 'red'
                })}
              >
                {usageAnalysis.healthStatus}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border p-1">
              {(['overview', 'detailed', 'trends'] as const).map((view) => (
                <Button
                  key={view}
                  variant={selectedView === view ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedView(view)}
                  className="h-7 px-2 text-xs capitalize"
                >
                  {view}
                </Button>
              ))}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            </Button>
          </div>
        </div>
        
        <CardDescription>
          Real-time API quota monitoring and usage analytics
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overview View */}
        {selectedView === 'overview' && (
          <div className="space-y-4">
            {/* Usage Meters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Requests Usage */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">Requests</span>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-mono">
                      {quotaData.requests.used.toLocaleString()} / {quotaData.requests.limit.toLocaleString()}
                    </div>
                    <div className="text-muted-foreground">
                      {quotaData.requests.remaining.toLocaleString()} remaining
                    </div>
                  </div>
                </div>
                <Progress 
                  value={usageAnalysis?.requestsUsagePercent || 0} 
                  className="h-3"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatPercentage((usageAnalysis?.requestsUsagePercent || 0) / 100)} used</span>
                  <span>{quotaData.requests.usageRate.toFixed(1)}/min rate</span>
                </div>
              </div>

              {/* Tokens Usage */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-600" />
                    <span className="font-medium">Tokens</span>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-mono">
                      {Math.round(quotaData.tokens.used / 1000)}k / {Math.round(quotaData.tokens.limit / 1000)}k
                    </div>
                    <div className="text-muted-foreground">
                      {Math.round(quotaData.tokens.remaining / 1000)}k remaining
                    </div>
                  </div>
                </div>
                <Progress 
                  value={usageAnalysis?.tokensUsagePercent || 0} 
                  className="h-3"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatPercentage((usageAnalysis?.tokensUsagePercent || 0) / 100)} used</span>
                  <span>{Math.round(quotaData.tokens.usageRate / 1000)}k/min rate</span>
                </div>
              </div>
            </div>

            {/* Reset Timer */}
            {usageAnalysis && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Quota resets in</span>
                </div>
                <span className="font-mono text-sm">
                  {formatDuration(usageAnalysis.timeToReset)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Detailed View */}
        {selectedView === 'detailed' && usagePrediction && (
          <div className="space-y-4">
            {/* Usage Prediction */}
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-primary" />
                <h4 className="font-medium">Usage Prediction</h4>
                <Badge variant="outline" className="text-xs">
                  {formatPercentage(usagePrediction.confidence)} confidence
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Time to Exhaustion</div>
                  <div className="font-mono text-lg">
                    {usagePrediction.timeToExhaustion > 0 ? 
                      formatDuration(usagePrediction.timeToExhaustion) : 
                      'Never at current rate'
                    }
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Recommended Strategy</div>
                  <Badge 
                    variant="outline" 
                    className={cn('capitalize', {
                      'border-green-200 text-green-700 bg-green-50': usagePrediction.recommendedStrategy === 'aggressive',
                      'border-yellow-200 text-yellow-700 bg-yellow-50': usagePrediction.recommendedStrategy === 'balanced',
                      'border-red-200 text-red-700 bg-red-50': usagePrediction.recommendedStrategy === 'conservative'
                    })}
                  >
                    {usagePrediction.recommendedStrategy}
                  </Badge>
                </div>
              </div>

              {usagePrediction.factors.length > 0 && (
                <div className="mt-3">
                  <div className="text-sm text-muted-foreground mb-2">Prediction Factors</div>
                  <div className="space-y-1">
                    {usagePrediction.factors.map((factor, index) => (
                      <div key={index} className="text-xs flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                        {factor}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recommendations */}
            {showRecommendations && (
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4 text-blue-600" />
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">Optimization Recommendations</h4>
                </div>
                
                <div className="space-y-2 text-sm">
                  {usageAnalysis && usageAnalysis.overallUsage > 80 && (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-3 w-3 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span>Consider reducing batch size or switching to conservative processing strategy</span>
                    </div>
                  )}
                  
                  {quotaData.requests.usageRate > quotaData.tokens.usageRate / 1000 && (
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Request rate is well balanced with token usage</span>
                    </div>
                  )}
                  
                  {usagePrediction.timeToExhaustion > 0 && usagePrediction.timeToExhaustion < 600000 && (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-3 w-3 text-red-600 mt-0.5 flex-shrink-0" />
                      <span>Quota exhaustion predicted within 10 minutes - consider pausing processing</span>
                    </div>
                  )}
                </div>

                {onStrategyRecommendation && (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onStrategyRecommendation(usagePrediction.recommendedStrategy)}
                      className="text-xs"
                    >
                      Apply {usagePrediction.recommendedStrategy} strategy
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Trends View */}
        {selectedView === 'trends' && showHistoricalTrends && quotaData.historical && (
          <div className="space-y-4">
            <div className="text-center text-muted-foreground">
              <PieChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Historical trends visualization would be implemented here</p>
              <p className="text-xs">Showing {quotaData.historical.length} data points</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
