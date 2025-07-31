import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@14.21.0";
import {
  mapPriceIdToTier,
  mapStripeStatusToOurStatus,
  getDebugInfo,
  validateStripeEnvironment
} from '../_shared/stripe-config.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const supabaseClient = createClient(
  Deno.env.get('VITE_SUPABASE_URL') ?? '',
  Deno.env.get('SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  console.log('Webhook received:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
    hasStripeSignature: !!req.headers.get('stripe-signature'),
    hasWebhookSecret: !!Deno.env.get('STRIPE_WEBHOOK_SECRET'),
    supabaseUrl: !!Deno.env.get('VITE_SUPABASE_URL'),
    serviceRoleKey: !!Deno.env.get('SERVICE_ROLE_KEY')
  });

  const signature = req.headers.get('stripe-signature');
  const body = await req.text();
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  console.log('Webhook debug info:', {
    signaturePresent: !!signature,
    signatureValue: signature ? signature.substring(0, 20) + '...' : 'null',
    webhookSecretPresent: !!webhookSecret,
    webhookSecretValue: webhookSecret ? webhookSecret.substring(0, 20) + '...' : 'null',
    bodyLength: body.length
  });

  if (!signature || !webhookSecret) {
    console.error('Missing signature or webhook secret:', { signature: !!signature, webhookSecret: !!webhookSecret });
    return new Response('Missing signature or webhook secret', { status: 400 });
  }

  try {
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    console.log(`Processing webhook event: ${event.type}`);

    // Extract customer ID for logging
    const getCustomerId = (obj: any): string | undefined => {
      return obj.customer || obj.subscription?.customer || obj.setup_intent?.customer;
    };

    const customerId = getCustomerId(event.data.object);

    switch (event.type) {
      case 'checkout.session.completed':
        await handleWebhookEventSafely(
          event.type,
          event.id,
          () => handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session),
          customerId
        );
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleWebhookEventSafely(
          event.type,
          event.id,
          () => handleSubscriptionChange(event.data.object as Stripe.Subscription),
          customerId
        );
        break;

      case 'customer.subscription.deleted':
        await handleWebhookEventSafely(
          event.type,
          event.id,
          () => handleSubscriptionDeleted(event.data.object as Stripe.Subscription),
          customerId
        );
        break;

      case 'invoice.payment_succeeded':
        await handleWebhookEventSafely(
          event.type,
          event.id,
          () => handlePaymentSucceeded(event.data.object as Stripe.Invoice),
          customerId
        );
        break;

      case 'invoice.payment_failed':
        await handleWebhookEventSafely(
          event.type,
          event.id,
          () => handlePaymentFailed(event.data.object as Stripe.Invoice),
          customerId
        );
        break;

      case 'invoice.payment_action_required':
        await handleWebhookEventSafely(
          event.type,
          event.id,
          () => handlePaymentActionRequired(event.data.object as Stripe.Invoice),
          customerId
        );
        break;

      // Enhanced billing system events
      case 'invoice.upcoming':
        await handleWebhookEventSafely(
          event.type,
          event.id,
          () => handleUpcomingInvoice(event.data.object as Stripe.Invoice),
          customerId
        );
        break;

      case 'invoice.finalized':
        await handleWebhookEventSafely(
          event.type,
          event.id,
          () => handleInvoiceFinalized(event.data.object as Stripe.Invoice),
          customerId
        );
        break;

      case 'customer.subscription.trial_will_end':
        await handleWebhookEventSafely(
          event.type,
          event.id,
          () => handleTrialWillEnd(event.data.object as Stripe.Subscription),
          customerId
        );
        break;

      case 'payment_method.attached':
        await handleWebhookEventSafely(
          event.type,
          event.id,
          () => handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod),
          customerId
        );
        break;

      case 'payment_method.detached':
        await handleWebhookEventSafely(
          event.type,
          event.id,
          () => handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod),
          customerId
        );
        break;

      case 'setup_intent.succeeded':
        await handleWebhookEventSafely(
          event.type,
          event.id,
          () => handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent),
          customerId
        );
        break;

      // Handle subscription item updates (for plan changes)
      case 'subscription_schedule.updated':
      case 'subscription_schedule.completed':
        console.log(`Subscription schedule event: ${event.type}`, event.data.object);
        // These events might contain subscription changes, but we'll rely on subscription.updated
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`, {
          eventId: event.id,
          created: event.created,
          livemode: event.livemode
        });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      signatureLength: signature?.length,
      webhookSecretLength: webhookSecret?.length
    });

    // Return 401 for signature verification errors, 400 for other errors
    const status = error.message?.includes('signature') || error.message?.includes('timestamp') ? 401 : 400;
    return new Response(`Webhook error: ${error.message}`, { status });
  }
});

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  console.log(`Processing checkout session completed for customer ${customerId}:`, {
    sessionId: session.id,
    subscriptionId: subscriptionId,
    paymentStatus: session.payment_status,
    mode: session.mode
  });

  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      console.log(`Retrieved subscription ${subscriptionId} for checkout session ${session.id}`);
      await handleSubscriptionChange(subscription);
    } catch (error) {
      console.error(`Error processing subscription ${subscriptionId} from checkout session ${session.id}:`, error);
      throw error;
    }
  } else {
    console.warn(`No subscription ID found in checkout session ${session.id} for customer ${customerId}`);
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  console.log(`Processing subscription change for customer ${customerId}:`, {
    subscriptionId: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    items: subscription.items.data.map(item => ({
      priceId: item.price.id,
      productId: item.price.product
    }))
  });

  // Get the price ID to determine tier
  const priceId = subscription.items.data[0]?.price.id;
  const newTier = mapPriceIdToTier(priceId);
  const status = mapStripeStatusToOurStatus(subscription.status);

  // Check if this is a tier change by comparing with current database tier
  let isDowngrade = false;
  let isUpgrade = false;
  let previousTier = null;

  try {
    const { data: currentProfile } = await supabaseClient
      .from('profiles')
      .select('subscription_tier')
      .eq('stripe_customer_id', customerId)
      .single();

    if (currentProfile?.subscription_tier) {
      previousTier = currentProfile.subscription_tier;
      const tierHierarchy = { 'free': 0, 'pro': 1, 'max': 2 };
      const previousLevel = tierHierarchy[previousTier as keyof typeof tierHierarchy] || 0;
      const newLevel = tierHierarchy[newTier] || 0;

      isDowngrade = newLevel < previousLevel;
      isUpgrade = newLevel > previousLevel;
    }
  } catch (error) {
    console.warn(`Could not fetch current tier for customer ${customerId}:`, error);
  }

  const changeType = isDowngrade ? 'DOWNGRADE' : isUpgrade ? 'UPGRADE' : 'UPDATE';

  console.log(`${changeType} detected for customer ${customerId}:`, {
    previousTier,
    newTier,
    priceId,
    status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    isScheduledChange: subscription.cancel_at_period_end && status === 'active'
  });

  if (isDowngrade) {
    console.log(`🔽 DOWNGRADE: Customer ${customerId} downgraded from ${previousTier} to ${newTier}`);
  } else if (isUpgrade) {
    console.log(`🔼 UPGRADE: Customer ${customerId} upgraded from ${previousTier} to ${newTier}`);
  }

  try {
    const { data, error } = await supabaseClient.rpc('update_subscription_from_stripe', {
      _stripe_customer_id: customerId,
      _stripe_subscription_id: subscription.id,
      _tier: newTier,
      _status: status,
      _current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      _current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      _trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    });

    if (error) {
      console.error(`Error updating subscription for customer ${customerId}:`, error);
      throw error;
    }

    console.log(`Successfully updated subscription for customer ${customerId} to tier ${newTier} with status ${status}`);

    if (isDowngrade) {
      console.log(`✅ DOWNGRADE COMPLETED: Customer ${customerId} successfully downgraded from ${previousTier} to ${newTier}`);
    } else if (isUpgrade) {
      console.log(`✅ UPGRADE COMPLETED: Customer ${customerId} successfully upgraded from ${previousTier} to ${newTier}`);
    }

    // Verify the update by checking the database
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, subscription_tier, subscription_status, stripe_customer_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (profileError) {
      console.error(`Error verifying subscription update for customer ${customerId}:`, profileError);
    } else {
      console.log(`Verification: Customer ${customerId} profile updated:`, {
        userId: profile.id,
        tier: profile.subscription_tier,
        status: profile.subscription_status,
        changeType: changeType,
        previousTier: previousTier,
        newTier: newTier
      });

      // Additional verification for downgrades
      if (isDowngrade && profile.subscription_tier === newTier) {
        console.log(`🎉 DOWNGRADE VERIFICATION SUCCESSFUL: Database tier matches expected downgrade tier (${newTier})`);
      } else if (isUpgrade && profile.subscription_tier === newTier) {
        console.log(`🎉 UPGRADE VERIFICATION SUCCESSFUL: Database tier matches expected upgrade tier (${newTier})`);
      }

      // Initialize billing preferences for new active subscriptions
      if (subscription.status === 'active' && (changeType === 'new_subscription' || changeType === 'reactivation')) {
        await supabaseClient.rpc('initialize_billing_preferences', {
          p_user_id: profile.id,
          p_subscription_tier: newTier
        });
        console.log(`Billing preferences initialized for user ${profile.id}`);
      }

      // Schedule renewal reminders for active subscriptions
      if (subscription.status === 'active' && subscription.current_period_end) {
        try {
          await supabaseClient.functions.invoke('email-scheduler', {
            body: {
              action: 'schedule_billing_reminders',
              userId: profile.id,
              subscriptionId: subscription.id,
              renewalDate: new Date(subscription.current_period_end * 1000).toISOString()
            }
          });
          console.log(`Renewal reminders scheduled for user ${profile.id}`);
        } catch (error) {
          console.error(`Failed to schedule renewal reminders for user ${profile.id}:`, error);
        }
      }
    }

  } catch (error) {
    console.error(`Failed to update subscription for customer ${customerId}:`, error);
    throw error;
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  await supabaseClient.rpc('update_subscription_from_stripe', {
    _stripe_customer_id: customerId,
    _stripe_subscription_id: subscription.id,
    _tier: 'free',
    _status: 'canceled',
    _current_period_start: new Date().toISOString(),
    _current_period_end: new Date().toISOString(),
    _trial_end: null,
  });

  console.log(`Subscription deleted for customer ${customerId}, reverted to free tier`);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string;

  // Record payment in payment_history
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('id, subscription_tier')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profile) {
    await supabaseClient
      .from('payment_history')
      .insert({
        user_id: profile.id,
        stripe_payment_intent_id: invoice.payment_intent as string,
        stripe_subscription_id: subscriptionId,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: 'succeeded',
        tier: profile.subscription_tier,
        billing_period_start: new Date(invoice.period_start * 1000).toISOString(),
        billing_period_end: new Date(invoice.period_end * 1000).toISOString(),
      });

    // Update subscription renewal tracking
    if (invoice.subscription) {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
      await supabaseClient.rpc('update_subscription_renewal_tracking', {
        p_user_id: profile.id,
        p_stripe_subscription_id: subscription.id,
        p_current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        p_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        p_current_tier: profile.subscription_tier,
        p_current_price_id: subscription.items.data[0]?.price.id || '',
        p_status: 'active'
      });
    }

    // Clear any grace period and reset retry attempts
    await supabaseClient
      .from('profiles')
      .update({
        subscription_status: 'active',
        grace_period_end_date: null,
        payment_retry_attempts: 0,
        last_payment_attempt: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id);

    // Mark any pending payment retries as succeeded
    if (invoice.subscription) {
      await supabaseClient
        .from('payment_retry_tracking')
        .update({
          status: 'succeeded',
          succeeded_at: new Date().toISOString()
        })
        .eq('stripe_subscription_id', invoice.subscription as string)
        .eq('status', 'pending');
    }

    // Send payment confirmation email using the new email system
    await supabaseClient.functions.invoke('send-email', {
      body: {
        to: profile.email,
        template_name: 'payment_confirmation',
        template_data: {
          recipientName: profile.full_name || profile.email,
          recipientEmail: profile.email,
          subscriptionTier: profile.subscription_tier,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency,
          billingInterval: 'monthly', // TODO: Determine from subscription
          billingPeriodStart: new Date(invoice.period_start * 1000).toISOString(),
          billingPeriodEnd: new Date(invoice.period_end * 1000).toISOString(),
          nextBillingDate: new Date(invoice.period_end * 1000).toISOString(),
          paymentMethodLast4: profile.payment_method_last_four,
          paymentMethodBrand: profile.payment_method_brand,
          invoiceUrl: invoice.hosted_invoice_url,
          manageSubscriptionUrl: `${Deno.env.get('FRONTEND_URL')}/settings/billing`,
          language: 'en' // TODO: Get from user preferences
        }
      }
    });

    // Log successful payment
    await supabaseClient.rpc('log_billing_event', {
      p_user_id: profile.id,
      p_event_type: 'payment_succeeded',
      p_event_description: 'Subscription payment processed successfully',
      p_stripe_event_id: null,
      p_stripe_subscription_id: invoice.subscription as string,
      p_stripe_payment_intent_id: invoice.payment_intent as string,
      p_new_values: {
        amount_paid: invoice.amount_paid,
        currency: invoice.currency,
        invoice_id: invoice.id
      },
      p_triggered_by: 'stripe_webhook'
    });
  }

  console.log(`Payment succeeded for customer ${customerId}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  console.log(`Processing payment failure for customer ${customerId}, invoice ${invoice.id}`);

  // Get user profile
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profileError || !profile) {
    console.error(`Profile not found for customer ${customerId}:`, profileError);
    return;
  }

  // Handle renewal failure using the new system
  if (invoice.subscription) {
    const failureReason = invoice.last_finalization_error?.message || 'Payment failed';

    await supabaseClient.rpc('handle_renewal_failure', {
      p_user_id: profile.id,
      p_stripe_subscription_id: invoice.subscription as string,
      p_failure_reason: failureReason,
      p_stripe_invoice_id: invoice.id
    });

    // Get billing preferences to check if payment failure notifications are enabled
    const { data: billingPrefs, error: prefsError } = await supabaseClient.rpc('get_billing_preferences', {
      p_user_id: profile.id
    });

    if (!prefsError && billingPrefs?.[0]?.payment_failure_notifications && billingPrefs[0].billing_email_enabled) {
      const prefs = billingPrefs[0];

      // Schedule payment failed email with user preferences
      await supabaseClient.functions.invoke('send-email', {
        body: {
          to: profile.email,
          template_name: 'payment_failed',
          template_data: {
            recipientName: profile.full_name || profile.email,
            recipientEmail: profile.email,
            subscriptionTier: profile.subscription_tier,
            amount: invoice.amount_due / 100,
            currency: invoice.currency,
            failureReason: failureReason,
            retryAttempt: invoice.attempt_count || 1,
            maxRetryAttempts: prefs.max_payment_retry_attempts,
            nextRetryDate: invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000).toISOString() : null,
            gracePeriodDays: prefs.grace_period_days,
            updatePaymentMethodUrl: `${Deno.env.get('FRONTEND_URL')}/settings/billing?tab=payment-methods`,
            manageSubscriptionUrl: `${Deno.env.get('FRONTEND_URL')}/settings/billing`,
            language: prefs.preferred_language
          }
        }
      });
    } else {
      console.log(`Payment failure notifications disabled for user ${profile.id}, skipping email`);
    }

    console.log(`Payment failure handled for customer ${customerId}, grace period initiated`);
  } else {
    // Fallback for non-subscription payments
    await supabaseClient
      .from('profiles')
      .update({ subscription_status: 'past_due' })
      .eq('stripe_customer_id', customerId);

    console.log(`Payment failed for customer ${customerId}, marked as past_due`);
  }
}

