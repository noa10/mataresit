/**
 * Batch Upload Demo Component
 * Phase 3: Batch Upload Optimization
 * 
 * Comprehensive demo showcasing all Phase 3 enhanced batch upload features.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Upload, 
  Settings, 
  BarChart3, 
  Zap, 
  Target, 
  Activity,
  TrendingUp,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { EnhancedBatchProcessingControls } from './EnhancedBatchProcessingControls';
import { EnhancedUploadQueueItem } from './EnhancedUploadQueueItem';
import { ProgressTrackingDemo } from '../progress-tracking/ProgressTrackingDemo';
import { ProcessingStrategy } from '@/lib/progress-tracking';

interface BatchUploadDemoProps {
  className?: string;
}

export function BatchUploadDemo({ className }: BatchUploadDemoProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedStrategy, setSelectedStrategy] = useState<ProcessingStrategy>('balanced');
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false);

  // Mock data for demonstration
  const mockProgressMetrics = {
    totalFiles: 10,
    filesCompleted: 6,
    filesFailed: 1,
    filesPending: 2,
    filesProcessing: 1,
    progressPercentage: 70,
    startTime: new Date(Date.now() - 300000), // 5 minutes ago
    currentTime: new Date(),
    elapsedTimeMs: 300000,
    averageProcessingTimeMs: 45000,
    currentThroughput: 1.2, // files per minute
    peakThroughput: 1.8,
    throughputHistory: [],
    rateLimitHits: 2,
    rateLimitDelayMs: 5000,
    apiCallsTotal: 7,
    apiCallsSuccessful: 6,
    apiCallsFailed: 1,
    apiSuccessRate: 0.857,
    totalTokensUsed: 15420,
    estimatedCost: 0.154,
    costPerFile: 0.022,
    tokensPerFile: 2203,
    apiEfficiency: 2203,
    retryCount: 1,
    errorRate: 0.1,
    qualityScore: 0.85
  };

  const mockEtaCalculation = {
    estimatedTimeRemainingMs: 150000, // 2.5 minutes
    estimatedCompletionTime: new Date(Date.now() + 150000),
    confidence: 0.87,
    method: 'adaptive' as const,
    factors: {
      currentThroughput: 1.2,
      averageThroughput: 1.4,
      rateLimitingImpact: 0.1,
      complexityFactor: 1.2,
      historicalAccuracy: 0.9
    }
  };

  const mockProgressAlerts = [
    {
      id: 'alert-1',
      type: 'rate_limiting' as const,
      severity: 'medium' as const,
      message: 'Rate limiting detected - processing speed reduced by 15%',
      timestamp: new Date(),
      sessionId: 'demo-session',
      metrics: mockProgressMetrics,
      recommendations: [
        'Consider switching to conservative processing strategy',
        'Reduce concurrent file processing'
      ],
      autoResolved: false
    }
  ];

  const mockRateLimitStatus = {
    isRateLimited: false,
    requestsRemaining: 45,
    tokensRemaining: 85000,
    backoffMs: 0
  };

  const mockFileProgressDetail = {
    fileId: 'file-1',
    filename: 'receipt-example.jpg',
    status: 'processing' as const,
    progress: 75,
    stage: 'embedding' as const,
    stageProgress: 60,
    apiCalls: 1,
    tokensUsed: 2200,
    retryCount: 0,
    rateLimited: false,
    warningMessages: [],
    qualityScore: 0.92
  };

  const mockUpload = {
    id: 'upload-1',
    file: new File([''], 'receipt-example.jpg', { type: 'image/jpeg' }),
    status: 'processing' as const,
    progress: 75,
    error: null,
    processingStartedAt: new Date(Date.now() - 60000)
  };

  const strategyConfigs = {
    conservative: {
      label: 'Conservative',
      description: 'Slower but more reliable processing',
      icon: Target,
      color: 'text-green-600',
      features: ['1 concurrent file', '30 requests/min', 'High reliability', 'Lower cost']
    },
    balanced: {
      label: 'Balanced',
      description: 'Optimal balance of speed and reliability',
      icon: Activity,
      color: 'text-blue-600',
      features: ['2 concurrent files', '60 requests/min', 'Good reliability', 'Moderate cost']
    },
    aggressive: {
      label: 'Aggressive',
      description: 'Faster processing with higher resource usage',
      icon: Zap,
      color: 'text-orange-600',
      features: ['4 concurrent files', '120 requests/min', 'Fast processing', 'Higher cost']
    },
    adaptive: {
      label: 'Adaptive',
      description: 'AI-optimized processing based on performance',
      icon: BarChart3,
      color: 'text-purple-600',
      features: ['3 concurrent files', '90 requests/min', 'AI-optimized', 'Smart cost control']
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Phase 3: Enhanced Batch Upload Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              This demo showcases the enhanced batch upload features including processing strategy selection,
              advanced progress tracking, rate limiting status, and comprehensive performance metrics.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="controls">Enhanced Controls</TabsTrigger>
          <TabsTrigger value="queue">Queue Items</TabsTrigger>
          <TabsTrigger value="progress">Progress Tracking</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(strategyConfigs).map(([key, config]) => (
              <Card key={key} className={`cursor-pointer transition-all ${
                selectedStrategy === key ? 'ring-2 ring-primary' : ''
              }`} onClick={() => setSelectedStrategy(key as ProcessingStrategy)}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <config.icon className={`h-5 w-5 ${config.color}`} />
                    {config.label}
                    {selectedStrategy === key && (
                      <Badge variant="default" className="ml-auto">Selected</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{config.description}</p>
                  <div className="space-y-1">
                    {config.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="controls" className="space-y-4">
          <EnhancedBatchProcessingControls
            totalFiles={mockProgressMetrics.totalFiles}
            pendingFiles={mockProgressMetrics.filesPending}
            activeFiles={mockProgressMetrics.filesProcessing}
            completedFiles={mockProgressMetrics.filesCompleted}
            failedFiles={mockProgressMetrics.filesFailed}
            totalProgress={mockProgressMetrics.progressPercentage}
            isProcessing={true}
            isPaused={false}
            onStartProcessing={() => console.log('Start processing')}
            onPauseProcessing={() => console.log('Pause processing')}
            onClearQueue={() => console.log('Clear queue')}
            onClearAll={() => console.log('Clear all')}
            onRetryAllFailed={() => console.log('Retry all failed')}
            processingStrategy={selectedStrategy}
            onProcessingStrategyChange={setSelectedStrategy}
            progressMetrics={mockProgressMetrics}
            etaCalculation={mockEtaCalculation}
            progressAlerts={mockProgressAlerts}
            rateLimitStatus={mockRateLimitStatus}
            onDismissAlert={(alertId) => console.log('Dismiss alert:', alertId)}
            enableAdvancedView={showAdvancedMetrics}
            onToggleAdvancedView={() => setShowAdvancedMetrics(!showAdvancedMetrics)}
          />
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Enhanced Queue Items</h3>
            <div className="space-y-2">
              <EnhancedUploadQueueItem
                upload={mockUpload}
                receiptId="receipt-123"
                onRemove={(id) => console.log('Remove:', id)}
                onCancel={(id) => console.log('Cancel:', id)}
                onRetry={(id) => console.log('Retry:', id)}
                onViewReceipt={(id) => console.log('View receipt:', id)}
                fileProgressDetail={mockFileProgressDetail}
                showDetailedProgress={true}
                rateLimited={false}
                estimatedCost={0.022}
                processingTimeMs={60000}
              />
              
              <EnhancedUploadQueueItem
                upload={{
                  ...mockUpload,
                  id: 'upload-2',
                  status: 'completed',
                  progress: 100,
                  file: new File([''], 'receipt-completed.pdf', { type: 'application/pdf' })
                }}
                receiptId="receipt-124"
                onViewReceipt={(id) => console.log('View receipt:', id)}
                fileProgressDetail={{
                  ...mockFileProgressDetail,
                  fileId: 'file-2',
                  filename: 'receipt-completed.pdf',
                  status: 'completed',
                  progress: 100,
                  stage: 'completed',
                  stageProgress: 100,
                  qualityScore: 0.95
                }}
                showDetailedProgress={true}
                estimatedCost={0.018}
                processingTimeMs={42000}
              />

              <EnhancedUploadQueueItem
                upload={{
                  ...mockUpload,
                  id: 'upload-3',
                  status: 'error',
                  progress: 0,
                  error: { code: 'PROCESSING_ERROR', message: 'Failed to process receipt - invalid format' },
                  file: new File([''], 'receipt-failed.jpg', { type: 'image/jpeg' })
                }}
                onRetry={(id) => console.log('Retry:', id)}
                onRemove={(id) => console.log('Remove:', id)}
                fileProgressDetail={{
                  ...mockFileProgressDetail,
                  fileId: 'file-3',
                  filename: 'receipt-failed.jpg',
                  status: 'failed',
                  progress: 0,
                  stage: 'processing',
                  stageProgress: 0,
                  retryCount: 2,
                  errorMessage: 'Failed to process receipt - invalid format',
                  qualityScore: 0.1
                }}
                showDetailedProgress={true}
                rateLimited={true}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <ProgressTrackingDemo
            sessionId="demo-session"
            isActive={true}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
