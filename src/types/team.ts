// Team Management Types

export type TeamStatus = 'active' | 'suspended' | 'archived';

export type TeamMemberRole = 'owner' | 'admin' | 'member' | 'viewer';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export type UserType = 'unregistered' | 'logged_out' | 'logged_in' | 'cross_team';

export type AuthenticationMethod = 'password' | 'magic_link' | 'oauth' | 'existing_session';

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
  permissions?: Record<string, any>;
  custom_message?: string;
  authentication_method?: AuthenticationMethod;
  acceptance_ip_address?: string;
  acceptance_user_agent?: string;
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

// ============================================================================
// ENHANCED INVITATION ONBOARDING SYSTEM TYPES (Phase 1)
// ============================================================================

// Invitation state types for pre-authentication tracking
export type InvitationStateStatus = 'pending' | 'authenticating' | 'authenticated' | 'accepted' | 'expired' | 'cancelled';

export interface InvitationState {
  id: string;
  invitation_token: string;
  invitation_id: string;
  target_email: string;
  user_id?: string;
  state: InvitationStateStatus;
  authentication_method?: AuthenticationMethod;
  user_type: UserType;
  redirect_after_auth?: string;
  session_data: Record<string, any>;
  browser_fingerprint?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  authenticated_at?: string;
  expires_at: string;
  updated_at: string;
}

// Onboarding progress tracking types
export type OnboardingType = 'team_invitation' | 'self_signup' | 'admin_created';
export type OnboardingStep = 'profile_setup' | 'team_introduction' | 'first_upload' | 'dashboard_tour' | 'preferences_setup' | 'completed';

