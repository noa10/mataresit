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

/**
 * Automated billing system health check function
 * This function is designed to be called by a cron job every 5 minutes
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('Starting automated billing system health check...');

  try {
    const healthCheckResults = {
      timestamp: new Date().toISOString(),
      checks_performed: 0,
      alerts_triggered: 0,
      errors: [],
      summary: {}
    };

    // 1. Check payment processing health
    console.log('Checking payment processing health...');
    try {
      const paymentHealth = await checkPaymentProcessingHealth();
      healthCheckResults.checks_performed++;
      healthCheckResults.summary.payment_processing = paymentHealth;
      
      if (paymentHealth.alerts_triggered > 0) {
        healthCheckResults.alerts_triggered += paymentHealth.alerts_triggered;
      }
    } catch (error) {
      console.error('Payment processing health check failed:', error);
      healthCheckResults.errors.push({
        component: 'payment_processing',
        error: error.message
      });
    }

    // 2. Check email delivery health
    console.log('Checking email delivery health...');
    try {
      const emailHealth = await checkEmailDeliveryHealth();
      healthCheckResults.checks_performed++;
      healthCheckResults.summary.email_delivery = emailHealth;
      
      if (emailHealth.alerts_triggered > 0) {
        healthCheckResults.alerts_triggered += emailHealth.alerts_triggered;
      }
    } catch (error) {
      console.error('Email delivery health check failed:', error);
      healthCheckResults.errors.push({
        component: 'email_delivery',
        error: error.message
      });
    }

    // 3. Check subscription health
    console.log('Checking subscription health...');
    try {
      const subscriptionHealth = await checkSubscriptionHealth();
      healthCheckResults.checks_performed++;
      healthCheckResults.summary.subscription_health = subscriptionHealth;
      
      if (subscriptionHealth.alerts_triggered > 0) {
        healthCheckResults.alerts_triggered += subscriptionHealth.alerts_triggered;
      }
    } catch (error) {
      console.error('Subscription health check failed:', error);
      healthCheckResults.errors.push({
        component: 'subscription_health',
        error: error.message
      });
    }

    // 4. Check system performance
    console.log('Checking system performance...');
    try {
      const systemHealth = await checkSystemPerformance();
      healthCheckResults.checks_performed++;
      healthCheckResults.summary.system_performance = systemHealth;
      
      if (systemHealth.alerts_triggered > 0) {
        healthCheckResults.alerts_triggered += systemHealth.alerts_triggered;
      }
    } catch (error) {
      console.error('System performance health check failed:', error);
      healthCheckResults.errors.push({
        component: 'system_performance',
        error: error.message
      });
    }

    // 5. Check webhook processing health
    console.log('Checking webhook processing health...');
    try {
      const webhookHealth = await checkWebhookHealth();
      healthCheckResults.checks_performed++;
      healthCheckResults.summary.webhook_processing = webhookHealth;
      
      if (webhookHealth.alerts_triggered > 0) {
        healthCheckResults.alerts_triggered += webhookHealth.alerts_triggered;
      }
    } catch (error) {
      console.error('Webhook processing health check failed:', error);
      healthCheckResults.errors.push({
        component: 'webhook_processing',
        error: error.message
      });
    }

    // 6. Cleanup old resolved alerts
    console.log('Cleaning up old resolved alerts...');
    try {
      await cleanupOldAlerts();
    } catch (error) {
      console.error('Alert cleanup failed:', error);
      healthCheckResults.errors.push({
        component: 'alert_cleanup',
        error: error.message
      });
    }

    // Log the health check results
    await supabaseClient.rpc('log_billing_event', {
      p_user_id: null,
      p_event_type: 'automated_health_check',
      p_event_description: `Automated health check completed: ${healthCheckResults.checks_performed} checks, ${healthCheckResults.alerts_triggered} alerts`,
      p_metadata: healthCheckResults,
      p_triggered_by: 'cron_job'
    });

    console.log('Automated billing system health check completed:', healthCheckResults);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Health check completed successfully',
        results: healthCheckResults
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Automated health check failed:', error);
    
    // Log the failure
    await supabaseClient.rpc('log_billing_event', {
      p_user_id: null,
      p_event_type: 'automated_health_check_failed',
      p_event_description: 'Automated health check failed: ' + error.message,
      p_metadata: { error: error.message, stack: error.stack },
      p_triggered_by: 'cron_job'
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Health check failed',
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
 * Check payment processing health
 */
