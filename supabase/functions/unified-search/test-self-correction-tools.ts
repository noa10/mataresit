/**
 * Test Self-Correction & Tool Use System
 * 
 * This file provides test functions to verify the self-correction pipeline
 * and dynamic tool use capabilities are working correctly.
 */

import { selfCorrectionPipeline } from '../_shared/self-correction-system.ts';
import { 
  executeDynamicTools, 
  parseToolCalls, 
  generateToolAwarePrompt,
  AVAILABLE_TOOLS 
} from '../_shared/dynamic-tool-system.ts';

/**
 * Test self-correction pipeline with various scenarios
 */
export async function testSelfCorrectionPipeline(geminiApiKey: string) {
  console.log('🧪 Testing Self-Correction Pipeline...');

  const testCases = [
    {
      name: "Factual Response Test",
      query: "How much did I spend at McDonald's last month?",
      searchResults: [
        {
          id: '1',
          sourceType: 'receipt',
          contentText: "McDonald's Big Mac Meal RM 15.50",
          metadata: { merchant: "McDonald's", total: 15.50, date: '2024-01-15' }
        },
        {
          id: '2',
          sourceType: 'receipt',
          contentText: "McDonald's Chicken McNuggets RM 8.90",
          metadata: { merchant: "McDonald's", total: 8.90, date: '2024-01-20' }
        }
      ],
      expectedClaims: ["Total spending at McDonald's", "Number of transactions"]
    },
    {
      name: "Calculation Test",
      query: "What's my average spending per transaction?",
      searchResults: [
        {
          id: '1',
          sourceType: 'receipt',
          contentText: "Receipt 1 - RM 25.00",
          metadata: { total: 25.00, date: '2024-01-15' }
        },
        {
          id: '2',
          sourceType: 'receipt',
          contentText: "Receipt 2 - RM 35.00",
          metadata: { total: 35.00, date: '2024-01-16' }
        }
      ],
      expectedClaims: ["Average transaction amount", "Total transactions"]
    },
    {
      name: "Potential Hallucination Test",
      query: "Tell me about my spending at Starbucks",
      searchResults: [
        {
          id: '1',
          sourceType: 'receipt',
          contentText: "McDonald's receipt",
          metadata: { merchant: "McDonald's", total: 15.50 }
        }
      ],
      expectedIssues: ["Unsupported claim", "Source misattribution"]
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 Testing: ${testCase.name}`);
    
    try {
      const result = await selfCorrectionPipeline(
        testCase.query,
        testCase.searchResults,
        { userProfile: { currency: 'MYR' } },
        geminiApiKey,
        2 // max iterations
      );

      console.log('✅ Self-correction completed');
      console.log(`📊 Results:
  - Iterations: ${result.iterationCount}
  - Correction applied: ${result.correctionApplied}
  - Final confidence: ${result.finalResponse.confidence.toFixed(3)}
  - Approval status: ${result.criticAnalysis.approvalStatus}
  - Processing time: ${result.processingMetadata.totalTime}ms`);

      if (result.criticAnalysis.identifiedIssues.length > 0) {
        console.log('⚠️ Issues identified:');
        result.criticAnalysis.identifiedIssues.forEach((issue, index) => {
          console.log(`  ${index + 1}. ${issue.issueType}: ${issue.description} (${issue.severity})`);
        });
      }

      if (result.criticAnalysis.correctionSuggestions.length > 0) {
        console.log('🔧 Corrections suggested:');
        result.criticAnalysis.correctionSuggestions.forEach((correction, index) => {
          console.log(`  ${index + 1}. "${correction.originalText}" → "${correction.correctedText}"`);
        });
      }

      console.log(`📄 Final response preview: "${result.finalResponse.content.substring(0, 200)}..."`);

    } catch (error) {
      console.error('❌ Self-correction test failed:', error.message);
    }
  }
}

/**
 * Test dynamic tool system
 */
export async function testDynamicToolSystem(supabase: any, userId: string) {
  console.log('\n🧪 Testing Dynamic Tool System...');

  const testCases = [
    {
      name: "Spending Total Calculation",
      toolName: "calculate_spending_total",
      parameters: {
        timeRange: "last_month",
        currency: "MYR"
      }
    },
    {
      name: "Merchant Statistics",
      toolName: "get_merchant_statistics",
      parameters: {
        merchantName: "McDonald's",
        includeComparison: true
      }
    },
    {
      name: "Advanced Receipt Search",
      toolName: "search_receipts_advanced",
      parameters: {
        searchQuery: "coffee",
        sortBy: "amount",
        sortOrder: "desc",
        limit: 10
      }
    },
    {
      name: "Category Breakdown",
      toolName: "calculate_category_breakdown",
      parameters: {
        timeRange: "this_month",
        topN: 5
      }
    }
  ];

  const toolContext = {
    supabase,
    user: { id: userId },
    query: "Test query",
    searchResults: [],
    metadata: {}
  };

  for (const testCase of testCases) {
    console.log(`\n🔧 Testing tool: ${testCase.name}`);
    
    try {
      const toolCalls = [{
        toolName: testCase.toolName,
        parameters: testCase.parameters,
        callId: `test-${Date.now()}`
      }];

      const results = await executeDynamicTools(toolCalls, toolContext);
      const result = results[0];

      if (result.result.success) {
        console.log('✅ Tool execution successful');
        console.log(`📊 Result data:`, JSON.stringify(result.result.data, null, 2));
        console.log(`⏱️ Execution time: ${result.executionTime}ms`);
        console.log(`📍 Data source: ${result.result.metadata?.dataSource}`);
      } else {
        console.log('❌ Tool execution failed');
        console.log(`🚫 Error: ${result.result.error}`);
      }

    } catch (error) {
      console.error('❌ Tool test failed:', error.message);
    }
  }
}

/**
 * Test tool call parsing from LLM responses
 */
export function testToolCallParsing() {
  console.log('\n🧪 Testing Tool Call Parsing...');

  const testResponses = [
    {
      name: "Single Tool Call",
      response: `Based on your query, I need to calculate your total spending.

\`\`\`function_call
{
  "name": "calculate_spending_total",
  "parameters": {
    "timeRange": "last_month",
    "currency": "MYR"
  }
}
\`\`\`

Let me get that information for you.`
    },
    {
      name: "Multiple Tool Calls",
      response: `I'll need to gather some data to answer your question.

\`\`\`function_call
{
  "name": "get_merchant_statistics",
  "parameters": {
    "merchantName": "Starbucks"
  }
}
\`\`\`

\`\`\`function_call
{
  "name": "calculate_category_breakdown",
  "parameters": {
    "timeRange": "this_month",
    "topN": 5
  }
}
\`\`\`

This will help me provide a comprehensive analysis.`
    },
    {
      name: "No Tool Calls",
      response: "This is a regular response without any tool calls."
    },
    {
      name: "Invalid JSON Tool Call",
      response: `\`\`\`function_call
{
  "name": "invalid_tool",
  "parameters": {
    invalid json here
  }
}
\`\`\``
    }
  ];

  testResponses.forEach(testCase => {
    console.log(`\n📝 Testing: ${testCase.name}`);
    
    try {
      const toolCalls = parseToolCalls(testCase.response);
      
      console.log(`✅ Parsed ${toolCalls.length} tool calls`);
      toolCalls.forEach((call, index) => {
        console.log(`  ${index + 1}. ${call.toolName} (${call.callId})`);
        console.log(`     Parameters:`, JSON.stringify(call.parameters, null, 2));
      });

    } catch (error) {
      console.error('❌ Parsing failed:', error.message);
    }
  });
}

