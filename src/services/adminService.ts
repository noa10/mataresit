import { supabase } from "@/integrations/supabase/client";
// We'll remove the dependency on potentially incorrect generated types for now
// import { Database } from "@/types/supabase";

// Admin service methods
export const adminService = {
  // Get all users
  async getAllUsers() {
    // Using raw SQL query instead of accessing the view directly
    const { data, error } = await supabase.rpc('get_admin_users' as any);
    
    if (error) {
      console.error("Error fetching users:", error);
      throw error;
    }
    
    return data;
  },
  
  // Update user role
  async updateUserRole(userId: string, role: 'admin' | 'user') {
    // Use RPC call to avoid direct table access type issues
    const { data, error } = await supabase.rpc('set_user_role' as any, { 
      _user_id: userId, 
      _role: role 
    });
      
    if (error) {
      console.error("Error updating user role:", error);
      throw error;
    }
    
    return typeof data === 'boolean' ? data : false;
  },
  
  // Get all receipts (admin view across all users)
  async getAllReceipts() {
    try {
      // Step 1: Fetch all receipts first
      const { data: receipts, error: receiptsError } = await supabase
        .from('receipts')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (receiptsError) throw receiptsError;
      if (!receipts || receipts.length === 0) return [];
      
      // Step 2: Get unique user IDs from the receipts
      const userIds = [...new Set(receipts.map(receipt => receipt.user_id))];
      
      // Step 3: Fetch profiles for those users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds);
        
      if (profilesError) throw profilesError;
      
      // Step 4: Create a map of user_id to profile data for quick lookup
      const profileMap = (profiles || []).reduce((map, profile) => {
        map[profile.id] = profile;
        return map;
      }, {});
      
      // Step 5: Combine the data
      return receipts.map(receipt => ({
        ...receipt,
        profile: profileMap[receipt.user_id] || null
      }));
    } catch (error) {
      console.error("Error fetching receipts:", error);
      throw error;
    }
  },
  
  // Get system statistics
  async getSystemStats() {
    try {
      // Total users count
      const { count: userCount, error: userError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
        
      if (userError) throw userError;
      
      // Total receipts count
      const { count: receiptCount, error: receiptError } = await supabase
        .from('receipts')
        .select('*', { count: 'exact', head: true });
        
      if (receiptError) throw receiptError;
      
      // Recent activity (last 10 receipts)
      const { data: recentReceipts, error: receiptsError } = await supabase
        .from('receipts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (receiptsError) throw receiptsError;
      
      // If we have receipt data, fetch the associated profiles
      let recentActivity = [];
      if (recentReceipts && recentReceipts.length > 0) {
        // Get unique user IDs
        const userIds = [...new Set(recentReceipts.map(receipt => receipt.user_id))];
        
        // Fetch profiles for those users
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', userIds);
          
        if (profilesError) throw profilesError;
        
        // Create a map of user_id to profile data
        const profileMap = (profiles || []).reduce((map, profile) => {
          map[profile.id] = profile;
          return map;
        }, {});
        
        // Combine the receipt and profile data
        recentActivity = recentReceipts.map(receipt => ({
          ...receipt,
          profile: profileMap[receipt.user_id] || null
        }));
      }
      
      return {
        userCount: userCount ?? 0,
        receiptCount: receiptCount ?? 0,
        recentActivity: recentActivity,
      };
    } catch (error) {
      console.error("Error fetching system stats:", error);
      throw error;
    }
  }
};