async function handlePaymentActionRequired(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  console.log(`Payment action required for customer ${customerId}, invoice ${invoice.id}`);

  // Get user profile
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profileError || !profile) {
    console.error(`Profile not found for customer ${customerId}:`, profileError);
    return;
  }

  // Update subscription status to indicate action required
  await supabaseClient
    .from('profiles')
    .update({
      subscription_status: 'incomplete',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_customer_id', customerId);

  // Log the event
  await supabaseClient.rpc('log_billing_event', {
    p_user_id: profile.id,
    p_event_type: 'payment_action_required',
    p_event_description: 'Payment requires additional authentication',
    p_stripe_subscription_id: invoice.subscription as string,
    p_stripe_payment_intent_id: invoice.payment_intent as string,
    p_metadata: {
      invoice_id: invoice.id,
      amount_due: invoice.amount_due,
      currency: invoice.currency
    },
    p_triggered_by: 'stripe_webhook'
  });

  console.log(`Payment action required handled for customer ${customerId}`);
}

/**
 * Handle upcoming invoice (30 days before billing)
 */
async function handleUpcomingInvoice(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string;

  console.log(`Processing upcoming invoice for customer ${customerId}, invoice ${invoice.id}`);

  // Get user profile
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profileError || !profile) {
    console.error(`Profile not found for customer ${customerId}:`, profileError);
    return;
  }

  // Get billing preferences
  const { data: billingPrefs, error: prefsError } = await supabaseClient.rpc('get_billing_preferences', {
    p_user_id: profile.id
  });

  if (prefsError || !billingPrefs?.[0]?.billing_email_enabled) {
    console.log(`Billing emails disabled for user ${profile.id}, skipping upcoming invoice notification`);
    return;
  }

  const prefs = billingPrefs[0];

  // Schedule renewal reminder emails based on user preferences
  const renewalDate = new Date(invoice.period_end * 1000);
  const now = new Date();

  for (const daysBefore of prefs.reminder_days_before_renewal) {
    const reminderDate = new Date(renewalDate);
    reminderDate.setDate(reminderDate.getDate() - daysBefore);

    // Only schedule if the reminder date is in the future
    if (reminderDate > now) {
      await supabaseClient.rpc('schedule_billing_reminder', {
        p_user_id: profile.id,
        p_subscription_id: subscriptionId,
        p_reminder_type: 'upcoming_renewal',
        p_scheduled_for: reminderDate.toISOString(),
        p_template_data: {
          recipientName: profile.full_name || profile.email,
          recipientEmail: profile.email,
          subscriptionTier: profile.subscription_tier,
          renewalDate: renewalDate.toISOString(),
          amount: invoice.amount_due / 100,
          currency: invoice.currency,
          billingInterval: 'monthly', // TODO: Determine from subscription
          daysUntilRenewal: daysBefore,
          paymentMethodLast4: profile.payment_method_last_four,
          paymentMethodBrand: profile.payment_method_brand,
          manageSubscriptionUrl: `${Deno.env.get('FRONTEND_URL')}/settings/billing`,
          updatePaymentMethodUrl: `${Deno.env.get('FRONTEND_URL')}/settings/billing?tab=payment-method`
        },
        p_language: prefs.preferred_language
      });

      console.log(`Scheduled ${daysBefore}-day renewal reminder for user ${profile.id}`);
    }
  }

  // Log the upcoming invoice event
  await supabaseClient.rpc('log_billing_event', {
    p_user_id: profile.id,
    p_event_type: 'upcoming_invoice_processed',
    p_event_description: 'Upcoming invoice processed and reminders scheduled',
    p_stripe_subscription_id: subscriptionId,
    p_metadata: {
      invoice_id: invoice.id,
      amount_due: invoice.amount_due,
      period_end: renewalDate.toISOString(),
      reminders_scheduled: prefs.reminder_days_before_renewal.filter(days => {
        const reminderDate = new Date(renewalDate);
        reminderDate.setDate(reminderDate.getDate() - days);
        return reminderDate > now;
      }).length
    },
    p_triggered_by: 'stripe_webhook'
  });

  console.log(`Upcoming invoice processed for customer ${customerId}`);
}

