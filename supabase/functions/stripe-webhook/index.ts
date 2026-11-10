import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@14.21.0";
import {
  isSubscriptionTier,
  resolveStripeStatusForDatabase,
  type SubscriptionTier,
} from '../_shared/stripe-config.ts';
import {
  applyFencedProfileStatus,
  applyFencedRenewalFailure,
  applyFencedRenewalTracking,
  applyFencedStripePaymentEvent,
  applyFencedStripeSubscriptionEvent,
  getSubscriptionBillingInterval,
  getSubscriptionTier,
  type WebhookClaimContext,
} from '../_shared/stripe-sync.ts';
import { releaseCheckoutLock } from '../_shared/checkout-locks.ts';
import { getFrontendUrl } from '../_shared/site-url.ts';
import { getServiceRoleKey } from '../_shared/service-role.ts';
import {
  createWebhookIdempotencyClient,
  handleWebhookEventSafely as runWebhookHandler,
  type WebhookClaim,
} from '../_shared/webhook-idempotency.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

// Deno's WebCrypto is async-only; the sync constructEvent() path fails on the
// edge runtime with "SubtleCryptoProvider cannot be used in a synchronous
// context", so verification must use the async API with this provider.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  getServiceRoleKey() ?? ''
);

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const webhookIdempotency = createWebhookIdempotencyClient(supabaseClient);

