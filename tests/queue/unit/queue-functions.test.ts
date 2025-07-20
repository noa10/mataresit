/**
 * Unit Tests for Queue Management Functions
 * Tests the core database functions for queue processing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Supabase for unit tests
const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => ({ data: null, error: null })),
        order: vi.fn(() => ({
          limit: vi.fn(() => ({ data: [], error: null }))
        }))
      })),
      insert: vi.fn(() => ({ data: null, error: null })),
      update: vi.fn(() => ({ data: null, error: null })),
      upsert: vi.fn(() => ({ data: null, error: null }))
    }))
  }))
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

describe('Queue Management Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get_next_embedding_batch', () => {
    it('should return prioritized batch of queue items', async () => {
      const mockBatchData = [
        {
          id: 'item-1',
          source_type: 'receipts',
          source_id: 'receipt-1',
          operation: 'INSERT',
          priority: 'high',
          metadata: { test: true },
          estimated_tokens: 1000
        },
        {
          id: 'item-2',
          source_type: 'receipts',
          source_id: 'receipt-2',
          operation: 'INSERT',
          priority: 'medium',
          metadata: { test: true },
          estimated_tokens: 800
        }
      ];

      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockBatchData,
        error: null
      });

      const { data, error } = await mockSupabase.rpc('get_next_embedding_batch', {
        worker_id_param: 'test-worker-1',
        batch_size_param: 5
      });

      expect(error).toBeNull();
      expect(data).toEqual(mockBatchData);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_next_embedding_batch', {
        worker_id_param: 'test-worker-1',
        batch_size_param: 5
      });
    });

    it('should handle empty queue gracefully', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const { data, error } = await mockSupabase.rpc('get_next_embedding_batch', {
        worker_id_param: 'test-worker-1',
        batch_size_param: 5
      });

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('should handle database errors', async () => {
      const mockError = { message: 'Database connection failed' };
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: mockError
      });

      const { data, error } = await mockSupabase.rpc('get_next_embedding_batch', {
        worker_id_param: 'test-worker-1',
        batch_size_param: 5
      });

      expect(data).toBeNull();
      expect(error).toEqual(mockError);
    });
  });

  describe('complete_embedding_queue_item', () => {
    it('should mark item as completed successfully', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const { error } = await mockSupabase.rpc('complete_embedding_queue_item', {
        item_id: 'test-item-1',
        worker_id_param: 'test-worker-1',
        success: true,
        actual_tokens_param: 1200,
        error_message_param: null
      });

      expect(error).toBeNull();
      expect(mockSupabase.rpc).toHaveBeenCalledWith('complete_embedding_queue_item', {
        item_id: 'test-item-1',
        worker_id_param: 'test-worker-1',
        success: true,
        actual_tokens_param: 1200,
        error_message_param: null
      });
    });

    it('should handle failed item completion with retry logic', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const { error } = await mockSupabase.rpc('complete_embedding_queue_item', {
        item_id: 'test-item-1',
        worker_id_param: 'test-worker-1',
        success: false,
        actual_tokens_param: null,
        error_message_param: 'API rate limit exceeded'
      });

      expect(error).toBeNull();
      expect(mockSupabase.rpc).toHaveBeenCalledWith('complete_embedding_queue_item', {
        item_id: 'test-item-1',
        worker_id_param: 'test-worker-1',
        success: false,
        actual_tokens_param: null,
        error_message_param: 'API rate limit exceeded'
      });
    });
  });

  describe('handle_rate_limit', () => {
    it('should handle rate limiting with delay', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const { error } = await mockSupabase.rpc('handle_rate_limit', {
        item_id: 'test-item-1',
        worker_id_param: 'test-worker-1',
        delay_ms: 60000
      });

      expect(error).toBeNull();
      expect(mockSupabase.rpc).toHaveBeenCalledWith('handle_rate_limit', {
        item_id: 'test-item-1',
        worker_id_param: 'test-worker-1',
        delay_ms: 60000
      });
    });
  });

  describe('get_queue_statistics', () => {
    it('should return comprehensive queue statistics', async () => {
      const mockStats = {
        total_pending: 15,
        total_processing: 3,
        total_completed: 142,
        total_failed: 2,
        total_rate_limited: 1,
        avg_processing_time_ms: 2500,
        active_workers: 2,
        oldest_pending_age_hours: 0.5
      };

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockStats],
        error: null
      });

      const { data, error } = await mockSupabase.rpc('get_queue_statistics');

      expect(error).toBeNull();
      expect(data).toEqual([mockStats]);
      expect(data[0].total_pending).toBe(15);
      expect(data[0].active_workers).toBe(2);
    });
  });

  describe('cleanup_old_queue_items', () => {
    it('should return count of cleaned up items', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 25,
        error: null
      });

      const { data, error } = await mockSupabase.rpc('cleanup_old_queue_items');

      expect(error).toBeNull();
      expect(data).toBe(25);
    });
  });

  describe('requeue_failed_items', () => {
    it('should return count of requeued items', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 5,
        error: null
      });

      const { data, error } = await mockSupabase.rpc('requeue_failed_items', {
        max_items: 100
      });

      expect(error).toBeNull();
      expect(data).toBe(5);
    });
  });

  describe('update_worker_heartbeat', () => {
    it('should update worker heartbeat successfully', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const { error } = await mockSupabase.rpc('update_worker_heartbeat', {
        worker_id_param: 'test-worker-1',
        worker_status: 'active'
      });

      expect(error).toBeNull();
      expect(mockSupabase.rpc).toHaveBeenCalledWith('update_worker_heartbeat', {
        worker_id_param: 'test-worker-1',
        worker_status: 'active'
      });
    });
  });

  describe('cleanup_stale_workers', () => {
    it('should return count of cleaned up workers', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: 2,
        error: null
      });

      const { data, error } = await mockSupabase.rpc('cleanup_stale_workers');

      expect(error).toBeNull();
      expect(data).toBe(2);
    });
  });

  describe('get_queue_config and update_queue_config', () => {
    it('should retrieve queue configuration', async () => {
      const mockConfig = { batch_size: 5, max_concurrent_workers: 3 };
      
      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockConfig,
        error: null
      });

      const { data, error } = await mockSupabase.rpc('get_queue_config', {
        config_key_param: 'batch_size'
      });

      expect(error).toBeNull();
      expect(data).toEqual(mockConfig);
    });

    it('should update queue configuration', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const { error } = await mockSupabase.rpc('update_queue_config', {
        config_key_param: 'batch_size',
        config_value_param: 10,
        updated_by_param: 'admin-user-1'
      });

      expect(error).toBeNull();
      expect(mockSupabase.rpc).toHaveBeenCalledWith('update_queue_config', {
        config_key_param: 'batch_size',
        config_value_param: 10,
        updated_by_param: 'admin-user-1'
      });
    });
  });
});
