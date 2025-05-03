
import { supabase } from "@/integrations/supabase/client";
import { UserWithRole } from "@/types/auth";

// Admin service methods
export const adminService = {
  // Get all users
  async getAllUsers() {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*');
    
    if (error) {
      console.error("Error fetching users:", error);
      throw error;
    }
    
    return data;
  },
  
  // Update user role
  async updateUserRole(userId: string, role: 'admin' | 'user') {
    // Check if the user already has this role
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('role', role)
      .maybeSingle();
      
    if (existingRole) {
      return { message: 'User already has this role' };
    }
    
    // Remove other roles first (assuming a user can have only one role)
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);
      
    // Add the new role
    const { data, error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role });
      
    if (error) {
      console.error("Error updating user role:", error);
      throw error;
    }
    
    return { message: 'Role updated successfully' };
  },
  
  // Get all receipts (admin view across all users)
  async getAllReceipts() {
    const { data, error } = await supabase
      .from('receipts')
      .select('*, profiles(first_name, last_name, email)')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error("Error fetching receipts:", error);
      throw error;
    }
    
    return data;
  },
  
  // Get system statistics
  async getSystemStats() {
    // Total users count
    const { count: userCount, error: userError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
      
    // Total receipts count
    const { count: receiptCount, error: receiptError } = await supabase
      .from('receipts')
      .select('*', { count: 'exact', head: true });
      
    // Recent activity (last 10 receipts)
    const { data: recentActivity, error: activityError } = await supabase
      .from('receipts')
      .select('*, profiles(first_name, last_name)')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (userError || receiptError || activityError) {
      console.error("Error fetching system stats:", { userError, receiptError, activityError });
      throw userError || receiptError || activityError;
    }
    
    return {
      userCount,
      receiptCount,
      recentActivity
    };
  }
};
