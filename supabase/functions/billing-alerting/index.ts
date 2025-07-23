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

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  enabled: boolean;
  notification_channels: string[];
}

interface AlertNotification {
  channel: 'email' | 'slack' | 'webhook' | 'sms';
  recipients: string[];
  template: string;
  metadata: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();

    console.log('Billing alerting request:', { action });

    switch (action) {
      case 'check_alert_conditions':
        return await checkAlertConditions();
      
      case 'process_alert_rules':
        return await processAlertRules();
      
      case 'send_alert_notification':
        return await sendAlertNotification(await req.json());
      
      case 'create_alert':
        return await createAlert(await req.json());
      
      case 'resolve_alert':
        return await resolveAlert(await req.json());
      
      case 'get_alert_rules':
        return await getAlertRules();
      
      case 'update_alert_rule':
        return await updateAlertRule(await req.json());
      
      case 'test_alert_rule':
        return await testAlertRule(await req.json());
      
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
    console.error('Billing alerting error:', error);
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
 * Check all alert conditions and trigger alerts if necessary
 */
async function checkAlertConditions() {
  console.log('Checking billing system alert conditions...');

  const alertsTriggered = [];

  try {
    // Check payment processing alerts
    const paymentAlerts = await checkPaymentAlerts();
    alertsTriggered.push(...paymentAlerts);

    // Check email delivery alerts
    const emailAlerts = await checkEmailAlerts();
    alertsTriggered.push(...emailAlerts);

    // Check subscription health alerts
    const subscriptionAlerts = await checkSubscriptionAlerts();
    alertsTriggered.push(...subscriptionAlerts);

    // Check system performance alerts
    const systemAlerts = await checkSystemAlerts();
    alertsTriggered.push(...systemAlerts);

    // Process triggered alerts
    for (const alert of alertsTriggered) {
      await processTriggeredAlert(alert);
    }

    return new Response(
      JSON.stringify({
        success: true,
        alerts_checked: 4,
        alerts_triggered: alertsTriggered.length,
        alerts: alertsTriggered
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error checking alert conditions:', error);
    throw error;
  }
}

/**
 * Check payment processing alerts
 */
async function checkPaymentAlerts() {
  const alerts = [];

  // Get payment metrics for the last 24 hours
  const { data: metrics, error } = await supabaseClient.rpc('get_payment_health_metrics', {
    p_time_filter: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  });

  if (error) {
    console.error('Error getting payment metrics:', error);
    return alerts;
  }

  const paymentMetrics = metrics[0];

  // Check payment success rate
  if (paymentMetrics.success_rate < 90) {
    alerts.push({
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
  } else if (paymentMetrics.success_rate < 95) {
    alerts.push({
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
  }

  // Check retry queue depth
  if (paymentMetrics.retry_queue_depth > 50) {
    alerts.push({
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
  }

  // Check processing time
  if (paymentMetrics.avg_processing_time > 300) { // 5 minutes
    alerts.push({
      type: 'payment_processing_slow',
      severity: 'medium',
      title: 'Payment Processing Slow',
      message: `Average payment processing time is ${Math.round(paymentMetrics.avg_processing_time)} seconds`,
      component: 'payment',
      details: {
        avg_processing_time: paymentMetrics.avg_processing_time,
        threshold: 300
      }
    });
  }

  return alerts;
}

/**
 * Check email delivery alerts
 */
async function checkEmailAlerts() {
  const alerts = [];

  // Get email delivery stats
  const { data: emailData, error } = await supabaseClient.functions.invoke('email-scheduler', {
    body: {
      action: 'get_email_delivery_stats',
      dateRange: '24h'
    }
  });

  if (error) {
    console.error('Error getting email metrics:', error);
    return alerts;
  }

  const emailMetrics = emailData.stats;

  // Check email delivery rate
  if (emailMetrics.delivery_rate < 90) {
    alerts.push({
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
  } else if (emailMetrics.delivery_rate < 95) {
    alerts.push({
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
  }

  // Check scheduled emails queue
  if (emailMetrics.scheduled_emails > 1000) {
    alerts.push({
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
  }

  return alerts;
}

/**
 * Check subscription health alerts
 */
async function checkSubscriptionAlerts() {
  const alerts = [];

  // Get subscription metrics
  const { data: metrics, error } = await supabaseClient.rpc('get_subscription_health_metrics', {
    p_time_filter: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  });

  if (error) {
    console.error('Error getting subscription metrics:', error);
    return alerts;
  }

  const subscriptionMetrics = metrics[0];

  // Check failed renewals
  if (subscriptionMetrics.failed_renewals_24h > 10) {
    alerts.push({
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
  }

  // Check churn rate
  if (subscriptionMetrics.churn_rate_7d > 5) {
    alerts.push({
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
  }

  // Check grace period subscriptions
  if (subscriptionMetrics.grace_period_subscriptions > 50) {
    alerts.push({
      type: 'subscription_grace_period_high',
      severity: 'medium',
      title: 'High Number of Grace Period Subscriptions',
      message: `${subscriptionMetrics.grace_period_subscriptions} subscriptions are in grace period`,
      component: 'subscription',
      details: {
        grace_period_subscriptions: subscriptionMetrics.grace_period_subscriptions,
        threshold: 50
      }
    });
  }

  return alerts;
}

/**
 * Check system performance alerts
 */
async function checkSystemAlerts() {
  const alerts = [];

  // Check recent webhook failures
  const { data: webhookFailures, error: webhookError } = await supabaseClient
    .from('billing_audit_trail')
    .select('count')
    .eq('event_type', 'webhook_processing_failed')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

  if (!webhookError && webhookFailures.length > 10) {
    alerts.push({
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
  }

  return alerts;
}

/**
 * Process a triggered alert
 */
async function processTriggeredAlert(alert: any) {
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
  const { data: newAlert, error: createError } = await supabaseClient.rpc('create_billing_system_alert', {
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

  // Send notifications based on severity
  await sendAlertNotifications(alert);
}

/**
 * Send alert notifications
 */
async function sendAlertNotifications(alert: any) {
  const notifications: AlertNotification[] = [];

  // Determine notification channels based on severity
  switch (alert.severity) {
    case 'critical':
      notifications.push({
        channel: 'email',
        recipients: ['admin@mataresit.com'], // Replace with actual admin emails
        template: 'critical_alert',
        metadata: alert
      });
      // Add Slack notification for critical alerts
      notifications.push({
        channel: 'slack',
        recipients: ['#billing-alerts'], // Replace with actual Slack channel
        template: 'critical_alert_slack',
        metadata: alert
      });
      break;
    
    case 'high':
      notifications.push({
        channel: 'email',
        recipients: ['admin@mataresit.com'],
        template: 'high_alert',
        metadata: alert
      });
      break;
    
    case 'medium':
      notifications.push({
        channel: 'email',
        recipients: ['admin@mataresit.com'],
        template: 'medium_alert',
        metadata: alert
      });
      break;
    
    case 'low':
      // Low severity alerts might only be logged, not sent
      break;
  }

  // Send notifications
  for (const notification of notifications) {
    try {
      await sendNotification(notification);
    } catch (error) {
      console.error(`Failed to send ${notification.channel} notification:`, error);
    }
  }
}

/**
 * Send individual notification
 */
async function sendNotification(notification: AlertNotification) {
  switch (notification.channel) {
    case 'email':
      await supabaseClient.functions.invoke('send-email', {
        body: {
          to: notification.recipients[0], // Simplified for now
          template_name: notification.template,
          template_data: {
            alert: notification.metadata,
            timestamp: new Date().toISOString()
          }
        }
      });
      break;
    
    case 'slack':
      // Implement Slack notification
      console.log('Slack notification would be sent:', notification);
      break;
    
    case 'webhook':
      // Implement webhook notification
      console.log('Webhook notification would be sent:', notification);
      break;
  }
}

/**
 * Create a new alert
 */
async function createAlert(payload: any) {
  const { alert_type, severity, title, message, component, user_id, subscription_id, details } = payload;
  
  const { data, error } = await supabaseClient.rpc('create_billing_system_alert', {
    p_alert_type: alert_type,
    p_severity: severity,
    p_title: title,
    p_message: message,
    p_component: component,
    p_user_id: user_id,
    p_subscription_id: subscription_id,
    p_details: details || {}
  });

  if (error) {
    throw new Error(`Failed to create alert: ${error.message}`);
  }

  return new Response(
    JSON.stringify({
      success: true,
      alert_id: data,
      message: 'Alert created successfully'
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Resolve an alert
 */
async function resolveAlert(payload: any) {
  const { alert_id, resolved_by } = payload;
  
  const { error } = await supabaseClient
    .from('billing_system_alerts')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', alert_id);

  if (error) {
    throw new Error(`Failed to resolve alert: ${error.message}`);
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Alert resolved successfully'
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}
