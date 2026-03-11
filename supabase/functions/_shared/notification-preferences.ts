export interface PushNotificationPreferences {
  push_enabled?: boolean | null;
  push_receipt_processing_completed?: boolean | null;
  push_receipt_processing_failed?: boolean | null;
  push_receipt_ready_for_review?: boolean | null;
  push_receipt_batch_completed?: boolean | null;
  push_team_invitations?: boolean | null;
  push_team_activity?: boolean | null;
  push_receipt_comments?: boolean | null;
  push_receipt_shared?: boolean | null;
  push_team_member_removed?: boolean | null;
  push_gamification_streak_reminders?: boolean | null;
  quiet_hours_enabled?: boolean | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  timezone?: string | null;
}

const PUSH_NOTIFICATION_PREFERENCE_KEYS: Record<string, keyof PushNotificationPreferences | null> = {
  receipt_processing_started: null,
  receipt_processing_completed: 'push_receipt_processing_completed',
  receipt_processing_failed: 'push_receipt_processing_failed',
  receipt_ready_for_review: 'push_receipt_ready_for_review',
  receipt_batch_completed: 'push_receipt_batch_completed',
  receipt_batch_failed: 'push_receipt_processing_failed',
  team_invitation_sent: 'push_team_invitations',
  team_invitation_accepted: 'push_team_invitations',
  team_member_joined: 'push_team_activity',
  team_member_left: 'push_team_activity',
  team_member_removed: 'push_team_member_removed',
  team_member_role_changed: 'push_team_activity',
  team_settings_updated: 'push_team_activity',
  claim_submitted: 'push_team_activity',
  claim_approved: 'push_team_activity',
  claim_rejected: 'push_team_activity',
  claim_review_requested: 'push_team_activity',
  receipt_shared: 'push_receipt_shared',
  receipt_comment_added: 'push_receipt_comments',
  receipt_edited_by_team_member: 'push_receipt_comments',
  receipt_approved_by_team: 'push_receipt_comments',
  receipt_flagged_for_review: 'push_receipt_comments',
  gamification_streak_reminder: 'push_gamification_streak_reminders',
};

export function getPushNotificationPreferenceKey(notificationType: string): keyof PushNotificationPreferences | null | undefined {
  return PUSH_NOTIFICATION_PREFERENCE_KEYS[notificationType];
}

export function isInQuietHours(
  preferences: PushNotificationPreferences,
  timezoneFallback = 'Asia/Kuala_Lumpur',
  now = new Date()
): boolean {
  if (!preferences.quiet_hours_enabled || !preferences.quiet_hours_start || !preferences.quiet_hours_end) {
    return false;
  }

  try {
    const timezone = preferences.timezone || timezoneFallback;
    const userTime = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    }).format(now);

    const [currentHour, currentMinute] = userTime.split(':').map(Number);
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = preferences.quiet_hours_start.split(':').map(Number);
    const startTimeMinutes = startHour * 60 + startMinute;

    const [endHour, endMinute] = preferences.quiet_hours_end.split(':').map(Number);
    const endTimeMinutes = endHour * 60 + endMinute;

    if (startTimeMinutes > endTimeMinutes) {
      return currentTimeMinutes >= startTimeMinutes || currentTimeMinutes <= endTimeMinutes;
    }

    return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
  } catch (error) {
    console.error('Error checking quiet hours:', error);
    return false;
  }
}