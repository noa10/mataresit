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
  // Smart suggestions for zero results
  smartSuggestions?: {
    dateAnalysis?: any;
    followUpSuggestions?: string[];
    enhancedMessage?: string;
  };
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
    formattingApplied?: boolean;
    contentStructure?: {
      hasTables: boolean;
      hasHeaders: boolean;
      hasLists: boolean;
      sectionsCount: number;
    };
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

    // Analyze content structure for metadata
    const contentStructure = analyzeContentStructure(parsedResponse.content || finalResponseText);

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
        toolCallsExecuted: toolResults.length,
        formattingApplied: true,
        contentStructure
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

FINANCIAL ANALYSIS FORMATTING REQUIREMENTS:

RESPONSE STRUCTURE:
1. # Financial Analysis Summary
2. ## Spending Overview (use summary statistics)
3. ## Transaction Breakdown (use detailed table)
4. ## Insights & Trends
5. ## Recommendations

FINANCIAL DATA FORMATTING:
- Currency: Always use "MYR 25.50" format (space between currency and amount)
- Percentages: Use "+15.2%" or "-8.7%" format for changes
- Large numbers: Use commas for thousands (e.g., MYR 1,234.56)
- Totals: Use bold formatting **Total: MYR 245.30**
- Averages: Show as "Average: MYR 35.04 per receipt"

SUMMARY STATISTICS FORMAT:
## Spending Overview
• **Total Spent**: MYR 245.30
• **Number of Transactions**: 12 receipts
• **Date Range**: 15/01/2024 - 28/01/2024
• **Average per Transaction**: MYR 20.44
• **Top Category**: Groceries (67% of spending)
• **Most Frequent Merchant**: SUPER SEVEN (5 transactions)

TABLE FORMAT FOR TRANSACTIONS:
| Date | Merchant | Category | Amount | Notes |
|------|----------|----------|--------|-------|
| 15/01/2024 | SUPER SEVEN | Groceries | MYR 17.90 | POWERCAT 1.3KG |
| 16/01/2024 | TESCO EXTRA | Groceries | MYR 45.60 | Weekly shopping |

INSIGHTS FORMAT:
## Key Insights
• **Spending Trend**: +15.2% increase from last month
• **Category Analysis**: Groceries account for 67% of total spending
• **Frequency Pattern**: Most transactions on weekends
• **Budget Impact**: 23% of monthly budget used

IMPORTANT: Always use actual formatted data, never template placeholders like {{date}} or {{amount}}. Format dates as DD/MM/YYYY for Malaysian context and include proper currency symbols (MYR/USD).`,
      userPromptTemplate: `Analyze the financial data and provide insights for: "{query}"

Search Results: {searchResults}
Total Results: {resultCount}

Follow the financial analysis formatting requirements above. Provide:
1. Comprehensive summary with key financial metrics
2. Detailed transaction breakdown using proper table formatting
3. Data-driven insights with percentage changes and trends
4. Actionable recommendations based on spending patterns

Use actual data from search results with proper currency formatting (MYR 25.50) and date formatting (DD/MM/YYYY). Include appropriate UI components like summary cards, charts, and data tables.`,
      temperature: 0.3,
      maxTokens: 2000,
      includeUIComponents: true,
      includeFollowUps: true
    },

    document_retrieval: {
      templateId: 'document_retrieval',
      systemPrompt: `You are Mataresit AI Assistant, helping users find and organize their receipts and documents. Present results clearly and suggest refinements when needed.

FORMATTING REQUIREMENTS FOR DOCUMENT RETRIEVAL:
- Start with a clear summary section using headers
- Use tables for multiple receipts with consistent formatting
- Include aggregate statistics (totals, counts, date ranges)
- Format all financial data with proper currency symbols
- Use actual data from search results, never placeholders

RESPONSE STRUCTURE:
1. # Search Results Summary
2. ## Receipt Details (use table format)
3. ## Key Statistics
4. ## Suggested Actions

EXAMPLE RESPONSE FORMAT:
# Search Results for "POWERCAT"

Found **7 receipts** matching your search criteria.

