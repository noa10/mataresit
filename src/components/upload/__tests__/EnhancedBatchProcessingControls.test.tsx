/**
 * Enhanced Batch Processing Controls Tests
 * Phase 3: Batch Upload Optimization
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EnhancedBatchProcessingControls } from '../EnhancedBatchProcessingControls';
import { ProcessingStrategy } from '@/lib/progress-tracking';

// Mock the progress tracking utilities
jest.mock('@/lib/progress-tracking', () => ({
  useProgressFormatting: () => ({
    formatDuration: (ms: number) => `${Math.round(ms / 1000)}s`,
    formatThroughput: (rate: number) => `${rate.toFixed(1)}/min`,
    formatCost: (cost: number) => `$${cost.toFixed(4)}`,
    formatPercentage: (value: number) => `${(value * 100).toFixed(1)}%`,
    getProgressColor: (percentage: number) => '#3b82f6',
    getQualityColor: (score: number) => '#10b981'
  })
}));

describe('EnhancedBatchProcessingControls', () => {
  const defaultProps = {
    totalFiles: 10,
    pendingFiles: 3,
    activeFiles: 2,
    completedFiles: 4,
    failedFiles: 1,
    totalProgress: 50,
    isProcessing: false,
    isPaused: false,
    onStartProcessing: jest.fn(),
    onPauseProcessing: jest.fn(),
    onClearQueue: jest.fn(),
    onClearAll: jest.fn(),
    allComplete: false
  };

  const mockProgressMetrics = {
    totalFiles: 10,
    filesCompleted: 4,
    filesFailed: 1,
    filesPending: 3,
    filesProcessing: 2,
    progressPercentage: 50,
    startTime: new Date(),
    currentTime: new Date(),
    elapsedTimeMs: 120000,
    averageProcessingTimeMs: 30000,
    currentThroughput: 2.0,
    peakThroughput: 2.5,
    throughputHistory: [],
    rateLimitHits: 1,
    rateLimitDelayMs: 2000,
    apiCallsTotal: 5,
    apiCallsSuccessful: 4,
    apiCallsFailed: 1,
    apiSuccessRate: 0.8,
    totalTokensUsed: 10000,
    estimatedCost: 0.1,
    costPerFile: 0.01,
    tokensPerFile: 1000,
    apiEfficiency: 2000,
    retryCount: 1,
    errorRate: 0.1,
    qualityScore: 0.85
  };

  const mockEtaCalculation = {
    estimatedTimeRemainingMs: 180000,
    estimatedCompletionTime: new Date(Date.now() + 180000),
    confidence: 0.85,
    method: 'adaptive' as const,
    factors: {
      currentThroughput: 2.0,
      averageThroughput: 2.2,
      rateLimitingImpact: 0.1,
      complexityFactor: 1.0,
      historicalAccuracy: 0.9
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders basic batch processing controls', () => {
    render(<EnhancedBatchProcessingControls {...defaultProps} />);
    
    expect(screen.getByText('Batch Processing')).toBeInTheDocument();
    expect(screen.getByText('4 / 10')).toBeInTheDocument();
    expect(screen.getByText('Start Processing')).toBeInTheDocument();
  });

  it('displays file status grid correctly', () => {
    render(<EnhancedBatchProcessingControls {...defaultProps} />);
    
    expect(screen.getByText('4')).toBeInTheDocument(); // Completed
    expect(screen.getByText('2')).toBeInTheDocument(); // Processing
    expect(screen.getByText('3')).toBeInTheDocument(); // Pending
    expect(screen.getByText('1')).toBeInTheDocument(); // Failed
  });

  it('shows processing strategy selector when not processing', () => {
    const onStrategyChange = jest.fn();
    render(
      <EnhancedBatchProcessingControls 
        {...defaultProps} 
        processingStrategy="balanced"
        onProcessingStrategyChange={onStrategyChange}
      />
    );
    
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('calls onProcessingStrategyChange when strategy is changed', async () => {
    const onStrategyChange = jest.fn();
    render(
      <EnhancedBatchProcessingControls 
        {...defaultProps} 
        processingStrategy="balanced"
        onProcessingStrategyChange={onStrategyChange}
      />
    );
    
    const selector = screen.getByRole('combobox');
    fireEvent.click(selector);
    
    await waitFor(() => {
      const aggressiveOption = screen.getByText('Aggressive');
      fireEvent.click(aggressiveOption);
    });
    
    expect(onStrategyChange).toHaveBeenCalledWith('aggressive');
  });

  it('displays advanced metrics when enabled', () => {
    render(
      <EnhancedBatchProcessingControls 
        {...defaultProps} 
        progressMetrics={mockProgressMetrics}
        enableAdvancedView={true}
      />
    );
    
    expect(screen.getByText('2.0/min')).toBeInTheDocument(); // Throughput
    expect(screen.getByText('85.0%')).toBeInTheDocument(); // Quality
    expect(screen.getByText('$0.1000')).toBeInTheDocument(); // Cost
    expect(screen.getByText('80.0%')).toBeInTheDocument(); // API Success
  });

  it('displays ETA information when available', () => {
    render(
      <EnhancedBatchProcessingControls 
        {...defaultProps} 
        etaCalculation={mockEtaCalculation}
        enableAdvancedView={true}
      />
    );
    
    expect(screen.getByText(/ETA: 180s/)).toBeInTheDocument();
    expect(screen.getByText('85% confidence')).toBeInTheDocument();
  });

  it('displays progress alerts', () => {
    const mockAlerts = [
      {
        id: 'alert-1',
        type: 'rate_limiting' as const,
        severity: 'medium' as const,
        message: 'Rate limiting detected',
        timestamp: new Date(),
        sessionId: 'test-session',
        metrics: mockProgressMetrics,
        recommendations: [],
        autoResolved: false
      }
    ];

    const onDismissAlert = jest.fn();
    render(
      <EnhancedBatchProcessingControls 
        {...defaultProps} 
        progressAlerts={mockAlerts}
        onDismissAlert={onDismissAlert}
      />
    );
    
    expect(screen.getByText('Rate limiting detected')).toBeInTheDocument();
    
    const dismissButton = screen.getByText('×');
    fireEvent.click(dismissButton);
    
    expect(onDismissAlert).toHaveBeenCalledWith('alert-1');
  });

  it('shows rate limiting status when rate limited', () => {
    const rateLimitStatus = {
      isRateLimited: true,
      requestsRemaining: 10,
      tokensRemaining: 5000,
      backoffMs: 5000
    };

    render(
      <EnhancedBatchProcessingControls 
        {...defaultProps} 
        rateLimitStatus={rateLimitStatus}
        enableAdvancedView={true}
      />
    );
    
    expect(screen.getByText(/Rate Limited - 5s delay/)).toBeInTheDocument();
    expect(screen.getByText('10 requests left')).toBeInTheDocument();
  });

  it('calls onStartProcessing when start button is clicked', () => {
    const onStartProcessing = jest.fn();
    render(
      <EnhancedBatchProcessingControls 
        {...defaultProps} 
        onStartProcessing={onStartProcessing}
      />
    );
    
    const startButton = screen.getByText('Start Processing');
    fireEvent.click(startButton);
    
    expect(onStartProcessing).toHaveBeenCalled();
  });

  it('shows pause button when processing', () => {
    render(
      <EnhancedBatchProcessingControls 
        {...defaultProps} 
        isProcessing={true}
      />
    );
    
    expect(screen.getByText('Pause')).toBeInTheDocument();
  });

  it('shows review button when all complete', () => {
    const onShowReview = jest.fn();
    render(
      <EnhancedBatchProcessingControls 
        {...defaultProps} 
        allComplete={true}
        onShowReview={onShowReview}
      />
    );
    
    const reviewButton = screen.getByText('Review Results');
    expect(reviewButton).toBeInTheDocument();
    
    fireEvent.click(reviewButton);
    expect(onShowReview).toHaveBeenCalled();
  });

  it('displays processing strategy info when not processing', () => {
    render(
      <EnhancedBatchProcessingControls 
        {...defaultProps} 
        processingStrategy="balanced"
        totalFiles={5}
      />
    );
    
    expect(screen.getByText('Balanced')).toBeInTheDocument();
    expect(screen.getByText(/Optimal balance of speed and reliability/)).toBeInTheDocument();
    expect(screen.getByText('2 concurrent • 60/min')).toBeInTheDocument();
  });

  it('toggles advanced view when toggle button is clicked', () => {
    const onToggleAdvancedView = jest.fn();
    render(
      <EnhancedBatchProcessingControls 
        {...defaultProps} 
        onToggleAdvancedView={onToggleAdvancedView}
      />
    );
    
    const toggleButton = screen.getByRole('button', { name: '' }); // Settings icon button
    fireEvent.click(toggleButton);
    
    expect(onToggleAdvancedView).toHaveBeenCalled();
  });
});
