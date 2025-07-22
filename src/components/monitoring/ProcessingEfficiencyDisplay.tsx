/**
 * Processing Efficiency Metrics Display Component
 * Phase 3: Batch Upload Optimization - Priority 3.2.3
 * 
 * Comprehensive processing efficiency metrics including:
 * - Throughput rates and processing speed analytics
 * - Success rates and error analysis
 * - Processing time analytics and optimization insights
 * - Performance trend tracking and recommendations
 */

import React, { useState, useMemo } from 'react';
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
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  Target,
  Zap,
  AlertCircle,
  CheckCircle,
  BarChart3,
  PieChart,
  RefreshCw,
  Lightbulb,
  Timer,
  Gauge
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProgressFormatting } from '@/lib/progress-tracking';

interface ProcessingEfficiencyData {
  // Throughput metrics
  currentThroughput: number; // files per minute
  peakThroughput: number;
  averageThroughput: number;
  throughputTrend: 'increasing' | 'decreasing' | 'stable';
  
  // Success and error metrics
  successRate: number; // 0-1
  errorRate: number; // 0-1
  retryRate: number; // 0-1
  totalProcessed: number;
  totalSuccessful: number;
  totalFailed: number;
  totalRetries: number;
  
  // Processing time analytics
  averageProcessingTime: number; // milliseconds
  medianProcessingTime: number;
  minProcessingTime: number;
  maxProcessingTime: number;
  processingTimeVariance: number;
  
  // API efficiency metrics
  apiCallsPerFile: number;
  tokensPerFile: number;
  costPerFile: number;
  apiEfficiency: number; // tokens per API call
  
  // Quality metrics
  qualityScore: number; // 0-1
  qualityTrend: 'improving' | 'declining' | 'stable';
  
  // Historical data
  throughputHistory?: { timestamp: Date; throughput: number }[];
  processingTimeHistory?: { timestamp: Date; processingTime: number }[];
  
  // Session info
  sessionDuration: number; // milliseconds
  estimatedTimeRemaining?: number;
}

interface ProcessingEfficiencyDisplayProps {
  data: ProcessingEfficiencyData | null;
  className?: string;
  showRecommendations?: boolean;
  showTrends?: boolean;
  onRefresh?: () => void;
  onOptimizationRecommendation?: (recommendation: string) => void;
}