/**
 * Handle invoice finalized (invoice is ready for payment)
 */
async function handleInvoiceFinalized(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  console.log(`Processing finalized invoice for customer ${customerId}, invoice ${invoice.id}`);

  // Get user profile
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profileError || !profile) {
    console.error(`Profile not found for customer ${customerId}:`, profileError);
    return;
  }

  // Update next billing date
  if (invoice.period_end) {
    await supabaseClient
      .from('profiles')
      .update({
        next_billing_date: new Date(invoice.period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id);
  }

  // Log the finalized invoice event
  await supabaseClient.rpc('log_billing_event', {
    p_user_id: profile.id,
    p_event_type: 'invoice_finalized',
    p_event_description: 'Invoice finalized and ready for payment',
    p_stripe_subscription_id: invoice.subscription as string,
    p_metadata: {
      invoice_id: invoice.id,
      amount_due: invoice.amount_due,
      currency: invoice.currency,
      due_date: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null
    },
    p_triggered_by: 'stripe_webhook'
  });

  console.log(`Finalized invoice processed for customer ${customerId}`);
}

/**
 * Handle trial will end (3 days before trial ends)
 */
async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  console.log(`Processing trial will end for customer ${customerId}, subscription ${subscription.id}`);

  // Get user profile
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profileError || !profile) {
    console.error(`Profile not found for customer ${customerId}:`, profileError);
    return;
  }

  // Get billing preferences
  const { data: billingPrefs, error: prefsError } = await supabaseClient.rpc('get_billing_preferences', {
    p_user_id: profile.id
  });

  if (prefsError || !billingPrefs?.[0]?.billing_email_enabled) {
    console.log(`Billing emails disabled for user ${profile.id}, skipping trial end notification`);
    return;
  }

  const prefs = billingPrefs[0];

  // Send trial ending email
  await supabaseClient.functions.invoke('send-email', {
    body: {
      to: profile.email,
      template_name: 'trial_ending',
      template_data: {
        recipientName: profile.full_name || profile.email,
        recipientEmail: profile.email,
        subscriptionTier: profile.subscription_tier,
        trialEndDate: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        manageSubscriptionUrl: `${Deno.env.get('FRONTEND_URL')}/settings/billing`,
        pricingUrl: `${Deno.env.get('FRONTEND_URL')}/pricing`,
        language: prefs.preferred_language
      }
    }
  });

  // Log the trial ending event
  await supabaseClient.rpc('log_billing_event', {
    p_user_id: profile.id,
    p_event_type: 'trial_will_end',
    p_event_description: 'Trial ending notification sent',
    p_stripe_subscription_id: subscription.id,
    p_metadata: {
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null
    },
    p_triggered_by: 'stripe_webhook'
  });

  console.log(`Trial will end processed for customer ${customerId}`);
}

