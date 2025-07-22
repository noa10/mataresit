/**
 * Vitest Setup for Queue System Tests
 * Configures test environment, mocks, and global utilities
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';

// Global test configuration
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.VITE_SUPABASE_URL = 'http://127.0.0.1:54331';
  process.env.VITE_SUPABASE_ANON_KEY = 'test-key';
  
  // Mock console methods to reduce noise in tests
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  
  // Setup global fetch mock
  global.fetch = vi.fn();
  
  // Setup global WebSocket mock
  global.WebSocket = vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1, // OPEN
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  }));
  
  // Setup global performance mock
  Object.defineProperty(global, 'performance', {
    value: {
      now: vi.fn(() => Date.now()),
      mark: vi.fn(),
      measure: vi.fn(),
      getEntriesByName: vi.fn(() => []),
      getEntriesByType: vi.fn(() => []),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn()
    },
    writable: true,
    configurable: true
  });
  
  console.log('🧪 Queue test environment initialized');
});

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Reset fetch mock
  (global.fetch as any).mockClear();
  
  // Reset timers
  vi.clearAllTimers();
});

afterEach(() => {
  // Cleanup after each test
  vi.restoreAllMocks();
});

afterAll(() => {
  // Cleanup global mocks
  vi.restoreAllMocks();
  console.log('🧹 Queue test environment cleaned up');
});

// Global test utilities
export const testUtils = {
  // Mock Supabase response
  mockSupabaseResponse: (data: any, error: any = null) => ({
    data,
    error
  }),
  
  // Mock worker data
  mockWorkerData: (overrides: any = {}) => ({
    worker_id: 'test-worker-1',
    status: 'active',
    last_heartbeat: new Date().toISOString(),
    tasks_processed: 10,
    total_processing_time_ms: 50000,
    error_count: 0,
    rate_limit_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }),
  
  // Mock queue metrics data
  mockQueueMetrics: (overrides: any = {}) => ({
    total_pending: 5,
    total_processing: 2,
    total_completed: 100,
    total_failed: 1,
    total_rate_limited: 0,
    avg_processing_time_ms: 2000,
    active_workers: 2,
    oldest_pending_age_hours: 0.5,
    ...overrides
  }),
  
  // Mock performance data
  mockPerformanceData: (overrides: any = {}) => ({
    throughput_per_hour: 50,
    success_rate: 99,
    avg_queue_wait_time_ms: 1000,
    worker_efficiency: 85,
    queue_health_score: 90,
    ...overrides
  }),
  
  // Wait for async operations
  waitFor: (ms: number = 100) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Create mock fetch response
  mockFetchResponse: (data: any, ok: boolean = true, status: number = 200) => ({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data))
  }),
  
  // Create mock error
  mockError: (message: string, code?: string) => {
    const error = new Error(message);
    if (code) (error as any).code = code;
    return error;
  }
};

// Export for use in tests
export default testUtils;
