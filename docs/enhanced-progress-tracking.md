# Enhanced Progress Tracking System

## Overview

The Enhanced Progress Tracking System provides comprehensive real-time monitoring, ETA calculations, and performance analytics for batch upload operations. This system is designed to achieve Phase 3 goals of 95%+ success rates, accurate ETAs, and detailed performance insights.

## Features

### 🎯 **Real-time Progress Monitoring**
- **File-level tracking** - Individual file progress with detailed status
- **Batch-level metrics** - Overall progress, throughput, and completion rates
- **Live updates** - Real-time progress updates via WebSocket connections
- **Performance snapshots** - Historical performance data collection

### 📊 **Advanced ETA Calculations**
- **Multiple calculation methods** - Linear, exponential, and adaptive algorithms
- **Confidence scoring** - Accuracy confidence for ETA predictions
- **Factor analysis** - Rate limiting, complexity, and historical accuracy factors
- **Dynamic adjustment** - Real-time ETA updates based on current performance

### 🔍 **Performance Analytics**
- **Throughput analysis** - Files per minute with trend analysis
- **Quality scoring** - Overall processing quality metrics (0-1 scale)
- **Cost tracking** - Token usage and estimated costs
- **Efficiency metrics** - API efficiency and resource utilization

### ⚠️ **Intelligent Alerting**
- **Performance alerts** - Slow processing, high error rates, quality degradation
- **Rate limiting alerts** - Proactive rate limit monitoring and recommendations
- **ETA deviation alerts** - Significant changes in estimated completion time
- **Resource alerts** - Memory, CPU, and network performance issues

## Architecture

### Core Components

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   ProgressTracker   │    │ ProgressTrackingService │    │   React Hooks      │
│                     │    │                      │    │                     │
│ • Metrics Collection│    │ • Service Management │    │ • useProgressTracking│
│ • ETA Calculation   │◄──►│ • Database Integration│◄──►│ • useProgressAnalytics│
│ • Alert Generation  │    │ • Real-time Updates  │    │ • useETAAccuracy    │
│ • Performance Monitoring│ • Event Broadcasting │    │ • usePerformanceMonitoring│
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
           │                           │                           │
           ▼                           ▼                           ▼
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   Database Tables   │    │   Batch Session     │    │    UI Components    │
│                     │    │   Management        │    │                     │
│ • batch_upload_sessions│  │                    │    │ • Progress Bars     │
│ • batch_upload_files│    │ • Session Tracking  │    │ • ETA Displays      │
│ • api_quota_tracking│    │ • File Status Updates│    │ • Performance Charts│
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
```

### Data Flow

1. **Initialization** - Progress tracker starts when batch processing begins
2. **File Tracking** - Individual file progress updates throughout processing
3. **Metrics Calculation** - Real-time calculation of progress, throughput, and quality metrics
4. **ETA Computation** - Multiple algorithms provide ETA estimates with confidence scores
5. **Alert Generation** - Performance issues trigger intelligent alerts
6. **Database Persistence** - Metrics and progress data stored for analytics
7. **UI Updates** - Real-time updates to progress displays and dashboards

## Usage

### Basic Integration

```typescript
import { useProgressTracking } from '@/lib/progress-tracking';

function BatchUploadComponent({ sessionId }: { sessionId: string }) {
  const {
    metrics,
    eta,
    alerts,
    isTracking,
    updateFileProgress,
    dismissAlert
  } = useProgressTracking(sessionId, {
    mode: 'enhanced',
    enableAnalytics: true,
    enablePersistence: true
  });

  return (
    <div>
      {/* Progress Display */}
      <ProgressBar value={metrics?.progressPercentage || 0} />
      
      {/* ETA Display */}
      {eta && (
        <div>
          ETA: {formatDuration(eta.estimatedTimeRemainingMs)}
          (Confidence: {(eta.confidence * 100).toFixed(1)}%)
        </div>
      )}
      
      {/* Alerts */}
      {alerts.map(alert => (
        <Alert key={alert.id} onDismiss={() => dismissAlert(alert.id)}>
          {alert.message}
        </Alert>
      ))}
    </div>
  );
}
```

### Advanced Analytics

```typescript
import { useProgressAnalytics } from '@/lib/progress-tracking';

function AnalyticsDashboard({ sessionId }: { sessionId: string }) {
  const { analytics, loading, refreshAnalytics } = useProgressAnalytics(sessionId);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {/* Performance History */}
      <ThroughputChart data={analytics.throughputTrends} />
      
      {/* Quality Metrics */}
      <QualityScoreDisplay score={analytics.qualityMetrics.overallQuality} />
      
      {/* Cost Analysis */}
      <CostBreakdown analysis={analytics.costAnalysis} />
    </div>
  );
}
```

### Custom Progress Tracking

```typescript
import { ProgressTracker } from '@/lib/progress-tracking';

// Create custom tracker
const tracker = new ProgressTracker('session-123', {
  mode: 'comprehensive',
  config: {
    updateIntervalMs: 1000,
    enablePerformanceAlerts: true,
    enableQualityTracking: true
  },
  callbacks: {
    onProgressUpdate: (metrics) => {
      console.log('Progress:', metrics.progressPercentage);
    },
    onETAUpdate: (eta) => {
      console.log('ETA:', eta.estimatedTimeRemainingMs);
    },
    onPerformanceAlert: (alert) => {
      console.warn('Alert:', alert.message);
    }
  },
  enablePersistence: true,
  enableAnalytics: true
});

