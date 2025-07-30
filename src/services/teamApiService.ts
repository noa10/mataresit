/**
 * Team API Service
 * Handles team member operations via Supabase Edge Functions
 */

import { supabase } from "@/integrations/supabase/client";
import { teamRemovalNotificationService } from "./teamRemovalNotificationService";

export interface RemoveMemberRequest {
  team_id: string;
  user_id: string;
  reason?: string;
  transfer_data?: boolean;
  transfer_to_user_id?: string | null;
}

export interface ScheduleRemovalRequest {
  team_id: string;
  user_id: string;
  removal_date: string;
  reason?: string;
}

export interface BulkRemovalRequest {
  team_id: string;
  user_ids: string[];
  reason?: string;
  transfer_data?: boolean;
  transfer_to_user_id?: string | null;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class TeamApiService {
  private readonly SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mpmkbtsufihzdelrlszs.supabase.co";
  private readonly API_KEY = import.meta.env.VITE_MATARESIT_API_KEY || "mk_test_499408260a6c25aceedc2f036a4887164daefe1e2915ad91302b8c1c5add71a7"; // Test API key

  /**
   * Get authentication headers for API calls
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      throw new Error('No active session found. Please log in.');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'X-API-Key': this.API_KEY,
    };
  }

  /**
   * Make a request to the external-api Edge Function
   */
  private async makeApiRequest<T = any>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST',
    body?: any
  ): Promise<ApiResponse<T>> {
    try {
      const headers = await this.getAuthHeaders();
      const url = `${this.SUPABASE_URL}/functions/v1/external-api/api/v1/teams/${endpoint}`;

      console.log(`Making API request to: ${url}`, { method, body });

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('API request failed:', {
          url,
          method,
          status: response.status,
          statusText: response.statusText,
          result
        });
        return {
          success: false,
          error: result.message || result.error || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      console.log('API request successful:', { url, method, result });

      return {
        success: result.success !== false, // Handle both boolean and object responses
        data: result.data || result,
        message: result.message,
        ...result // Include all response fields for bulk operations
      };

    } catch (error: any) {
      console.error('API request error:', error);
      return {
        success: false,
        error: error.message || 'Network error occurred',
      };
    }
  }

  /**
   * Remove a team member using direct database function call
   */
  async removeMember(request: RemoveMemberRequest): Promise<ApiResponse> {
    try {
      console.log('Calling remove_team_member directly:', request);

      // Get member and team details before removal for notifications
      const memberDetails = await this.getMemberDetailsForNotification(request.team_id, request.user_id);

      const { data, error } = await supabase.rpc('remove_team_member', {
        _team_id: request.team_id,
        _user_id: request.user_id,
      });

      if (error) {
        console.error('Database error removing team member:', error);
        return {
          success: false,
          error: error.message || 'Failed to remove team member',
        };
      }

      // Send notifications after successful removal
      if (memberDetails) {
        await this.sendRemovalNotifications(memberDetails, request);
      }

      return {
        success: true,
        data: { removed: data },
        message: 'Team member removed successfully',
      };

    } catch (error: any) {
      console.error('Exception removing team member:', error);
      return {
        success: false,
        error: error.message || 'Network error occurred',
      };
    }
  }

  /**
   * Schedule a team member removal (not implemented in production)
   */
  async scheduleRemoval(request: ScheduleRemovalRequest): Promise<ApiResponse> {
    return {
      success: false,
      error: 'Scheduled removal feature is not available. Please remove the member immediately instead.',
    };
  }

  /**
   * Remove multiple team members in bulk using individual calls
   */
  async bulkRemoveMembers(request: BulkRemovalRequest): Promise<ApiResponse> {
    try {
      console.log('Bulk removing team members:', request);

      // Get all member details before removal for notifications
      const memberDetailsMap = new Map();
      for (const user_id of request.user_ids) {
        const details = await this.getMemberDetailsForNotification(request.team_id, user_id);
        if (details) {
          memberDetailsMap.set(user_id, details);
        }
      }

      const results = [];
      const successfulRemovals = [];
      let successful_removals = 0;
      let failed_removals = 0;

      for (const user_id of request.user_ids) {
        try {
          const { data, error } = await supabase.rpc('remove_team_member', {
            _team_id: request.team_id,
            _user_id: user_id,
          });

          if (error) {
            console.error(`Failed to remove user ${user_id}:`, error);
            results.push({ user_id, success: false, error: error.message });
            failed_removals++;
          } else {
            results.push({ user_id, success: true });
            successful_removals++;

            // Track successful removals for notifications
            const memberDetails = memberDetailsMap.get(user_id);
            if (memberDetails) {
              successfulRemovals.push(memberDetails);
            }
          }
        } catch (err: any) {
          console.error(`Exception removing user ${user_id}:`, err);
          results.push({ user_id, success: false, error: err.message });
          failed_removals++;
        }
      }

      // Send bulk notifications for successful removals
      if (successfulRemovals.length > 0) {
        await this.sendBulkRemovalNotifications(successfulRemovals, request);
      }

      return {
        success: true,
        data: results,
        message: 'Bulk team member removal completed',
        bulk_operation_id: `bulk_${Date.now()}`,
        total_users: request.user_ids.length,
        successful_removals,
        failed_removals,
        completed_at: new Date().toISOString(),
      };

    } catch (error: any) {
      console.error('Exception in bulk removal:', error);
      return {
        success: false,
        error: error.message || 'Network error occurred',
      };
    }
  }

  /**
   * Get team members
   */
  async getTeamMembers(teamId: string): Promise<ApiResponse> {
    return this.makeApiRequest(`${teamId}/members`, 'GET');
  }

  /**
   * Update team member role using direct database function call
   */
  async updateMemberRole(teamId: string, userId: string, role: string): Promise<ApiResponse> {
    try {
      console.log('Calling update_team_member_role directly:', { teamId, userId, role });

      const { data, error } = await supabase.rpc('update_team_member_role', {
        _team_id: teamId,
        _user_id: userId,
        _new_role: role,
      });

      if (error) {
        console.error('Database error updating team member role:', error);
        return {
          success: false,
          error: error.message || 'Failed to update team member role',
        };
      }

      return {
        success: true,
        data: { updated: data },
        message: 'Team member role updated successfully',
      };

    } catch (error: any) {
      console.error('Exception updating team member role:', error);
      return {
        success: false,
        error: error.message || 'Network error occurred',
      };
    }
  }

  /**
   * Get member and team details for notification purposes
   */
  private async getMemberDetailsForNotification(teamId: string, userId: string) {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          user_id,
          profiles!inner(id, email, first_name, last_name, language),
          teams!inner(id, name),
          role
        `)
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        console.error('Failed to get member details for notification:', error);
        return null;
      }

      return {
        userId: data.user_id,
        email: data.profiles.email,
        firstName: data.profiles.first_name || '',
        lastName: data.profiles.last_name || '',
        language: data.profiles.language || 'en',
        teamId: data.teams.id,
        teamName: data.teams.name,
        role: data.role,
      };
    } catch (error) {
      console.error('Exception getting member details for notification:', error);
      return null;
    }
  }

  /**
   * Send removal notifications for individual member
   */
  private async sendRemovalNotifications(memberDetails: any, request: RemoveMemberRequest) {
    try {
      // Get current user details (the one performing the removal)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: removerProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', user.id)
        .single();

      if (!removerProfile) return;

      const notificationData = {
        removedUserId: memberDetails.userId,
        removedUserEmail: memberDetails.email,
        removedUserName: `${memberDetails.firstName} ${memberDetails.lastName}`.trim() || memberDetails.email,
        teamId: memberDetails.teamId,
        teamName: memberDetails.teamName,
        removalReason: request.reason,
        removedByUserId: user.id,
        removedByUserName: `${removerProfile.first_name} ${removerProfile.last_name}`.trim() || removerProfile.email,
        removedByUserEmail: removerProfile.email,
        removalTimestamp: new Date().toISOString(),
        transferredToUserId: request.transfer_to_user_id,
        transferredToUserName: request.transfer_to_user_id ? await this.getUserName(request.transfer_to_user_id) : undefined,
      };

      await teamRemovalNotificationService.notifyMemberRemoval(notificationData);
    } catch (error) {
      console.error('Error sending removal notifications:', error);
      // Don't throw error to avoid breaking the removal process
    }
  }

  /**
   * Send bulk removal notifications
   */
  private async sendBulkRemovalNotifications(successfulRemovals: any[], request: BulkRemovalRequest) {
    try {
      // Get current user details (the one performing the removal)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: removerProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', user.id)
        .single();

      if (!removerProfile) return;

      const removedUsers = successfulRemovals.map(member => ({
        userId: member.userId,
        email: member.email,
        name: `${member.firstName} ${member.lastName}`.trim() || member.email,
      }));

      const notificationData = {
        removedUsers,
        teamId: successfulRemovals[0]?.teamId,
        teamName: successfulRemovals[0]?.teamName,
        removalReason: request.reason,
        removedByUserId: user.id,
        removedByUserName: `${removerProfile.first_name} ${removerProfile.last_name}`.trim() || removerProfile.email,
        removedByUserEmail: removerProfile.email,
        removalTimestamp: new Date().toISOString(),
        transferredToUserId: request.transfer_to_user_id,
        transferredToUserName: request.transfer_to_user_id ? await this.getUserName(request.transfer_to_user_id) : undefined,
      };

      await teamRemovalNotificationService.notifyBulkMemberRemoval(notificationData);
    } catch (error) {
      console.error('Error sending bulk removal notifications:', error);
      // Don't throw error to avoid breaking the removal process
    }
  }

  /**
   * Get user display name by ID
   */
  private async getUserName(userId: string): Promise<string | undefined> {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', userId)
        .single();

      if (!data) return undefined;

      return `${data.first_name} ${data.last_name}`.trim() || data.email;
    } catch (error) {
      console.error('Error getting user name:', error);
      return undefined;
    }
  }
}

export const teamApiService = new TeamApiService();
