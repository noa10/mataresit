/**
 * Cache System Test Component
 * 
 * Test component for validating the cache system functionality
 * and performance monitoring.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Database, 
  Play, 
  Trash2, 
  Clock, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { 
  llmCache, 
  searchCache, 
  financialCache,
  cacheManager,
  checkCacheHealth
} from '@/lib/cache';
import { useCacheStats } from '@/hooks/useCache';
import { toast } from 'sonner';

export default function CacheTest() {
  const [testKey, setTestKey] = useState('test-key-1');
  const [testValue, setTestValue] = useState('{"message": "Hello Cache!"}');
  const [testResult, setTestResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  
  const { stats, refresh: refreshStats } = useCacheStats();

  // Test basic cache operations
  const testBasicOperations = async () => {
    setIsLoading(true);
    const results: any[] = [];
    
    try {
      // Test 1: Set and Get
      const startTime = Date.now();
      await llmCache.set('test-query', { intent: 'test', confidence: 0.95 }, 'test-user');
      const cached = await llmCache.get('test-query', 'test-user');
      const duration = Date.now() - startTime;
      
      results.push({
        test: 'Set and Get',
        success: cached !== null,
        duration,
        details: cached ? 'Successfully cached and retrieved' : 'Failed to retrieve cached value'
      });

      // Test 2: Cache Miss
      const missStart = Date.now();
      const missed = await llmCache.get('non-existent-key', 'test-user');
      const missDuration = Date.now() - missStart;
      
      results.push({
        test: 'Cache Miss',
        success: missed === null,
        duration: missDuration,
        details: missed === null ? 'Correctly returned null for missing key' : 'Unexpected value returned'
      });

      // Test 3: Search Cache
      const searchStart = Date.now();
      await searchCache.set('test search query', { results: ['result1', 'result2'] }, 'test-user');
      const searchResult = await searchCache.get('test search query', 'test-user');
      const searchDuration = Date.now() - searchStart;
      
      results.push({
        test: 'Search Cache',
        success: searchResult !== null,
        duration: searchDuration,
        details: searchResult ? 'Search cache working correctly' : 'Search cache failed'
      });

      // Test 4: Financial Cache
      const financialStart = Date.now();
      await financialCache.set('get_spending_by_category', { categories: ['food', 'transport'] }, 'test-user');
      const financialResult = await financialCache.get('get_spending_by_category', 'test-user');
      const financialDuration = Date.now() - financialStart;
      
      results.push({
        test: 'Financial Cache',
        success: financialResult !== null,
        duration: financialDuration,
        details: financialResult ? 'Financial cache working correctly' : 'Financial cache failed'
      });

      setTestResult(results);
      toast.success('Cache tests completed');
      
    } catch (error) {
      console.error('Cache test error:', error);
      toast.error('Cache tests failed');
      setTestResult([{
        test: 'Error',
        success: false,
        duration: 0,
        details: error.message
      }]);
    } finally {
      setIsLoading(false);
      refreshStats();
    }
  };

  // Test custom key-value operations
  const testCustomKeyValue = async () => {
    setIsLoading(true);
    
    try {
      let parsedValue;
      try {
        parsedValue = JSON.parse(testValue);
      } catch {
        parsedValue = testValue;
      }

      const startTime = Date.now();
      
      // Use LLM cache for custom test
      await llmCache.set(testKey, parsedValue, 'test-user');
      const retrieved = await llmCache.get(testKey, 'test-user');
      
      const duration = Date.now() - startTime;
      
      setTestResult([{
        test: 'Custom Key-Value',
        success: retrieved !== null,
        duration,
        details: retrieved ? `Successfully stored and retrieved: ${JSON.stringify(retrieved)}` : 'Failed to retrieve value'
      }]);
      
      toast.success('Custom test completed');
      
    } catch (error) {
      console.error('Custom test error:', error);
      toast.error('Custom test failed');
      setTestResult([{
        test: 'Custom Test Error',
        success: false,
        duration: 0,
        details: error.message
      }]);
    } finally {
      setIsLoading(false);
      refreshStats();
    }
  };

  // Test cache health
  const testCacheHealth = async () => {
    setIsLoading(true);
    
    try {
      const health = await checkCacheHealth();
      setHealthStatus(health);
      
      if (health.healthy) {
        toast.success('Cache system is healthy');
      } else {
        toast.error('Cache system has issues');
      }
      
    } catch (error) {
      console.error('Health check error:', error);
      toast.error('Health check failed');
      setHealthStatus({
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Clear all caches
  const clearAllCaches = async () => {
    setIsLoading(true);
    
    try {
      await cacheManager.clearAll();
      toast.success('All caches cleared');
      setTestResult(null);
      setHealthStatus(null);
      refreshStats();
    } catch (error) {
      console.error('Clear cache error:', error);
      toast.error('Failed to clear caches');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Cache System Test</h1>
        <p className="text-muted-foreground">
          Test and monitor the performance of the Mataresit caching system
        </p>
      </div>

      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Test Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={testBasicOperations}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Run Basic Tests
            </Button>
            <Button
              onClick={testCacheHealth}
              disabled={isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Database className="h-4 w-4" />
              Health Check
            </Button>
            <Button
              onClick={clearAllCaches}
              disabled={isLoading}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear All Caches
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Test Key</label>
              <Input
                value={testKey}
                onChange={(e) => setTestKey(e.target.value)}
                placeholder="Enter test key"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Test Value (JSON)</label>
              <Textarea
                value={testValue}
                onChange={(e) => setTestValue(e.target.value)}
                placeholder="Enter test value"
                rows={3}
              />
            </div>
          </div>

          <Button
            onClick={testCustomKeyValue}
            disabled={isLoading}
            variant="secondary"
            className="w-full"
          >
            Test Custom Key-Value
          </Button>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResult && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testResult.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <div>
                      <div className="font-medium">{result.test}</div>
                      <div className="text-sm text-muted-foreground">{result.details}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">{result.duration}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Health Status */}
      {healthStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Cache Health Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {healthStatus.healthy ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <span className="font-medium">
                  {healthStatus.healthy ? 'Healthy' : 'Unhealthy'}
                </span>
              </div>
              
              {healthStatus.totalCaches && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Caches</div>
                    <div className="font-medium">{healthStatus.totalCaches}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Total Entries</div>
                    <div className="font-medium">{healthStatus.totalEntries}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Hit Rate</div>
                    <div className="font-medium">
                      {(healthStatus.overallHitRate * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}
              
              {healthStatus.error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  Error: {healthStatus.error}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cache Statistics */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Live Cache Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(stats as Record<string, any>).map(([source, stat]) => (
                <div key={source} className="p-3 border rounded-lg">
                  <div className="font-medium capitalize mb-2">
                    {source.replace('_', ' ')}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Hit Rate:</span>
                      <Badge variant={stat.hitRate > 0.8 ? 'default' : 'secondary'}>
                        {(stat.hitRate * 100).toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Entries:</span>
                      <span>{stat.totalEntries}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hits:</span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-green-600" />
                        {stat.hitCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Misses:</span>
                      <span className="flex items-center gap-1">
                        <TrendingDown className="h-3 w-3 text-red-600" />
                        {stat.missCount}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