export function ProcessingEfficiencyDisplay({
  data,
  className,
  showRecommendations = true,
  showTrends = false,
  onRefresh,
  onOptimizationRecommendation
}: ProcessingEfficiencyDisplayProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedView, setSelectedView] = useState<'overview' | 'detailed' | 'trends'>('overview');
  
  const { formatDuration, formatPercentage } = useProgressFormatting();

  // Calculate performance grade and insights
  const performanceAnalysis = useMemo(() => {
    if (!data) return null;

    let score = 0;
    const insights: string[] = [];
    const recommendations: string[] = [];

    // Throughput analysis (30% weight)
    const throughputScore = Math.min(100, (data.currentThroughput / 2) * 100); // 2 files/min = 100%
    score += throughputScore * 0.3;
    
    if (data.currentThroughput < 0.5) {
      insights.push('Low throughput detected');
      recommendations.push('Consider increasing concurrent processing');
    } else if (data.currentThroughput > 1.5) {
      insights.push('High throughput achieved');
    }

    // Success rate analysis (25% weight)
    const successScore = data.successRate * 100;
    score += successScore * 0.25;
    
    if (data.successRate < 0.9) {
      insights.push('Success rate below optimal');
      recommendations.push('Review error patterns and implement retry logic');
    }

    // Processing time consistency (20% weight)
    const consistencyScore = Math.max(0, 100 - (data.processingTimeVariance / 1000)); // Lower variance = higher score
    score += consistencyScore * 0.2;
    
    if (data.processingTimeVariance > 5000) {
      insights.push('High processing time variance');
      recommendations.push('Optimize for consistent processing times');
    }

    // API efficiency (15% weight)
    const efficiencyScore = Math.min(100, (data.apiEfficiency / 1000) * 100); // 1000 tokens/call = 100%
    score += efficiencyScore * 0.15;
    
    if (data.apiEfficiency < 500) {
      insights.push('Low API efficiency');
      recommendations.push('Optimize API usage to reduce calls per file');
    }

    // Quality score (10% weight)
    const qualityScore = data.qualityScore * 100;
    score += qualityScore * 0.1;

    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    let gradeColor: string;
    
    if (score >= 90) {
      grade = 'A';
      gradeColor = 'green';
    } else if (score >= 80) {
      grade = 'B';
      gradeColor = 'blue';
    } else if (score >= 70) {
      grade = 'C';
      gradeColor = 'yellow';
    } else if (score >= 60) {
      grade = 'D';
      gradeColor = 'orange';
    } else {
      grade = 'F';
      gradeColor = 'red';
    }

    return {
      score: Math.round(score),
      grade,
      gradeColor,
      insights,
      recommendations
    };
  }, [data]);

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

  if (!data) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-center text-muted-foreground">
            <Gauge className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No processing efficiency data available</p>
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
            <Gauge className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Processing Efficiency</CardTitle>
            {performanceAnalysis && (
              <Badge 
                variant="outline"
                className={cn('text-sm font-bold', {
                  'border-green-200 text-green-700 bg-green-50': performanceAnalysis.gradeColor === 'green',
                  'border-blue-200 text-blue-700 bg-blue-50': performanceAnalysis.gradeColor === 'blue',
                  'border-yellow-200 text-yellow-700 bg-yellow-50': performanceAnalysis.gradeColor === 'yellow',
                  'border-orange-200 text-orange-700 bg-orange-50': performanceAnalysis.gradeColor === 'orange',
                  'border-red-200 text-red-700 bg-red-50': performanceAnalysis.gradeColor === 'red'
                })}
              >
                Grade {performanceAnalysis.grade}
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
          Real-time processing performance analytics and optimization insights
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overview View */}
        {selectedView === 'overview' && (
          <div className="space-y-4">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Throughput */}
              <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Activity className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Throughput</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {data.currentThroughput.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground">files/min</div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  {data.throughputTrend === 'increasing' && <TrendingUp className="h-3 w-3 text-green-600" />}
                  {data.throughputTrend === 'decreasing' && <TrendingDown className="h-3 w-3 text-red-600" />}
                  <span className="text-xs capitalize">{data.throughputTrend}</span>
                </div>
              </div>

              {/* Success Rate */}
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Success Rate</span>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {formatPercentage(data.successRate)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {data.totalSuccessful}/{data.totalProcessed} files
                </div>
              </div>

              {/* Avg Processing Time */}
              <div className="text-center p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium">Avg Time</span>
                </div>
                <div className="text-2xl font-bold text-orange-600">
                  {(data.averageProcessingTime / 1000).toFixed(1)}s
                </div>
                <div className="text-xs text-muted-foreground">per file</div>
              </div>

              {/* API Efficiency */}
              <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Zap className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium">API Efficiency</span>
                </div>
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round(data.apiEfficiency)}
                </div>
                <div className="text-xs text-muted-foreground">tokens/call</div>
              </div>
            </div>

            {/* Performance Score */}
            {performanceAnalysis && (
              <div className="p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">Performance Score</h4>
                  </div>
                  <Badge 
                    variant="outline"
                    className={cn('text-lg font-bold px-3 py-1', {
                      'border-green-200 text-green-700 bg-green-50': performanceAnalysis.gradeColor === 'green',
                      'border-blue-200 text-blue-700 bg-blue-50': performanceAnalysis.gradeColor === 'blue',
                      'border-yellow-200 text-yellow-700 bg-yellow-50': performanceAnalysis.gradeColor === 'yellow',
                      'border-orange-200 text-orange-700 bg-orange-50': performanceAnalysis.gradeColor === 'orange',
                      'border-red-200 text-red-700 bg-red-50': performanceAnalysis.gradeColor === 'red'
                    })}
                  >
                    {performanceAnalysis.score}/100
                  </Badge>
                </div>
                
                <Progress 
                  value={performanceAnalysis.score} 
                  className="h-3 mb-3"
                />

                {performanceAnalysis.insights.length > 0 && (
                  <div className="space-y-1">
                    {performanceAnalysis.insights.map((insight, index) => (
                      <div key={index} className="text-sm flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                        {insight}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Detailed View */}
        {selectedView === 'detailed' && (
          <div className="space-y-4">
            {/* Processing Time Analysis */}
            <div className="p-4 rounded-lg border">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Processing Time Analysis
              </h4>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Average</span>
                  <div className="font-mono text-lg">{(data.averageProcessingTime / 1000).toFixed(1)}s</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Median</span>
                  <div className="font-mono text-lg">{(data.medianProcessingTime / 1000).toFixed(1)}s</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Min</span>
                  <div className="font-mono text-lg">{(data.minProcessingTime / 1000).toFixed(1)}s</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Max</span>
                  <div className="font-mono text-lg">{(data.maxProcessingTime / 1000).toFixed(1)}s</div>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-sm text-muted-foreground mb-1">Consistency Score</div>
                <Progress 
                  value={Math.max(0, 100 - (data.processingTimeVariance / 100))} 
                  className="h-2"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Lower variance indicates more consistent processing times
                </div>
              </div>
            </div>

            {/* Error Analysis */}
            <div className="p-4 rounded-lg border">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Error Analysis
              </h4>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{data.totalFailed}</div>
                  <div className="text-muted-foreground">Failed</div>
                  <div className="text-xs">{formatPercentage(data.errorRate)} rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{data.totalRetries}</div>
                  <div className="text-muted-foreground">Retries</div>
                  <div className="text-xs">{formatPercentage(data.retryRate)} rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{data.totalSuccessful}</div>
                  <div className="text-muted-foreground">Successful</div>
                  <div className="text-xs">{formatPercentage(data.successRate)} rate</div>
                </div>
              </div>
            </div>

            {/* Cost Analysis */}
            <div className="p-4 rounded-lg border">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Cost Analysis
              </h4>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Cost per File</span>
                  <div className="font-mono text-lg">${data.costPerFile.toFixed(4)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Tokens per File</span>
                  <div className="font-mono text-lg">{Math.round(data.tokensPerFile)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">API Calls per File</span>
                  <div className="font-mono text-lg">{data.apiCallsPerFile.toFixed(1)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trends View */}
        {selectedView === 'trends' && showTrends && (
          <div className="space-y-4">
            <div className="text-center text-muted-foreground">
              <PieChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Performance trends visualization would be implemented here</p>
              <p className="text-xs">
                Showing throughput and processing time trends over time
              </p>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {showRecommendations && performanceAnalysis && performanceAnalysis.recommendations.length > 0 && (
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-blue-600" />
              <h4 className="font-medium text-blue-900 dark:text-blue-100">Optimization Recommendations</h4>
            </div>
            
            <div className="space-y-2 text-sm">
              {performanceAnalysis.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start gap-2">
                  <CheckCircle className="h-3 w-3 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>{recommendation}</span>
                </div>
              ))}
            </div>

            {onOptimizationRecommendation && (
              <div className="mt-3 flex gap-2">
                {performanceAnalysis.recommendations.slice(0, 2).map((recommendation, index) => (
                  <Button
                    key={index}
                    size="sm"
                    variant="outline"
                    onClick={() => onOptimizationRecommendation(recommendation)}
                    className="text-xs"
                  >
                    Apply
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
