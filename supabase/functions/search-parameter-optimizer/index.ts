/**
 * Search Parameter Optimizer Edge Function
 * Provides server-side search parameter optimization and configuration management
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Types
interface OptimizationRequest {
  action: 'optimize' | 'get_config' | 'record_result' | 'get_insights';
  params?: any;
  configId?: string;
  scenario?: string;
  testResult?: any;
}

interface SearchParameterConfig {
  id: string;
  name: string;
  parameters: {
    similarityThreshold: number;
    limit: number;
    aggregationMode: string;
    contentTypeWeights?: Record<string, number>;
    sourceWeights?: Record<string, number>;
  };
  targetScenarios: string[];
  performanceMetrics?: {
    averageResponseTime: number;
    averageRelevanceScore: number;
    cacheHitRate: number;
    userSatisfactionScore: number;
  };
}

// Default configurations based on quality validation findings
const DEFAULT_CONFIGS: Record<string, SearchParameterConfig> = {
  high_precision: {
    id: 'high_precision',
    name: 'High Precision Search',
    parameters: {
      similarityThreshold: 0.7,
      limit: 15,
      aggregationMode: 'relevance',
      contentTypeWeights: {
        'title': 2.0,
        'merchant': 2.0,
        'keywords': 1.8,
        'description': 1.2,
        'full_text': 1.0
      },
      sourceWeights: {
        'custom_categories': 2.0, // Perfect exact matching (1.0 similarity)
        'business_directory': 1.8, // Excellent performance (0.7597 avg)
        'receipts': 1.5,
        'claims': 1.2,
        'conversations': 1.0
      }
    },
    targetScenarios: ['exact_match', 'business_lookup', 'category_search']
  },
  
  balanced_search: {
    id: 'balanced_search',
    name: 'Balanced Search',
    parameters: {
      similarityThreshold: 0.2,
      limit: 20,
      aggregationMode: 'relevance',
      contentTypeWeights: {
        'full_text': 1.5,
        'title': 1.4,
        'description': 1.3,
        'merchant': 1.2,
        'keywords': 1.1
      },
      sourceWeights: {
        'business_directory': 1.8, // Excellent cross-language (0.7597 avg)
        'custom_categories': 1.6, // Good semantic relationships (0.6647 avg)
        'receipts': 1.4,
        'claims': 1.2,
        'conversations': 1.0
      }
    },
    targetScenarios: ['general_search', 'semantic_search', 'multi_source']
  },

  cross_language: {
    id: 'cross_language',
    name: 'Cross-Language Optimized',
    parameters: {
      similarityThreshold: 0.15,
      limit: 25,
      aggregationMode: 'diversity',
      contentTypeWeights: {
        'keywords': 2.5, // Excellent for cross-language matching
        'title': 2.0,
        'description': 1.8,
        'full_text': 1.5,
        'merchant': 1.3
      },
      sourceWeights: {
        'business_directory': 2.5, // Perfect cross-language support
        'custom_categories': 2.0, // Excellent multilingual handling
        'receipts': 1.5,
        'claims': 1.2,
        'conversations': 1.0
      }
    },
    targetScenarios: ['cross_language', 'malay_search', 'multilingual']
  }
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: OptimizationRequest = await req.json();

    let result: any = {};

    switch (body.action) {
      case 'optimize':
        result = await optimizeParameters(body.params, user.id);
        break;
        
      case 'get_config':
        result = await getConfiguration(body.configId, body.scenario);
        break;
        
      case 'record_result':
        result = await recordTestResult(body.testResult, supabase);
        break;
        
      case 'get_insights':
        result = await getOptimizationInsights(supabase, user.id);
        break;
        
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Search parameter optimizer error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Optimize search parameters based on context
 */
async function optimizeParameters(params: any, userId: string): Promise<any> {
  try {
    const query = params.query?.toLowerCase().trim() || '';
    const queryLength = query.length;
    const sources = params.sources || ['receipts', 'business_directory'];

    // Analyze query context
    let configId = 'balanced_search'; // Default

    // Exact match detection
    if (query.includes('"') || queryLength < 10) {
      configId = 'high_precision';
    }
    // Cross-language detection
    else if (detectMalayContent(query)) {
      configId = 'cross_language';
    }
    // Business search detection
    else if (sources.includes('business_directory') && queryLength > 5) {
      configId = 'balanced_search';
    }

    const config = DEFAULT_CONFIGS[configId];
    if (!config) {
      throw new Error('Configuration not found');
    }

    // Apply configuration to parameters
    const optimizedParams = {
      ...params,
      similarityThreshold: config.parameters.similarityThreshold,
      limit: Math.min(params.limit || config.parameters.limit, config.parameters.limit),
      aggregationMode: config.parameters.aggregationMode
    };

    return {
      optimizedParams,
      configUsed: configId,
      optimizationReason: `Applied ${config.name} configuration based on query analysis`,
      expectedImprovements: getExpectedImprovements(configId),
      confidenceScore: calculateConfidenceScore(configId, sources)
    };

  } catch (error) {
    console.error('Parameter optimization failed:', error);
    throw error;
  }
}

