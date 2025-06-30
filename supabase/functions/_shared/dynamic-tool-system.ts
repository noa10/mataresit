/**
 * Dynamic Tool Use System for Function Calling
 * 
 * This module implements dynamic tool use capabilities that allow the LLM to call
 * specific database functions and perform calculations for precise data retrieval.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ParameterDefinition>;
    required: string[];
  };
  implementation: ToolImplementation;
}

export interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  items?: ParameterDefinition;
}

export interface ToolImplementation {
  type: 'database_function' | 'calculation' | 'data_transformation' | 'external_api';
  handler: (params: any, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  supabase: any;
  user: any;
  query: string;
  searchResults?: any[];
  metadata?: any;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTime: number;
    dataSource: string;
    recordsAffected?: number;
  };
}

export interface ToolCall {
  toolName: string;
  parameters: any;
  callId: string;
}

export interface ToolCallResult {
  callId: string;
  toolName: string;
  result: ToolResult;
  executionTime: number;
}

/**
 * Available tools for dynamic function calling
 */
export const AVAILABLE_TOOLS: Record<string, ToolDefinition> = {
  calculate_spending_total: {
    name: 'calculate_spending_total',
    description: 'Calculate total spending for a specific time period, merchant, or category',
    parameters: {
      type: 'object',
      properties: {
        timeRange: {
          type: 'string',
          description: 'Time range for calculation (e.g., "last_month", "this_year", "2024-01")',
        },
        merchant: {
          type: 'string',
          description: 'Specific merchant name to filter by (optional)',
        },
        category: {
          type: 'string',
          description: 'Spending category to filter by (optional)',
        },
        currency: {
          type: 'string',
          description: 'Currency code (default: MYR)',
          enum: ['MYR', 'USD', 'SGD', 'EUR']
        }
      },
      required: ['timeRange']
    },
    implementation: {
      type: 'database_function',
      handler: calculateSpendingTotal
    }
  },

  get_merchant_statistics: {
    name: 'get_merchant_statistics',
    description: 'Get detailed statistics for a specific merchant including frequency, total spending, and trends',
    parameters: {
      type: 'object',
      properties: {
        merchantName: {
          type: 'string',
          description: 'Name of the merchant to analyze'
        },
        timeRange: {
          type: 'string',
          description: 'Time range for analysis (optional, defaults to all time)'
        },
        includeComparison: {
          type: 'boolean',
          description: 'Whether to include comparison with other merchants'
        }
      },
      required: ['merchantName']
    },
    implementation: {
      type: 'database_function',
      handler: getMerchantStatistics
    }
  },

  analyze_spending_trends: {
    name: 'analyze_spending_trends',
    description: 'Analyze spending trends over time with period-over-period comparisons',
    parameters: {
      type: 'object',
      properties: {
        analysisType: {
          type: 'string',
          description: 'Type of trend analysis',
          enum: ['monthly', 'weekly', 'daily', 'yearly']
        },
        category: {
          type: 'string',
          description: 'Specific category to analyze (optional)'
        },
        periodCount: {
          type: 'number',
          description: 'Number of periods to include in analysis',
          minimum: 1,
          maximum: 24
        }
      },
      required: ['analysisType']
    },
    implementation: {
      type: 'calculation',
      handler: analyzeSpendingTrends
    }
  },

  search_receipts_advanced: {
    name: 'search_receipts_advanced',
    description: 'Perform advanced receipt search with multiple filters and sorting options',
    parameters: {
      type: 'object',
      properties: {
        searchQuery: {
          type: 'string',
          description: 'Text to search for in receipts'
        },
        dateRange: {
          type: 'object',
          description: 'Date range filter',
          properties: {
            startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
            endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' }
          }
        },
        amountRange: {
          type: 'object',
          description: 'Amount range filter',
          properties: {
            minAmount: { type: 'number', description: 'Minimum amount' },
            maxAmount: { type: 'number', description: 'Maximum amount' }
          }
        },
        merchants: {
          type: 'array',
          description: 'List of merchants to filter by',
          items: { type: 'string' }
        },
        categories: {
          type: 'array',
          description: 'List of categories to filter by',
          items: { type: 'string' }
        },
        sortBy: {
          type: 'string',
          description: 'Sort field',
          enum: ['date', 'amount', 'merchant', 'relevance']
        },
        sortOrder: {
          type: 'string',
          description: 'Sort order',
          enum: ['asc', 'desc']
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
          minimum: 1,
          maximum: 100
        }
      },
      required: []
    },
    implementation: {
      type: 'database_function',
      handler: searchReceiptsAdvanced
    }
  },

  calculate_category_breakdown: {
    name: 'calculate_category_breakdown',
    description: 'Calculate spending breakdown by category with percentages and comparisons',
    parameters: {
      type: 'object',
      properties: {
        timeRange: {
          type: 'string',
          description: 'Time range for breakdown analysis'
        },
        includeSubcategories: {
          type: 'boolean',
          description: 'Whether to include subcategory breakdown'
        },
        minimumAmount: {
          type: 'number',
          description: 'Minimum amount to include in breakdown'
        },
        topN: {
          type: 'number',
          description: 'Number of top categories to return',
          minimum: 1,
          maximum: 20
        }
      },
      required: ['timeRange']
    },
    implementation: {
      type: 'calculation',
      handler: calculateCategoryBreakdown
    }
  },

  get_receipt_details: {
    name: 'get_receipt_details',
    description: 'Get detailed information about a specific receipt including line items and metadata',
    parameters: {
      type: 'object',
      properties: {
        receiptId: {
          type: 'string',
          description: 'UUID of the receipt to retrieve'
        },
        includeLineItems: {
          type: 'boolean',
          description: 'Whether to include line item details'
        },
        includeImages: {
          type: 'boolean',
          description: 'Whether to include image URLs'
        }
      },
      required: ['receiptId']
    },
    implementation: {
      type: 'database_function',
      handler: getReceiptDetails
    }
  }
};

