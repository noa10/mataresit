import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Clock,
  Activity,
  CheckCircle,
  XCircle,
  Users,
  Zap,
  TrendingUp,
  AlertTriangle,
  Timer,
  Database
} from 'lucide-react';
import { useQueueMetrics } from '@/hooks/useQueueMetrics';

interface EmbeddingQueueMetricsProps {
  className?: string;
  showDetailed?: boolean;
}

export function EmbeddingQueueMetrics({ className = "", showDetailed = false }: EmbeddingQueueMetricsProps) {
  const {
    queueMetrics,
    performanceData,
    isLoading,
    error
  } = useQueueMetrics(true, 30000); // Auto-refresh every 30 seconds

  const getQueueHealthStatus = () => {
    if (!queueMetrics || !performanceData) return 'unknown';

    const healthScore = performanceData.queue_health_score;

    if (healthScore >= 80) return 'healthy';
    if (healthScore >= 60) return 'warning';
    return 'critical';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'healthy': return 'default';
      case 'warning': return 'secondary';
      case 'critical': return 'destructive';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">Queue metrics unavailable</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!queueMetrics) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Database className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Queue system not initialized</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const healthStatus = getQueueHealthStatus();

  if (!showDetailed) {
    // Compact view for overview section
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Queue Status</p>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(healthStatus)}`} />
                <Badge variant={getStatusBadgeVariant(healthStatus)}>
                  {healthStatus}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{queueMetrics.total_pending}</div>
              <div className="text-xs text-muted-foreground">pending</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium">{queueMetrics.active_workers}</div>
              <div className="text-muted-foreground">workers</div>
            </div>
            <div className="text-center">
              <div className="font-medium">{queueMetrics.total_processing}</div>
              <div className="text-muted-foreground">processing</div>
            </div>
            <div className="text-center">
              <div className="font-medium">{performanceData?.success_rate.toFixed(1)}%</div>
              <div className="text-muted-foreground">success</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Detailed view for dedicated queue section
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Queue Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue Health</CardTitle>
            <div className={`w-3 h-3 rounded-full ${getStatusColor(healthStatus)}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{healthStatus}</div>
            <p className="text-xs text-muted-foreground">
              {queueMetrics.active_workers} active workers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Items</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueMetrics.total_pending}</div>
            {queueMetrics.oldest_pending_age_hours > 0 && (
              <p className="text-xs text-muted-foreground">
                Oldest: {queueMetrics.oldest_pending_age_hours.toFixed(1)}h ago
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Throughput</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceData?.throughput_per_hour || 0}</div>
            <p className="text-xs text-muted-foreground">items/hour</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceData?.success_rate.toFixed(1)}%</div>
            <Progress value={performanceData?.success_rate || 0} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Processing Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Processing Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Processing</span>
              <span className="font-mono">{queueMetrics.total_processing}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Completed</span>
              <span className="font-mono text-green-600">{queueMetrics.total_completed}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Failed</span>
              <span className="font-mono text-red-600">{queueMetrics.total_failed}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Rate Limited</span>
              <span className="font-mono text-yellow-600">{queueMetrics.total_rate_limited}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Avg Processing Time</span>
              <span className="font-mono">{(queueMetrics.avg_processing_time_ms / 1000).toFixed(1)}s</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Worker Efficiency</span>
              <span className="font-mono">{performanceData?.worker_efficiency.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Queue Wait Time</span>
              <span className="font-mono">
                {performanceData?.avg_queue_wait_time_ms 
                  ? (performanceData.avg_queue_wait_time_ms / 60000).toFixed(1) + 'm'
                  : '0m'
                }
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Worker Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Active Workers</span>
              <span className="font-mono text-green-600">{queueMetrics.active_workers}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Items per Worker</span>
              <span className="font-mono">
                {queueMetrics.active_workers > 0 
                  ? Math.ceil(queueMetrics.total_pending / queueMetrics.active_workers)
                  : 0
                }
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Est. Completion</span>
              <span className="font-mono text-sm">
                {queueMetrics.avg_processing_time_ms > 0 && queueMetrics.active_workers > 0
                  ? Math.ceil((queueMetrics.total_pending * queueMetrics.avg_processing_time_ms) / (queueMetrics.active_workers * 60000)) + 'm'
                  : 'N/A'
                }
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