/**
 * Handle payment method attached
 */
async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  const customerId = paymentMethod.customer as string;

  console.log(`Processing payment method attached for customer ${customerId}, payment method ${paymentMethod.id}`);

  // Get user profile
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profileError || !profile) {
    console.error(`Profile not found for customer ${customerId}:`, profileError);
    return;
  }

  // Update payment method info in profile
  if (paymentMethod.card) {
    await supabaseClient
      .from('profiles')
      .update({
        payment_method_brand: paymentMethod.card.brand,
        payment_method_last_four: paymentMethod.card.last4,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id);
  }

  // Log the payment method attached event
  await supabaseClient.rpc('log_billing_event', {
    p_user_id: profile.id,
    p_event_type: 'payment_method_attached',
    p_event_description: 'New payment method attached to customer',
    p_metadata: {
      payment_method_id: paymentMethod.id,
      payment_method_type: paymentMethod.type,
      card_brand: paymentMethod.card?.brand,
      card_last4: paymentMethod.card?.last4,
      card_exp_month: paymentMethod.card?.exp_month,
      card_exp_year: paymentMethod.card?.exp_year
    },
    p_triggered_by: 'stripe_webhook'
  });

  console.log(`Payment method attached processed for customer ${customerId}`);
}

/**
 * Handle payment method detached
 */
