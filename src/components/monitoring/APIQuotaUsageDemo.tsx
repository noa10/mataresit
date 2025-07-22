/**
 * API Quota Usage Display Demo Component
 * Phase 3: Batch Upload Optimization - Priority 3.2.2
 * 
 * Demo component to showcase the API quota usage display
 * with various usage scenarios and predictive analytics.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { APIQuotaUsageDisplay } from './APIQuotaUsageDisplay';

interface QuotaUsageData {
  requests: {
    used: number;
    limit: number;
    remaining: number;
    resetTime: Date;
    usageRate: number;
  };
  tokens: {
    used: number;
    limit: number;
    remaining: number;
    resetTime: Date;
    usageRate: number;
  };
  historical?: {
    timestamp: Date;
    requestsUsed: number;
    tokensUsed: number;
  }[];
}

export function APIQuotaUsageDemo() {
  const [currentScenario, setCurrentScenario] = useState<string>('normal');
  const [isLive, setIsLive] = useState(false);

  // Mock scenarios for demonstration
  const scenarios = {
    normal: {
      requests: {
        used: 45,
        limit: 90,
        remaining: 45,
        resetTime: new Date(Date.now() + 35000),
        usageRate: 1.2
      },
      tokens: {
        used: 85000,
        limit: 150000,
        remaining: 65000,
        resetTime: new Date(Date.now() + 35000),
        usageRate: 2100
      },
      historical: generateHistoricalData(20, 'normal')
    } as QuotaUsageData,
    
    highUsage: {
      requests: {
        used: 78,
        limit: 90,
        remaining: 12,
        resetTime: new Date(Date.now() + 25000),
        usageRate: 2.8
      },
      tokens: {
        used: 135000,
        limit: 150000,
        remaining: 15000,
        resetTime: new Date(Date.now() + 25000),
        usageRate: 4200
      },
      historical: generateHistoricalData(20, 'high')
    } as QuotaUsageData,
    
    critical: {
      requests: {
        used: 88,
        limit: 90,
        remaining: 2,
        resetTime: new Date(Date.now() + 15000),
        usageRate: 4.5
      },
      tokens: {
        used: 148000,
        limit: 150000,
        remaining: 2000,
        resetTime: new Date(Date.now() + 15000),
        usageRate: 6800
      },
      historical: generateHistoricalData(20, 'critical')
    } as QuotaUsageData,
    
    lowUsage: {
      requests: {
        used: 15,
        limit: 90,
        remaining: 75,
        resetTime: new Date(Date.now() + 45000),
        usageRate: 0.4
      },
      tokens: {
        used: 25000,
        limit: 150000,
        remaining: 125000,
        resetTime: new Date(Date.now() + 45000),
        usageRate: 800
      },
      historical: generateHistoricalData(20, 'low')
    } as QuotaUsageData,
    
    recovering: {
      requests: {
        used: 35,
        limit: 90,
        remaining: 55,
        resetTime: new Date(Date.now() + 40000),
        usageRate: 1.8
      },
      tokens: {
        used: 65000,
        limit: 150000,
        remaining: 85000,
        resetTime: new Date(Date.now() + 40000),
        usageRate: 1900
      },
      historical: generateHistoricalData(20, 'recovering')
    } as QuotaUsageData
  };

  function generateHistoricalData(points: number, scenario: string) {
    const data = [];
    const now = Date.now();
    
    for (let i = points; i >= 0; i--) {
      const timestamp = new Date(now - (i * 30000)); // 30 second intervals
      
      let requestsUsed, tokensUsed;
      
      switch (scenario) {
        case 'high':
          requestsUsed = Math.floor(Math.random() * 20) + 60 + (points - i) * 2;
          tokensUsed = Math.floor(Math.random() * 20000) + 100000 + (points - i) * 3000;
          break;
        case 'critical':
          requestsUsed = Math.floor(Math.random() * 10) + 80 + (points - i) * 1;
          tokensUsed = Math.floor(Math.random() * 10000) + 130000 + (points - i) * 2000;
          break;
        case 'low':
          requestsUsed = Math.floor(Math.random() * 10) + (points - i) * 0.5;
          tokensUsed = Math.floor(Math.random() * 5000) + (points - i) * 1000;
          break;
        case 'recovering':
          requestsUsed = Math.floor(Math.random() * 15) + 20 + (points - i) * 1;
          tokensUsed = Math.floor(Math.random() * 15000) + 40000 + (points - i) * 1500;
          break;
        default: // normal
          requestsUsed = Math.floor(Math.random() * 15) + 30 + (points - i) * 1;
          tokensUsed = Math.floor(Math.random() * 15000) + 60000 + (points - i) * 2000;
      }
      
      data.push({
        timestamp,
        requestsUsed: Math.max(0, requestsUsed),
        tokensUsed: Math.max(0, tokensUsed)
      });
    }
    
    return data;
  }

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
    }, 10000);

    return () => clearInterval(interval);
  }, [isLive]);

  const handleStrategyRecommendation = (strategy: string) => {
    console.log('Strategy recommendation:', strategy);
    // In a real implementation, this would update the processing strategy
  };

  const handleRefresh = async () => {
    console.log('Refreshing quota data...');
    // In a real implementation, this would refresh the quota data
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>API Quota Usage Display Demo</CardTitle>
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
                  {scenario.replace(/([A-Z])/g, ' $1').trim()}
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

      {/* Overview Display */}
      <APIQuotaUsageDisplay
        quotaData={currentData}
        apiProvider="Gemini"
        showPredictions={true}
        showRecommendations={true}
        showHistoricalTrends={true}
        onRefresh={handleRefresh}
        onStrategyRecommendation={handleStrategyRecommendation}
      />

      {/* Compact Display */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Compact View (for sidebars)</CardTitle>
        </CardHeader>
        <CardContent>
          <APIQuotaUsageDisplay
            quotaData={currentData}
            apiProvider="Gemini"
            showPredictions={false}
            showRecommendations={false}
            showHistoricalTrends={false}
            className="max-w-md"
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
              <h4 className="font-medium mb-2">Current Usage</h4>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                {JSON.stringify({
                  requests: currentData.requests,
                  tokens: currentData.tokens
                }, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="font-medium mb-2">Historical Data Points</h4>
              <div className="text-sm text-muted-foreground">
                {currentData.historical?.length || 0} data points available
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
