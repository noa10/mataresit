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
    const { data, error } = await supabase.rpc('invite_team_member', {
      _team_id: request.team_id,
      _email: request.email,
      _role: request.role,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
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
      const { data, error } = await supabase
        .from('team_invitations')
        .select(`
          *,
          teams!inner(name),
          invited_by_user:auth.users!team_invitations_invited_by_fkey(
            email,
            profiles(first_name, last_name)
          )
        `)
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) {
        // If it's a foreign key constraint error or similar, try a simpler query
        if (error.code === 'PGRST301' || error.message.includes('foreign key')) {
          return await this.getTeamInvitationsSimple(teamId);
        }
        throw new Error(error.message);
      }

      return data?.map(invitation => ({
        ...invitation,
        team_name: invitation.teams?.name,
        invited_by_name: invitation.invited_by_user?.profiles?.first_name
          ? `${invitation.invited_by_user.profiles.first_name} ${invitation.invited_by_user.profiles.last_name || ''}`.trim()
          : invitation.invited_by_user?.email,
      })) || [];
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
    const { data, error } = await supabase
      .from('team_invitations')
      .select(`
        *,
        teams!inner(name),
        invited_by_user:auth.users!team_invitations_invited_by_fkey(
          email,
          profiles(first_name, last_name)
        )
      `)
      .eq('token', token)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Invitation not found
      }
      throw new Error(error.message);
    }

    return {
      ...data,
      team_name: data.teams?.name,
      invited_by_name: data.invited_by_user?.profiles?.first_name
        ? `${data.invited_by_user.profiles.first_name} ${data.invited_by_user.profiles.last_name || ''}`.trim()
        : data.invited_by_user?.email,
    };
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
