/**
 * Enhanced Response Generation for RAG Pipeline
 * 
 * Integrates advanced prompt engineering with the existing RAG pipeline
 * to generate intelligent, context-aware responses.
 */

import { UnifiedSearchResult } from './types.ts';
import { EnhancedPreprocessResult } from './enhanced-preprocessing.ts';
import {
  selfCorrectionPipeline,
  SelfCorrectionResult
} from '../_shared/self-correction-system.ts';
import {
  executeDynamicTools,
  parseToolCalls,
  generateToolAwarePrompt,
  ToolContext,
  ToolCallResult
} from '../_shared/dynamic-tool-system.ts';

export interface EnhancedResponseContext {
  originalQuery: string;
  preprocessResult: EnhancedPreprocessResult;
  searchResults: UnifiedSearchResult[];
  userProfile?: any;
  conversationHistory?: string[];
  metadata?: Record<string, any>;
  supabase?: any;
  user?: any;
  useSelfCorrection?: boolean;
  useToolCalling?: boolean;
}

export interface EnhancedResponse {
  content: string;
  uiComponents: any[];
  followUpSuggestions: string[];
  confidence: number;
  responseType: 'success' | 'partial' | 'empty' | 'error';
  metadata: {
    templateUsed: string;
    processingTime: number;
    tokensUsed?: number;
    modelUsed: string;
    selfCorrectionApplied?: boolean;
    toolCallsExecuted?: number;
    criticAnalysis?: any;
  };
  toolResults?: ToolCallResult[];
  selfCorrectionData?: SelfCorrectionResult;
}

/**
 * Generate enhanced response using advanced prompt engineering
 */
export async function generateEnhancedResponse(
  context: EnhancedResponseContext
): Promise<EnhancedResponse> {
  const startTime = Date.now();
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

  if (!geminiApiKey) {
    console.warn('GEMINI_API_KEY not available, using fallback response');
    return generateFallbackResponse(context);
  }

  try {
    // Check if self-correction should be used
    if (context.useSelfCorrection && context.supabase && context.user) {
      console.log('🔄 Using self-correction pipeline...');

      const selfCorrectionResult = await selfCorrectionPipeline(
        context.originalQuery,
        context.searchResults,
        context,
        geminiApiKey
      );

      return {
        content: selfCorrectionResult.finalResponse.content,
        uiComponents: selfCorrectionResult.finalResponse.uiComponents,
        followUpSuggestions: selfCorrectionResult.finalResponse.followUpSuggestions,
        confidence: selfCorrectionResult.finalResponse.confidence,
        responseType: determineResponseType(context, selfCorrectionResult.finalResponse),
        metadata: {
          templateUsed: 'self_correction',
          processingTime: selfCorrectionResult.processingMetadata.totalTime,
          tokensUsed: undefined,
          modelUsed: selfCorrectionResult.processingMetadata.modelsUsed.join(', '),
          selfCorrectionApplied: selfCorrectionResult.correctionApplied,
          criticAnalysis: selfCorrectionResult.criticAnalysis
        },
        selfCorrectionData: selfCorrectionResult
      };
    }

    // Select appropriate response strategy based on intent and results
    const responseStrategy = selectResponseStrategy(context);

    // Build dynamic prompt based on strategy
    let prompt = buildEnhancedPrompt(context, responseStrategy);

    // Add tool awareness if tool calling is enabled
    if (context.useToolCalling && context.supabase && context.user) {
      prompt = generateToolAwarePrompt(prompt);
    }

    // Generate response using Gemini
    const { GoogleGenerativeAI } = await import('https://esm.sh/@google/generative-ai@0.1.3');
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: responseStrategy.temperature,
        maxOutputTokens: responseStrategy.maxTokens,
      },
    });

    const responseText = result.response.text();

    // Execute tool calls if present and tool calling is enabled
    let toolResults: ToolCallResult[] = [];
    let finalResponseText = responseText;

    if (context.useToolCalling && context.supabase && context.user) {
      const toolCalls = parseToolCalls(responseText);

      if (toolCalls.length > 0) {
        console.log(`🔧 Executing ${toolCalls.length} tool calls...`);

        const toolContext: ToolContext = {
          supabase: context.supabase,
          user: context.user,
          query: context.originalQuery,
          searchResults: context.searchResults,
          metadata: context.metadata
        };

        toolResults = await executeDynamicTools(toolCalls, toolContext);

        // Generate final response incorporating tool results
        finalResponseText = await incorporateToolResults(
          responseText,
          toolResults,
          geminiApiKey,
          responseStrategy
        );
      }
    }

    // Parse structured response
    const parsedResponse = parseStructuredResponse(finalResponseText);

    // Generate UI components based on intent and results
    const uiComponents = await generateUIComponents(context, parsedResponse);

    // Generate follow-up suggestions
    const followUpSuggestions = await generateFollowUpSuggestions(context);

    // Determine response type and confidence
    const responseType = determineResponseType(context, parsedResponse);
    const confidence = calculateResponseConfidence(context, parsedResponse);

    return {
      content: parsedResponse.content || finalResponseText,
      uiComponents,
      followUpSuggestions,
      confidence,
      responseType,
      metadata: {
        templateUsed: responseStrategy.templateId,
        processingTime: Date.now() - startTime,
        tokensUsed: result.response.usageMetadata?.totalTokenCount,
        modelUsed: 'gemini-1.5-flash',
        toolCallsExecuted: toolResults.length
      },
      toolResults: toolResults.length > 0 ? toolResults : undefined
    };

  } catch (error) {
    console.error('Enhanced response generation error:', error);
    return generateFallbackResponse(context);
  }
}

