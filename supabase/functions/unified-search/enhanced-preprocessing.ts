/**
 * Enhanced Query Preprocessing with Advanced Prompt Engineering
 * 
 * This module provides enhanced query preprocessing capabilities using
 * the advanced prompt engineering system.
 */

import { LLMPreprocessResult } from './types.ts';
import { parseTemporalQuery, type ParsedTemporalQuery } from '../_shared/temporal-parser.ts';

export interface EnhancedPreprocessResult extends LLMPreprocessResult {
  alternativeQueries: string[];
  extractedEntities: {
    merchants: string[];
    dates: string[];
    categories: string[];
    amounts: number[];
    locations: string[];
    timeRanges: string[];
    currencies: string[];
  };
  queryClassification: {
    complexity: 'simple' | 'moderate' | 'complex';
    specificity: 'specific' | 'broad' | 'vague';
    analysisType: 'descriptive' | 'analytical' | 'exploratory';
  };
  promptTemplate: string;
  contextualHints: string[];
  // CRITICAL FIX: Add temporal routing to enhanced preprocessing
  temporalRouting?: {
    isTemporalQuery: boolean;
    hasSemanticContent: boolean;
    routingStrategy: 'date_filter_only' | 'semantic_only' | 'hybrid_temporal_semantic';
    temporalConfidence: number;
    semanticTerms: string[];
  };
  temporalParsing?: ParsedTemporalQuery;
}

/**
 * Enhanced query preprocessing with advanced prompt engineering
 */
