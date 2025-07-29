#!/usr/bin/env node

/**
 * Test script to validate the exact filter construction logic
 * This replicates the filter building logic from the notification service
 */

console.log('🧪 Testing Filter Construction Logic');
console.log('='.repeat(50));

// Simulate the exact filter construction from notificationService.ts
function testFilterConstruction() {
  const userId = 'feecc208-3282-49d2-8e15-0c64b0ee4abb';
  const notificationTypes = [
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
  ];
  const priorities = ['medium', 'high'];

  console.log('\n📋 Input Parameters:');
  console.log(`User ID: ${userId}`);
  console.log(`Notification Types: ${notificationTypes.length} types`);
  console.log(`Priorities: ${priorities.join(', ')}`);

  // Build notification type filter
  let typeFilter = '';
  if (notificationTypes && notificationTypes.length > 0) {
    const sanitizedTypes = notificationTypes
      .filter(type => type && typeof type === 'string')
      .map(type => type.trim());

    if (sanitizedTypes.length > 0) {
      typeFilter = `&type=in.(${sanitizedTypes.join(',')})`;
    }
  }

  // Build priority filter
  let priorityFilter = '';
  if (priorities && priorities.length > 0) {
    const sanitizedPriorities = priorities
      .filter(priority => priority && typeof priority === 'string')
      .map(priority => priority.trim());

    if (sanitizedPriorities.length > 0) {
      priorityFilter = `&priority=in.(${sanitizedPriorities.join(',')})`;
    }
  }

  // Build final filter
  const filter = `recipient_id=eq.${userId}${typeFilter}${priorityFilter}`;

  console.log('\n🔍 Filter Construction Results:');
  console.log(`Type Filter: ${typeFilter}`);
  console.log(`Priority Filter: ${priorityFilter}`);
  console.log(`Final Filter Length: ${filter.length} characters`);
  
  console.log('\n📝 Complete Filter:');
  console.log(filter);

  // Analyze the filter for potential issues
  console.log('\n🔍 Filter Analysis:');
  console.log(`- Contains quotes: ${filter.includes('"') ? '❌ YES (problematic)' : '✅ NO (correct)'}`);
  console.log(`- Contains escaped quotes: ${filter.includes('\\"') ? '❌ YES (problematic)' : '✅ NO (correct)'}`);
  console.log(`- Priority filter format: ${priorityFilter}`);
  console.log(`- Type filter format: ${typeFilter.substring(0, 50)}...`);

  // Check for potential length issues
  if (filter.length > 2000) {
    console.log('⚠️  WARNING: Filter is very long, might cause issues');
  }

  // Test the filter against PostgREST syntax rules
  console.log('\n✅ PostgREST Syntax Validation:');
  const inFilterRegex = /=in\.\([^)]+\)/g;
  const inFilters = filter.match(inFilterRegex) || [];
  
  inFilters.forEach((inFilter, index) => {
    console.log(`  ${index + 1}. ${inFilter}`);
    
    // Check if it contains quotes (which might be problematic)
    if (inFilter.includes('"')) {
      console.log(`     ⚠️  Contains quotes - might cause escaping issues`);
    } else {
      console.log(`     ✅ No quotes - correct format`);
    }
  });

  return filter;
}

// Test different scenarios
console.log('\n🧪 Testing Different Scenarios:');

// Test 1: Current production scenario
console.log('\n1️⃣ Current Production Scenario:');
const productionFilter = testFilterConstruction();

// Test 2: Minimal scenario
console.log('\n2️⃣ Minimal Scenario (single type, single priority):');
function testMinimalFilter() {
  const userId = 'feecc208-3282-49d2-8e15-0c64b0ee4abb';
  const notificationTypes = ['receipt_processing_completed'];
  const priorities = ['high'];

  let typeFilter = '';
  if (notificationTypes && notificationTypes.length > 0) {
    const sanitizedTypes = notificationTypes
      .filter(type => type && typeof type === 'string')
      .map(type => type.trim());

    if (sanitizedTypes.length > 0) {
      typeFilter = `&type=in.(${sanitizedTypes.join(',')})`;
    }
  }

  let priorityFilter = '';
  if (priorities && priorities.length > 0) {
    const sanitizedPriorities = priorities
      .filter(priority => priority && typeof priority === 'string')
      .map(priority => priority.trim());

    if (sanitizedPriorities.length > 0) {
      priorityFilter = `&priority=in.(${sanitizedPriorities.join(',')})`;
    }
  }

  const filter = `recipient_id=eq.${userId}${typeFilter}${priorityFilter}`;
  console.log(`Minimal Filter: ${filter}`);
  return filter;
}

const minimalFilter = testMinimalFilter();

console.log('\n📊 Summary:');
console.log(`Production filter length: ${productionFilter.length} chars`);
console.log(`Minimal filter length: ${minimalFilter.length} chars`);
console.log(`Both filters use unquoted syntax: ${!productionFilter.includes('"') && !minimalFilter.includes('"') ? '✅' : '❌'}`);

console.log('\n🎯 Next Steps:');
console.log('1. Copy the minimal filter and test it directly with Supabase');
console.log('2. If minimal filter works, the issue might be filter length');
console.log('3. If minimal filter fails, the issue is with the basic syntax');
console.log('4. Check browser console for "[Supabase Realtime" messages');

console.log('\n🔧 Test Commands:');
console.log('Minimal filter for testing:');
console.log(`"${minimalFilter}"`);
