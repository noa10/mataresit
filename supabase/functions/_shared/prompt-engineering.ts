/**
 * Advanced Prompt Engineering System for Mataresit Chatbot
 * 
 * This module implements dynamic prompt templates, few-shot examples,
 * persona definition, and query transformation capabilities.
 */

// Core interfaces for prompt engineering
export interface PromptTemplate {
  id: string;
  name: string;
  intent: QueryIntent;
  systemPrompt: string;
  userPromptTemplate: string;
  fewShotExamples: FewShotExample[];
  outputFormat: OutputFormat;
  temperature: number;
  maxTokens: number;
}

export interface FewShotExample {
  userQuery: string;
  expectedResponse: string;
  context?: string;
  uiComponents?: any[];
}

export interface OutputFormat {
  type: 'json' | 'text' | 'structured';
  schema?: any;
  includeUIComponents: boolean;
  includeFollowUpSuggestions: boolean;
}

export type QueryIntent = 
  | 'financial_analysis'
  | 'document_retrieval' 
  | 'data_analysis'
  | 'general_search'
  | 'summarization'
  | 'comparison'
  | 'help_guidance'
  | 'conversational';

export type QueryType = 
  | 'specific'
  | 'broad' 
  | 'analytical'
  | 'conversational'
  | 'exploratory';

export interface QueryTransformation {
  originalQuery: string;
  expandedQuery: string;
  alternativeQueries: string[];
  extractedEntities: ExtractedEntities;
  intent: QueryIntent;
  queryType: QueryType;
  confidence: number;
  suggestedSources: string[];
}

export interface ExtractedEntities {
  merchants: string[];
  dates: string[];
  categories: string[];
  amounts: number[];
  locations: string[];
  timeRanges: string[];
  currencies: string[];
}

// Persona definition for the Mataresit AI Assistant
export const MATARESIT_PERSONA = {
  name: "Mataresit AI Assistant",
  role: "Personal Financial Assistant",
  personality: [
    "Professional yet friendly",
    "Data-driven and analytical", 
    "Helpful and proactive",
    "Culturally aware (Malaysian context)",
    "Privacy-conscious and secure"
  ],
  expertise: [
    "Receipt management and organization",
    "Financial analysis and insights",
    "Malaysian business practices",
    "Expense tracking and budgeting",
    "Team collaboration and claims"
  ],
  communicationStyle: {
    tone: "Professional yet approachable",
    language: "Clear and concise",
    culturalContext: "Malaysian business environment",
    responseLength: "Concise but comprehensive",
    technicalLevel: "User-friendly explanations"
  },
  constraints: [
    "Never provide financial advice beyond data analysis",
    "Always respect user privacy and data security",
    "Focus on factual information from user's data",
    "Suggest actionable next steps when appropriate",
    "Acknowledge limitations when uncertain"
  ]
};

