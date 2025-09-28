/**
 * Test utility to verify notification preferences functionality
 * This script tests the fixed get_user_notification_preferences function
 */

import { notificationService } from '@/services/notificationService';
import { supabase } from '@/lib/supabase';

export async function testNotificationPreferences() {
  console.log('🧪 Testing notification preferences functionality...');
  
  try {
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ User not authenticated. Please log in first.');
      return false;
    }
    
    console.log('✅ User authenticated:', user.email);
    
    // Test 1: Get user notification preferences
    console.log('\n📋 Test 1: Getting user notification preferences...');
    
    try {
      const preferences = await notificationService.getUserNotificationPreferences();
      console.log('✅ Successfully retrieved notification preferences');
      console.log('📊 Preferences summary:');
      console.log(`  - Email enabled: ${preferences.email_enabled}`);
      console.log(`  - Push enabled: ${preferences.push_enabled}`);
      console.log(`  - Timezone: ${preferences.timezone}`);
      console.log(`  - Quiet hours enabled: ${preferences.quiet_hours_enabled}`);
      
      // Test 2: Update notification preferences
      console.log('\n📝 Test 2: Updating notification preferences...');
      
      const testUpdates = {
        email_enabled: !preferences.email_enabled, // Toggle current value
        push_enabled: !preferences.push_enabled,   // Toggle current value
      };
      
      await notificationService.updateNotificationPreferences(testUpdates);
      console.log('✅ Successfully updated notification preferences');
      
      // Test 3: Verify the updates
      console.log('\n🔍 Test 3: Verifying preference updates...');
      
      const updatedPreferences = await notificationService.getUserNotificationPreferences();
      
      if (updatedPreferences.email_enabled === testUpdates.email_enabled &&
          updatedPreferences.push_enabled === testUpdates.push_enabled) {
        console.log('✅ Preference updates verified successfully');
      } else {
        console.error('❌ Preference updates not reflected correctly');
        return false;
      }
      
      // Test 4: Restore original preferences
      console.log('\n🔄 Test 4: Restoring original preferences...');
      
      await notificationService.updateNotificationPreferences({
        email_enabled: preferences.email_enabled,
        push_enabled: preferences.push_enabled,
      });
      
      console.log('✅ Original preferences restored');
      
      console.log('\n🎉 All notification preference tests passed!');
      return true;
      
    } catch (error) {
      console.error('❌ Error testing notification preferences:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Could not find the function')) {
          console.error('💡 This suggests the database function is still missing or has wrong parameters');
        } else if (error.message.includes('permission denied')) {
          console.error('💡 This suggests a permissions issue with the database function');
        }
      }
      
      return false;
    }
    
  } catch (error) {
    console.error('❌ Unexpected error during testing:', error);
    return false;
  }
}

// Function to test the database function directly
export async function testDatabaseFunction() {
  console.log('🔧 Testing database function directly...');
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('❌ User not authenticated');
      return false;
    }
    
    // Test the RPC call directly
    const { data, error } = await supabase.rpc('get_user_notification_preferences', {
      _user_id: user.id
    });
    
    if (error) {
      console.error('❌ Database function error:', error);
      return false;
    }
    
    console.log('✅ Database function working correctly');
    console.log('📊 Function returned:', data?.[0] ? 'Valid preferences object' : 'No data');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error testing database function:', error);
    return false;
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testNotificationPreferences = testNotificationPreferences;
  (window as any).testDatabaseFunction = testDatabaseFunction;
}
