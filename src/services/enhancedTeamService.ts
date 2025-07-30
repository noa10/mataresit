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
  GetMemberAnalyticsRequest,
  GetMemberActivityTimelineRequest,
  GetMemberPerformanceInsightsRequest,
  SearchMembersAdvancedRequest,
  GetTeamEngagementMetricsRequest,
  MemberAnalytics,
  MemberActivityTimeline,
  MemberPerformanceInsights,
  MemberSearchResults,
  TeamEngagementMetrics,
  ScheduleMemberOperationRequest,
  GetScheduledOperationsRequest,
  CancelScheduledOperationRequest,
  RescheduleOperationRequest,
  ScheduledOperationsResponse,
  ScheduledOperationResult,
  ProcessScheduledOperationsResult,
  CancelOperationResult,
  RescheduleOperationResult,
  ScheduledOperationType,
  ScheduledOperationStatus,
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
      // Use the existing get_team_members function (enhanced options not supported yet)
      const { data, error } = await supabase.rpc('get_team_members', {
        _team_id: request.team_id,
      });

      if (error) throw error;

      // Note: Enhanced filtering options (include_inactive, include_scheduled_removal)
      // are not supported by the current database function
      // TODO: Implement enhanced filtering in future database migration

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

      // The function returns JSONB with success/error information
      if (!data.success) {
        return {
          success: false,
          error: data.error,
          error_code: data.error_code,
          metadata: { operation: 'send_invitation_enhanced', team_id: request.team_id, email: request.email }
        };
      }

      // If email sending was requested, trigger the email function
      if (request.send_email !== false && data.invitation_id) {
        try {
          console.log('Sending invitation email for invitation:', data.invitation_id);

          const emailResponse = await supabase.functions.invoke('send-team-invitation-email', {
            body: {
              invitation_id: data.invitation_id
            }
          });

          if (emailResponse.error) {
            console.error('Failed to send invitation email:', emailResponse.error);
            // Don't fail the entire operation if email fails, just log it
          } else {
            console.log('Invitation email sent successfully');
          }
        } catch (emailError) {
          console.error('Error sending invitation email:', emailError);
          // Don't fail the entire operation if email fails
        }
      }

      // Trigger in-app notifications for team admins
      try {
        // Import the notification service dynamically to avoid circular dependencies
        const { TeamCollaborationNotificationService } = await import('./teamCollaborationNotificationService');

        // Get current user info
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log('Sending in-app notification for team invitation...');
          await TeamCollaborationNotificationService.notifyTeamInvitationSent({
            teamId: request.team_id,
            actorUserId: user.id,
            actorName: user.user_metadata?.full_name || user.email || 'Unknown User',
            invitationEmail: request.email
          });
          console.log('In-app notification sent successfully');
        }
      } catch (notificationError) {
        console.error('Error sending in-app notifications:', notificationError);
        // Don't fail the entire operation if notifications fail
      }

      return {
        success: true,
        data: data.invitation_id,
        metadata: {
          operation: 'send_invitation_enhanced',
          team_id: request.team_id,
          email: request.email,
          invitation_id: data.invitation_id,
          token: data.token,
          expires_at: data.expires_at,
          team_name: data.team_name,
          send_email: data.send_email,
          email_triggered: request.send_email !== false
        }
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

      // The function returns JSONB with success/error information
      if (!data.success) {
        return {
          success: false,
          error: data.error,
          error_code: data.error_code,
          metadata: { operation: 'resend_invitation', invitation_id: request.invitation_id }
        };
      }

      // Send the resent invitation email
      try {
        console.log('Sending resent invitation email for invitation:', request.invitation_id);

        const emailResponse = await supabase.functions.invoke('send-team-invitation-email', {
          body: {
            invitation_id: request.invitation_id
          }
        });

        if (emailResponse.error) {
          console.error('Failed to send resent invitation email:', emailResponse.error);
          // Don't fail the entire operation if email fails, just log it
        } else {
          console.log('Resent invitation email sent successfully');
        }
      } catch (emailError) {
        console.error('Error sending resent invitation email:', emailError);
        // Don't fail the entire operation if email fails
      }

      // Trigger in-app notifications for team admins about resent invitation
      try {
        const { TeamCollaborationNotificationService } = await import('./teamCollaborationNotificationService');

        // Get current user info
        const { data: { user } } = await supabase.auth.getUser();
        if (user && data.email) {
          console.log('Sending in-app notification for resent team invitation...');
          await TeamCollaborationNotificationService.notifyTeamInvitationSent({
            teamId: data.team_id || '',
            actorUserId: user.id,
            actorName: user.user_metadata?.full_name || user.email || 'Unknown User',
            invitationEmail: data.email
          });
          console.log('In-app notification for resent invitation sent successfully');
        }
      } catch (notificationError) {
        console.error('Error sending in-app notifications for resent invitation:', notificationError);
        // Don't fail the entire operation if notifications fail
      }

      return {
        success: true,
        data: data,
        metadata: {
          operation: 'resend_invitation',
          invitation_id: request.invitation_id,
          attempts: data.attempts,
          expires_at: data.expires_at,
          team_name: data.team_name,
          email_triggered: true
        }
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

      // The function returns JSONB with success/error information
      if (!data.success) {
        return {
          success: false,
          error: data.error,
          error_code: data.error_code,
          metadata: { operation: 'cancel_invitation', invitation_id: invitationId }
        };
      }

      return {
        success: true,
        data: data,
        metadata: {
          operation: 'cancel_invitation',
          invitation_id: invitationId,
          cancelled_at: data.cancelled_at,
          cancelled_by: data.cancelled_by,
          cancellation_reason: data.cancellation_reason
        }
      };
    } catch (error: any) {
      this.handleError(error, 'cancelInvitation');
    }
  }

  async getTeamInvitations(request: GetTeamInvitationsRequest): Promise<ServiceResponse<EnhancedTeamInvitation[]>> {
    try {
      // Since get_team_invitations doesn't exist, use direct table query
      let query = supabase
        .from('team_invitations')
        .select(`
          id,
          team_id,
          email,
          role,
          invited_by,
          status,
          token,
          expires_at,
          accepted_at,
          created_at,
          updated_at
        `)
        .eq('team_id', request.team_id);

      // Apply status filter if provided
      if (request.status) {
        const statusFilter = Array.isArray(request.status) ? request.status[0] : request.status;
        query = query.eq('status', statusFilter);
      }

      // Apply expired filter
      if (!request.include_expired) {
        query = query.gt('expires_at', new Date().toISOString());
      }

      // Apply pagination
      if (request.limit) {
        query = query.limit(request.limit);
      }
      if (request.offset) {
        query = query.range(request.offset, (request.offset + (request.limit || 50)) - 1);
      }

      // Order by created_at descending
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        metadata: {
          operation: 'get_team_invitations',
          team_id: request.team_id,
          total: (data || []).length,
          filtered: (data || []).length,
          pagination_applied: !!(request.limit || request.offset)
        }
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

      // The function returns JSONB with success/error information
      if (!data.success) {
        return {
          success: false,
          error: data.error,
          error_code: data.error_code,
          metadata: { operation: 'get_invitation_stats', team_id: teamId }
        };
      }

      return {
        success: true,
        data: data.data || {},
        metadata: { operation: 'get_invitation_stats', team_id: teamId }
      };
    } catch (error: any) {
      this.handleError(error, 'getInvitationStats');
    }
  }

  async getInvitationAnalytics(teamId: string, dateRangeDays: number = 30): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('get_invitation_analytics', {
        _team_id: teamId,
        _date_range_days: dateRangeDays,
      });

      if (error) throw error;

      // The function returns JSONB with success/error information
      if (!data.success) {
        return {
          success: false,
          error: data.error,
          error_code: data.error_code,
          metadata: { operation: 'get_invitation_analytics', team_id: teamId }
        };
      }

      return {
        success: true,
        data: data.data || {},
        metadata: { operation: 'get_invitation_analytics', team_id: teamId, date_range_days: dateRangeDays }
      };
    } catch (error: any) {
      this.handleError(error, 'getInvitationAnalytics');
    }
  }

  async getInvitationActivityTimeline(teamId: string, limit: number = 50, offset: number = 0): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('get_invitation_activity_timeline', {
        _team_id: teamId,
        _limit: limit,
        _offset: offset,
      });

      if (error) throw error;

      // The function returns JSONB with success/error information
      if (!data.success) {
        return {
          success: false,
          error: data.error,
          error_code: data.error_code,
          metadata: { operation: 'get_invitation_activity_timeline', team_id: teamId }
        };
      }

      return {
        success: true,
        data: data.data || {},
        metadata: { operation: 'get_invitation_activity_timeline', team_id: teamId, limit, offset }
      };
    } catch (error: any) {
      this.handleError(error, 'getInvitationActivityTimeline');
    }
  }

  async trackInvitationDelivery(invitationId: string, deliveryStatus: string, providerMessageId?: string, errorMessage?: string): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('track_invitation_delivery', {
        _invitation_id: invitationId,
        _delivery_status: deliveryStatus,
        _provider_message_id: providerMessageId || null,
        _error_message: errorMessage || null,
      });

      if (error) throw error;

      // The function returns JSONB with success/error information
      if (!data.success) {
        return {
          success: false,
          error: data.error,
          error_code: data.error_code,
          metadata: { operation: 'track_invitation_delivery', invitation_id: invitationId }
        };
      }

      return {
        success: true,
        data: data,
        metadata: { operation: 'track_invitation_delivery', invitation_id: invitationId, delivery_status: deliveryStatus }
      };
    } catch (error: any) {
      this.handleError(error, 'trackInvitationDelivery');
    }
  }

  async trackInvitationEngagement(invitationToken: string, engagementType: string, metadata: Record<string, any> = {}): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('track_invitation_engagement', {
        _invitation_token: invitationToken,
        _engagement_type: engagementType,
        _metadata: metadata,
      });

      if (error) throw error;

      // The function returns JSONB with success/error information
      if (!data.success) {
        return {
          success: false,
          error: data.error,
          error_code: data.error_code,
          metadata: { operation: 'track_invitation_engagement', invitation_token: invitationToken }
        };
      }

      return {
        success: true,
        data: data,
        metadata: { operation: 'track_invitation_engagement', invitation_token: invitationToken, engagement_type: engagementType }
      };
    } catch (error: any) {
      this.handleError(error, 'trackInvitationEngagement');
    }
  }

  async acceptInvitation(token: string): Promise<ServiceResponse<any>> {
    try {
      // Use the existing accept_team_invitation function for backward compatibility
      const { data, error } = await supabase.rpc('accept_team_invitation', {
        _token: token,
      });

      if (error) throw error;

      return {
        success: true,
        data: this.validateResponse(data, 'accept_team_invitation'),
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
      // Since get_team_audit_logs doesn't exist, return empty audit logs for now
      // TODO: Implement audit logging system with proper database tables and functions

      const emptyResponse: PaginatedResponse<TeamAuditLog> = {
        data: [],
        total: 0,
        limit: request.limit || 50,
        offset: request.offset || 0,
        has_more: false,
      };

      return {
        success: true,
        data: emptyResponse,
        metadata: {
          operation: 'get_audit_logs',
          team_id: request.team_id,
          note: 'Audit logging system not yet implemented'
        }
      };
    } catch (error: any) {
      this.handleError(error, 'getAuditLogs');
    }
  }

  async searchAuditLogs(request: SearchAuditLogsRequest): Promise<ServiceResponse<TeamAuditLog[]>> {
    try {
      // Since search_audit_logs doesn't exist, return empty results for now
      // TODO: Implement audit log search functionality

      return {
        success: true,
        data: [],
        metadata: {
          operation: 'search_audit_logs',
          team_id: request.team_id,
          note: 'Audit log search not yet implemented'
        }
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
      // Since get_team_member_stats doesn't exist, build stats using basic queries

      // Get basic team member counts by role
      const { data: memberCounts, error: memberError } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId);

      if (memberError) throw memberError;

      // Count members by role
      const roleCounts = (memberCounts || []).reduce((acc, member) => {
        acc[member.role] = (acc[member.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get pending invitations count
      const { count: pendingInvitations, error: inviteError } = await supabase
        .from('team_invitations')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('status', 'pending');

      if (inviteError) throw inviteError;

      // Get basic receipt stats
      const { data: receiptStats, error: receiptError } = await supabase
        .from('receipts')
        .select('total, currency')
        .eq('team_id', teamId);

      if (receiptError) throw receiptError;

      // Calculate totals
      const totalReceipts = receiptStats?.length || 0;
      const totalAmount = receiptStats?.reduce((sum, receipt) => sum + (receipt.total || 0), 0) || 0;
      const currency = receiptStats?.[0]?.currency || 'MYR';

      // Build enhanced stats object
      const enhancedStats: EnhancedTeamStats = {
        // Basic TeamStats fields
        total_members: memberCounts?.length || 0,
        total_receipts: totalReceipts,
        total_amount: totalAmount,
        receipts_this_month: 0, // TODO: Implement monthly filtering
        amount_this_month: 0, // TODO: Implement monthly filtering
        top_categories: [], // TODO: Implement category analysis
        recent_activity: [], // TODO: Implement recent activity

        // Enhanced fields
        active_members: memberCounts?.length || 0, // All members considered active for now
        inactive_members: 0, // TODO: Implement inactive member tracking
        owners: roleCounts.owner || 0,
        admins: roleCounts.admin || 0,
        members: roleCounts.member || 0,
        viewers: roleCounts.viewer || 0,
        scheduled_removals: 0, // TODO: Implement scheduled removal tracking
        recent_joins: 0, // TODO: Implement recent joins tracking
        pending_invitations: pendingInvitations || 0,
        recent_activity_count: 0, // TODO: Implement activity counting
        security_events_count: 0, // TODO: Implement security event tracking
        bulk_operations_count: 0, // TODO: Implement bulk operations tracking
      };

      return {
        success: true,
        data: enhancedStats,
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
  // MEMBER ANALYTICS
  // ============================================================================

  async getMemberAnalytics(request: GetMemberAnalyticsRequest): Promise<ServiceResponse<MemberAnalytics>> {
    try {
      const { data, error } = await supabase.rpc('get_member_analytics', {
        _team_id: request.team_id,
        _user_id: request.user_id || null,
        _start_date: request.start_date || null,
        _end_date: request.end_date || null,
      });

      if (error) throw error;

      const response = this.validateResponse(data, 'get_member_analytics');

      return {
        success: true,
        data: response.data,
        metadata: {
          operation: 'get_member_analytics',
          team_id: request.team_id,
          user_id: request.user_id,
          analysis_period: response.data?.analysis_period
        }
      };
    } catch (error: any) {
      this.handleError(error, 'getMemberAnalytics');
    }
  }

  async getMemberActivityTimeline(request: GetMemberActivityTimelineRequest): Promise<ServiceResponse<MemberActivityTimeline>> {
    try {
      const { data, error } = await supabase.rpc('get_member_activity_timeline', {
        _team_id: request.team_id,
        _user_id: request.user_id || null,
        _limit: request.limit || 50,
        _offset: request.offset || 0,
        _activity_types: request.activity_types || null,
        _start_date: request.start_date || null,
        _end_date: request.end_date || null,
      });

      if (error) throw error;

      const response = this.validateResponse(data, 'get_member_activity_timeline');

      return {
        success: true,
        data: response.data,
        metadata: {
          operation: 'get_member_activity_timeline',
          team_id: request.team_id,
          user_id: request.user_id,
          pagination: response.data?.pagination
        }
      };
    } catch (error: any) {
      this.handleError(error, 'getMemberActivityTimeline');
    }
  }

  async getMemberPerformanceInsights(request: GetMemberPerformanceInsightsRequest): Promise<ServiceResponse<MemberPerformanceInsights>> {
    try {
      const { data, error } = await supabase.rpc('get_member_performance_insights', {
        _team_id: request.team_id,
        _user_id: request.user_id || null,
        _comparison_period_days: request.comparison_period_days || 30,
      });

      if (error) throw error;

      const response = this.validateResponse(data, 'get_member_performance_insights');

      return {
        success: true,
        data: response.data,
        metadata: {
          operation: 'get_member_performance_insights',
          team_id: request.team_id,
          user_id: request.user_id,
          comparison_period_days: request.comparison_period_days || 30
        }
      };
    } catch (error: any) {
      this.handleError(error, 'getMemberPerformanceInsights');
    }
  }

  async searchMembersAdvanced(request: SearchMembersAdvancedRequest): Promise<ServiceResponse<MemberSearchResults>> {
    try {
      const { data, error } = await supabase.rpc('search_members_advanced', {
        _team_id: request.team_id,
        _search_query: request.search_query || null,
        _role_filter: request.role_filter || null,
        _status_filter: request.status_filter || null,
        _activity_filter: request.activity_filter || null,
        _sort_by: request.sort_by || 'name',
        _sort_order: request.sort_order || 'asc',
        _limit: request.limit || 50,
        _offset: request.offset || 0,
      });

      if (error) throw error;

      const response = this.validateResponse(data, 'search_members_advanced');

      return {
        success: true,
        data: response.data,
        metadata: {
          operation: 'search_members_advanced',
          team_id: request.team_id,
          search_params: {
            search_query: request.search_query,
            role_filter: request.role_filter,
            status_filter: request.status_filter,
            activity_filter: request.activity_filter,
            sort_by: request.sort_by,
            sort_order: request.sort_order
          },
          pagination: response.data?.pagination
        }
      };
    } catch (error: any) {
      this.handleError(error, 'searchMembersAdvanced');
    }
  }

  async getTeamEngagementMetrics(request: GetTeamEngagementMetricsRequest): Promise<ServiceResponse<TeamEngagementMetrics>> {
    try {
      const { data, error } = await supabase.rpc('get_team_member_engagement_metrics', {
        _team_id: request.team_id,
        _period_days: request.period_days || 30,
      });

      if (error) throw error;

      const response = this.validateResponse(data, 'get_team_member_engagement_metrics');

      return {
        success: true,
        data: response.data,
        metadata: {
          operation: 'get_team_engagement_metrics',
          team_id: request.team_id,
          period_days: request.period_days || 30,
          team_health_score: response.data?.team_health_score
        }
      };
    } catch (error: any) {
      this.handleError(error, 'getTeamEngagementMetrics');
    }
  }

  // ============================================================================
  // SCHEDULED OPERATIONS
  // ============================================================================

  async scheduleMemberOperation(request: ScheduleMemberOperationRequest): Promise<ServiceResponse<ScheduledOperationResult>> {
    try {
      const { data, error } = await supabase.rpc('schedule_member_operation', {
        _team_id: request.team_id,
        _operation_type: request.operation_type,
        _operation_name: request.operation_name,
        _scheduled_for: request.scheduled_for,
        _operation_config: request.operation_config || {},
        _operation_description: request.operation_description || null,
        _max_retries: request.max_retries || 3,
        _depends_on: request.depends_on || [],
        _prerequisites: request.prerequisites || {},
        _metadata: request.metadata || {},
      });

      if (error) throw error;

      const response = this.validateResponse(data, 'schedule_member_operation');

      return {
        success: true,
        data: response.data,
        metadata: {
          operation: 'schedule_member_operation',
          team_id: request.team_id,
          operation_type: request.operation_type,
          scheduled_for: request.scheduled_for
        }
      };
    } catch (error: any) {
      this.handleError(error, 'scheduleMemberOperation');
    }
  }

  async getScheduledOperations(request: GetScheduledOperationsRequest): Promise<ServiceResponse<ScheduledOperationsResponse>> {
    try {
      const { data, error } = await supabase.rpc('get_scheduled_operations', {
        _team_id: request.team_id,
        _operation_types: request.operation_types || null,
        _status_filter: request.status_filter || null,
        _include_completed: request.include_completed || false,
        _limit: request.limit || 50,
        _offset: request.offset || 0,
      });

      if (error) throw error;

      const response = this.validateResponse(data, 'get_scheduled_operations');

      return {
        success: true,
        data: response.data,
        metadata: {
          operation: 'get_scheduled_operations',
          team_id: request.team_id,
          filters: {
            operation_types: request.operation_types,
            status_filter: request.status_filter,
            include_completed: request.include_completed
          },
          pagination: response.data?.pagination
        }
      };
    } catch (error: any) {
      this.handleError(error, 'getScheduledOperations');
    }
  }

  async cancelScheduledOperation(request: CancelScheduledOperationRequest): Promise<ServiceResponse<CancelOperationResult>> {
    try {
      const { data, error } = await supabase.rpc('cancel_scheduled_operation', {
        _operation_id: request.operation_id,
        _reason: request.reason || null,
      });

      if (error) throw error;

      const response = this.validateResponse(data, 'cancel_scheduled_operation');

      return {
        success: true,
        data: response.data,
        metadata: {
          operation: 'cancel_scheduled_operation',
          operation_id: request.operation_id,
          cancellation_reason: request.reason
        }
      };
    } catch (error: any) {
      this.handleError(error, 'cancelScheduledOperation');
    }
  }

  async rescheduleOperation(request: RescheduleOperationRequest): Promise<ServiceResponse<RescheduleOperationResult>> {
    try {
      const { data, error } = await supabase.rpc('reschedule_operation', {
        _operation_id: request.operation_id,
        _new_scheduled_for: request.new_scheduled_for,
        _reason: request.reason || null,
      });

      if (error) throw error;

      const response = this.validateResponse(data, 'reschedule_operation');

      return {
        success: true,
        data: response.data,
        metadata: {
          operation: 'reschedule_operation',
          operation_id: request.operation_id,
          new_scheduled_for: request.new_scheduled_for,
          reschedule_reason: request.reason
        }
      };
    } catch (error: any) {
      this.handleError(error, 'rescheduleOperation');
    }
  }

  async processScheduledOperations(): Promise<ServiceResponse<ProcessScheduledOperationsResult>> {
    try {
      // Note: This function is typically called by system/cron jobs with service_role
      // For client-side usage, this would need special permissions or a different approach
      const { data, error } = await supabase.rpc('process_scheduled_operations');

      if (error) throw error;

      const response = this.validateResponse(data, 'process_scheduled_operations');

      return {
        success: true,
        data: response,
        metadata: {
          operation: 'process_scheduled_operations',
          processed_at: new Date().toISOString()
        }
      };
    } catch (error: any) {
      this.handleError(error, 'processScheduledOperations');
    }
  }

  // ============================================================================
  // SCHEDULED OPERATIONS CONVENIENCE METHODS
  // ============================================================================

  async scheduleMemberRemovalEnhanced(
    teamId: string,
    userId: string,
    scheduledFor: string,
    options: {
      reason?: string;
      transferData?: boolean;
      transferToUserId?: string;
      description?: string;
    } = {}
  ): Promise<ServiceResponse<ScheduledOperationResult>> {
    try {
      return await this.scheduleMemberOperation({
        team_id: teamId,
        operation_type: 'member_removal',
        operation_name: `Remove member ${userId}`,
        scheduled_for: scheduledFor,
        operation_config: {
          user_id: userId,
          reason: options.reason,
          transfer_data: options.transferData || false,
          transfer_to_user_id: options.transferToUserId || null,
        },
        operation_description: options.description || `Scheduled removal of team member`,
        metadata: {
          scheduled_by: 'enhanced_service',
          operation_category: 'member_management'
        }
      });
    } catch (error: any) {
      this.handleError(error, 'scheduleMemberRemovalEnhanced');
    }
  }

  async scheduleRoleChange(
    teamId: string,
    userId: string,
    newRole: TeamMemberRole,
    scheduledFor: string,
    options: {
      reason?: string;
      description?: string;
    } = {}
  ): Promise<ServiceResponse<ScheduledOperationResult>> {
    try {
      return await this.scheduleMemberOperation({
        team_id: teamId,
        operation_type: 'role_change',
        operation_name: `Change role for ${userId} to ${newRole}`,
        scheduled_for: scheduledFor,
        operation_config: {
          user_id: userId,
          new_role: newRole,
          reason: options.reason,
        },
        operation_description: options.description || `Scheduled role change to ${newRole}`,
        metadata: {
          scheduled_by: 'enhanced_service',
          operation_category: 'member_management',
          target_role: newRole
        }
      });
    } catch (error: any) {
      this.handleError(error, 'scheduleRoleChange');
    }
  }

  async schedulePermissionUpdate(
    teamId: string,
    userId: string,
    newPermissions: Record<string, any>,
    scheduledFor: string,
    options: {
      reason?: string;
      description?: string;
    } = {}
  ): Promise<ServiceResponse<ScheduledOperationResult>> {
    try {
      return await this.scheduleMemberOperation({
        team_id: teamId,
        operation_type: 'permission_update',
        operation_name: `Update permissions for ${userId}`,
        scheduled_for: scheduledFor,
        operation_config: {
          user_id: userId,
          new_permissions: newPermissions,
          reason: options.reason,
        },
        operation_description: options.description || `Scheduled permission update`,
        metadata: {
          scheduled_by: 'enhanced_service',
          operation_category: 'member_management'
        }
      });
    } catch (error: any) {
      this.handleError(error, 'schedulePermissionUpdate');
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
