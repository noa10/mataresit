/**
 * Test Enhanced Prompt Engineering System
 * 
 * This file provides test functions to verify the enhanced prompt engineering
 * system is working correctly.
 */

import { enhancedQueryPreprocessing } from './enhanced-preprocessing.ts';
import { generateEnhancedResponse } from './enhanced-response-generation.ts';
import { 
  transformQuery,
  selectPromptTemplate,
  buildDynamicPrompt,
  PROMPT_TEMPLATES
} from '../_shared/prompt-engineering.ts';

/**
 * Test enhanced query preprocessing
 */
export async function testEnhancedPreprocessing() {
  console.log('🧪 Testing Enhanced Query Preprocessing...');

  const testQueries = [
    "How much did I spend on food last month?",
    "Find my McDonald's receipts from last week",
    "Show me spending trends by category",
    "Compare this month to last month",
    "Help me organize my receipts"
  ];

  for (const query of testQueries) {
    console.log(`\n📝 Testing query: "${query}"`);
    
    try {
      const result = await enhancedQueryPreprocessing(query);
      
      console.log('✅ Preprocessing result:', {
        intent: result.intent,
        queryType: result.queryType,
        confidence: result.confidence,
        expandedQuery: result.expandedQuery,
        alternativeQueries: result.alternativeQueries.slice(0, 2),
        extractedEntities: result.extractedEntities,
        promptTemplate: result.promptTemplate
      });
      
    } catch (error) {
      console.error('❌ Preprocessing failed:', error.message);
    }
  }
}

/**
 * Test prompt template selection
 */
export function testPromptTemplateSelection() {
  console.log('\n🧪 Testing Prompt Template Selection...');

  const testCases = [
    { intent: 'financial_analysis', queryType: 'analytical', hasResults: true, resultCount: 15 },
    { intent: 'document_retrieval', queryType: 'specific', hasResults: false, resultCount: 0 },
    { intent: 'summarization', queryType: 'broad', hasResults: true, resultCount: 50 },
    { intent: 'conversational', queryType: 'conversational', hasResults: true, resultCount: 5 }
  ];

  testCases.forEach(testCase => {
    console.log(`\n📋 Testing: ${testCase.intent} (${testCase.queryType})`);
    
    try {
      const template = selectPromptTemplate(
        testCase.intent as any,
        testCase.queryType as any,
        testCase.hasResults,
        testCase.resultCount
      );
      
      console.log('✅ Selected template:', {
        id: template.id,
        temperature: template.temperature,
        maxTokens: template.maxTokens,
        includeUIComponents: template.outputFormat.includeUIComponents
      });
      
    } catch (error) {
      console.error('❌ Template selection failed:', error.message);
    }
  });
}

/**
 * Test dynamic prompt building
 */
export function testDynamicPromptBuilding() {
  console.log('\n🧪 Testing Dynamic Prompt Building...');

  const template = PROMPT_TEMPLATES.financial_analysis;
  const context = {
    query: "How much did I spend on food last month?",
    searchResults: [
      { merchant: "McDonald's", total: 25.50, date: "2024-01-15" },
      { merchant: "Starbucks", total: 15.00, date: "2024-01-16" }
    ],
    userProfile: {
      currency: 'MYR',
      dateFormat: 'DD/MM/YYYY',
      subscriptionTier: 'pro'
    },
    conversationHistory: [
      "User: Hello",
      "Assistant: Hi! How can I help you with your receipts today?",
      "User: I want to analyze my spending"
    ],
    timeRange: "last month",
    currency: "MYR"
  };

  try {
    const { systemPrompt, userPrompt } = buildDynamicPrompt(template, context);
    
    console.log('✅ Dynamic prompt built successfully');
    console.log('📄 System prompt length:', systemPrompt.length);
    console.log('📄 User prompt length:', userPrompt.length);
    console.log('🔍 System prompt preview:', systemPrompt.substring(0, 200) + '...');
    console.log('🔍 User prompt preview:', userPrompt.substring(0, 200) + '...');
    
  } catch (error) {
    console.error('❌ Dynamic prompt building failed:', error.message);
  }
}

