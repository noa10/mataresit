/**
 * Debug script to test the temporal parser directly
 * This will help us understand why "receipts from June 27" is not being detected
 */

// Test the temporal parsing logic directly
function debugTemporalParser() {
  console.log('🔍 DEBUGGING TEMPORAL PARSER');
  console.log('============================');
  
  const testQuery = "receipts from June 27";
  console.log(`Testing query: "${testQuery}"`);
  
  // Test the regex patterns manually
  const patterns = [
    {
      name: 'from june pattern',
      regex: /\bfrom\s+(june|jun)\s+(\d{1,2})\b/i,
      description: 'Should match "from June 27"'
    },
    {
      name: 'june pattern',
      regex: /\b(june|jun)\s+(\d{1,2})\b/i,
      description: 'Should match "June 27"'
    },
    {
      name: 'receipts pattern',
      regex: /\breceipts?\b/i,
      description: 'Should match "receipts"'
    }
  ];
  
  const normalizedQuery = testQuery.toLowerCase().trim();
  console.log(`Normalized query: "${normalizedQuery}"`);
  
  patterns.forEach(pattern => {
    const match = normalizedQuery.match(pattern.regex);
    console.log(`\n${pattern.name}:`);
    console.log(`  Regex: ${pattern.regex}`);
    console.log(`  Match: ${match ? 'YES' : 'NO'}`);
    if (match) {
      console.log(`  Full match: "${match[0]}"`);
      console.log(`  Groups: [${match.slice(1).map(g => `"${g}"`).join(', ')}]`);
    }
    console.log(`  Description: ${pattern.description}`);
  });
  
  // Test date calculation manually
  console.log('\n📅 MANUAL DATE CALCULATION:');
  console.log('===========================');
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const month = 6; // June
  const day = 27;
  
  console.log(`Current date: ${now.toISOString()}`);
  console.log(`Current year: ${currentYear}`);
  console.log(`Target: ${month}/${day} (June 27)`);
  
  // Create the target date (month is 0-indexed in JavaScript)
  const targetDate = new Date(currentYear, month - 1, day);
  console.log(`Target date created: ${targetDate.toISOString()}`);
  console.log(`Target date local: ${targetDate.toLocaleDateString()}`);
  
  // Check the comparison logic
  const isInFuture = targetDate > now;
  console.log(`Is target date in future? ${isInFuture}`);
  
  if (isInFuture) {
    targetDate.setFullYear(currentYear - 1);
    console.log(`Adjusted to previous year: ${targetDate.toISOString()}`);
  }
  
  const dateStr = targetDate.toISOString().split('T')[0];
  console.log(`Final date string: ${dateStr}`);
  console.log(`Expected: 2025-06-27`);
  console.log(`Match: ${dateStr === '2025-06-27' ? 'YES ✅' : 'NO ❌'}`);
  
  // Test semantic term extraction
  console.log('\n🔍 SEMANTIC TERM EXTRACTION:');
  console.log('=============================');
  
  // Simulate removing temporal terms
  const temporalMatch = normalizedQuery.match(/\bfrom\s+(june|jun)\s+(\d{1,2})\b/i);
  if (temporalMatch) {
    const withoutTemporal = normalizedQuery.replace(temporalMatch[0], '').trim();
    console.log(`Original: "${normalizedQuery}"`);
    console.log(`Temporal match: "${temporalMatch[0]}"`);
    console.log(`Without temporal: "${withoutTemporal}"`);
    
    const semanticTerms = withoutTemporal.split(/\s+/).filter(term => 
      term.length > 2 && 
      !['the', 'and', 'or', 'but', 'for', 'from', 'with'].includes(term)
    );
    console.log(`Semantic terms: [${semanticTerms.map(t => `"${t}"`).join(', ')}]`);
    console.log(`Has semantic content: ${semanticTerms.length > 0 ? 'YES' : 'NO'}`);
  }
  
  console.log('\n🎯 EXPECTED RESULT:');
  console.log('==================');
  console.log('temporalIntent: {');
  console.log('  isTemporalQuery: true,');
  console.log('  hasSemanticContent: true,');
  console.log('  routingStrategy: "hybrid_temporal_semantic",');
  console.log('  temporalConfidence: 0.8,');
  console.log('  semanticTerms: ["receipts"]');
  console.log('}');
  console.log('dateRange: {');
  console.log('  start: "2025-06-27",');
  console.log('  end: "2025-06-27",');
  console.log('  preset: "specific_date_6_27"');
  console.log('}');
}

// Instructions
console.log(`
🔍 TEMPORAL PARSER DEBUG TOOL
=============================

To debug the temporal parser:
1. Open browser console (F12)
2. Copy and paste this entire script
3. Run: debugTemporalParser()

This will test the regex patterns and date calculation logic
to understand why "receipts from June 27" is not being detected.
`);

// Make function available globally
if (typeof window !== 'undefined') {
  window.debugTemporalParser = debugTemporalParser;
}
