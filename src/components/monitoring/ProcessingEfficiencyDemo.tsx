/**
 * Processing Efficiency Display Demo Component
 * Phase 3: Batch Upload Optimization - Priority 3.2.3
 * 
 * Demo component to showcase the processing efficiency display
 * with various performance scenarios and optimization insights.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ProcessingEfficiencyDisplay } from './ProcessingEfficiencyDisplay';

interface ProcessingEfficiencyData {
  currentThroughput: number;
  peakThroughput: number;
  averageThroughput: number;
  throughputTrend: 'increasing' | 'decreasing' | 'stable';
  successRate: number;
  errorRate: number;
  retryRate: number;
  totalProcessed: number;
  totalSuccessful: number;
  totalFailed: number;
  totalRetries: number;
  averageProcessingTime: number;
  medianProcessingTime: number;
  minProcessingTime: number;
  maxProcessingTime: number;
  processingTimeVariance: number;
  apiCallsPerFile: number;
  tokensPerFile: number;
  costPerFile: number;
  apiEfficiency: number;
  qualityScore: number;
  qualityTrend: 'improving' | 'declining' | 'stable';
  throughputHistory?: { timestamp: Date; throughput: number }[];
  processingTimeHistory?: { timestamp: Date; processingTime: number }[];
  sessionDuration: number;
  estimatedTimeRemaining?: number;
}

export function ProcessingEfficiencyDemo() {
  const [currentScenario, setCurrentScenario] = useState<string>('optimal');
  const [isLive, setIsLive] = useState(false);

  // Mock scenarios for demonstration
  const scenarios = {
    optimal: {
      currentThroughput: 1.8,
      peakThroughput: 2.1,
      averageThroughput: 1.6,
      throughputTrend: 'stable' as const,
      successRate: 0.98,
      errorRate: 0.02,
      retryRate: 0.05,
      totalProcessed: 50,
      totalSuccessful: 49,
      totalFailed: 1,
      totalRetries: 2,
      averageProcessingTime: 25000,
      medianProcessingTime: 24000,
      minProcessingTime: 18000,
      maxProcessingTime: 35000,
      processingTimeVariance: 3000,
      apiCallsPerFile: 1.1,
      tokensPerFile: 1200,
      costPerFile: 0.012,
      apiEfficiency: 1090,
      qualityScore: 0.95,
      qualityTrend: 'stable' as const,
      sessionDuration: 1800000, // 30 minutes
      estimatedTimeRemaining: 300000 // 5 minutes
    } as ProcessingEfficiencyData,
    
    highPerformance: {
      currentThroughput: 2.5,
      peakThroughput: 2.8,
      averageThroughput: 2.3,
      throughputTrend: 'increasing' as const,
      successRate: 0.96,
      errorRate: 0.04,
      retryRate: 0.08,
      totalProcessed: 75,
      totalSuccessful: 72,
      totalFailed: 3,
      totalRetries: 6,
      averageProcessingTime: 18000,
      medianProcessingTime: 17000,
      minProcessingTime: 12000,
      maxProcessingTime: 28000,
      processingTimeVariance: 2500,
      apiCallsPerFile: 1.0,
      tokensPerFile: 950,
      costPerFile: 0.0095,
      apiEfficiency: 950,
      qualityScore: 0.92,
      qualityTrend: 'improving' as const,
      sessionDuration: 2100000, // 35 minutes
      estimatedTimeRemaining: 180000 // 3 minutes
    } as ProcessingEfficiencyData,
    
    struggling: {
      currentThroughput: 0.4,
      peakThroughput: 0.8,
      averageThroughput: 0.5,
      throughputTrend: 'decreasing' as const,
      successRate: 0.75,
      errorRate: 0.25,
      retryRate: 0.35,
      totalProcessed: 20,
      totalSuccessful: 15,
      totalFailed: 5,
      totalRetries: 7,
      averageProcessingTime: 65000,
      medianProcessingTime: 58000,
      minProcessingTime: 35000,
      maxProcessingTime: 120000,
      processingTimeVariance: 15000,
      apiCallsPerFile: 2.3,
      tokensPerFile: 1800,
      costPerFile: 0.025,
      apiEfficiency: 780,
      qualityScore: 0.68,
      qualityTrend: 'declining' as const,
      sessionDuration: 3600000, // 60 minutes
      estimatedTimeRemaining: 1200000 // 20 minutes
    } as ProcessingEfficiencyData,
    
    inconsistent: {
      currentThroughput: 1.2,
      peakThroughput: 2.5,
      averageThroughput: 1.4,
      throughputTrend: 'stable' as const,
      successRate: 0.88,
      errorRate: 0.12,
      retryRate: 0.18,
      totalProcessed: 35,
      totalSuccessful: 31,
      totalFailed: 4,
      totalRetries: 6,
      averageProcessingTime: 42000,
      medianProcessingTime: 35000,
      minProcessingTime: 15000,
      maxProcessingTime: 95000,
      processingTimeVariance: 22000,
      apiCallsPerFile: 1.6,
      tokensPerFile: 1450,
      costPerFile: 0.018,
      apiEfficiency: 906,
      qualityScore: 0.82,
      qualityTrend: 'stable' as const,
      sessionDuration: 2700000, // 45 minutes
      estimatedTimeRemaining: 600000 // 10 minutes
    } as ProcessingEfficiencyData,
    
    recovering: {
      currentThroughput: 1.4,
      peakThroughput: 1.8,
      averageThroughput: 1.1,
      throughputTrend: 'increasing' as const,
      successRate: 0.91,
      errorRate: 0.09,
      retryRate: 0.12,
      totalProcessed: 42,
      totalSuccessful: 38,
      totalFailed: 4,
      totalRetries: 5,
      averageProcessingTime: 32000,
      medianProcessingTime: 30000,
      minProcessingTime: 20000,
      maxProcessingTime: 55000,
      processingTimeVariance: 8000,
      apiCallsPerFile: 1.3,
      tokensPerFile: 1150,
      costPerFile: 0.014,
      apiEfficiency: 885,
      qualityScore: 0.89,
      qualityTrend: 'improving' as const,
      sessionDuration: 2400000, // 40 minutes
      estimatedTimeRemaining: 420000 // 7 minutes
    } as ProcessingEfficiencyData
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
    }, 12000);

    return () => clearInterval(interval);
  }, [isLive]);

  const handleOptimizationRecommendation = (recommendation: string) => {
    console.log('Optimization recommendation:', recommendation);
    // In a real implementation, this would apply the optimization
  };

  const handleRefresh = async () => {
    console.log('Refreshing efficiency data...');
    // In a real implementation, this would refresh the efficiency data
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Processing Efficiency Display Demo</CardTitle>
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

      {/* Main Efficiency Display */}
      <ProcessingEfficiencyDisplay
        data={currentData}
        showRecommendations={true}
        showTrends={true}
        onRefresh={handleRefresh}
        onOptimizationRecommendation={handleOptimizationRecommendation}
      />

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {currentData.currentThroughput.toFixed(1)}
              </div>
              <div className="text-muted-foreground">Files/min</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {(currentData.successRate * 100).toFixed(1)}%
              </div>
              <div className="text-muted-foreground">Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {(currentData.averageProcessingTime / 1000).toFixed(1)}s
              </div>
              <div className="text-muted-foreground">Avg Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(currentData.apiEfficiency)}
              </div>
              <div className="text-muted-foreground">API Efficiency</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Raw Data Display */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Raw Data (Debug)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-3 rounded overflow-auto">
            {JSON.stringify(currentData, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