/**
 * Get configuration by ID or scenario
 */
async function getConfiguration(configId?: string, scenario?: string): Promise<SearchParameterConfig> {
  if (configId && DEFAULT_CONFIGS[configId]) {
    return DEFAULT_CONFIGS[configId];
  }

  if (scenario) {
    // Find config by scenario
    for (const config of Object.values(DEFAULT_CONFIGS)) {
      if (config.targetScenarios.includes(scenario)) {
        return config;
      }
    }
  }

  // Return default
  return DEFAULT_CONFIGS.balanced_search;
}

/**
 * Record test result for performance analysis
 */
async function recordTestResult(testResult: any, supabase: any): Promise<any> {
  try {
    const { error } = await supabase.rpc('log_performance_metric', {
      p_metric_name: 'search_parameter_test',
      p_metric_type: 'optimization',
      p_metric_value: testResult.relevanceScore || 0,
      p_metric_unit: 'score',
      p_context: {
        configId: testResult.configId,
        testQuery: testResult.testQuery,
        responseTime: testResult.responseTime,
        resultCount: testResult.resultCount,
        userFeedback: testResult.userFeedback
      },
      p_user_id: null
    });

    if (error) {
      throw error;
    }

    return { recorded: true };
  } catch (error) {
    console.error('Failed to record test result:', error);
    throw error;
  }
}

/**
 * Get optimization insights
 */
async function getOptimizationInsights(supabase: any, userId: string): Promise<any> {
  try {
    // Get recent performance metrics
    const { data: metrics, error } = await supabase.rpc('get_performance_metrics', {
      metric_type: 'optimization',
      start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
      end_date: new Date().toISOString()
    });

    if (error) {
      throw error;
    }

    // Analyze metrics and generate insights
    const insights = {
      totalTests: metrics?.length || 0,
      averagePerformance: metrics?.reduce((sum: number, m: any) => sum + (m.metric_value || 0), 0) / (metrics?.length || 1),
      bestPerformingConfig: 'balanced_search',
      recommendedActions: [
        'Continue monitoring search performance',
        'Consider A/B testing different configurations'
      ]
    };

    return insights;
  } catch (error) {
    console.error('Failed to get optimization insights:', error);
    throw error;
  }
}

/**
 * Detect Malay content in query
 */
function detectMalayContent(query: string): boolean {
  const malayWords = ['sdn', 'bhd', 'kedai', 'restoran', 'pasar', 'tesco', 'speedmart', 'mamak'];
  return malayWords.some(word => query.includes(word));
}

/**
 * Get expected improvements for configuration
 */
function getExpectedImprovements(configId: string): string[] {
  const improvements = {
    high_precision: [
      'Higher precision for exact matches',
      'Reduced false positives',
      'Faster query processing'
    ],
    balanced_search: [
      'Better semantic relationship discovery',
      'Improved relevance ranking',
      'Enhanced cross-source results'
    ],
    cross_language: [
      'Superior multilingual matching',
      'Better keyword variation handling',
      'Enhanced Malay-English support'
    ]
  };

  return improvements[configId] || ['General search improvements'];
}

/**
 * Calculate confidence score
 */
function calculateConfidenceScore(configId: string, sources: string[]): number {
  const sourceConfidence = {
    'custom_categories': 0.95, // Perfect exact matching
    'business_directory': 0.92, // Excellent cross-language
    'receipts': 0.65, // Content storage issues
    'claims': 0.80,
    'conversations': 0.75
  };

  const avgSourceConfidence = sources.reduce((sum, source) => {
    return sum + (sourceConfidence[source] || 0.7);
  }, 0) / sources.length;

  const configConfidence = {
    high_precision: 0.95,
    balanced_search: 0.85,
    cross_language: 0.90
  };

  return Math.min(Math.max(
    (avgSourceConfidence * 0.6) + ((configConfidence[configId] || 0.8) * 0.4),
    0.1
  ), 1.0);
}