async function checkPaymentProcessingHealth() {
  const { data: metrics, error } = await supabaseClient.rpc('get_payment_health_metrics', {
    p_time_filter: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  });

  if (error) {
    throw new Error(`Failed to get payment metrics: ${error.message}`);
  }

  const paymentMetrics = metrics[0];
  let alertsTriggered = 0;

  // Check payment success rate
  if (paymentMetrics.success_rate < 90) {
    await createAlert({
      type: 'payment_success_rate_critical',
      severity: 'critical',
      title: 'Payment Success Rate Critical',
      message: `Payment success rate is ${paymentMetrics.success_rate}% (below 90% threshold)`,
      component: 'payment',
      details: {
        success_rate: paymentMetrics.success_rate,
        failed_payments: paymentMetrics.failed_payments_24h,
        total_payments: paymentMetrics.total_payments
      }
    });
    alertsTriggered++;
  } else if (paymentMetrics.success_rate < 95) {
    await createAlert({
      type: 'payment_success_rate_warning',
      severity: 'high',
      title: 'Payment Success Rate Warning',
      message: `Payment success rate is ${paymentMetrics.success_rate}% (below 95% threshold)`,
      component: 'payment',
      details: {
        success_rate: paymentMetrics.success_rate,
        failed_payments: paymentMetrics.failed_payments_24h
      }
    });
    alertsTriggered++;
  }

  // Check retry queue depth
  if (paymentMetrics.retry_queue_depth > 50) {
    await createAlert({
      type: 'payment_retry_queue_high',
      severity: paymentMetrics.retry_queue_depth > 100 ? 'critical' : 'high',
      title: 'Payment Retry Queue High',
      message: `Payment retry queue depth is ${paymentMetrics.retry_queue_depth} (threshold: 50)`,
      component: 'payment',
      details: {
        queue_depth: paymentMetrics.retry_queue_depth,
        threshold: 50
      }
    });
    alertsTriggered++;
  }

  return {
    status: paymentMetrics.success_rate >= 95 ? 'healthy' : paymentMetrics.success_rate >= 90 ? 'warning' : 'critical',
    success_rate: paymentMetrics.success_rate,
    failed_payments_24h: paymentMetrics.failed_payments_24h,
    retry_queue_depth: paymentMetrics.retry_queue_depth,
    alerts_triggered: alertsTriggered
  };
}

/**
 * Check email delivery health
 */
async function checkEmailDeliveryHealth() {
  const { data: emailData, error } = await supabaseClient.functions.invoke('email-scheduler', {
    body: {
      action: 'get_email_delivery_stats',
      dateRange: '24h'
    }
  });

  if (error) {
    throw new Error(`Failed to get email metrics: ${error.message}`);
  }

  const emailMetrics = emailData.stats;
  let alertsTriggered = 0;

  // Check email delivery rate
  if (emailMetrics.delivery_rate < 90) {
    await createAlert({
      type: 'email_delivery_rate_critical',
      severity: 'critical',
      title: 'Email Delivery Rate Critical',
      message: `Email delivery rate is ${emailMetrics.delivery_rate}% (below 90% threshold)`,
      component: 'email',
      details: {
        delivery_rate: emailMetrics.delivery_rate,
        failed_emails: emailMetrics.failed_emails,
        total_emails: emailMetrics.total_emails
      }
    });
    alertsTriggered++;
  } else if (emailMetrics.delivery_rate < 95) {
    await createAlert({
      type: 'email_delivery_rate_warning',
      severity: 'high',
      title: 'Email Delivery Rate Warning',
      message: `Email delivery rate is ${emailMetrics.delivery_rate}% (below 95% threshold)`,
      component: 'email',
      details: {
        delivery_rate: emailMetrics.delivery_rate,
        failed_emails: emailMetrics.failed_emails
      }
    });
    alertsTriggered++;
  }

  // Check scheduled emails queue
  if (emailMetrics.scheduled_emails > 1000) {
    await createAlert({
      type: 'email_queue_high',
      severity: emailMetrics.scheduled_emails > 2000 ? 'critical' : 'high',
      title: 'Email Queue High',
      message: `Scheduled emails queue has ${emailMetrics.scheduled_emails} pending emails`,
      component: 'email',
      details: {
        scheduled_emails: emailMetrics.scheduled_emails,
        threshold: 1000
      }
    });
    alertsTriggered++;
  }

  return {
    status: emailMetrics.delivery_rate >= 95 ? 'healthy' : emailMetrics.delivery_rate >= 90 ? 'warning' : 'critical',
    delivery_rate: emailMetrics.delivery_rate,
    failed_deliveries_24h: emailMetrics.failed_emails,
    scheduled_emails_pending: emailMetrics.scheduled_emails,
    alerts_triggered: alertsTriggered
  };
}

/**
 * Check subscription health
 */