/**
 * Response strategy configuration
 */
interface ResponseStrategy {
  templateId: string;
  systemPrompt: string;
  userPromptTemplate: string;
  temperature: number;
  maxTokens: number;
  includeUIComponents: boolean;
  includeFollowUps: boolean;
}

/**
 * Select response strategy based on context
 */
function selectResponseStrategy(context: EnhancedResponseContext): ResponseStrategy {
  const { intent, queryClassification } = context.preprocessResult;
  const hasResults = context.searchResults.length > 0;
  const resultCount = context.searchResults.length;

  // Check if this is a temporal query with zero results
  const isTemporalQuery = context.metadata?.temporalRouting?.isTemporalQuery || false;
  const dateRange = context.metadata?.filters?.startDate && context.metadata?.filters?.endDate
    ? { start: context.metadata.filters.startDate, end: context.metadata.filters.endDate }
    : null;

  // Check if this is a fallback temporal result
  const isFallbackResult = hasResults && context.searchResults.some(result =>
    result.metadata?.fallbackStrategy || result.metadata?.expandedDateRange
  );

  // Base strategies for different intents
  const strategies: Record<string, ResponseStrategy> = {
    financial_analysis: {
      templateId: 'financial_analysis',
      systemPrompt: `You are Mataresit AI Assistant, a financial data analysis expert. Provide clear, data-driven insights with appropriate visualizations. Focus on actionable insights and trends.

IMPORTANT: When describing receipts or financial data in text, always use actual formatted data, never use template placeholders like {{date}} or {{amount}}. Format dates as DD/MM/YYYY for Malaysian context and include proper currency symbols (MYR/USD).`,
      userPromptTemplate: `Analyze the financial data and provide insights for: "{query}"

Search Results: {searchResults}
Total Results: {resultCount}

Provide:
1. Clear summary of findings
2. Key insights and trends
3. Data visualizations using UI components
4. Actionable recommendations

When mentioning specific receipts or amounts in your response text, use the actual formatted data from the search results, not template placeholders. Format dates as DD/MM/YYYY and include currency information. Use appropriate UI components like summary cards, charts, and data tables.`,
      temperature: 0.3,
      maxTokens: 2000,
      includeUIComponents: true,
      includeFollowUps: true
    },

    document_retrieval: {
      templateId: 'document_retrieval',
      systemPrompt: `You are Mataresit AI Assistant, helping users find and organize their receipts and documents. Present results clearly and suggest refinements when needed.

IMPORTANT: When describing receipts in text, always use actual formatted data, never use template placeholders like {{date}} or {{amount}}. Format dates as DD/MM/YYYY for Malaysian context and include proper currency symbols (MYR/USD).`,
      userPromptTemplate: `Help find documents for: "{query}"

Search Results: {searchResults}
Total Results: {resultCount}

Create a comprehensive response that includes:
1. A concise summary highlighting key findings (total amount, date range, merchant count)
2. Present results using receipt cards with enhanced visual design
3. Use actual data from search results - format dates as DD/MM/YYYY and include currency
4. If searching for specific items like "POWERCAT", mention the total count and aggregate amounts
5. Suggest related searches or actions the user might want to take

Focus on making the information scannable and actionable. Present results in an organized manner using receipt cards and data tables. If no results, provide helpful suggestions for refining the search.`,
      temperature: 0.2,
      maxTokens: 2000,
      includeUIComponents: true,
      includeFollowUps: true
    },

    summarization: {
      templateId: 'summarization',
      systemPrompt: `You are Mataresit AI Assistant, expert at creating clear, concise summaries. Use progressive disclosure and highlight key insights.`,
      userPromptTemplate: `Create a comprehensive summary for: "{query}"

Data: {searchResults}
Focus: {queryClassification}

Provide executive summary, detailed breakdown, and key metrics using summary cards and charts.`,
      temperature: 0.4,
      maxTokens: 1800,
      includeUIComponents: true,
      includeFollowUps: true
    },

    conversational: {
      templateId: 'conversational',
      systemPrompt: `You are Mataresit AI Assistant. Provide conversational, concise responses that are friendly and direct.

RESPONSE STYLE REQUIREMENTS:
- Start with a friendly, direct confirmation (e.g., "I found X receipts matching...")
- Keep initial message very short and scannable
- Summarize common patterns (same merchant, same item, price range)
- End with a simple question: "What would you like to do?"
- Use actual data, never template placeholders like {{date}} or {{amount}}
- Format dates as DD/MM/YYYY and currency as MYR

EXAMPLE GOOD RESPONSE:
"I found 7 receipts matching "powercat", all from SUPER SEVEN CASH & CARRY.
They are all for POWERCAT 1.3KG at MYR 17.90.
What would you like to do?"

AVOID:
- Long detailed explanations in the initial response
- Repetitive information
- Complex tables or lists in text
- Template placeholders`,
      userPromptTemplate: `Respond to: "{query}"

Search Results: {searchResults}
Context: {conversationHistory}

Generate a conversational, concise response following the style requirements above.`,
      temperature: 0.4,
      maxTokens: 300,
      includeUIComponents: false,
      includeFollowUps: true
    },

    temporal_empty: {
      templateId: 'temporal_empty',
      systemPrompt: `You are Mataresit AI Assistant. When temporal queries return no results, provide helpful guidance about the date range searched and suggest alternatives.

RESPONSE STYLE REQUIREMENTS:
- Acknowledge the specific time period searched (e.g., "No receipts found for June 2025")
- Explain the exact date range that was searched (format dates as DD/MM/YYYY)
- Provide context about why this might happen (e.g., "This was before you started using Mataresit" or "You might not have uploaded receipts for this period")
- Suggest 3-4 specific alternative time periods that are likely to have data
- Offer to search broader time ranges automatically
- Keep the tone helpful, understanding, and solution-oriented
- Be concise but comprehensive

EXAMPLE GOOD RESPONSE:
"No receipts found for June 2025 (01/06/2025 - 30/06/2025). This might be because you didn't upload receipts for this period or started using Mataresit later.

Here are some alternatives to try:
• "This month" - for July 2025 receipts
• "Last 30 days" - for your most recent receipts
• "Recent receipts" - for your latest uploads
• "Last 3 months" - for a broader search

Would you like me to automatically search a broader time period?"`,
      userPromptTemplate: `The user searched for: "{query}"

Date range searched: {dateRange}
Search Results: {searchResults} (empty)

Provide a helpful and understanding response explaining that no receipts were found for the specific time period. Include the exact date range searched and provide specific, actionable suggestions for alternative searches. Consider that the user might be new to the app or might not have receipts for that specific period.`,
      temperature: 0.3,
      maxTokens: 500,
      includeUIComponents: false,
      includeFollowUps: true
    },

    temporal_fallback: {
      templateId: 'temporal_fallback',
      systemPrompt: `You are Mataresit AI Assistant. When temporal queries use fallback search with expanded date ranges, inform the user about the expanded search and present the results clearly.

RESPONSE STYLE REQUIREMENTS:
- Start with a clear explanation of what happened: "No receipts found for [original period], so I expanded the search..."
- Explain the fallback strategy used in user-friendly terms (e.g., "last 2 months" instead of "last_2_months")
- Show both the original and expanded date ranges (format dates as DD/MM/YYYY)
- Present the results clearly with receipt cards showing merchant, amount, and date
- Mention the total count and date range of found results
- Keep the tone helpful and transparent about the search expansion
- Use actual data from search results, never template placeholders

EXAMPLE GOOD RESPONSE:
"No receipts found for June 2025 (01/06/2025 - 30/06/2025), so I expanded the search to the last 3 months and found 5 receipts from April-July 2025.

Here are your receipts from the expanded search (01/04/2025 - 31/07/2025):"`,
      userPromptTemplate: `The user searched for: "{query}"

Original date range: {originalDateRange} (no results)
Expanded search found results using: {expandedDateRange}
Fallback strategy: {fallbackStrategy}
Total results found: {resultCount}

Search Results: {searchResults}

Explain clearly that the original search was expanded, mention the fallback strategy in user-friendly terms, show both date ranges, and present the results with actual data. Be transparent about the search expansion while keeping the tone positive and helpful.`,
      temperature: 0.3,
      maxTokens: 700,
      includeUIComponents: true,
      includeFollowUps: true
    }
  };

  // Get base strategy or default to general
  let strategy = strategies[intent] || strategies.conversational;

  // Special handling for temporal queries with fallback results
  if (hasResults && isTemporalQuery && isFallbackResult) {
    console.log('🕐 Using temporal_fallback strategy for fallback temporal results');
    strategy = strategies.temporal_fallback;
  }
  // Special handling for temporal queries with no results
  else if (!hasResults && isTemporalQuery && dateRange) {
    console.log('🕐 Using temporal_empty strategy for zero results temporal query');
    strategy = strategies.temporal_empty;
  }
  // Adjust strategy based on results
  else if (!hasResults && intent === 'document_retrieval') {
    strategy = {
      ...strategy,
      systemPrompt: strategy.systemPrompt + `\n\nIMPORTANT: No results found. Focus on helping the user refine their search and suggesting alternatives.`,
      temperature: 0.4
    };
  }

  if (resultCount > 20) {
    strategy = {
      ...strategy,
      systemPrompt: strategy.systemPrompt + `\n\nNote: Large result set (${resultCount} items). Summarize key patterns and provide filtering suggestions.`,
      maxTokens: Math.min(strategy.maxTokens + 500, 2500)
    };
  }

  return strategy;
}

