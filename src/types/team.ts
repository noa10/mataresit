// Team Management Types

export type TeamStatus = 'active' | 'suspended' | 'archived';

export type TeamMemberRole = 'owner' | 'admin' | 'member' | 'viewer';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface Team {
  id: string;
  name: string;
  description?: string;
  slug: string;
  status: TeamStatus;
  owner_id: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
  permissions: Record<string, any>;
  joined_at: string;
  updated_at: string;
  // Joined data from auth.users and profiles
  email?: string;
  first_name?: string;
  last_name?: string;
}

export interface TeamInvitation {
  id: string;
  team_id: string;
  email: string;
  role: TeamMemberRole;
  invited_by: string;
  status: InvitationStatus;
  token: string;
  expires_at: string;
  accepted_at?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  team_name?: string;
  invited_by_name?: string;
}

export interface UserTeam {
  id: string;
  name: string;
  description?: string;
  slug: string;
  status: TeamStatus;
  owner_id: string;
  user_role: TeamMemberRole;
  member_count: number;
  created_at: string;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
  slug?: string;
}

export interface InviteTeamMemberRequest {
  team_id: string;
  email: string;
  role: TeamMemberRole;
}

export interface UpdateTeamMemberRoleRequest {
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
}

export interface TeamSettings {
  // Receipt sharing settings
  receipt_sharing_enabled: boolean;
  default_receipt_visibility: 'private' | 'team';
  
  // Member permissions
  member_can_invite: boolean;
  member_can_upload: boolean;
  member_can_edit_receipts: boolean;
  
  // Notification settings
  notify_on_new_member: boolean;
  notify_on_receipt_upload: boolean;
  
  // Integration settings
  integrations: {
    [key: string]: {
      enabled: boolean;
      config: Record<string, any>;
    };
  };
}

export interface TeamStats {
  total_members: number;
  total_receipts: number;
  total_amount: number;
  receipts_this_month: number;
  amount_this_month: number;
  top_categories: Array<{
    category: string;
    count: number;
    amount: number;
  }>;
  recent_activity: Array<{
    type: 'receipt_uploaded' | 'member_joined' | 'member_left';
    user_name: string;
    timestamp: string;
    details?: Record<string, any>;
  }>;
}

// Permission helpers
export const TEAM_PERMISSIONS = {
  // Team management
  VIEW_TEAM: ['owner', 'admin', 'member', 'viewer'],
  EDIT_TEAM: ['owner'],
  DELETE_TEAM: ['owner'],
  
  // Member management
  VIEW_MEMBERS: ['owner', 'admin', 'member', 'viewer'],
  INVITE_MEMBERS: ['owner', 'admin'],
  REMOVE_MEMBERS: ['owner', 'admin'],
  UPDATE_MEMBER_ROLES: ['owner', 'admin'],
  
  // Receipt management
  VIEW_RECEIPTS: ['owner', 'admin', 'member', 'viewer'],
  UPLOAD_RECEIPTS: ['owner', 'admin', 'member'],
  EDIT_RECEIPTS: ['owner', 'admin', 'member'],
  DELETE_RECEIPTS: ['owner', 'admin'],
  
  // Settings
  VIEW_SETTINGS: ['owner', 'admin'],
  EDIT_SETTINGS: ['owner', 'admin'],
} as const;

export function hasTeamPermission(
  userRole: TeamMemberRole,
  permission: keyof typeof TEAM_PERMISSIONS
): boolean {
  return TEAM_PERMISSIONS[permission].includes(userRole);
}

export function getTeamRoleDisplayName(role: TeamMemberRole): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'member':
      return 'Member';
    case 'viewer':
      return 'Viewer';
    default:
      return 'Unknown';
  }
}

export function getTeamRoleDescription(role: TeamMemberRole): string {
  switch (role) {
    case 'owner':
      return 'Full access to team settings, members, and data. Can delete the team.';
    case 'admin':
      return 'Can manage team members, settings, and all receipts. Cannot delete the team.';
    case 'member':
      return 'Can upload, edit, and view receipts. Can view team members.';
    case 'viewer':
      return 'Can only view receipts and team members. Cannot upload or edit.';
    default:
      return 'Unknown role';
  }
}

export const TEAM_ROLE_COLORS = {
  owner: 'bg-purple-100 text-purple-800 border-purple-200',
  admin: 'bg-blue-100 text-blue-800 border-blue-200',
  member: 'bg-green-100 text-green-800 border-green-200',
  viewer: 'bg-gray-100 text-gray-800 border-gray-200',
} as const;

// ============================================================================
// ENHANCED TYPES FOR NEW FUNCTIONALITY
// ============================================================================

