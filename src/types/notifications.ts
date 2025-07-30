// Notification System Types

export type NotificationType =
  // Team collaboration notifications
  | 'team_invitation_sent'
  | 'team_invitation_accepted'
  | 'team_member_joined'
  | 'team_member_left'
  | 'team_member_removed'
  | 'team_member_role_changed'
  | 'claim_submitted'
  | 'claim_approved'
  | 'claim_rejected'
  | 'claim_review_requested'
  | 'team_settings_updated'
  // Receipt processing notifications
  | 'receipt_processing_started'
  | 'receipt_processing_completed'
  | 'receipt_processing_failed'
  | 'receipt_ready_for_review'
  | 'receipt_batch_completed'
  | 'receipt_batch_failed'
  // Team receipt collaboration notifications
  | 'receipt_shared'
  | 'receipt_comment_added'
  | 'receipt_edited_by_team_member'
  | 'receipt_approved_by_team'
  | 'receipt_flagged_for_review';

export type NotificationPriority = 'low' | 'medium' | 'high';

export interface Notification {
  id: string;
  recipient_id: string;
  team_id?: string;
  type: NotificationType;
  priority: NotificationPriority;
  
  // Content
  title: string;
  message: string;
  action_url?: string;
  
  // Status
  read_at?: string;
  archived_at?: string;
  
  // Related entities
  related_entity_type?: string;
  related_entity_id?: string;
  
  // Metadata
  metadata: Record<string, any>;
  
  // Timestamps
  created_at: string;
  expires_at?: string;
  
  // Joined data
  team_name?: string;
}

export interface NotificationFilters {
  team_id?: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  unread_only?: boolean;
  date_from?: string;
  date_to?: string;
}

export interface NotificationStats {
  total_notifications: number;
  unread_notifications: number;
  high_priority_unread: number;
  notifications_by_type: Record<NotificationType, number>;
}

// Email delivery tracking types
export type EmailDeliveryStatus = 
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'bounced'
  | 'complained';

export interface EmailDelivery {
  id: string;
  recipient_email: string;
  subject: string;
  template_name?: string;
  
  // Delivery tracking
  status: EmailDeliveryStatus;
  provider_message_id?: string;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  
  // Related entities
  related_entity_type?: string;
  related_entity_id?: string;
  team_id?: string;
  
  // Metadata
  metadata: Record<string, any>;
  
  // Timestamps
  created_at: string;
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  next_retry_at?: string;
}

// Notification display helpers
export const NOTIFICATION_TYPE_ICONS: Record<NotificationType, string> = {
  // Team collaboration notifications
  team_invitation_sent: '📧',
  team_invitation_accepted: '✅',
  team_member_joined: '👋',
  team_member_left: '👋',
  team_member_removed: '🚫',
  team_member_role_changed: '🔄',
  claim_submitted: '📝',
  claim_approved: '✅',
  claim_rejected: '❌',
  claim_review_requested: '👀',
  team_settings_updated: '⚙️',
  // Receipt processing notifications
  receipt_processing_started: '⚡',
  receipt_processing_completed: '✅',
  receipt_processing_failed: '❌',
  receipt_ready_for_review: '👀',
  receipt_batch_completed: '📦',
  receipt_batch_failed: '⚠️',
  // Team receipt collaboration notifications
  receipt_shared: '🔗',
  receipt_comment_added: '💬',
  receipt_edited_by_team_member: '✏️',
  receipt_approved_by_team: '✅',
  receipt_flagged_for_review: '🚩',
};

export const NOTIFICATION_TYPE_COLORS: Record<NotificationType, string> = {
  // Team collaboration notifications
  team_invitation_sent: 'text-blue-400 bg-blue-900/20',
  team_invitation_accepted: 'text-green-400 bg-green-900/20',
  team_member_joined: 'text-green-400 bg-green-900/20',
  team_member_left: 'text-gray-400 bg-gray-800/20',
  team_member_removed: 'text-red-400 bg-red-900/20',
  team_member_role_changed: 'text-blue-400 bg-blue-900/20',
  claim_submitted: 'text-blue-400 bg-blue-900/20',
  claim_approved: 'text-green-400 bg-green-900/20',
  claim_rejected: 'text-red-400 bg-red-900/20',
  claim_review_requested: 'text-yellow-400 bg-yellow-900/20',
  team_settings_updated: 'text-gray-400 bg-gray-800/20',
  // Receipt processing notifications
  receipt_processing_started: 'text-blue-400 bg-blue-900/20',
  receipt_processing_completed: 'text-green-400 bg-green-900/20',
  receipt_processing_failed: 'text-red-400 bg-red-900/20',
  receipt_ready_for_review: 'text-yellow-400 bg-yellow-900/20',
  receipt_batch_completed: 'text-green-400 bg-green-900/20',
  receipt_batch_failed: 'text-red-400 bg-red-900/20',
  // Team receipt collaboration notifications
  receipt_shared: 'text-blue-400 bg-blue-900/20',
  receipt_comment_added: 'text-purple-400 bg-purple-900/20',
  receipt_edited_by_team_member: 'text-orange-400 bg-orange-900/20',
  receipt_approved_by_team: 'text-green-400 bg-green-900/20',
  receipt_flagged_for_review: 'text-red-400 bg-red-900/20',
};

