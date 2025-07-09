# Mataresit Search Chatbot Architecture

## 1. Technical Architecture & Data Flow

The search chatbot in the Mataresit application follows this flow:

1. **User Input**: User enters a query in the chat interface on `SemanticSearch.tsx`
2. **Query Processing**: The `handleSendMessage` function processes the input:

````tsx path=src/pages/SemanticSearch.tsx mode=EXCERPT
const handleSendMessage = async (content: string) => {
  // Add user message immediately
  setMessages(prev => [...prev, userMessage]);
  
  // Check for special intents (help, greetings, etc.)
  const intentCheck = detectUserIntent(content);
  if (intentCheck.intent !== 'search' && intentCheck.response) {
    // Handle non-search intents
    return;
  }
  
  // Check if this is a "show more" request
  const isShowMoreRequest = /\b(show\s+more|more\s+results|load\s+more|see\s+more|additional\s+results)\b/i.test(content);
````

3. **Background Search**: The system initiates a non-blocking background search:

````tsx path=src/pages/SemanticSearch.tsx mode=EXCERPT
// Start the background search (non-blocking)
startBackgroundSearch(conversationId, content, enhancedParams)
  .then(async (searchResults) => {
    // Process results when search completes
    const results = {
      results: searchResults.results.map(result => ({
        id: result.sourceId,
        merchant: result.title,
        date: result.metadata?.date || result.createdAt,
        // ...other mappings
      })),
      // ...other result properties
    };
    
    // Generate AI response
    const aiResponse = await generateIntelligentResponse(results, content, messages);
    
    // Update UI with response
    setMessages(prev => [...prev, aiMessage]);
  })
````

4. **Search Execution**: The search is performed via the `unifiedSearch` or `semanticSearch` functions in `src/lib/ai-search.ts`, which call Supabase Edge Functions

5. **Response Generation**: Results are processed and an AI response is generated using `generateIntelligentResponse`

6. **UI Update**: The chat interface is updated with the AI response and search results

## 2. Search Capabilities

### Content Types

The system can search across multiple content types:

````typescript path=src/services/backgroundSearchService.ts mode=EXCERPT
generateSearchParams(query: string, conversationHistory?: ChatMessage[]): UnifiedSearchParams {
  return {
    query: query.trim(),
    // 🔧 FIX: Use singular source names that match backend validation
    sources: ['receipt', 'business_directory'],
    // ...other parameters
  };
}
````

- **Receipts**: Full receipt documents
- **Line Items**: Individual items within receipts
- **Business Directory**: Business-related information

### Search Methods

The system employs multiple search approaches:

1. **Vector Search**: Primary method using embeddings for semantic understanding

````typescript path=supabase/functions/semantic-search/index.ts mode=EXCERPT
// For receipts, use unified_search function with temporal filtering
if (searchTarget === 'receipts') {
  const { data, error: searchError } = await client.rpc(
    'unified_search',
    {
      query_embedding: queryEmbedding,
      source_types: ['receipt'],
      content_types: null,
      similarity_threshold: similarityThreshold,
      // ...other parameters
    }
  );
}
````

2. **Hybrid Search**: Combines vector and keyword search for better results

````typescript path=supabase/functions/unified-search/rag-pipeline.ts mode=EXCERPT
const { data: semanticResults, error: semanticError } = await this.context.supabase.rpc('enhanced_hybrid_search', {
  query_embedding: queryEmbedding,
  query_text: semanticQuery,
  source_types: ['receipt'],
  semantic_weight: 0.7, // Higher semantic weight for hybrid queries
  keyword_weight: 0.2,
  trigram_weight: 0.1,
  // ...other parameters
});
````

3. **Exact Text Matching**: For precise queries about specific items

````typescript path=supabase/functions/semantic-search/performLineItemSearch.ts mode=EXCERPT
// Exact food item patterns (short, specific items)
if (/^[a-zA-Z\s]{2,20}$/.test(trimmedQuery) && trimmedQuery.length <= 20) {
  console.log('🎯 Using high precision threshold for exact food item:', trimmedQuery);
  return 0.85; // 🔧 FIX: Much higher threshold for specific items
}
````

### Temporal Query Handling

The system has specialized handling for date-based queries:

````javascript path=tests/search/test-temporal-parsing-direct.js mode=EXCERPT
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
````

Date filters are passed to the database functions:

````typescript path=supabase/functions/semantic-search/index.ts mode=EXCERPT
// CRITICAL FIX: Pass temporal filters to database function
start_date: startDate || null,
end_date: endDate || null,
min_amount: minAmount || null,
max_amount: maxAmount || null
````

### Fallback Mechanisms

The system implements multiple fallback strategies:

````typescript path=src/lib/ai-search.ts mode=EXCERPT
// For non-CORS errors, try the legacy semantic-search Edge Function
try {
  // Apply query normalization to legacy search as well
  const normalizedParams = {
    ...params,
    query: normalizeSearchQuery(params.query)
  };
  
  const legacyData = await callEdgeFunction('semantic-search', 'POST', normalizedParams);
  
  // If we got results from legacy search, return them
  if (legacyResults.results && legacyResults.results.length > 0) {
    return legacyResults;
  }
  
  // If still no results, fall back to basic search
  throw new Error('No results from legacy search');
} catch (legacyError) {
  // Skip the database function altogether and go straight to the JavaScript fallback
  return await fallbackBasicSearch(params);
}
````

## 3. Advanced Features

### Enhanced Prompting

The system uses enhanced prompting to improve search quality:

````typescript path=src/pages/SemanticSearch.tsx mode=EXCERPT
// Add enhanced prompting for better LLM preprocessing
const enhancedParams = {
  ...unifiedParams,
  useEnhancedPrompting: true,
  conversationHistory: messages.slice(-5).map(m => m.content), // Last 5 messages for context
};
````

### RAG Pipeline

The application implements a Retrieval-Augmented Generation pipeline:

````typescript path=supabase/functions/unified-search/index.ts mode=EXCERPT
// Execute search using RAG pipeline with enhanced preprocessing
const ragContext: RAGPipelineContext = {
  originalQuery: query,
  params: filteredParams,
  user,
  supabase,
  metadata: {
    queryEmbedding: undefined,
    sourcesSearched: [],
    searchDuration: 0,
    subscriptionLimitsApplied: false,
    fallbacksUsed: [],
    llmPreprocessing: preprocessResult,
    reRanking: undefined,
    uiComponents: []
  }
};
````

### Conversational Memory

The system maintains conversation context for personalized responses:

````typescript path=src/services/personalizedChatService.ts mode=EXCERPT
// Get conversation context window if conversation ID is provided
if (conversationId) {
  const contextWindow = await conversationMemoryService.getContextWindow(
    conversationId,
    4000, // Max tokens
    true // Include memory
  );
  context.contextWindow = contextWindow;
}

// Search for relevant memories based on query
const relevantMemories = await conversationMemoryService.searchMemory(
  query,
  undefined, // All memory types
  0.4, // Higher confidence for query-specific memories
  10 // Limit to 10 most relevant
);
````

## 4. Result Presentation

Search results are presented in the chat interface with:

1. **AI-Generated Responses**: Natural language summaries of the search results

````typescript path=src/pages/SemanticSearch.tsx mode=EXCERPT
const aiMessage: ChatMessage = {
  id: generateMessageId(),
  type: 'ai',
  content: searchResults.enhancedResponse?.content || searchResults.content || aiResponse,
  timestamp: new Date(),
  searchResults: results,
  uiComponents: uiComponents,
};
````

2. **UI Components**: Dynamic visualizations based on the search results

````typescript path=supabase/functions/_shared/prompt-engineering.ts mode=EXCERPT
uiComponents: [
  {
    type: 'ui_component',
    component: 'summary_card',
    data: {
      title: 'Food Spending',
      value: 1247.50,
      currency: 'MYR',
      trend: { direction: 'up', percentage: 12, period: 'last month' }
    }
  }
]
````

3. **Background Search Indicators**: Visual feedback on search progress

````tsx path=src/pages/SemanticSearch.tsx mode=EXCERPT
{currentConversationId && (
  <div className="mb-6 space-y-3">
    <BackgroundSearchIndicator
      conversationId={currentConversationId}
      variant="detailed"
      showTimestamp={true}
      className="justify-center"
    />
    <SearchProgressIndicator
      conversationId={currentConversationId}
      className="max-w-md mx-auto"
    />
  </div>
)}
````

4. **Cached Results**: The system caches search results for faster responses to similar queries

````typescript path=src/pages/SemanticSearch.tsx mode=EXCERPT
// Try to load cached results
const hasCached = await loadCachedSearch(
  conversationId,
  lastUserMessage.content,
  searchParams
);

if (hasCached) {
  console.log(`💾 Loaded cached search results for conversation ${conversationId}`);
}
````

The entire system is designed to provide a seamless, conversational search experience with intelligent responses and rich visualizations of search results.
