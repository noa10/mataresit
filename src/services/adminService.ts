
import { supabase } from '@/lib/supabase';
import type { AdminUser, AppRole } from '@/types/auth';

export class AdminService {
  async getAllUsers(): Promise<AdminUser[]> {
    try {
      // Get users from auth.users via RPC call
      const { data: authUsers, error: authError } = await supabase.rpc('get_all_users');
      
      if (authError) {
        console.error('Error fetching auth users:', authError);
        throw authError;
      }

      if (!authUsers || authUsers.length === 0) {
        return [];
      }

      // Get user roles
      const userIds = authUsers.map((user: any) => user.id);
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      if (rolesError) {
        console.error('Error fetching user roles:', rolesError);
        throw rolesError;
      }

      // Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        // Don't throw here, profiles might not exist for all users
      }

      // Create a map of user roles
      const rolesMap = new Map<string, AppRole[]>();
      userRoles?.forEach((ur: any) => {
        const userId = ur.user_id;
        if (!rolesMap.has(userId)) {
          rolesMap.set(userId, []);
        }
        rolesMap.get(userId)!.push(ur.role as AppRole);
      });

      // Create a map of profiles
      const profilesMap = new Map<string, any>();
      profiles?.forEach((profile: any) => {
        profilesMap.set(profile.id, profile);
      });

      // Combine auth users with roles and profiles
      const adminUsers: AdminUser[] = authUsers.map((authUser: any) => {
        const profile = profilesMap.get(authUser.id);
        const roles = rolesMap.get(authUser.id) || [];

        return {
          id: authUser.id,
          email: authUser.email || '',
          first_name: profile?.first_name || authUser.user_metadata?.first_name || '',
          last_name: profile?.last_name || authUser.user_metadata?.last_name || '',
          confirmed_at: authUser.confirmed_at || '',
          last_sign_in_at: authUser.last_sign_in_at || '',
          created_at: authUser.created_at || '',
          roles: roles
        };
      });

      return adminUsers;
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      throw error;
    }
  }

  async updateUserRole(userId: string, newRole: AppRole): Promise<void> {
    try {
      // First, remove existing roles for this user
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Error removing existing roles:', deleteError);
        throw deleteError;
      }

      // Then, add the new role
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert([{ user_id: userId, role: newRole }]);

      if (insertError) {
        console.error('Error inserting new role:', insertError);
        throw insertError;
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }

  async getReceiptStats() {
    try {
      const { data, error } = await supabase.rpc('get_receipt_stats');
      
      if (error) {
        console.error('Error fetching receipt stats:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in getReceiptStats:', error);
      throw error;
    }
  }
}

export const adminService = new AdminService();
