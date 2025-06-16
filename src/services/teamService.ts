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
} from '@/types/team';

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
    // First try to get pending invitation
    let { data, error } = await supabase
      .from('team_invitations')
      .select(`
        *,
        teams!team_invitations_team_id_fkey(name)
      `)
      .eq('token', token)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single();

    // If no pending invitation found, check if it exists with any status
    if (error && error.code === 'PGRST116') {
      const { data: anyStatusData, error: anyStatusError } = await supabase
        .from('team_invitations')
        .select(`
          *,
          teams!team_invitations_team_id_fkey(name)
        `)
        .eq('token', token)
        .single();

      if (anyStatusData) {
        // Invitation exists but is not pending - throw specific error
        if (anyStatusData.status === 'accepted') {
          throw new Error('This invitation has already been accepted');
        } else if (anyStatusData.status === 'declined') {
          throw new Error('This invitation has been declined');
        } else if (anyStatusData.expires_at <= new Date().toISOString()) {
          throw new Error('This invitation has expired');
        }
      }
      return null; // Invitation not found
    }

    if (error) {
      throw new Error(error.message);
    }

    // Get inviter details separately
    try {
      const { data: inviterData } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', data.invited_by)
        .single();

      return {
        ...data,
        team_name: data.teams?.name,
        invited_by_name: inviterData?.first_name
          ? `${inviterData.first_name} ${inviterData.last_name || ''}`.trim()
          : inviterData?.email || 'Unknown',
      };
    } catch (profileError) {
      // If profile lookup fails, return basic invitation data
      return {
        ...data,
        team_name: data.teams?.name,
        invited_by_name: 'Unknown',
      };
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
}

export const teamService = new TeamService();