/**
 * Build enhanced prompt with context injection
 */
function buildEnhancedPrompt(
  context: EnhancedResponseContext,
  strategy: ResponseStrategy
): string {
  let prompt = strategy.systemPrompt;

  // Add user profile context
  if (context.userProfile) {
    prompt += `\n\nUser Profile:
• Currency: ${context.userProfile.currency || 'MYR'}
• Date format: ${context.userProfile.dateFormat || 'DD/MM/YYYY'}
• Subscription: ${context.userProfile.subscriptionTier || 'Free'}`;
  }

  // Add conversation context
  if (context.conversationHistory && context.conversationHistory.length > 0) {
    const recentHistory = context.conversationHistory.slice(-3).join('\n');
    prompt += `\n\nRecent conversation:\n${recentHistory}`;
  }

  // Build user prompt with context substitution
  let userPrompt = strategy.userPromptTemplate;

  // Format date range for temporal queries
  let dateRangeText = '';
  let originalDateRangeText = '';
  let expandedDateRangeText = '';
  let fallbackStrategy = '';

  if (context.metadata?.filters?.startDate && context.metadata?.filters?.endDate) {
    const startDate = new Date(context.metadata.filters.startDate);
    const endDate = new Date(context.metadata.filters.endDate);
    const formatDate = (date: Date) => date.toLocaleDateString('en-GB'); // DD/MM/YYYY format
    dateRangeText = `${formatDate(startDate)} - ${formatDate(endDate)}`;
  }

  // Check for fallback information in search results
  const fallbackResult = context.searchResults.find(result =>
    result.metadata?.fallbackStrategy || result.metadata?.expandedDateRange
  );

  if (fallbackResult?.metadata) {
    if (fallbackResult.metadata.originalDateRange) {
      const origStart = new Date(fallbackResult.metadata.originalDateRange.start);
      const origEnd = new Date(fallbackResult.metadata.originalDateRange.end);
      const formatDate = (date: Date) => date.toLocaleDateString('en-GB');
      originalDateRangeText = `${formatDate(origStart)} - ${formatDate(origEnd)}`;
    }

    if (fallbackResult.metadata.expandedDateRange) {
      const expStart = new Date(fallbackResult.metadata.expandedDateRange.start);
      const expEnd = new Date(fallbackResult.metadata.expandedDateRange.end);
      const formatDate = (date: Date) => date.toLocaleDateString('en-GB');
      expandedDateRangeText = `${formatDate(expStart)} - ${formatDate(expEnd)}`;
    }

    fallbackStrategy = fallbackResult.metadata.fallbackStrategy || '';
  }

  const substitutions = {
    query: context.originalQuery,
    searchResults: JSON.stringify(context.searchResults.slice(0, 10), null, 2),
    resultCount: context.searchResults.length,
    queryClassification: JSON.stringify(context.preprocessResult.queryClassification),
    conversationHistory: context.conversationHistory?.slice(-3).join('\n') || '',
    intent: context.preprocessResult.intent,
    extractedEntities: JSON.stringify(context.preprocessResult.extractedEntities),
    dateRange: dateRangeText,
    originalDateRange: originalDateRangeText,
    expandedDateRange: expandedDateRangeText,
    fallbackStrategy: fallbackStrategy
  };

  Object.entries(substitutions).forEach(([key, value]) => {
    userPrompt = userPrompt.replace(new RegExp(`{${key}}`, 'g'), String(value));
  });

  return `${prompt}\n\n${userPrompt}`;
}

