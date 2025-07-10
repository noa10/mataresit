#!/usr/bin/env node

/**
 * Test script to verify admin fixes are working correctly
 * Run this after applying the admin fixes to verify everything works
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class AdminFixTester {
  constructor() {
    this.testResults = {
      authentication: false,
      adminRole: false,
      feedbackAnalytics: false,
      realtimeConnection: false,
      adminFunctions: false
    };
  }

  async runAllTests() {
    console.log('🧪 Starting Admin Fix Tests...\n');

    try {
      await this.testAuthentication();
      await this.testAdminRole();
      await this.testFeedbackAnalytics();
      await this.testRealtimeConnection();
      await this.testAdminFunctions();

      this.printResults();
    } catch (error) {
      console.error('💥 Test suite failed:', error);
    }
  }

  async testAuthentication() {
    console.log('1️⃣ Testing Authentication...');
    
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        console.log('❌ No authenticated user found');
        console.log('💡 Please sign in to your application first');
        return;
      }

      console.log(`✅ Authenticated as: ${user.email}`);
      this.testResults.authentication = true;
    } catch (error) {
      console.log('❌ Authentication test failed:', error.message);
    }
    console.log('');
  }

  async testAdminRole() {
    console.log('2️⃣ Testing Admin Role...');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: hasAdminRole, error } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });

      if (error) {
        console.log('❌ Error checking admin role:', error.message);
        return;
      }

      if (hasAdminRole) {
        console.log('✅ User has admin role');
        this.testResults.adminRole = true;
      } else {
        console.log('❌ User does not have admin role');
        console.log('💡 Run the admin fix script to assign admin role');
      }
    } catch (error) {
      console.log('❌ Admin role test failed:', error.message);
    }
    console.log('');
  }

  async testFeedbackAnalytics() {
    console.log('3️⃣ Testing Feedback Analytics Function...');
    
    try {
      const { data, error } = await supabase.rpc('get_feedback_analytics', {
        p_start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        p_end_date: new Date().toISOString()
      });

      if (error) {
        console.log('❌ Feedback analytics failed:', error.message);
        if (error.message.includes('Access denied')) {
          console.log('💡 Admin role check is still failing - verify the fix was applied');
        }
        return;
      }

      console.log('✅ Feedback analytics function works');
      console.log('📊 Sample data:', JSON.stringify(data, null, 2));
      this.testResults.feedbackAnalytics = true;
    } catch (error) {
      console.log('❌ Feedback analytics test failed:', error.message);
    }
    console.log('');
  }

  async testRealtimeConnection() {
    console.log('4️⃣ Testing Realtime Connection...');
    
    try {
      // Test basic realtime connectivity
      const testChannel = supabase.channel(`test-${Date.now()}`);
      
      const connectionPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);

        testChannel.subscribe((status) => {
          clearTimeout(timeout);
          if (status === 'SUBSCRIBED') {
            resolve(true);
          } else if (status === 'CHANNEL_ERROR') {
            reject(new Error('Channel error'));
          }
        });
      });

      await connectionPromise;
      console.log('✅ Realtime connection successful');
      this.testResults.realtimeConnection = true;

      // Cleanup
      supabase.removeChannel(testChannel);
    } catch (error) {
      console.log('❌ Realtime connection failed:', error.message);
      console.log('💡 Check WebSocket connectivity and Supabase settings');
    }
    console.log('');
  }

  async testAdminFunctions() {
    console.log('5️⃣ Testing Other Admin Functions...');
    
    try {
      // Test admin users function
      const { data: adminUsers, error: adminError } = await supabase.rpc('get_admin_users');
      
      if (adminError) {
        console.log('❌ get_admin_users failed:', adminError.message);
      } else {
        console.log('✅ get_admin_users function works');
        console.log(`👥 Found ${adminUsers?.length || 0} admin users`);
        this.testResults.adminFunctions = true;
      }

      // Test user roles query
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'admin');

      if (rolesError) {
        console.log('❌ user_roles query failed:', rolesError.message);
      } else {
        console.log('✅ user_roles table accessible');
        console.log(`🔑 Found ${userRoles?.length || 0} admin role assignments`);
      }

    } catch (error) {
      console.log('❌ Admin functions test failed:', error.message);
    }
    console.log('');
  }

  printResults() {
    console.log('📋 Test Results Summary:');
    console.log('========================');
    
    const results = [
      { name: 'Authentication', passed: this.testResults.authentication },
      { name: 'Admin Role', passed: this.testResults.adminRole },
      { name: 'Feedback Analytics', passed: this.testResults.feedbackAnalytics },
      { name: 'Realtime Connection', passed: this.testResults.realtimeConnection },
      { name: 'Admin Functions', passed: this.testResults.adminFunctions }
    ];

    results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.name}`);
    });

    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;

    console.log('');
    console.log(`🎯 Overall: ${passedCount}/${totalCount} tests passed`);

    if (passedCount === totalCount) {
      console.log('🎉 All tests passed! Admin fixes are working correctly.');
    } else {
      console.log('⚠️ Some tests failed. Please review the issues above.');
      console.log('💡 Refer to ADMIN_FIX_GUIDE.md for troubleshooting steps.');
    }
  }
}

// Run the tests
const tester = new AdminFixTester();
tester.runAllTests().catch(console.error);