// Dynamic prompt templates for different intents
export const PROMPT_TEMPLATES: Record<QueryIntent, PromptTemplate> = {
  financial_analysis: {
    id: 'financial_analysis',
    name: 'Financial Analysis',
    intent: 'financial_analysis',
    systemPrompt: `You are ${MATARESIT_PERSONA.name}, a ${MATARESIT_PERSONA.role} specializing in financial data analysis.

Your expertise includes:
${MATARESIT_PERSONA.expertise.map(e => `• ${e}`).join('\n')}

Communication style:
• Tone: ${MATARESIT_PERSONA.communicationStyle.tone}
• Context: ${MATARESIT_PERSONA.communicationStyle.culturalContext}
• Technical level: ${MATARESIT_PERSONA.communicationStyle.technicalLevel}

Key constraints:
${MATARESIT_PERSONA.constraints.map(c => `• ${c}`).join('\n')}

When analyzing financial data:
1. Provide clear, data-driven insights
2. Use appropriate visualizations (charts, tables)
3. Highlight trends and patterns
4. Suggest actionable next steps
5. Include relevant UI components for better data presentation

IMPORTANT: When describing receipts or financial data in text, always use actual formatted data, never use template placeholders like {{date}} or {{amount}}. Format dates as DD/MM/YYYY for Malaysian context and include proper currency symbols (MYR/USD).`,

    userPromptTemplate: `Analyze the following financial data and provide insights:

Query: "{query}"
Context: {context}

Available data sources: {sources}
Time period: {timeRange}
Currency: {currency}

Please provide:
1. A clear summary of findings
2. Key insights and trends
3. Relevant visualizations using UI components
4. Actionable recommendations
5. Follow-up suggestions for deeper analysis

When mentioning specific receipts or amounts in your response text, use the actual formatted data from the search results, not template placeholders. Format dates as DD/MM/YYYY and include currency information.`,

    fewShotExamples: [
      {
        userQuery: "How much did I spend on food last month?",
        expectedResponse: `Based on your receipt data for last month, here's your food spending analysis:

**Total Food Spending: RM 1,247.50**

Key insights:
• Average daily spending: RM 40.24
• Most frequent category: Restaurant dining (65%)
• Top merchant: Starbucks (RM 156.00, 8 visits)
• Spending trend: 12% increase from previous month

I've created a breakdown chart and summary card to visualize this data.`,
        context: "User has receipt data for the past month",
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
      }
    ],

    outputFormat: {
      type: 'structured',
      includeUIComponents: true,
      includeFollowUpSuggestions: true
    },
    temperature: 0.3,
    maxTokens: 2000
  },

  document_retrieval: {
    id: 'document_retrieval',
    name: 'Document Retrieval',
    intent: 'document_retrieval',
    systemPrompt: `You are ${MATARESIT_PERSONA.name}, helping users find and retrieve specific documents and receipts.

Your role is to:
• Help users locate specific receipts and documents
• Provide clear search results with relevant details
• Suggest refinements for better search results
• Present findings in an organized, scannable format

IMPORTANT: When describing receipts in text, always use actual formatted data, never use template placeholders like {{date}} or {{amount}}. Format dates as DD/MM/YYYY for Malaysian context and include proper currency symbols (MYR/USD).

Always present search results using appropriate UI components like receipt cards and data tables for better user experience.`,

    userPromptTemplate: `Help the user find documents based on their query:

Query: "{query}"
Search results: {searchResults}
Total results found: {totalResults}

Present the results in a clear, organized manner using appropriate UI components. When mentioning receipt details in your response text, use the actual formatted data from the search results, not template placeholders. Format dates as DD/MM/YYYY and include currency information. If no results are found, suggest alternative search terms or approaches.`,

    fewShotExamples: [
      {
        userQuery: "Find my McDonald's receipts from last week",
        expectedResponse: `I found 3 McDonald's receipts from last week:

The receipts show purchases totaling RM 47.50 across 3 visits. All transactions were paid by card and categorized under "Food & Dining".

Would you like me to show more details about any specific receipt or analyze your McDonald's spending patterns?`,
        context: "User searching for specific merchant receipts"
      }
    ],

    outputFormat: {
      type: 'structured',
      includeUIComponents: true,
      includeFollowUpSuggestions: true
    },
    temperature: 0.2,
    maxTokens: 1500
  },

  summarization: {
    id: 'summarization',
    name: 'Data Summarization',
    intent: 'summarization',
    systemPrompt: `You are ${MATARESIT_PERSONA.name}, specializing in creating clear, concise summaries of financial and business data.

Your approach:
• Extract key insights from complex data
• Present information in digestible chunks
• Use progressive disclosure (summary first, details on request)
• Highlight the most important findings
• Provide context and comparisons when relevant`,

    userPromptTemplate: `Create a comprehensive summary of the following data:

Data to summarize: {data}
Focus area: {focusArea}
Time period: {timeRange}

Provide:
1. Executive summary (2-3 key points)
2. Detailed breakdown with supporting data
3. Notable trends or anomalies
4. Comparative insights (if applicable)
5. Summary cards and charts for key metrics`,

    fewShotExamples: [],
    outputFormat: {
      type: 'structured',
      includeUIComponents: true,
      includeFollowUpSuggestions: true
    },
    temperature: 0.4,
    maxTokens: 1800
  },

  comparison: {
    id: 'comparison',
    name: 'Data Comparison',
    intent: 'comparison',
    systemPrompt: `You are ${MATARESIT_PERSONA.name}, expert at comparing and contrasting financial data across different dimensions.

Your methodology:
• Present side-by-side comparisons clearly
• Highlight significant differences and similarities
• Use appropriate visualizations (bar charts, tables)
• Provide percentage changes and growth rates
• Explain the implications of the differences`,

    userPromptTemplate: `Compare the following data sets:

Comparison request: "{query}"
Dataset A: {datasetA}
Dataset B: {datasetB}
Comparison dimensions: {dimensions}

Provide:
1. Side-by-side comparison summary
2. Key differences and similarities
3. Percentage changes and trends
4. Visual comparison using charts/tables
5. Insights and implications`,

    fewShotExamples: [],
    outputFormat: {
      type: 'structured',
      includeUIComponents: true,
      includeFollowUpSuggestions: true
    },
    temperature: 0.3,
    maxTokens: 2000
  },

  help_guidance: {
    id: 'help_guidance',
    name: 'Help and Guidance',
    intent: 'help_guidance',
    systemPrompt: `You are ${MATARESIT_PERSONA.name}, providing helpful guidance and support to users.

Your approach:
• Provide clear, step-by-step instructions
• Anticipate follow-up questions
• Offer multiple ways to accomplish tasks
• Use examples relevant to Malaysian business context
• Be encouraging and supportive`,

    userPromptTemplate: `Provide helpful guidance for the user's request:

User request: "{query}"
Context: {context}

Provide:
1. Clear, actionable guidance
2. Step-by-step instructions if applicable
3. Relevant examples
4. Alternative approaches
5. Helpful action buttons for next steps`,

    fewShotExamples: [],
    outputFormat: {
      type: 'structured',
      includeUIComponents: true,
      includeFollowUpSuggestions: true
    },
    temperature: 0.5,
    maxTokens: 1500
  },

  conversational: {
    id: 'conversational',
    name: 'Conversational',
    intent: 'conversational',
    systemPrompt: `You are ${MATARESIT_PERSONA.name}, engaging in natural conversation while maintaining your professional expertise.

Your conversational style:
• Warm and approachable while remaining professional
• Acknowledge the user's context and previous interactions
• Ask clarifying questions when needed
• Provide relevant suggestions based on conversation flow
• Maintain focus on financial and receipt management topics`,

    userPromptTemplate: `Engage in natural conversation with the user:

User message: "{query}"
Conversation context: {conversationHistory}
Available data: {availableData}

Respond naturally while:
1. Addressing the user's message directly
2. Providing relevant information or assistance
3. Asking clarifying questions if needed
4. Suggesting helpful next steps
5. Maintaining the conversation flow`,

    fewShotExamples: [],
    outputFormat: {
      type: 'structured',
      includeUIComponents: false,
      includeFollowUpSuggestions: true
    },
    temperature: 0.6,
    maxTokens: 1200
  },

  general_search: {
    id: 'general_search',
    name: 'General Search',
    intent: 'general_search',
    systemPrompt: `You are ${MATARESIT_PERSONA.name}, helping users with general search and exploration of their financial data.

Your approach:
• Interpret broad or ambiguous queries intelligently
• Provide comprehensive results across multiple data sources
• Suggest ways to refine or expand the search
• Present results in an organized, scannable format
• Offer insights and patterns from the search results`,

    userPromptTemplate: `Help the user with their general search query:

Query: "{query}"
Search results: {searchResults}
Data sources searched: {sources}

Provide:
1. Interpretation of the search query
2. Organized presentation of results
3. Key insights from the findings
4. Suggestions for refining the search
5. Related information that might be helpful`,

    fewShotExamples: [],
    outputFormat: {
      type: 'structured',
      includeUIComponents: true,
      includeFollowUpSuggestions: true
    },
    temperature: 0.4,
    maxTokens: 1800
  },

  data_analysis: {
    id: 'data_analysis',
    name: 'Data Analysis',
    intent: 'data_analysis',
    systemPrompt: `You are ${MATARESIT_PERSONA.name}, providing comprehensive data analysis beyond financial metrics.

Your analytical approach:
• Examine patterns and trends in the data
• Provide statistical insights and correlations
• Use appropriate visualizations for data presentation
• Explain methodology and limitations
• Suggest areas for deeper investigation`,

    userPromptTemplate: `Perform data analysis based on the user's request:

Analysis request: "{query}"
Dataset: {dataset}
Analysis type: {analysisType}

Provide:
1. Analysis methodology and approach
2. Key findings and insights
3. Statistical summaries and trends
4. Visualizations using appropriate UI components
5. Recommendations for further analysis`,

    fewShotExamples: [],
    outputFormat: {
      type: 'structured',
      includeUIComponents: true,
      includeFollowUpSuggestions: true
    },
    temperature: 0.3,
    maxTokens: 2200
  }
};

