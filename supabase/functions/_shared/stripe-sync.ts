/**
 * Shared Stripe subscription -> profiles sync.
 *
 * Administrative callers use the direct sync RPC. Stripe webhook callers MUST
 * use applyFencedStripeSubscriptionEvent so claim ownership, lease validity,
 * event ordering and the profile update are checked in one transaction.
 */

import {
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

function getFirstPrice(subscription: any): any | null {
  return subscription?.items?.data?.[0]?.price ?? null;
}

export function getSubscriptionTier(subscription: any): SubscriptionTier {
  return resolveTierFromPriceId(getFirstPrice(subscription)?.id);
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
): Promise<number> {
  if (!claim.eventId || !claim.claimToken) {
    throw new Error('Webhook subscription sync requires an active claim');
  }

  const { params } = buildSyncParams(subscription, overrides);
  const { data, error } = await supabaseAdmin.rpc('apply_fenced_stripe_subscription_event', {
    _event_id: claim.eventId,
    _claim_token: claim.claimToken,
    _event_created: toEventTimestamp(claim.eventCreated),
    ...params,
  });

  if (error) {
    throw new Error(
      `Fenced subscription sync failed for event ${claim.eventId}: ${error.message}`,
    );
  }

  return typeof data === 'number' ? data : 0;
}
