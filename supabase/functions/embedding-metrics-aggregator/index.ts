// embedding-metrics-aggregator/index.ts
// Automated aggregation scheduler for embedding performance metrics
// Phase 1: Embedding Success Rate Monitoring Dashboard

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AggregationRequest {
  type: 'hourly' | 'daily' | 'cleanup' | 'all';
  force?: boolean; // Force aggregation even if already done
}

interface AggregationResult {
  success: boolean;
  type: string;
  recordsProcessed?: number;
  recordsAggregated?: number;
  recordsDeleted?: number;
  executionTime?: number;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request body
    let requestBody: AggregationRequest = { type: 'all' };
    
    if (req.method === 'POST') {
      try {
        requestBody = await req.json();
      } catch (error) {
        console.warn('Could not parse request body, using defaults:', error);
      }
    }

    const { type, force = false } = requestBody;

    console.log(`Starting embedding metrics aggregation: ${type}, force: ${force}`);

    const results: AggregationResult[] = [];

    // Perform aggregation based on type
    switch (type) {
      case 'hourly':
        results.push(await performHourlyAggregation(supabaseClient, force));
        break;
      
      case 'daily':
        results.push(await performDailyAggregation(supabaseClient, force));
        break;
      
      case 'cleanup':
        results.push(await performCleanup(supabaseClient));
        break;
      
      case 'all':
      default:
        // Run all aggregations in sequence
        results.push(await performHourlyAggregation(supabaseClient, force));
        results.push(await performDailyAggregation(supabaseClient, force));
        results.push(await performCleanup(supabaseClient));
        break;
    }

    // Calculate overall success
    const overallSuccess = results.every(result => result.success);
    const totalExecutionTime = results.reduce((sum, result) => sum + (result.executionTime || 0), 0);