function getProfileName(profile: any): string {
  return [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || profile?.email || 'there';
}

/** Supabase returns errors instead of throwing them for many writes. */
async function requireSuccess(
  operation: PromiseLike<{ error: { message: string } | null }>,
  description: string,
): Promise<void> {
  const { error } = await operation;
  if (error) {
    throw new Error(`${description}: ${error.message}`);
  }
}

/** Optional notification/audit effects must not retry completed billing work. */
async function logOptionalBillingEvent(
  operation: PromiseLike<{ error: { message: string } | null }>,
  description: string,
): Promise<void> {
  try {
    const { error } = await operation;
    if (error) console.error(`${description}: ${error.message}`);
  } catch (error) {
    console.error(description, error);
  }
}

/* Claiming and completion live in _shared/webhook-idempotency.ts so the
 * lifecycle contract is testable without a live Supabase instance. */

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const signature = req.headers.get('stripe-signature');
  const body = await req.text();
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!signature || !webhookSecret) {
    return new Response('Missing signature or webhook secret', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (error) {
    console.error('Invalid Stripe webhook signature:', {
      message: error instanceof Error ? error.message : String(error),
    });
    return new Response('Invalid signature', { status: 400 });
  }

  // Claim acquisition is fail-closed: if the idempotency store is down or
  // returns an unexpected shape, acknowledge nothing and tell Stripe to retry.
  // This runs in its own try/catch so a claim failure cannot fall through to
  // the handler's unstructured error path.
  let claim: WebhookClaim;
  try {
    claim = await webhookIdempotency.claim(event.id, event.type);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Webhook claim failed for event ${event.id}:`, message);
    return jsonResponse({ error: 'Webhook claim failed' }, 500);
  }

  if (claim.outcome === 'duplicate') {
    return jsonResponse({ received: true, duplicate: true });
  }

  // Another delivery is actively processing this event. A non-2xx tells Stripe
  // to retry instead of silently dropping the work.
  if (claim.outcome === 'in_flight') {
    return jsonResponse({ received: true, status: 'in_flight' }, 409);
  }

  console.log(`Processing webhook event ${event.id} (${event.type})`);

  // Extract customer ID for logging
  const getCustomerId = (obj: any): string | undefined => {
    return obj.customer || obj.subscription?.customer || obj.setup_intent?.customer;
  };

  const customerId = getCustomerId(event.data.object);
  const activeClaim: WebhookClaimContext = {
    eventId: event.id,
    claimToken: claim.token,
    eventCreated: event.created,
  };

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleWebhookEventSafely(
          event.type,
          event.id,
          () => handleCheckoutSessionCompleted(
            event.data.object as Stripe.Checkout.Session,
            activeClaim,
          ),
          customerId
        );
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleWebhookEventSafely(
          event.type,
          event.id,
          () => handleSubscriptionChange(
            event.data.object as Stripe.Subscription,
            activeClaim,
          ),
          customerId
        );
        break;

      case 'customer.subscription.deleted':
        await handleWebhookEventSafely(
          event.type,
          event.id,
          () => handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription,
            activeClaim,
          ),
          customerId
        );
        break;

      case 'invoice.payment_succeeded':
        await handleWebhookEventSafely(
          event.type,
          event.id,
          () => handlePaymentSucceeded(event.data.object as Stripe.Invoice, activeClaim),
          customerId
        );
        break;

      case 'invoice.payment_failed':
        await handleWebhookEventSafely(
          event.type,
          event.id,
          () => handlePaymentFailed(event.data.object as Stripe.Invoice, activeClaim),
          customerId
        );
        break;

      case 'invoice.payment_action_required':
        await handleWebhookEventSafely(
          event.type,
          event.id,
          () => handlePaymentActionRequired(event.data.object as Stripe.Invoice, activeClaim),
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

    const claimed = await webhookIdempotency.complete(
      event.id,
      claim.token,
      'processed',
    );
    if (!claimed) {
      // A newer delivery reclaimed the event; do not report success for this run.
      return jsonResponse({ error: 'Event superseded by another delivery' }, 409);
    }

    return jsonResponse({ received: true });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Webhook event ${event.id} failed:`, message);
    // Mark the claim failed so a retry can reclaim it immediately. If the
    // completion store is also down, keep the original 500: the lease will
    // expire and the event becomes reclaimable instead of being reported as
    // processed.
    try {
      await webhookIdempotency.complete(event.id, claim.token, 'failed', message);
    } catch (completionError) {
      console.error(
        `Webhook failure completion failed for event ${event.id}:`,
        completionError instanceof Error ? completionError.message : String(completionError),
      );
    }

    // 5xx tells Stripe to retry. Signature errors were handled before this
    // block and never reach the handler.
    return jsonResponse({ error: 'Webhook processing failed' }, 500);
  }
});

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  claim: WebhookClaimContext,
) {
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  console.log(`Processing checkout session completed for customer ${customerId}:`, {
    sessionId: session.id,
    subscriptionId: subscriptionId,
    paymentStatus: session.payment_status,
    mode: session.mode
  });

  // The checkout is complete, so its ownership lock has done its job. Release
  // it before syncing: if the sync has to retry, the user can still start a new
  // checkout, and the release matches only the row bound to exactly this
  // session, so a delayed redelivery cannot free a newer checkout's lock. The
  // release is idempotent on every retry. client_reference_id carries the user
  // id set by create-checkout-session.
  if (session.client_reference_id) {
    await releaseCheckoutLock(supabaseClient, session.client_reference_id, { sessionId: session.id });
  }

  if (subscriptionId) {
    try {
      // The Checkout payload can be much older than a retry: read the current
      // subscription before applying state.
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      console.log(`Retrieved subscription ${subscriptionId} for checkout session ${session.id}`);
      await handleSubscriptionChange(subscription, claim);
    } catch (error) {
      console.error(`Error processing subscription ${subscriptionId} from checkout session ${session.id}:`, error);
      throw error;
    }
  } else {
    console.warn(`No subscription ID found in checkout session ${session.id} for customer ${customerId}`);
  }
}