// Enhanced invitation types
export interface EnhancedTeamInvitation extends TeamInvitation {
  custom_message?: string;
  permissions?: Record<string, any>;
  invitation_attempts?: number;
  last_sent_at?: string;
  metadata?: Record<string, any>;
}

export interface InviteTeamMemberEnhancedRequest {
  team_id: string;
  email: string;
  role?: TeamMemberRole;
  custom_message?: string;
  permissions?: Record<string, any>;
  expires_in_days?: number;
  send_email?: boolean;
}

export interface ResendInvitationRequest {
  invitation_id: string;
  custom_message?: string;
  extend_expiration?: boolean;
  new_expiration_days?: number;
}

// Bulk operation types
export type BulkOperationType =
  | 'bulk_invite'
  | 'bulk_remove'
  | 'bulk_role_update'
  | 'bulk_permission_update';

export type BulkOperationStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface BulkOperation {
  id: string;
  team_id: string;
  operation_type: BulkOperationType;
  status: BulkOperationStatus;
  performed_by: string;
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;
  progress_percentage: number;
  operation_params: Record<string, any>;
  results: Record<string, any>;
  error_summary?: string;
  started_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  performed_by_name?: string;
  performed_by_email?: string;
}

export interface BulkRoleUpdateRequest {
  user_id: string;
  new_role: TeamMemberRole;
  reason?: string;
}

export interface BulkPermissionUpdateRequest {
  user_id: string;
  permissions: Record<string, any>;
  merge_mode?: 'merge' | 'replace';
}

export interface BulkInvitationRequest {
  email: string;
  role?: TeamMemberRole;
  custom_message?: string;
  permissions?: Record<string, any>;
}

export interface BulkRemovalRequest {
  user_ids: string[];
  reason?: string;
  transfer_data?: boolean;
  transfer_to_user_id?: string;
}

// Audit trail types
export type AuditAction =
  | 'team_created'
  | 'team_updated'
  | 'team_deleted'
  | 'member_added'
  | 'member_removed'
  | 'member_role_changed'
  | 'member_permissions_updated'
  | 'invitation_sent'
  | 'invitation_accepted'
  | 'invitation_cancelled'
  | 'invitation_resent'
  | 'bulk_operation_started'
  | 'bulk_operation_completed'
  | 'owner_transferred';

export interface TeamAuditLog {
  id: string;
  team_id: string;
  action: AuditAction;
  action_description: string;
  performed_by: string;
  target_user_id?: string;
  old_values: Record<string, any>;
  new_values: Record<string, any>;
  metadata: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  created_at: string;
  // Joined data
  performed_by_name?: string;
  performed_by_email?: string;
  target_user_name?: string;
  target_user_email?: string;
}

// Security types
export type SecurityEventType =
  | 'permission_granted'
  | 'permission_denied'
  | 'rate_limit_exceeded'
  | 'rate_limit_blocked'
  | 'ip_access_denied'
  | 'auth_success'
  | 'auth_failure'
  | 'user_locked_out'
  | 'member_invited'
  | 'bulk_operation_executed';

export type SecurityEventSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface SecurityEvent {
  id: string;
  team_id: string;
  user_id?: string;
  event_type: SecurityEventType;
  event_description: string;
  severity: SecurityEventSeverity;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  request_id?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface SecurityConfig {
  require_2fa_for_admin: boolean;
  session_timeout_minutes: number;
  max_failed_attempts: number;
  lockout_duration_minutes: number;
  require_approval_for_bulk_ops: boolean;
  audit_all_actions: boolean;
}

export interface RateLimitConfig {
  invite_members: { max_per_hour: number; max_per_day: number };
  bulk_operations: { max_per_hour: number; max_per_day: number };
  role_updates: { max_per_hour: number; max_per_day: number };
  member_removals: { max_per_hour: number; max_per_day: number };
}

// Enhanced member types
export interface EnhancedTeamMember extends TeamMember {
  last_active_at?: string;
  removal_scheduled_at?: string;
  removal_reason?: string;
  status?: 'active' | 'inactive' | 'scheduled_removal';
}

// Service response types
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  error_code?: string;
  metadata?: Record<string, any>;
}

export interface BulkOperationResult {
  success: boolean;
  bulk_operation_id: string;
  total_items: number;
  successful_items: number;
  failed_items: number;
  results: Array<{
    item: any;
    success: boolean;
    error?: string;
    result?: any;
  }>;
  operation_summary: string;
  error_summary?: string;
}

