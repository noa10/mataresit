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
    const { action, ...params } = await req.json();

    console.log('Email scheduler request:', { action, params });

    switch (action) {
      case 'schedule_billing_reminders':
        return await scheduleBillingReminders(params);
      
      case 'process_scheduled_emails':
        return await processScheduledEmails();
      
      case 'reschedule_failed_emails':
        return await rescheduleFailedEmails(params);
      
      case 'cancel_scheduled_email':
        return await cancelScheduledEmail(params.scheduleId);
      
      case 'get_email_delivery_stats':
        return await getEmailDeliveryStats(params);
      
      case 'update_email_preferences':
        return await updateEmailPreferences(params);
      
      case 'preview_email_template':
        return await previewEmailTemplate(params);
      
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
    console.error('Error in email scheduler:', error);
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
 * Schedule billing reminder emails for multiple users
 */
async function scheduleBillingReminders(params: any) {
  const { userIds, reminderType, scheduledFor, templateData } = params;
  
  console.log(`Scheduling ${reminderType} reminders for ${userIds?.length || 0} users`);
  
  try {
    const results = [];
    
    for (const userId of userIds || []) {
      try {
        // Get user profile and billing preferences
        const { data: profile, error: profileError } = await supabaseClient
          .from('profiles')
          .select('id, email, full_name, stripe_subscription_id')
          .eq('id', userId)
          .single();

        if (profileError || !profile) {
          results.push({
            user_id: userId,
            status: 'error',
            error: 'User profile not found'
          });
          continue;
        }

        // Get billing preferences
        const { data: billingPrefs, error: prefsError } = await supabaseClient.rpc('get_billing_preferences', {
          p_user_id: userId
        });

        if (prefsError || !billingPrefs?.[0]?.billing_email_enabled) {
          results.push({
            user_id: userId,
            status: 'skipped',
            reason: 'Billing emails disabled'
          });
          continue;
        }

        const prefs = billingPrefs[0];

        // Calculate optimal send time based on user timezone
        const optimalSendTime = calculateOptimalSendTime(scheduledFor, prefs.timezone);

        // Schedule the email
        const { data: scheduleId, error: scheduleError } = await supabaseClient.rpc('schedule_billing_reminder', {
          p_user_id: userId,
          p_subscription_id: profile.stripe_subscription_id,
          p_reminder_type: reminderType,
          p_scheduled_for: optimalSendTime,
          p_template_data: {
            ...templateData,
            recipientName: profile.full_name || profile.email,
            recipientEmail: profile.email
          },
          p_language: prefs.preferred_language
        });

        if (scheduleError) {
          results.push({
            user_id: userId,
            status: 'error',
            error: scheduleError.message
          });
        } else {
          results.push({
            user_id: userId,
            status: 'scheduled',
            schedule_id: scheduleId,
            scheduled_for: optimalSendTime
          });
        }

      } catch (error) {
        console.error(`Error scheduling reminder for user ${userId}:`, error);
        results.push({
          user_id: userId,
          status: 'error',
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        scheduled: results.filter(r => r.status === 'scheduled').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        errors: results.filter(r => r.status === 'error').length,
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error scheduling billing reminders:', error);
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
 * Process scheduled emails that are due to be sent
 */
async function processScheduledEmails() {
  console.log('Processing scheduled emails...');
  
  try {
    // Get pending reminders with rate limiting
    const { data: pendingReminders, error } = await supabaseClient.rpc('get_pending_billing_reminders');
    
    if (error) {
      throw new Error(`Failed to get pending reminders: ${error.message}`);
    }

    const results = [];
    const batchSize = 10; // Process in batches to avoid overwhelming the email service
    
    for (let i = 0; i < (pendingReminders?.length || 0); i += batchSize) {
      const batch = pendingReminders!.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (reminder) => {
        try {
          // Check if we should respect quiet hours
          const shouldRespectQuietHours = await checkQuietHours(reminder.user_id);
          if (shouldRespectQuietHours) {
            // Reschedule for later
            const nextSendTime = calculateNextSendTime(reminder.user_id);
            await supabaseClient
              .from('billing_email_schedule')
              .update({ scheduled_for: nextSendTime })
              .eq('id', reminder.schedule_id);
            
            return {
              schedule_id: reminder.schedule_id,
              status: 'rescheduled',
              reason: 'quiet_hours',
              next_send_time: nextSendTime
            };
          }

          // Enhanced email sending with delivery tracking
          const emailResult = await sendEmailWithTracking(reminder);
          
          if (emailResult.success) {
            // Mark as sent with delivery tracking
            await supabaseClient.rpc('mark_billing_reminder_sent', {
              p_schedule_id: reminder.schedule_id,
              p_success: true
            });

            // Update with provider message ID for tracking
            if (emailResult.messageId) {
              await supabaseClient
                .from('billing_email_schedule')
                .update({ 
                  delivered_at: new Date().toISOString(),
                  delivery_attempts: supabaseClient.raw('delivery_attempts + 1')
                })
                .eq('id', reminder.schedule_id);
            }

            return {
              schedule_id: reminder.schedule_id,
              status: 'sent',
              message_id: emailResult.messageId
            };
          } else {
            // Handle failure with retry logic
            const shouldRetry = await handleEmailFailure(reminder, emailResult.error);
            
            await supabaseClient.rpc('mark_billing_reminder_sent', {
              p_schedule_id: reminder.schedule_id,
              p_success: false,
              p_error_message: emailResult.error
            });

            return {
              schedule_id: reminder.schedule_id,
              status: shouldRetry ? 'retry_scheduled' : 'failed',
              error: emailResult.error
            };
          }

        } catch (error) {
          console.error(`Error processing reminder ${reminder.schedule_id}:`, error);
          return {
            schedule_id: reminder.schedule_id,
            status: 'error',
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches to respect rate limits
      if (i + batchSize < (pendingReminders?.length || 0)) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        sent: results.filter(r => r.status === 'sent').length,
        failed: results.filter(r => r.status === 'failed').length,
        rescheduled: results.filter(r => r.status === 'rescheduled').length,
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error processing scheduled emails:', error);
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
 * Reschedule failed emails with exponential backoff
 */
async function rescheduleFailedEmails(params: any) {
  const { maxRetries = 3, backoffMultiplier = 2 } = params;
  
  console.log('Rescheduling failed emails...');
  
  try {
    // Get failed emails that can be retried
    const { data: failedEmails, error } = await supabaseClient
      .from('billing_email_schedule')
      .select('*')
      .eq('status', 'failed')
      .lt('delivery_attempts', maxRetries)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Last 7 days

    if (error) {
      throw new Error(`Failed to get failed emails: ${error.message}`);
    }

    const results = [];

    for (const email of failedEmails || []) {
      try {
        // Calculate next retry time with exponential backoff
        const retryDelay = Math.pow(backoffMultiplier, email.delivery_attempts) * 60 * 60 * 1000; // Hours in milliseconds
        const nextRetryTime = new Date(Date.now() + retryDelay);

        // Update the email to be rescheduled
        const { error: updateError } = await supabaseClient
          .from('billing_email_schedule')
          .update({
            status: 'scheduled',
            scheduled_for: nextRetryTime.toISOString(),
            error_message: null
          })
          .eq('id', email.id);

        if (updateError) {
          results.push({
            email_id: email.id,
            status: 'error',
            error: updateError.message
          });
        } else {
          results.push({
            email_id: email.id,
            status: 'rescheduled',
            next_retry: nextRetryTime.toISOString(),
            attempt: email.delivery_attempts + 1
          });
        }

      } catch (error) {
        console.error(`Error rescheduling email ${email.id}:`, error);
        results.push({
          email_id: email.id,
          status: 'error',
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        rescheduled: results.filter(r => r.status === 'rescheduled').length,
        errors: results.filter(r => r.status === 'error').length,
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error rescheduling failed emails:', error);
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
 * Cancel a scheduled email
 */
async function cancelScheduledEmail(scheduleId: string) {
  console.log(`Canceling scheduled email ${scheduleId}`);

  try {
    const { error } = await supabaseClient
      .from('billing_email_schedule')
      .update({ status: 'cancelled' })
      .eq('id', scheduleId)
      .eq('status', 'scheduled'); // Only cancel if still scheduled

    if (error) {
      throw new Error(`Failed to cancel email: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email cancelled successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error canceling scheduled email:', error);
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
 * Get email delivery statistics
 */
async function getEmailDeliveryStats(params: any) {
  const { userId, dateRange = '7d', reminderType } = params;

  console.log(`Getting email delivery stats for user ${userId}`);

  try {
    let dateFilter = new Date();
    switch (dateRange) {
      case '24h':
        dateFilter.setHours(dateFilter.getHours() - 24);
        break;
      case '7d':
        dateFilter.setDate(dateFilter.getDate() - 7);
        break;
      case '30d':
        dateFilter.setDate(dateFilter.getDate() - 30);
        break;
      default:
        dateFilter.setDate(dateFilter.getDate() - 7);
    }

    let query = supabaseClient
      .from('billing_email_schedule')
      .select('status, reminder_type, created_at, sent_at, delivered_at, failed_at, error_message')
      .gte('created_at', dateFilter.toISOString());

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (reminderType) {
      query = query.eq('reminder_type', reminderType);
    }

    const { data: emails, error } = await query;

    if (error) {
      throw new Error(`Failed to get email stats: ${error.message}`);
    }

    // Calculate statistics
    const stats = {
      total: emails?.length || 0,
      sent: emails?.filter(e => e.status === 'sent').length || 0,
      delivered: emails?.filter(e => e.status === 'delivered').length || 0,
      failed: emails?.filter(e => e.status === 'failed').length || 0,
      scheduled: emails?.filter(e => e.status === 'scheduled').length || 0,
      cancelled: emails?.filter(e => e.status === 'cancelled').length || 0,
      delivery_rate: 0,
      failure_rate: 0,
      by_type: {} as Record<string, number>,
      recent_failures: [] as any[]
    };

    if (stats.total > 0) {
      stats.delivery_rate = Math.round((stats.delivered / stats.total) * 100);
      stats.failure_rate = Math.round((stats.failed / stats.total) * 100);
    }

    // Group by reminder type
    emails?.forEach(email => {
      stats.by_type[email.reminder_type] = (stats.by_type[email.reminder_type] || 0) + 1;
    });

    // Get recent failures for troubleshooting
    stats.recent_failures = emails?.filter(e => e.status === 'failed')
      .slice(0, 10)
      .map(e => ({
        reminder_type: e.reminder_type,
        failed_at: e.failed_at,
        error_message: e.error_message
      })) || [];

    return new Response(
      JSON.stringify({
        success: true,
        date_range: dateRange,
        stats
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error getting email delivery stats:', error);
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
 * Update email preferences for a user
 */
async function updateEmailPreferences(params: any) {
  const { userId, preferences } = params;

  console.log(`Updating email preferences for user ${userId}`);

  try {
    const { error } = await supabaseClient
      .from('billing_preferences')
      .upsert({
        user_id: userId,
        auto_renewal_enabled: preferences.auto_renewal_enabled,
        auto_renewal_frequency: preferences.auto_renewal_frequency,
        billing_email_enabled: preferences.billing_email_enabled,
        reminder_days_before_renewal: preferences.reminder_days_before_renewal,
        payment_failure_notifications: preferences.payment_failure_notifications,
        grace_period_notifications: preferences.grace_period_notifications,
        max_payment_retry_attempts: preferences.max_payment_retry_attempts,
        retry_interval_hours: preferences.retry_interval_hours,
        grace_period_days: preferences.grace_period_days,
        preferred_language: preferences.preferred_language,
        timezone: preferences.timezone,
        email_notifications_enabled: preferences.billing_email_enabled,
        sms_notifications_enabled: preferences.sms_notifications_enabled,
        push_notifications_enabled: preferences.push_notifications_enabled,
        quiet_hours_start: preferences.quiet_hours_start,
        quiet_hours_end: preferences.quiet_hours_end,
        updated_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to update preferences: ${error.message}`);
    }

    // Log the preference update
    await supabaseClient.rpc('log_billing_event', {
      p_user_id: userId,
      p_event_type: 'email_preferences_updated',
      p_event_description: 'User updated email notification preferences',
      p_new_values: preferences,
      p_triggered_by: 'user'
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email preferences updated successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error updating email preferences:', error);
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
 * Preview email template with sample data
 */
async function previewEmailTemplate(params: any) {
  const { templateType, language = 'en', sampleData } = params;

  console.log(`Previewing email template: ${templateType} (${language})`);

  try {
    // Generate email using the template system
    const { data, error } = await supabaseClient.functions.invoke('send-email', {
      body: {
        to: 'preview@example.com',
        template_name: templateType,
        template_data: {
          ...sampleData,
          language
        },
        preview_mode: true // Special flag to prevent actual sending
      }
    });

    if (error) {
      throw new Error(`Failed to generate preview: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        preview: data
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error previewing email template:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// Helper Functions

/**
 * Calculate optimal send time based on user timezone and preferences
 */
function calculateOptimalSendTime(baseTime: string, timezone: string = 'UTC'): string {
  const baseDate = new Date(baseTime);

  // Default to 9:00 AM in user's timezone for optimal engagement
  const optimalHour = 9;

  try {
    // Create date in user's timezone
    const userDate = new Date(baseDate.toLocaleString('en-US', { timeZone: timezone }));
    userDate.setHours(optimalHour, 0, 0, 0);

    // If the optimal time has already passed today, schedule for tomorrow
    if (userDate <= new Date()) {
      userDate.setDate(userDate.getDate() + 1);
    }

    return userDate.toISOString();
  } catch (error) {
    console.error('Error calculating optimal send time:', error);
    // Fallback to base time if timezone calculation fails
    return baseTime;
  }
}

/**
 * Check if current time is within user's quiet hours
 */
async function checkQuietHours(userId: string): Promise<boolean> {
  try {
    const { data: prefs, error } = await supabaseClient
      .from('billing_preferences')
      .select('quiet_hours_start, quiet_hours_end, timezone')
      .eq('user_id', userId)
      .single();

    if (error || !prefs?.quiet_hours_start || !prefs?.quiet_hours_end) {
      return false; // No quiet hours configured
    }

    const now = new Date();
    const userTimezone = prefs.timezone || 'UTC';

    // Get current time in user's timezone
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
    const currentHour = userTime.getHours();
    const currentMinute = userTime.getMinutes();
    const currentTime = currentHour * 60 + currentMinute; // Minutes since midnight

    // Parse quiet hours
    const [startHour, startMinute] = prefs.quiet_hours_start.split(':').map(Number);
    const [endHour, endMinute] = prefs.quiet_hours_end.split(':').map(Number);
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    // Check if current time is within quiet hours
    if (startTime <= endTime) {
      // Same day quiet hours (e.g., 22:00 - 08:00 next day)
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight quiet hours (e.g., 22:00 - 08:00 next day)
      return currentTime >= startTime || currentTime <= endTime;
    }
  } catch (error) {
    console.error('Error checking quiet hours:', error);
    return false;
  }
}

/**
 * Calculate next send time outside of quiet hours
 */
async function calculateNextSendTime(userId: string): Promise<string> {
  try {
    const { data: prefs, error } = await supabaseClient
      .from('billing_preferences')
      .select('quiet_hours_end, timezone')
      .eq('user_id', userId)
      .single();

    if (error || !prefs?.quiet_hours_end) {
      // No quiet hours, schedule for 1 hour from now
      return new Date(Date.now() + 60 * 60 * 1000).toISOString();
    }

    const userTimezone = prefs.timezone || 'UTC';
    const now = new Date();

    // Get current date in user's timezone
    const userDate = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));

    // Parse quiet hours end time
    const [endHour, endMinute] = prefs.quiet_hours_end.split(':').map(Number);

    // Set to end of quiet hours
    userDate.setHours(endHour, endMinute, 0, 0);

    // If end time has already passed today, schedule for tomorrow
    if (userDate <= now) {
      userDate.setDate(userDate.getDate() + 1);
    }

    return userDate.toISOString();
  } catch (error) {
    console.error('Error calculating next send time:', error);
    // Fallback to 1 hour from now
    return new Date(Date.now() + 60 * 60 * 1000).toISOString();
  }
}

/**
 * Send email with enhanced tracking
 */
async function sendEmailWithTracking(reminder: any): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { data, error } = await supabaseClient.functions.invoke('send-email', {
      body: {
        to: reminder.user_email,
        template_name: reminder.reminder_type,
        template_data: reminder.template_data,
        related_entity_type: 'billing_reminder',
        related_entity_id: reminder.schedule_id,
        metadata: {
          reminder_type: reminder.reminder_type,
          subscription_id: reminder.subscription_id,
          scheduled_for: reminder.scheduled_for
        }
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      messageId: data?.id || data?.messageId
    };
  } catch (error) {
    console.error('Error sending email with tracking:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle email failure and determine if retry is appropriate
 */
async function handleEmailFailure(reminder: any, error: string): Promise<boolean> {
  const maxRetries = 3;
  const currentAttempts = reminder.delivery_attempts || 0;

  // Check if we should retry based on error type
  const retryableErrors = [
    'rate_limit',
    'temporary_failure',
    'timeout',
    'network_error',
    'service_unavailable'
  ];

  const isRetryable = retryableErrors.some(retryableError =>
    error.toLowerCase().includes(retryableError)
  );

  if (!isRetryable || currentAttempts >= maxRetries) {
    return false; // Don't retry
  }

  // Calculate retry delay with exponential backoff
  const retryDelay = Math.pow(2, currentAttempts) * 60 * 60 * 1000; // Hours in milliseconds
  const retryTime = new Date(Date.now() + retryDelay);

  // Update the reminder to be retried
  await supabaseClient
    .from('billing_email_schedule')
    .update({
      status: 'scheduled',
      scheduled_for: retryTime.toISOString(),
      delivery_attempts: currentAttempts + 1
    })
    .eq('id', reminder.schedule_id);

  return true; // Retry scheduled
}
