/**
 * Progress Tracking Demo Component
 * Phase 3: Batch Upload Optimization
 * 
 * Demonstrates the enhanced progress tracking capabilities.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Loader2,
  BarChart3,
  Zap,
  DollarSign
} from 'lucide-react';
import { 
  useProgressTracking,
  useProgressFormatting,
  ProgressMetrics,
  ETACalculation,
  ProgressAlert
} from '@/lib/progress-tracking';

interface ProgressTrackingDemoProps {
  sessionId: string | null;
  isActive: boolean;
}

export function ProgressTrackingDemo({ sessionId, isActive }: ProgressTrackingDemoProps) {
  const {
    metrics,
    eta,
    alerts,
    isTracking,
    dismissAlert
  } = useProgressTracking(sessionId, {
    mode: 'enhanced',
    enableAnalytics: true,
    enablePersistence: true
  });

  const {
    formatDuration,
    formatThroughput,
    formatCost,
    formatPercentage,
    getProgressColor,
    getQualityColor
  } = useProgressFormatting();

  if (!isActive || !sessionId) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Enhanced Progress Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Start a batch upload to see enhanced progress tracking in action.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!isTracking || !metrics) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Initializing Progress Tracking...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Setting up enhanced progress tracking for session {sessionId?.slice(0, 8)}...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <Alert key={alert.id} variant={alert.severity === 'high' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{alert.message}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissAlert(alert.id)}
                >
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Main Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Batch Progress Overview
            </span>
            <Badge variant="outline">
              {metrics.filesCompleted + metrics.filesFailed} / {metrics.totalFiles}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span>{metrics.progressPercentage.toFixed(1)}%</span>
            </div>
            <Progress 
              value={metrics.progressPercentage} 
              className="h-2"
              style={{ 
                '--progress-background': getProgressColor(metrics.progressPercentage) 
              } as React.CSSProperties}
            />
          </div>

          {/* File Status Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="font-semibold">{metrics.filesCompleted}</span>
              </div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-blue-600">
                <Loader2 className="h-4 w-4" />
                <span className="font-semibold">{metrics.filesProcessing}</span>
              </div>
              <p className="text-xs text-muted-foreground">Processing</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-600">
                <Clock className="h-4 w-4" />
                <span className="font-semibold">{metrics.filesPending}</span>
              </div>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-red-600">
                <XCircle className="h-4 w-4" />
                <span className="font-semibold">{metrics.filesFailed}</span>
              </div>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Time & ETA */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Time & ETA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Elapsed Time</span>
              <span className="text-sm font-medium">
                {formatDuration(metrics.elapsedTimeMs)}
              </span>
            </div>
            {eta && (
              <>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Remaining</span>
                  <span className="text-sm font-medium">
                    {formatDuration(eta.estimatedTimeRemainingMs)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">ETA Method</span>
                  <Badge variant="secondary" className="text-xs">
                    {eta.method}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Confidence</span>
                  <span className="text-sm font-medium">
                    {formatPercentage(eta.confidence)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Performance Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Throughput</span>
              <span className="text-sm font-medium">
                {formatThroughput(metrics.currentThroughput)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Peak Throughput</span>
              <span className="text-sm font-medium">
                {formatThroughput(metrics.peakThroughput)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Quality Score</span>
              <div className="flex items-center gap-2">
                <span 
                  className="text-sm font-medium"
                  style={{ color: getQualityColor(metrics.qualityScore) }}
                >
                  {formatPercentage(metrics.qualityScore)}
                </span>
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getQualityColor(metrics.qualityScore) }}
                />
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">API Success Rate</span>
              <span className="text-sm font-medium">
                {formatPercentage(metrics.apiSuccessRate)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost & Efficiency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            Cost & Efficiency
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-lg font-semibold">
                {formatCost(metrics.estimatedCost)}
              </div>
              <p className="text-xs text-muted-foreground">Total Cost</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">
                {formatCost(metrics.costPerFile)}
              </div>
              <p className="text-xs text-muted-foreground">Cost per File</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">
                {metrics.tokensPerFile.toFixed(0)}
              </div>
              <p className="text-xs text-muted-foreground">Tokens per File</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">
                {metrics.apiEfficiency.toFixed(0)}
              </div>
              <p className="text-xs text-muted-foreground">API Efficiency</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate Limiting Status */}
      {metrics.rateLimitHits > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4" />
              Rate Limiting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-orange-600">
                  {metrics.rateLimitHits}
                </div>
                <p className="text-xs text-muted-foreground">Rate Limit Hits</p>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {formatDuration(metrics.rateLimitDelayMs)}
                </div>
                <p className="text-xs text-muted-foreground">Total Delay</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