/**
 * Execute dynamic tool calls based on LLM function calling
 */
export async function executeDynamicTools(
  toolCalls: ToolCall[],
  context: ToolContext
): Promise<ToolCallResult[]> {
  const results: ToolCallResult[] = [];

  console.log(`🔧 Executing ${toolCalls.length} tool calls...`);

  for (const toolCall of toolCalls) {
    const startTime = Date.now();
    
    try {
      const tool = AVAILABLE_TOOLS[toolCall.toolName];
      
      if (!tool) {
        results.push({
          callId: toolCall.callId,
          toolName: toolCall.toolName,
          result: {
            success: false,
            error: `Unknown tool: ${toolCall.toolName}`
          },
          executionTime: Date.now() - startTime
        });
        continue;
      }

      console.log(`🔧 Executing tool: ${toolCall.toolName}`);
      
      // Validate parameters
      const validationError = validateToolParameters(toolCall.parameters, tool.parameters);
      if (validationError) {
        results.push({
          callId: toolCall.callId,
          toolName: toolCall.toolName,
          result: {
            success: false,
            error: `Parameter validation failed: ${validationError}`
          },
          executionTime: Date.now() - startTime
        });
        continue;
      }

      // Execute tool
      const result = await tool.implementation.handler(toolCall.parameters, context);
      
      results.push({
        callId: toolCall.callId,
        toolName: toolCall.toolName,
        result,
        executionTime: Date.now() - startTime
      });

      console.log(`✅ Tool ${toolCall.toolName} completed in ${Date.now() - startTime}ms`);

    } catch (error) {
      console.error(`❌ Tool ${toolCall.toolName} failed:`, error);
      
      results.push({
        callId: toolCall.callId,
        toolName: toolCall.toolName,
        result: {
          success: false,
          error: error.message || 'Tool execution failed'
        },
        executionTime: Date.now() - startTime
      });
    }
  }

  return results;
}

/**
 * Parse tool calls from LLM response
 */
export function parseToolCalls(llmResponse: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  
  // Look for function call patterns in the response
  const functionCallRegex = /```function_call\s*\n([\s\S]*?)\n```/g;
  let match;
  let callIndex = 0;

  while ((match = functionCallRegex.exec(llmResponse)) !== null) {
    try {
      const functionCallData = JSON.parse(match[1]);
      
      toolCalls.push({
        toolName: functionCallData.name || functionCallData.function,
        parameters: functionCallData.parameters || functionCallData.arguments || {},
        callId: `call-${callIndex++}`
      });
    } catch (parseError) {
      console.warn('Failed to parse function call:', match[1]);
    }
  }

  return toolCalls;
}

/**
 * Generate tool-aware prompt for LLM
 */
export function generateToolAwarePrompt(
  basePrompt: string,
  availableTools: string[] = Object.keys(AVAILABLE_TOOLS)
): string {
  const toolDescriptions = availableTools.map(toolName => {
    const tool = AVAILABLE_TOOLS[toolName];
    return `- **${tool.name}**: ${tool.description}
  Parameters: ${JSON.stringify(tool.parameters, null, 2)}`;
  }).join('\n\n');

  return `${basePrompt}

AVAILABLE TOOLS:
You have access to the following tools for precise data retrieval and calculations:

${toolDescriptions}

TOOL USAGE INSTRUCTIONS:
When you need to use a tool, include a function call in your response using this format:

\`\`\`function_call
{
  "name": "tool_name",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  }
}
\`\`\`

You can make multiple tool calls in a single response. The tools will be executed and their results will be available for your final response.

IMPORTANT:
- Only use tools when you need specific data that isn't available in the search results
- Always explain why you're using each tool
- Include the tool results in your final response
- If a tool call fails, acknowledge it and provide alternative information`;
}

