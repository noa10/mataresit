import { describe, expect, it } from 'vitest';
import {
  getPushNotificationPreferenceKey,
  NOTIFICATION_CATEGORIES,
  shouldShowNotificationWithPreferences,
  type Notification,
  type NotificationPreferences,
} from '@/types/notifications';

const basePreferences: NotificationPreferences = {
  user_id: 'user-1',
  email_enabled: true,
  email_receipt_processing_completed: true,
  email_receipt_processing_failed: true,
  email_receipt_ready_for_review: false,
  email_receipt_batch_completed: true,
  email_team_invitations: true,
  email_team_activity: false,
  email_billing_updates: true,
  email_security_alerts: true,
  email_weekly_reports: false,
  email_team_member_removed: true,
  push_enabled: true,
  push_receipt_processing_completed: true,
  push_receipt_processing_failed: true,
  push_receipt_ready_for_review: true,
  push_receipt_batch_completed: true,
  push_team_invitations: true,
  push_team_activity: true,
  push_receipt_comments: true,
  push_receipt_shared: true,
  push_team_member_removed: true,
  push_gamification_streak_reminders: true,
  browser_permission_granted: false,
  quiet_hours_enabled: false,
  daily_digest_enabled: false,
  weekly_digest_enabled: false,
};

const buildNotification = (type: Notification['type']): Notification => ({
  id: 'notif-1',
  recipient_id: 'user-1',
  type,
  title: 'Title',
  message: 'Message',
  priority: 'medium',
  is_read: false,
  archived: false,
  created_at: '2026-03-10T00:00:00.000Z',
});

describe('notification preference mappings', () => {
  it('maps gamification streak reminders to the approved push preference key', () => {
    expect(getPushNotificationPreferenceKey('gamification_streak_reminder')).toBe(
      'push_gamification_streak_reminders'
    );
  });

  it('keeps existing mapped notification types aligned with push preference fields', () => {
    expect(getPushNotificationPreferenceKey('receipt_shared')).toBe('push_receipt_shared');
    expect(getPushNotificationPreferenceKey('team_member_removed')).toBe('push_team_member_removed');
  });

  it('filters streak reminder visibility using the new reminder preference', () => {
    const notification = buildNotification('gamification_streak_reminder');

    expect(
      shouldShowNotificationWithPreferences(notification, {
        ...basePreferences,
        push_gamification_streak_reminders: false,
      })
    ).toBe(false);

    expect(shouldShowNotificationWithPreferences(notification, basePreferences)).toBe(true);
  });

  it('surfaces the new reminder type in the gamification settings category', () => {
    expect(NOTIFICATION_CATEGORIES.GAMIFICATION.types).toContain('gamification_streak_reminder');
  });
});