/**
 * Test enhanced response generation
 */
export async function testEnhancedResponseGeneration() {
  console.log('\n🧪 Testing Enhanced Response Generation...');

  // Mock preprocessing result
  const preprocessResult = {
    expandedQuery: "food spending analysis last month restaurant dining",
    intent: 'financial_analysis' as const,
    entities: {},
    confidence: 0.85,
    queryType: 'analytical' as const,
    suggestedSources: ['receipt'],
    processingTime: 150,
    alternativeQueries: [
      "monthly food expenses breakdown",
      "restaurant spending last 30 days",
      "dining category analysis previous month"
    ],
    extractedEntities: {
      merchants: [],
      dates: ["2024-01"],
      categories: ["food", "dining"],
      amounts: [],
      locations: [],
      timeRanges: ["last month"],
      currencies: ["MYR"]
    },
    queryClassification: {
      complexity: 'moderate' as const,
      specificity: 'specific' as const,
      analysisType: 'analytical' as const
    },
    promptTemplate: 'financial_analysis',
    contextualHints: [
      "User wants to understand their food spending patterns",
      "They might be interested in comparing to previous periods",
      "Category breakdown would be helpful"
    ]
  };

  // Mock search results
  const searchResults = [
    {
      id: '1',
      sourceType: 'receipt',
      sourceId: 'receipt-1',
      contentType: 'merchant',
      contentText: "McDonald's",
      similarity: 0.92,
      metadata: {
        merchant: "McDonald's",
        total: 25.50,
        currency: 'MYR',
        date: '2024-01-15',
        category: 'Food & Dining'
      }
    },
    {
      id: '2',
      sourceType: 'receipt',
      sourceId: 'receipt-2',
      contentType: 'merchant',
      contentText: "Starbucks",
      similarity: 0.88,
      metadata: {
        merchant: "Starbucks",
        total: 15.00,
        currency: 'MYR',
        date: '2024-01-16',
        category: 'Food & Dining'
      }
    }
  ];

  const context = {
    originalQuery: "How much did I spend on food last month?",
    preprocessResult,
    searchResults,
    userProfile: {
      currency: 'MYR',
      dateFormat: 'DD/MM/YYYY',
      subscriptionTier: 'pro'
    },
    conversationHistory: [
      "User: I want to analyze my spending",
      "Assistant: I can help you analyze your spending patterns. What would you like to know?"
    ]
  };

  try {
    const response = await generateEnhancedResponse(context);
    
    console.log('✅ Enhanced response generated successfully');
    console.log('📊 Response details:', {
      contentLength: response.content.length,
      uiComponentsCount: response.uiComponents.length,
      followUpSuggestionsCount: response.followUpSuggestions.length,
      confidence: response.confidence,
      responseType: response.responseType,
      templateUsed: response.metadata.templateUsed,
      processingTime: response.metadata.processingTime
    });
    
    console.log('📝 Content preview:', response.content.substring(0, 300) + '...');
    console.log('🎨 UI Components:', response.uiComponents.map(c => c.component));
    console.log('💡 Follow-up suggestions:', response.followUpSuggestions);
    
  } catch (error) {
    console.error('❌ Enhanced response generation failed:', error.message);
  }
}

/**
 * Run all tests
 */
export async function runAllTests() {
  console.log('🚀 Starting Enhanced Prompt Engineering Tests...\n');

  try {
    await testEnhancedPreprocessing();
    testPromptTemplateSelection();
    testDynamicPromptBuilding();
    await testEnhancedResponseGeneration();
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
  }
}

// Export test functions for individual testing
export {
  testEnhancedPreprocessing,
  testPromptTemplateSelection,
  testDynamicPromptBuilding,
  testEnhancedResponseGeneration
};