async function handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod) {
  const customerId = paymentMethod.customer as string;

  console.log(`Processing payment method detached for customer ${customerId}, payment method ${paymentMethod.id}`);

  // Get user profile
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profileError || !profile) {
    console.error(`Profile not found for customer ${customerId}:`, profileError);
    return;
  }

  // Clear payment method info if this was the active one
  if (profile.payment_method_last_four === paymentMethod.card?.last4) {
    await supabaseClient
      .from('profiles')
      .update({
        payment_method_brand: null,
        payment_method_last_four: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id);
  }

  // Log the payment method detached event
  await supabaseClient.rpc('log_billing_event', {
    p_user_id: profile.id,
    p_event_type: 'payment_method_detached',
    p_event_description: 'Payment method detached from customer',
    p_metadata: {
      payment_method_id: paymentMethod.id,
      payment_method_type: paymentMethod.type,
      card_brand: paymentMethod.card?.brand,
      card_last4: paymentMethod.card?.last4
    },
    p_triggered_by: 'stripe_webhook'
  });

  console.log(`Payment method detached processed for customer ${customerId}`);
}

/**
 * Handle setup intent succeeded (payment method setup completed)
 */
async function handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent) {
  const customerId = setupIntent.customer as string;

  console.log(`Processing setup intent succeeded for customer ${customerId}, setup intent ${setupIntent.id}`);

  // Get user profile
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profileError || !profile) {
    console.error(`Profile not found for customer ${customerId}:`, profileError);
    return;
  }

  // Get the payment method details
  if (setupIntent.payment_method) {
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(setupIntent.payment_method as string);

      // Update payment method info in profile
      if (paymentMethod.card) {
        await supabaseClient
          .from('profiles')
          .update({
            payment_method_brand: paymentMethod.card.brand,
            payment_method_last_four: paymentMethod.card.last4,
            updated_at: new Date().toISOString()
          })
          .eq('id', profile.id);
      }
    } catch (error) {
      console.error(`Error retrieving payment method for setup intent ${setupIntent.id}:`, error);
    }
  }

  // Log the setup intent succeeded event
  await supabaseClient.rpc('log_billing_event', {
    p_user_id: profile.id,
    p_event_type: 'setup_intent_succeeded',
    p_event_description: 'Payment method setup completed successfully',
    p_metadata: {
      setup_intent_id: setupIntent.id,
      payment_method_id: setupIntent.payment_method
    },
    p_triggered_by: 'stripe_webhook'
  });

  console.log(`Setup intent succeeded processed for customer ${customerId}`);
}