// Statistics and dashboard types
export interface EnhancedTeamStats extends TeamStats {
  active_members: number;
  inactive_members: number;
  owners: number;
  admins: number;
  members: number;
  viewers: number;
  scheduled_removals: number;
  recent_joins: number;
  pending_invitations: number;
  recent_activity_count: number;
  security_events_count: number;
  bulk_operations_count: number;
}

export interface SecurityDashboard {
  team_id: string;
  period_days: number;
  security_stats: {
    total_events: number;
    critical_events: number;
    error_events: number;
    warning_events: number;
    rate_limit_violations: number;
    ip_blocks: number;
    user_lockouts: number;
  };
  rate_limit_stats: Array<{
    operation_type: string;
    total_requests: number;
    avg_requests_per_window: number;
    max_requests_per_window: number;
    blocked_windows: number;
  }>;
  recent_events: SecurityEvent[];
  generated_at: string;
}

// Enhanced permission types
export const ENHANCED_TEAM_PERMISSIONS = {
  // Team management
  view_team: ['owner', 'admin', 'member', 'viewer'],
  manage_team: ['owner'],
  delete_team: ['owner'],

  // Member management
  view_members: ['owner', 'admin', 'member', 'viewer'],
  invite_members: ['owner', 'admin'],
  remove_members: ['owner', 'admin'],
  update_member_roles: ['owner', 'admin'],
  manage_bulk_operations: ['owner', 'admin'],

  // Security and audit
  view_audit_logs: ['owner', 'admin'],
  view_security_events: ['owner', 'admin'],
  manage_security_settings: ['owner'],

  // Advanced operations
  transfer_ownership: ['owner'],
  schedule_member_removal: ['owner', 'admin'],
  cancel_scheduled_removal: ['owner', 'admin'],

  // Receipt management (existing)
  view_receipts: ['owner', 'admin', 'member', 'viewer'],
  upload_receipts: ['owner', 'admin', 'member'],
  edit_receipts: ['owner', 'admin', 'member'],
  delete_receipts: ['owner', 'admin'],

  // Settings (existing)
  view_settings: ['owner', 'admin'],
  edit_settings: ['owner', 'admin'],
} as const;

export type EnhancedPermission = keyof typeof ENHANCED_TEAM_PERMISSIONS;

export function hasEnhancedTeamPermission(
  userRole: TeamMemberRole,
  permission: EnhancedPermission
): boolean {
  return ENHANCED_TEAM_PERMISSIONS[permission].includes(userRole);
}

// Error handling types
export interface TeamServiceError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

export type TeamServiceErrorCode =
  | 'TEAM_NOT_FOUND'
  | 'MEMBER_NOT_FOUND'
  | 'INVITATION_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_INPUT'
  | 'DUPLICATE_INVITATION'
  | 'INVITATION_EXPIRED'
  | 'BULK_OPERATION_FAILED'
  | 'SECURITY_VIOLATION'
  | 'DATABASE_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export class TeamServiceException extends Error {
  public readonly code: TeamServiceErrorCode;
  public readonly details?: Record<string, any>;
  public readonly timestamp: string;

  constructor(
    code: TeamServiceErrorCode,
    message: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'TeamServiceException';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON(): TeamServiceError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

// Request/Response types for service methods
export interface GetTeamMembersRequest {
  team_id: string;
  include_inactive?: boolean;
  include_scheduled_removal?: boolean;
}

export interface GetTeamInvitationsRequest {
  team_id: string;
  status?: InvitationStatus | InvitationStatus[];
  include_expired?: boolean;
  limit?: number;
  offset?: number;
}

export interface GetAuditLogsRequest {
  team_id: string;
  actions?: AuditAction[];
  user_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface GetBulkOperationsRequest {
  team_id: string;
  operation_types?: BulkOperationType[];
  statuses?: BulkOperationStatus[];
  performed_by?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface SearchAuditLogsRequest {
  team_id: string;
  search_params: {
    text_search?: string;
    actions?: AuditAction[];
    user_id?: string;
    limit?: number;
  };
}

export interface ExportAuditLogsRequest {
  team_id: string;
  start_date: string;
  end_date: string;
  format?: 'json' | 'csv';
}

// Utility types for service operations
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface OperationProgress {
  operation_id: string;
  status: BulkOperationStatus;
  progress_percentage: number;
  processed_items: number;
  total_items: number;
  successful_items: number;
  failed_items: number;
  estimated_completion?: string;
  current_operation?: string;
}

// Configuration types
export interface TeamServiceConfig {
  default_invitation_expiry_days: number;
  max_bulk_operation_size: number;
  rate_limit_window_minutes: number;
  audit_log_retention_days: number;
  security_event_retention_days: number;
  enable_enhanced_logging: boolean;
  enable_rate_limiting: boolean;
  enable_ip_filtering: boolean;
}
