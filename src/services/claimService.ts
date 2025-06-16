import { supabase } from '@/integrations/supabase/client';
import {
  Claim,
  ClaimAuditTrail,
  CreateClaimRequest,
  UpdateClaimRequest,
  ClaimApprovalRequest,
  ClaimRejectionRequest,
  ClaimFilters,
  ClaimStats,
  ClaimStatus,
} from '@/types/claims';

export class ClaimService {
  // =============================================
  // CLAIM MANAGEMENT
  // =============================================

  async createClaim(request: CreateClaimRequest): Promise<string> {
    const { data, error } = await supabase.rpc('create_claim', {
      _team_id: request.team_id,
      _title: request.title,
      _description: request.description || null,
      _amount: request.amount,
      _currency: request.currency || 'USD',
      _category: request.category || null,
      _priority: request.priority || 'medium',
      _attachments: JSON.stringify(request.attachments || []),
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async getTeamClaims(
    teamId: string,
    filters?: ClaimFilters,
    limit: number = 20,
    offset: number = 0
  ): Promise<Claim[]> {
    const { data, error } = await supabase.rpc('get_team_claims', {
      _team_id: teamId,
      _status: filters?.status || null,
      _limit: limit,
      _offset: offset,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  }

  async getClaim(claimId: string): Promise<Claim | null> {
    // First get the basic claim data
    const { data, error } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claimId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    // Get user information for claimant, reviewer, and approver
    const userIds = [data.claimant_id, data.reviewed_by, data.approved_by].filter(Boolean);
    let userMap = new Map();

    if (userIds.length > 0) {
      try {
        const { data: userData, error: userError } = await supabase.rpc('get_users_by_ids', {
          user_ids: userIds
        });

        if (!userError && userData) {
          userMap = new Map(userData.map((user: any) => [user.id, user]));
        }
      } catch (userError) {
        console.warn('Failed to fetch user data for claim:', userError);
        // Continue without user names
      }
    }

    // Transform the data to match our Claim interface
    const claimant = userMap.get(data.claimant_id);
    const reviewer = userMap.get(data.reviewed_by);
    const approver = userMap.get(data.approved_by);

    const claim: Claim = {
      ...data,
      claimant_name: claimant?.first_name
        ? `${claimant.first_name} ${claimant.last_name || ''}`.trim()
        : claimant?.email || 'Unknown User',
      claimant_email: claimant?.email,
      reviewer_name: reviewer?.first_name
        ? `${reviewer.first_name} ${reviewer.last_name || ''}`.trim()
        : reviewer?.email,
      approver_name: approver?.first_name
        ? `${approver.first_name} ${approver.last_name || ''}`.trim()
        : approver?.email,
    };

    return claim;
  }

  async updateClaim(claimId: string, request: UpdateClaimRequest): Promise<void> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (request.title !== undefined) updateData.title = request.title;
    if (request.description !== undefined) updateData.description = request.description;
    if (request.amount !== undefined) updateData.amount = request.amount;
    if (request.currency !== undefined) updateData.currency = request.currency;
    if (request.category !== undefined) updateData.category = request.category;
    if (request.priority !== undefined) updateData.priority = request.priority;
    if (request.attachments !== undefined) updateData.attachments = request.attachments;

    const { error } = await supabase
      .from('claims')
      .update(updateData)
      .eq('id', claimId);

    if (error) {
      throw new Error(error.message);
    }
  }

  async submitClaim(claimId: string): Promise<void> {
    const { data, error } = await supabase.rpc('submit_claim', {
      _claim_id: claimId,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  async approveClaim(request: ClaimApprovalRequest): Promise<void> {
    const { data, error } = await supabase.rpc('approve_claim', {
      _claim_id: request.claim_id,
      _comment: request.comment || null,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  async rejectClaim(request: ClaimRejectionRequest): Promise<void> {
    const { data, error } = await supabase.rpc('reject_claim', {
      _claim_id: request.claim_id,
      _rejection_reason: request.rejection_reason,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  async deleteClaim(claimId: string): Promise<void> {
    const { error } = await supabase
      .from('claims')
      .delete()
      .eq('id', claimId);

    if (error) {
      throw new Error(error.message);
    }
  }

  // =============================================
  // CLAIM AUDIT TRAIL
  // =============================================

  async getClaimAuditTrail(claimId: string): Promise<ClaimAuditTrail[]> {
    try {
      // Get audit trail data with user information using RPC function
      const { data: auditData, error: auditError } = await supabase
        .from('claim_audit_trail')
        .select('*')
        .eq('claim_id', claimId)
        .order('created_at', { ascending: false });

      if (auditError) {
        console.error('Error fetching claim audit trail:', auditError);
        throw new Error(auditError.message);
      }

      if (!auditData || auditData.length === 0) {
        return [];
      }

      // Get unique user IDs from the audit trail
      const userIds = [...new Set(auditData.map(item => item.user_id))].filter(Boolean);

      if (userIds.length === 0) {
        return auditData.map(item => ({
          ...item,
          user_name: 'Unknown User',
          user_email: null,
        }));
      }

      // Get user information using our RPC function
      const { data: userData, error: userError } = await supabase.rpc('get_users_by_ids', {
        user_ids: userIds
      });

      if (userError) {
        console.error('Error fetching user data:', userError);
        // Return audit data without user names as fallback
        return auditData.map(item => ({
          ...item,
          user_name: 'Unknown User',
          user_email: null,
        }));
      }

      // Create a map of user data for quick lookup
      const userMap = new Map(
        (userData || []).map((user: any) => [user.id, user])
      );

      // Combine audit trail data with user information
      return auditData.map(item => {
        const user = userMap.get(item.user_id);
        const userName = user?.first_name
          ? `${user.first_name} ${user.last_name || ''}`.trim()
          : user?.email || 'Unknown User';

        return {
          ...item,
          user_name: userName,
          user_email: user?.email,
        };
      });
    } catch (error) {
      console.error('Error in getClaimAuditTrail:', error);
      throw new Error('Failed to load claim history');
    }
  }

  // =============================================
  // CLAIM STATISTICS
  // =============================================

  async getTeamClaimStats(teamId: string): Promise<ClaimStats> {
    const { data, error } = await supabase
      .from('claims')
      .select('status, amount')
      .eq('team_id', teamId);

    if (error) {
      throw new Error(error.message);
    }

    const claims = data || [];
    const stats: ClaimStats = {
      total_claims: claims.length,
      pending_claims: claims.filter(c => ['submitted', 'under_review'].includes(c.status)).length,
      approved_claims: claims.filter(c => c.status === 'approved').length,
      rejected_claims: claims.filter(c => c.status === 'rejected').length,
      total_amount: claims.reduce((sum, c) => sum + (c.amount || 0), 0),
      approved_amount: claims
        .filter(c => c.status === 'approved')
        .reduce((sum, c) => sum + (c.amount || 0), 0),
    };

    return stats;
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  async canUserPerformAction(
    claimId: string,
    action: 'view' | 'edit' | 'submit' | 'approve' | 'reject' | 'delete'
  ): Promise<boolean> {
    try {
      const claim = await this.getClaim(claimId);
      if (!claim) return false;

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return false;

      // Get user's role in the team
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', claim.team_id)
        .eq('user_id', user.user.id)
        .single();

      if (!teamMember) return false;

      const userRole = teamMember.role;
      const isOwner = claim.claimant_id === user.user.id;

      switch (action) {
        case 'view':
          return ['owner', 'admin', 'member', 'viewer'].includes(userRole);
        case 'edit':
          return isOwner && claim.status === 'draft';
        case 'submit':
          return isOwner && claim.status === 'draft';
        case 'approve':
        case 'reject':
          return ['owner', 'admin'].includes(userRole) && 
                 ['submitted', 'under_review'].includes(claim.status);
        case 'delete':
          return ['owner'].includes(userRole);
        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking claim permissions:', error);
      return false;
    }
  }
}

export const claimService = new ClaimService();