/**
 * Parse structured response from LLM output
 */
function parseStructuredResponse(responseText: string): { content: string; rawComponents?: any[] } {
  // Look for JSON blocks in the response
  const jsonBlockRegex = /```(?:json|ui_component)\s*\n([\s\S]*?)\n```/g;
  const rawComponents: any[] = [];
  let cleanedContent = responseText;

  let match;
  while ((match = jsonBlockRegex.exec(responseText)) !== null) {
    try {
      const jsonData = JSON.parse(match[1]);
      if (jsonData.type === 'ui_component') {
        rawComponents.push(jsonData);
        // Remove the JSON block from content
        cleanedContent = cleanedContent.replace(match[0], '').trim();
      }
    } catch {
      // Skip invalid JSON blocks
    }
  }

  return {
    content: cleanedContent,
    rawComponents: rawComponents.length > 0 ? rawComponents : undefined
  };
}

/**
 * Generate UI components based on context and results
 */
async function generateUIComponents(
  context: EnhancedResponseContext,
  parsedResponse: any
): Promise<any[]> {
  const components: any[] = [];

  // Add components from parsed response
  if (parsedResponse.rawComponents) {
    components.push(...parsedResponse.rawComponents);
  }

  // Generate components based on intent and results
  const { intent } = context.preprocessResult;
  const { searchResults } = context;

  // Generate receipt cards for any intent that returns receipt results
  // This ensures receipt cards are shown for document_retrieval, general_search, financial_analysis, etc.
  if (searchResults.length > 0) {
    const receiptResults = searchResults.filter(r => r.sourceType === 'receipt');

    // Remove the hardcoded limit - show all receipt results
    // The search API already handles pagination and limits appropriately
    receiptResults.forEach(result => {
      components.push({
        type: 'ui_component' as const,
        component: 'receipt_card',
        data: {
          receipt_id: result.sourceId,
          merchant: result.metadata?.merchant || result.title || 'Unknown Merchant',
          total: result.metadata?.total || result.metadata?.amount || 0,
          currency: result.metadata?.currency || 'MYR',
          date: result.metadata?.date || result.createdAt || new Date().toISOString().split('T')[0],
          category: result.metadata?.category || result.metadata?.predicted_category,
          confidence: result.similarity || 0.8,
          line_items_count: result.metadata?.line_items_count,
          tags: result.metadata?.tags || []
        },
        metadata: {
          title: 'Receipt Card',
          interactive: true,
          actions: ['view_receipt', 'edit_receipt']
        }
      });
    });

    console.log(`🎯 Generated ${receiptResults.length} receipt cards for intent: ${intent}`);

    // Add enhanced summary metadata for better presentation
    if (receiptResults.length > 0) {
      const summaryData = generateSearchSummary(receiptResults, context.originalQuery);

      // Add summary as metadata to the first component for the frontend to use
      if (components.length > 0) {
        components[0].metadata = {
          ...components[0].metadata,
          searchSummary: summaryData
        };
      }
    }
  }

  if (intent === 'financial_analysis' && searchResults.length > 0) {
    // Add summary card for financial analysis
    const totalAmount = searchResults.reduce((sum, r) => sum + (r.metadata?.total || 0), 0);
    components.push({
      type: 'ui_component' as const,
      component: 'summary_card',
      data: {
        title: 'Total Amount',
        value: totalAmount,
        currency: 'MYR',
        icon: 'dollar-sign',
        color: 'primary'
      },
      metadata: {
        title: 'Financial Summary',
        interactive: true
      }
    });
  }

  return components;
}