// Update file progress
tracker.updateFileProgress('file-123', {
  status: 'processing',
  progress: 75,
  stage: 'embedding',
  stageProgress: 50
});

// Get current metrics
const metrics = tracker.getCurrentMetrics();
const eta = tracker.calculateETA();
```

## Configuration

### Tracking Modes

- **Minimal** - Basic progress tracking with minimal overhead
- **Basic** - Standard progress tracking with ETA calculations
- **Enhanced** - Advanced tracking with performance alerts and quality metrics
- **Comprehensive** - Full tracking with all features enabled

### Configuration Options

```typescript
interface ProgressTrackingConfig {
  updateIntervalMs: number;           // Progress update frequency
  etaUpdateIntervalMs: number;        // ETA calculation frequency
  throughputWindowMs: number;         // Throughput calculation window
  enableRealTimeUpdates: boolean;     // Real-time WebSocket updates
  enablePerformanceAlerts: boolean;   // Performance alert generation
  enableETAOptimization: boolean;     // Advanced ETA algorithms
  enableQualityTracking: boolean;     // Quality score calculation
  alertThresholds: {
    slowProcessingMs: number;         // Slow processing threshold
    highErrorRate: number;            // High error rate threshold
    lowThroughput: number;            // Low throughput threshold
    etaDeviationPercent: number;      // ETA deviation threshold
    qualityScoreThreshold: number;    // Quality score threshold
  };
}
```

## Metrics Reference

### Progress Metrics

```typescript
interface ProgressMetrics {
  // Basic Progress
  totalFiles: number;
  filesCompleted: number;
  filesFailed: number;
  filesPending: number;
  filesProcessing: number;
  progressPercentage: number;

  // Time Tracking
  startTime: Date;
  currentTime: Date;
  elapsedTimeMs: number;
  estimatedTimeRemainingMs?: number;
  estimatedCompletionTime?: Date;

  // Performance Metrics
  averageProcessingTimeMs: number;
  currentThroughput: number;        // files per minute
  peakThroughput: number;
  throughputHistory: ThroughputDataPoint[];

  // Rate Limiting Metrics
  rateLimitHits: number;
  rateLimitDelayMs: number;
  apiCallsTotal: number;
  apiCallsSuccessful: number;
  apiCallsFailed: number;
  apiSuccessRate: number;

  // Cost and Efficiency
  totalTokensUsed: number;
  estimatedCost: number;
  costPerFile: number;
  tokensPerFile: number;
  apiEfficiency: number;

  // Quality Metrics
  retryCount: number;
  errorRate: number;
  qualityScore: number;             // 0-1 scale
}
```

### ETA Calculation

```typescript
interface ETACalculation {
  estimatedTimeRemainingMs: number;
  estimatedCompletionTime: Date;
  confidence: number;               // 0-1 confidence score
  method: 'linear' | 'exponential' | 'adaptive' | 'ml_based';
  factors: {
    currentThroughput: number;
    averageThroughput: number;
    rateLimitingImpact: number;
    complexityFactor: number;
    historicalAccuracy: number;
  };
}
```

## Performance Optimization

### Best Practices

1. **Choose appropriate tracking mode** - Use minimal mode for simple scenarios
2. **Configure update intervals** - Balance real-time updates with performance
3. **Enable persistence selectively** - Only persist data when needed for analytics
4. **Monitor memory usage** - Clean up stale trackers regularly
5. **Use batch updates** - Group multiple progress updates when possible

### Memory Management

```typescript
// Clean up completed trackers
progressTrackingService.cleanupStaleTrackers(3600000); // 1 hour

// Stop tracking when done
progressTrackingService.stopTracking(sessionId);

// Destroy service when shutting down
progressTrackingService.destroy();
```

## Integration with Batch Session Management

The progress tracking system seamlessly integrates with the batch session management system:

- **Automatic session creation** - Progress tracking starts with batch sessions
- **Database synchronization** - Progress data persisted to batch session tables
- **Real-time updates** - Live progress updates via batch session channels
- **Analytics integration** - Performance data feeds into session analytics

## Troubleshooting

### Common Issues

**Progress not updating:**
- Check if tracking is enabled for the session
- Verify WebSocket connections are active
- Ensure file progress updates are being called

**Inaccurate ETAs:**
- Review ETA calculation method and confidence scores
- Check for rate limiting impacts on throughput
- Verify historical accuracy data

**Performance alerts not triggering:**
- Check alert threshold configurations
- Verify performance alert callbacks are registered
- Review alert severity levels

### Debug Tools

```typescript
// Get tracking status
const status = progressTrackingService.getActiveTrackingSessions();

// Validate metrics
const validation = validateProgressMetrics(metrics);
if (!validation.isValid) {
  console.error('Invalid metrics:', validation.errors);
}

// Generate insights
const insights = generateProgressInsights(metrics);
console.log('Progress insights:', insights);
```

## Future Enhancements

- **Machine learning-based ETA prediction** - AI-powered ETA algorithms
- **Cross-session analytics** - Performance comparisons across sessions
- **Predictive alerting** - Proactive issue detection and prevention
- **Advanced visualization** - Interactive performance dashboards
- **Export capabilities** - Progress data export for external analysis
