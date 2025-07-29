#!/usr/bin/env node

/**
 * Test script to manually trigger and debug Supabase realtime subscription
 * This script helps identify the exact error occurring in the browser
 */

console.log('🧪 Testing Supabase Realtime Subscription');
console.log('='.repeat(50));

// This script is meant to be run in the browser console
// Copy and paste the following code into the browser console:

const testCode = `
// Test realtime subscription manually
console.log('🚀 Starting manual realtime subscription test...');

// Get the notification service instance
const notificationService = window.notificationService || 
  (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentOwner?.current?.memoizedProps?.notificationService);

if (!notificationService) {
  console.error('❌ NotificationService not found. Try accessing it from the NotificationContext.');
  console.log('💡 Alternative: Access via window.__NOTIFICATION_SERVICE__ if exposed');
} else {
  console.log('✅ NotificationService found, testing subscription...');
  
  // Test the subscription with the same parameters as the app
  notificationService.subscribeToAllUserNotificationChanges(
    (event, notification) => {
      console.log('📨 Received notification:', { event, notification });
    },
    '65c76903-f096-423a-91ab-9108ea3acc65', // team ID
    {
      notificationTypes: [
        'receipt_processing_completed',
        'receipt_processing_failed',
        'receipt_ready_for_review',
        'receipt_batch_completed',
        'team_member_joined',
        'team_member_left',
        'team_member_role_changed',
        'team_invitation_sent',
        'team_invitation_accepted',
        'team_invitation_declined',
        'billing_subscription_created',
        'billing_subscription_updated',
        'billing_subscription_cancelled',
        'billing_payment_succeeded',
        'billing_payment_failed',
        'billing_invoice_created',
        'security_login_from_new_device',
        'security_password_changed',
        'security_email_changed',
        'receipt_comment_added',
        'receipt_shared',
        'receipt_flagged_for_review',
        'claim_submitted',
        'claim_approved',
        'claim_rejected',
        'claim_review_requested'
      ],
      priorities: ['medium', 'high']
    }
  ).then(() => {
    console.log('✅ Subscription created successfully');
  }).catch((error) => {
    console.error('❌ Subscription failed:', error);
  });
}
`;

console.log('📋 Copy and paste this code into the browser console:');
console.log('='.repeat(50));
console.log(testCode);
console.log('='.repeat(50));

console.log('\n🔍 What to look for:');
console.log('1. Any "[Supabase Realtime" log messages');
console.log('2. Filter construction logs starting with "🔍 Filter components:"');
console.log('3. System error messages with status: "error"');
console.log('4. WebSocket connection attempts in Network tab');
console.log('5. Any PostgreSQL filter syntax errors');

console.log('\n📝 Expected filter format:');
console.log('recipient_id=eq.feecc208-3282-49d2-8e15-0c64b0ee4abb&type=in.(receipt_processing_completed,team_member_joined,...)&priority=in.(medium,high)');

console.log('\n⚠️  If you see errors with escaped quotes like \\"medium\\",\\"high\\", that confirms the issue.');