async function handleSubscriptionChange(
  subscription: Stripe.Subscription,
  claim: WebhookClaimContext,
) {
  const customerId = subscription.customer as string;

  console.log(`Processing subscription change for customer ${customerId}:`, {
    subscriptionId: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    items: subscription.items.data.map((item: Stripe.SubscriptionItem) => ({
      priceId: item.price.id,
      productId: item.price.product
    }))
  });

  const status = resolveStripeStatusForDatabase(subscription.status);
  const billingInterval = getSubscriptionBillingInterval(subscription);

  let previousTier: string | null = null;
  let previousStatus: string | null = null;

  try {
    const { data: currentProfile } = await supabaseClient
      .from('profiles')
      .select('subscription_tier, subscription_status')
      .eq('stripe_customer_id', customerId)
      .single();

    previousTier = currentProfile?.subscription_tier ?? null;
    previousStatus = currentProfile?.subscription_status ?? null;
  } catch (error) {
    console.warn(`Could not fetch current tier for customer ${customerId}:`, error);
  }

  // An unregistered price must not fail the whole delivery. Preserve the tier
  // the profile already has (or the subscription metadata tier, which
  // getSubscriptionTier prefers) until the price is added to the secrets.
  const fallbackTier: SubscriptionTier = isSubscriptionTier(previousTier)
    ? previousTier
    : 'free';
  const newTier = getSubscriptionTier(subscription, fallbackTier);

  const tierHierarchy = { 'free': 0, 'pro': 1, 'max': 2 };
  const previousLevel = previousTier
    ? tierHierarchy[previousTier as keyof typeof tierHierarchy] ?? 0
    : 0;
  const newLevel = tierHierarchy[newTier] ?? 0;

  const isDowngrade = newLevel < previousLevel;
  const isUpgrade = newLevel > previousLevel;
  const isNewSubscription = !previousTier || previousTier === 'free';
  const isReactivation = Boolean(previousStatus && previousStatus !== 'active' && status === 'active');

  console.log(`Subscription change for customer ${customerId}:`, {
    previousTier,
    newTier,
    previousStatus,
    status,
    billingInterval,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    isDowngrade,
    isUpgrade,
    isNewSubscription,
    isReactivation,
  });

  // A negative sync means a delayed event for a superseded subscription: the
  // current subscription owns the profile, so acknowledge and skip all
  // post-sync side effects. A zero-row sync means Stripe has a paid
  // subscription this database cannot attribute to a profile. Throwing marks
  // the event failed and returns 500, so Stripe retries instead of us reporting
  // success and dropping the entitlement.
  const syncedRows = await applyFencedStripeSubscriptionEvent(
    supabaseClient,
    subscription,
    claim,
  );
  if (syncedRows < 0) {
    console.warn(
      `Skipped stale subscription event for customer ${customerId}: ` +
      `profile is bound to a newer subscription than ${subscription.id}`,
    );
    return;
  }
  if (syncedRows === 0) {
    throw new Error(
      `No profile matched Stripe customer ${customerId} for subscription ${subscription.id}`,
    );
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('id, subscription_tier, subscription_status, stripe_customer_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profileError || !profile) {
    throw new Error(`Failed to verify subscription update for customer ${customerId}: ${profileError?.message ?? 'no profile'}`);
  }

  // A subscription that is set to cancel at period end has no renewal to
  // remind the user about.
  if (status === 'active' && !subscription.cancel_at_period_end) {
    try {
      await supabaseClient.functions.invoke('email-scheduler', {
        body: {
          action: 'schedule_billing_reminders',
          userId: profile.id,
          subscriptionId: subscription.id,
          renewalDate: new Date(subscription.current_period_end * 1000).toISOString(),
        },
      });
    } catch (error) {
      console.error(`Failed to schedule renewal reminders for user ${profile.id}:`, error);
    }
  }
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  claim: WebhookClaimContext,
) {
  const customerId = subscription.customer as string;

  // A negative sync is a delayed event for a superseded subscription and must
  // be acknowledged. A zero-row sync means Stripe has a deleted subscription
  // this database cannot attribute to a profile: retry via 500 instead of
  // silently keeping a paid tier Stripe already cancelled.
  const deletedRows = await applyFencedStripeSubscriptionEvent(
    supabaseClient,
    subscription,
    claim,
    {
      tier: 'free',
      status: 'canceled',
      cancelAtPeriodEnd: false,
      billingInterval: 'monthly',
    },
  );
  if (deletedRows < 0) {
    console.warn(
      `Skipped stale deletion for customer ${customerId}: ` +
      `profile is bound to a newer subscription than ${subscription.id}`,
    );
    return;
  }
  if (deletedRows === 0) {
    throw new Error(
      `No profile matched Stripe customer ${customerId} for deleted subscription ${subscription.id}`,
    );
  }

  console.log(`Subscription deleted for customer ${customerId}, reverted to free tier`);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice, claim: WebhookClaimContext) {
  const customerId = invoice.customer as string;
  const subscriptionId = (invoice.subscription as string | null) ?? null;
  const paymentIntentId = (invoice.payment_intent as string | null) ?? invoice.id;

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('id, email, first_name, last_name, preferred_language, subscription_tier, payment_method_brand, payment_method_last_four')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profileError || !profile) {
    throw new Error(`Profile not found for customer ${customerId}: ${profileError?.message ?? 'no profile'}`);
  }

  let subscription: Stripe.Subscription | null = null;
  if (subscriptionId) {
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      console.warn(`Could not retrieve subscription ${subscriptionId}:`, error);
    }
  }

  const subscriptionTier = subscription
    ? getSubscriptionTier(
      subscription,
      isSubscriptionTier(profile.subscription_tier) ? profile.subscription_tier : 'free',
    )
    : (profile.subscription_tier ?? 'free');
  const billingInterval = subscription
    ? getSubscriptionBillingInterval(subscription)
    : 'monthly';

  // Required billing writes — payment row (idempotent per payment intent),
  // grace-period reset, retry-state close, and payment event order — commit in
  // one fenced transaction. A stale or superseded claim raises here before any
  // of them apply. The outcome distinguishes a state advance ('applied') from
  // a recorded-but-skipped payment (one-off, superseded, or out-of-order
  // event): both are success for the delivery.
  const paymentOutcome = await applyFencedStripePaymentEvent(
    supabaseClient,
    {
      customerId,
      subscriptionId,
      paymentIntentId,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      tier: subscriptionTier,
      billingPeriodStart: Number.isFinite(invoice.period_start)
        ? new Date(invoice.period_start * 1000).toISOString()
        : null,
      billingPeriodEnd: Number.isFinite(invoice.period_end)
        ? new Date(invoice.period_end * 1000).toISOString()
        : null,
    },
    claim,
  );

  if (paymentOutcome === 'recorded') {
    console.log(`Payment ${paymentIntentId} recorded without applying state (one-off, superseded, or out-of-order payment)`);
  }

  // Renewal tracking shares the payment-family watermark. An out-of-order
  // payment was recorded without advancing state, so asking the tracking RPC to
  // advance it now would fail the order check and turn a successfully recorded
  // payment into a 500 retry loop.
  if (subscription && paymentOutcome === 'applied') {
    // Renewal tracking and next_billing_date are required billing writes, so
    // they go through the same claim fence as the payment row: an expired
    // worker must not overwrite a newer billing period.
    await applyFencedRenewalTracking(
      supabaseClient,
      {
        userId: profile.id,
        subscriptionId: subscription.id,
        currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        currentTier: subscriptionTier,
        currentPriceId: subscription.items.data[0]?.price.id || '',
        status: 'active',
      },
      claim,
    );
  }

  // Email is a best-effort external effect: it is not entitlement state, so a
  // delivery failure must not block marking the billing event processed.
  if (profile.email) {
    try {
      const { error: emailError } = await supabaseClient.functions.invoke('send-email', {
      body: {
        to: profile.email,
        template_name: 'payment_confirmation',
        template_data: {
          recipientName: getProfileName(profile),
          recipientEmail: profile.email,
          subscriptionTier,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency,
          billingInterval,
          billingPeriodStart: new Date(invoice.period_start * 1000).toISOString(),
          billingPeriodEnd: new Date(invoice.period_end * 1000).toISOString(),
          nextBillingDate: new Date(invoice.period_end * 1000).toISOString(),
          paymentMethodLast4: profile.payment_method_last_four,
          paymentMethodBrand: profile.payment_method_brand,
          invoiceUrl: invoice.hosted_invoice_url,
          manageSubscriptionUrl: `${getFrontendUrl()}/settings?tab=billing`,
          language: profile.preferred_language === 'ms' ? 'ms' : 'en',
        },
      },
      });
      if (emailError) {
        console.error(`Payment confirmation invoke reported an error for user ${profile.id}:`, emailError);
      }
    } catch (error) {
      console.error(`Failed to send payment confirmation for user ${profile.id}:`, error);
    }
  }

  await logOptionalBillingEvent(
    supabaseClient.rpc('log_billing_event', {
      p_user_id: profile.id,
      p_event_type: 'payment_succeeded',
      p_event_description: 'Subscription payment processed successfully',
      p_stripe_event_id: null,
      p_stripe_subscription_id: subscriptionId || null,
      p_stripe_payment_intent_id: paymentIntentId,
      p_new_values: {
        amount_paid: invoice.amount_paid,
        currency: invoice.currency,
        invoice_id: invoice.id,
      },
      p_triggered_by: 'stripe_webhook',
    }),
    `Failed to audit successful payment for user ${profile.id}`,
  );

  console.log(`Payment succeeded for customer ${customerId}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice, claim: WebhookClaimContext) {
  const customerId = invoice.customer as string;

  console.log(`Processing payment failure for customer ${customerId}, invoice ${invoice.id}`);

  // Get user profile
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profileError || !profile) {
    throw new Error(`Profile not found for customer ${customerId}: ${profileError?.message ?? 'no profile'}`);
  }

  // Handle renewal failure using the new system
  if (invoice.subscription) {
    const failureReason = invoice.last_finalization_error?.message || 'Payment failed';

    // Grace period, retry tracking, and audit rows are written by the fenced
    // RPC so an expired worker cannot start a grace period after a newer
    // delivery already resolved this event.
    await applyFencedRenewalFailure(
      supabaseClient,
      {
        userId: profile.id,
        subscriptionId: invoice.subscription as string,
        failureReason: failureReason,
        invoiceId: invoice.id,
      },
      claim,
    );

    // Get billing preferences to check if payment failure notifications are enabled
    const { data: billingPrefs, error: prefsError } = await supabaseClient.rpc('get_billing_preferences', {
      p_user_id: profile.id
    });

    if (prefsError) {
      throw new Error(
        `Failed to read billing preferences for user ${profile.id}: ${prefsError.message}`,
      );
    }

    if (billingPrefs?.[0]?.payment_failure_notifications && billingPrefs[0].billing_email_enabled) {
      const prefs = billingPrefs[0];

      // Schedule payment failed email with user preferences. A delivery
      // failure must not retry the event: the grace period is already
      // committed, so email failures are logged, not thrown.
      try {
        const { error: emailError } = await supabaseClient.functions.invoke('send-email', {
          body: {
            to: profile.email,
            template_name: 'payment_failed',
            template_data: {
              recipientName: getProfileName(profile),
              recipientEmail: profile.email,
              subscriptionTier: profile.subscription_tier,
              amount: invoice.amount_due / 100,
              currency: invoice.currency,
              failureReason: failureReason,
              retryAttempt: invoice.attempt_count || 1,
              maxRetryAttempts: prefs.max_payment_retry_attempts,
              nextRetryDate: invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000).toISOString() : null,
              gracePeriodDays: prefs.grace_period_days,
              updatePaymentMethodUrl: `${getFrontendUrl()}/settings?tab=billing`,
              manageSubscriptionUrl: `${getFrontendUrl()}/settings?tab=billing`,
              language: prefs.preferred_language
            }
          }
        });
        if (emailError) {
          console.error(`Payment-failure email invoke reported an error for user ${profile.id}:`, emailError);
        }
      } catch (error) {
        console.error(`Failed to send payment-failure email for user ${profile.id}:`, error);
      }
    } else {
      console.log(`Payment failure notifications disabled for user ${profile.id}, skipping email`);
    }

    console.log(`Payment failure handled for customer ${customerId}, grace period initiated`);
  } else {
    // Fallback for non-subscription payments. The status change is fenced
    // against the claim like every other billing write.
    const statusRows = await applyFencedProfileStatus(
      supabaseClient,
      { customerId, subscriptionId: null, status: 'past_due' },
      claim,
    );

    if (statusRows === 0) {
      console.warn(`No profile status change applied for customer ${customerId}; a newer subscription owns the record`);
    } else {
      console.log(`Payment failed for customer ${customerId}, marked as past_due`);
    }
  }
}

async function handlePaymentActionRequired(invoice: Stripe.Invoice, claim: WebhookClaimContext) {
  const customerId = invoice.customer as string;

  console.log(`Payment action required for customer ${customerId}, invoice ${invoice.id}`);

  // Get user profile
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profileError || !profile) {
    throw new Error(`Profile not found for customer ${customerId}: ${profileError?.message ?? 'no profile'}`);
  }

  // Update subscription status to indicate action required, fenced against the
  // claim and scoped to the invoice's own subscription.
  const statusRows = await applyFencedProfileStatus(
    supabaseClient,
    {
      customerId,
      subscriptionId: (invoice.subscription as string | null) ?? null,
      status: 'incomplete',
    },
    claim,
  );

  if (statusRows === 0) {
    console.warn(`No profile status change applied for customer ${customerId}; a newer subscription owns the record`);
  }

  // Log the event
  await logOptionalBillingEvent(
    supabaseClient.rpc('log_billing_event', {
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
    }),
    `Failed to audit payment action required for user ${profile.id}`,
  );

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
    throw new Error(`Profile not found for customer ${customerId}: ${profileError?.message ?? 'no profile'}`);
  }

  // Get billing preferences
  const { data: billingPrefs, error: prefsError } = await supabaseClient.rpc('get_billing_preferences', {
    p_user_id: profile.id
  });

  if (prefsError) {
    throw new Error(
      `Failed to read billing preferences for user ${profile.id}: ${prefsError.message}`,
    );
  }
  if (!billingPrefs?.[0]?.billing_email_enabled) {
    console.log(`Billing emails disabled for user ${profile.id}, skipping upcoming invoice notification`);
    return;
  }

  const prefs = billingPrefs[0];

  let billingInterval = 'monthly';
  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      billingInterval = getSubscriptionBillingInterval(subscription);
    } catch (error) {
      console.warn(`Could not derive billing interval for ${subscriptionId}:`, error);
    }
  }

  // Schedule renewal reminder emails based on user preferences
  const renewalDate = new Date(invoice.period_end * 1000);
  const now = new Date();

  for (const daysBefore of prefs.reminder_days_before_renewal) {
    const reminderDate = new Date(renewalDate);
    reminderDate.setDate(reminderDate.getDate() - daysBefore);

    // Only schedule if the reminder date is in the future
    if (reminderDate > now) {
      await requireSuccess(
        supabaseClient.rpc('schedule_billing_reminder', {
          p_user_id: profile.id,
          p_subscription_id: subscriptionId,
          p_reminder_type: 'upcoming_renewal',
          p_scheduled_for: reminderDate.toISOString(),
          p_template_data: {
            recipientName: getProfileName(profile),
            recipientEmail: profile.email,
            subscriptionTier: profile.subscription_tier,
            renewalDate: renewalDate.toISOString(),
            amount: invoice.amount_due / 100,
            currency: invoice.currency,
            billingInterval,
            daysUntilRenewal: daysBefore,
            paymentMethodLast4: profile.payment_method_last_four,
            paymentMethodBrand: profile.payment_method_brand,
            manageSubscriptionUrl: `${getFrontendUrl()}/settings?tab=billing`,
            updatePaymentMethodUrl: `${getFrontendUrl()}/settings?tab=billing`
          },
          p_language: prefs.preferred_language
        }),
        `Failed to schedule ${daysBefore}-day renewal reminder for user ${profile.id}`,
      );

      console.log(`Scheduled ${daysBefore}-day renewal reminder for user ${profile.id}`);
    }
  }

  // Log the upcoming invoice event
  await logOptionalBillingEvent(
    supabaseClient.rpc('log_billing_event', {
      p_user_id: profile.id,
      p_event_type: 'upcoming_invoice_processed',
      p_event_description: 'Upcoming invoice processed and reminders scheduled',
      p_stripe_subscription_id: subscriptionId,
      p_metadata: {
        invoice_id: invoice.id,
        amount_due: invoice.amount_due,
        period_end: renewalDate.toISOString(),
        reminders_scheduled: prefs.reminder_days_before_renewal.filter((days: number) => {
          const reminderDate = new Date(renewalDate);
          reminderDate.setDate(reminderDate.getDate() - days);
          return reminderDate > now;
        }).length
      },
      p_triggered_by: 'stripe_webhook'
    }),
    `Failed to audit upcoming invoice for user ${profile.id}`,
  );

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
    throw new Error(`Profile not found for customer ${customerId}: ${profileError?.message ?? 'no profile'}`);
  }

  // Update next billing date
  if (invoice.period_end) {
    await requireSuccess(
      supabaseClient
        .from('profiles')
        .update({
          next_billing_date: new Date(invoice.period_end * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id),
      `Failed to update next billing date for user ${profile.id}`,
    );
  }

  // Log the finalized invoice event
  await logOptionalBillingEvent(
    supabaseClient.rpc('log_billing_event', {
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
    }),
    `Failed to audit finalized invoice for user ${profile.id}`,
  );

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
    throw new Error(`Profile not found for customer ${customerId}: ${profileError?.message ?? 'no profile'}`);
  }

  // Get billing preferences
  const { data: billingPrefs, error: prefsError } = await supabaseClient.rpc('get_billing_preferences', {
    p_user_id: profile.id
  });

  if (prefsError) {
    throw new Error(
      `Failed to read billing preferences for user ${profile.id}: ${prefsError.message}`,
    );
  }
  if (!billingPrefs?.[0]?.billing_email_enabled) {
    console.log(`Billing emails disabled for user ${profile.id}, skipping trial end notification`);
    return;
  }

  const prefs = billingPrefs[0];

  // Send trial ending email. A delivery failure must not retry the event: the
  // notification is best-effort and the event is otherwise fully processed,
  // so email failures are logged, not thrown.
  try {
    const { error: emailError } = await supabaseClient.functions.invoke('send-email', {
      body: {
        to: profile.email,
        template_name: 'trial_ending',
        template_data: {
          recipientName: getProfileName(profile),
          recipientEmail: profile.email,
          subscriptionTier: profile.subscription_tier,
          trialEndDate: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
          manageSubscriptionUrl: `${getFrontendUrl()}/settings?tab=billing`,
          pricingUrl: `${getFrontendUrl()}/pricing`,
          language: prefs.preferred_language
        }
      }
    });
    if (emailError) {
      console.error(`Trial-ending email invoke reported an error for user ${profile.id}:`, emailError);
    }
  } catch (error) {
    console.error(`Failed to send trial-ending email for user ${profile.id}:`, error);
  }

  // Log the trial ending event
  await logOptionalBillingEvent(
    supabaseClient.rpc('log_billing_event', {
      p_user_id: profile.id,
      p_event_type: 'trial_will_end',
      p_event_description: 'Trial ending notification sent',
      p_stripe_subscription_id: subscription.id,
      p_metadata: {
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null
      },
      p_triggered_by: 'stripe_webhook'
    }),
    `Failed to audit trial ending for user ${profile.id}`,
  );

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
    throw new Error(`Profile not found for customer ${customerId}: ${profileError?.message ?? 'no profile'}`);
  }

  // Update payment method info in profile
  if (paymentMethod.card) {
    await requireSuccess(
      supabaseClient
        .from('profiles')
        .update({
          payment_method_brand: paymentMethod.card.brand,
          payment_method_last_four: paymentMethod.card.last4,
          stripe_payment_method_id: paymentMethod.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id),
      `Failed to store attached payment method for user ${profile.id}`,
    );
  }

  // Log the payment method attached event
  await logOptionalBillingEvent(
    supabaseClient.rpc('log_billing_event', {
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
    }),
    `Failed to audit attached payment method for user ${profile.id}`,
  );

  console.log(`Payment method attached processed for customer ${customerId}`);
}

/**
 * Handle payment method detached
 */
async function handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod) {
  // Stripe sends customer = null on payment_method.detached: the method is no
  // longer attached to a customer. Fall back to the id stored on attach or
  // setup_intent.succeeded, which is the only unambiguous profile key.
  const customerId = typeof paymentMethod.customer === 'string'
    ? paymentMethod.customer
    : null;

  console.log(
    `Processing payment method detached for payment method ${paymentMethod.id}` +
    ` (customer ${customerId ?? '<null>'})`,
  );

  const profileQuery = customerId
    ? supabaseClient
      .from('profiles')
      .select('id, payment_method_brand, payment_method_last_four, stripe_payment_method_id')
      .eq('stripe_customer_id', customerId)
      .single()
    : supabaseClient
      .from('profiles')
      .select('id, payment_method_brand, payment_method_last_four, stripe_payment_method_id')
      .eq('stripe_payment_method_id', paymentMethod.id)
      .single();

  const { data: profile, error: profileError } = await profileQuery;

  if (profileError || !profile) {
    // Legacy profiles predate stripe_payment_method_id and the event carries
    // no customer, so there is no safe row to clear. Acknowledge the event
    // instead of retrying it forever.
    console.warn(
      `No profile found for detached payment method ${paymentMethod.id}` +
      ` (customer ${customerId ?? '<null>'}): ${profileError?.message ?? 'no profile'}`,
    );
    return;
  }

  // Clear the stored card only when this is the method on the profile. The
  // last-four fallback covers rows written before stripe_payment_method_id.
  const isActiveMethod = profile.stripe_payment_method_id
    ? profile.stripe_payment_method_id === paymentMethod.id
    : profile.payment_method_last_four === paymentMethod.card?.last4;

  if (isActiveMethod) {
    await requireSuccess(
      supabaseClient
        .from('profiles')
        .update({
          payment_method_brand: null,
          payment_method_last_four: null,
          stripe_payment_method_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id),
      `Failed to clear detached payment method for user ${profile.id}`,
    );
  }

  // Log the payment method detached event
  await logOptionalBillingEvent(
    supabaseClient.rpc('log_billing_event', {
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
    }),
    `Failed to audit detached payment method for user ${profile.id}`,
  );

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
    throw new Error(`Profile not found for customer ${customerId}: ${profileError?.message ?? 'no profile'}`);
  }

  // Get the payment method details
  if (setupIntent.payment_method) {
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(setupIntent.payment_method as string);

      // Update payment method info in profile
      if (paymentMethod.card) {
        await requireSuccess(
          supabaseClient
            .from('profiles')
            .update({
              payment_method_brand: paymentMethod.card.brand,
              payment_method_last_four: paymentMethod.card.last4,
              stripe_payment_method_id: paymentMethod.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', profile.id),
          `Failed to store setup payment method for user ${profile.id}`,
        );
      }
    } catch (error) {
      console.error(`Error retrieving payment method for setup intent ${setupIntent.id}:`, error);
      throw error;
    }
  }

  // Log the setup intent succeeded event
  await logOptionalBillingEvent(
    supabaseClient.rpc('log_billing_event', {
      p_user_id: profile.id,
      p_event_type: 'setup_intent_succeeded',
      p_event_description: 'Payment method setup completed successfully',
      p_metadata: {
        setup_intent_id: setupIntent.id,
        payment_method_id: setupIntent.payment_method
      },
      p_triggered_by: 'stripe_webhook'
    }),
    `Failed to audit setup intent for user ${profile.id}`,
  );

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
  await runWebhookHandler(handler, (success, error) =>
    logWebhookEvent(eventType, eventId, customerId || null, success, error)
  );
}


// Functions now imported from _shared/stripe-config.ts
