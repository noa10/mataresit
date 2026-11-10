import {
  assertEquals,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.env.set('STRIPE_SECRET_KEY', 'sk_live_unit_test');
Deno.env.set('STRIPE_PRO_MONTHLY_PRICE_ID', 'price_live_pro_monthly');
Deno.env.set('STRIPE_PRO_ANNUAL_PRICE_ID', 'price_live_pro_annual');
Deno.env.set('STRIPE_MAX_MONTHLY_PRICE_ID', 'price_live_max_monthly');
Deno.env.set('STRIPE_MAX_ANNUAL_PRICE_ID', 'price_live_max_annual');

const {
  applyFencedProfileStatus,
  applyFencedRenewalFailure,
  applyFencedRenewalTracking,
  applyFencedStripePaymentEvent,
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

Deno.test('an unknown price uses the tier recorded on the subscription', () => {
  const subscription = makeSubscription({
    items: {
      data: [{ price: { id: 'price_unknown', recurring: { interval: 'month' } } }],
    },
    metadata: { tier: 'max' },
  });

  assertEquals(getSubscriptionTier(subscription), 'max');
});

Deno.test('an unknown price preserves an explicit fallback tier', () => {
  const subscription = makeSubscription({
    items: {
      data: [{ price: { id: 'price_unknown', recurring: { interval: 'month' } } }],
    },
  });

  assertEquals(getSubscriptionTier(subscription, 'pro'), 'pro');
});

Deno.test('an unknown price without a fallback still fails closed', () => {
  const subscription = makeSubscription({
    items: {
      data: [{ price: { id: 'price_unknown', recurring: { interval: 'month' } } }],
    },
  });

  assertThrows(
    () => getSubscriptionTier(subscription),
    Error,
    'Unrecognized Stripe price ID',
  );
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

const paymentEvent = {
  customerId: 'cus_test_123',
  subscriptionId: 'sub_test_123',
  paymentIntentId: 'pi_test_123',
  amountPaid: 4900,
  currency: 'myr',
  tier: 'pro' as const,
  billingPeriodStart: '2026-11-01T00:00:00.000Z',
  billingPeriodEnd: '2026-12-01T00:00:00.000Z',
};

Deno.test('payment sync maps the invoice onto the fenced payment RPC', async () => {
  const admin = makeAdmin({ data: 'applied', error: null });

  const outcome = await applyFencedStripePaymentEvent(admin, paymentEvent, claim);

  assertEquals(outcome, 'applied');
  assertEquals(admin.calls.length, 1);
  assertEquals(admin.calls[0].name, 'apply_fenced_stripe_payment_event');
  assertEquals(admin.calls[0].params._event_id, claim.eventId);
  assertEquals(admin.calls[0].params._claim_token, claim.claimToken);
  assertEquals(admin.calls[0].params._stripe_customer_id, 'cus_test_123');
  assertEquals(admin.calls[0].params._stripe_subscription_id, 'sub_test_123');
  assertEquals(admin.calls[0].params._payment_intent_id, 'pi_test_123');
  assertEquals(admin.calls[0].params._amount, 4900);
  assertEquals(admin.calls[0].params._currency, 'myr');
  assertEquals(admin.calls[0].params._tier, 'pro');
  assertEquals(admin.calls[0].params._billing_period_start, paymentEvent.billingPeriodStart);
  assertEquals(admin.calls[0].params._billing_period_end, paymentEvent.billingPeriodEnd);
});

Deno.test('an out-of-order, one-off, or superseded payment is recorded without applying state', async () => {
  const admin = makeAdmin({ data: 'recorded', error: null });

  const outcome = await applyFencedStripePaymentEvent(admin, paymentEvent, claim);

  assertEquals(outcome, 'recorded');
});

Deno.test('renewal tracking uses the fenced RPC with claim and period', async () => {
  const admin = makeAdmin({ data: null, error: null });

  await applyFencedRenewalTracking(
    admin,
    {
      userId: 'user_123',
      subscriptionId: 'sub_test_123',
      currentPeriodStart: '2026-11-01T00:00:00.000Z',
      currentPeriodEnd: '2026-12-01T00:00:00.000Z',
      currentTier: 'pro',
      currentPriceId: 'price_live_pro_monthly',
      status: 'active',
    },
    claim,
  );

  assertEquals(admin.calls.length, 1);
  assertEquals(admin.calls[0].name, 'apply_fenced_renewal_tracking');
  assertEquals(admin.calls[0].params._event_id, claim.eventId);
  assertEquals(admin.calls[0].params._claim_token, claim.claimToken);
  assertEquals(admin.calls[0].params._user_id, 'user_123');
  assertEquals(admin.calls[0].params._stripe_subscription_id, 'sub_test_123');
  assertEquals(admin.calls[0].params._current_tier, 'pro');
  assertEquals(admin.calls[0].params._current_price_id, 'price_live_pro_monthly');
  assertEquals(admin.calls[0].params._status, 'active');
});

Deno.test('renewal tracking requires a live claim', async () => {
  const admin = makeAdmin({ data: null, error: null });

  await assertRejects(
    () => applyFencedRenewalTracking(
      admin,
      {
        userId: 'user_123',
        subscriptionId: 'sub_test_123',
        currentPeriodStart: '2026-11-01T00:00:00.000Z',
        currentPeriodEnd: '2026-12-01T00:00:00.000Z',
        currentTier: 'pro',
        currentPriceId: 'price_live_pro_monthly',
        status: 'active',
      },
      { ...claim, claimToken: '' },
    ),
    Error,
    'requires an active claim',
  );
  assertEquals(admin.calls.length, 0);
});

Deno.test('payment sync requires a live claim', async () => {
  const admin = makeAdmin();

  await assertRejects(
    () => applyFencedStripePaymentEvent(admin, paymentEvent, { ...claim, eventId: '' }),
    Error,
    'requires an active claim',
  );
  assertEquals(admin.calls.length, 0);
});

Deno.test('payment sync surfaces a stale-claim RPC error', async () => {
  const admin = makeAdmin({
    data: null,
    error: { message: 'Stripe webhook claim evt_test_123 is stale or superseded' },
  });

  await assertRejects(
    () => applyFencedStripePaymentEvent(admin, paymentEvent, claim),
    Error,
    'stale or superseded',
  );
});

Deno.test('renewal failure uses the fenced RPC with claim and invoice', async () => {
  const admin = makeAdmin();

  await applyFencedRenewalFailure(
    admin,
    {
      userId: 'user_123',
      subscriptionId: 'sub_test_123',
      failureReason: 'card declined',
      invoiceId: 'in_test_123',
    },
    claim,
  );

  assertEquals(admin.calls.length, 1);
  assertEquals(admin.calls[0].name, 'apply_fenced_renewal_failure');
  assertEquals(admin.calls[0].params._event_id, claim.eventId);
  assertEquals(admin.calls[0].params._claim_token, claim.claimToken);
  assertEquals(
    admin.calls[0].params._event_created,
    new Date(claim.eventCreated * 1000).toISOString(),
  );
  assertEquals(admin.calls[0].params._user_id, 'user_123');
  assertEquals(admin.calls[0].params._stripe_subscription_id, 'sub_test_123');
  assertEquals(admin.calls[0].params._failure_reason, 'card declined');
  assertEquals(admin.calls[0].params._stripe_invoice_id, 'in_test_123');
});

Deno.test('renewal failure requires a live claim', async () => {
  const admin = makeAdmin();

  await assertRejects(
    () => applyFencedRenewalFailure(admin, {
      userId: 'user_123',
      subscriptionId: 'sub_test_123',
      failureReason: 'card declined',
      invoiceId: 'in_test_123',
    }, { ...claim, claimToken: '' }),
    Error,
    'requires an active claim',
  );
  assertEquals(admin.calls.length, 0);
});

Deno.test('profile status uses the fenced RPC and reports skipped writes', async () => {
  const admin = makeAdmin({ data: 0, error: null });

  const updated = await applyFencedProfileStatus(
    admin,
    { customerId: 'cus_test_123', subscriptionId: 'sub_test_123', status: 'incomplete' },
    claim,
  );

  assertEquals(updated, 0);
  assertEquals(admin.calls[0].name, 'apply_fenced_profile_status');
  assertEquals(admin.calls[0].params._stripe_customer_id, 'cus_test_123');
  assertEquals(admin.calls[0].params._stripe_subscription_id, 'sub_test_123');
  assertEquals(admin.calls[0].params._status, 'incomplete');
  assertEquals(
    admin.calls[0].params._event_created,
    new Date(claim.eventCreated * 1000).toISOString(),
  );
});

Deno.test('profile status requires a live claim and surfaces RPC errors', async () => {
  const rejected = makeAdmin();
  await assertRejects(
    () => applyFencedProfileStatus(rejected, {
      customerId: 'cus_test_123',
      subscriptionId: null,
      status: 'past_due',
    }, { ...claim, eventId: '' }),
    Error,
    'requires an active claim',
  );
  assertEquals(rejected.calls.length, 0);

  const failing = makeAdmin({ data: null, error: { message: 'claim is stale' } });
  await assertRejects(
    () => applyFencedProfileStatus(failing, {
      customerId: 'cus_test_123',
      subscriptionId: null,
      status: 'past_due',
    }, claim),
    Error,
    'claim is stale',
  );
});