export const NOTIFICATION_PRIORITY_COLORS: Record<NotificationPriority, string> = {
  low: 'text-gray-400',
  medium: 'text-blue-400',
  high: 'text-red-400',
};

export function getNotificationTypeDisplayName(type: NotificationType): string {
  const typeNames: Record<NotificationType, string> = {
    // Team collaboration notifications
    team_invitation_sent: 'Team Invitation Sent',
    team_invitation_accepted: 'Team Invitation Accepted',
    team_member_joined: 'Team Member Joined',
    team_member_left: 'Team Member Left',
    team_member_role_changed: 'Team Member Role Changed',
    claim_submitted: 'Claim Submitted',
    claim_approved: 'Claim Approved',
    claim_rejected: 'Claim Rejected',
    claim_review_requested: 'Claim Review Requested',
    team_settings_updated: 'Team Settings Updated',
    // Receipt processing notifications
    receipt_processing_started: 'Receipt Processing Started',
    receipt_processing_completed: 'Receipt Processing Completed',
    receipt_processing_failed: 'Receipt Processing Failed',
    receipt_ready_for_review: 'Receipt Ready for Review',
    receipt_batch_completed: 'Batch Processing Completed',
    receipt_batch_failed: 'Batch Processing Failed',
    // Team receipt collaboration notifications
    receipt_shared: 'Receipt Shared',
    receipt_comment_added: 'Comment Added',
    receipt_edited_by_team_member: 'Receipt Edited by Team Member',
    receipt_approved_by_team: 'Receipt Approved by Team',
    receipt_flagged_for_review: 'Receipt Flagged for Review',
  };
  return typeNames[type];
}

export function getNotificationPriorityDisplayName(priority: NotificationPriority): string {
  const priorityNames: Record<NotificationPriority, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
  };
  return priorityNames[priority];
}

export function formatNotificationTime(timestamp: string): string {
  const now = new Date();
  const notificationTime = new Date(timestamp);
  const diffInMinutes = Math.floor((now.getTime() - notificationTime.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) {
    return 'Just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  } else if (diffInMinutes < 1440) { // 24 hours
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diffInMinutes / 1440);
    return `${days}d ago`;
  }
}

export function isNotificationExpired(notification: Notification): boolean {
  if (!notification.expires_at) return false;
  return new Date(notification.expires_at) < new Date();
}

export function shouldShowNotification(notification: Notification): boolean {
  return !notification.archived_at && !isNotificationExpired(notification);
}

/**
 * Enhanced notification filtering that respects user preferences
 * This function should be used in the notification display components
 */
