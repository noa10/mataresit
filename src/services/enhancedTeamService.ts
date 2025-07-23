import { supabase } from '@/lib/supabase';
import {
  Team,
  TeamMember,
  TeamInvitation,
  UserTeam,
  CreateTeamRequest,
  TeamMemberRole,
  EnhancedTeamInvitation,
  InviteTeamMemberEnhancedRequest,
  ResendInvitationRequest,
  BulkOperation,
  BulkOperationType,
  BulkRoleUpdateRequest,
  BulkPermissionUpdateRequest,
  BulkInvitationRequest,
  BulkRemovalRequest,
  BulkOperationResult,
  TeamAuditLog,
  SecurityEvent,
  SecurityConfig,
  RateLimitConfig,
  EnhancedTeamStats,
  SecurityDashboard,
  ServiceResponse,
  TeamServiceException,
  TeamServiceErrorCode,
  GetTeamMembersRequest,
  GetTeamInvitationsRequest,
  GetAuditLogsRequest,
  GetBulkOperationsRequest,
  SearchAuditLogsRequest,
  ExportAuditLogsRequest,
  PaginatedResponse,
  OperationProgress,
} from '@/types/team';

/**
 * Enhanced Team Service
 * Comprehensive service layer for all team management operations
 * Includes security, rate limiting, bulk operations, and audit trails
 */
export class EnhancedTeamService {
  private static instance: EnhancedTeamService;

  static getInstance(): EnhancedTeamService {
    if (!EnhancedTeamService.instance) {
      EnhancedTeamService.instance = new EnhancedTeamService();
    }
    return EnhancedTeamService.instance;
  }

  // ============================================================================
  // ERROR HANDLING UTILITIES
  // ============================================================================

  private handleError(error: any, operation: string): never {
    console.error(`Enhanced Team Service Error [${operation}]:`, error);
    
    if (error.code) {
      // Supabase error
      const errorCode = this.mapSupabaseErrorCode(error.code);
      throw new TeamServiceException(errorCode, error.message, { 
        supabase_code: error.code,
        operation 
      });
    }
    
    if (error instanceof TeamServiceException) {
      throw error;
    }
    
    throw new TeamServiceException('UNKNOWN_ERROR', error.message || 'An unknown error occurred', { operation });
  }

  private mapSupabaseErrorCode(supabaseCode: string): TeamServiceErrorCode {
    switch (supabaseCode) {
      case 'PGRST116': return 'TEAM_NOT_FOUND';
      case '23505': return 'DUPLICATE_INVITATION';
      case '42501': return 'PERMISSION_DENIED';
      default: return 'DATABASE_ERROR';
    }
  }

  private validateResponse<T>(data: any, operation: string): T {
    if (data?.error) {
      throw new TeamServiceException(
        data.error_code || 'UNKNOWN_ERROR',
        data.error,
        { operation }
      );
    }
    return data;
  }

  // ============================================================================
  // ENHANCED TEAM MANAGEMENT
  // ============================================================================

  async createTeam(request: CreateTeamRequest): Promise<ServiceResponse<string>> {
    try {
      const { data, error } = await supabase.rpc('create_team', {
        _name: request.name,
        _description: request.description || null,
        _slug: request.slug || null,
      });

      if (error) throw error;

      return {
        success: true,
        data,
        metadata: { operation: 'create_team' }
      };
    } catch (error: any) {
      this.handleError(error, 'createTeam');
    }
  }

