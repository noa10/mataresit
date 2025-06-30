/**
 * Advanced Response Generation System
 * 
 * Generates intelligent, context-aware responses using dynamic prompt templates
 * and structured output formatting.
 */

import {
  PromptTemplate,
  QueryIntent,
  QueryTransformation,
  selectPromptTemplate,
  buildDynamicPrompt,
  MATARESIT_PERSONA
} from './prompt-engineering.ts';

export interface ResponseGenerationContext {
  query: string;
  queryTransformation: QueryTransformation;
  searchResults?: any[];
  userProfile?: UserProfile;
  conversationHistory?: string[];
  timeRange?: string;
  currency?: string;
  sources?: string[];
  metadata?: Record<string, any>;
}

export interface UserProfile {
  currency?: string;
  dateFormat?: string;
  commonMerchants?: string[];
  subscriptionTier?: 'free' | 'pro' | 'max';
  language?: 'en' | 'ms';
  preferences?: Record<string, any>;
}

export interface GeneratedResponse {
  content: string;
  uiComponents?: any[];
  followUpSuggestions?: string[];
  confidence: number;
  responseType: 'success' | 'partial' | 'empty' | 'error';
  metadata: {
    templateUsed: string;
    processingTime: number;
    tokensUsed?: number;
    modelUsed: string;
  };
}

/**
 * Generate intelligent response using advanced prompt engineering
 */
export async function generateIntelligentResponse(
  context: ResponseGenerationContext,
  geminiApiKey: string,
  modelName: string = 'gemini-1.5-flash'
): Promise<GeneratedResponse> {
  const startTime = Date.now();

  try {
    // Select appropriate prompt template
    const template = selectPromptTemplate(
      context.queryTransformation.intent,
      context.queryTransformation.queryType,
      Boolean(context.searchResults && context.searchResults.length > 0),
      context.searchResults?.length || 0
    );

    // Build dynamic prompt with context
    const { systemPrompt, userPrompt } = buildDynamicPrompt(template, {
      query: context.query,
      searchResults: context.searchResults,
      userProfile: context.userProfile,
      conversationHistory: context.conversationHistory,
      timeRange: context.timeRange,
      currency: context.currency || context.userProfile?.currency || 'MYR',
      sources: context.sources,
      totalResults: context.searchResults?.length || 0,
      ...context.metadata
    });

    // Generate response using Gemini
    const { GoogleGenerativeAI } = await import('https://esm.sh/@google/generative-ai@0.1.3');
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
      ],
      generationConfig: {
        temperature: template.temperature,
        maxOutputTokens: template.maxTokens,
      },
    });

    const responseText = result.response.text();

    // Parse structured response if expected
    let parsedResponse = await parseStructuredResponse(responseText, template);

    // Determine response type
    const responseType = determineResponseType(context, parsedResponse);

    // Generate follow-up suggestions if enabled
    const followUpSuggestions = template.outputFormat.includeFollowUpSuggestions
      ? await generateFollowUpSuggestions(context, parsedResponse, geminiApiKey)
      : [];

    return {
      content: parsedResponse.content || responseText,
      uiComponents: parsedResponse.uiComponents || [],
      followUpSuggestions,
      confidence: calculateResponseConfidence(context, parsedResponse),
      responseType,
      metadata: {
        templateUsed: template.id,
        processingTime: Date.now() - startTime,
        tokensUsed: result.response.usageMetadata?.totalTokenCount,
        modelUsed: modelName
      }
    };

  } catch (error) {
    console.error('Response generation error:', error);
    
    // Fallback to basic response
    return generateFallbackResponse(context, error.message);
  }
}

/**
 * Parse structured response from LLM output
 */
async function parseStructuredResponse(
  responseText: string,
  template: PromptTemplate
): Promise<{ content: string; uiComponents?: any[] }> {
  if (template.outputFormat.type === 'json') {
    try {
      const parsed = JSON.parse(responseText);
      return {
        content: parsed.content || parsed.response || responseText,
        uiComponents: parsed.uiComponents || []
      };
    } catch {
      // If JSON parsing fails, treat as text
      return { content: responseText };
    }
  }

  if (template.outputFormat.type === 'structured') {
    // Look for JSON blocks in the response
    const jsonBlockRegex = /```(?:json|ui_component)\s*\n([\s\S]*?)\n```/g;
    const uiComponents: any[] = [];
    let cleanedContent = responseText;

    let match;
    while ((match = jsonBlockRegex.exec(responseText)) !== null) {
      try {
        const jsonData = JSON.parse(match[1]);
        if (jsonData.type === 'ui_component') {
          uiComponents.push(jsonData);
          // Remove the JSON block from content
          cleanedContent = cleanedContent.replace(match[0], '').trim();
        }
      } catch {
        // Skip invalid JSON blocks
      }
    }

    return {
      content: cleanedContent,
      uiComponents: uiComponents.length > 0 ? uiComponents : undefined
    };
  }

  return { content: responseText };
}

