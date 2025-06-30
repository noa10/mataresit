// Test script to verify temporal parser functionality
// Run with: node test-temporal-parser.js

// Mock the temporal parser function (simplified version for testing)
function testTemporalPatterns() {
  console.log('🧪 Testing Temporal Pattern Matching');
  console.log('=====================================\n');

  const testQueries = [
    'find receipts from 2 days ago',
    'receipts from 3 days ago',
    '2 days ago',
    'show me receipts 1 week ago',
    'last 2 days',
    'past 3 days',
    'yesterday',
    'today'
  ];

  // Test patterns
  const patterns = [
    {
      name: 'X days ago pattern',
      regex: /\b(\d+)\s+(days?|weeks?|months?)\s+ago\b/i,
      description: 'Should match: 2 days ago, 3 weeks ago, 1 month ago'
    },
    {
      name: 'Text days ago pattern', 
      regex: /\b(a|one)\s+(day|week|month)\s+ago\b/i,
      description: 'Should match: a day ago, one week ago'
    },
    {
      name: 'Last X pattern',
      regex: /\b(last|past)\s+(\d+)\s+(days?|weeks?|months?)\b/i,
      description: 'Should match: last 2 days, past 3 weeks'
    },
    {
      name: 'Yesterday pattern',
      regex: /\b(yesterday|yesterday\'s)\s*(receipts?|purchases?|expenses?)?\b/i,
      description: 'Should match: yesterday, yesterday\'s receipts'
    },
    {
      name: 'Today pattern',
      regex: /\b(today|today\'s)\s*(receipts?|purchases?|expenses?)?\b/i,
      description: 'Should match: today, today\'s receipts'
    }
  ];

  testQueries.forEach(query => {
    console.log(`\n🔍 Testing query: "${query}"`);
    console.log('─'.repeat(50));
    
    let matched = false;
    patterns.forEach(pattern => {
      const match = query.toLowerCase().match(pattern.regex);
      if (match) {
        console.log(`✅ MATCHED: ${pattern.name}`);
        console.log(`   Pattern: ${pattern.regex}`);
        console.log(`   Match: "${match[0]}"`);
        console.log(`   Groups: [${match.slice(1).join(', ')}]`);
        matched = true;
      }
    });
    
    if (!matched) {
      console.log('❌ NO MATCH - This query would fall back to regular search');
    }
  });

  console.log('\n📊 Summary');
  console.log('===========');
  console.log('The key fix is adding the "X days ago" pattern which was missing.');
  console.log('This should now properly detect temporal queries like "2 days ago".');
}

testTemporalPatterns();
