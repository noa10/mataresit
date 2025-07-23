import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Initialize Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { job_type } = await req.json();

    console.log('Billing cron job request:', { job_type });

    switch (job_type) {
      case 'process_renewals':
        return await processRenewals();
      
      case 'send_reminder_emails':
        return await sendReminderEmails();
      
      case 'process_payment_retries':
        return await processPaymentRetries();
      
      case 'cleanup_expired_grace_periods':
        return await cleanupExpiredGracePeriods();
      
      case 'daily_billing_health_check':
        return await dailyBillingHealthCheck();
      
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown job type' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
    }
  } catch (error) {
    console.error('Error in billing cron job:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * Process upcoming renewals (run daily)
 */
async function processRenewals() {
  console.log('Running daily renewal processing...');
  
  try {
    const { data, error } = await supabaseClient.functions.invoke('billing-auto-renewal', {
      body: { action: 'process_upcoming_renewals' }
    });

    if (error) {
      throw new Error(`Failed to process renewals: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        job_type: 'process_renewals',
        result: data
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error processing renewals:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Send scheduled reminder emails (run every hour)
 */
async function sendReminderEmails() {
  console.log('Sending scheduled reminder emails...');
  
  try {
    // Get pending billing reminders
    const { data: pendingReminders, error } = await supabaseClient.rpc('get_pending_billing_reminders');
    
    if (error) {
      throw new Error(`Failed to get pending reminders: ${error.message}`);
    }

    const results = [];
    
    for (const reminder of pendingReminders || []) {
      try {
        // Send the email
        const { error: emailError } = await supabaseClient.functions.invoke('send-email', {
          body: {
            to: reminder.user_email,
            template_name: reminder.reminder_type,
            template_data: reminder.template_data
          }
        });

        if (emailError) {
          console.error(`Failed to send email for reminder ${reminder.schedule_id}:`, emailError);
          
          // Mark as failed
          await supabaseClient.rpc('mark_billing_reminder_sent', {
            p_schedule_id: reminder.schedule_id,
            p_success: false,
            p_error_message: emailError.message
          });

          results.push({
            schedule_id: reminder.schedule_id,
            status: 'failed',
            error: emailError.message
          });
        } else {
          // Mark as sent
          await supabaseClient.rpc('mark_billing_reminder_sent', {
            p_schedule_id: reminder.schedule_id,
            p_success: true
          });

          results.push({
            schedule_id: reminder.schedule_id,
            status: 'sent'
          });
        }

      } catch (error) {
        console.error(`Error processing reminder ${reminder.schedule_id}:`, error);
        results.push({
          schedule_id: reminder.schedule_id,
          status: 'error',
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        job_type: 'send_reminder_emails',
        processed: results.length,
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error sending reminder emails:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Process payment retries (run every 6 hours)
 */
async function processPaymentRetries() {
  console.log('Processing payment retries...');
  
  try {
    // Get payment retries that are due
    const { data: dueRetries, error } = await supabaseClient
      .from('payment_retry_tracking')
      .select(`
        *,
        profiles!inner(id, email, full_name, stripe_subscription_id)
      `)
      .eq('status', 'pending')
      .lte('next_retry_at', new Date().toISOString())
      .lt('attempt_number', supabaseClient.raw('max_attempts'));

    if (error) {
      throw new Error(`Failed to get due retries: ${error.message}`);
    }

    const results = [];

    for (const retry of dueRetries || []) {
      try {
        const { data, error: retryError } = await supabaseClient.functions.invoke('billing-auto-renewal', {
          body: {
            action: 'handle_payment_retry',
            subscriptionId: retry.stripe_subscription_id
          }
        });

        if (retryError) {
          console.error(`Failed to process retry for ${retry.id}:`, retryError);
          results.push({
            retry_id: retry.id,
            status: 'error',
            error: retryError.message
          });
        } else {
          results.push({
            retry_id: retry.id,
            status: 'processed',
            result: data
          });
        }

      } catch (error) {
        console.error(`Error processing retry ${retry.id}:`, error);
        results.push({
          retry_id: retry.id,
          status: 'error',
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        job_type: 'process_payment_retries',
        processed: results.length,
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error processing payment retries:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Cleanup expired grace periods (run daily)
 */
async function cleanupExpiredGracePeriods() {
  console.log('Cleaning up expired grace periods...');
  
  try {
    const { data, error } = await supabaseClient.functions.invoke('billing-auto-renewal', {
      body: { action: 'process_grace_period_expiry' }
    });

    if (error) {
      throw new Error(`Failed to cleanup grace periods: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        job_type: 'cleanup_expired_grace_periods',
        result: data
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error cleaning up grace periods:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Daily billing system health check
 */
async function dailyBillingHealthCheck() {
  console.log('Running daily billing health check...');
  
  try {
    const healthReport = {
      timestamp: new Date().toISOString(),
      checks: []
    };

    // Check for subscriptions with issues
    const { data: problematicSubscriptions, error: subError } = await supabaseClient
      .from('profiles')
      .select('id, email, subscription_tier, subscription_status, grace_period_end_date')
      .neq('subscription_tier', 'free')
      .or('subscription_status.neq.active,grace_period_end_date.not.is.null');

    if (subError) {
      healthReport.checks.push({
        name: 'subscription_health',
        status: 'error',
        error: subError.message
      });
    } else {
      healthReport.checks.push({
        name: 'subscription_health',
        status: 'ok',
        issues_found: problematicSubscriptions?.length || 0,
        details: problematicSubscriptions?.map(sub => ({
          user_id: sub.id,
          tier: sub.subscription_tier,
          status: sub.subscription_status,
          in_grace_period: !!sub.grace_period_end_date
        }))
      });
    }

    // Check for failed email deliveries
    const { data: failedEmails, error: emailError } = await supabaseClient
      .from('billing_email_schedule')
      .select('id, user_id, reminder_type, error_message')
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (emailError) {
      healthReport.checks.push({
        name: 'email_delivery',
        status: 'error',
        error: emailError.message
      });
    } else {
      healthReport.checks.push({
        name: 'email_delivery',
        status: failedEmails && failedEmails.length > 10 ? 'warning' : 'ok',
        failed_emails_24h: failedEmails?.length || 0
      });
    }

    // Check for stuck payment retries
    const { data: stuckRetries, error: retryError } = await supabaseClient
      .from('payment_retry_tracking')
      .select('id, user_id, attempt_number, max_attempts')
      .eq('status', 'pending')
      .lt('next_retry_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()); // 2 hours ago

    if (retryError) {
      healthReport.checks.push({
        name: 'payment_retries',
        status: 'error',
        error: retryError.message
      });
    } else {
      healthReport.checks.push({
        name: 'payment_retries',
        status: stuckRetries && stuckRetries.length > 0 ? 'warning' : 'ok',
        stuck_retries: stuckRetries?.length || 0
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        job_type: 'daily_billing_health_check',
        health_report: healthReport
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in billing health check:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}
