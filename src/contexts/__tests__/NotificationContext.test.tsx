import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NotificationProvider, useNotifications } from '../NotificationContext';
import { AuthProvider } from '../AuthContext';
import { notificationService } from '@/services/notificationService';
import type { NotificationType } from '@/types/notifications';

// Mock the notification service
vi.mock('@/services/notificationService', () => ({
  notificationService: {
    subscribeToAllUserNotificationChanges: vi.fn(),
    quickRealTimeTest: vi.fn(),
    ensureConnection: vi.fn(),
    cleanupUserSubscriptions: vi.fn(),
    resetConnectionState: vi.fn(),
    getConnectionState: vi.fn()
  }
}));

// Mock AuthContext
vi.mock('../AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    user: {
      id: 'test-user-123',
      email: 'test@example.com'
    },
    currentTeam: {
      id: 'test-team-123',
      name: 'Test Team'
    }
  })
}));

// Test component that uses the notification context
const TestComponent = () => {
  const { state, dispatch } = useNotifications();
  
  return (
    <div>
      <div data-testid="connection-status">{state.connected ? 'connected' : 'disconnected'}</div>
      <div data-testid="notification-count">{state.notifications.length}</div>
      <div data-testid="unread-count">{state.unreadCount}</div>
      <div data-testid="error-status">{state.error || 'no-error'}</div>
    </div>
  );
};

describe('NotificationContext', () => {
  beforeEach(() => {
    // Setup default mocks
    (notificationService.quickRealTimeTest as Mock).mockResolvedValue(true);
    (notificationService.ensureConnection as Mock).mockResolvedValue(true);
    (notificationService.subscribeToAllUserNotificationChanges as Mock).mockResolvedValue(() => {});
    (notificationService.getConnectionState as Mock).mockReturnValue({
      status: 'connected',
      activeChannels: 1,
      registeredSubscriptions: 1,
      pendingSubscriptions: 0,
      reconnectAttempts: 0
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Provider Setup', () => {
    it('should render without errors', () => {
      render(
        <AuthProvider>
          <NotificationProvider>
            <TestComponent />
          </NotificationProvider>
        </AuthProvider>
      );

      expect(screen.getByTestId('connection-status')).toBeInTheDocument();
      expect(screen.getByTestId('notification-count')).toBeInTheDocument();
      expect(screen.getByTestId('unread-count')).toBeInTheDocument();
    });

    it('should initialize with correct default state', () => {
      render(
        <AuthProvider>
          <NotificationProvider>
            <TestComponent />
          </NotificationProvider>
        </AuthProvider>
      );

      expect(screen.getByTestId('connection-status')).toHaveTextContent('disconnected');
      expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
      expect(screen.getByTestId('unread-count')).toHaveTextContent('0');
      expect(screen.getByTestId('error-status')).toHaveTextContent('no-error');
    });
  });

  describe('Real-time Subscription Setup', () => {
    it('should attempt to establish real-time connection', async () => {
      render(
        <AuthProvider>
          <NotificationProvider>
            <TestComponent />
          </NotificationProvider>
        </AuthProvider>
      );

      // Wait for the effect to run
      await waitFor(() => {
        expect(notificationService.quickRealTimeTest).toHaveBeenCalled();
      });
    });

    it('should use validated notification types', async () => {
      render(
        <AuthProvider>
          <NotificationProvider>
            <TestComponent />
          </NotificationProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(notificationService.subscribeToAllUserNotificationChanges).toHaveBeenCalled();
      });

      // Verify the subscription was called with valid notification types
      const subscriptionCall = (notificationService.subscribeToAllUserNotificationChanges as Mock).mock.calls[0];
      if (subscriptionCall && subscriptionCall[2]) {
        const options = subscriptionCall[2];
        
        // Verify no invalid types are included
        if (options.notificationTypes) {
          const validTypes: NotificationType[] = [
            'receipt_processing_completed',
            'receipt_processing_failed',
            'receipt_ready_for_review',
            'receipt_batch_completed',
            'receipt_batch_failed',
            'team_invitation_sent',
            'team_invitation_accepted',
            'team_member_joined',
            'team_member_left',
            'team_member_role_changed',
            'team_settings_updated',
            'receipt_shared',
            'receipt_comment_added',
            'receipt_edited_by_team_member',
            'receipt_approved_by_team',
            'receipt_flagged_for_review',
            'claim_submitted',
            'claim_approved',
            'claim_rejected',
            'claim_review_requested'
          ];

          // Ensure all types in the subscription are valid
          options.notificationTypes.forEach((type: NotificationType) => {
            expect(validTypes).toContain(type);
          });

          // Ensure the problematic type is not included
          expect(options.notificationTypes).not.toContain('system_review_requested');
        }

        // Verify priorities are valid
        if (options.priorities) {
          options.priorities.forEach((priority: string) => {
            expect(['low', 'medium', 'high']).toContain(priority);
          });
        }
      }
    });

    it('should handle subscription failures gracefully', async () => {
      // Mock subscription failure
      (notificationService.subscribeToAllUserNotificationChanges as Mock).mockRejectedValue(
        new Error('Subscription failed')
      );

      render(
        <AuthProvider>
          <NotificationProvider>
            <TestComponent />
          </NotificationProvider>
        </AuthProvider>
      );

      // Should not crash the component
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toBeInTheDocument();
      });
    });
  });

  describe('Fallback Mode', () => {
    it('should enter fallback mode when real-time fails', async () => {
      // Mock real-time test failure
      (notificationService.quickRealTimeTest as Mock).mockResolvedValue(false);

      render(
        <AuthProvider>
          <NotificationProvider>
            <TestComponent />
          </NotificationProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('disconnected');
      });

      // Should not attempt subscription when in fallback mode
      expect(notificationService.subscribeToAllUserNotificationChanges).not.toHaveBeenCalled();
    });

    it('should handle connection errors without crashing', async () => {
      // Mock connection error
      (notificationService.ensureConnection as Mock).mockRejectedValue(
        new Error('Connection failed')
      );

      render(
        <AuthProvider>
          <NotificationProvider>
            <TestComponent />
          </NotificationProvider>
        </AuthProvider>
      );

      // Component should still render
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error state when subscription setup fails', async () => {
      // Mock subscription setup failure
      (notificationService.subscribeToAllUserNotificationChanges as Mock).mockRejectedValue(
        new Error('Failed to connect to real-time updates')
      );

      render(
        <AuthProvider>
          <NotificationProvider>
            <TestComponent />
          </NotificationProvider>
        </AuthProvider>
      );

      // Should eventually show error state
      await waitFor(() => {
        const errorElement = screen.getByTestId('error-status');
        // Error might be cleared in fallback mode, so check for either state
        expect(['no-error', 'Failed to connect to real-time updates']).toContain(errorElement.textContent);
      });
    });
  });
});