    return new Response(
      JSON.stringify({
        success: overallSuccess,
        aggregationType: type,
        results,
        totalExecutionTime,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in embedding metrics aggregator:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});

/**
 * Perform hourly aggregation of embedding metrics
 */
async function performHourlyAggregation(supabaseClient: any, force: boolean): Promise<AggregationResult> {
  const startTime = performance.now();
  
  try {
    console.log('Starting hourly aggregation...');
    
    // Check if aggregation already exists for the current hour (unless forced)
    if (!force) {
      const currentHour = new Date();
      currentHour.setMinutes(0, 0, 0);
      currentHour.setHours(currentHour.getHours() - 1); // Previous hour
      
      const { data: existing, error: checkError } = await supabaseClient
        .from('embedding_hourly_stats')
        .select('id')
        .eq('hour_bucket', currentHour.toISOString())
        .limit(1);
      
      if (checkError) {
        console.warn('Error checking existing hourly stats:', checkError);
      } else if (existing && existing.length > 0) {
        console.log('Hourly aggregation already exists for this hour, skipping...');
        return {
          success: true,
          type: 'hourly',
          recordsProcessed: 0,
          recordsAggregated: 0,
          executionTime: performance.now() - startTime
        };
      }
    }

    // Call the aggregation function
    const { error } = await supabaseClient.rpc('aggregate_embedding_hourly_stats');
    
    if (error) {
      throw new Error(`Hourly aggregation failed: ${error.message}`);
    }

    // Get count of records processed (approximate)
    const { count: recordsProcessed } = await supabaseClient
      .from('embedding_performance_metrics')
      .select('*', { count: 'exact', head: true })
      .gte('embedding_start_time', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    const executionTime = performance.now() - startTime;
    
    console.log(`Hourly aggregation completed in ${executionTime.toFixed(2)}ms`);
    
    return {
      success: true,
      type: 'hourly',
      recordsProcessed: recordsProcessed || 0,
      recordsAggregated: 1, // One hour bucket
      executionTime
    };

  } catch (error) {
    console.error('Error in hourly aggregation:', error);
    
    return {
      success: false,
      type: 'hourly',
      error: error instanceof Error ? error.message : String(error),
      executionTime: performance.now() - startTime
    };
  }
}

/**
 * Perform daily aggregation of embedding metrics
 */
async function performDailyAggregation(supabaseClient: any, force: boolean): Promise<AggregationResult> {
  const startTime = performance.now();
  
  try {
    console.log('Starting daily aggregation...');
    
    // Check if aggregation already exists for yesterday (unless forced)
    if (!force) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDate = yesterday.toISOString().split('T')[0];
      
      const { data: existing, error: checkError } = await supabaseClient
        .from('embedding_daily_stats')
        .select('id')
        .eq('date_bucket', yesterdayDate)
        .limit(1);
      
      if (checkError) {
        console.warn('Error checking existing daily stats:', checkError);
      } else if (existing && existing.length > 0) {
        console.log('Daily aggregation already exists for yesterday, skipping...');
        return {
          success: true,
          type: 'daily',
          recordsProcessed: 0,
          recordsAggregated: 0,
          executionTime: performance.now() - startTime
        };
      }
    }

    // Call the aggregation function
    const { error } = await supabaseClient.rpc('aggregate_embedding_daily_stats');
    
    if (error) {
      throw new Error(`Daily aggregation failed: ${error.message}`);
    }

    // Get count of records processed (approximate)
    const { count: recordsProcessed } = await supabaseClient
      .from('embedding_performance_metrics')
      .select('*', { count: 'exact', head: true })
      .gte('embedding_start_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const executionTime = performance.now() - startTime;
    
    console.log(`Daily aggregation completed in ${executionTime.toFixed(2)}ms`);
    
    return {
      success: true,
      type: 'daily',
      recordsProcessed: recordsProcessed || 0,
      recordsAggregated: 1, // One day bucket
      executionTime
    };

  } catch (error) {
    console.error('Error in daily aggregation:', error);
    
    return {
      success: false,
      type: 'daily',
      error: error instanceof Error ? error.message : String(error),
      executionTime: performance.now() - startTime
    };
  }
}

/**
 * Perform cleanup of old metrics data
 */
async function performCleanup(supabaseClient: any): Promise<AggregationResult> {
  const startTime = performance.now();
  
  try {
    console.log('Starting metrics cleanup...');
    
    // Call the cleanup function
    const { error } = await supabaseClient.rpc('cleanup_old_embedding_metrics');
    
    if (error) {
      throw new Error(`Cleanup failed: ${error.message}`);
    }

    const executionTime = performance.now() - startTime;
    
    console.log(`Cleanup completed in ${executionTime.toFixed(2)}ms`);
    
    return {
      success: true,
      type: 'cleanup',
      recordsDeleted: 0, // Function doesn't return count
      executionTime
    };

  } catch (error) {
    console.error('Error in cleanup:', error);
    
    return {
      success: false,
      type: 'cleanup',
      error: error instanceof Error ? error.message : String(error),
      executionTime: performance.now() - startTime
    };
  }
}

/**
 * Health check endpoint
 */
export async function healthCheck(supabaseClient: any): Promise<{ healthy: boolean; checks: any }> {
  const checks = {
    database: false,
    metricsTable: false,
    aggregationFunctions: false
  };

  try {
    // Test database connection
    const { error: dbError } = await supabaseClient
      .from('embedding_performance_metrics')
      .select('id')
      .limit(1);
    
    checks.database = !dbError;

    // Test metrics table access
    const { error: metricsError } = await supabaseClient
      .from('embedding_hourly_stats')
      .select('id')
      .limit(1);
    
    checks.metricsTable = !metricsError;

    // Test aggregation functions (this is a simple check)
    checks.aggregationFunctions = checks.database && checks.metricsTable;

  } catch (error) {
    console.error('Health check error:', error);
  }

  const healthy = Object.values(checks).every(Boolean);
  
  return { healthy, checks };
}
