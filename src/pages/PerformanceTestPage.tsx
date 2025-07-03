/**
 * Performance Test Page
 * Dedicated page for running performance tests and validation
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PerformanceTestRunner } from '@/components/debug/PerformanceTestRunner';
import { CacheDebugInfo } from '@/components/debug/CacheDebugInfo';
import SubscriptionLimitsDisplay from '@/components/SubscriptionLimitsDisplay';
import { 
  TestTube, 
  Zap, 
  Database, 
  Clock,
  Target,
  CheckCircle
} from 'lucide-react';

export default function PerformanceTestPage() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <TestTube className="h-8 w-8" />
          Performance Testing & Validation
        </h1>
        <p className="text-muted-foreground">
          Comprehensive testing suite for usage statistics loading performance and data accuracy validation.
        </p>
      </div>

      {/* Performance Targets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Performance Targets
          </CardTitle>
          <CardDescription>
            Key performance indicators for the optimized usage statistics system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <Clock className="h-8 w-8 text-blue-500" />
              <div>
                <div className="font-semibold">Loading Time</div>
                <div className="text-sm text-muted-foreground">Under 3 seconds</div>
                <Badge className="mt-1 bg-blue-500">Primary Target</Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <Database className="h-8 w-8 text-green-500" />
              <div>
                <div className="font-semibold">Cache Hit Rate</div>
                <div className="text-sm text-muted-foreground">90%+ for repeated requests</div>
                <Badge className="mt-1 bg-green-500">Efficiency</Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <CheckCircle className="h-8 w-8 text-purple-500" />
              <div>
                <div className="font-semibold">Data Accuracy</div>
                <div className="text-sm text-muted-foreground">100% validation pass</div>
                <Badge className="mt-1 bg-purple-500">Quality</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Usage Statistics (for comparison) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Live Usage Statistics
          </CardTitle>
          <CardDescription>
            Current implementation performance - test this component's loading speed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SubscriptionLimitsDisplay className="max-w-2xl" />
        </CardContent>
      </Card>

      {/* Performance Test Runner */}
      <PerformanceTestRunner />

      {/* Cache Debug Information */}
      <CacheDebugInfo />

      {/* Testing Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Instructions</CardTitle>
          <CardDescription>
            How to properly test the performance optimizations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <h4 className="font-semibold">Manual Testing Steps:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>
                <strong>Fresh Load Test:</strong> Clear browser cache and reload the page. 
                Observe the loading time of the "Live Usage Statistics" component above.
              </li>
              <li>
                <strong>Cache Performance Test:</strong> Refresh the page multiple times. 
                The second and subsequent loads should be much faster (served from cache).
              </li>
              <li>
                <strong>Automated Test Suite:</strong> Click "Run Performance Tests" to execute 
                comprehensive automated testing including RPC performance, cache efficiency, and data validation.
              </li>
              <li>
                <strong>Data Volume Testing:</strong> The automated tests will check performance 
                with your actual receipt data volume.
              </li>
              <li>
                <strong>Cache Invalidation Test:</strong> Upload a new receipt and verify that 
                usage statistics update automatically (cache invalidation working).
              </li>
            </ol>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">Expected Results:</h4>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li>First load: Under 3 seconds (from optimized RPC function)</li>
              <li>Subsequent loads: Under 500ms (from React Query cache)</li>
              <li>Cache hit rate: 90%+ for repeated requests</li>
              <li>Data validation: 100% pass rate</li>
              <li>Progressive loading: Smooth visual feedback during loading</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">Performance Improvements Achieved:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="font-medium text-red-800">Before Optimization</div>
                <ul className="text-sm text-red-700 mt-1 space-y-1">
                  <li>• 2-3 minute loading times</li>
                  <li>• Multiple separate database queries</li>
                  <li>• No caching mechanism</li>
                  <li>• Basic loading states</li>
                </ul>
              </div>
              
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="font-medium text-green-800">After Optimization</div>
                <ul className="text-sm text-green-700 mt-1 space-y-1">
                  <li>• Under 3 second loading times</li>
                  <li>• Single optimized RPC function</li>
                  <li>• React Query caching (5-10 min)</li>
                  <li>• Progressive loading UI</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