## Receipt Details
| Merchant | Date | Amount | Description |
|----------|------|--------|-------------|
| SUPER SEVEN CASH & CARRY | 15/01/2024 | MYR 17.90 | POWERCAT 1.3KG |
| SUPER SEVEN CASH & CARRY | 16/01/2024 | MYR 17.90 | POWERCAT 1.3KG |

## Key Statistics
• **Total Amount**: MYR 125.30
• **Date Range**: 15/01/2024 - 22/01/2024
• **Merchants**: 1 (SUPER SEVEN CASH & CARRY)
• **Average per Receipt**: MYR 17.90

## Suggested Actions
• View detailed receipt information
• Export data to spreadsheet
• Set up spending alerts for this category

IMPORTANT: Always use actual data from search results, format dates as DD/MM/YYYY, and include proper currency symbols (MYR/USD).`,
      userPromptTemplate: `Help find documents for: "{query}"

Search Results: {searchResults}
Total Results: {resultCount}

Create a comprehensive response following the formatting requirements above. Include:
1. Clear summary with key findings (total amount, date range, merchant count)
2. Organized table of receipt details with proper formatting
3. Key statistics section with aggregate data
4. Actionable suggestions for next steps

Focus on making the information scannable and actionable. Use proper markdown formatting throughout.`,
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
- Use markdown formatting for better readability

FORMATTING EXAMPLES:

For single receipt:
"I found 1 receipt for POWERCAT from SUPER SEVEN CASH & CARRY on 15/01/2024 for MYR 17.90. What would you like to do?"

For multiple similar receipts:
"I found 7 receipts matching "powercat", all from SUPER SEVEN CASH & CARRY for POWERCAT 1.3KG at MYR 17.90 each. Total: **MYR 125.30**. What would you like to do?"

For multiple different receipts (use table):
"I found 5 receipts from different merchants:

| Merchant | Date | Amount | Item |
|----------|------|--------|------|
| SUPER SEVEN | 15/01/2024 | MYR 17.90 | POWERCAT 1.3KG |
| TESCO EXTRA | 16/01/2024 | MYR 45.60 | Groceries |
| SHELL STATION | 17/01/2024 | MYR 80.00 | Fuel |

**Total**: MYR 143.50. What would you like to do?"

AVOID:
- Long detailed explanations in the initial response
- Repetitive information
- Complex nested structures
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

TEMPORAL EMPTY RESPONSE FORMATTING:

RESPONSE STRUCTURE:
1. Clear acknowledgment of the search period
2. Explanation of why no results were found
3. Formatted list of alternative suggestions
4. Helpful call-to-action

FORMATTING REQUIREMENTS:
- Use exact date ranges in DD/MM/YYYY format
- Use bullet points (•) for alternative suggestions
- Use bold formatting for important information
- Keep tone helpful and solution-oriented

EXAMPLE RESPONSE FORMAT:
## No Receipts Found

No receipts found for **June 2025** (01/06/2025 - 30/06/2025). This might be because:
• You didn't upload receipts for this period
• You started using Mataresit after this date
• This period is in the future

## Alternative Searches
Try these time periods instead:
• **"This month"** - for current month receipts
• **"Last 30 days"** - for your most recent receipts
• **"Recent receipts"** - for your latest uploads
• **"Last 3 months"** - for a broader search

## Quick Action
Would you like me to automatically search a broader time period?

FORMATTING RULES:
- Always format dates as DD/MM/YYYY
- Use bold for emphasis on key information
- Use bullet points for lists
- Include helpful context about why no results were found`,
      userPromptTemplate: `The user searched for: "{query}"

Date range searched: {dateRange}
Search Results: {searchResults} (empty)
Smart Suggestions Available: {smartSuggestions}
Enhanced Message: {enhancedMessage}

Provide a helpful and understanding response explaining that no receipts were found for the specific time period. If smart suggestions are available, use them instead of generic alternatives. If an enhanced message is provided, incorporate it naturally into your response. Include the exact date range searched and provide specific, actionable suggestions for alternative searches.`,
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
    },

    receipt_formatting: {
      templateId: 'receipt_formatting',
      systemPrompt: `You are Mataresit AI Assistant, specialized in presenting receipt data with optimal formatting and organization.

RECEIPT DATA FORMATTING STANDARDS:

SINGLE RECEIPT FORMAT:
"Found 1 receipt from **SUPER SEVEN CASH & CARRY** on 15/01/2024 for **MYR 17.90** (POWERCAT 1.3KG)."

MULTIPLE SIMILAR RECEIPTS FORMAT:
"Found 7 receipts for POWERCAT, all from **SUPER SEVEN CASH & CARRY**:
• All for POWERCAT 1.3KG at **MYR 17.90** each
• Date range: 15/01/2024 - 22/01/2024
• **Total**: MYR 125.30"

MULTIPLE DIFFERENT RECEIPTS FORMAT:
"Found 5 receipts from different merchants:

| Merchant | Date | Amount | Description |
|----------|------|--------|-------------|
| SUPER SEVEN CASH & CARRY | 15/01/2024 | MYR 17.90 | POWERCAT 1.3KG |
| TESCO EXTRA | 16/01/2024 | MYR 45.60 | Weekly groceries |
| SHELL STATION | 17/01/2024 | MYR 80.00 | Fuel |
| STARBUCKS | 18/01/2024 | MYR 12.50 | Coffee |
| GUARDIAN | 19/01/2024 | MYR 25.30 | Personal care |

## Summary
• **Total Amount**: MYR 181.30
• **Date Range**: 15/01/2024 - 19/01/2024
• **Merchants**: 5 different stores
• **Categories**: Groceries, Fuel, Food & Beverage, Personal Care"

FORMATTING RULES:
- Always use actual data, never placeholders
- Format currency as "MYR 25.50" (space between currency and amount)
- Format dates as DD/MM/YYYY
- Use bold for totals and important amounts
- Use tables for 3+ different receipts
- Include summary statistics for multiple receipts
- Use bullet points for key information`,
      userPromptTemplate: `Present receipt data for: "{query}"

Search Results: {searchResults}
Total Results: {resultCount}

Format the receipt data according to the standards above. Choose the appropriate format based on the number and similarity of receipts found. Always use actual data from the search results with proper formatting.`,
      temperature: 0.2,
      maxTokens: 1000,
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

  // Add comprehensive formatting instructions
  prompt += `\n\nCOMPREHENSIVE FORMATTING REQUIREMENTS:

📋 CONTENT STRUCTURE:
- Use markdown headers to organize content hierarchically
- # for main sections (e.g., "# Receipt Analysis Summary")
- ## for subsections (e.g., "## Transaction Details")
- ### for sub-subsections (e.g., "### Payment Methods")
- Always include a brief introductory sentence before diving into details

📊 TABLE FORMATTING:
- For receipt data, ALWAYS use this exact table format:
  | Merchant | Date | Amount | Description |
  |----------|------|--------|-------------|
  | SUPER SEVEN CASH & CARRY | 15/01/2024 | MYR 17.90 | POWERCAT 1.3KG |
- Ensure proper column alignment (amounts right-aligned)
- Include table headers even for single rows
- Use consistent spacing and formatting
- For large datasets (>5 rows), consider grouping by merchant or date

💰 FINANCIAL DATA:
- Format currency as "MYR 25.50" (space between currency and amount)
- Always include currency symbol (MYR, USD, etc.)
- Use proper decimal places (2 for currency)
- For totals, use bold: **Total: MYR 245.30**
- Show percentage changes as "+15.2%" or "-8.7%"

📅 DATE FORMATTING:
- Always use DD/MM/YYYY format (e.g., 15/01/2024)
- For date ranges: "15/01/2024 - 20/01/2024"
- For relative dates: "3 days ago (15/01/2024)"
- Be consistent throughout the response

📝 LIST FORMATTING:
- Use bullet points (•) for unordered lists
- Use numbers (1., 2., 3.) for ordered lists
- For key-value pairs: "• **Merchant**: SUPER SEVEN CASH & CARRY"
- Maintain consistent indentation

🎯 SUMMARY SECTIONS:
- Always include a summary section for multiple items
- Use this format:
  ## Summary
  • **Total Receipts**: 7 items
  • **Total Amount**: MYR 125.30
  • **Date Range**: 15/01/2024 - 20/01/2024
  • **Top Merchant**: SUPER SEVEN (5 receipts)

📱 MOBILE-FRIENDLY FORMATTING:
- Keep table columns concise but informative
- Use line breaks for better readability
- Avoid overly wide tables (max 4-5 columns)
- Use abbreviations when necessary (e.g., "Desc." for Description)

⚠️ CRITICAL RULES:
- NEVER use template placeholders like {{date}} or {{amount}}
- ALWAYS use actual data from search results
- Maintain consistent formatting throughout the response
- Use proper markdown syntax for all formatting elements
- Ensure tables are properly formatted with | separators`;

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
    fallbackStrategy: fallbackStrategy,
    smartSuggestions: context.smartSuggestions?.followUpSuggestions ?
      JSON.stringify(context.smartSuggestions.followUpSuggestions) : 'None',
    enhancedMessage: context.smartSuggestions?.enhancedMessage || 'None'
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

  // Look for markdown headers and convert them to UI components
  const markdownHeaderRegex = /^(#{1,3})\s+(.+)$/gm;
  let headerMatch;
  while ((headerMatch = markdownHeaderRegex.exec(responseText)) !== null) {
    try {
      const level = headerMatch[1].length as 1 | 2 | 3;
      const title = headerMatch[2].trim();

      // Create a section_header component
      const headerComponent = {
        type: 'ui_component',
        component: 'section_header',
        data: {
          title,
          level,
          variant: level === 1 ? 'primary' : 'default',
          divider: level <= 2
        },
        metadata: {
          title: `Section Header - ${title}`,
          interactive: false
        }
      };

      rawComponents.push(headerComponent);
      // Remove the markdown header from content (it will be rendered as a component)
      cleanedContent = cleanedContent.replace(headerMatch[0], '').trim();
    } catch {
      // Skip invalid header format
    }
  }

  // Look for markdown tables and convert them to UI components
  const markdownTableRegex = /\|(.+)\|\n\|(?:-+\|)+\n((?:\|.+\|\n)+)/g;
  let tableMatch;
  while ((tableMatch = markdownTableRegex.exec(responseText)) !== null) {
    try {
      const headers = tableMatch[1].split('|').map(h => h.trim()).filter(Boolean);
      const rows = tableMatch[2].split('\n').filter(row => row.trim().length > 0)
        .map(row => row.split('|').map(cell => cell.trim()).filter(Boolean));

      // Create a data_table component
      const tableComponent = {
        type: 'ui_component',
        component: 'data_table',
        data: {
          columns: headers.map((header, index) => ({
            key: `col_${index}`,
            label: header,
            sortable: true,
            align: index === headers.length - 1 && header.toLowerCase().includes('amount') ? 'right' : 'left'
          })),
          rows: rows.map(row => {
            const rowData: any = {};
            headers.forEach((header, index) => {
              rowData[`col_${index}`] = row[index] || '';
            });
            return rowData;
          }),
          sortable: true,
          searchable: true,
          pagination: rows.length > 10
        },
        metadata: {
          title: 'Data Table',
          interactive: true
        }
      };

      rawComponents.push(tableComponent);
      // Remove the markdown table from content
      cleanedContent = cleanedContent.replace(tableMatch[0], '').trim();
    } catch {
      // Skip invalid table format
    }
  }

  // Process JSON blocks
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

  // 🔍 DEBUG: Log search results structure for debugging
  console.log('🔍 DEBUG: generateUIComponents called with:', {
    searchResultsLength: searchResults?.length || 0,
    intent,
    firstResult: searchResults?.[0] ? {
      sourceType: searchResults[0].sourceType,
      contentType: searchResults[0].contentType,
      title: searchResults[0].title,
      hasMetadata: !!searchResults[0].metadata
    } : null
  });

  // Generate receipt cards for any intent that returns receipt results
  // This ensures receipt cards are shown for document_retrieval, general_search, financial_analysis, etc.
  if (searchResults.length > 0) {
    const receiptResults = searchResults.filter(r => r.sourceType === 'receipt');
    const lineItemResults = searchResults.filter(r => r.sourceType === 'line_item' || r.sourceType === 'lineItem');

    // 🔍 DEBUG: Log filtering results
    console.log('🔍 DEBUG: Filtering results:', {
      totalResults: searchResults.length,
      receiptResults: receiptResults.length,
      lineItemResults: lineItemResults.length,
      sourceTypes: searchResults.map(r => r.sourceType)
    });

    // Handle line item results first (for queries like "ikan")
    if (lineItemResults.length > 0) {
      console.log(`🍽️ Processing ${lineItemResults.length} line item results`);

      // Create a line items table component for better organization
      const lineItemTableRows = lineItemResults.map(result => ({
        col_0: result.metadata?.description || result.title || 'Unknown Item',
        col_1: result.metadata?.merchant || result.metadata?.parent_receipt_merchant || 'Unknown Merchant',
        col_2: formatCurrency(result.metadata?.amount || result.metadata?.line_item_price || 0, result.metadata?.currency || 'MYR'),
        col_3: formatDate(result.metadata?.date || result.metadata?.parent_receipt_date || result.createdAt),
        col_4: `${Math.round((result.similarity || 0) * 100)}% match`
      }));

      components.push({
        type: 'ui_component',
        component: 'data_table',
        data: {
          columns: [
            { key: 'col_0', label: 'Item', sortable: true, align: 'left' },
            { key: 'col_1', label: 'Merchant', sortable: true, align: 'left' },
            { key: 'col_2', label: 'Amount', sortable: true, align: 'right' },
            { key: 'col_3', label: 'Date', sortable: true, align: 'left' },
            { key: 'col_4', label: 'Match', sortable: true, align: 'center' }
          ],
          rows: lineItemTableRows,
          sortable: true,
          searchable: true,
          pagination: lineItemTableRows.length > 10
        },
        metadata: {
          title: 'Line Items Found',
          interactive: true
        }
      });

      // Generate line item cards
      lineItemResults.forEach(result => {
        components.push({
          type: 'ui_component' as const,
          component: 'line_item_card',
          data: {
            line_item_id: result.sourceId,
            receipt_id: result.metadata?.receipt_id || result.metadata?.parent_receipt_id,
            description: result.metadata?.description || result.title || 'Unknown Item',
            amount: result.metadata?.amount || result.metadata?.line_item_price || 0,
            currency: result.metadata?.currency || 'MYR',
            merchant: result.metadata?.merchant || result.metadata?.parent_receipt_merchant || 'Unknown Merchant',
            date: result.metadata?.date || result.metadata?.parent_receipt_date || result.createdAt,
            confidence: result.similarity || 0.8,
            quantity: result.metadata?.quantity || 1
          },
          metadata: {
            title: 'Line Item Card',
            interactive: true,
            actions: ['view_receipt', 'view_item_details']
          }
        });
      });

      console.log(`🎯 Generated ${lineItemResults.length} line item cards for intent: ${intent}`);
    }

    // Handle receipt results (for general receipt queries)
    if (receiptResults.length > 0) {
      // Create a receipt table component for better organization
      const tableRows = receiptResults.map(result => ({
        col_0: result.metadata?.merchant || result.title || 'Unknown',
        col_1: formatDate(result.metadata?.date || result.createdAt),
        col_2: formatCurrency(result.metadata?.total || result.metadata?.amount || 0, result.metadata?.currency || 'MYR'),
        col_3: result.metadata?.category || result.metadata?.predicted_category || 'Other',
        col_4: result.metadata?.line_items_count ? `${result.metadata.line_items_count} items` : '-'
      }));

      components.push({
        type: 'ui_component',
        component: 'data_table',
        data: {
          columns: [
            { key: 'col_0', label: 'Merchant', sortable: true, align: 'left' },
            { key: 'col_1', label: 'Date', sortable: true, align: 'left' },
            { key: 'col_2', label: 'Amount', sortable: true, align: 'right' },
            { key: 'col_3', label: 'Category', sortable: true, align: 'left' },
            { key: 'col_4', label: 'Items', sortable: false, align: 'center' }
          ],
          rows: tableRows,
          sortable: true,
          searchable: true,
          pagination: tableRows.length > 10
        },
        metadata: {
          title: 'Receipt Summary',
          interactive: true
        }
      });

      // Generate receipt cards
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
    }

    // Add enhanced summary metadata for better presentation
    const allResults = [...receiptResults, ...lineItemResults];
    if (allResults.length > 0) {
      const summaryData = generateSearchSummary(allResults, context.originalQuery, context);

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

  // 🔍 DEBUG: Log final component count
  console.log('🔍 DEBUG: generateUIComponents completed:', {
    componentsGenerated: components.length,
    componentTypes: components.map(c => c.component)
  });

  return components;
}

/**
 * Generate follow-up suggestions
 */
async function generateFollowUpSuggestions(context: EnhancedResponseContext): Promise<string[]> {
  // Use smart suggestions if available (from date analysis)
  if (context.smartSuggestions?.followUpSuggestions && context.smartSuggestions.followUpSuggestions.length > 0) {
    console.log('🔍 Using smart suggestions for follow-ups:', context.smartSuggestions.followUpSuggestions);
    return context.smartSuggestions.followUpSuggestions;
  }

  // Special suggestions for temporal queries with no results (fallback)
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
function generateSearchSummary(results: any[], query: string, context?: any) {
  const totalAmount = results.reduce((sum, r) => sum + (r.metadata?.total || 0), 0);
  const merchants = new Set(results.map(r => r.metadata?.merchant || r.title).filter(Boolean));
  const dates = results
    .map(r => r.metadata?.date || r.createdAt)
    .filter(Boolean)
    .map(d => new Date(d))
    .filter(d => !isNaN(d.getTime()));

  const earliestDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
  const latestDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;

  // CRITICAL FIX: Use intended search date range for temporal queries instead of calculated range
  let dateRange = {
    earliest: earliestDate?.toISOString(),
    latest: latestDate?.toISOString()
  };

  // If this is a temporal query, use the intended search date range for display
  if (context?.metadata?.filters?.startDate && context?.metadata?.filters?.endDate) {
    console.log('🔍 DEBUG: Using intended search date range for UI display:', {
      intended: {
        start: context.metadata.filters.startDate,
        end: context.metadata.filters.endDate
      },
      calculated: {
        earliest: earliestDate?.toISOString(),
        latest: latestDate?.toISOString()
      },
      reason: 'temporal_query_with_intended_range'
    });

    dateRange = {
      earliest: new Date(context.metadata.filters.startDate).toISOString(),
      latest: new Date(context.metadata.filters.endDate).toISOString()
    };
  }

  return {
    query,
    totalResults: results.length,
    totalAmount,
    currency: results[0]?.metadata?.currency || 'MYR',
    merchantCount: merchants.size,
    topMerchants: Array.from(merchants).slice(0, 3),
    dateRange,
    avgAmount: results.length > 0 ? totalAmount / results.length : 0
  };
}

/**
 * Helper functions for formatting
 */
function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-MY', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateString;
  }
}

function formatCurrency(amount: number, currency: string = 'MYR'): string {
  return `${currency} ${amount.toFixed(2)}`;
}

/**
 * Analyze content structure to help UI rendering
 */
function analyzeContentStructure(content: string): {
  hasTables: boolean;
  hasHeaders: boolean;
  hasLists: boolean;
  sectionsCount: number;
} {
  return {
    hasTables: /\|(.+)\|\n\|(?:-+\|)+\n/.test(content),
    hasHeaders: /^#{1,3}\s+.+$/m.test(content),
    hasLists: /^[*-]\s+.+$/m.test(content),
    sectionsCount: (content.match(/^#{1,3}\s+.+$/gm) || []).length
  };
}
