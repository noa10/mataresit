
import { supabase } from '@/lib/supabase';
import type { AdminUser, AppRole } from '@/types/auth';

export class AdminService {
  async getAllUsers(): Promise<AdminUser[]> {
    try {
      // Get users from auth.users via RPC call
      const { data: authUsers, error: authError } = await supabase.rpc('get_admin_users');

      if (authError) {
        console.error('Error fetching auth users:', authError);
        throw authError;
      }

      if (!authUsers || authUsers.length === 0) {
        return [];
      }

      // Transform the data to match AdminUser interface
      const adminUsers: AdminUser[] = authUsers.map((user: any) => ({
        id: user.id,
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        confirmed_at: user.confirmed_at || '',
        last_sign_in_at: user.last_sign_in_at || '',
        created_at: user.created_at || '',
        roles: user.roles || []
      }));

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

  async getAllReceipts() {
    try {
      // Get all receipts with user profile information
      const { data: receipts, error } = await supabase
        .from('receipts')
        .select(`
          id,
          merchant,
          total,
          date,
          status,
          created_at,
          user_id
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching all receipts:', error);
        throw error;
      }

      // Get user profiles for all receipts
      if (receipts && receipts.length > 0) {
        const userIds = [...new Set(receipts.map((receipt: any) => receipt.user_id))];
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', userIds);

        if (profilesError) {
          console.error('Error fetching profiles for receipts:', profilesError);
          // Continue without profile data rather than failing completely
        }

        // Get auth users for email information
        const { data: authUsers, error: authError } = await supabase.rpc('get_admin_users');

        if (authError) {
          console.error('Error fetching auth users:', authError);
        }

        // Combine receipt data with profile and auth data
        return receipts.map((receipt: any) => {
          const profile = profiles?.find((p: any) => p.id === receipt.user_id);
          const authUser = authUsers?.find((u: any) => u.id === receipt.user_id);

          return {
            ...receipt,
            profiles: {
              first_name: profile?.first_name || '',
              last_name: profile?.last_name || '',
              email: authUser?.email || 'Unknown'
            }
          };
        });
      }

      return receipts || [];
    } catch (error) {
      console.error('Error in getAllReceipts:', error);
      throw error;
    }
  }

  async getSystemStats() {
    try {
      // Try to use the new admin system stats function first
      const { data: adminStats, error: adminStatsError } = await supabase.rpc('get_admin_system_stats');

      if (!adminStatsError && adminStats) {
        console.log('✅ Using admin system stats function');
        return {
          userCount: adminStats.userCount || 0,
          receiptCount: adminStats.receiptCount || 0,
          activeUsersCount: adminStats.activeUsersCount || 0,
          recentActivity: adminStats.recentActivity || [],
          lastUpdated: adminStats.lastUpdated
        };
      }

      console.warn('⚠️ Admin stats function failed, falling back to individual queries:', adminStatsError?.message);

      // Fallback to individual queries with admin policies
      const [userCountResult, receiptCountResult, recentReceiptsResult] = await Promise.all([
        // Get user count from profiles table (now with admin policy)
        supabase.from('profiles').select('*', { count: 'exact', head: true }),

        // Get receipt count (now with admin policy)
        supabase.from('receipts').select('*', { count: 'exact', head: true }),

        // Get recent activity (last 10 receipts)
        supabase
          .from('receipts')
          .select('id, merchant, total, currency, date, created_at, user_id')
          .order('created_at', { ascending: false })
          .limit(10)
      ]);

      const { count: userCount, error: userCountError } = userCountResult;
      const { count: receiptCount, error: receiptCountError } = receiptCountResult;
      const { data: recentReceipts, error: recentActivityError } = recentReceiptsResult;

      if (userCountError) {
        console.error('Error fetching user count:', userCountError);
        throw userCountError;
      }

      if (receiptCountError) {
        console.error('Error fetching receipt count:', receiptCountError);
        throw receiptCountError;
      }

      if (recentActivityError) {
        console.error('Error fetching recent activity:', recentActivityError);
        // Don't throw for recent activity errors, just log and continue
        console.warn('Recent activity will be empty due to error');
      }

      // Transform the data for consistency
      const transformedActivity = (recentReceipts || []).map((receipt: any) => ({
        id: receipt.id,
        merchant: receipt.merchant,
        total: receipt.total,
        currency: receipt.currency,
        date: receipt.date,
        created_at: receipt.created_at,
        user_id: receipt.user_id
      }));

      console.log('📊 System stats retrieved:', {
        userCount: userCount || 0,
        receiptCount: receiptCount || 0,
        recentActivityCount: transformedActivity.length
      });

      return {
        userCount: userCount || 0,
        receiptCount: receiptCount || 0,
        recentActivity: transformedActivity,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error in getSystemStats:', error);
      throw error;
    }
  }
}

export const adminService = new AdminService();