export async function enhancedQueryPreprocessing(
  query: string,
  conversationHistory?: string[],
  userProfile?: any
): Promise<EnhancedPreprocessResult> {
  const startTime = Date.now();
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

  // CRITICAL FIX: Always run temporal parsing first
  console.log('🕐 ENHANCED PREPROCESSING: Running temporal parsing for query:', query);
  const temporalParsing = parseTemporalQuery(query);
  console.log('🕐 ENHANCED PREPROCESSING: Temporal parsing result:', {
    isTemporalQuery: temporalParsing.temporalIntent?.isTemporalQuery,
    routingStrategy: temporalParsing.temporalIntent?.routingStrategy,
    hasSemanticContent: temporalParsing.temporalIntent?.hasSemanticContent,
    dateRange: temporalParsing.dateRange
  });

  if (!geminiApiKey) {
    console.warn('GEMINI_API_KEY not available, using basic preprocessing with temporal parsing');
    return createBasicEnhancedResult(query, temporalParsing);
  }

  try {
    const { GoogleGenerativeAI } = await import('https://esm.sh/@google/generative-ai@0.1.3');
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Build context from conversation history
    const conversationContext = conversationHistory && conversationHistory.length > 0
      ? `\n\nConversation context (last ${Math.min(3, conversationHistory.length)} messages):\n${conversationHistory.slice(-3).join('\n')}`
      : '';

    // Build user profile context
    const profileContext = userProfile
      ? `\n\nUser Profile:\n• Currency: ${userProfile.currency || 'MYR'}\n• Date format: ${userProfile.dateFormat || 'DD/MM/YYYY'}\n• Subscription: ${userProfile.subscriptionTier || 'Free'}`
      : '';

    const prompt = `
You are an expert query analysis system for a Malaysian receipt management platform. Analyze the user's query and provide comprehensive preprocessing information.

CRITICAL INTENT CLASSIFICATION RULE:
- If the query asks for "receipts" or "transactions" (like "show me receipts", "find receipts", "get receipts"), classify as "document_retrieval"
- If the query asks about spending amounts or analysis (like "how much", "spending trends", "analyze"), classify as "financial_analysis"

Original Query: "${query}"${conversationContext}${profileContext}

Provide a JSON response with this exact structure:
{
  "expandedQuery": "Enhanced version with synonyms and Malaysian business terms",
  "alternativeQueries": [
    "Alternative phrasing 1 focusing on different aspects",
    "Alternative phrasing 2 with different keywords",
    "Alternative phrasing 3 with broader/narrower scope"
  ],
  "intent": "financial_analysis|document_retrieval|data_analysis|general_search|summarization|comparison|help_guidance|conversational",
  "queryType": "specific|broad|analytical|conversational|exploratory",
  "confidence": 0.0-1.0,
  "extractedEntities": {
    "merchants": ["extracted merchant names"],
    "dates": ["dates in YYYY-MM-DD format"],
    "categories": ["spending categories"],
    "amounts": [numerical amounts],
    "locations": ["locations mentioned"],
    "timeRanges": ["relative time periods like 'last month', 'this week'"],
    "currencies": ["currency codes like MYR, USD"]
  },
  "queryClassification": {
    "complexity": "simple|moderate|complex",
    "specificity": "specific|broad|vague", 
    "analysisType": "descriptive|analytical|exploratory"
  },
  "promptTemplate": "financial_analysis|document_retrieval|summarization|comparison|help_guidance|conversational|general_search|data_analysis",
  "contextualHints": [
    "Hint 1 about what the user might be looking for",
    "Hint 2 about related information they might need",
    "Hint 3 about follow-up questions they might have"
  ],
  "suggestedSources": ["receipt", "claim", "business_directory", "custom_category", "team_member"]
}

Intent Classification Guidelines:
• financial_analysis: ONLY for spending analysis, trends, budgets, category analysis, merchant frequency, anomalies. Use when user wants to ANALYZE spending behavior or get INSIGHTS.
• document_retrieval: Finding specific receipts, transactions, documents. Use when user asks for "receipts", "transactions", "show me", "find", "get", "list" with ANY filters including time periods.
• summarization: Requesting summaries, overviews, reports, monthly/yearly breakdowns
• comparison: Comparing periods, categories, merchants, or data sets side-by-side
• help_guidance: How-to questions, feature explanations, getting started, tutorials
• conversational: Greetings, casual chat, follow-up questions, clarifications
• data_analysis: Statistical analysis, correlations, pattern detection, data exploration
• general_search: Broad exploration, unclear intent, multiple possible interpretations

CRITICAL RULE: ANY query asking for "receipts" or "transactions" (regardless of time period) = document_retrieval
CRITICAL RULE: Questions about "how much", "spending", "analysis", "trends" = financial_analysis

Examples:
• document_retrieval: "Show me all receipts from last month", "Find receipts from this week", "Get my transactions from June", "receipts from last month", "all receipts last month"
• financial_analysis: "How much did I spend last month?", "What are my spending trends?", "Analyze my monthly expenses", "spending patterns"

Query Classification:
• Complexity: simple (single concept), moderate (2-3 concepts), complex (multiple concepts/conditions)
• Specificity: specific (exact criteria), broad (general category), vague (unclear requirements)
• Analysis Type: descriptive (what happened), analytical (why/how), exploratory (what if/patterns)

Malaysian Context:
• Include Malaysian business terms (Sdn Bhd, Pte Ltd, Berhad)
• Handle both English and Malay terms
• Consider local merchant names (Genting, Public Bank, Maybank, etc.)
• Use MYR as default currency
• Include common Malaysian categories (mamak, pasar, shopping mall)

Query Expansion Rules:
• Add relevant synonyms and related terms
• Include both formal and colloquial terms
• Consider Malaysian English variations
• Add category-specific keywords
• Include time-related expansions
• Add location-specific terms

Return only valid JSON, no explanation.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2000,
      },
    });

    const responseText = result.response.text();

    // 🔧 FIX: Handle markdown-wrapped JSON responses from LLM
    let cleanedResponseText = responseText.trim();

    // Remove markdown code block markers if present
    if (cleanedResponseText.startsWith('```json')) {
      cleanedResponseText = cleanedResponseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedResponseText.startsWith('```')) {
      cleanedResponseText = cleanedResponseText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // Extract JSON from the response if it contains other text
    const jsonStartIndex = cleanedResponseText.indexOf('{');
    const jsonEndIndex = cleanedResponseText.lastIndexOf('}');

    if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
      cleanedResponseText = cleanedResponseText.substring(jsonStartIndex, jsonEndIndex + 1);
    }

    console.log('🔧 DEBUG: Enhanced preprocessing JSON extraction:', {
      originalLength: responseText.length,
      cleanedLength: cleanedResponseText.length,
      hasMarkdown: responseText.includes('```'),
      preview: cleanedResponseText.substring(0, 100) + '...'
    });

    const parsed = JSON.parse(cleanedResponseText);

    return {
      expandedQuery: parsed.expandedQuery || query,
      intent: parsed.intent || 'general_search',
      entities: parsed.extractedEntities || {},
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.7)),
      queryType: parsed.queryType || 'conversational',
      suggestedSources: parsed.suggestedSources || ['receipt'],
      processingTime: Date.now() - startTime,

      // Enhanced fields
      alternativeQueries: parsed.alternativeQueries || [],
      extractedEntities: {
        merchants: parsed.extractedEntities?.merchants || [],
        dates: parsed.extractedEntities?.dates || [],
        categories: parsed.extractedEntities?.categories || [],
        amounts: parsed.extractedEntities?.amounts || [],
        locations: parsed.extractedEntities?.locations || [],
        timeRanges: parsed.extractedEntities?.timeRanges || [],
        currencies: parsed.extractedEntities?.currencies || ['MYR']
      },
      queryClassification: {
        complexity: parsed.queryClassification?.complexity || 'simple',
        specificity: parsed.queryClassification?.specificity || 'broad',
        analysisType: parsed.queryClassification?.analysisType || 'descriptive'
      },
      promptTemplate: parsed.promptTemplate || parsed.intent || 'general_search',
      contextualHints: parsed.contextualHints || [],

      // CRITICAL FIX: Include temporal routing from parsing
      temporalRouting: temporalParsing.temporalIntent,
      temporalParsing: temporalParsing
    };

  } catch (error) {
    console.error('Enhanced query preprocessing error:', error);
    return createBasicEnhancedResult(query, temporalParsing);
  }
}