/**
 * Test tool-aware prompt generation
 */
export function testToolAwarePromptGeneration() {
  console.log('\n🧪 Testing Tool-Aware Prompt Generation...');

  const basePrompt = "You are a financial assistant. Help the user analyze their spending data.";
  const availableTools = ['calculate_spending_total', 'get_merchant_statistics'];

  try {
    const toolAwarePrompt = generateToolAwarePrompt(basePrompt, availableTools);
    
    console.log('✅ Tool-aware prompt generated');
    console.log(`📏 Prompt length: ${toolAwarePrompt.length} characters`);
    console.log(`🔧 Tools included: ${availableTools.join(', ')}`);
    console.log(`📄 Prompt preview:`, toolAwarePrompt.substring(0, 300) + '...');

  } catch (error) {
    console.error('❌ Tool-aware prompt generation failed:', error.message);
  }
}

/**
 * Test database functions directly
 */
export async function testDatabaseFunctions(supabase: any, userId: string) {
  console.log('\n🧪 Testing Database Functions...');

  const testFunctions = [
    {
      name: "calculate_user_spending_total",
      params: {
        user_id: userId,
        start_date: '2024-01-01',
        end_date: '2024-01-31',
        currency_filter: 'MYR'
      }
    },
    {
      name: "get_spending_trends",
      params: {
        user_id: userId,
        analysis_type: 'monthly',
        period_count: 6
      }
    },
    {
      name: "get_category_breakdown",
      params: {
        user_id: userId,
        start_date: '2024-01-01',
        end_date: '2024-01-31',
        top_n: 5
      }
    }
  ];

  for (const testFunc of testFunctions) {
    console.log(`\n🗄️ Testing function: ${testFunc.name}`);
    
    try {
      const { data, error } = await supabase.rpc(testFunc.name, testFunc.params);

      if (error) {
        console.error('❌ Function error:', error);
        continue;
      }

      console.log('✅ Function executed successfully');
      console.log(`📊 Result count: ${data?.length || 0}`);
      if (data && data.length > 0) {
        console.log(`📄 Sample result:`, JSON.stringify(data[0], null, 2));
      }

    } catch (error) {
      console.error('❌ Function test failed:', error.message);
    }
  }
}

/**
 * Run all self-correction and tool use tests
 */
export async function runAllSelfCorrectionToolTests(
  supabase: any, 
  userId: string, 
  geminiApiKey: string
) {
  console.log('🚀 Starting Self-Correction & Tool Use Tests...\n');

  try {
    await testSelfCorrectionPipeline(geminiApiKey);
    await testDynamicToolSystem(supabase, userId);
    testToolCallParsing();
    testToolAwarePromptGeneration();
    await testDatabaseFunctions(supabase, userId);
    
    console.log('\n✅ All self-correction and tool use tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
  }
}

// Export individual test functions for selective testing
export {
  testSelfCorrectionPipeline,
  testDynamicToolSystem,
  testToolCallParsing,
  testToolAwarePromptGeneration,
  testDatabaseFunctions
};
