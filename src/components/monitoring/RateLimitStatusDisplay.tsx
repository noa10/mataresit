/**
 * Real-time Rate Limit Status Display Component
 * Phase 3: Batch Upload Optimization - Priority 3.2.1
 * 
 * Provides comprehensive real-time monitoring of rate limiting status including:
 * - Current rate limit usage and remaining quota
 * - Backoff timers and permission queue status
 * - Visual health indicators and trend analysis
 * - Adaptive scaling status and recommendations
 */

import React, { useState, useEffect } from 'react';
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
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Timer,
  RefreshCw,
  Settings,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProgressFormatting } from '@/lib/progress-tracking';
import type { 
  RateLimitStatus, 
  AdaptiveMetrics, 
  ProcessingStrategy,
  RateLimitEvent 
} from '@/lib/rate-limiting';

interface RateLimitStatusDisplayProps {
  status: RateLimitStatus | null;
  metrics?: AdaptiveMetrics;
  strategy?: ProcessingStrategy;
  events?: RateLimitEvent[];
  className?: string;
  compact?: boolean;
  showAdvanced?: boolean;
  onStrategyChange?: (strategy: ProcessingStrategy) => void;
  onRefresh?: () => void;
}

export function RateLimitStatusDisplay({
  status,
  metrics,
  strategy = 'balanced',
  events = [],
  className,
  compact = false,
  showAdvanced = false,
  onStrategyChange,
  onRefresh
}: RateLimitStatusDisplayProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showEventHistory, setShowEventHistory] = useState(false);
  
  const { formatDuration, formatPercentage } = useProgressFormatting();

  // Calculate health status based on current metrics
  const getHealthStatus = () => {
    if (!status) return { level: 'unknown', color: 'gray', icon: Info };
    
    if (status.isRateLimited) {
      return { level: 'limited', color: 'orange', icon: AlertTriangle };
    }
    
    const requestsUsage = status.requestsRemaining / 100; // Assuming max 100 requests
    const tokensUsage = status.tokensRemaining / 150000; // Assuming max 150k tokens
    
    if (requestsUsage < 0.2 || tokensUsage < 0.2) {
      return { level: 'warning', color: 'yellow', icon: Clock };
    }
    
    return { level: 'healthy', color: 'green', icon: CheckCircle };
  };

  const healthStatus = getHealthStatus();

  // Calculate usage percentages
  const getUsagePercentages = () => {
    if (!status) return { requests: 0, tokens: 0 };
    
    // Estimate max values based on strategy
    const maxRequests = strategy === 'conservative' ? 60 : strategy === 'aggressive' ? 120 : 90;
    const maxTokens = strategy === 'conservative' ? 100000 : strategy === 'aggressive' ? 200000 : 150000;
    
    return {
      requests: Math.max(0, ((maxRequests - status.requestsRemaining) / maxRequests) * 100),
      tokens: Math.max(0, ((maxTokens - status.tokensRemaining) / maxTokens) * 100)
    };
  };

  const usagePercentages = getUsagePercentages();

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

  // Get recent events for trend analysis
  const recentEvents = events.slice(-10);
  const recentErrors = recentEvents.filter(e => e.type === 'permission_denied').length;
  const trendDirection = recentErrors > 3 ? 'down' : recentErrors < 1 ? 'up' : 'stable';

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 p-2 rounded-lg border', className)}>
        <healthStatus.icon 
          className={cn('h-4 w-4', {
            'text-green-600': healthStatus.color === 'green',
            'text-yellow-600': healthStatus.color === 'yellow',
            'text-orange-600': healthStatus.color === 'orange',
            'text-gray-600': healthStatus.color === 'gray'
          })}
        />
        <span className="text-sm font-medium">
          {status?.isRateLimited ? 'Rate Limited' : 'Active'}
        </span>
        {status?.isRateLimited && (
          <Badge variant="outline" className="text-xs">
            {formatDuration(status.backoffMs)} delay
          </Badge>
        )}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{status?.requestsRemaining || 0} req</span>
          <span>•</span>
          <span>{Math.round((status?.tokensRemaining || 0) / 1000)}k tok</span>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <healthStatus.icon 
              className={cn('h-5 w-5', {
                'text-green-600': healthStatus.color === 'green',
                'text-yellow-600': healthStatus.color === 'yellow',
                'text-orange-600': healthStatus.color === 'orange',
                'text-gray-600': healthStatus.color === 'gray'
              })}
            />
            <CardTitle className="text-lg">Rate Limit Status</CardTitle>
            <Badge 
              variant="outline"
              className={cn({
                'border-green-200 text-green-700 bg-green-50': healthStatus.color === 'green',
                'border-yellow-200 text-yellow-700 bg-yellow-50': healthStatus.color === 'yellow',
                'border-orange-200 text-orange-700 bg-orange-50': healthStatus.color === 'orange',
                'border-gray-200 text-gray-700 bg-gray-50': healthStatus.color === 'gray'
              })}
            >
              {healthStatus.level}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {trendDirection !== 'stable' && (
              <Tooltip>
                <TooltipTrigger>
                  {trendDirection === 'up' ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  <p>Performance trend: {trendDirection}</p>
                </TooltipContent>
              </Tooltip>
            )}
            
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
          Real-time API rate limiting and quota monitoring
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current Status Alert */}
        <AnimatePresence>
          {status?.isRateLimited && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="font-medium text-orange-700 dark:text-orange-300">
                  Rate Limited Active
                </span>
              </div>
              <p className="text-sm text-orange-600 mt-1">
                Processing delayed by {formatDuration(status.backoffMs)}. 
                {status.consecutiveErrors > 0 && ` ${status.consecutiveErrors} consecutive errors detected.`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quota Usage Meters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Requests Usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Requests
              </span>
              <span className="font-mono">
                {status?.requestsRemaining || 0} remaining
              </span>
            </div>
            <Progress 
              value={usagePercentages.requests} 
              className="h-2"
            />
            <div className="text-xs text-muted-foreground">
              {formatPercentage(usagePercentages.requests / 100)} of quota used
            </div>
          </div>

          {/* Tokens Usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Tokens
              </span>
              <span className="font-mono">
                {Math.round((status?.tokensRemaining || 0) / 1000)}k remaining
              </span>
            </div>
            <Progress 
              value={usagePercentages.tokens} 
              className="h-2"
            />
            <div className="text-xs text-muted-foreground">
              {formatPercentage(usagePercentages.tokens / 100)} of quota used
            </div>
          </div>
        </div>

        {/* Reset Timer */}
        {status?.resetTime && (
          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Quota resets in</span>
            </div>
            <span className="font-mono text-sm">
              {formatDuration(status.resetTime - Date.now())}
            </span>
          </div>
        )}

        {/* Advanced Metrics */}
        {showAdvanced && metrics && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Performance Metrics
              </h4>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Success Rate</span>
                  <div className="font-mono">{formatPercentage(metrics.successRate)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Throughput</span>
                  <div className="font-mono">{metrics.throughput.toFixed(1)}/min</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Response</span>
                  <div className="font-mono">{metrics.averageResponseTime.toFixed(0)}ms</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Error Rate</span>
                  <div className="font-mono">{formatPercentage(metrics.errorRate)}</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Event History Toggle */}
        {events.length > 0 && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEventHistory(!showEventHistory)}
            >
              {showEventHistory ? 'Hide' : 'Show'} Event History ({events.length})
            </Button>
          </div>
        )}

        {/* Event History */}
        <AnimatePresence>
          {showEventHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <Separator />
              <div className="max-h-32 overflow-y-auto space-y-1">
                {recentEvents.map((event, index) => (
                  <div key={index} className="text-xs p-2 rounded bg-muted/30 flex items-center justify-between">
                    <span className={cn({
                      'text-green-600': event.type === 'permission_granted' || event.type === 'success',
                      'text-orange-600': event.type === 'permission_denied',
                      'text-red-600': event.type === 'error'
                    })}>
                      {event.type.replace('_', ' ')}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
