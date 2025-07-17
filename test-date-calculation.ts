#!/usr/bin/env -S deno run --allow-all

/**
 * Test the date calculation for "last week" to verify accuracy
 */

function calculateLastWeekRange(): { start: string; end: string; preset: string } {
  const now = new Date();
  console.log('📅 Current date:', now.toISOString());
  console.log('📅 Current day of week:', now.getDay(), '(0=Sunday, 1=Monday, etc.)');

  // FIXED: Use proper Monday-to-Sunday week calculation
  // Get the start of this week (Monday)
  const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysFromMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1; // Convert Sunday to 6

  console.log('📅 Days from Monday:', daysFromMonday);

  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - daysFromMonday);
  startOfThisWeek.setHours(0, 0, 0, 0);

  console.log('📅 Start of this week (Monday):', startOfThisWeek.toISOString());

  // Last week = 7 days before start of this week
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

  // End of last week = 6 days after start of last week (Sunday)
  const endOfLastWeek = new Date(startOfLastWeek);
  endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
  endOfLastWeek.setHours(23, 59, 59, 999);

  console.log('📅 Start of last week (Monday):', startOfLastWeek.toISOString());
  console.log('📅 End of last week (Sunday):', endOfLastWeek.toISOString());

  const result = {
    start: startOfLastWeek.toISOString().split('T')[0],
    end: endOfLastWeek.toISOString().split('T')[0],
    preset: 'last_week'
  };

  // Verify the calculation is correct (should be exactly 7 days)
  const startDate = new Date(result.start);
  const endDate = new Date(result.end);
  const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  console.log('📅 Final result:', result);
  console.log('📅 Verification:', {
    daysDifference: daysDiff,
    totalDays: daysDiff + 1,
    isCorrect: daysDiff === 6 // 6 days difference = 7 days total
  });

  return result;
}

function testDateCalculation() {
  console.log('🧪 Testing Last Week Date Calculation');
  console.log('=====================================\n');

  const result = calculateLastWeekRange();

  console.log('\n🔍 Analysis:');
  console.log('Today is July 16, 2025 (Wednesday)');
  console.log('This week should be: Monday July 14 - Sunday July 20');
  console.log('Last week should be: Monday July 7 - Sunday July 13');
  console.log(`Calculated range: ${result.start} to ${result.end}`);

  // Check if the calculation matches expected
  const expectedStart = '2025-07-07';
  const expectedEnd = '2025-07-13';

  if (result.start === expectedStart && result.end === expectedEnd) {
    console.log('✅ Date calculation is CORRECT');
  } else {
    console.log('❌ Date calculation is INCORRECT');
    console.log(`Expected: ${expectedStart} to ${expectedEnd}`);
    console.log(`Got: ${result.start} to ${result.end}`);
  }

  // Now let's check what receipts exist in this range
  console.log('\n📊 Expected receipts in this range:');
  console.log('Based on the database query, we should have receipts from:');
  console.log('- July 10, 2025 (multiple receipts)');
  console.log('- July 11, 2025 (multiple receipts)');
  console.log('- July 12, 2025 (multiple receipts)');
  console.log('- July 13, 2025 (multiple receipts)');
  console.log('');
  console.log('⚠️  Note: We have receipts from July 10-13, but the calculated range is July 7-13');
  console.log('This means receipts from July 7-9 might be missing from the database');
  console.log('But receipts from July 10-13 should definitely be returned');
}

if (import.meta.main) {
  testDateCalculation();
}
