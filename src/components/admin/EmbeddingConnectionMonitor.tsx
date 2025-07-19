/**
 * Embedding Connection Monitor
 * Real-time monitoring of connection health and performance metrics
 * Phase 1: Embedding Success Rate Monitoring Dashboard - Task 2
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Zap,
  RefreshCw,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { embeddingMetricsRealtimeService } from '@/services/embeddingMetricsRealtimeService';
import { embeddingMetricsErrorHandler } from '@/services/embeddingMetricsErrorHandler';

interface ConnectionMetrics {
  latency: number;
  uptime: number;
  reconnectCount: number;
  lastReconnect: Date | null;
  dataTransferred: number;
  messagesReceived: number;
}

export function EmbeddingConnectionMonitor() {
  const [connectionStatus, setConnectionStatus] = useState(embeddingMetricsRealtimeService.getConnectionStatus());
  const [metrics, setMetrics] = useState<ConnectionMetrics>({
    latency: 0,
    uptime: 0,
    reconnectCount: 0,
    lastReconnect: null,
    dataTransferred: 0,
    messagesReceived: 0
  });
  const [errorStats, setErrorStats] = useState(embeddingMetricsErrorHandler.getErrorStatistics());
  const [isExpanded, setIsExpanded] = useState(false);

  // Update metrics periodically
  useEffect(() => {
    const updateMetrics = () => {
      setConnectionStatus(embeddingMetricsRealtimeService.getConnectionStatus());
      setErrorStats(embeddingMetricsErrorHandler.getErrorStatistics());
      
      // Simulate some metrics (in a real implementation, these would come from the service)
      setMetrics(prev => ({
        ...prev,
        uptime: prev.uptime + 1,
        latency: Math.random() * 100 + 50, // 50-150ms
        messagesReceived: prev.messagesReceived + Math.floor(Math.random() * 3)
      }));
    };

    const interval = setInterval(updateMetrics, 1000);
    return () => clearInterval(interval);
  }, []);

  const getConnectionHealthScore = (): number => {
    let score = 100;
    
    // Deduct points for disconnection
    if (!connectionStatus.isConnected) score -= 50;
    
    // Deduct points for high latency
    if (metrics.latency > 200) score -= 20;
    else if (metrics.latency > 100) score -= 10;
    
    // Deduct points for recent errors
    if (errorStats.totalErrors > 10) score -= 20;
    else if (errorStats.totalErrors > 5) score -= 10;
    
    // Deduct points for reconnection attempts
    if (connectionStatus.reconnectAttempts > 3) score -= 15;
    else if (connectionStatus.reconnectAttempts > 1) score -= 5;
    
    return Math.max(0, score);
  };

  const healthScore = getConnectionHealthScore();
  const healthStatus = healthScore >= 80 ? 'excellent' : healthScore >= 60 ? 'good' : healthScore >= 40 ? 'fair' : 'poor';

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'fair': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getHealthBadgeVariant = (status: string) => {
    switch (status) {
      case 'excellent': return 'default';
      case 'good': return 'secondary';
      case 'fair': return 'outline';
      case 'poor': return 'destructive';
      default: return 'outline';
    }
  };

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Connection Monitor
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={getHealthBadgeVariant(healthStatus)} className={getHealthColor(healthStatus)}>
              {healthStatus.toUpperCase()}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Health Score */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Connection Health</span>
            <span className={`text-sm font-bold ${getHealthColor(healthStatus)}`}>
              {healthScore}/100
            </span>
          </div>
          <Progress value={healthScore} className="h-2" />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              {connectionStatus.isConnected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="text-sm font-medium">
              {connectionStatus.isConnected ? 'Connected' : 'Disconnected'}
            </p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground">Latency</p>
            <p className="text-sm font-medium">{metrics.latency.toFixed(0)}ms</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Zap className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-xs text-muted-foreground">Channels</p>
            <p className="text-sm font-medium">{connectionStatus.activeChannels}</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <RefreshCw className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-xs text-muted-foreground">Reconnects</p>
            <p className="text-sm font-medium">{connectionStatus.reconnectAttempts}</p>
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="space-y-4 pt-4 border-t">
            {/* Detailed Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Connection Metrics</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Uptime</span>
                    <span className="font-mono">{formatUptime(metrics.uptime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active Subscriptions</span>
                    <span className="font-mono">{connectionStatus.activeSubscriptions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Messages Received</span>
                    <span className="font-mono">{metrics.messagesReceived}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data Transferred</span>
                    <span className="font-mono">{formatBytes(metrics.dataTransferred)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-sm">Error Statistics</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Errors</span>
                    <span className="font-mono">{errorStats.totalErrors}</span>
                  </div>
                  {Object.entries(errorStats.errorsByType).map(([type, count]) => (
                    <div key={type} className="flex justify-between">
                      <span className="text-muted-foreground capitalize">{type.replace('_', ' ')}</span>
                      <span className="font-mono">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Errors */}
            {errorStats.recentErrors.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Recent Errors</h4>
                <div className="space-y-2">
                  {errorStats.recentErrors.slice(0, 3).map((error, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                        <span className="capitalize">{error.operation}</span>
                        <Badge variant="outline" className="text-xs">
                          {error.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{error.count}x</span>
                        <span>{error.timestamp.toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => embeddingMetricsErrorHandler.clearErrorStatistics()}
              >
                Clear Error Stats
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Reset Connection
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