export interface OnboardingProgress {
  id: string;
  user_id: string;
  onboarding_type: OnboardingType;
  team_id?: string;
  invitation_id?: string;
  current_step: OnboardingStep;
  completed_steps: string[];
  total_steps: number;
  completion_percentage: number;
  profile_completed: boolean;
  team_introduction_viewed: boolean;
  first_receipt_uploaded: boolean;
  dashboard_tour_completed: boolean;
  preferences_configured: boolean;
  onboarding_data: Record<string, any>;
  skip_reasons: Record<string, any>;
  is_completed: boolean;
  completed_at?: string;
  started_at: string;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

// Team onboarding configuration types
export interface TeamOnboardingConfig {
  id: string;
  team_id: string;
  enabled: boolean;
  welcome_message?: string;
  introduction_video_url?: string;
  custom_steps: OnboardingCustomStep[];
  require_profile_completion: boolean;
  require_team_introduction: boolean;
  require_first_upload: boolean;
  require_dashboard_tour: boolean;
  require_preferences_setup: boolean;
  brand_colors: Record<string, string>;
  custom_resources: OnboardingResource[];
  mentor_assignments: Record<string, any>;
  notify_admins_on_join: boolean;
  notify_team_on_completion: boolean;
  created_by: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface OnboardingCustomStep {
  id: string;
  name: string;
  title: string;
  description: string;
  component?: string;
  required: boolean;
  order: number;
  config: Record<string, any>;
}

export interface OnboardingResource {
  id: string;
  title: string;
  description: string;
  url: string;
  type: 'video' | 'document' | 'link' | 'tutorial';
  category: string;
}

// Enhanced team invitation with onboarding support
export interface EnhancedTeamInvitationWithOnboarding extends EnhancedTeamInvitation {
  onboarding_required: boolean;
  onboarding_completed: boolean;
  onboarding_completed_at?: string;
  user_type_detected?: UserType;
  authentication_method?: AuthenticationMethod;
  acceptance_ip_address?: string;
  acceptance_user_agent?: string;
}

// Request/Response types for new functionality
export interface CreateInvitationStateRequest {
  invitation_token: string;
  target_email: string;
  user_type: UserType;
  redirect_after_auth?: string;
  session_data?: Record<string, any>;
  browser_fingerprint?: string;
  ip_address?: string;
  user_agent?: string;
}

export interface UpdateInvitationStateRequest {
  invitation_token: string;
  user_id: string;
  authentication_method: AuthenticationMethod;
}

export interface InitializeOnboardingRequest {
  user_id: string;
  onboarding_type: OnboardingType;
  team_id?: string;
  invitation_id?: string;
}

export interface UpdateOnboardingStepRequest {
  user_id: string;
  step_name: OnboardingStep;
  step_data?: Record<string, any>;
  team_id?: string;
}

export interface InvitationValidationResult {
  success: boolean;
  invitation?: {
    id: string;
    email: string;
    role: TeamMemberRole;
    team_id: string;
    team_name: string;
    expires_at: string;
    custom_message?: string;
  };
  user_analysis?: {
    user_type: UserType;
    user_exists: boolean;
    user_logged_in: boolean;
    existing_membership?: {
      role: TeamMemberRole;
      joined_at: string;
    };
    cross_team_memberships: number;
  };
  error?: string;
  error_code?: string;
}

export interface InvitationStateWithContext {
  success: boolean;
  data?: {
    invitation_state: InvitationState;
    invitation: EnhancedTeamInvitationWithOnboarding;
    team: {
      id: string;
      name: string;
      description?: string;
      slug: string;
    };
    inviter: {
      id: string;
      email: string;
      full_name?: string;
    };
    team_config?: TeamOnboardingConfig;
  };
  error?: string;
  error_code?: string;
}

export interface OnboardingStatus {
  success: boolean;
  progress?: OnboardingProgress;
  team_config?: TeamOnboardingConfig;
  next_steps?: OnboardingStep[];
  error?: string;
  error_code?: string;
}

export interface InvitationAnalytics {
  period_days: number;
  team_id?: string;
  invitations: {
    total_invitations: number;
    pending_invitations: number;
    accepted_invitations: number;
    expired_invitations: number;
    unregistered_users: number;
    logged_out_users: number;
    logged_in_users: number;
    cross_team_users: number;
    avg_acceptance_hours?: number;
  };
  onboarding: {
    total_onboarding: number;
    completed_onboarding: number;
    avg_completion_percentage: number;
    avg_completion_hours?: number;
  };
  generated_at: string;
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

// ============================================================================
// MEMBER ANALYTICS TYPES
// ============================================================================

// Member analytics request types
export interface GetMemberAnalyticsRequest {
  team_id: string;
  user_id?: string;
  start_date?: string;
  end_date?: string;
}

export interface GetMemberActivityTimelineRequest {
  team_id: string;
  user_id?: string;
  limit?: number;
  offset?: number;
  activity_types?: string[];
  start_date?: string;
  end_date?: string;
}

export interface GetMemberPerformanceInsightsRequest {
  team_id: string;
  user_id?: string;
  comparison_period_days?: number;
}

export interface SearchMembersAdvancedRequest {
  team_id: string;
  search_query?: string;
  role_filter?: TeamMemberRole[];
  status_filter?: string[];
  activity_filter?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface GetTeamEngagementMetricsRequest {
  team_id: string;
  period_days?: number;
}

// Member analytics response types
export interface MemberAnalytics {
  member_info: {
    user_id: string;
    role: TeamMemberRole;
    joined_at: string;
    last_active_at?: string;
    invitation_accepted_at?: string;
    member_metadata?: Record<string, any>;
    email: string;
    first_name?: string;
    last_name?: string;
    full_name: string;
    avatar_url?: string;
    timezone?: string;
  };
  activity_stats: {
    total_activities: number;
    active_days: number;
    activities_last_week: number;
    activities_last_month: number;
    receipt_activities: number;
    team_activities: number;
    avg_activity_interval_minutes: number;
    activity_frequency: 'inactive' | 'low' | 'moderate' | 'active' | 'very_active';
  };
  engagement_metrics: {
    receipts_created: number;
    total_amount_processed: number;
    categories_used: number;
    avg_receipt_amount: number;
    ai_processed_receipts: number;
    recent_receipts: number;
    ai_adoption_rate: number;
    engagement_level: 'none' | 'minimal' | 'low' | 'medium' | 'high';
  };
  performance_data: {
    days_since_joined: number;
    days_since_last_active: number;
    total_logged_actions: number;
    active_days_logged: number;
    activity_consistency: number;
    member_status: 'very_active' | 'active' | 'moderate' | 'inactive' | 'dormant';
  };
  analysis_period: {
    start_date: string;
    end_date: string;
    days_analyzed: number;
  };
}

export interface MemberActivityTimelineItem {
  id: string;
  action: string;
  action_description: string;
  created_at: string;
  performed_by: string;
  performed_by_email: string;
  performed_by_name: string;
  target_user_id?: string;
  target_user_email?: string;
  target_user_name?: string;
  old_values: Record<string, any>;
  new_values: Record<string, any>;
  metadata: Record<string, any>;
  context_data: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

export interface MemberActivityTimeline {
  activities: MemberActivityTimelineItem[];
  pagination: {
    total_count: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
  filters: {
    user_id?: string;
    activity_types?: string[];
    start_date: string;
    end_date: string;
  };
}

export interface MemberPerformanceInsights {
  current_period: {
    receipts: number;
    amount: number;
    categories: number;
    ai_receipts: number;
    active_days: number;
    ai_adoption_rate: number;
  };
  previous_period: {
    receipts: number;
    amount: number;
    categories: number;
    ai_receipts: number;
    active_days: number;
  };
  changes: {
    receipts_change: number;
    amount_change: number;
    categories_change: number;
    receipts_change_percent: number;
    amount_change_percent: number;
  };
  team_comparison: {
    receipts_vs_avg: number;
    amount_vs_avg: number;
    categories_vs_avg: number;
  };
  engagement_trends: Array<{
    date: string;
    receipts: number;
    amount: number;
    categories: number;
  }>;
}

export interface EnhancedMemberSearchResult {
  id: string;
  user_id: string;
  role: TeamMemberRole;
  permissions: Record<string, any>;
  joined_at: string;
  updated_at: string;
  last_active_at?: string;
  invitation_accepted_at?: string;
  added_by: string;
  removal_scheduled_at?: string;
  removal_scheduled_by?: string;
  member_metadata?: Record<string, any>;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  avatar_url?: string;
  timezone?: string;
  member_status: 'scheduled_removal' | 'very_active' | 'active' | 'moderate' | 'inactive' | 'dormant';
  activity_metrics: {
    total_activities: number;
    recent_activities: number;
    last_activity_date?: string;
    active_days: number;
    activity_score: number;
  };
  receipt_metrics: {
    total_receipts: number;
    total_amount: number;
    recent_receipts: number;
    categories_used: number;
  };
}

export interface MemberSearchResults {
  members: EnhancedMemberSearchResult[];
  pagination: {
    total_count: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
  filters: {
    search_query?: string;
    role_filter?: TeamMemberRole[];
    status_filter?: string[];
    activity_filter?: string;
    sort_by: string;
    sort_order: string;
  };
}

export interface TeamEngagementMetrics {
  team_overview: {
    total_members: number;
    very_active_members: number;
    active_members: number;
    moderate_members: number;
    inactive_members: number;
    scheduled_removals: number;
    avg_member_tenure_days: number;
    engagement_distribution: {
      very_active_percent: number;
      active_percent: number;
      moderate_percent: number;
      inactive_percent: number;
    };
  };
  activity_metrics: {
    total_activities: number;
    active_contributors: number;
    recent_activities: number;
    recent_contributors: number;
    receipt_activities: number;
    team_management_activities: number;
    avg_daily_activities: number;
    contributor_participation_rate: number;
  };
  receipt_metrics: {
    total_receipts: number;
    total_amount: number;
    contributing_members: number;
    recent_receipts: number;
    recent_amount: number;
    recent_contributors: number;
    categories_used: number;
    ai_processed_receipts: number;
    avg_receipt_amount: number;
    ai_adoption_rate: number;
    member_contribution_rate: number;
  };
  top_performers: Array<{
    user_id: string;
    full_name: string;
    role: TeamMemberRole;
    joined_at: string;
    last_active_at?: string;
    activity_score: number;
    receipt_count: number;
    total_amount: number;
    engagement_level: 'high' | 'medium' | 'low' | 'minimal';
  }>;
  engagement_trends: Array<{
    date: string;
    active_members: number;
    activities: number;
    receipts: number;
    amount: number;
  }>;
  team_health_score: number;
  insights: string[];
}

// ============================================================================
// SCHEDULED OPERATIONS TYPES
// ============================================================================

// Scheduled operation types matching database enums
export type ScheduledOperationType =
  | 'member_removal'
  | 'role_change'
  | 'permission_update'
  | 'bulk_operation'
  | 'invitation_expiry'
  | 'data_cleanup'
  | 'notification_send'
  | 'custom_operation';

export type ScheduledOperationStatus =
  | 'pending'
  | 'scheduled'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired';

// Scheduled operation request types
export interface ScheduleMemberOperationRequest {
  team_id: string;
  operation_type: ScheduledOperationType;
  operation_name: string;
  scheduled_for: string; // ISO timestamp
  operation_config?: Record<string, any>;
  operation_description?: string;
  max_retries?: number;
  depends_on?: string[]; // Array of operation IDs
  prerequisites?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface GetScheduledOperationsRequest {
  team_id: string;
  operation_types?: ScheduledOperationType[];
  status_filter?: ScheduledOperationStatus[];
  include_completed?: boolean;
  limit?: number;
  offset?: number;
}

export interface CancelScheduledOperationRequest {
  operation_id: string;
  reason?: string;
}

export interface RescheduleOperationRequest {
  operation_id: string;
  new_scheduled_for: string; // ISO timestamp
  reason?: string;
}

// Scheduled operation response types
export interface ScheduledOperation {
  id: string;
  team_id: string;
  operation_type: ScheduledOperationType;
  operation_name: string;
  operation_description?: string;
  scheduled_for: string;
  created_at: string;
  updated_at: string;
  status: ScheduledOperationStatus;
  started_at?: string;
  completed_at?: string;
  created_by: string;
  executed_by?: string;
  operation_config: Record<string, any>;
  execution_context?: Record<string, any>;
  retry_count: number;
  max_retries: number;
  error_message?: string;
  error_details?: Record<string, any>;
  depends_on: string[];
  prerequisites: Record<string, any>;
  metadata: Record<string, any>;
  creator: {
    user_id: string;
    email: string;
    full_name: string;
  };
  executor?: {
    user_id: string;
    email: string;
    full_name: string;
  };
  dependencies: Array<{
    operation_id: string;
    operation_name: string;
    status: ScheduledOperationStatus;
    completed_at?: string;
  }>;
  recent_logs: Array<{
    log_level: string;
    message: string;
    logged_at: string;
    execution_step?: string;
    progress_percentage?: number;
  }>;
}

export interface ScheduledOperationsResponse {
  operations: ScheduledOperation[];
  pagination: {
    total_count: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
  filters: {
    operation_types?: ScheduledOperationType[];
    status_filter?: ScheduledOperationStatus[];
    include_completed: boolean;
  };
}

export interface ScheduledOperationResult {
  operation_id: string;
  operation_type: ScheduledOperationType;
  operation_name: string;
  scheduled_for: string;
  status: ScheduledOperationStatus;
}

export interface ProcessScheduledOperationsResult {
  summary: {
    processed_count: number;
    failed_count: number;
    skipped_count: number;
    total_operations: number;
  };
  results: Array<{
    operation_id: string;
    operation_name: string;
    operation_type: ScheduledOperationType;
    status: 'completed' | 'failed';
    result: Record<string, any>;
  }>;
  processed_at: string;
}

export interface CancelOperationResult {
  operation_id: string;
  operation_name: string;
  previous_status: ScheduledOperationStatus;
  new_status: 'cancelled';
  cancelled_by: string;
  cancelled_at: string;
}

export interface RescheduleOperationResult {
  operation_id: string;
  operation_name: string;
  previous_scheduled_for: string;
  new_scheduled_for: string;
  status: 'scheduled';
  rescheduled_by: string;
  rescheduled_at: string;
}

// Enhanced Invitation Flow Types
export interface InvitationValidationResult {
  valid: boolean;
  error?: string;
  error_code?: string;
  invitation?: TeamInvitation;
  user_state?: UserStateDetectionResult;
}

export interface InvitationStateWithContext {
  id: string;
  invitation_token: string;
  invitation_id: string;
  target_email: string;
  user_type: UserType;
  state: 'pending' | 'authenticated' | 'accepted' | 'expired';
  user_id?: string;
  authentication_method?: AuthenticationMethod;
  redirect_after_auth?: string;
  session_data?: Record<string, any>;
  browser_fingerprint?: string;
  ip_address?: string;
  user_agent?: string;
  authenticated_at?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}
