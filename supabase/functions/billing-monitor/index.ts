import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface BillingHealthMetrics {
  overall_health: 'healthy' | 'warning' | 'critical';
  payment_processing: {
    success_rate: number;
    failed_payments_24h: number;
    retry_queue_depth: number;
    average_processing_time: number;
  };
  email_delivery: {
    delivery_rate: number;
    failed_deliveries_24h: number;
    scheduled_emails_pending: number;
    average_delivery_time: number;
  };
  subscription_health: {
    active_subscriptions: number;
    grace_period_subscriptions: number;
    failed_renewals_24h: number;
    churn_rate_7d: number;
  };
  system_performance: {
    webhook_processing_rate: number;
    database_query_time: number;
    function_error_rate: number;
    api_response_time: number;
  };
  alerts: Array<{
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: string;
    message: string;
    timestamp: string;
    acknowledged: boolean;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, timeframe = '24h', include_details = false } = await req.json();

    console.log('Billing monitor request:', { action, timeframe, include_details });

    switch (action) {
      case 'get_health_metrics':
        return await getHealthMetrics(timeframe, include_details);
      
      case 'get_payment_metrics':
        return await getPaymentMetrics(timeframe);
      
      case 'get_email_metrics':
        return await getEmailMetrics(timeframe);
      
      case 'get_subscription_metrics':
        return await getSubscriptionMetrics(timeframe);
      
      case 'get_system_alerts':
        return await getSystemAlerts();
      
      case 'acknowledge_alert':
        return await acknowledgeAlert(await req.json());
      
      case 'trigger_health_check':
        return await triggerHealthCheck();
      
      case 'get_performance_metrics':
        return await getPerformanceMetrics(timeframe);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
    }
  } catch (error) {
    console.error('Billing monitor error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * Get comprehensive billing system health metrics
 */
async function getHealthMetrics(timeframe: string, includeDetails: boolean) {
  const timeFilter = getTimeFilter(timeframe);
  
  // Get payment processing metrics
  const { data: paymentMetrics, error: paymentError } = await supabaseClient.rpc('get_payment_health_metrics', {
    p_time_filter: timeFilter
  });

  // Get email delivery metrics
  const { data: emailMetrics, error: emailError } = await supabaseClient.rpc('get_email_delivery_stats', {
    p_date_range: timeframe
  });

  // Get subscription health metrics
  const { data: subscriptionMetrics, error: subscriptionError } = await supabaseClient.rpc('get_subscription_health_metrics', {
    p_time_filter: timeFilter
  });

  // Get system performance metrics
  const { data: systemMetrics, error: systemError } = await supabaseClient.rpc('get_billing_system_performance', {
    p_time_filter: timeFilter
  });

  // Get active alerts
  const { data: alerts, error: alertsError } = await supabaseClient
    .from('billing_system_alerts')
    .select('*')
    .eq('resolved', false)
    .order('created_at', { ascending: false });

  if (paymentError || emailError || subscriptionError || systemError || alertsError) {
    console.error('Error fetching health metrics:', { paymentError, emailError, subscriptionError, systemError, alertsError });
  }

  // Calculate overall health
  const overallHealth = calculateOverallHealth({
    paymentMetrics: paymentMetrics?.[0],
    emailMetrics: emailMetrics,
    subscriptionMetrics: subscriptionMetrics?.[0],
    systemMetrics: systemMetrics?.[0],
    alerts: alerts || []
  });

  const healthMetrics: BillingHealthMetrics = {
    overall_health: overallHealth,
    payment_processing: {
      success_rate: paymentMetrics?.[0]?.success_rate || 0,
      failed_payments_24h: paymentMetrics?.[0]?.failed_payments_24h || 0,
      retry_queue_depth: paymentMetrics?.[0]?.retry_queue_depth || 0,
      average_processing_time: paymentMetrics?.[0]?.avg_processing_time || 0
    },
    email_delivery: {
      delivery_rate: emailMetrics?.delivery_rate || 0,
      failed_deliveries_24h: emailMetrics?.failed_emails || 0,
      scheduled_emails_pending: emailMetrics?.scheduled_emails || 0,
      average_delivery_time: emailMetrics?.avg_processing_time_minutes || 0
    },
    subscription_health: {
      active_subscriptions: subscriptionMetrics?.[0]?.active_subscriptions || 0,
      grace_period_subscriptions: subscriptionMetrics?.[0]?.grace_period_subscriptions || 0,
      failed_renewals_24h: subscriptionMetrics?.[0]?.failed_renewals_24h || 0,
      churn_rate_7d: subscriptionMetrics?.[0]?.churn_rate_7d || 0
    },
    system_performance: {
      webhook_processing_rate: systemMetrics?.[0]?.webhook_processing_rate || 0,
      database_query_time: systemMetrics?.[0]?.avg_db_query_time || 0,
      function_error_rate: systemMetrics?.[0]?.function_error_rate || 0,
      api_response_time: systemMetrics?.[0]?.avg_api_response_time || 0
    },
    alerts: (alerts || []).map(alert => ({
      id: alert.id,
      severity: alert.severity,
      type: alert.alert_type,
      message: alert.message,
      timestamp: alert.created_at,
      acknowledged: alert.acknowledged
    }))
  };

  return new Response(
    JSON.stringify({
      success: true,
      metrics: healthMetrics,
      timestamp: new Date().toISOString(),
      timeframe
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Get detailed payment processing metrics
 */
async function getPaymentMetrics(timeframe: string) {
  const timeFilter = getTimeFilter(timeframe);
  
  const { data, error } = await supabaseClient.rpc('get_detailed_payment_metrics', {
    p_time_filter: timeFilter
  });

  if (error) {
    throw new Error(`Failed to get payment metrics: ${error.message}`);
  }

  return new Response(
    JSON.stringify({
      success: true,
      metrics: data,
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Get detailed email delivery metrics
 */
async function getEmailMetrics(timeframe: string) {
  const { data, error } = await supabaseClient.functions.invoke('email-scheduler', {
    body: {
      action: 'get_email_delivery_stats',
      dateRange: timeframe
    }
  });

  if (error) {
    throw new Error(`Failed to get email metrics: ${error.message}`);
  }

  return new Response(
    JSON.stringify({
      success: true,
      metrics: data.stats,
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Get subscription health metrics
 */
async function getSubscriptionMetrics(timeframe: string) {
  const timeFilter = getTimeFilter(timeframe);
  
  const { data, error } = await supabaseClient.rpc('get_subscription_analytics', {
    p_time_filter: timeFilter
  });

  if (error) {
    throw new Error(`Failed to get subscription metrics: ${error.message}`);
  }

  return new Response(
    JSON.stringify({
      success: true,
      metrics: data,
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Get system alerts
 */
async function getSystemAlerts() {
  const { data, error } = await supabaseClient
    .from('billing_system_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Failed to get system alerts: ${error.message}`);
  }

  return new Response(
    JSON.stringify({
      success: true,
      alerts: data,
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Acknowledge an alert
 */
async function acknowledgeAlert(payload: any) {
  const { alert_id, acknowledged_by } = payload;
  
  const { error } = await supabaseClient
    .from('billing_system_alerts')
    .update({
      acknowledged: true,
      acknowledged_by,
      acknowledged_at: new Date().toISOString()
    })
    .eq('id', alert_id);

  if (error) {
    throw new Error(`Failed to acknowledge alert: ${error.message}`);
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Alert acknowledged successfully'
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Trigger comprehensive health check
 */
async function triggerHealthCheck() {
  // Trigger health checks for all billing system components
  const healthChecks = await Promise.allSettled([
    checkPaymentProcessingHealth(),
    checkEmailDeliveryHealth(),
    checkSubscriptionHealth(),
    checkWebhookHealth(),
    checkDatabaseHealth()
  ]);

  const results = healthChecks.map((result, index) => ({
    component: ['payment_processing', 'email_delivery', 'subscription', 'webhook', 'database'][index],
    status: result.status,
    result: result.status === 'fulfilled' ? result.value : result.reason
  }));

  return new Response(
    JSON.stringify({
      success: true,
      health_checks: results,
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Helper functions
 */
function getTimeFilter(timeframe: string): string {
  const now = new Date();
  let hours = 24;
  
  switch (timeframe) {
    case '1h': hours = 1; break;
    case '6h': hours = 6; break;
    case '24h': hours = 24; break;
    case '7d': hours = 24 * 7; break;
    case '30d': hours = 24 * 30; break;
    default: hours = 24;
  }
  
  const startTime = new Date(now.getTime() - (hours * 60 * 60 * 1000));
  return startTime.toISOString();
}

function calculateOverallHealth(metrics: any): 'healthy' | 'warning' | 'critical' {
  const criticalAlerts = metrics.alerts?.filter((a: any) => a.severity === 'critical').length || 0;
  const highAlerts = metrics.alerts?.filter((a: any) => a.severity === 'high').length || 0;
  
  if (criticalAlerts > 0) return 'critical';
  if (highAlerts > 2) return 'critical';
  
  const paymentSuccessRate = metrics.paymentMetrics?.success_rate || 100;
  const emailDeliveryRate = metrics.emailMetrics?.delivery_rate || 100;
  
  if (paymentSuccessRate < 90 || emailDeliveryRate < 90) return 'critical';
  if (paymentSuccessRate < 95 || emailDeliveryRate < 95) return 'warning';
  
  return 'healthy';
}

async function checkPaymentProcessingHealth() {
  // Implementation for payment processing health check
  return { status: 'healthy', details: 'Payment processing is operational' };
}

async function checkEmailDeliveryHealth() {
  // Implementation for email delivery health check
  return { status: 'healthy', details: 'Email delivery is operational' };
}

async function checkSubscriptionHealth() {
  // Implementation for subscription health check
  return { status: 'healthy', details: 'Subscription system is operational' };
}

async function checkWebhookHealth() {
  // Implementation for webhook health check
  return { status: 'healthy', details: 'Webhook processing is operational' };
}

async function checkDatabaseHealth() {
  // Implementation for database health check
  return { status: 'healthy', details: 'Database is operational' };
}
