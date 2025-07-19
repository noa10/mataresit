/**
 * Alert Rule Evaluator Edge Function
 * Webhook endpoint for triggering alert rule evaluation
 * Task 2: Implement Real-time Alert Trigger Engine - External Triggers
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface EvaluationRequest {
  ruleId?: string;
  teamId?: string;
  force?: boolean;
  source?: string;
}

interface EvaluationResult {
  success: boolean;
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  metricValue?: number;
  thresholdValue: number;
  severity: string;
  reason?: string;
  evaluationTime: number;
}

interface EvaluationResponse {
  success: boolean;
  message: string;
  results: EvaluationResult[];
  summary: {
    totalRules: number;
    triggeredAlerts: number;
    evaluationTime: number;
  };
  timestamp: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  const startTime = Date.now();

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const requestBody: EvaluationRequest = await req.json();
    const { ruleId, teamId, force = false, source = 'webhook' } = requestBody;

    console.log(`Alert rule evaluation triggered:`, {
      ruleId,
      teamId,
      force,
      source,
      timestamp: new Date().toISOString()
    });

    const results: EvaluationResult[] = [];
    let triggeredAlerts = 0;

    if (ruleId) {
      // Evaluate specific rule
      const result = await evaluateSpecificRule(supabaseClient, ruleId);
      if (result) {
        results.push(result);
        if (result.triggered) triggeredAlerts++;
      }
    } else {
      // Evaluate all rules for team or all teams
      const rules = await getAlertRules(supabaseClient, teamId);
      
      for (const rule of rules) {
        try {
          const result = await evaluateRule(supabaseClient, rule);
          results.push(result);
          if (result.triggered) triggeredAlerts++;
        } catch (error) {
          console.error(`Error evaluating rule ${rule.id}:`, error);
          results.push({
            success: false,
            ruleId: rule.id,
            ruleName: rule.name,
            triggered: false,
            thresholdValue: rule.threshold_value,
            severity: rule.severity,
            reason: `Evaluation error: ${error.message}`,
            evaluationTime: 0
          });
        }
      }
    }

    const totalEvaluationTime = Date.now() - startTime;

    const response: EvaluationResponse = {
      success: true,
      message: `Evaluated ${results.length} alert rules`,
      results,
      summary: {
        totalRules: results.length,
        triggeredAlerts,
        evaluationTime: totalEvaluationTime
      },
      timestamp: new Date().toISOString()
    };

    console.log(`Alert evaluation completed:`, {
      totalRules: results.length,
      triggeredAlerts,
      evaluationTime: totalEvaluationTime
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Alert rule evaluation error:', error);

    const errorResponse = {
      success: false,
      message: `Alert evaluation failed: ${error.message}`,
      results: [],
      summary: {
        totalRules: 0,
        triggeredAlerts: 0,
        evaluationTime: Date.now() - startTime
      },
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});

async function getAlertRules(supabaseClient: any, teamId?: string) {
  let query = supabaseClient
    .from('alert_rules')
    .select('*')
    .eq('enabled', true);

  if (teamId) {
    query = query.eq('team_id', teamId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch alert rules: ${error.message}`);
  }

  return data || [];
}

async function evaluateSpecificRule(supabaseClient: any, ruleId: string): Promise<EvaluationResult | null> {
  const { data: rule, error } = await supabaseClient
    .from('alert_rules')
    .select('*')
    .eq('id', ruleId)
    .eq('enabled', true)
    .single();

  if (error || !rule) {
    console.error(`Rule not found or disabled: ${ruleId}`);
    return null;
  }

  return await evaluateRule(supabaseClient, rule);
}

async function evaluateRule(supabaseClient: any, rule: any): Promise<EvaluationResult> {
  const startTime = Date.now();

  try {
    // Get current metric value
    const metricValue = await getMetricValue(supabaseClient, rule);
    
    if (metricValue === null) {
      return {
        success: false,
        ruleId: rule.id,
        ruleName: rule.name,
        triggered: false,
        thresholdValue: rule.threshold_value,
        severity: rule.severity,
        reason: 'Metric value not available',
        evaluationTime: Date.now() - startTime
      };
    }

    // Check if rule is in cooldown
    const inCooldown = await isInCooldown(supabaseClient, rule);
    if (inCooldown) {
      return {
        success: true,
        ruleId: rule.id,
        ruleName: rule.name,
        triggered: false,
        metricValue,
        thresholdValue: rule.threshold_value,
        severity: rule.severity,
        reason: 'Rule in cooldown period',
        evaluationTime: Date.now() - startTime
      };
    }

    // Evaluate condition
    const conditionMet = evaluateCondition(
      metricValue,
      rule.threshold_value,
      rule.threshold_operator
    );

    // If condition is met, trigger alert
    if (conditionMet) {
      await triggerAlert(supabaseClient, rule, metricValue);
    }

    return {
      success: true,
      ruleId: rule.id,
      ruleName: rule.name,
      triggered: conditionMet,
      metricValue,
      thresholdValue: rule.threshold_value,
      severity: rule.severity,
      evaluationTime: Date.now() - startTime
    };

  } catch (error) {
    return {
      success: false,
      ruleId: rule.id,
      ruleName: rule.name,
      triggered: false,
      thresholdValue: rule.threshold_value,
      severity: rule.severity,
      reason: `Evaluation error: ${error.message}`,
      evaluationTime: Date.now() - startTime
    };
  }
}

async function getMetricValue(supabaseClient: any, rule: any): Promise<number | null> {
  const windowMinutes = rule.evaluation_window_minutes;
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  switch (rule.metric_source) {
    case 'embedding_metrics':
      return await getEmbeddingMetricValue(supabaseClient, rule, windowStart);
    
    case 'performance_metrics':
      return await getPerformanceMetricValue(supabaseClient, rule, windowStart);
    
    case 'system_health':
      return await getSystemHealthMetricValue(supabaseClient, rule);
    
    default:
      console.warn(`Unknown metric source: ${rule.metric_source}`);
      return null;
  }
}

async function getEmbeddingMetricValue(supabaseClient: any, rule: any, windowStart: Date): Promise<number | null> {
  switch (rule.metric_name) {
    case 'success_rate': {
      const { data, error } = await supabaseClient
        .from('embedding_performance_metrics')
        .select('status')
        .gte('created_at', windowStart.toISOString())
        .eq('team_id', rule.team_id);

      if (error) throw error;
      if (!data || data.length === 0) return 100;

      const successCount = data.filter((m: any) => m.status === 'success').length;
      return (successCount / data.length) * 100;
    }

    case 'error_rate': {
      const { data, error } = await supabaseClient
        .from('embedding_performance_metrics')
        .select('status')
        .gte('created_at', windowStart.toISOString())
        .eq('team_id', rule.team_id);

      if (error) throw error;
      if (!data || data.length === 0) return 0;

      const errorCount = data.filter((m: any) => m.status === 'failed' || m.status === 'timeout').length;
      return (errorCount / data.length) * 100;
    }

    default:
      return null;
  }
}

async function getPerformanceMetricValue(supabaseClient: any, rule: any, windowStart: Date): Promise<number | null> {
  const { data, error } = await supabaseClient
    .from('performance_metrics')
    .select('metric_value')
    .eq('metric_name', rule.metric_name)
    .gte('created_at', windowStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  return data[0].metric_value;
}

async function getSystemHealthMetricValue(supabaseClient: any, rule: any): Promise<number | null> {
  // For system health metrics, we'll use simplified calculations
  switch (rule.metric_name) {
    case 'health_score':
      return 85; // Placeholder - would integrate with actual health monitoring
    
    case 'api_response_time':
      // Test database response time
      const startTime = Date.now();
      await supabaseClient.from('alert_rules').select('count').limit(1);
      return Date.now() - startTime;
    
    default:
      return null;
  }
}

function evaluateCondition(value: number, threshold: number, operator: string): boolean {
  switch (operator) {
    case '>': return value > threshold;
    case '<': return value < threshold;
    case '>=': return value >= threshold;
    case '<=': return value <= threshold;
    case '=': return Math.abs(value - threshold) < 0.001;
    case '!=': return Math.abs(value - threshold) >= 0.001;
    default: return false;
  }
}

async function isInCooldown(supabaseClient: any, rule: any): Promise<boolean> {
  const cooldownEnd = new Date(Date.now() - rule.cooldown_minutes * 60 * 1000);
  
  const { data, error } = await supabaseClient
    .from('alerts')
    .select('created_at')
    .eq('alert_rule_id', rule.id)
    .gte('created_at', cooldownEnd.toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) return false;
  return data && data.length > 0;
}

async function triggerAlert(supabaseClient: any, rule: any, metricValue: number): Promise<void> {
  // Check if alert already exists
  const { data: existingAlerts } = await supabaseClient
    .from('alerts')
    .select('id')
    .eq('alert_rule_id', rule.id)
    .in('status', ['active', 'acknowledged']);

  if (existingAlerts && existingAlerts.length > 0) {
    console.log(`Alert already exists for rule ${rule.name}, skipping`);
    return;
  }

  // Create new alert
  const alertTitle = `${rule.name} - Threshold ${rule.threshold_operator} ${rule.threshold_value}`;
  const alertDescription = `Metric ${rule.metric_name} is ${metricValue} ${rule.threshold_unit || ''}, which ${rule.threshold_operator} threshold of ${rule.threshold_value} ${rule.threshold_unit || ''}`;

  const { error } = await supabaseClient
    .from('alerts')
    .insert({
      alert_rule_id: rule.id,
      title: alertTitle,
      description: alertDescription,
      severity: rule.severity,
      metric_name: rule.metric_name,
      metric_value: metricValue,
      threshold_value: rule.threshold_value,
      threshold_operator: rule.threshold_operator,
      context: {
        rule_name: rule.name,
        evaluation_window_minutes: rule.evaluation_window_minutes,
        metric_source: rule.metric_source,
        triggered_at: new Date().toISOString(),
        triggered_by: 'edge_function'
      },
      team_id: rule.team_id
    });

  if (error) {
    throw new Error(`Failed to create alert: ${error.message}`);
  }

  console.log(`Alert triggered: ${alertTitle}`);
}