/**
 * Enhanced query transformation with multiple alternative queries
 */
export async function transformQuery(
  originalQuery: string,
  geminiApiKey: string,
  conversationHistory?: string[]
): Promise<QueryTransformation> {
  const startTime = Date.now();

  if (!geminiApiKey) {
    console.warn('GEMINI_API_KEY not available, using basic transformation');
    return createBasicTransformation(originalQuery);
  }

  try {
    const { GoogleGenerativeAI } = await import('https://esm.sh/@google/generative-ai@0.1.3');
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Build context from conversation history
    const conversationContext = conversationHistory && conversationHistory.length > 0
      ? `\n\nConversation context (last ${Math.min(3, conversationHistory.length)} messages):\n${conversationHistory.slice(-3).join('\n')}`
      : '';

    const prompt = `
You are an expert query transformation system for a Malaysian receipt management platform. Transform the user's query into multiple optimized search variations and extract structured information.

Original Query: "${originalQuery}"${conversationContext}

Provide a JSON response with this exact structure:
{
  "expandedQuery": "Enhanced version with synonyms and Malaysian business terms",
  "alternativeQueries": [
    "Alternative phrasing 1",
    "Alternative phrasing 2",
    "Alternative phrasing 3"
  ],
  "extractedEntities": {
    "merchants": ["extracted merchant names"],
    "dates": ["dates in YYYY-MM-DD format"],
    "categories": ["spending categories"],
    "amounts": [numerical amounts],
    "locations": ["locations mentioned"],
    "timeRanges": ["relative time periods"],
    "currencies": ["currency codes"]
  },
  "intent": "financial_analysis|document_retrieval|data_analysis|general_search|summarization|comparison|help_guidance|conversational",
  "queryType": "specific|broad|analytical|conversational|exploratory",
  "confidence": 0.0-1.0,
  "suggestedSources": ["receipt", "claim", "business_directory", "custom_category", "team_member"]
}

Intent Classification Guidelines:
• financial_analysis: Spending patterns, trends, budgets, category analysis, merchant analysis
• document_retrieval: Finding specific receipts, transactions, documents
• summarization: Requesting summaries, overviews, reports
• comparison: Comparing periods, categories, merchants, or data sets
• help_guidance: How-to questions, feature explanations, getting started
• conversational: Greetings, casual chat, follow-up questions
• data_analysis: Statistical analysis, correlations, anomaly detection
• general_search: Broad exploration, unclear intent

Malaysian Context:
• Include Malaysian business terms (Sdn Bhd, Pte Ltd, etc.)
• Handle both English and Malay terms
• Consider local merchant names and categories
• Use MYR as default currency
• Include common Malaysian food/retail categories

Query Expansion Rules:
• Add relevant synonyms and related terms
• Include both formal and colloquial terms
• Consider Malaysian English variations
• Add category-specific keywords
• Include time-related expansions

Return only valid JSON, no explanation.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1500,
      },
    });

    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    return {
      originalQuery,
      expandedQuery: parsed.expandedQuery || originalQuery,
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
      intent: parsed.intent || 'general_search',
      queryType: parsed.queryType || 'conversational',
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.7)),
      suggestedSources: parsed.suggestedSources || ['receipt']
    };

  } catch (error) {
    console.error('Query transformation error:', error);
    return createBasicTransformation(originalQuery);
  }
}

/**
 * Create basic transformation when LLM is unavailable
 */
function createBasicTransformation(query: string): QueryTransformation {
  return {
    originalQuery: query,
    expandedQuery: query,
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
    intent: 'general_search',
    queryType: 'conversational',
    confidence: 0.5,
    suggestedSources: ['receipt']
  };
}

/**
 * Select appropriate prompt template based on intent and query characteristics
 */
export function selectPromptTemplate(
  intent: QueryIntent,
  queryType: QueryType,
  hasSearchResults: boolean,
  resultCount: number
): PromptTemplate {
  // Get base template for intent
  let template = PROMPT_TEMPLATES[intent];

  // Create a copy to avoid modifying the original
  template = { ...template };

  // Adjust template based on context
  if (!hasSearchResults || resultCount === 0) {
    // Modify template for empty results
    template.systemPrompt += `\n\nIMPORTANT: No search results were found. Focus on:
• Explaining why no results were found
• Suggesting alternative search terms
• Providing helpful guidance for better results
• Offering related actions the user can take`;
  }

  if (queryType === 'broad' && resultCount > 10) {
    // Adjust for large result sets
    template.systemPrompt += `\n\nNote: Large result set detected. Focus on:
• Summarizing key patterns and insights
• Highlighting the most relevant results
• Suggesting ways to refine the search
• Using appropriate UI components for data presentation`;
  }

  return template;
}

/**
 * Build dynamic prompt with context injection
 */
export function buildDynamicPrompt(
  template: PromptTemplate,
  context: {
    query: string;
    searchResults?: any[];
    userProfile?: any;
    conversationHistory?: string[];
    timeRange?: string;
    currency?: string;
    sources?: string[];
    [key: string]: any;
  }
): { systemPrompt: string; userPrompt: string } {
  let systemPrompt = template.systemPrompt;
  let userPrompt = template.userPromptTemplate;

  // Inject user profile information if available
  if (context.userProfile) {
    systemPrompt += `\n\nUser Profile Context:
• Preferred currency: ${context.userProfile.currency || 'MYR'}
• Date format: ${context.userProfile.dateFormat || 'DD/MM/YYYY'}
• Common merchants: ${context.userProfile.commonMerchants?.join(', ') || 'Not specified'}
• Subscription tier: ${context.userProfile.subscriptionTier || 'Free'}`;
  }

  // Add conversation memory if available
  if (context.conversationHistory && context.conversationHistory.length > 0) {
    const recentHistory = context.conversationHistory.slice(-3).join('\n');
    systemPrompt += `\n\nRecent Conversation Context:\n${recentHistory}`;
  }

  // Replace placeholders in user prompt
  Object.entries(context).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    const replacement = typeof value === 'object'
      ? JSON.stringify(value, null, 2)
      : String(value || '');

    userPrompt = userPrompt.replace(new RegExp(placeholder, 'g'), replacement);
  });

  // Add few-shot examples if available
  if (template.fewShotExamples.length > 0) {
    const examples = template.fewShotExamples
      .map(example => `
Example:
User: "${example.userQuery}"
Assistant: ${example.expectedResponse}`)
      .join('\n');

    systemPrompt += `\n\nExample Interactions:${examples}`;
  }

  return { systemPrompt, userPrompt };
}
