/**
 * Rate Limit Status Display Demo Component
 * Phase 3: Batch Upload Optimization - Priority 3.2.1
 * 
 * Demo component to showcase the real-time rate limit status display
 * with various scenarios and states for testing and development.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RateLimitStatusDisplay } from './RateLimitStatusDisplay';
import type { RateLimitStatus, AdaptiveMetrics, RateLimitEvent } from '@/lib/rate-limiting';

export function RateLimitStatusDemo() {
  const [currentScenario, setCurrentScenario] = useState<string>('healthy');
  const [isLive, setIsLive] = useState(false);

  // Mock scenarios for demonstration
  const scenarios = {
    healthy: {
      status: {
        isRateLimited: false,
        requestsRemaining: 85,
        tokensRemaining: 120000,
        resetTime: Date.now() + 45000,
        backoffMs: 0,
        consecutiveErrors: 0
      } as RateLimitStatus,
      metrics: {
        successRate: 0.98,
        averageResponseTime: 1200,
        errorRate: 0.02,
        throughput: 1.5,
        lastAdjustment: Date.now() - 30000
      } as AdaptiveMetrics,
      events: [
        { type: 'permission_granted', timestamp: Date.now() - 5000, tokens: 1000 },
        { type: 'success', timestamp: Date.now() - 3000, tokens: 1200 },
        { type: 'permission_granted', timestamp: Date.now() - 1000, tokens: 800 }
      ] as RateLimitEvent[]
    },
    warning: {
      status: {
        isRateLimited: false,
        requestsRemaining: 8,
        tokensRemaining: 5000,
        resetTime: Date.now() + 25000,
        backoffMs: 0,
        consecutiveErrors: 1
      } as RateLimitStatus,
      metrics: {
        successRate: 0.85,
        averageResponseTime: 2100,
        errorRate: 0.15,
        throughput: 0.8,
        lastAdjustment: Date.now() - 10000
      } as AdaptiveMetrics,
      events: [
        { type: 'permission_denied', timestamp: Date.now() - 8000, delayMs: 5000, reason: 'burst_limit' },
        { type: 'permission_granted', timestamp: Date.now() - 3000, tokens: 1500 },
        { type: 'error', timestamp: Date.now() - 1000, errorType: 'rate_limit' }
      ] as RateLimitEvent[]
    },
    rateLimited: {
      status: {
        isRateLimited: true,
        requestsRemaining: 2,
        tokensRemaining: 1000,
        resetTime: Date.now() + 35000,
        backoffMs: 15000,
        consecutiveErrors: 3
      } as RateLimitStatus,
      metrics: {
        successRate: 0.65,
        averageResponseTime: 3500,
        errorRate: 0.35,
        throughput: 0.3,
        lastAdjustment: Date.now() - 5000
      } as AdaptiveMetrics,
      events: [
        { type: 'permission_denied', timestamp: Date.now() - 10000, delayMs: 10000, reason: 'tokens_limit' },
        { type: 'permission_denied', timestamp: Date.now() - 8000, delayMs: 12000, reason: 'requests_limit' },
        { type: 'error', timestamp: Date.now() - 5000, errorType: 'rate_limit' },
        { type: 'backoff_applied', timestamp: Date.now() - 3000, delayMs: 15000 }
      ] as RateLimitEvent[]
    },
    recovering: {
      status: {
        isRateLimited: false,
        requestsRemaining: 25,
        tokensRemaining: 35000,
        resetTime: Date.now() + 55000,
        backoffMs: 0,
        consecutiveErrors: 0
      } as RateLimitStatus,
      metrics: {
        successRate: 0.92,
        averageResponseTime: 1800,
        errorRate: 0.08,
        throughput: 1.1,
        lastAdjustment: Date.now() - 15000
      } as AdaptiveMetrics,
      events: [
        { type: 'permission_granted', timestamp: Date.now() - 8000, tokens: 900 },
        { type: 'success', timestamp: Date.now() - 6000, tokens: 1100 },
        { type: 'permission_granted', timestamp: Date.now() - 4000, tokens: 1300 },
        { type: 'success', timestamp: Date.now() - 2000, tokens: 950 }
      ] as RateLimitEvent[]
    }
  };

  const currentData = scenarios[currentScenario as keyof typeof scenarios];

  // Simulate live updates
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      // Simulate some changes to the data
      setCurrentScenario(prev => {
        const keys = Object.keys(scenarios);
        const currentIndex = keys.indexOf(prev);
        const nextIndex = (currentIndex + 1) % keys.length;
        return keys[nextIndex];
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [isLive]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Rate Limit Status Display Demo</CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              {Object.keys(scenarios).map((scenario) => (
                <Button
                  key={scenario}
                  variant={currentScenario === scenario ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentScenario(scenario)}
                  className="capitalize"
                >
                  {scenario}
                </Button>
              ))}
            </div>
            <Separator orientation="vertical" className="h-6" />
            <Button
              variant={isLive ? "destructive" : "secondary"}
              size="sm"
              onClick={() => setIsLive(!isLive)}
            >
              {isLive ? 'Stop Live Demo' : 'Start Live Demo'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            Current scenario: <Badge variant="outline" className="ml-1 capitalize">{currentScenario}</Badge>
            {isLive && <Badge variant="secondary" className="ml-2">Live Updates</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* Compact View */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Compact View</CardTitle>
        </CardHeader>
        <CardContent>
          <RateLimitStatusDisplay
            status={currentData.status}
            metrics={currentData.metrics}
            events={currentData.events}
            compact={true}
          />
        </CardContent>
      </Card>

      {/* Standard View */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Standard View</CardTitle>
        </CardHeader>
        <CardContent>
          <RateLimitStatusDisplay
            status={currentData.status}
            metrics={currentData.metrics}
            events={currentData.events}
            compact={false}
            showAdvanced={false}
          />
        </CardContent>
      </Card>

      {/* Advanced View */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Advanced View</CardTitle>
        </CardHeader>
        <CardContent>
          <RateLimitStatusDisplay
            status={currentData.status}
            metrics={currentData.metrics}
            events={currentData.events}
            compact={false}
            showAdvanced={true}
          />
        </CardContent>
      </Card>

      {/* Raw Data Display */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Raw Data (Debug)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Status</h4>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                {JSON.stringify(currentData.status, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="font-medium mb-2">Metrics</h4>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                {JSON.stringify(currentData.metrics, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="font-medium mb-2">Recent Events</h4>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                {JSON.stringify(currentData.events, null, 2)}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