/**
 * Enhanced webhook event logging with comprehensive error handling
 */
async function logWebhookEvent(
  eventType: string,
  eventId: string,
  customerId: string | null,
  success: boolean,
  error?: any,
  metadata?: any
) {
  try {
    // Get user profile if customer ID is available
    let userId = null;
    if (customerId) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

      userId = profile?.id || null;
    }

    // Log the webhook event
    await supabaseClient.rpc('log_billing_event', {
      p_user_id: userId,
      p_event_type: `webhook_${eventType}`,
      p_event_description: success
        ? `Webhook ${eventType} processed successfully`
        : `Webhook ${eventType} processing failed`,
      p_stripe_event_id: eventId,
      p_metadata: {
        event_type: eventType,
        customer_id: customerId,
        success: success,
        error: error ? {
          message: error.message,
          stack: error.stack?.substring(0, 1000) // Limit stack trace length
        } : null,
        ...metadata
      },
      p_triggered_by: 'stripe_webhook'
    });

    console.log(`Webhook event logged: ${eventType} - ${success ? 'SUCCESS' : 'FAILED'}`);
  } catch (logError) {
    console.error(`Failed to log webhook event ${eventType}:`, logError);
  }
}

/**
 * Enhanced error handling wrapper for webhook handlers
 */