/**
 * Generate follow-up suggestions
 */
async function generateFollowUpSuggestions(context: EnhancedResponseContext): Promise<string[]> {
  // Special suggestions for temporal queries with no results
  const isTemporalQuery = context.metadata?.temporalRouting?.isTemporalQuery || false;
  const hasResults = context.searchResults.length > 0;

  if (isTemporalQuery && !hasResults) {
    return [
      "Show me this month's receipts",
      "Find recent receipts",
      "Search last 30 days",
      "Show all my receipts"
    ];
  }

  // Use the contextual hints from preprocessing if available
  if (context.preprocessResult.contextualHints.length > 0) {
    return context.preprocessResult.contextualHints.slice(0, 3);
  }

  // Generate based on intent
  const fallbackSuggestions: Record<string, string[]> = {
    financial_analysis: [
      "Show me spending trends",
      "Compare to last month",
      "Break down by category"
    ],
    document_retrieval: [
      "Find similar receipts",
      "Search by date range",
      "Filter by merchant"
    ],
    summarization: [
      "Show more details",
      "Compare periods",
      "Export summary"
    ]
  };

  return fallbackSuggestions[context.preprocessResult.intent] || [
    "Tell me more",
    "Show related data",
    "Help me explore"
  ];
}

/**
 * Determine response type
 */
