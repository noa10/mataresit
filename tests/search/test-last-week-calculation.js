// Test the getLastWeekRange calculation to debug the issue
function getLastWeekRange() {
  const now = new Date();
  console.log('Current date:', now.toISOString());
  console.log('Current day of week (0=Sunday):', now.getDay());
  console.log('Current date number:', now.getDate());
  
  const endOfLastWeek = new Date(now);
  endOfLastWeek.setDate(now.getDate() - now.getDay() - 1);
  console.log('End of last week calculation:', {
    formula: 'now.getDate() - now.getDay() - 1',
    calculation: `${now.getDate()} - ${now.getDay()} - 1 = ${now.getDate() - now.getDay() - 1}`,
    result: endOfLastWeek.toISOString()
  });
  
  const startOfLastWeek = new Date(endOfLastWeek);
  startOfLastWeek.setDate(endOfLastWeek.getDate() - 6);
  console.log('Start of last week calculation:', {
    formula: 'endOfLastWeek.getDate() - 6',
    calculation: `${endOfLastWeek.getDate()} - 6 = ${endOfLastWeek.getDate() - 6}`,
    result: startOfLastWeek.toISOString()
  });
  
  const result = {
    start: startOfLastWeek.toISOString().split('T')[0],
    end: endOfLastWeek.toISOString().split('T')[0],
    preset: 'last_week'
  };
  
  console.log('Final result:', result);
  return result;
}

// Test with current date (should be June 29, 2025)
console.log('=== Testing getLastWeekRange() ===');
const result = getLastWeekRange();

// Expected: June 22-28, 2025 (Monday to Sunday of last week)
console.log('\n=== Expected vs Actual ===');
console.log('Expected: { start: "2025-06-22", end: "2025-06-28" }');
console.log('Actual:  ', result);

// Test what the correct calculation should be
console.log('\n=== Correct calculation for "last week" ===');
const now = new Date();
const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

// For "last week", we want Monday to Sunday of the previous week
// If today is Sunday (0), last week ended yesterday (Saturday)
// If today is Monday (1), last week ended 1 day ago (Sunday)
// If today is Tuesday (2), last week ended 2 days ago (Monday)... wait, that's wrong

// Correct logic: Last week = Monday to Sunday of the previous week
// End of last week = Last Sunday (or yesterday if today is Monday)
const daysToLastSunday = currentDayOfWeek === 0 ? 7 : currentDayOfWeek;
const lastSunday = new Date(now);
lastSunday.setDate(now.getDate() - daysToLastSunday);

const lastMonday = new Date(lastSunday);
lastMonday.setDate(lastSunday.getDate() - 6);

console.log('Corrected calculation:');
console.log('Current day of week:', currentDayOfWeek);
console.log('Days to last Sunday:', daysToLastSunday);
console.log('Last Sunday (end of last week):', lastSunday.toISOString().split('T')[0]);
console.log('Last Monday (start of last week):', lastMonday.toISOString().split('T')[0]);
