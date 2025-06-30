/**
 * Cache Monitor Component
 * 
 * Admin dashboard component for monitoring cache performance,
 * hit rates, and managing cache operations.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  RefreshCw, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Database,
  Clock,
  Zap,
  AlertTriangle
} from 'lucide-react';
import { useCacheStats } from '@/hooks/useCache';
import { CacheSource, CacheStats } from '@/lib/cache/types';
import { cacheManager } from '@/lib/cache/cache-manager';
import { CacheInvalidator } from '@/lib/cache/cache-utils';
import { toast } from 'sonner';

interface CacheMonitorProps {
  className?: string;
}

export function CacheMonitor({ className = '' }: CacheMonitorProps) {
  const { stats, isLoading, refresh } = useCacheStats();
  const [isClearing, setIsClearing] = useState(false);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleClearAllCaches = async () => {
    setIsClearing(true);
    try {
      await CacheInvalidator.invalidateAllCaches();
      toast.success('All caches cleared successfully');
      refresh();
    } catch (error) {
      toast.error('Failed to clear caches');
      console.error('Cache clear error:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearSpecificCache = async (source: CacheSource) => {
    try {
      const cache = cacheManager.getCache(source);
      await cache.clear();
      toast.success(`${source} cache cleared`);
      refresh();
    } catch (error) {
      toast.error(`Failed to clear ${source} cache`);
      console.error('Cache clear error:', error);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getHitRateColor = (hitRate: number): string => {
    if (hitRate >= 0.8) return 'text-green-600';
    if (hitRate >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHitRateVariant = (hitRate: number): 'default' | 'secondary' | 'destructive' => {
    if (hitRate >= 0.8) return 'default';
    if (hitRate >= 0.6) return 'secondary';
    return 'destructive';
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Cache Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading cache statistics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Cache Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No cache statistics available
          </div>
        </CardContent>
      </Card>
    );
  }

  const globalStats = stats as Record<CacheSource, CacheStats>;
  const cacheEntries = Object.entries(globalStats);

  // Calculate overall statistics
  const totalHits = cacheEntries.reduce((sum, [, stat]) => sum + stat.hitCount, 0);
  const totalMisses = cacheEntries.reduce((sum, [, stat]) => sum + stat.missCount, 0);
  const totalEntries = cacheEntries.reduce((sum, [, stat]) => sum + stat.totalEntries, 0);
  const totalSize = cacheEntries.reduce((sum, [, stat]) => sum + stat.totalSize, 0);
  const overallHitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overall Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Cache Monitor
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearAllCaches}
                disabled={isClearing}
              >
                <Trash2 className="h-4 w-4" />
                Clear All
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{(overallHitRate * 100).toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Overall Hit Rate</div>
              <Progress value={overallHitRate * 100} className="mt-2" />
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{totalEntries}</div>
              <div className="text-sm text-muted-foreground">Total Entries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{formatBytes(totalSize)}</div>
              <div className="text-sm text-muted-foreground">Total Size</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{totalHits + totalMisses}</div>
              <div className="text-sm text-muted-foreground">Total Requests</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Cache Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cacheEntries.map(([source, stat]) => (
          <Card key={source}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="capitalize">{source.replace('_', ' ')}</span>
                <Badge variant={getHitRateVariant(stat.hitRate)}>
                  {(stat.hitRate * 100).toFixed(1)}%
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-muted-foreground">Hits</div>
                  <div className="font-medium flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-green-600" />
                    {stat.hitCount}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Misses</div>
                  <div className="font-medium flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-red-600" />
                    {stat.missCount}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Entries</div>
                  <div className="font-medium flex items-center gap-1">
                    <Database className="h-3 w-3" />
                    {stat.totalEntries}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Size</div>
                  <div className="font-medium">{formatBytes(stat.totalSize)}</div>
                </div>
              </div>

              {stat.averageResponseTime > 0 && (
                <div className="text-sm">
                  <div className="text-muted-foreground">Avg Response Time</div>
                  <div className="font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(stat.averageResponseTime)}
                  </div>
                </div>
              )}

              <Progress value={stat.hitRate * 100} className="h-2" />

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleClearSpecificCache(source as CacheSource)}
                className="w-full"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear Cache
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Alerts */}
      {overallHitRate < 0.5 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <div className="font-medium">Low Cache Hit Rate</div>
                <div className="text-sm">
                  Overall hit rate is {(overallHitRate * 100).toFixed(1)}%. 
                  Consider reviewing cache TTL settings or query patterns.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
