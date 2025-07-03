/**
 * Cache Debug Info Component
 * Shows React Query cache statistics for debugging performance optimizations
 */

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { useCacheInvalidation } from '@/services/cacheInvalidationService';
import { Database, RefreshCw, Trash2, Clock, CheckCircle, XCircle } from 'lucide-react';

interface CacheDebugInfoProps {
  className?: string;
}

export function CacheDebugInfo({ className }: CacheDebugInfoProps) {
  const queryClient = useQueryClient();
  const { usageStats, dataUpdatedAt, isLoading, error } = useSubscription();
  const { refreshAllCaches, getCacheStats } = useCacheInvalidation();

  const queryCache = queryClient.getQueryCache();
  const queries = queryCache.getAll();

  // Filter usage stats queries
  const usageQueries = queries.filter(query => 
    query.queryKey.includes('subscription') && query.queryKey.includes('usage')
  );

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getQueryStatus = (query: any) => {
    if (query.state.status === 'success') return 'success';
    if (query.state.status === 'error') return 'error';
    if (query.state.status === 'pending') return 'loading';
    return 'idle';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'loading': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleClearCache = () => {
    queryClient.clear();
  };

  const handleRefreshAll = async () => {
    await refreshAllCaches();
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              React Query Cache Debug
            </CardTitle>
            <CardDescription>
              Performance optimization cache statistics
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCache}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear Cache
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage Stats Query Status */}
        <div className="space-y-2">
          <h4 className="font-medium">Usage Statistics Query</h4>
          <div className="flex items-center gap-2">
            {getStatusIcon(isLoading ? 'loading' : error ? 'error' : 'success')}
            <span className="text-sm">
              {isLoading ? 'Loading...' : error ? `Error: ${error}` : 'Success'}
            </span>
            {dataUpdatedAt && (
              <Badge variant="secondary" className="text-xs">
                Updated: {formatTime(dataUpdatedAt)}
              </Badge>
            )}
          </div>
          {usageStats && (
            <div className="text-xs text-muted-foreground">
              Receipts: {usageStats.receipts_used_this_month} | 
              Storage: {usageStats.storage_used_mb}MB |
              Method: {usageStats.calculation_method}
            </div>
          )}
        </div>

        {/* Cache Statistics */}
        <div className="space-y-2">
          <h4 className="font-medium">Cache Statistics</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Queries:</span>
              <span className="ml-2 font-mono">{queries.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Usage Queries:</span>
              <span className="ml-2 font-mono">{usageQueries.length}</span>
            </div>
          </div>
        </div>

        {/* Usage Queries Details */}
        {usageQueries.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Usage Query Details</h4>
            <div className="space-y-1">
              {usageQueries.map((query, index) => (
                <div key={index} className="flex items-center justify-between text-xs p-2 bg-muted rounded">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(getQueryStatus(query))}
                    <span className="font-mono">
                      {query.queryKey.join(' → ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {query.state.dataUpdatedAt && (
                      <Badge variant="outline" className="text-xs">
                        {formatTime(query.state.dataUpdatedAt)}
                      </Badge>
                    )}
                    <Badge 
                      variant={query.state.isStale ? "destructive" : "default"}
                      className="text-xs"
                    >
                      {query.state.isStale ? 'Stale' : 'Fresh'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        <div className="space-y-2">
          <h4 className="font-medium">Performance Metrics</h4>
          <div className="text-xs space-y-1">
            <div>
              <span className="text-muted-foreground">Stale Time:</span>
              <span className="ml-2">5 minutes</span>
            </div>
            <div>
              <span className="text-muted-foreground">GC Time:</span>
              <span className="ml-2">10 minutes</span>
            </div>
            <div>
              <span className="text-muted-foreground">Auto Invalidation:</span>
              <span className="ml-2 text-green-600">✓ Enabled</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
