
import { supabase } from '@/lib/supabase';
import type { AdminUser, AppRole } from '@/types/auth';

export class AdminService {
  async getAllUsers(): Promise<AdminUser[]> {
    try {
      // Use the existing get_admin_users function instead of get_all_users
      const { data: adminUsers, error: adminError } = await supabase.rpc('get_admin_users');
      
      if (adminError) {
        console.error('Error fetching admin users:', adminError);
        throw adminError;
      }

      if (!adminUsers || !Array.isArray(adminUsers) || adminUsers.length === 0) {
        return [];
      }

      // Transform the data to match AdminUser interface
      const transformedUsers: AdminUser[] = adminUsers.map((user: any) => ({
        id: user.id,
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        confirmed_at: user.confirmed_at || '',
        last_sign_in_at: user.last_sign_in_at || '',
        created_at: user.created_at || '',
        roles: Array.isArray(user.roles) ? user.roles : []
      }));

      return transformedUsers;
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      throw error;
    }
  }

  async getAllReceipts(): Promise<any[]> {
    try {
      const { data: receipts, error } = await supabase
        .from('receipts')
        .select(`
          *,
          profiles!receipts_user_id_fkey(email)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching receipts:', error);
        throw error;
      }

      return receipts || [];
    } catch (error) {
      console.error('Error in getAllReceipts:', error);
      throw error;
    }
  }

  async getSystemStats(): Promise<{
    userCount: number;
    receiptCount: number;
    recentActivity: any[];
  }> {
    try {
      // Get user count
      const { count: userCount, error: userError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });

      if (userError) {
        console.error('Error getting user count:', userError);
      }

      // Get receipt count
      const { count: receiptCount, error: receiptError } = await supabase
        .from('receipts')
        .select('id', { count: 'exact', head: true });

      if (receiptError) {
        console.error('Error getting receipt count:', receiptError);
      }

      // Get recent activity (last 10 receipts)
      const { data: recentActivity, error: activityError } = await supabase
        .from('receipts')
        .select(`
          id,
          merchant,
          total,
          date,
          profiles!receipts_user_id_fkey(first_name, last_name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (activityError) {
        console.error('Error getting recent activity:', activityError);
      }

      return {
        userCount: userCount || 0,
        receiptCount: receiptCount || 0,
        recentActivity: recentActivity || []
      };
    } catch (error) {
      console.error('Error in getSystemStats:', error);
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
      // Use the existing count_receipt_embeddings function
      const { data, error } = await supabase.rpc('count_receipt_embeddings');
      
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
export type { AdminUser };