export function shouldShowNotificationWithPreferences(
  notification: Notification,
  preferences?: NotificationPreferences
): boolean {
  // Basic checks first
  if (!shouldShowNotification(notification)) {
    return false;
  }

  // If no preferences provided, show all notifications (fallback behavior)
  if (!preferences) {
    return true;
  }

  // Check if push notifications are enabled globally
  if (!preferences.push_enabled) {
    return false;
  }

  // Map notification types to preference keys
  const notificationTypeToPreferenceKey: Record<NotificationType, keyof NotificationPreferences | null> = {
    // Receipt processing notifications
    'receipt_processing_started': null, // Not configurable - always hidden
    'receipt_processing_completed': 'push_receipt_processing_completed',
    'receipt_processing_failed': 'push_receipt_processing_failed',
    'receipt_ready_for_review': 'push_receipt_ready_for_review', // Restored - but won't be created anyway
    'receipt_batch_completed': 'push_receipt_batch_completed',
    'receipt_batch_failed': 'push_receipt_batch_failed',

    // Team collaboration notifications
    'team_invitation_sent': 'push_team_invitations',
    'team_invitation_accepted': 'push_team_invitations',
    'team_member_joined': 'push_team_activity',
    'team_member_left': 'push_team_activity',
    'team_member_role_changed': 'push_team_activity',
    'team_settings_updated': 'push_team_activity',

    // Claims notifications (use team activity preference)
    'claim_submitted': 'push_team_activity',
    'claim_approved': 'push_team_activity',
    'claim_rejected': 'push_team_activity',
    'claim_review_requested': 'push_team_activity',

    // Receipt collaboration notifications
    'receipt_shared': 'push_receipt_shared',
    'receipt_comment_added': 'push_receipt_comments',
    'receipt_edited_by_team_member': 'push_receipt_comments',
    'receipt_approved_by_team': 'push_receipt_comments',
    'receipt_flagged_for_review': 'push_receipt_comments',
  };

  const preferenceKey = notificationTypeToPreferenceKey[notification.type];

  // If no preference key is mapped, hide the notification (like processing_started)
  if (preferenceKey === null) {
    return false;
  }

  // If preference key exists, check the user's setting
  if (preferenceKey) {
    const isEnabled = preferences[preferenceKey];
    return typeof isEnabled === 'boolean' ? isEnabled : true;
  }

  // Default to showing if we can't determine the preference
  return true;
}

// Notification Preferences Types
export interface NotificationPreferences {
  id?: string;
  user_id: string;

  // Email notification preferences
  email_enabled: boolean;
  email_receipt_processing_completed: boolean;
  email_receipt_processing_failed: boolean;
  email_receipt_ready_for_review: boolean;
  email_receipt_batch_completed: boolean;
  email_receipt_batch_failed: boolean;
  email_team_invitations: boolean;
  email_team_activity: boolean;
  email_billing_updates: boolean;
  email_security_alerts: boolean;
  email_weekly_reports: boolean;

  // Push notification preferences
  push_enabled: boolean;
  push_receipt_processing_completed: boolean;
  push_receipt_processing_failed: boolean;
  push_receipt_ready_for_review: boolean;
  push_receipt_batch_completed: boolean;
  push_receipt_batch_failed: boolean;
  push_team_invitations: boolean;
  push_team_activity: boolean;
  push_receipt_comments: boolean;
  push_receipt_shared: boolean;

  // Browser notification preferences
  browser_permission_granted: boolean;
  browser_permission_requested_at?: string;

  // Notification timing preferences
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string; // HH:MM format
  quiet_hours_end?: string; // HH:MM format
  timezone?: string;

  // Digest preferences
  daily_digest_enabled: boolean;
  weekly_digest_enabled: boolean;
  digest_time?: string; // HH:MM format

  created_at?: string;
  updated_at?: string;
}

export interface PushSubscription {
  id?: string;
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  user_agent?: string;
  is_active: boolean;
  created_at?: string;
  last_used_at?: string;
}

// Notification preference categories for UI organization
export const NOTIFICATION_CATEGORIES = {
  RECEIPT_PROCESSING: {
    label: 'Receipt Processing',
    description: 'Notifications about receipt upload and processing status',
    types: [
      'receipt_processing_started',
      'receipt_processing_completed',
      'receipt_processing_failed',
      'receipt_ready_for_review',
      'receipt_batch_completed',
      'receipt_batch_failed'
    ] as NotificationType[]
  },
  TEAM_COLLABORATION: {
    label: 'Team Collaboration',
    description: 'Notifications about team activities and receipt collaboration',
    types: [
      'team_invitation_sent',
      'team_invitation_accepted',
      'team_member_joined',
      'team_member_left',
      'team_member_removed',
      'team_member_role_changed',
      'receipt_shared',
      'receipt_comment_added',
      'receipt_edited_by_team_member',
      'receipt_approved_by_team',
      'receipt_flagged_for_review'
    ] as NotificationType[]
  },
  CLAIMS_AND_BILLING: {
    label: 'Claims & Billing',
    description: 'Notifications about expense claims and billing updates',
    types: [
      'claim_submitted',
      'claim_approved',
      'claim_rejected',
      'claim_review_requested'
    ] as NotificationType[]
  },
  SYSTEM: {
    label: 'System',
    description: 'System updates and security notifications',
    types: [
      'team_settings_updated'
    ] as NotificationType[]
  }
} as const;