/**
 * Tool implementation functions
 */
async function calculateSpendingTotal(params: any, context: ToolContext): Promise<ToolResult> {
  const startTime = Date.now();
  
  try {
    // Convert time range to date filter
    const dateFilter = parseTimeRange(params.timeRange);
    
    const { data, error } = await context.supabase.rpc('calculate_user_spending_total', {
      user_id: context.user.id,
      start_date: dateFilter.startDate,
      end_date: dateFilter.endDate,
      merchant_filter: params.merchant || null,
      category_filter: params.category || null,
      currency_filter: params.currency || 'MYR'
    });

    if (error) {
      return {
        success: false,
        error: `Database error: ${error.message}`
      };
    }

    return {
      success: true,
      data: {
        totalAmount: data[0]?.total_amount || 0,
        currency: params.currency || 'MYR',
        transactionCount: data[0]?.transaction_count || 0,
        timeRange: params.timeRange,
        filters: {
          merchant: params.merchant,
          category: params.category
        }
      },
      metadata: {
        executionTime: Date.now() - startTime,
        dataSource: 'receipts_table',
        recordsAffected: data[0]?.transaction_count || 0
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      metadata: {
        executionTime: Date.now() - startTime,
        dataSource: 'error'
      }
    };
  }
}

async function getMerchantStatistics(params: any, context: ToolContext): Promise<ToolResult> {
  const startTime = Date.now();
  
  try {
    const { data, error } = await context.supabase.rpc('get_merchant_statistics', {
      user_id: context.user.id,
      merchant_name: params.merchantName,
      time_range: params.timeRange || null,
      include_comparison: params.includeComparison || false
    });

    if (error) {
      return {
        success: false,
        error: `Database error: ${error.message}`
      };
    }

    return {
      success: true,
      data: data[0] || {},
      metadata: {
        executionTime: Date.now() - startTime,
        dataSource: 'receipts_table'
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      metadata: {
        executionTime: Date.now() - startTime,
        dataSource: 'error'
      }
    };
  }
}

async function analyzeSpendingTrends(params: any, context: ToolContext): Promise<ToolResult> {
  // Implementation for spending trend analysis
  // This would involve complex calculations and data aggregation
  return {
    success: true,
    data: {
      analysisType: params.analysisType,
      trends: [], // Placeholder for trend data
      insights: []
    },
    metadata: {
      executionTime: 100,
      dataSource: 'calculated'
    }
  };
}

async function searchReceiptsAdvanced(params: any, context: ToolContext): Promise<ToolResult> {
  // Implementation for advanced receipt search
  return {
    success: true,
    data: {
      receipts: [],
      totalCount: 0,
      filters: params
    },
    metadata: {
      executionTime: 150,
      dataSource: 'receipts_table'
    }
  };
}

async function calculateCategoryBreakdown(params: any, context: ToolContext): Promise<ToolResult> {
  // Implementation for category breakdown calculation
  return {
    success: true,
    data: {
      categories: [],
      totalAmount: 0,
      timeRange: params.timeRange
    },
    metadata: {
      executionTime: 120,
      dataSource: 'calculated'
    }
  };
}

async function getReceiptDetails(params: any, context: ToolContext): Promise<ToolResult> {
  const startTime = Date.now();
  
  try {
    const { data, error } = await context.supabase
      .from('receipts')
      .select('*')
      .eq('id', params.receiptId)
      .eq('user_id', context.user.id)
      .single();

    if (error) {
      return {
        success: false,
        error: `Receipt not found: ${error.message}`
      };
    }

    return {
      success: true,
      data: data,
      metadata: {
        executionTime: Date.now() - startTime,
        dataSource: 'receipts_table',
        recordsAffected: 1
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      metadata: {
        executionTime: Date.now() - startTime,
        dataSource: 'error'
      }
    };
  }
}

/**
 * Helper functions
 */
function validateToolParameters(params: any, schema: any): string | null {
  // Basic parameter validation
  for (const requiredParam of schema.required || []) {
    if (params[requiredParam] === undefined) {
      return `Missing required parameter: ${requiredParam}`;
    }
  }
  return null;
}

function parseTimeRange(timeRange: string): { startDate: string; endDate: string } {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;

  switch (timeRange.toLowerCase()) {
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'last_week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'this_year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      // Try to parse as YYYY-MM format
      if (/^\d{4}-\d{2}$/.test(timeRange)) {
        const [year, month] = timeRange.split('-').map(Number);
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0);
      } else {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}
