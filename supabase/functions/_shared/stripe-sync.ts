/**
 * Shared Stripe subscription -> profiles sync.
 *
 * Administrative callers use the direct sync RPC. Stripe webhook callers MUST
 * use applyFencedStripeSubscriptionEvent so claim ownership, lease validity,
 * event ordering and the profile update are checked in one transaction.
 */

import {
  isSubscriptionTier,
  resolveBillingIntervalFromPriceId,
  resolveStripeStatusForDatabase,
  resolveTierFromPriceId,
  type BillingInterval,
  type SubscriptionTier,
} from './stripe-config.ts';

export interface SubscriptionSyncOverrides {
  tier?: SubscriptionTier;
  status?: string;
  cancelAtPeriodEnd?: boolean;
  billingInterval?: BillingInterval;
}

export interface WebhookClaimContext {
  eventId: string;
  claimToken: string;
  eventCreated: number;
}

export interface FencedSubscriptionOptions {
  /**
   * Permit a profile whose current subscription is canceled or
   * incomplete_expired to bind this subscription (cancel-then-resubscribe).
   */
  allowRebind?: boolean;
  /**
   * Order the apply by this timestamp instead of the event's `created` when
   * re-applying an authoritative snapshot fetched after a same-second
   * ambiguity.
   */
  eventCreatedAt?: string;
}

function getFirstPrice(subscription: any): any | null {
  return subscription?.items?.data?.[0]?.price ?? null;
}

/**
 * Resolve a subscription's tier.
 *
 * A price the secrets do not know yet (a legacy, grandfathered, or newly
 * launched price) must not turn every webhook for that customer into a 500
 * before the payment is recorded. Prefer the caller's fallback (normally the
 * profile's current tier): subscription metadata is written at checkout and
 * can be stale after a plan change, so it may not grant more than the profile
 * already has. Metadata is used only when the caller has no fallback. Direct
 * administrative syncs pass no fallback and still fail closed.
 */
export function getSubscriptionTier(
  subscription: any,
  fallback?: SubscriptionTier,
): SubscriptionTier {
  try {
    return resolveTierFromPriceId(getFirstPrice(subscription)?.id);
  } catch (error) {
    const priceId = getFirstPrice(subscription)?.id ?? '<missing>';
    if (fallback) {
      console.warn(
        `Unrecognized Stripe price ID ${priceId}; preserving existing tier ${fallback}`,
      );
      return fallback;
    }
    const metadataTier = subscription?.metadata?.tier;
    if (isSubscriptionTier(metadataTier)) {
      console.warn(
        `Unrecognized Stripe price ID ${priceId}; ` +
        `using subscription metadata tier ${metadataTier}`,
      );
      return metadataTier;
    }
    throw error;
  }
}

export function getSubscriptionBillingInterval(subscription: any): BillingInterval {
  const price = getFirstPrice(subscription);
  const recurringInterval = price?.recurring?.interval;

  if (recurringInterval === 'year') return 'annual';
  if (recurringInterval === 'month') return 'monthly';

  return resolveBillingIntervalFromPriceId(price?.id);
}

function toIso(value: number | null | undefined): string | null {
  return typeof value === 'number' ? new Date(value * 1000).toISOString() : null;
}

