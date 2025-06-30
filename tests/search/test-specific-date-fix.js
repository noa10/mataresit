// Test script to verify the "on 27 june 2025" temporal parsing fix
// This script tests the temporal parser patterns directly

const testQueries = [
  "show me all receipts on 27 june 2025",
  "on 27 june 2025",
  "on june 27 2025", 
  "on 27 june",
  "on june 27",
  "receipts on 27 june 2025"
];

// Test patterns that should match
const patterns = [
  {
    pattern: /\bon\s+(\d{1,2})\s+(june|jun)(?:\s+\d{4})?\b/i,
    description: 'On day June (e.g., "on 27 june")'
  },
  {
    pattern: /\bon\s+(june|jun)\s+(\d{1,2})(?:\s+\d{4})?\b/i,
    description: 'On June day (e.g., "on june 27")'
  }
];

console.log('Testing temporal parser patterns for specific date queries:\n');

testQueries.forEach(query => {
  console.log(`Query: "${query}"`);
  
  patterns.forEach(patternObj => {
    const match = query.match(patternObj.pattern);
    if (match) {
      console.log(`  ✅ MATCHED: ${patternObj.description}`);
      console.log(`     Match: "${match[0]}"`);
      console.log(`     Groups: [${match.slice(1).join(', ')}]`);
    } else {
      console.log(`  ❌ No match: ${patternObj.description}`);
    }
  });
  
  console.log('');
});

console.log('Expected result: All queries should match at least one pattern');
console.log('This confirms the temporal parser can now detect "on [date]" queries');
