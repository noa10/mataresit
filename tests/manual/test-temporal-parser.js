#!/usr/bin/env node

// Test script to verify the temporal parser is correctly extracting amount ranges
// This simulates the parseTemporalQuery function logic

function testAmountPatternMatching() {
  console.log('🧪 Testing amount pattern matching for "find me receipts over 200"');
  
  const query = "find me receipts over 200";
  const normalizedQuery = query.toLowerCase().trim();
  
  console.log('📝 Original query:', query);
  console.log('📝 Normalized query:', normalizedQuery);
  
  // Test the patterns from the temporal parser
  const amountPatterns = [
    // "over $100", "above RM50", "more than $25", "over $100 USD"
    {
      name: "over/above pattern",
      pattern: /\b(over|above|more\s+than|greater\s+than)\s*(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)\s*(usd|myr|rm|dollars?|ringgit)?\b/i,
      handler: (match) => {
        const amount = parseFloat(match[3]);
        return {
          min: amount,
          currency: 'MYR',
          originalAmount: amount,
          originalCurrency: 'MYR'
        };
      }
    },
    // "receipts over 100", "expenses above 50" (without currency symbols)
    {
      name: "receipts over pattern",
      pattern: /\b(receipts?|expenses?|transactions?|purchases?|bills?)\s+(over|above|more\s+than|greater\s+than|under|below|less\s+than)\s+(\d+(?:\.\d{2})?)/i,
      handler: (match) => {
        const amount = parseFloat(match[3]);
        const operator = match[2].toLowerCase();
        if (operator.includes('over') || operator.includes('above') || operator.includes('more') || operator.includes('greater')) {
          return {
            min: amount,
            currency: 'MYR',
            originalAmount: amount,
            originalCurrency: 'MYR'
          };
        } else {
          return {
            max: amount,
            currency: 'MYR',
            originalAmount: amount,
            originalCurrency: 'MYR'
          };
        }
      }
    }
  ];
  
  console.log('\n🔍 Testing patterns:');
  
  let matchFound = false;
  for (let i = 0; i < amountPatterns.length; i++) {
    const { name, pattern, handler } = amountPatterns[i];
    console.log(`\n${i + 1}. Testing "${name}"`);
    console.log(`   Pattern: ${pattern.source}`);
    
    const match = normalizedQuery.match(pattern);
    if (match) {
      console.log('   ✅ MATCH FOUND!');
      console.log('   📋 Match details:', {
        fullMatch: match[0],
        groups: match.slice(1),
        matchIndex: match.index
      });
      
      const amountRange = handler(match);
      console.log('   💰 Extracted amount range:', amountRange);
      matchFound = true;
      break;
    } else {
      console.log('   ❌ No match');
    }
  }
  
  if (!matchFound) {
    console.log('\n❌ NO PATTERNS MATCHED - This indicates a problem with the pattern matching');
  } else {
    console.log('\n✅ Pattern matching is working correctly!');
  }
}

// Run the test
testAmountPatternMatching();
