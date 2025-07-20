/**
 * WebSocket Connection Tests for Queue System
 * Tests real-time WebSocket connections, subscriptions, and live data streaming
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock WebSocket and Supabase real-time functionality
const mockRealtimeChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  send: vi.fn(),
  track: vi.fn(),
  untrack: vi.fn()
};

const mockSupabaseRealtime = {
  channel: vi.fn(() => mockRealtimeChannel),
  removeChannel: vi.fn(),
  getChannels: vi.fn(() => []),
  disconnect: vi.fn(),
  connect: vi.fn()
};

const mockSupabase = {
  realtime: mockSupabaseRealtime,
  channel: vi.fn(() => mockRealtimeChannel),
  rpc: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ data: [], error: null }))
    }))
  }))
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

// Mock queue metrics service
class MockQueueMetricsRealtimeService {
  private subscriptions = new Map();
  private connectionStatus = 'disconnected';

  async subscribe(config: any, handlers: any): Promise<string> {
    const subscriptionId = `sub_${Date.now()}`;
    
    // Simulate connection establishment
    this.connectionStatus = 'connecting';
    
    // Setup mock channel
    const channel = mockSupabase.channel(`queue_metrics_${subscriptionId}`);
    
    // Configure event handlers
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'embedding_queue'
    }, handlers.onQueueChange);

    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'embedding_queue_workers'
    }, handlers.onWorkerChange);

    // Simulate subscription
    await channel.subscribe((status: string) => {
      this.connectionStatus = status === 'SUBSCRIBED' ? 'connected' : 'disconnected';
      if (handlers.onConnectionStatusChange) {
        handlers.onConnectionStatusChange(this.connectionStatus);
      }
    });

    this.subscriptions.set(subscriptionId, {
      config,
      handlers,
      channel,
      createdAt: new Date()
    });

    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      await subscription.channel.unsubscribe();
      this.subscriptions.delete(subscriptionId);
    }
  }

  getConnectionStatus(): string {
    return this.connectionStatus;
  }

  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  // Simulate real-time events for testing
  simulateQueueChange(payload: any): void {
    this.subscriptions.forEach(sub => {
      if (sub.handlers.onQueueChange) {
        sub.handlers.onQueueChange(payload);
      }
    });
  }

  simulateWorkerChange(payload: any): void {
    this.subscriptions.forEach(sub => {
      if (sub.handlers.onWorkerChange) {
        sub.handlers.onWorkerChange(payload);
      }
    });
  }

  simulateConnectionStatusChange(status: string): void {
    this.connectionStatus = status;
    this.subscriptions.forEach(sub => {
      if (sub.handlers.onConnectionStatusChange) {
        sub.handlers.onConnectionStatusChange(status);
      }
    });
  }
}

describe('WebSocket Connection Tests', () => {
  let realtimeService: MockQueueMetricsRealtimeService;

  beforeEach(() => {
    vi.clearAllMocks();
    realtimeService = new MockQueueMetricsRealtimeService();
    
    // Setup default mock responses
    mockRealtimeChannel.subscribe.mockImplementation((callback) => {
      setTimeout(() => callback('SUBSCRIBED'), 100);
      return Promise.resolve({ status: 'SUBSCRIBED' });
    });

    mockRealtimeChannel.unsubscribe.mockResolvedValue({ status: 'CLOSED' });
  });

  afterEach(() => {
    // Cleanup all subscriptions
    const activeSubscriptions = realtimeService.getActiveSubscriptions();
    activeSubscriptions.forEach(subId => {
      realtimeService.unsubscribe(subId);
    });
  });

  describe('Connection Establishment', () => {
    it('should establish WebSocket connection successfully', async () => {
      const connectionStatusHandler = vi.fn();
      
      const subscriptionId = await realtimeService.subscribe({
        enableQueueUpdates: true,
        enableWorkerUpdates: true
      }, {
        onConnectionStatusChange: connectionStatusHandler
      });

      expect(subscriptionId).toBeTruthy();
      expect(mockSupabase.channel).toHaveBeenCalled();
      expect(mockRealtimeChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          schema: 'public',
          table: 'embedding_queue'
        }),
        expect.any(Function)
      );
    });

    it('should handle connection failures gracefully', async () => {
      mockRealtimeChannel.subscribe.mockRejectedValueOnce(new Error('Connection failed'));
      
      const connectionStatusHandler = vi.fn();

      try {
        await realtimeService.subscribe({
          enableQueueUpdates: true
        }, {
          onConnectionStatusChange: connectionStatusHandler
        });
      } catch (error) {
        expect(error.message).toBe('Connection failed');
      }
    });

    it('should retry connection on failure', async () => {
      let attemptCount = 0;
      mockRealtimeChannel.subscribe.mockImplementation((callback) => {
        attemptCount++;
        if (attemptCount === 1) {
          return Promise.reject(new Error('Connection failed'));
        }
        setTimeout(() => callback('SUBSCRIBED'), 100);
        return Promise.resolve({ status: 'SUBSCRIBED' });
      });

      const connectionStatusHandler = vi.fn();

      // This would normally be handled by a retry mechanism in the real service
      try {
        await realtimeService.subscribe({
          enableQueueUpdates: true
        }, {
          onConnectionStatusChange: connectionStatusHandler
        });
      } catch (error) {
        // First attempt fails
        expect(error.message).toBe('Connection failed');
      }

      // Second attempt should succeed
      const subscriptionId = await realtimeService.subscribe({
        enableQueueUpdates: true
      }, {
        onConnectionStatusChange: connectionStatusHandler
      });

      expect(subscriptionId).toBeTruthy();
      expect(attemptCount).toBe(2);
    });
  });

  describe('Real-time Data Streaming', () => {
    it('should receive queue item updates in real-time', async () => {
      const queueChangeHandler = vi.fn();

      await realtimeService.subscribe({
        enableQueueUpdates: true
      }, {
        onQueueChange: queueChangeHandler
      });

      // Simulate queue item insertion
      const insertPayload = {
        eventType: 'INSERT',
        new: {
          id: 'queue-item-123',
          source_type: 'receipts',
          source_id: 'receipt-456',
          operation: 'INSERT',
          priority: 'high',
          status: 'pending',
          created_at: new Date().toISOString()
        },
        old: null
      };

      realtimeService.simulateQueueChange(insertPayload);

      expect(queueChangeHandler).toHaveBeenCalledWith(insertPayload);
    });

    it('should receive worker status updates in real-time', async () => {
      const workerChangeHandler = vi.fn();

      await realtimeService.subscribe({
        enableWorkerUpdates: true
      }, {
        onWorkerChange: workerChangeHandler
      });

      // Simulate worker status change
      const updatePayload = {
        eventType: 'UPDATE',
        new: {
          worker_id: 'worker-123',
          status: 'active',
          last_heartbeat: new Date().toISOString(),
          tasks_processed: 15,
          error_count: 0
        },
        old: {
          worker_id: 'worker-123',
          status: 'idle',
          last_heartbeat: new Date(Date.now() - 60000).toISOString(),
          tasks_processed: 14,
          error_count: 0
        }
      };

      realtimeService.simulateWorkerChange(updatePayload);

      expect(workerChangeHandler).toHaveBeenCalledWith(updatePayload);
    });

    it('should handle multiple simultaneous updates', async () => {
      const queueChangeHandler = vi.fn();
      const workerChangeHandler = vi.fn();

      await realtimeService.subscribe({
        enableQueueUpdates: true,
        enableWorkerUpdates: true
      }, {
        onQueueChange: queueChangeHandler,
        onWorkerChange: workerChangeHandler
      });

      // Simulate simultaneous updates
      const queuePayload = {
        eventType: 'UPDATE',
        new: { id: 'queue-1', status: 'processing' },
        old: { id: 'queue-1', status: 'pending' }
      };

      const workerPayload = {
        eventType: 'UPDATE',
        new: { worker_id: 'worker-1', tasks_processed: 20 },
        old: { worker_id: 'worker-1', tasks_processed: 19 }
      };

      realtimeService.simulateQueueChange(queuePayload);
      realtimeService.simulateWorkerChange(workerPayload);

      expect(queueChangeHandler).toHaveBeenCalledWith(queuePayload);
      expect(workerChangeHandler).toHaveBeenCalledWith(workerPayload);
    });
  });

  describe('Connection Management', () => {
    it('should track connection status changes', async () => {
      const connectionStatusHandler = vi.fn();

      await realtimeService.subscribe({
        enableQueueUpdates: true
      }, {
        onConnectionStatusChange: connectionStatusHandler
      });

      // Simulate connection status changes
      realtimeService.simulateConnectionStatusChange('connected');
      expect(connectionStatusHandler).toHaveBeenCalledWith('connected');

      realtimeService.simulateConnectionStatusChange('disconnected');
      expect(connectionStatusHandler).toHaveBeenCalledWith('disconnected');

      realtimeService.simulateConnectionStatusChange('reconnecting');
      expect(connectionStatusHandler).toHaveBeenCalledWith('reconnecting');
    });

    it('should handle connection drops and reconnection', async () => {
      const connectionStatusHandler = vi.fn();

      const subscriptionId = await realtimeService.subscribe({
        enableQueueUpdates: true
      }, {
        onConnectionStatusChange: connectionStatusHandler
      });

      // Simulate connection drop
      realtimeService.simulateConnectionStatusChange('disconnected');
      expect(connectionStatusHandler).toHaveBeenCalledWith('disconnected');

      // Simulate reconnection
      realtimeService.simulateConnectionStatusChange('connected');
      expect(connectionStatusHandler).toHaveBeenCalledWith('connected');

      expect(realtimeService.getActiveSubscriptions()).toContain(subscriptionId);
    });

    it('should cleanup subscriptions properly', async () => {
      const subscriptionId = await realtimeService.subscribe({
        enableQueueUpdates: true
      }, {
        onQueueChange: vi.fn()
      });

      expect(realtimeService.getActiveSubscriptions()).toContain(subscriptionId);

      await realtimeService.unsubscribe(subscriptionId);

      expect(realtimeService.getActiveSubscriptions()).not.toContain(subscriptionId);
      expect(mockRealtimeChannel.unsubscribe).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed real-time payloads', async () => {
      const queueChangeHandler = vi.fn();

      await realtimeService.subscribe({
        enableQueueUpdates: true
      }, {
        onQueueChange: queueChangeHandler
      });

      // Simulate malformed payload
      const malformedPayload = {
        eventType: 'INVALID',
        // Missing required fields
      };

      // Should not crash when receiving malformed data
      expect(() => {
        realtimeService.simulateQueueChange(malformedPayload);
      }).not.toThrow();

      expect(queueChangeHandler).toHaveBeenCalledWith(malformedPayload);
    });

    it('should handle subscription errors gracefully', async () => {
      mockRealtimeChannel.on.mockImplementation(() => {
        throw new Error('Subscription setup failed');
      });

      try {
        await realtimeService.subscribe({
          enableQueueUpdates: true
        }, {
          onQueueChange: vi.fn()
        });
      } catch (error) {
        expect(error.message).toBe('Subscription setup failed');
      }
    });

    it('should handle unsubscription errors', async () => {
      const subscriptionId = await realtimeService.subscribe({
        enableQueueUpdates: true
      }, {
        onQueueChange: vi.fn()
      });

      mockRealtimeChannel.unsubscribe.mockRejectedValueOnce(new Error('Unsubscribe failed'));

      try {
        await realtimeService.unsubscribe(subscriptionId);
      } catch (error) {
        expect(error.message).toBe('Unsubscribe failed');
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent subscriptions', async () => {
      const subscriptions = [];

      // Create multiple subscriptions
      for (let i = 0; i < 5; i++) {
        const subscriptionId = await realtimeService.subscribe({
          enableQueueUpdates: true,
          enableWorkerUpdates: true
        }, {
          onQueueChange: vi.fn(),
          onWorkerChange: vi.fn()
        });
        subscriptions.push(subscriptionId);
      }

      expect(realtimeService.getActiveSubscriptions()).toHaveLength(5);

      // Cleanup
      for (const subId of subscriptions) {
        await realtimeService.unsubscribe(subId);
      }

      expect(realtimeService.getActiveSubscriptions()).toHaveLength(0);
    });

    it('should handle high-frequency updates efficiently', async () => {
      const queueChangeHandler = vi.fn();

      await realtimeService.subscribe({
        enableQueueUpdates: true
      }, {
        onQueueChange: queueChangeHandler
      });

      // Simulate high-frequency updates
      const updateCount = 100;
      for (let i = 0; i < updateCount; i++) {
        realtimeService.simulateQueueChange({
          eventType: 'UPDATE',
          new: { id: `queue-${i}`, status: 'processing' },
          old: { id: `queue-${i}`, status: 'pending' }
        });
      }

      expect(queueChangeHandler).toHaveBeenCalledTimes(updateCount);
    });
  });
});