function determineResponseType(
  context: EnhancedResponseContext,
  parsedResponse: any
): 'success' | 'partial' | 'empty' | 'error' {
  const hasResults = context.searchResults.length > 0;
  const hasContent = parsedResponse.content && parsedResponse.content.trim().length > 0;
  const isTemporalQuery = context.metadata?.temporalRouting?.isTemporalQuery || false;

  if (!hasContent) return 'error';
  if (!hasResults && (context.preprocessResult.intent === 'document_retrieval' || isTemporalQuery)) return 'empty';
  if (hasResults && context.searchResults.length < 3) return 'partial';
  return 'success';
}

/**
 * Calculate response confidence
 */
function calculateResponseConfidence(
  context: EnhancedResponseContext,
  parsedResponse: any
): number {
  let confidence = context.preprocessResult.confidence;

  // Adjust based on results
  const resultCount = context.searchResults.length;
  if (resultCount === 0) confidence *= 0.3;
  else if (resultCount < 3) confidence *= 0.7;
  else if (resultCount > 10) confidence *= 0.9;

  // Adjust based on response quality
  if (parsedResponse.rawComponents && parsedResponse.rawComponents.length > 0) {
    confidence *= 1.1;
  }

  return Math.max(0.1, Math.min(1.0, confidence));
}

