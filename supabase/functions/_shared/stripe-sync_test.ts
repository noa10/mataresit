import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.env.set('STRIPE_SECRET_KEY', 'sk_live_unit_test');
Deno.env.set('STRIPE_PRO_MONTHLY_PRICE_ID', 'price_live_pro_monthly');
Deno.env.set('STRIPE_PRO_ANNUAL_PRICE_ID', 'price_live_pro_annual');
Deno.env.set('STRIPE_MAX_MONTHLY_PRICE_ID', 'price_live_max_monthly');
Deno.env.set('STRIPE_MAX_ANNUAL_PRICE_ID', 'price_live_max_annual');

const {
  applyFencedStripeSubscriptionEvent,
  getSubscriptionBillingInterval,
  getSubscriptionTier,
  syncSubscriptionToProfile,
} = await import('./stripe-sync.ts');

function makeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_test_123',
    customer: 'cus_test_123',
    status: 'active',
    current_period_start: 1000,
    current_period_end: 2000,
    trial_end: null,
    cancel_at_period_end: false,
    items: {
      data: [
        {
          price: {
            id: 'price_live_pro_monthly',
            recurring: { interval: 'month' },
          },
        },
      ],
    },
    ...overrides,
  };
}

const claim = {
  eventId: 'evt_test_123',
  claimToken: 'tok_test_123',
  eventCreated: 1_700_000_000,
};

type Call = { name: string; params: Record<string, unknown> };

function makeAdmin(
  result: { data: unknown; error: { message: string } | null } = {
    data: 1,
    error: null,
  },
) {
  const calls: Call[] = [];
  return {
    calls,
    rpc: (name: string, params: Record<string, unknown>) => {
      calls.push({ name, params });
      return Promise.resolve(result);
    },
  };
}

Deno.test('maps a subscription to tier and billing interval', () => {
  const subscription = makeSubscription();

  assertEquals(getSubscriptionTier(subscription), 'pro');
  assertEquals(getSubscriptionBillingInterval(subscription), 'monthly');
});

Deno.test('administrative sync writes through the direct service RPC', async () => {
  const admin = makeAdmin();

  const updated = await syncSubscriptionToProfile(admin, makeSubscription());

  assertEquals(updated, 1);
  assertEquals(admin.calls.length, 1);
  assertEquals(admin.calls[0].name, 'sync_subscription_from_stripe');
  assertEquals(admin.calls[0].params._stripe_customer_id, 'cus_test_123');
  assertEquals(admin.calls[0].params._stripe_subscription_id, 'sub_test_123');
  assertEquals(admin.calls[0].params._tier, 'pro');
  assertEquals(admin.calls[0].params._status, 'active');
  assertEquals(admin.calls[0].params._billing_interval, 'monthly');
  assertEquals(admin.calls[0].params._cancel_at_period_end, false);
  assertEquals(admin.calls[0].params._current_period_end, new Date(2000 * 1000).toISOString());
});

Deno.test('deleted subscriptions can be forced to free without a price lookup', async () => {
  const admin = makeAdmin();
  const subscription = makeSubscription({
    items: { data: [] },
    status: 'canceled',
  });

  await syncSubscriptionToProfile(admin, subscription, {
    tier: 'free',
    status: 'canceled',
    cancelAtPeriodEnd: false,
    billingInterval: 'monthly',
  });

  assertEquals(admin.calls[0].params._tier, 'free');
  assertEquals(admin.calls[0].params._status, 'canceled');
  assertEquals(admin.calls[0].params._billing_interval, 'monthly');
});

Deno.test('webhook sync uses the fenced RPC with claim and event order', async () => {
  const admin = makeAdmin();

  const updated = await applyFencedStripeSubscriptionEvent(
    admin,
    makeSubscription(),
    claim,
  );

  assertEquals(updated, 1);
  assertEquals(admin.calls.length, 1);
  assertEquals(admin.calls[0].name, 'apply_fenced_stripe_subscription_event');
  assertEquals(admin.calls[0].params._event_id, claim.eventId);
  assertEquals(admin.calls[0].params._claim_token, claim.claimToken);
  assertEquals(
    admin.calls[0].params._event_created,
    new Date(claim.eventCreated * 1000).toISOString(),
  );
  assertEquals(admin.calls[0].params._stripe_subscription_id, 'sub_test_123');
});

Deno.test('webhook sync requires a live claim identity', async () => {
  const admin = makeAdmin();

  await assertRejects(
    () => applyFencedStripeSubscriptionEvent(admin, makeSubscription(), {
      ...claim,
      claimToken: '',
    }),
    Error,
    'requires an active claim',
  );
  assertEquals(admin.calls.length, 0);
});

Deno.test('webhook sync rejects an invalid Stripe event timestamp', async () => {
  const admin = makeAdmin();

  await assertRejects(
    () => applyFencedStripeSubscriptionEvent(admin, makeSubscription(), {
      ...claim,
      eventCreated: 0,
    }),
    Error,
    'Invalid Stripe event timestamp',
  );
  assertEquals(admin.calls.length, 0);
});

Deno.test('webhook sync surfaces a stale-claim RPC error', async () => {
  const admin = makeAdmin({
    data: null,
    error: { message: 'claim is stale or superseded' },
  });

  await assertRejects(
    () => applyFencedStripeSubscriptionEvent(admin, makeSubscription(), claim),
    Error,
    'claim is stale or superseded',
  );
});
