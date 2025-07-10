#!/usr/bin/env node

/**
 * Script to fix admin access issues
 * This script will:
 * 1. Apply the admin role fixes
 * 2. Assign admin role to the first user
 * 3. Verify admin access is working
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixAdminAccess() {
  console.log('🔧 Starting admin access fix...');

  try {
    // 1. Check current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ No authenticated user found. Please sign in first.');
      console.log('You can sign in at: https://mpmkbtsufihzdelrlszs.supabase.co');
      return;
    }

    console.log(`✅ Current user: ${user.email}`);

    // 2. Check if user already has admin role
    const { data: hasAdminRole, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleError) {
      console.error('❌ Error checking admin role:', roleError.message);
    } else if (hasAdminRole) {
      console.log('✅ User already has admin role');
    } else {
      console.log('⚠️ User does not have admin role. Attempting to assign...');
      
      // 3. Try to assign admin role
      const { error: assignError } = await supabase
        .from('user_roles')
        .insert([{ user_id: user.id, role: 'admin' }]);

      if (assignError) {
        console.error('❌ Error assigning admin role:', assignError.message);
        console.log('💡 You may need to run this SQL manually in the Supabase dashboard:');
        console.log(`INSERT INTO public.user_roles (user_id, role) VALUES ('${user.id}', 'admin') ON CONFLICT (user_id, role) DO NOTHING;`);
      } else {
        console.log('✅ Admin role assigned successfully');
      }
    }

    // 4. Test admin functionality
    console.log('🧪 Testing admin functionality...');
    
    const { data: feedbackData, error: feedbackError } = await supabase.rpc('get_feedback_analytics', {
      p_start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      p_end_date: new Date().toISOString()
    });

    if (feedbackError) {
      console.error('❌ Admin function test failed:', feedbackError.message);
      if (feedbackError.message.includes('Access denied')) {
        console.log('💡 The admin role assignment may not have taken effect yet.');
        console.log('💡 Try refreshing your browser or signing out and back in.');
      }
    } else {
      console.log('✅ Admin function test passed');
      console.log('📊 Feedback analytics data:', feedbackData);
    }

    // 5. Show current admin users
    console.log('👥 Current admin users:');
    const { data: adminUsers, error: adminError } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        role,
        created_at
      `)
      .eq('role', 'admin');

    if (adminError) {
      console.error('❌ Error fetching admin users:', adminError.message);
    } else {
      console.log(adminUsers);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the fix
fixAdminAccess().then(() => {
  console.log('🏁 Admin access fix completed');
}).catch(error => {
  console.error('💥 Script failed:', error);
});
