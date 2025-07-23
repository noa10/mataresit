import { supabase } from '@/integrations/supabase/client';
import {
  Team,
  TeamMember,
  TeamInvitation,
  UserTeam,
  CreateTeamRequest,
  InviteTeamMemberRequest,
  UpdateTeamMemberRoleRequest,
  TeamStats,
  TeamMemberRole,
  ServiceResponse,
  TeamServiceException,
} from '@/types/team';
import { enhancedTeamService } from './enhancedTeamService';

export class TeamService {
  // =============================================
  // TEAM MANAGEMENT
  // =============================================

  async createTeam(request: CreateTeamRequest): Promise<string> {
    const { data, error } = await supabase.rpc('create_team', {
      _name: request.name,
      _description: request.description || null,
      _slug: request.slug || null,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async getUserTeams(): Promise<UserTeam[]> {
    const { data, error } = await supabase.rpc('get_user_teams');

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  }

  async getTeam(teamId: string): Promise<Team | null> {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Team not found
      }
      throw new Error(error.message);
    }

    return data;
  }

  async updateTeam(teamId: string, updates: Partial<Team>): Promise<void> {
    const { error } = await supabase
      .from('teams')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', teamId);

    if (error) {
      throw new Error(error.message);
    }
  }

  async deleteTeam(teamId: string): Promise<void> {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (error) {
      throw new Error(error.message);
    }
  }

  // =============================================
  // MEMBER MANAGEMENT
  // =============================================

  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    const { data, error } = await supabase.rpc('get_team_members', {
      _team_id: teamId,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  }

  async inviteTeamMember(request: InviteTeamMemberRequest): Promise<string> {
    const { data: invitationId, error } = await supabase.rpc('invite_team_member', {
      _team_id: request.team_id,
      _email: request.email,
      _role: request.role,
    });

    if (error) {
      console.error('Error creating team invitation:', error);
      throw new Error(error.message);
    }

    // Manually trigger the email sending since the database trigger might not work reliably
    try {
      const { error: emailError } = await supabase.functions.invoke('send-team-invitation-email', {
        body: { invitation_id: invitationId }
      });

      if (emailError) {
        console.error('Error sending invitation email:', emailError);
        // Don't throw here - the invitation was created successfully, email is secondary
      }
    } catch (emailError) {
      console.error('Failed to trigger invitation email:', emailError);
      // Don't throw here - the invitation was created successfully
    }

    return invitationId;
  }

  async acceptInvitation(token: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('accept_team_invitation', {
      _token: token,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    const { data, error } = await supabase.rpc('remove_team_member', {
      _team_id: teamId,
      _user_id: userId,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  async updateTeamMemberRole(request: UpdateTeamMemberRoleRequest): Promise<void> {
    const { data, error } = await supabase.rpc('update_team_member_role', {
      _team_id: request.team_id,
      _user_id: request.user_id,
      _new_role: request.role,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  // =============================================
  // INVITATION MANAGEMENT
  // =============================================

  async getTeamInvitations(teamId: string): Promise<TeamInvitation[]> {
    try {
      // Use a simpler query approach that doesn't rely on complex foreign key references
      const { data, error } = await supabase
        .from('team_invitations')
        .select(`
          *,
          teams!team_invitations_team_id_fkey(name)
        `)
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Team invitations query failed, falling back to simple query:', error.message);
        return await this.getTeamInvitationsSimple(teamId);
      }

      // Get inviter details separately to avoid complex join issues
      const invitationsWithInviterInfo = await Promise.all(
        (data || []).map(async (invitation) => {
          try {
            // Get inviter profile information
            const { data: inviterData } = await supabase
              .from('profiles')
              .select('first_name, last_name, email')
              .eq('id', invitation.invited_by)
              .single();

            return {
              ...invitation,
              team_name: invitation.teams?.name,
              invited_by_name: inviterData?.first_name
                ? `${inviterData.first_name} ${inviterData.last_name || ''}`.trim()
                : inviterData?.email || 'Unknown',
            };
          } catch (profileError) {
            // If profile lookup fails, just return basic invitation data
            return {
              ...invitation,
              team_name: invitation.teams?.name,
              invited_by_name: 'Unknown',
            };
          }
        })
      );

      return invitationsWithInviterInfo;
    } catch (error: any) {
      // Fallback to simple query if complex query fails
      console.warn('Complex invitation query failed, falling back to simple query:', error.message);
      return await this.getTeamInvitationsSimple(teamId);
    }
  }

  private async getTeamInvitationsSimple(teamId: string): Promise<TeamInvitation[]> {
    const { data, error } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    // Return basic invitation data without complex joins
    return data?.map(invitation => ({
      ...invitation,
      team_name: undefined, // Will be populated by the UI if needed
      invited_by_name: undefined, // Will be populated by the UI if needed
    })) || [];
  }

  async cancelInvitation(invitationId: string): Promise<void> {
    const { error } = await supabase
      .from('team_invitations')
      .delete()
      .eq('id', invitationId);

    if (error) {
      throw new Error(error.message);
    }
  }

  async getInvitationByToken(token: string): Promise<TeamInvitation | null> {
    try {
      // Use RPC function to bypass TypeScript type issues
      const { data: pendingData, error: pendingError } = await (supabase as any).rpc('get_invitation_by_token', {
        _token: token,
        _pending_only: true
      });

      if (!pendingError && pendingData) {
        return pendingData as TeamInvitation;
      }

      // If no pending invitation found, check if it exists with any status
      if (pendingError?.code === 'PGRST116' || !pendingData) {
        const { data: anyStatusData, error: anyStatusError } = await (supabase as any).rpc('get_invitation_by_token', {
          _token: token,
          _pending_only: false
        });

        if (anyStatusData) {
          const invitation = anyStatusData as any;
          // Invitation exists but is not pending - throw specific error
          if (invitation.status === 'accepted') {
            throw new Error('This invitation has already been accepted');
          } else if (invitation.status === 'declined') {
            throw new Error('This invitation has been declined');
          } else if (invitation.expires_at <= new Date().toISOString()) {
            throw new Error('This invitation has expired');
          }
        }
        return null; // Invitation not found
      }

      if (pendingError) {
        throw new Error(pendingError.message);
      }

      return pendingData as TeamInvitation;
    } catch (error: any) {
      console.error('Error getting invitation by token:', error);
      throw new Error(`Failed to get invitation: ${error.message}`);
    }
  }

  // =============================================
  // TEAM STATISTICS
  // =============================================

  async getTeamStats(teamId: string): Promise<TeamStats> {
    // Get basic team stats
    const [membersResult, receiptsResult] = await Promise.all([
      supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId),
      supabase
        .from('receipts')
        .select('id, total, date, predicted_category')
        .eq('team_id', teamId),
    ]);

    if (membersResult.error) {
      throw new Error(membersResult.error.message);
    }

    if (receiptsResult.error) {
      throw new Error(receiptsResult.error.message);
    }

    const members = membersResult.data || [];
    const receipts = receiptsResult.data || [];

    // Calculate statistics
    const totalAmount = receipts.reduce((sum, receipt) => sum + Number(receipt.total), 0);
    
    const currentMonth = new Date();
    currentMonth.setDate(1);
    const receiptsThisMonth = receipts.filter(
      receipt => new Date(receipt.date) >= currentMonth
    );
    const amountThisMonth = receiptsThisMonth.reduce(
      (sum, receipt) => sum + Number(receipt.total), 0
    );

    // Calculate top categories
    const categoryStats = receipts.reduce((acc, receipt) => {
      const category = receipt.predicted_category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = { count: 0, amount: 0 };
      }
      acc[category].count++;
      acc[category].amount += Number(receipt.total);
      return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    const topCategories = Object.entries(categoryStats)
      .map(([category, stats]) => ({ category, ...stats }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // TODO: Implement recent activity tracking
    const recentActivity: TeamStats['recent_activity'] = [];

    return {
      total_members: members.length,
      total_receipts: receipts.length,
      total_amount: totalAmount,
      receipts_this_month: receiptsThisMonth.length,
      amount_this_month: amountThisMonth,
      top_categories: topCategories,
      recent_activity: recentActivity,
    };
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  async checkTeamMembership(teamId: string, userId?: string): Promise<TeamMemberRole | null> {
    const { data, error } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId || (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (error || !data) {
      return null;
    }

    return data.role;
  }

  async isTeamSlugAvailable(slug: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('teams')
      .select('id')
      .eq('slug', slug)
      .single();

    // If no data found, slug is available
    return error?.code === 'PGRST116';
  }

  // =============================================
  // ENHANCED MEMBER MANAGEMENT
  // =============================================

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
      const response = await enhancedTeamService.removeMemberEnhanced(teamId, userId, options);

      if (!response.success) {
        throw new TeamServiceException(
          response.error_code as any || 'MEMBER_REMOVAL_FAILED',
          response.error || 'Failed to remove member'
        );
      }

      return response;
    } catch (error: any) {
      if (error instanceof TeamServiceException) {
        throw error;
      }
      throw new TeamServiceException('MEMBER_REMOVAL_FAILED', error.message);
    }
  }

  async updateMemberRoleEnhanced(
    teamId: string,
    userId: string,
    newRole: TeamMemberRole,
    reason?: string
  ): Promise<ServiceResponse<any>> {
    try {
      const response = await enhancedTeamService.updateMemberRoleEnhanced(teamId, userId, newRole, reason);

      if (!response.success) {
        throw new TeamServiceException(
          response.error_code as any || 'ROLE_UPDATE_FAILED',
          response.error || 'Failed to update member role'
        );
      }

      return response;
    } catch (error: any) {
      if (error instanceof TeamServiceException) {
        throw error;
      }
      throw new TeamServiceException('ROLE_UPDATE_FAILED', error.message);
    }
  }

  async scheduleMemberRemoval(
    teamId: string,
    userId: string,
    options: {
      scheduledDate?: string;
      reason?: string;
      transferData?: boolean;
      transferToUserId?: string;
    } = {}
  ): Promise<ServiceResponse<any>> {
    try {
      const response = await enhancedTeamService.scheduleMemberRemoval(teamId, userId, options);

      if (!response.success) {
        throw new TeamServiceException(
          response.error_code as any || 'SCHEDULE_REMOVAL_FAILED',
          response.error || 'Failed to schedule member removal'
        );
      }

      return response;
    } catch (error: any) {
      if (error instanceof TeamServiceException) {
        throw error;
      }
      throw new TeamServiceException('SCHEDULE_REMOVAL_FAILED', error.message);
    }
  }

  async cancelScheduledRemoval(
    teamId: string,
    userId: string,
    reason?: string
  ): Promise<ServiceResponse<any>> {
    try {
      const response = await enhancedTeamService.cancelScheduledRemoval(teamId, userId, reason);

      if (!response.success) {
        throw new TeamServiceException(
          response.error_code as any || 'CANCEL_REMOVAL_FAILED',
          response.error || 'Failed to cancel scheduled removal'
        );
      }

      return response;
    } catch (error: any) {
      if (error instanceof TeamServiceException) {
        throw error;
      }
      throw new TeamServiceException('CANCEL_REMOVAL_FAILED', error.message);
    }
  }

  async transferOwnership(
    teamId: string,
    newOwnerId: string,
    reason?: string
  ): Promise<ServiceResponse<any>> {
    try {
      const response = await enhancedTeamService.transferOwnership(teamId, newOwnerId, reason);

      if (!response.success) {
        throw new TeamServiceException(
          response.error_code as any || 'OWNERSHIP_TRANSFER_FAILED',
          response.error || 'Failed to transfer ownership'
        );
      }

      return response;
    } catch (error: any) {
      if (error instanceof TeamServiceException) {
        throw error;
      }
      throw new TeamServiceException('OWNERSHIP_TRANSFER_FAILED', error.message);
    }
  }

  // =============================================
  // ENHANCED INVITATION MANAGEMENT
  // =============================================

  /**
   * Enhanced team member invitation with security and rate limiting
   */
  async inviteTeamMemberEnhanced(
    teamId: string,
    email: string,
    role: TeamMemberRole = 'member',
    customMessage?: string,
    options: {
      permissions?: Record<string, any>;
      expiresInDays?: number;
      sendEmail?: boolean;
    } = {}
  ): Promise<string> {
    try {
      const response = await enhancedTeamService.sendInvitationEnhanced({
        team_id: teamId,
        email,
        role,
        custom_message: customMessage,
        permissions: options.permissions,
        expires_in_days: options.expiresInDays,
        send_email: options.sendEmail,
      });

      if (!response.success) {
        throw new TeamServiceException(
          response.error_code as any || 'INVITATION_FAILED',
          response.error || 'Failed to send invitation'
        );
      }

      return response.data;
    } catch (error: any) {
      if (error instanceof TeamServiceException) {
        throw error;
      }
      throw new TeamServiceException('INVITATION_FAILED', error.message);
    }
  }

  // =============================================
  // ENHANCED INVITATION MANAGEMENT
  // =============================================

  async resendInvitationEnhanced(
    invitationId: string,
    options: {
      customMessage?: string;
      expiresInDays?: number;
      sendEmail?: boolean;
    } = {}
  ): Promise<ServiceResponse<any>> {
    try {
      const response = await enhancedTeamService.resendInvitation({
        invitation_id: invitationId,
        custom_message: options.customMessage,
        expires_in_days: options.expiresInDays,
        send_email: options.sendEmail,
      });

      if (!response.success) {
        throw new TeamServiceException(
          response.error_code as any || 'RESEND_INVITATION_FAILED',
          response.error || 'Failed to resend invitation'
        );
      }

      return response;
    } catch (error: any) {
      if (error instanceof TeamServiceException) {
        throw error;
      }
      throw new TeamServiceException('RESEND_INVITATION_FAILED', error.message);
    }
  }

  async cancelInvitationEnhanced(
    invitationId: string,
    reason?: string
  ): Promise<ServiceResponse<any>> {
    try {
      const response = await enhancedTeamService.cancelInvitation({
        invitation_id: invitationId,
        reason,
      });

      if (!response.success) {
        throw new TeamServiceException(
          response.error_code as any || 'CANCEL_INVITATION_FAILED',
          response.error || 'Failed to cancel invitation'
        );
      }

      return response;
    } catch (error: any) {
      if (error instanceof TeamServiceException) {
        throw error;
      }
      throw new TeamServiceException('CANCEL_INVITATION_FAILED', error.message);
    }
  }

  async getTeamInvitationsEnhanced(
    teamId: string,
    options: {
      status?: string;
      includeExpired?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<ServiceResponse<any>> {
    try {
      const response = await enhancedTeamService.getTeamInvitations({
        team_id: teamId,
        status: options.status,
        include_expired: options.includeExpired,
        limit: options.limit,
        offset: options.offset,
      });

      if (!response.success) {
        throw new TeamServiceException(
          response.error_code as any || 'GET_INVITATIONS_FAILED',
          response.error || 'Failed to get team invitations'
        );
      }

      return response;
    } catch (error: any) {
      if (error instanceof TeamServiceException) {
        throw error;
      }
      throw new TeamServiceException('GET_INVITATIONS_FAILED', error.message);
    }
  }

  // =============================================
  // BULK OPERATIONS
  // =============================================

  async bulkUpdateRolesEnhanced(
    teamId: string,
    roleUpdates: Array<{
      user_id: string;
      new_role: TeamMemberRole;
      reason?: string;
    }>,
    reason?: string
  ): Promise<ServiceResponse<any>> {
    try {
      const response = await enhancedTeamService.bulkUpdateRoles(teamId, roleUpdates, { reason });

      if (!response.success) {
        throw new TeamServiceException(
          response.error_code as any || 'BULK_ROLE_UPDATE_FAILED',
          response.error || 'Failed to update member roles'
        );
      }

      return response;
    } catch (error: any) {
      if (error instanceof TeamServiceException) {
        throw error;
      }
      throw new TeamServiceException('BULK_ROLE_UPDATE_FAILED', error.message);
    }
  }

  async bulkInviteMembersEnhanced(
    teamId: string,
    invitations: Array<{
      email: string;
      role?: TeamMemberRole;
      custom_message?: string;
      permissions?: Record<string, any>;
    }>,
    options: {
      defaultRole?: TeamMemberRole;
      expiresInDays?: number;
      sendEmails?: boolean;
    } = {}
  ): Promise<ServiceResponse<any>> {
    try {
      const response = await enhancedTeamService.bulkInviteMembers(teamId, invitations, options);

      if (!response.success) {
        throw new TeamServiceException(
          response.error_code as any || 'BULK_INVITE_FAILED',
          response.error || 'Failed to send bulk invitations'
        );
      }

      return response;
    } catch (error: any) {
      if (error instanceof TeamServiceException) {
        throw error;
      }
      throw new TeamServiceException('BULK_INVITE_FAILED', error.message);
    }
  }

  async bulkRemoveMembersEnhanced(
    teamId: string,
    userIds: string[],
    options: {
      reason?: string;
      transferData?: boolean;
      transferToUserId?: string;
    } = {}
  ): Promise<ServiceResponse<any>> {
    try {
      const response = await enhancedTeamService.bulkRemoveMembers(teamId, userIds, options);

      if (!response.success) {
        throw new TeamServiceException(
          response.error_code as any || 'BULK_REMOVAL_FAILED',
          response.error || 'Failed to remove members'
        );
      }

      return response;
    } catch (error: any) {
      if (error instanceof TeamServiceException) {
        throw error;
      }
      throw new TeamServiceException('BULK_REMOVAL_FAILED', error.message);
    }
  }

  // =============================================
  // AUDIT TRAIL MANAGEMENT
  // =============================================

  async getAuditLogsEnhanced(
    teamId: string,
    options: {
      actions?: string[];
      userId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<ServiceResponse<any>> {
    try {
      const response = await enhancedTeamService.getAuditLogs({
        team_id: teamId,
        ...options,
      });

      if (!response.success) {
        throw new TeamServiceException(
          response.error_code as any || 'AUDIT_LOGS_FAILED',
          response.error || 'Failed to get audit logs'
        );
      }

      return response;
    } catch (error: any) {
      if (error instanceof TeamServiceException) {
        throw error;
      }
      throw new TeamServiceException('AUDIT_LOGS_FAILED', error.message);
    }
  }

  async searchAuditLogsEnhanced(
    teamId: string,
    searchParams: {
      textSearch?: string;
      actions?: string[];
      userId?: string;
      limit?: number;
    }
  ): Promise<ServiceResponse<any>> {
    try {
      const response = await enhancedTeamService.searchAuditLogs({
        team_id: teamId,
        ...searchParams,
      });

      if (!response.success) {
        throw new TeamServiceException(
          response.error_code as any || 'AUDIT_SEARCH_FAILED',
          response.error || 'Failed to search audit logs'
        );
      }

      return response;
    } catch (error: any) {
      if (error instanceof TeamServiceException) {
        throw error;
      }
      throw new TeamServiceException('AUDIT_SEARCH_FAILED', error.message);
    }
  }

  async exportAuditLogsEnhanced(
    teamId: string,
    options: {
      startDate: string;
      endDate: string;
      format?: 'json' | 'csv';
    }
  ): Promise<ServiceResponse<any>> {
    try {
      const response = await enhancedTeamService.exportAuditLogs({
        team_id: teamId,
        ...options,
      });

      if (!response.success) {
        throw new TeamServiceException(
          response.error_code as any || 'AUDIT_EXPORT_FAILED',
          response.error || 'Failed to export audit logs'
        );
      }

      return response;
    } catch (error: any) {
      if (error instanceof TeamServiceException) {
        throw error;
      }
      throw new TeamServiceException('AUDIT_EXPORT_FAILED', error.message);
    }
  }

  // =============================================
  // ENHANCED STATISTICS AND SECURITY
  // =============================================

  async getEnhancedTeamStats(teamId: string): Promise<ServiceResponse<any>> {
    try {
      const response = await enhancedTeamService.getEnhancedTeamStats(teamId);

      if (!response.success) {
        throw new TeamServiceException(
          response.error_code as any || 'STATS_FAILED',
          response.error || 'Failed to get team statistics'
        );
      }

      return response;
    } catch (error: any) {
      if (error instanceof TeamServiceException) {
        throw error;
      }
      throw new TeamServiceException('STATS_FAILED', error.message);
    }
  }

  async getSecurityDashboard(teamId: string, days: number = 7): Promise<ServiceResponse<any>> {
    try {
      const response = await enhancedTeamService.getSecurityDashboard(teamId, days);

      if (!response.success) {
        throw new TeamServiceException(
          response.error_code as any || 'SECURITY_DASHBOARD_FAILED',
          response.error || 'Failed to get security dashboard'
        );
      }

      return response;
    } catch (error: any) {
      if (error instanceof TeamServiceException) {
        throw error;
      }
      throw new TeamServiceException('SECURITY_DASHBOARD_FAILED', error.message);
    }
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  async validateTeamAccess(teamId: string, requiredPermission?: string): Promise<boolean> {
    try {
      const response = await enhancedTeamService.validateTeamAccess(teamId, requiredPermission);
      return response.success && response.data;
    } catch (error: any) {
      console.error('Team access validation failed:', error);
      return false;
    }
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      const response = await enhancedTeamService.healthCheck();

      if (!response.success) {
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
        };
      }

      return response.data;
    } catch (error: any) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get enhanced team service instance for advanced operations
   */
  getEnhancedService() {
    return enhancedTeamService;
  }
}

export const teamService = new TeamService();
