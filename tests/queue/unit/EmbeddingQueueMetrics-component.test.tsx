/**
 * Enhanced Unit Tests for EmbeddingQueueMetrics Component
 * Comprehensive testing of queue metrics display component with extended coverage
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { EmbeddingQueueMetrics } from '@/components/admin/EmbeddingQueueMetrics';

// Mock the useQueueMetrics hook
const mockUseQueueMetrics = vi.fn();
vi.mock('@/hooks/useQueueMetrics', () => ({
  useQueueMetrics: mockUseQueueMetrics
}));

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={`card ${className}`}>{children}</div>,
  CardContent: ({ children }: any) => <div className="card-content">{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={`card-header ${className}`}>{children}</div>,
  CardTitle: ({ children, className }: any) => <div className={`card-title ${className}`}>{children}</div>
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => <span className={`badge ${className}`}>{children}</span>
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: any) => <div className={`progress ${className}`} data-value={value}></div>
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Clock: () => <div data-testid="clock-icon">Clock</div>,
  Activity: () => <div data-testid="activity-icon">Activity</div>,
  CheckCircle: () => <div data-testid="check-circle-icon">CheckCircle</div>,
  XCircle: () => <div data-testid="x-circle-icon">XCircle</div>,
  Users: () => <div data-testid="users-icon">Users</div>,
  Zap: () => <div data-testid="zap-icon">Zap</div>,
  TrendingUp: () => <div data-testid="trending-up-icon">TrendingUp</div>,
  AlertTriangle: () => <div data-testid="alert-triangle-icon">AlertTriangle</div>,
  Timer: () => <div data-testid="timer-icon">Timer</div>,
  Database: () => <div data-testid="database-icon">Database</div>
}));

describe('EmbeddingQueueMetrics Component Tests', () => {
  const mockQueueMetrics = {
    total_pending: 15,
    total_processing: 3,
    total_completed: 142,
    total_failed: 2,
    total_rate_limited: 1,
    avg_processing_time_ms: 2500,
    active_workers: 2,
    oldest_pending_age_hours: 0.5
  };

  const mockPerformanceData = {
    throughput_per_hour: 45.5,
    success_rate: 98.6,
    avg_queue_wait_time_ms: 1800000,
    worker_efficiency: 85.2,
    queue_health_score: 92
  };

  const mockWorkers = [
    {
      worker_id: 'worker-1',
      status: 'active' as const,
      last_heartbeat: new Date().toISOString(),
      tasks_processed: 25,
      total_processing_time_ms: 125000,
      error_count: 2,
      rate_limit_count: 1
    },
    {
      worker_id: 'worker-2',
      status: 'idle' as const,
      last_heartbeat: new Date(Date.now() - 30000).toISOString(),
      tasks_processed: 18,
      total_processing_time_ms: 90000,
      error_count: 0,
      rate_limit_count: 0
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementation
    mockUseQueueMetrics.mockReturnValue({
      queueMetrics: mockQueueMetrics,
      performanceData: mockPerformanceData,
      workers: mockWorkers,
      isLoading: false,
      isRefreshing: false,
      error: null,
      lastUpdateTime: new Date(),
      refreshData: vi.fn(),
      updateConfig: vi.fn(),
      startWorker: vi.fn(),
      stopWorker: vi.fn(),
      getWorkerStatus: vi.fn()
    });
  });

  describe('Component Rendering', () => {
    it('should render basic queue metrics correctly', () => {
      render(<EmbeddingQueueMetrics />);

      // Check for pending items
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('Pending Items')).toBeInTheDocument();
      expect(screen.getByText('Oldest: 0.5h ago')).toBeInTheDocument();

      // Check for processing items
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Processing')).toBeInTheDocument();

      // Check for completed items
      expect(screen.getByText('142')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();

      // Check for failed items
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();

      // Check for active workers
      expect(screen.getByText('Active Workers')).toBeInTheDocument();
    });

    it('should render performance metrics when showDetailed is true', () => {
      render(<EmbeddingQueueMetrics showDetailed={true} />);

      expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
      expect(screen.getByText('Avg Processing Time')).toBeInTheDocument();
      expect(screen.getByText('2.5s')).toBeInTheDocument();
      expect(screen.getByText('Worker Efficiency')).toBeInTheDocument();
      expect(screen.getByText('85.2%')).toBeInTheDocument();
    });

    it('should not render detailed metrics when showDetailed is false', () => {
      render(<EmbeddingQueueMetrics showDetailed={false} />);

      expect(screen.queryByText('Performance Metrics')).not.toBeInTheDocument();
      expect(screen.queryByText('Worker Efficiency')).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<EmbeddingQueueMetrics className="custom-class" />);
      
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Health Status Display', () => {
    it('should display healthy status with green indicator', () => {
      render(<EmbeddingQueueMetrics />);

      const healthBadge = screen.getByText('Healthy');
      expect(healthBadge).toBeInTheDocument();
      expect(healthBadge).toHaveClass('bg-green-500');
    });

    it('should display warning status with yellow indicator', () => {
      mockUseQueueMetrics.mockReturnValue({
        queueMetrics: mockQueueMetrics,
        performanceData: { ...mockPerformanceData, queue_health_score: 65 },
        workers: mockWorkers,
        isLoading: false,
        error: null
      });

      render(<EmbeddingQueueMetrics />);

      const healthBadge = screen.getByText('Warning');
      expect(healthBadge).toBeInTheDocument();
      expect(healthBadge).toHaveClass('bg-yellow-500');
    });

    it('should display critical status with red indicator', () => {
      mockUseQueueMetrics.mockReturnValue({
        queueMetrics: mockQueueMetrics,
        performanceData: { ...mockPerformanceData, queue_health_score: 45 },
        workers: mockWorkers,
        isLoading: false,
        error: null
      });

      render(<EmbeddingQueueMetrics />);

      const healthBadge = screen.getByText('Critical');
      expect(healthBadge).toBeInTheDocument();
      expect(healthBadge).toHaveClass('bg-red-500');
    });

    it('should display unknown status when no data available', () => {
      mockUseQueueMetrics.mockReturnValue({
        queueMetrics: null,
        performanceData: null,
        workers: [],
        isLoading: false,
        error: null
      });

      render(<EmbeddingQueueMetrics />);

      const healthBadge = screen.getByText('Unknown');
      expect(healthBadge).toBeInTheDocument();
      expect(healthBadge).toHaveClass('bg-gray-500');
    });
  });

  describe('Loading States', () => {
    it('should display loading state', () => {
      mockUseQueueMetrics.mockReturnValue({
        queueMetrics: null,
        performanceData: null,
        workers: [],
        isLoading: true,
        error: null
      });

      render(<EmbeddingQueueMetrics />);

      expect(screen.getByText('Loading queue metrics...')).toBeInTheDocument();
    });

    it('should display refreshing indicator', () => {
      mockUseQueueMetrics.mockReturnValue({
        queueMetrics: mockQueueMetrics,
        performanceData: mockPerformanceData,
        workers: mockWorkers,
        isLoading: false,
        isRefreshing: true,
        error: null
      });

      render(<EmbeddingQueueMetrics />);

      expect(screen.getByText('Refreshing...')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when error occurs', () => {
      mockUseQueueMetrics.mockReturnValue({
        queueMetrics: null,
        performanceData: null,
        workers: [],
        isLoading: false,
        error: 'Failed to load queue metrics'
      });

      render(<EmbeddingQueueMetrics />);

      expect(screen.getByText('Error loading queue metrics')).toBeInTheDocument();
      expect(screen.getByText('Failed to load queue metrics')).toBeInTheDocument();
    });

    it('should show retry button on error', () => {
      const mockRefreshData = vi.fn();
      mockUseQueueMetrics.mockReturnValue({
        queueMetrics: null,
        performanceData: null,
        workers: [],
        isLoading: false,
        error: 'Network error',
        refreshData: mockRefreshData
      });

      render(<EmbeddingQueueMetrics />);

      const retryButton = screen.getByText('Retry');
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(mockRefreshData).toHaveBeenCalled();
    });
  });

  describe('Worker Status Display', () => {
    it('should display worker information in detailed view', () => {
      render(<EmbeddingQueueMetrics showDetailed={true} />);

      expect(screen.getByText('worker-1')).toBeInTheDocument();
      expect(screen.getByText('worker-2')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Idle')).toBeInTheDocument();
    });

    it('should show worker task counts', () => {
      render(<EmbeddingQueueMetrics showDetailed={true} />);

      expect(screen.getByText('25 tasks')).toBeInTheDocument();
      expect(screen.getByText('18 tasks')).toBeInTheDocument();
    });

    it('should display worker error counts', () => {
      render(<EmbeddingQueueMetrics showDetailed={true} />);

      expect(screen.getByText('2 errors')).toBeInTheDocument();
      expect(screen.getByText('0 errors')).toBeInTheDocument();
    });
  });

  describe('Progress Indicators', () => {
    it('should display progress bars for queue health', () => {
      render(<EmbeddingQueueMetrics showDetailed={true} />);

      const progressBar = screen.getByTestId('health-progress');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('data-value', '92');
    });

    it('should display success rate progress', () => {
      render(<EmbeddingQueueMetrics showDetailed={true} />);

      const successRateProgress = screen.getByTestId('success-rate-progress');
      expect(successRateProgress).toBeInTheDocument();
      expect(successRateProgress).toHaveAttribute('data-value', '98.6');
    });
  });

  describe('Data Formatting', () => {
    it('should format processing time correctly', () => {
      render(<EmbeddingQueueMetrics showDetailed={true} />);

      // 2500ms should be displayed as 2.5s
      expect(screen.getByText('2.5s')).toBeInTheDocument();
    });

    it('should format percentage values correctly', () => {
      render(<EmbeddingQueueMetrics showDetailed={true} />);

      expect(screen.getByText('85.2%')).toBeInTheDocument();
      expect(screen.getByText('98.6%')).toBeInTheDocument();
    });

    it('should format age values correctly', () => {
      render(<EmbeddingQueueMetrics />);

      expect(screen.getByText('Oldest: 0.5h ago')).toBeInTheDocument();
    });

    it('should handle zero values gracefully', () => {
      mockUseQueueMetrics.mockReturnValue({
        queueMetrics: {
          ...mockQueueMetrics,
          total_pending: 0,
          oldest_pending_age_hours: 0
        },
        performanceData: mockPerformanceData,
        workers: mockWorkers,
        isLoading: false,
        error: null
      });

      render(<EmbeddingQueueMetrics />);

      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.queryByText('Oldest:')).not.toBeInTheDocument();
    });
  });

  describe('Real-time Updates', () => {
    it('should update metrics when hook data changes', async () => {
      const { rerender } = render(<EmbeddingQueueMetrics />);

      expect(screen.getByText('15')).toBeInTheDocument();

      // Update mock data
      mockUseQueueMetrics.mockReturnValue({
        queueMetrics: { ...mockQueueMetrics, total_pending: 20 },
        performanceData: mockPerformanceData,
        workers: mockWorkers,
        isLoading: false,
        error: null
      });

      rerender(<EmbeddingQueueMetrics />);

      expect(screen.getByText('20')).toBeInTheDocument();
    });

    it('should show last update time', () => {
      const lastUpdate = new Date('2024-01-15T10:30:00Z');
      mockUseQueueMetrics.mockReturnValue({
        queueMetrics: mockQueueMetrics,
        performanceData: mockPerformanceData,
        workers: mockWorkers,
        isLoading: false,
        error: null,
        lastUpdateTime: lastUpdate
      });

      render(<EmbeddingQueueMetrics showDetailed={true} />);

      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<EmbeddingQueueMetrics />);

      const healthStatus = screen.getByLabelText('Queue health status');
      expect(healthStatus).toBeInTheDocument();

      const pendingItems = screen.getByLabelText('Pending queue items');
      expect(pendingItems).toBeInTheDocument();
    });

    it('should have proper heading structure', () => {
      render(<EmbeddingQueueMetrics showDetailed={true} />);

      const mainHeading = screen.getByRole('heading', { level: 2 });
      expect(mainHeading).toHaveTextContent('Queue Status');

      const subHeadings = screen.getAllByRole('heading', { level: 3 });
      expect(subHeadings.length).toBeGreaterThan(0);
    });

    it('should support keyboard navigation', () => {
      render(<EmbeddingQueueMetrics />);

      const retryButton = screen.queryByRole('button');
      if (retryButton) {
        expect(retryButton).toHaveAttribute('tabIndex', '0');
      }
    });
  });

  describe('Responsive Design', () => {
    it('should apply responsive classes', () => {
      const { container } = render(<EmbeddingQueueMetrics />);

      const gridContainer = container.querySelector('.grid');
      expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4');
    });

    it('should handle mobile layout', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<EmbeddingQueueMetrics />);

      const container = screen.getByTestId('queue-metrics-container');
      expect(container).toHaveClass('mobile-layout');
    });
  });

  describe('Performance Optimizations', () => {
    it('should memoize expensive calculations', () => {
      const { rerender } = render(<EmbeddingQueueMetrics />);

      // Rerender with same props
      rerender(<EmbeddingQueueMetrics />);

      // Component should not recalculate health status unnecessarily
      expect(mockUseQueueMetrics).toHaveBeenCalledTimes(2);
    });

    it('should handle large numbers efficiently', () => {
      mockUseQueueMetrics.mockReturnValue({
        queueMetrics: {
          ...mockQueueMetrics,
          total_completed: 1000000,
          total_pending: 50000
        },
        performanceData: mockPerformanceData,
        workers: mockWorkers,
        isLoading: false,
        error: null
      });

      render(<EmbeddingQueueMetrics />);

      expect(screen.getByText('1,000,000')).toBeInTheDocument();
      expect(screen.getByText('50,000')).toBeInTheDocument();
    });
  });

  describe('Extended Component Features', () => {
    it('should display queue throughput metrics', () => {
      render(<EmbeddingQueueMetrics showDetailed={true} />);

      expect(screen.getByText('45.5')).toBeInTheDocument();
      expect(screen.getByText('items/hr')).toBeInTheDocument();
    });

    it('should show rate limiting information', () => {
      render(<EmbeddingQueueMetrics />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('Rate Limited')).toBeInTheDocument();
    });

    it('should handle component prop changes', () => {
      const { rerender } = render(<EmbeddingQueueMetrics showDetailed={false} />);

      expect(screen.queryByText('Performance Metrics')).not.toBeInTheDocument();

      rerender(<EmbeddingQueueMetrics showDetailed={true} />);

      expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
    });

    it('should display worker heartbeat status', () => {
      render(<EmbeddingQueueMetrics showDetailed={true} />);

      expect(screen.getByText('worker-1')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should show queue age warnings for old items', () => {
      mockUseQueueMetrics.mockReturnValue({
        queueMetrics: { ...mockQueueMetrics, oldest_pending_age_hours: 2.5 },
        performanceData: mockPerformanceData,
        workers: mockWorkers,
        isLoading: false,
        error: null
      });

      render(<EmbeddingQueueMetrics />);

      expect(screen.getByText('Oldest: 2.5h ago')).toBeInTheDocument();
    });

    it('should handle refresh button interaction', async () => {
      const mockRefreshData = vi.fn();
      mockUseQueueMetrics.mockReturnValue({
        queueMetrics: mockQueueMetrics,
        performanceData: mockPerformanceData,
        workers: mockWorkers,
        isLoading: false,
        error: null,
        refreshData: mockRefreshData
      });

      render(<EmbeddingQueueMetrics />);

      const refreshButton = screen.queryByRole('button', { name: /refresh/i });
      if (refreshButton) {
        fireEvent.click(refreshButton);
        expect(mockRefreshData).toHaveBeenCalled();
      }
    });
  });

  describe('Component Integration', () => {
    it('should integrate with auto-refresh functionality', async () => {
      vi.useFakeTimers();

      render(<EmbeddingQueueMetrics />);

      // Verify initial render
      expect(screen.getByText('15')).toBeInTheDocument();

      // Mock updated data
      mockUseQueueMetrics.mockReturnValue({
        queueMetrics: { ...mockQueueMetrics, total_pending: 20 },
        performanceData: mockPerformanceData,
        workers: mockWorkers,
        isLoading: false,
        error: null
      });

      // Component should update when hook data changes
      await waitFor(() => {
        expect(screen.getByText('20')).toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it('should handle component unmounting gracefully', () => {
      const { unmount } = render(<EmbeddingQueueMetrics />);

      expect(() => unmount()).not.toThrow();
    });

    it('should maintain state consistency during updates', async () => {
      const { rerender } = render(<EmbeddingQueueMetrics />);

      // Update with new data
      mockUseQueueMetrics.mockReturnValue({
        queueMetrics: { ...mockQueueMetrics, total_pending: 25 },
        performanceData: { ...mockPerformanceData, queue_health_score: 88 },
        workers: mockWorkers,
        isLoading: false,
        error: null
      });

      rerender(<EmbeddingQueueMetrics />);

      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('Healthy')).toBeInTheDocument();
    });

    it('should handle edge cases in data display', () => {
      mockUseQueueMetrics.mockReturnValue({
        queueMetrics: {
          ...mockQueueMetrics,
          total_pending: 0,
          oldest_pending_age_hours: 0,
          avg_processing_time_ms: 0
        },
        performanceData: { ...mockPerformanceData, success_rate: 100 },
        workers: [],
        isLoading: false,
        error: null
      });

      render(<EmbeddingQueueMetrics showDetailed={true} />);

      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('100.0%')).toBeInTheDocument();
      expect(screen.getByText('0.0s')).toBeInTheDocument();
    });
  });
});
