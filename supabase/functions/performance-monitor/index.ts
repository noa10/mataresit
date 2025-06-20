/**
 * Performance Monitor Edge Function
 * Provides real-time performance monitoring and analytics
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Types
interface MonitorRequest {
  action: 'get_summary' | 'get_trends' | 'get_alerts' | 'get_dashboard' | 'log_metric';
  metric_name?: string;
  start_date?: string;
  end_date?: string;
  time_window_minutes?: number;
  metric_data?: {
    metric_name: string;
    metric_type: string;
    metric_value: number;
    metric_unit: string;
    context?: any;
  };
}

interface PerformanceAlert {
  alert_type: string;
  alert_message: string;
  metric_name: string;
  current_value: number;
  threshold_value: number;
  severity: string;
  created_at: string;
}

interface PerformanceSummary {
  metric_name: string;
  metric_type: string;
  total_count: number;
  avg_value: number;
  min_value: number;
  max_value: number;
  percentile_50: number;
  percentile_95: number;
  percentile_99: number;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    let result: any = {};

    if (req.method === 'GET') {
      // Handle GET requests for dashboard data
      const url = new URL(req.url);
      const action = url.searchParams.get('action') || 'get_dashboard';
      
      switch (action) {
        case 'get_dashboard':
          result = await getDashboardData(supabase, user.id);
          break;
        case 'get_alerts':
          result = await getPerformanceAlerts(supabase);
          break;
        default:
          return new Response(
            JSON.stringify({ error: 'Invalid GET action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
      }
    } else if (req.method === 'POST') {
      // Handle POST requests
      const body: MonitorRequest = await req.json();

      switch (body.action) {
        case 'get_summary':
          result = await getPerformanceSummary(
            supabase, 
            body.start_date, 
            body.end_date, 
            user.id
          );
          break;
          
        case 'get_trends':
          result = await getPerformanceTrends(
            supabase, 
            body.metric_name || 'search_query_time',
            body.start_date, 
            body.end_date, 
            user.id
          );
          break;
          
        case 'get_alerts':
          result = await getPerformanceAlerts(
            supabase, 
            body.time_window_minutes
          );
          break;
          
        case 'get_dashboard':
          result = await getDashboardData(supabase, user.id);
          break;
          
        case 'log_metric':
          if (!body.metric_data) {
            throw new Error('Metric data is required for log_metric action');
          }
          result = await logPerformanceMetric(supabase, body.metric_data, user.id);
          break;
          
        default:
          return new Response(
            JSON.stringify({ error: 'Invalid action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Performance monitor error:', error);
    
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
 * Get performance summary statistics
 */
async function getPerformanceSummary(
  supabase: any, 
  startDate?: string, 
  endDate?: string, 
  userId?: string
): Promise<PerformanceSummary[]> {
  try {
    const start = startDate || new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
    const end = endDate || new Date().toISOString();

    const { data, error } = await supabase.rpc('get_performance_summary', {
      p_start_date: start,
      p_end_date: end,
      p_user_id: userId
    });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to get performance summary:', error);
    throw error;
  }
}

/**
 * Get performance trends
 */
async function getPerformanceTrends(
  supabase: any, 
  metricName: string,
  startDate?: string, 
  endDate?: string, 
  userId?: string
): Promise<any[]> {
  try {
    const start = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24 hours ago
    const end = endDate || new Date().toISOString();

    const { data, error } = await supabase.rpc('get_performance_trends', {
      p_metric_name: metricName,
      p_start_date: start,
      p_end_date: end,
      p_user_id: userId
    });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to get performance trends:', error);
    throw error;
  }
}

/**
 * Get performance alerts
 */
async function getPerformanceAlerts(
  supabase: any, 
  timeWindowMinutes: number = 5
): Promise<PerformanceAlert[]> {
  try {
    const { data, error } = await supabase.rpc('get_performance_alerts', {
      p_query_time_threshold: 2000, // 2 seconds
      p_cache_hit_rate_threshold: 70, // 70%
      p_time_window_minutes: timeWindowMinutes
    });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to get performance alerts:', error);
    throw error;
  }
}

/**
 * Get dashboard data
 */
async function getDashboardData(supabase: any, userId: string): Promise<any> {
  try {
    // Get dashboard view data
    const { data: dashboardData, error: dashboardError } = await supabase
      .from('performance_dashboard')
      .select('*');

    if (dashboardError) {
      throw dashboardError;
    }

    // Get recent alerts
    const alerts = await getPerformanceAlerts(supabase, 5);

    // Get performance summary for key metrics
    const summary = await getPerformanceSummary(supabase, undefined, undefined, userId);

    // Calculate overall health score
    const queryTimeMetric = summary.find(s => s.metric_name === 'search_query_time');
    const cacheHitMetric = summary.find(s => s.metric_name === 'search_cache_hit');
    
    const avgQueryTime = queryTimeMetric?.avg_value || 0;
    const avgCacheHitRate = cacheHitMetric ? (cacheHitMetric.avg_value * 100) : 0;
    
    const healthScore = Math.round(
      (100 - Math.min(avgQueryTime / 20, 100)) * 0.6 + 
      avgCacheHitRate * 0.4
    );

    return {
      dashboard: dashboardData || [],
      alerts: alerts,
      summary: summary,
      healthScore: Math.max(0, Math.min(100, healthScore)),
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Failed to get dashboard data:', error);
    throw error;
  }
}

/**
 * Log a performance metric
 */
async function logPerformanceMetric(
  supabase: any, 
  metricData: any, 
  userId: string
): Promise<{ id: string }> {
  try {
    const { data, error } = await supabase.rpc('log_performance_metric', {
      p_metric_name: metricData.metric_name,
      p_metric_type: metricData.metric_type,
      p_metric_value: metricData.metric_value,
      p_metric_unit: metricData.metric_unit,
      p_context: metricData.context || {},
      p_user_id: userId
    });

    if (error) {
      throw error;
    }

    return { id: data };
  } catch (error) {
    console.error('Failed to log performance metric:', error);
    throw error;
  }
}