  async getTeam(teamId: string): Promise<ServiceResponse<Team | null>> {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return {
        success: true,
        data: error?.code === 'PGRST116' ? null : data,
        metadata: { operation: 'get_team' }
      };
    } catch (error: any) {
      this.handleError(error, 'getTeam');
    }
  }

  async getUserTeams(): Promise<ServiceResponse<UserTeam[]>> {
    try {
      const { data, error } = await supabase.rpc('get_user_teams');

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        metadata: { operation: 'get_user_teams' }
      };
    } catch (error: any) {
      this.handleError(error, 'getUserTeams');
    }
  }

  async updateTeam(teamId: string, updates: Partial<Team>): Promise<ServiceResponse<void>> {
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', teamId);

      if (error) throw error;

      return {
        success: true,
        metadata: { operation: 'update_team', team_id: teamId }
      };
    } catch (error: any) {
      this.handleError(error, 'updateTeam');
    }
  }

  async deleteTeam(teamId: string): Promise<ServiceResponse<void>> {
    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;

      return {
        success: true,
        metadata: { operation: 'delete_team', team_id: teamId }
      };
    } catch (error: any) {
      this.handleError(error, 'deleteTeam');
    }
  }

  // ============================================================================
  // ENHANCED MEMBER MANAGEMENT
  // ============================================================================

  async getTeamMembers(request: GetTeamMembersRequest): Promise<ServiceResponse<TeamMember[]>> {
    try {
      const { data, error } = await supabase.rpc('get_team_members_enhanced', {
        _team_id: request.team_id,
        _include_inactive: request.include_inactive || false,
        _include_scheduled_removal: request.include_scheduled_removal || false,
      });

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        metadata: { operation: 'get_team_members', team_id: request.team_id }
      };
    } catch (error: any) {
      this.handleError(error, 'getTeamMembers');
    }
  }

  async removeMemberEnhanced(
    teamId: string,
    userId: string,
    options: {
      reason?: string;
      transferData?: boolean;
      transferToUserId?: string;
    } = {}
  ): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('remove_team_member_enhanced', {
        _team_id: teamId,
        _user_id: userId,
        _reason: options.reason || null,
        _transfer_data: options.transferData || false,
        _transfer_to_user_id: options.transferToUserId || null,
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'remove_member_enhanced'),
        metadata: { operation: 'remove_member_enhanced', team_id: teamId, user_id: userId }
      };
    } catch (error: any) {
      this.handleError(error, 'removeMemberEnhanced');
    }
  }

  async updateMemberRoleEnhanced(
    teamId: string,
    userId: string,
    newRole: TeamMemberRole,
    reason?: string
  ): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('update_member_role_enhanced', {
        _team_id: teamId,
        _user_id: userId,
        _new_role: newRole,
        _reason: reason || null,
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'update_member_role_enhanced'),
        metadata: { operation: 'update_member_role_enhanced', team_id: teamId, user_id: userId, new_role: newRole }
      };
    } catch (error: any) {
      this.handleError(error, 'updateMemberRoleEnhanced');
    }
  }

  async scheduleMemberRemoval(
    teamId: string,
    userId: string,
    removalDate: string,
    reason?: string
  ): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('schedule_member_removal', {
        _team_id: teamId,
        _user_id: userId,
        _removal_date: removalDate,
        _reason: reason || null,
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'schedule_member_removal'),
        metadata: { operation: 'schedule_member_removal', team_id: teamId, user_id: userId }
      };
    } catch (error: any) {
      this.handleError(error, 'scheduleMemberRemoval');
    }
  }

  async cancelScheduledRemoval(
    teamId: string,
    userId: string,
    reason?: string
  ): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('cancel_scheduled_removal', {
        _team_id: teamId,
        _user_id: userId,
        _reason: reason || null,
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'cancel_scheduled_removal'),
        metadata: { operation: 'cancel_scheduled_removal', team_id: teamId, user_id: userId }
      };
    } catch (error: any) {
      this.handleError(error, 'cancelScheduledRemoval');
    }
  }

  async transferOwnership(
    teamId: string,
    newOwnerId: string,
    reason?: string
  ): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('transfer_team_ownership', {
        _team_id: teamId,
        _new_owner_id: newOwnerId,
        _reason: reason || null,
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'transfer_team_ownership'),
        metadata: { operation: 'transfer_ownership', team_id: teamId, new_owner_id: newOwnerId }
      };
    } catch (error: any) {
      this.handleError(error, 'transferOwnership');
    }
  }

  // ============================================================================
  // ENHANCED INVITATION MANAGEMENT
  // ============================================================================

  async sendInvitationEnhanced(
    request: InviteTeamMemberEnhancedRequest
  ): Promise<ServiceResponse<string>> {
    try {
      const { data, error } = await supabase.rpc('invite_team_member_enhanced', {
        _team_id: request.team_id,
        _email: request.email,
        _role: request.role || 'member',
        _custom_message: request.custom_message || null,
        _permissions: request.permissions || {},
        _expires_in_days: request.expires_in_days || 7,
        _send_email: request.send_email !== false,
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'invite_team_member_enhanced'),
        metadata: { operation: 'send_invitation_enhanced', team_id: request.team_id, email: request.email }
      };
    } catch (error: any) {
      this.handleError(error, 'sendInvitationEnhanced');
    }
  }

  async resendInvitation(request: ResendInvitationRequest): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('resend_team_invitation', {
        _invitation_id: request.invitation_id,
        _custom_message: request.custom_message || null,
        _extend_expiration: request.extend_expiration !== false,
        _new_expiration_days: request.new_expiration_days || 7,
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'resend_team_invitation'),
        metadata: { operation: 'resend_invitation', invitation_id: request.invitation_id }
      };
    } catch (error: any) {
      this.handleError(error, 'resendInvitation');
    }
  }

  async cancelInvitation(invitationId: string, reason?: string): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('cancel_team_invitation', {
        _invitation_id: invitationId,
        _reason: reason || null,
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'cancel_team_invitation'),
        metadata: { operation: 'cancel_invitation', invitation_id: invitationId }
      };
    } catch (error: any) {
      this.handleError(error, 'cancelInvitation');
    }
  }

  async getTeamInvitations(request: GetTeamInvitationsRequest): Promise<ServiceResponse<EnhancedTeamInvitation[]>> {
    try {
      const { data, error } = await supabase.rpc('get_team_invitations', {
        _team_id: request.team_id,
        _status: Array.isArray(request.status) ? request.status : (request.status ? [request.status] : null),
        _include_expired: request.include_expired || false,
        _limit: request.limit || 50,
        _offset: request.offset || 0,
      });

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        metadata: { operation: 'get_team_invitations', team_id: request.team_id }
      };
    } catch (error: any) {
      this.handleError(error, 'getTeamInvitations');
    }
  }

  async getInvitationStats(teamId: string): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('get_invitation_stats', {
        _team_id: teamId,
      });

      if (error) throw error;

      return {
        success: true,
        data: data || {},
        metadata: { operation: 'get_invitation_stats', team_id: teamId }
      };
    } catch (error: any) {
      this.handleError(error, 'getInvitationStats');
    }
  }

  async acceptInvitation(token: string): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('accept_team_invitation_enhanced', {
        _token: token,
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'accept_team_invitation_enhanced'),
        metadata: { operation: 'accept_invitation', token }
      };
    } catch (error: any) {
      this.handleError(error, 'acceptInvitation');
    }
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  async bulkUpdateRoles(
    teamId: string,
    roleUpdates: BulkRoleUpdateRequest[],
    reason?: string
  ): Promise<ServiceResponse<BulkOperationResult>> {
    try {
      const { data, error } = await supabase.rpc('bulk_update_member_roles', {
        p_team_id: teamId,
        p_role_updates: roleUpdates,
        p_reason: reason || null,
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'bulk_update_member_roles'),
        metadata: { operation: 'bulk_update_roles', team_id: teamId, count: roleUpdates.length }
      };
    } catch (error: any) {
      this.handleError(error, 'bulkUpdateRoles');
    }
  }

  async bulkUpdatePermissions(
    teamId: string,
    permissionUpdates: BulkPermissionUpdateRequest[],
    reason?: string
  ): Promise<ServiceResponse<BulkOperationResult>> {
    try {
      const { data, error } = await supabase.rpc('bulk_update_member_permissions', {
        p_team_id: teamId,
        p_permission_updates: permissionUpdates,
        p_reason: reason || null,
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'bulk_update_member_permissions'),
        metadata: { operation: 'bulk_update_permissions', team_id: teamId, count: permissionUpdates.length }
      };
    } catch (error: any) {
      this.handleError(error, 'bulkUpdatePermissions');
    }
  }

  async bulkInviteMembers(
    teamId: string,
    invitations: BulkInvitationRequest[],
    options: {
      defaultRole?: TeamMemberRole;
      expiresInDays?: number;
      sendEmails?: boolean;
    } = {}
  ): Promise<ServiceResponse<BulkOperationResult>> {
    try {
      const { data, error } = await supabase.rpc('bulk_invite_team_members', {
        _team_id: teamId,
        _invitations: invitations,
        _default_role: options.defaultRole || 'member',
        _expires_in_days: options.expiresInDays || 7,
        _send_emails: options.sendEmails !== false,
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'bulk_invite_team_members'),
        metadata: { operation: 'bulk_invite_members', team_id: teamId, count: invitations.length }
      };
    } catch (error: any) {
      this.handleError(error, 'bulkInviteMembers');
    }
  }

  async bulkRemoveMembers(
    teamId: string,
    request: BulkRemovalRequest
  ): Promise<ServiceResponse<BulkOperationResult>> {
    try {
      const { data, error } = await supabase.rpc('bulk_remove_team_members', {
        _team_id: teamId,
        _user_ids: request.user_ids,
        _reason: request.reason || null,
        _transfer_data: request.transfer_data || false,
        _transfer_to_user_id: request.transfer_to_user_id || null,
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'bulk_remove_team_members'),
        metadata: { operation: 'bulk_remove_members', team_id: teamId, count: request.user_ids.length }
      };
    } catch (error: any) {
      this.handleError(error, 'bulkRemoveMembers');
    }
  }

  // ============================================================================
  // BULK OPERATION MANAGEMENT
  // ============================================================================

  async getBulkOperations(request: GetBulkOperationsRequest): Promise<ServiceResponse<PaginatedResponse<BulkOperation>>> {
    try {
      const { data, error } = await supabase.rpc('get_bulk_operations', {
        p_team_id: request.team_id,
        p_operation_types: request.operation_types || null,
        p_statuses: request.statuses || null,
        p_performed_by: request.performed_by || null,
        p_start_date: request.start_date || null,
        p_end_date: request.end_date || null,
        p_limit: request.limit || 50,
        p_offset: request.offset || 0,
      });

      if (error) throw error;

      const result = this.validateResponse(data, 'get_bulk_operations');

      return {
        success: true,
        data: {
          data: result.operations || [],
          total: result.total || 0,
          limit: request.limit || 50,
          offset: request.offset || 0,
          has_more: (result.total || 0) > (request.offset || 0) + (request.limit || 50),
        },
        metadata: { operation: 'get_bulk_operations', team_id: request.team_id }
      };
    } catch (error: any) {
      this.handleError(error, 'getBulkOperations');
    }
  }

  async getBulkOperationStats(
    teamId: string,
    startDate?: string,
    endDate?: string
  ): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('get_bulk_operation_stats', {
        p_team_id: teamId,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
      });

      if (error) throw error;

      return {
        success: true,
        data: data || {},
        metadata: { operation: 'get_bulk_operation_stats', team_id: teamId }
      };
    } catch (error: any) {
      this.handleError(error, 'getBulkOperationStats');
    }
  }

  async cancelBulkOperation(operationId: string, reason?: string): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('cancel_bulk_operation', {
        p_operation_id: operationId,
        p_reason: reason || null,
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'cancel_bulk_operation'),
        metadata: { operation: 'cancel_bulk_operation', operation_id: operationId }
      };
    } catch (error: any) {
      this.handleError(error, 'cancelBulkOperation');
    }
  }

  async retryBulkOperationFailures(operationId: string, reason?: string): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('retry_bulk_operation_failures', {
        p_operation_id: operationId,
        p_retry_reason: reason || null,
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'retry_bulk_operation_failures'),
        metadata: { operation: 'retry_bulk_operation_failures', operation_id: operationId }
      };
    } catch (error: any) {
      this.handleError(error, 'retryBulkOperationFailures');
    }
  }

  async getBulkOperationProgress(operationId: string): Promise<ServiceResponse<OperationProgress>> {
    try {
      const { data, error } = await supabase.rpc('get_bulk_operation_progress', {
        p_operation_id: operationId,
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'get_bulk_operation_progress'),
        metadata: { operation: 'get_bulk_operation_progress', operation_id: operationId }
      };
    } catch (error: any) {
      this.handleError(error, 'getBulkOperationProgress');
    }
  }

  // ============================================================================
  // AUDIT TRAIL MANAGEMENT
  // ============================================================================

  async getAuditLogs(request: GetAuditLogsRequest): Promise<ServiceResponse<PaginatedResponse<TeamAuditLog>>> {
    try {
      const { data, error } = await supabase.rpc('get_team_audit_logs', {
        _team_id: request.team_id,
        _actions: request.actions || null,
        _user_id: request.user_id || null,
        _start_date: request.start_date || null,
        _end_date: request.end_date || null,
        _limit: request.limit || 50,
        _offset: request.offset || 0,
      });

      if (error) throw error;

      const result = this.validateResponse(data, 'get_team_audit_logs');

      return {
        success: true,
        data: {
          data: result.logs || [],
          total: result.total || 0,
          limit: request.limit || 50,
          offset: request.offset || 0,
          has_more: (result.total || 0) > (request.offset || 0) + (request.limit || 50),
        },
        metadata: { operation: 'get_audit_logs', team_id: request.team_id }
      };
    } catch (error: any) {
      this.handleError(error, 'getAuditLogs');
    }
  }

  async searchAuditLogs(request: SearchAuditLogsRequest): Promise<ServiceResponse<TeamAuditLog[]>> {
    try {
      const { data, error } = await supabase.rpc('search_team_audit_logs', {
        _team_id: request.team_id,
        _search_params: request.search_params,
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'search_team_audit_logs') || [],
        metadata: { operation: 'search_audit_logs', team_id: request.team_id }
      };
    } catch (error: any) {
      this.handleError(error, 'searchAuditLogs');
    }
  }

  async exportAuditLogs(request: ExportAuditLogsRequest): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('export_team_audit_logs', {
        _team_id: request.team_id,
        _start_date: request.start_date,
        _end_date: request.end_date,
        _format: request.format || 'json',
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'export_team_audit_logs'),
        metadata: { operation: 'export_audit_logs', team_id: request.team_id, format: request.format }
      };
    } catch (error: any) {
      this.handleError(error, 'exportAuditLogs');
    }
  }

  // ============================================================================
  // SECURITY MANAGEMENT
  // ============================================================================

  async getSecurityDashboard(teamId: string, days: number = 7): Promise<ServiceResponse<SecurityDashboard>> {
    try {
      const { data, error } = await supabase.rpc('get_team_security_dashboard', {
        p_team_id: teamId,
        p_days: days,
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'get_team_security_dashboard'),
        metadata: { operation: 'get_security_dashboard', team_id: teamId, days }
      };
    } catch (error: any) {
      this.handleError(error, 'getSecurityDashboard');
    }
  }

  async getSecurityConfig(teamId: string): Promise<ServiceResponse<SecurityConfig | null>> {
    try {
      const { data, error } = await supabase
        .from('team_security_configs')
        .select('security_settings')
        .eq('team_id', teamId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return {
        success: true,
        data: error?.code === 'PGRST116' ? null : data?.security_settings,
        metadata: { operation: 'get_security_config', team_id: teamId }
      };
    } catch (error: any) {
      this.handleError(error, 'getSecurityConfig');
    }
  }

  async updateSecurityConfig(teamId: string, config: Partial<SecurityConfig>): Promise<ServiceResponse<void>> {
    try {
      const { error } = await supabase
        .from('team_security_configs')
        .upsert({
          team_id: teamId,
          security_settings: config,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      return {
        success: true,
        metadata: { operation: 'update_security_config', team_id: teamId }
      };
    } catch (error: any) {
      this.handleError(error, 'updateSecurityConfig');
    }
  }

  async getRateLimitConfig(teamId: string): Promise<ServiceResponse<RateLimitConfig | null>> {
    try {
      const { data, error } = await supabase
        .from('team_security_configs')
        .select('rate_limits')
        .eq('team_id', teamId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return {
        success: true,
        data: error?.code === 'PGRST116' ? null : data?.rate_limits,
        metadata: { operation: 'get_rate_limit_config', team_id: teamId }
      };
    } catch (error: any) {
      this.handleError(error, 'getRateLimitConfig');
    }
  }

  async updateRateLimitConfig(teamId: string, config: Partial<RateLimitConfig>): Promise<ServiceResponse<void>> {
    try {
      const { error } = await supabase
        .from('team_security_configs')
        .upsert({
          team_id: teamId,
          rate_limits: config,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      return {
        success: true,
        metadata: { operation: 'update_rate_limit_config', team_id: teamId }
      };
    } catch (error: any) {
      this.handleError(error, 'updateRateLimitConfig');
    }
  }

  // ============================================================================
  // STATISTICS AND ANALYTICS
  // ============================================================================

  async getEnhancedTeamStats(teamId: string): Promise<ServiceResponse<EnhancedTeamStats>> {
    try {
      const { data, error } = await supabase.rpc('get_enhanced_team_stats', {
        _team_id: teamId,
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'get_enhanced_team_stats'),
        metadata: { operation: 'get_enhanced_team_stats', team_id: teamId }
      };
    } catch (error: any) {
      this.handleError(error, 'getEnhancedTeamStats');
    }
  }

  async getTeamActivitySummary(
    teamId: string,
    startDate?: string,
    endDate?: string
  ): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('get_team_activity_summary', {
        _team_id: teamId,
        _start_date: startDate || null,
        _end_date: endDate || null,
      });

      if (error) throw error;

      return {
        success: true,
        data: data || {},
        metadata: { operation: 'get_team_activity_summary', team_id: teamId }
      };
    } catch (error: any) {
      this.handleError(error, 'getTeamActivitySummary');
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  async validateTeamAccess(teamId: string, requiredPermission?: string): Promise<ServiceResponse<boolean>> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return {
          success: false,
          error: 'User not authenticated',
          error_code: 'NOT_AUTHENTICATED'
        };
      }

      if (requiredPermission) {
        const { data, error } = await supabase.rpc('check_team_permission_enhanced', {
          p_team_id: teamId,
          p_user_id: user.user.id,
          p_required_permission: requiredPermission,
          p_operation_context: {},
        });

        if (error) throw error;

        return {
          success: true,
          data: data?.allowed || false,
          metadata: { operation: 'validate_team_access', team_id: teamId, permission: requiredPermission }
        };
      }

      // Basic team membership check
      const { data, error } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', user.user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return {
        success: true,
        data: error?.code !== 'PGRST116',
        metadata: { operation: 'validate_team_access', team_id: teamId }
      };
    } catch (error: any) {
      this.handleError(error, 'validateTeamAccess');
    }
  }

  async cleanupExpiredData(): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('cleanup_security_data');

      if (error) throw error;

      return {
        success: true,
        data: data || {},
        metadata: { operation: 'cleanup_expired_data' }
      };
    } catch (error: any) {
      this.handleError(error, 'cleanupExpiredData');
    }
  }

  // ============================================================================
  // HEALTH CHECK AND MONITORING
  // ============================================================================

  async healthCheck(): Promise<ServiceResponse<{ status: string; timestamp: string }>> {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id')
        .limit(1);

      if (error) throw error;

      return {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
        },
        metadata: { operation: 'health_check' }
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'Service unhealthy',
        error_code: 'SERVICE_UNHEALTHY',
        metadata: { operation: 'health_check', error: error.message }
      };
    }
  }
}

// Export singleton instance
export const enhancedTeamService = EnhancedTeamService.getInstance();