/**
 * Determine response type based on context and results
 */
function determineResponseType(
  context: ResponseGenerationContext,
  parsedResponse: any
): 'success' | 'partial' | 'empty' | 'error' {
  const hasResults = context.searchResults && context.searchResults.length > 0;
  const hasContent = parsedResponse.content && parsedResponse.content.trim().length > 0;

  if (!hasContent) {
    return 'error';
  }

  if (!hasResults && context.queryTransformation.intent === 'document_retrieval') {
    return 'empty';
  }

  if (hasResults && context.searchResults!.length < 3 && 
      context.queryTransformation.queryType === 'specific') {
    return 'partial';
  }

  return 'success';
}

/**
 * Calculate confidence score for the response
 */
function calculateResponseConfidence(
  context: ResponseGenerationContext,
  parsedResponse: any
): number {
  let confidence = context.queryTransformation.confidence;

  // Adjust based on search results
  if (context.searchResults) {
    const resultCount = context.searchResults.length;
    if (resultCount === 0) {
      confidence *= 0.3;
    } else if (resultCount < 3) {
      confidence *= 0.7;
    } else if (resultCount > 10) {
      confidence *= 0.9;
    }
  }

  // Adjust based on response quality
  if (parsedResponse.uiComponents && parsedResponse.uiComponents.length > 0) {
    confidence *= 1.1;
  }

  if (parsedResponse.content && parsedResponse.content.length > 100) {
    confidence *= 1.05;
  }

  return Math.max(0.1, Math.min(1.0, confidence));
}

/**
 * Generate contextual follow-up suggestions
 */
async function generateFollowUpSuggestions(
  context: ResponseGenerationContext,
  parsedResponse: any,
  geminiApiKey: string
): Promise<string[]> {
  try {
    const { GoogleGenerativeAI } = await import('https://esm.sh/@google/generative-ai@0.1.3');
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Based on the user's query and the response provided, suggest 2-3 relevant follow-up questions or actions.

Original query: "${context.query}"
Query intent: ${context.queryTransformation.intent}
Response provided: ${parsedResponse.content?.substring(0, 200)}...

Generate follow-up suggestions that are:
• Relevant to the current context
• Actionable and specific
• Help the user explore related information
• Appropriate for a Malaysian business context

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
    const suggestions = JSON.parse(responseText);
    
    return Array.isArray(suggestions) ? suggestions.slice(0, 3) : [];

  } catch (error) {
    console.error('Follow-up suggestion generation error:', error);
    
    // Fallback suggestions based on intent
    return generateFallbackSuggestions(context.queryTransformation.intent);
  }
}

/**
 * Generate fallback suggestions when LLM fails
 */
function generateFallbackSuggestions(intent: QueryIntent): string[] {
  const suggestions: Record<QueryIntent, string[]> = {
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
    ],
    general_search: [
      "Refine my search",
      "Show me related results",
      "Search in a different category"
    ],
    data_analysis: [
      "Show me the patterns",
      "Analyze the trends",
      "Find anomalies in my data"
    ]
  };

  return suggestions[intent] || suggestions.general_search;
}

/**
 * Generate fallback response when main generation fails
 */
function generateFallbackResponse(
  context: ResponseGenerationContext,
  errorMessage: string
): GeneratedResponse {
  const fallbackContent = `I apologize, but I encountered an issue processing your request. Let me try to help you in a different way.

Your query: "${context.query}"

${context.searchResults && context.searchResults.length > 0 
  ? `I found ${context.searchResults.length} results that might be relevant to your search.`
  : 'I wasn\'t able to find specific results for your query, but I can help you refine your search or explore your data in other ways.'
}

Please try rephrasing your question or let me know if you'd like help with something specific.`;

  return {
    content: fallbackContent,
    uiComponents: [],
    followUpSuggestions: generateFallbackSuggestions(context.queryTransformation.intent),
    confidence: 0.3,
    responseType: 'error',
    metadata: {
      templateUsed: 'fallback',
      processingTime: 0,
      modelUsed: 'fallback'
    }
  };
}
