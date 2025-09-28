import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { backgroundEmbeddingService } from '@/services/backgroundEmbeddingService';
import { resilientEmbeddingService } from '@/services/resilientEmbeddingService';
import { AlertCircle, CheckCircle, Clock, RefreshCw, Zap } from 'lucide-react';
import { toast } from 'sonner';

export function EmbeddingServiceStatus() {
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshStatus = async () => {
    setIsRefreshing(true);
    try {
      const queue = backgroundEmbeddingService.getQueueStatus();
      const health = resilientEmbeddingService.getHealthStatus();
      
      setQueueStatus(queue);
      setHealthStatus(health);
    } catch (error) {
      console.error('Failed to refresh embedding service status:', error);
      toast.error('Failed to refresh status');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshStatus();
    
    // Refresh every 10 seconds
    const interval = setInterval(refreshStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleResetCircuitBreaker = () => {
    try {
      resilientEmbeddingService.resetCircuitBreaker();
      toast.success('Circuit breaker reset successfully');
      refreshStatus();
    } catch (error) {
      toast.error('Failed to reset circuit breaker');
    }
  };

  const handleClearQueue = () => {
    try {
      backgroundEmbeddingService.clearAllTasks();
      toast.success('Embedding queue cleared');
      refreshStatus();
    } catch (error) {
      toast.error('Failed to clear queue');
    }
  };

  const handlePauseResume = () => {
    try {
      if (queueStatus?.isProcessing) {
        backgroundEmbeddingService.pauseProcessing();
        toast.success('Embedding processing paused');
      } else {
        backgroundEmbeddingService.resumeProcessing();
        toast.success('Embedding processing resumed');
      }
      refreshStatus();
    } catch (error) {
      toast.error('Failed to pause/resume processing');
    }
  };

  if (!queueStatus || !healthStatus) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Loading embedding service status...
          </div>
        </CardContent>
      </Card>
    );
  }

  const getHealthBadge = () => {
    if (healthStatus.isHealthy) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Healthy</Badge>;
    } else {
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Unhealthy</Badge>;
    }
  };

  const getCircuitStateBadge = () => {
    const { circuitState } = healthStatus;
    switch (circuitState) {
      case 'CLOSED':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Closed</Badge>;
      case 'HALF_OPEN':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Half Open</Badge>;
      case 'OPEN':
        return <Badge variant="destructive">Open</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Embedding Service Status
            </CardTitle>
            <CardDescription>
              Background embedding generation and service health monitoring
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshStatus}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Service Health */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Service Health</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Overall Status</span>
              {getHealthBadge()}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Circuit Breaker</span>
              {getCircuitStateBadge()}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Failure Count</span>
              <Badge variant="outline">{healthStatus.failureCount}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Queue Size</span>
              <Badge variant="outline">{healthStatus.queueSize}</Badge>
            </div>
          </div>
          
          {healthStatus.recommendation && (
            <div className="mt-3 p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">{healthStatus.recommendation}</p>
            </div>
          )}
        </div>

        {/* Queue Status */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Background Queue</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Tasks</span>
              <Badge variant="outline">{queueStatus.totalTasks}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Processing Status</span>
              <Badge variant={queueStatus.isProcessing ? "default" : "secondary"}>
                {queueStatus.isProcessing ? (
                  <>
                    <Clock className="h-3 w-3 mr-1" />
                    Processing
                  </>
                ) : (
                  'Idle'
                )}
              </Badge>
            </div>
          </div>

          {queueStatus.priorityCounts && Object.keys(queueStatus.priorityCounts).length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-2">Tasks by Priority:</p>
              <div className="flex gap-2">
                {Object.entries(queueStatus.priorityCounts).map(([priority, count]) => (
                  <Badge key={priority} variant="outline" className="text-xs">
                    {priority}: {count as number}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Actions</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetCircuitBreaker}
              disabled={healthStatus.circuitState === 'CLOSED'}
            >
              Reset Circuit Breaker
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearQueue}
              disabled={queueStatus.totalTasks === 0}
            >
              Clear Queue
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handlePauseResume}
            >
              {queueStatus.isProcessing ? 'Pause' : 'Resume'} Processing
            </Button>
          </div>
        </div>

        {/* Last Failure Info */}
        {healthStatus.lastFailureTime && (
          <div className="text-xs text-muted-foreground">
            Last failure: {new Date(healthStatus.lastFailureTime).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