async function handleWebhookEventSafely(
  eventType: string,
  eventId: string,
  handler: () => Promise<void>,
  customerId?: string
) {
  try {
    await handler();
    await logWebhookEvent(eventType, eventId, customerId || null, true);
  } catch (error) {
    console.error(`Error handling webhook event ${eventType}:`, error);
    await logWebhookEvent(eventType, eventId, customerId || null, false, error);

    // Don't throw the error to prevent webhook retries for non-critical failures
    // Only throw for critical subscription-related events
    if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(eventType)) {
      throw error;
    }
  }
}

async function sendPaymentConfirmationEmail(userId: string, paymentDetails: {
  amount: number;
  currency: string;
  tier: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
}) {
  try {
    // Get user email from auth.users
    const { data: user, error: userError } = await supabaseClient.auth.admin.getUserById(userId);

    if (userError || !user?.user?.email) {
      console.error('Error getting user email:', userError);
      return;
    }

    const email = user.user.email;
    const planNames = {
      'pro': 'Pro Plan',
      'max': 'Max Plan',
      'free': 'Free Plan'
    };

    // Create email content
    const subject = `Payment Confirmation - ${planNames[paymentDetails.tier as keyof typeof planNames]} Subscription`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .success-icon { font-size: 48px; margin-bottom: 20px; }
          .amount { font-size: 24px; font-weight: bold; color: #4CAF50; margin: 20px 0; }
          .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
          .detail-label { font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="success-icon">✅</div>
          <h1>Payment Successful!</h1>
          <p>Thank you for subscribing to ReceiptScan</p>
        </div>

        <div class="content">
          <div class="amount">${paymentDetails.currency} ${paymentDetails.amount.toFixed(2)}</div>

          <div class="details">
            <div class="detail-row">
              <span class="detail-label">Plan:</span>
              <span>${planNames[paymentDetails.tier as keyof typeof planNames]}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Amount:</span>
              <span>${paymentDetails.currency} ${paymentDetails.amount.toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Billing Period:</span>
              <span>${paymentDetails.billingPeriodStart.toLocaleDateString()} - ${paymentDetails.billingPeriodEnd.toLocaleDateString()}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Next Billing Date:</span>
              <span>${paymentDetails.billingPeriodEnd.toLocaleDateString()}</span>
            </div>
          </div>

          <p>Your subscription is now active! You can start enjoying all the features of your ${planNames[paymentDetails.tier as keyof typeof planNames]}.</p>

          <div style="text-align: center;">
            <a href="${Deno.env.get('SITE_URL') || 'https://mataresit.co'}/dashboard" class="button">
              Go to Dashboard
            </a>
          </div>

          <p>If you have any questions, please don't hesitate to contact our support team.</p>
        </div>

        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ReceiptScan. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    // Send email using our send-email edge function
    try {
      const emailResponse = await supabaseClient.functions.invoke('send-email', {
        body: {
          to: email,
          subject: subject,
          html: htmlContent,
        },
      });

      if (emailResponse.error) {
        console.error('Error sending email:', emailResponse.error);
      } else {
        console.log('Payment confirmation email sent successfully to:', email);
      }
    } catch (emailError) {
      console.error('Failed to send payment confirmation email:', emailError);
    }

  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
  }
}

// Functions now imported from _shared/stripe-config.ts
