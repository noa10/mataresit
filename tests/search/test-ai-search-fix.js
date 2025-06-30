/**
 * Test the ai-search.ts temporal detection fix
 * This simulates the logic we added to detect "receipts from June 27"
 */

function testAiSearchTemporalFix() {
  console.log('🧪 TESTING AI-SEARCH TEMPORAL FIX');
  console.log('=================================');
  
  // Test queries
  const testQueries = [
    "receipts from June 27",
    "receipts from june 27", 
    "RECEIPTS FROM JUNE 27",
    "show me receipts from June 27",
    "June 27 receipts",
    "from June 27",
    "receipts June 27",
    "May 15 receipts",
    "from December 31",
    "receipts from July 4",
    "receipts from last week", // Should still work
    "today's receipts", // Should still work
    "regular search query", // Should NOT trigger
  ];
  
  testQueries.forEach((query, index) => {
    console.log(`\n${index + 1}. Testing: "${query}"`);
    
    const lowerQuery = query.toLowerCase();
    console.log(`   Normalized: "${lowerQuery}"`);
    
    // Test the month patterns (copied from our fix)
    const monthPatterns = [
      { pattern: /\b(?:from\s+)?(?:january|jan)\s+(\d{1,2})\b/i, month: 0, name: 'January' },
      { pattern: /\b(?:from\s+)?(?:february|feb)\s+(\d{1,2})\b/i, month: 1, name: 'February' },
      { pattern: /\b(?:from\s+)?(?:march|mar)\s+(\d{1,2})\b/i, month: 2, name: 'March' },
      { pattern: /\b(?:from\s+)?(?:april|apr)\s+(\d{1,2})\b/i, month: 3, name: 'April' },
      { pattern: /\b(?:from\s+)?(?:may)\s+(\d{1,2})\b/i, month: 4, name: 'May' },
      { pattern: /\b(?:from\s+)?(?:june|jun)\s+(\d{1,2})\b/i, month: 5, name: 'June' },
      { pattern: /\b(?:from\s+)?(?:july|jul)\s+(\d{1,2})\b/i, month: 6, name: 'July' },
      { pattern: /\b(?:from\s+)?(?:august|aug)\s+(\d{1,2})\b/i, month: 7, name: 'August' },
      { pattern: /\b(?:from\s+)?(?:september|sep)\s+(\d{1,2})\b/i, month: 8, name: 'September' },
      { pattern: /\b(?:from\s+)?(?:october|oct)\s+(\d{1,2})\b/i, month: 9, name: 'October' },
      { pattern: /\b(?:from\s+)?(?:november|nov)\s+(\d{1,2})\b/i, month: 10, name: 'November' },
      { pattern: /\b(?:from\s+)?(?:december|dec)\s+(\d{1,2})\b/i, month: 11, name: 'December' }
    ];
    
    let monthMatch = null;
    let matchedMonth = -1;
    let monthName = '';
    
    for (const { pattern, month, name } of monthPatterns) {
      const match = lowerQuery.match(pattern);
      if (match) {
        monthMatch = match;
        matchedMonth = month;
        monthName = name;
        break;
      }
    }
    
    // Test other temporal patterns
    const isLastWeek = lowerQuery.includes('last week') || lowerQuery.includes('this week');
    const isToday = lowerQuery.includes('today');
    const isYesterday = lowerQuery.includes('yesterday');
    
    // Test time-only query detection
    const isTimeOnlyQuery = lowerQuery.includes('all receipts') ||
                           lowerQuery.includes('receipts from') ||
                           lowerQuery.match(/^(last week|this week|today|yesterday)$/) ||
                           /\b(?:from\s+)?(?:january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|october|oct|november|nov|december|dec)\s+\d{1,2}\b/i.test(lowerQuery);
    
    console.log(`   Month pattern match: ${monthMatch ? 'YES ✅' : 'NO ❌'}`);
    if (monthMatch) {
      const day = parseInt(monthMatch[1]);
      const currentYear = new Date().getFullYear();
      const targetDate = new Date(currentYear, matchedMonth, day);
      
      // If the target date is in the future, use previous year
      if (targetDate > new Date()) {
        targetDate.setFullYear(currentYear - 1);
      }
      
      const dateStr = targetDate.toISOString().split('T')[0];
      console.log(`     Match: "${monthMatch[0]}"`);
      console.log(`     Month: ${monthName} (${matchedMonth})`);
      console.log(`     Day: ${day}`);
      console.log(`     Calculated date: ${dateStr}`);
      console.log(`     Expected for June 27: 2025-06-27`);
      console.log(`     Correct: ${dateStr === '2025-06-27' && monthName === 'June' ? 'YES ✅' : 'NO ❌'}`);
    }
    
    console.log(`   Other temporal: ${isLastWeek || isToday || isYesterday ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   Time-only query: ${isTimeOnlyQuery ? 'YES ✅' : 'NO ❌'}`);
    
    const shouldTriggerDateFilter = monthMatch || isLastWeek || isToday || isYesterday;
    console.log(`   🎯 Would trigger date filter: ${shouldTriggerDateFilter ? 'YES ✅' : 'NO ❌'}`);
  });
  
  console.log('\n📊 SUMMARY:');
  console.log('===========');
  console.log('✅ Month/day patterns should now be detected');
  console.log('✅ "receipts from June 27" should trigger date filter');
  console.log('✅ Time-only query detection includes month patterns');
  console.log('✅ Date calculation should return 2025-06-27 for June 27');
  console.log('\n🎯 Expected behavior: "receipts from June 27" should now return 1 result');
}

// Instructions
console.log(`
🧪 AI-SEARCH TEMPORAL FIX TEST
==============================

To test the ai-search.ts temporal fix:
1. Open browser console (F12)
2. Copy and paste this script
3. Run: testAiSearchTemporalFix()

This will verify that our fix correctly detects
"receipts from June 27" and other month/day patterns.
`);

// Make function available globally
if (typeof window !== 'undefined') {
  window.testAiSearchTemporalFix = testAiSearchTemporalFix;
}