/**
 * Create basic enhanced result when LLM is unavailable
 */
function createBasicEnhancedResult(query: string, temporalParsing?: ParsedTemporalQuery): EnhancedPreprocessResult {
  return {
    expandedQuery: query,
    intent: 'general_search',
    entities: {},
    confidence: 0.5,
    queryType: 'conversational',
    suggestedSources: ['receipt'],
    processingTime: 0,

    alternativeQueries: [],
    extractedEntities: {
      merchants: [],
      dates: [],
      categories: [],
      amounts: [],
      locations: [],
      timeRanges: [],
      currencies: ['MYR']
    },
    queryClassification: {
      complexity: 'simple',
      specificity: 'broad',
      analysisType: 'descriptive'
    },
    promptTemplate: 'general_search',
    contextualHints: [],

    // CRITICAL FIX: Include temporal routing even in basic result
    temporalRouting: temporalParsing?.temporalIntent,
    temporalParsing: temporalParsing
  };
}

/**
 * Generate contextual follow-up suggestions based on query analysis
 */
export async function generateContextualSuggestions(
  preprocessResult: EnhancedPreprocessResult,
  searchResults?: any[]
): Promise<string[]> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  
  if (!geminiApiKey) {
    return generateFallbackSuggestions(preprocessResult.intent);
  }

  try {
    const { GoogleGenerativeAI } = await import('https://esm.sh/@google/generative-ai@0.1.3');
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Based on the query analysis, generate 3 relevant follow-up suggestions.

Original query: "${preprocessResult.expandedQuery}"
Intent: ${preprocessResult.intent}
Query type: ${preprocessResult.queryType}
Complexity: ${preprocessResult.queryClassification.complexity}
Results found: ${searchResults?.length || 0}

Generate follow-up suggestions that are:
• Relevant to the current context and intent
• Actionable and specific to receipt management
• Help the user explore related information
• Appropriate for Malaysian business context
• Progressive (build on current query)

Return as a JSON array of strings:
["suggestion 1", "suggestion 2", "suggestion 3"]`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 300,
      },
    });

    const responseText = result.response.text();

    // 🔧 FIX: Handle markdown-wrapped JSON responses from LLM
    let cleanedResponseText = responseText.trim();

    // Remove markdown code block markers if present
    if (cleanedResponseText.startsWith('```json')) {
      cleanedResponseText = cleanedResponseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedResponseText.startsWith('```')) {
      cleanedResponseText = cleanedResponseText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // Extract JSON from the response if it contains other text
    const jsonStartIndex = cleanedResponseText.indexOf('[');
    const jsonEndIndex = cleanedResponseText.lastIndexOf(']');

    if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
      cleanedResponseText = cleanedResponseText.substring(jsonStartIndex, jsonEndIndex + 1);
    }

    console.log('🔧 DEBUG: Contextual suggestions JSON extraction:', {
      originalLength: responseText.length,
      cleanedLength: cleanedResponseText.length,
      hasMarkdown: responseText.includes('```'),
      preview: cleanedResponseText.substring(0, 100) + '...'
    });

    const suggestions = JSON.parse(cleanedResponseText);
    
    return Array.isArray(suggestions) ? suggestions.slice(0, 3) : [];

  } catch (error) {
    console.error('Contextual suggestion generation error:', error);
    return generateFallbackSuggestions(preprocessResult.intent);
  }
}

/**
 * Generate fallback suggestions when LLM fails
 */
function generateFallbackSuggestions(intent: string): string[] {
  const suggestions: Record<string, string[]> = {
    financial_analysis: [
      "Show me spending trends for this category",
      "Compare this month to last month", 
      "Find my top merchants in this category"
    ],
    document_retrieval: [
      "Show me more receipts from this merchant",
      "Find receipts from the same time period",
      "Search for similar transactions"
    ],
    summarization: [
      "Break down by category",
      "Show me the details",
      "Compare to previous period"
    ],
    comparison: [
      "Show me the trend over time",
      "Break down the differences", 
      "Analyze the patterns"
    ],
    help_guidance: [
      "Show me more features",
      "How do I upload receipts?",
      "What can I ask you?"
    ],
    conversational: [
      "Tell me more about my spending",
      "What insights do you have?",
      "Help me organize my receipts"
    ]
  };

  return suggestions[intent] || [
    "Refine my search",
    "Show me related results", 
    "Search in a different category"
  ];
}
