#!/usr/bin/env -S deno run --allow-all

/**
 * Debug the "last week" calculation step by step
 */

function debugLastWeekCalculation() {
  console.log('🔍 Debugging Last Week Calculation');
  console.log('==================================\n');

  const now = new Date();
  console.log('📅 Current date and time:', now.toISOString());
  console.log('📅 Current date (local):', now.toLocaleDateString());
  console.log('📅 Current day of week:', now.getDay(), '(0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday)');

  // Calculate this week's Monday
  const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysFromMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1; // Convert Sunday to 6

  console.log('\n🔍 This Week Calculation:');
  console.log('📅 Days from Monday:', daysFromMonday);

  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - daysFromMonday);
  startOfThisWeek.setHours(0, 0, 0, 0);

  console.log('📅 Start of this week (Monday):', startOfThisWeek.toISOString());
  console.log('📅 Start of this week (local):', startOfThisWeek.toLocaleDateString());

  // Calculate end of this week (Sunday)
  const endOfThisWeek = new Date(startOfThisWeek);
  endOfThisWeek.setDate(startOfThisWeek.getDate() + 6);
  endOfThisWeek.setHours(23, 59, 59, 999);

  console.log('📅 End of this week (Sunday):', endOfThisWeek.toISOString());
  console.log('📅 End of this week (local):', endOfThisWeek.toLocaleDateString());

  // Calculate last week
  console.log('\n🔍 Last Week Calculation:');
  
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

  const endOfLastWeek = new Date(startOfLastWeek);
  endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
  endOfLastWeek.setHours(23, 59, 59, 999);

  console.log('📅 Start of last week (Monday):', startOfLastWeek.toISOString());
  console.log('📅 Start of last week (local):', startOfLastWeek.toLocaleDateString());
  console.log('📅 End of last week (Sunday):', endOfLastWeek.toISOString());
  console.log('📅 End of last week (local):', endOfLastWeek.toLocaleDateString());

  const result = {
    start: startOfLastWeek.toISOString().split('T')[0],
    end: endOfLastWeek.toISOString().split('T')[0],
    preset: 'last_week'
  };

  console.log('\n📊 Final Result:', result);

  // Verify the calculation
  const startDate = new Date(result.start);
  const endDate = new Date(result.end);
  const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  console.log('\n✅ Verification:');
  console.log('📅 Days difference:', daysDiff);
  console.log('📅 Total days in range:', daysDiff + 1);
  console.log('📅 Is correct (should be 7 days):', (daysDiff + 1) === 7);

  // Manual verification for July 16, 2025 (Wednesday)
  console.log('\n🎯 Manual Verification for July 16, 2025:');
  console.log('📅 Today: Wednesday, July 16, 2025');
  console.log('📅 This week: Monday July 14 - Sunday July 20, 2025');
  console.log('📅 Last week: Monday July 7 - Sunday July 13, 2025');
  console.log('📅 Expected result: 2025-07-07 to 2025-07-13');
  console.log('📅 Actual result:', `${result.start} to ${result.end}`);

  const isCorrect = result.start === '2025-07-07' && result.end === '2025-07-13';
  console.log('📅 Calculation is correct:', isCorrect);

  if (!isCorrect) {
    console.log('\n❌ ISSUE FOUND: Date calculation is incorrect');
    console.log('🔧 This could explain why temporal search is not returning accurate results');
  } else {
    console.log('\n✅ Date calculation is correct');
    console.log('🔍 The issue must be elsewhere in the temporal search pipeline');
  }

  return result;
}

if (import.meta.main) {
  debugLastWeekCalculation();
}