/**
 * Incorporate tool results into the final response
 */
async function incorporateToolResults(
  originalResponse: string,
  toolResults: ToolCallResult[],
  geminiApiKey: string,
  responseStrategy: ResponseStrategy
): Promise<string> {
  if (toolResults.length === 0) {
    return originalResponse;
  }

  try {
    const { GoogleGenerativeAI } = await import('https://esm.sh/@google/generative-ai@0.1.3');
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const toolResultsSummary = toolResults.map(result => {
      if (result.result.success) {
        return `Tool: ${result.toolName}
Result: ${JSON.stringify(result.result.data, null, 2)}
Execution time: ${result.executionTime}ms`;
      } else {
        return `Tool: ${result.toolName}
Error: ${result.result.error}
Execution time: ${result.executionTime}ms`;
      }
    }).join('\n\n');

    const prompt = `
You previously generated this response:
${originalResponse}

The following tools were executed to gather additional data:
${toolResultsSummary}

Now generate a final, comprehensive response that:
1. Incorporates the tool results naturally into your response
2. Maintains the original structure and flow
3. Adds specific data and insights from the tool results
4. Explains any tool failures gracefully
5. Updates any UI components with the new data

Return the enhanced response that seamlessly integrates the tool results.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: responseStrategy.maxTokens,
      },
    });

    return result.response.text();

  } catch (error) {
    console.error('Failed to incorporate tool results:', error);
    return originalResponse;
  }
}

/**
 * Generate fallback response when main generation fails
 */
function generateFallbackResponse(context: EnhancedResponseContext): EnhancedResponse {
  const hasResults = context.searchResults.length > 0;

  const fallbackContent = hasResults
    ? `I found ${context.searchResults.length} results for "${context.originalQuery}". Let me help you explore this data.`
    : `I couldn't find specific results for "${context.originalQuery}", but I can help you refine your search or explore your data in other ways.`;

  return {
    content: fallbackContent,
    uiComponents: [],
    followUpSuggestions: [
      "Refine my search",
      "Show me related data",
      "Help me explore"
    ],
    confidence: 0.3,
    responseType: hasResults ? 'partial' : 'empty',
    metadata: {
      templateUsed: 'fallback',
      processingTime: 0,
      modelUsed: 'fallback'
    }
  };
}

/**
 * Generate enhanced summary data for search results
 */
function generateSearchSummary(results: any[], query: string) {
  const totalAmount = results.reduce((sum, r) => sum + (r.metadata?.total || 0), 0);
  const merchants = new Set(results.map(r => r.metadata?.merchant || r.title).filter(Boolean));
  const dates = results
    .map(r => r.metadata?.date || r.createdAt)
    .filter(Boolean)
    .map(d => new Date(d))
    .filter(d => !isNaN(d.getTime()));

  const earliestDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
  const latestDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;

  return {
    query,
    totalResults: results.length,
    totalAmount,
    currency: results[0]?.metadata?.currency || 'MYR',
    merchantCount: merchants.size,
    topMerchants: Array.from(merchants).slice(0, 3),
    dateRange: {
      earliest: earliestDate?.toISOString(),
      latest: latestDate?.toISOString()
    },
    avgAmount: results.length > 0 ? totalAmount / results.length : 0
  };
}
