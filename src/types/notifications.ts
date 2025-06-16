// Notification System Types

export type NotificationType = 
  | 'team_invitation_sent'
  | 'team_invitation_accepted'
  | 'team_member_joined'
  | 'team_member_left'
  | 'team_member_role_changed'
  | 'claim_submitted'
  | 'claim_approved'
  | 'claim_rejected'
  | 'claim_review_requested'
  | 'team_settings_updated';

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
  team_invitation_sent: '📧',
  team_invitation_accepted: '✅',
  team_member_joined: '👋',
  team_member_left: '👋',
  team_member_role_changed: '🔄',
  claim_submitted: '📝',
  claim_approved: '✅',
  claim_rejected: '❌',
  claim_review_requested: '👀',
  team_settings_updated: '⚙️',
};

export const NOTIFICATION_TYPE_COLORS: Record<NotificationType, string> = {
  team_invitation_sent: 'text-blue-400 bg-blue-900/20',
  team_invitation_accepted: 'text-green-400 bg-green-900/20',
  team_member_joined: 'text-green-400 bg-green-900/20',
  team_member_left: 'text-gray-400 bg-gray-800/20',
  team_member_role_changed: 'text-blue-400 bg-blue-900/20',
  claim_submitted: 'text-blue-400 bg-blue-900/20',
  claim_approved: 'text-green-400 bg-green-900/20',
  claim_rejected: 'text-red-400 bg-red-900/20',
  claim_review_requested: 'text-yellow-400 bg-yellow-900/20',
  team_settings_updated: 'text-gray-400 bg-gray-800/20',
};

export const NOTIFICATION_PRIORITY_COLORS: Record<NotificationPriority, string> = {
  low: 'text-gray-400',
  medium: 'text-blue-400',
  high: 'text-red-400',
};

export function getNotificationTypeDisplayName(type: NotificationType): string {
  const typeNames: Record<NotificationType, string> = {
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
