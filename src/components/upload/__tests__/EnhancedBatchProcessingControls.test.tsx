/**
 * Enhanced Batch Processing Controls Tests
 * Phase 3: Batch Upload Optimization
 * @vitest-environment jsdom
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnhancedBatchProcessingControls } from '../EnhancedBatchProcessingControls';

// Mock the progress tracking utilities
vi.mock('@/lib/progress-tracking', () => ({
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
    onStartProcessing: vi.fn(),
    onPauseProcessing: vi.fn(),
    onClearQueue: vi.fn(),
    onClearAll: vi.fn(),
    onRetryAllFailed: vi.fn(),
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
    vi.clearAllMocks();
  });

  it('renders basic batch processing controls', () => {
    render(<EnhancedBatchProcessingControls {...defaultProps} />);

    expect(screen.getByText('Batch Processing')).toBeInTheDocument();
    expect(screen.getByText('(5 / 10)')).toBeInTheDocument(); // 4 completed + 1 failed
    expect(screen.getByText('Start Processing')).toBeInTheDocument();
  });

  it('displays file status grid correctly', () => {
    render(<EnhancedBatchProcessingControls {...defaultProps} />);

    expect(screen.getByText('4')).toBeInTheDocument(); // Completed
    expect(screen.getByText('2')).toBeInTheDocument(); // Processing
    expect(screen.getByText('3')).toBeInTheDocument(); // Pending
    expect(screen.getByText('1')).toBeInTheDocument(); // Failed
  });

  it('displays ETA information when available', () => {
    render(
      <EnhancedBatchProcessingControls
        {...defaultProps}
        isProcessing={true}
        etaCalculation={mockEtaCalculation}
      />
    );

    expect(screen.getByText(/~180s remaining/)).toBeInTheDocument();
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

    const onDismissAlert = vi.fn();
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

  it('calls onStartProcessing when start button is clicked', () => {
    const onStartProcessing = vi.fn();
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

    expect(screen.getByText('Pause Processing')).toBeInTheDocument();
  });

  it('shows review button when all complete', () => {
    const onShowReview = vi.fn();
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
});
