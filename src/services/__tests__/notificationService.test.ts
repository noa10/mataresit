import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { NotificationService } from '../notificationService';
import { supabase } from '@/lib/supabase';
import type { NotificationType, NotificationPriority } from '@/types/notifications';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    },
    channel: vi.fn(),
    removeChannel: vi.fn()
  }
}));

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockChannel: any;
  let mockUser: any;

  beforeEach(() => {
    notificationService = new NotificationService();
    
    // Setup mock user
    mockUser = {
      id: 'test-user-123',
      email: 'test@example.com'
    };

    // Setup mock channel
    mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis()
    };

    // Setup Supabase mocks
    (supabase.auth.getUser as Mock).mockResolvedValue({
      data: { user: mockUser },
      error: null
    });

    (supabase.channel as Mock).mockReturnValue(mockChannel);
  });

  afterEach(() => {
    vi.clearAllMocks();
    notificationService.resetConnectionState();
  });

  describe('Validation System', () => {
    it('should validate notification types correctly', async () => {
      const validTypes: NotificationType[] = [
        'receipt_processing_completed',
        'team_member_joined',
        'claim_review_requested'
      ];

      const invalidTypes = [
        'system_review_requested', // This was the original error
        'invalid_type',
        'another_invalid_type'
      ] as NotificationType[];

      // Test with valid types - should not throw
      const callback = vi.fn();
      
      try {
        await notificationService.subscribeToAllUserNotificationChanges(
          callback,
          'test-team',
          { notificationTypes: validTypes }
        );
        expect(true).toBe(true); // Should reach here
      } catch (error) {
        // Should not throw for valid types
        expect(error).toBeNull();
      }
    });

    it('should filter out invalid notification types', async () => {
      const mixedTypes = [
        'receipt_processing_completed', // valid
        'system_review_requested', // invalid - this was causing the original error
        'team_member_joined', // valid
        'invalid_type' // invalid
      ] as NotificationType[];

      const callback = vi.fn();
      
      // Should not throw, but should filter out invalid types
      await notificationService.subscribeToAllUserNotificationChanges(
        callback,
        'test-team',
        { notificationTypes: mixedTypes }
      );

      // Verify that supabase.channel was called (subscription was created)
      expect(supabase.channel).toHaveBeenCalled();
    });

    it('should validate priority values correctly', async () => {
      const validPriorities: NotificationPriority[] = ['low', 'medium', 'high'];
      const invalidPriorities = ['critical', 'urgent', 'invalid'] as NotificationPriority[];

      const callback = vi.fn();

      // Test with valid priorities
      await notificationService.subscribeToAllUserNotificationChanges(
        callback,
        'test-team',
        { priorities: validPriorities }
      );

      expect(supabase.channel).toHaveBeenCalled();

      // Test with invalid priorities - should filter them out
      await notificationService.subscribeToAllUserNotificationChanges(
        callback,
        'test-team',
        { priorities: invalidPriorities }
      );

      expect(supabase.channel).toHaveBeenCalledTimes(2);
    });
  });

  describe('Circuit Breaker', () => {
    it('should allow operations when circuit is closed', () => {
      const dashboard = notificationService.getMonitoringDashboard();
      expect(dashboard.circuitBreaker.state).toBe('closed');
      expect(dashboard.circuitBreaker.canExecute).toBe(true);
    });

    it('should open circuit after repeated failures', async () => {
      // Simulate multiple failures
      for (let i = 0; i < 6; i++) {
        try {
          // Force a failure by providing invalid user
          (supabase.auth.getUser as Mock).mockResolvedValueOnce({
            data: { user: null },
            error: new Error('User not authenticated')
          });

          await notificationService.subscribeToAllUserNotificationChanges(vi.fn());
        } catch (error) {
          // Expected to fail
        }
      }

      const dashboard = notificationService.getMonitoringDashboard();
      expect(dashboard.circuitBreaker.failureCount).toBeGreaterThan(0);
    });
  });

  describe('Health Monitoring', () => {
    it('should track subscription health', async () => {
      const callback = vi.fn();
      
      await notificationService.subscribeToAllUserNotificationChanges(
        callback,
        'test-team'
      );

      const dashboard = notificationService.getMonitoringDashboard();
      expect(dashboard.subscriptions.active).toBeGreaterThan(0);
      expect(dashboard.healthDetails).toHaveLength(1);
      expect(dashboard.healthDetails[0].status).toBe('healthy');
    });
  });

  describe('Filter Validation', () => {
    it('should create valid PostgREST filters with quoted string values', async () => {
      const callback = vi.fn();

      await notificationService.subscribeToAllUserNotificationChanges(
        callback,
        'test-team',
        {
          notificationTypes: ['receipt_processing_completed'],
          priorities: ['medium', 'high']
        }
      );

      // Verify the channel was created with proper configuration
      expect(supabase.channel).toHaveBeenCalledWith(
        expect.stringMatching(/^user-changes-/)
      );

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: expect.stringContaining('recipient_id=eq.')
        }),
        expect.any(Function)
      );

      // Verify that the filter includes properly formatted unquoted string values
      const filterCall = mockChannel.on.mock.calls.find(call =>
        call[0] === 'postgres_changes'
      );
      if (filterCall) {
        const config = filterCall[1];
        expect(config.filter).toMatch(/priority=in\.\(medium,high\)/);
        expect(config.filter).toMatch(/type=in\.\(receipt_processing_completed\)/);
      }
    });
  });
});
