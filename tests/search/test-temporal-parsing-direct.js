// Test temporal parsing directly by simulating the exact logic
// This will help identify if there's an issue with the temporal parser

console.log('🧪 TESTING TEMPORAL PARSING LOGIC DIRECTLY');
console.log('==========================================\n');

// Simulate the exact temporal parsing logic from the deployed function
function simulateTemporalParsing(query, timezone = 'Asia/Kuala_Lumpur') {
  console.log('🕐 DEBUG: Starting temporal parsing for query:', query);
  const normalizedQuery = query.toLowerCase().trim();
  console.log('🔍 DEBUG: Normalized query:', normalizedQuery);

  const result = {
    originalQuery: query,
    searchTerms: [],
    queryType: 'general',
    confidence: 0.5,
    filters: {}
  };

  console.log('🕐 Parsing temporal query:', { query, timezone });

  // Test the exact patterns from the deployed code
  const TEMPORAL_PATTERNS = [
    // High priority patterns
    {
      pattern: /\b(today|today's)\s*(receipts?|purchases?|expenses?)?\b/i,
      priority: 1,
      isHybridCapable: false,
      description: 'Today references'
    },
    {
      pattern: /\b(yesterday|yesterday's)\s*(receipts?|purchases?|expenses?)?\b/i,
      priority: 1,
      isHybridCapable: false,
      description: 'Yesterday references'
    },
    // The new patterns I added
    {
      pattern: /\b(\d+)\s+(days?|weeks?|months?)\s+ago\b/i,
      priority: 1,
      isHybridCapable: true,
      description: 'Exact days ago (X days ago, X weeks ago, X months ago)'
    },
    {
      pattern: /\b(a|one)\s+(day|week|month)\s+ago\b/i,
      priority: 1,
      isHybridCapable: true,
      description: 'Single unit ago (a day ago, one week ago, etc.)'
    }
  ];

  // Parse temporal expressions with priority ordering
  let temporalMatch = null;
  let matchedPattern = null;
  let highestPriority = 999;

  for (const pattern of TEMPORAL_PATTERNS) {
    const match = normalizedQuery.match(pattern.pattern);
    if (match && pattern.priority < highestPriority) {
      temporalMatch = match;
      matchedPattern = pattern;
      highestPriority = pattern.priority;
      
      console.log('🎯 Temporal pattern matched:', {
        pattern: pattern.description,
        priority: pattern.priority,
        match: match[0],
        isHybridCapable: pattern.isHybridCapable,
        fullMatch: match
      });
    }
  }

  // Apply the best temporal match
  if (temporalMatch && matchedPattern) {
    try {
      // Simulate date range calculation
      let dateRange;
      if (matchedPattern.description.includes('days ago')) {
        const amount = parseInt(temporalMatch[1]);
        const unit = temporalMatch[2];
        
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - amount);
        const dateStr = targetDate.toISOString().split('T')[0];
        
        dateRange = {
          start: dateStr,
          end: dateStr,
          preset: `exact_${amount}_${unit.toLowerCase()}_ago`
        };
      }
      
      result.dateRange = dateRange;
      result.queryType = 'temporal';
      result.confidence += 0.3;

      console.log('📅 Date range calculated:', result.dateRange);

      // Detect hybrid temporal queries
      const semanticTerms = ['receipts']; // Simplified for testing
      const hasSemanticContent = semanticTerms.length > 0;

      result.temporalIntent = {
        isTemporalQuery: true,
        hasSemanticContent,
        routingStrategy: hasSemanticContent && matchedPattern.isHybridCapable 
          ? 'hybrid_temporal_semantic' 
          : hasSemanticContent 
          ? 'semantic_only' 
          : 'date_filter_only',
        temporalConfidence: 0.8,
        semanticTerms
      };

      if (hasSemanticContent && matchedPattern.isHybridCapable) {
        result.queryType = 'hybrid_temporal';
        result.confidence += 0.2;
      }

      console.log('🔀 Temporal routing strategy:', result.temporalIntent.routingStrategy);
    } catch (error) {
      console.error('❌ Error processing temporal match:', error);
    }
  } else {
    console.log('❌ NO TEMPORAL PATTERNS MATCHED');
  }

  console.log('✅ Temporal parsing complete:', {
    queryType: result.queryType,
    confidence: result.confidence,
    hasDateRange: !!result.dateRange,
    hasTemporalIntent: !!result.temporalIntent,
    isTemporalQuery: result.temporalIntent?.isTemporalQuery || false
  });

  return result;
}

// Test the problematic queries
const testQueries = [
  'find receipts from 3 days ago',
  'receipts from 3 days ago',
  '3 days ago',
  'find receipts from 2 days ago'
];

testQueries.forEach(query => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: "${query}"`);
  console.log('='.repeat(60));
  
  const result = simulateTemporalParsing(query);
  
  console.log('\n📊 FINAL RESULT:');
  console.log('- Query Type:', result.queryType);
  console.log('- Has Temporal Intent:', !!result.temporalIntent);
  console.log('- Is Temporal Query:', result.temporalIntent?.isTemporalQuery || false);
  console.log('- Routing Strategy:', result.temporalIntent?.routingStrategy || 'none');
  console.log('- Date Range:', result.dateRange || 'none');
  
  if (result.temporalIntent?.isTemporalQuery) {
    console.log('✅ This query SHOULD trigger temporal routing');
  } else {
    console.log('❌ This query will fall back to regular search');
  }
});

console.log('\n🎯 ANALYSIS:');
console.log('If the patterns match here but not in production, the issue could be:');
console.log('1. Edge Function environment differences');
console.log('2. Import/module loading issues');
console.log('3. Timezone handling differences');
console.log('4. Query preprocessing interference (despite our fix)');
console.log('5. Caching preventing new code from running');