async function checkSubscriptionHealth() {
  const { data: metrics, error } = await supabaseClient.rpc('get_subscription_health_metrics', {
    p_time_filter: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  });

  if (error) {
    throw new Error(`Failed to get subscription metrics: ${error.message}`);
  }

  const subscriptionMetrics = metrics[0];
  let alertsTriggered = 0;

  // Check failed renewals
  if (subscriptionMetrics.failed_renewals_24h > 10) {
    await createAlert({
      type: 'subscription_renewals_failing',
      severity: subscriptionMetrics.failed_renewals_24h > 25 ? 'critical' : 'high',
      title: 'Subscription Renewals Failing',
      message: `${subscriptionMetrics.failed_renewals_24h} subscription renewals failed in the last 24 hours`,
      component: 'subscription',
      details: {
        failed_renewals: subscriptionMetrics.failed_renewals_24h,
        threshold: 10
      }
    });
    alertsTriggered++;
  }

  // Check churn rate
  if (subscriptionMetrics.churn_rate_7d > 5) {
    await createAlert({
      type: 'subscription_churn_high',
      severity: subscriptionMetrics.churn_rate_7d > 10 ? 'critical' : 'high',
      title: 'Subscription Churn Rate High',
      message: `7-day churn rate is ${subscriptionMetrics.churn_rate_7d}% (threshold: 5%)`,
      component: 'subscription',
      details: {
        churn_rate_7d: subscriptionMetrics.churn_rate_7d,
        threshold: 5
      }
    });
    alertsTriggered++;
  }

  return {
    status: subscriptionMetrics.churn_rate_7d <= 5 && subscriptionMetrics.failed_renewals_24h <= 10 ? 'healthy' : 'warning',
    active_subscriptions: subscriptionMetrics.active_subscriptions,
    grace_period_subscriptions: subscriptionMetrics.grace_period_subscriptions,
    failed_renewals_24h: subscriptionMetrics.failed_renewals_24h,
    churn_rate_7d: subscriptionMetrics.churn_rate_7d,
    alerts_triggered: alertsTriggered
  };
}

/**
 * Check system performance
 */
async function checkSystemPerformance() {
  // Check database performance
  const dbStart = Date.now();
  await supabaseClient.from('profiles').select('count').limit(1);
  const dbTime = Date.now() - dbStart;

  let alertsTriggered = 0;

  // Check database response time
  if (dbTime > 5000) { // 5 seconds
    await createAlert({
      type: 'database_response_slow',
      severity: 'high',
      title: 'Database Response Slow',
      message: `Database response time is ${dbTime}ms (threshold: 5000ms)`,
      component: 'database',
      details: {
        response_time: dbTime,
        threshold: 5000
      }
    });
    alertsTriggered++;
  }

  return {
    status: dbTime <= 1000 ? 'healthy' : dbTime <= 5000 ? 'warning' : 'critical',
    database_response_time: dbTime,
    alerts_triggered: alertsTriggered
  };
}

/**
 * Check webhook processing health
 */
async function checkWebhookHealth() {
  // Check recent webhook failures
  const { data: webhookFailures, error } = await supabaseClient
    .from('billing_audit_trail')
    .select('count')
    .eq('event_type', 'webhook_processing_failed')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

  let alertsTriggered = 0;

  if (!error && webhookFailures.length > 10) {
    await createAlert({
      type: 'webhook_failures_high',
      severity: 'high',
      title: 'High Webhook Failure Rate',
      message: `${webhookFailures.length} webhook processing failures in the last hour`,
      component: 'webhook',
      details: {
        failures_count: webhookFailures.length,
        threshold: 10,
        timeframe: '1 hour'
      }
    });
    alertsTriggered++;
  }

  return {
    status: webhookFailures.length <= 5 ? 'healthy' : webhookFailures.length <= 10 ? 'warning' : 'critical',
    webhook_failures_1h: webhookFailures.length,
    alerts_triggered: alertsTriggered
  };
}

/**
 * Create an alert if it doesn't already exist
 */
async function createAlert(alert: any) {
  // Check if this alert already exists and is unresolved
  const { data: existingAlert, error } = await supabaseClient
    .from('billing_system_alerts')
    .select('id')
    .eq('alert_type', alert.type)
    .eq('resolved', false)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error checking existing alert:', error);
    return;
  }

  // If alert already exists, don't create duplicate
  if (existingAlert) {
    console.log(`Alert ${alert.type} already exists and is unresolved`);
    return;
  }

  // Create new alert
  const { error: createError } = await supabaseClient.rpc('create_billing_system_alert', {
    p_alert_type: alert.type,
    p_severity: alert.severity,
    p_title: alert.title,
    p_message: alert.message,
    p_component: alert.component,
    p_details: alert.details || {}
  });

  if (createError) {
    console.error('Error creating alert:', createError);
    return;
  }

  console.log(`Created alert: ${alert.title} (${alert.severity})`);
}

/**
 * Cleanup old resolved alerts (older than 30 days)
 */
async function cleanupOldAlerts() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  const { error } = await supabaseClient
    .from('billing_system_alerts')
    .delete()
    .eq('resolved', true)
    .lt('resolved_at', thirtyDaysAgo);

  if (error) {
    console.error('Error cleaning up old alerts:', error);
  } else {
    console.log('Old resolved alerts cleaned up successfully');
  }
}
