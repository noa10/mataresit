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

Present the results in an organized manner using receipt cards and data tables. When mentioning receipt details in your response text, use the actual formatted data from the search results, not template placeholders. Format dates as DD/MM/YYYY and include currency information. If no results, suggest alternative search approaches.`,
      temperature: 0.2,
      maxTokens: 1500,
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
      systemPrompt: `You are Mataresit AI Assistant, engaging in natural conversation while maintaining professional expertise in financial management.

IMPORTANT: When describing receipts or financial data in text, always use actual formatted data, never use template placeholders like {{date}} or {{amount}}. Format dates as DD/MM/YYYY for Malaysian context and include proper currency symbols (MYR/USD).`,
      userPromptTemplate: `Respond naturally to: "{query}"

Context: {conversationHistory}
Available data: {searchResults}

Engage naturally while providing helpful information and suggestions. When mentioning specific receipts or amounts, use the actual formatted data from the search results, not template placeholders. Format dates as DD/MM/YYYY and include currency information.`,
      temperature: 0.6,
      maxTokens: 1200,
      includeUIComponents: false,
      includeFollowUps: true
    }
  };

  // Get base strategy or default to general
  let strategy = strategies[intent] || strategies.conversational;

  // Adjust strategy based on results
  if (!hasResults && intent === 'document_retrieval') {
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
  
  const substitutions = {
    query: context.originalQuery,
    searchResults: JSON.stringify(context.searchResults.slice(0, 10), null, 2),
    resultCount: context.searchResults.length,
    queryClassification: JSON.stringify(context.preprocessResult.queryClassification),
    conversationHistory: context.conversationHistory?.slice(-3).join('\n') || '',
    intent: context.preprocessResult.intent,
    extractedEntities: JSON.stringify(context.preprocessResult.extractedEntities)
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
          merchant: result.metadata?.merchant || 'Unknown Merchant',
          total: result.metadata?.total || 0,
          currency: result.metadata?.currency || 'MYR',
          date: result.metadata?.date || new Date().toISOString().split('T')[0],
          category: result.metadata?.category,
          confidence: result.similarity || 0.8
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

  if (!hasContent) return 'error';
  if (!hasResults && context.preprocessResult.intent === 'document_retrieval') return 'empty';
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