function toEventTimestamp(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid Stripe event timestamp: ${String(value)}`);
  }
  return new Date(value * 1000).toISOString();
}

function buildSyncParams(
  subscription: any,
  overrides: SubscriptionSyncOverrides,
): { customerId: string; params: Record<string, unknown> } {
  const customerId = typeof subscription?.customer === 'string'
    ? subscription.customer
    : subscription?.customer?.id;

  if (!customerId) {
    throw new Error(`Subscription ${subscription?.id ?? '<unknown>'} has no customer`);
  }
  if (!subscription?.id) {
    throw new Error(`Subscription for customer ${customerId} has no id`);
  }

  const tier = overrides.tier ?? getSubscriptionTier(subscription);
  const status = overrides.status ?? resolveStripeStatusForDatabase(subscription.status);
  const billingInterval = overrides.billingInterval ?? getSubscriptionBillingInterval(subscription);
  const cancelAtPeriodEnd = overrides.cancelAtPeriodEnd ?? Boolean(subscription.cancel_at_period_end);

  return {
    customerId,
    params: {
      _stripe_customer_id: customerId,
      _stripe_subscription_id: subscription.id,
      _tier: tier,
      _status: status,
      _current_period_start: toIso(subscription.current_period_start),
      _current_period_end: toIso(subscription.current_period_end),
      _trial_end: toIso(subscription.trial_end),
      _cancel_at_period_end: cancelAtPeriodEnd,
      _billing_interval: billingInterval,
    },
  };
}

/**
 * Sync a subscription after a user-initiated administrative action.
 * This path is NOT webhook-claim-fenced; Stripe webhooks must use
 * applyFencedStripeSubscriptionEvent.
 */
export async function syncSubscriptionToProfile(
  supabaseAdmin: any,
  subscription: any,
  overrides: SubscriptionSyncOverrides = {},
): Promise<number> {
  const { params } = buildSyncParams(subscription, overrides);
  const { data, error } = await supabaseAdmin.rpc('sync_subscription_from_stripe', params);

  if (error) {
    throw new Error(`Failed to sync subscription ${subscription.id}: ${error.message}`);
  }

  if (typeof data === 'number' && data === 0) {
    console.warn(`No profile matched Stripe customer ${params._stripe_customer_id}`);
  }

  return typeof data === 'number' ? data : 0;
}

/**
 * Apply a webhook subscription change only while the claim is live and the
 * event is not older than the last event accepted for that subscription.
 */
export async function applyFencedStripeSubscriptionEvent(
  supabaseAdmin: any,
  subscription: any,
  claim: WebhookClaimContext,
  overrides: SubscriptionSyncOverrides = {},
  options: FencedSubscriptionOptions = {},
): Promise<number> {
  if (!claim.eventId || !claim.claimToken) {
    throw new Error('Webhook subscription sync requires an active claim');
  }

  const { params } = buildSyncParams(subscription, overrides);
  const { data, error } = await supabaseAdmin.rpc('apply_fenced_stripe_subscription_event', {
    _event_id: claim.eventId,
    _claim_token: claim.claimToken,
    _event_created: options.eventCreatedAt ?? toEventTimestamp(claim.eventCreated),
    _allow_rebind: options.allowRebind ?? false,
    ...params,
  });

  if (error) {
    throw new Error(
      `Fenced subscription sync failed for event ${claim.eventId}: ${error.message}`,
    );
  }

  return typeof data === 'number' ? data : 0;
}

/**
 * Payment-state webhook writes. Each RPC verifies the claim and the payment
 * event order in the same transaction as the write, so an expired worker cannot
 * record a payment or change billing status after a newer delivery claimed the
 * event. Email and audit effects stay outside these fences and are best-effort.
 */
export interface FencedPaymentEvent {
  customerId: string;
  subscriptionId: string | null;
  paymentIntentId: string;
  /** Invoice amount in the currency's minor unit (Stripe `amount_paid`). */
  amountPaid: number;
  currency: string;
  tier: SubscriptionTier;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
}

function requireActiveClaim(claim: WebhookClaimContext, operation: string): void {
  if (!claim.eventId || !claim.claimToken) {
    throw new Error(`${operation} requires an active claim`);
  }
}

/**
 * Record a successful payment, and clear grace/retry state and advance the
 * payment event order when the event is in order, in one fenced transaction.
 * Returns 'applied' when the state advance ran and 'recorded' when the payment
 * row is recorded but the advance was skipped: a one-off, superseded, or
 * out-of-order payment never changes entitlement state, and a completed fact
 * must not be retried as a failure.
 */
export async function applyFencedStripePaymentEvent(
  supabaseAdmin: any,
  event: FencedPaymentEvent,
  claim: WebhookClaimContext,
): Promise<'applied' | 'recorded' | 'unbound'> {
  requireActiveClaim(claim, 'Webhook payment sync');

  const { data, error } = await supabaseAdmin.rpc('apply_fenced_stripe_payment_event', {
    _event_id: claim.eventId,
    _claim_token: claim.claimToken,
    _event_created: toEventTimestamp(claim.eventCreated),
    _stripe_customer_id: event.customerId,
    _stripe_subscription_id: event.subscriptionId,
    _payment_intent_id: event.paymentIntentId,
    _amount: Math.trunc(event.amountPaid),
    _currency: event.currency,
    _tier: event.tier,
    _billing_period_start: event.billingPeriodStart,
    _billing_period_end: event.billingPeriodEnd,
  });

  if (error) {
    throw new Error(
      `Fenced payment sync failed for event ${claim.eventId}: ${error.message}`,
    );
  }

  if (data === 'applied' || data === 'recorded' || data === 'unbound') {
    return data;
  }

  throw new Error(
    `Fenced payment sync returned an unexpected result for event ${claim.eventId}`,
  );
}

/** Start the payment-failure grace period only while the claim is live. */
export async function applyFencedRenewalFailure(
  supabaseAdmin: any,
  failure: {
    userId: string;
    subscriptionId: string;
    failureReason: string;
    invoiceId: string;
  },
  claim: WebhookClaimContext,
): Promise<void> {
  requireActiveClaim(claim, 'Webhook renewal failure');

  const { error } = await supabaseAdmin.rpc('apply_fenced_renewal_failure', {
    _event_id: claim.eventId,
    _claim_token: claim.claimToken,
    _event_created: toEventTimestamp(claim.eventCreated),
    _user_id: failure.userId,
    _stripe_subscription_id: failure.subscriptionId,
    _failure_reason: failure.failureReason,
    _stripe_invoice_id: failure.invoiceId,
  });

  if (error) {
    throw new Error(
      `Fenced renewal failure failed for event ${claim.eventId}: ${error.message}`,
    );
  }
}

/**
 * Change profile billing status only while the claim is live. Returns 0 when
 * the event belonged to a superseded subscription and the status was left
 * untouched.
 */
export async function applyFencedProfileStatus(
  supabaseAdmin: any,
  status: {
    customerId: string;
    subscriptionId: string | null;
    status: string;
  },
  claim: WebhookClaimContext,
): Promise<number> {
  requireActiveClaim(claim, 'Webhook profile status sync');

  const { data, error } = await supabaseAdmin.rpc('apply_fenced_profile_status', {
    _event_id: claim.eventId,
    _claim_token: claim.claimToken,
    _event_created: toEventTimestamp(claim.eventCreated),
    _stripe_customer_id: status.customerId,
    _stripe_subscription_id: status.subscriptionId,
    _status: status.status,
  });

  if (error) {
    throw new Error(
      `Fenced profile status sync failed for event ${claim.eventId}: ${error.message}`,
    );
  }

  return typeof data === 'number' ? data : 0;
}

/**
 * Update renewal tracking and the profile's next billing date
 * (update_subscription_renewal_tracking) only while the claim is live. The
 * payment handler calls this right after the payment RPC with the same claim:
 * the payment RPC already order-checked the event and renewed the claim lease,
 * and repeating the order check here keeps the wrapper safe when called on its
 * own.
 */
export async function applyFencedRenewalTracking(
  supabaseAdmin: any,
  tracking: {
    userId: string;
    subscriptionId: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    currentTier: SubscriptionTier;
    currentPriceId: string;
    status: string;
  },
  claim: WebhookClaimContext,
): Promise<void> {
  requireActiveClaim(claim, 'Webhook renewal tracking');

  const { error } = await supabaseAdmin.rpc('apply_fenced_renewal_tracking', {
    _event_id: claim.eventId,
    _claim_token: claim.claimToken,
    _event_created: toEventTimestamp(claim.eventCreated),
    _user_id: tracking.userId,
    _stripe_subscription_id: tracking.subscriptionId,
    _current_period_start: tracking.currentPeriodStart,
    _current_period_end: tracking.currentPeriodEnd,
    _current_tier: tracking.currentTier,
    _current_price_id: tracking.currentPriceId,
    _status: tracking.status,
  });

  if (error) {
    throw new Error(
      `Fenced renewal tracking failed for event ${claim.eventId}: ${error.message}`,
    );
  }
}
