/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

// Load the actual edge handlers with their network boundaries replaced by fakes.
const source = readFileSync('supabase/functions/manage-subscription/index.ts', 'utf8');
const javascript = ts.transpileModule(`${source}\nexport { cancelSubscription, resumeSubscription, changePlan };`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleExports: Record<string, any> = {};
const mocks: Record<string, any> = {
  'https://deno.land/std@0.168.0/http/server.ts': { serve: () => {} },
  'https://esm.sh/@supabase/supabase-js@2.7.1': {},
  'https://esm.sh/stripe@14.21.0': {},
  '../_shared/stripe-config.ts': { getRequiredTierPriceId: (tier: string, interval: string) => `${tier}-${interval}` },
  '../_shared/stripe-sync.ts': {
    getSubscriptionTier: (subscription: any) => subscription.tier,
    getSubscriptionBillingInterval: (subscription: any) => subscription.interval,
    syncSubscriptionToProfile: async () => 1,
  },
  '../_shared/site-url.ts': {},
  '../_shared/service-role.ts': {},
};
runInNewContext(javascript, {
  exports: moduleExports,
  require: (name: string) => {
    if (!(name in mocks)) throw new Error(`Unexpected import ${name}`);
    return mocks[name];
  },
  crypto: webcrypto,
  Response,
  Date,
  console,
});

function setup() {
  const subscription: any = {
    id: 'sub_123', customer: 'cus_123', current_period_end: 2000000000,
    cancel_at_period_end: false, tier: 'max', interval: 'monthly',
    items: { data: [{ id: 'si_123' }] },
  };
  const cached = new Map<string, any>();
  const update = vi.fn(async (_id: string, params: any, options: any) => {
    if (cached.has(options.idempotencyKey)) return cached.get(options.idempotencyKey);
    if ('cancel_at_period_end' in params) subscription.cancel_at_period_end = params.cancel_at_period_end;
    if (params.items) {
      [subscription.tier, subscription.interval] = params.items[0].price.split('-');
    }
    const result = { ...subscription };
    cached.set(options.idempotencyKey, result);
    return result;
  });
  const schedule = { id: 'sched_123', phases: [{ start_date: 1, end_date: 2000000000, items: [{ price: 'max-monthly' }] }] };
  const scheduleUpdate = vi.fn(async (_id: string, params: any, options: any) => {
    if (cached.has(options.idempotencyKey)) return cached.get(options.idempotencyKey);
    const result = { ...schedule, target: params.phases[1].items[0].price };
    cached.set(options.idempotencyKey, result);
    return result;
  });
  const stripe = {
    subscriptions: { retrieve: vi.fn(async () => ({ ...subscription })), update },
    subscriptionSchedules: {
      create: vi.fn(async () => { subscription.schedule = schedule.id; return schedule; }),
      retrieve: vi.fn(async () => schedule),
      update: scheduleUpdate,
      release: vi.fn(async () => { subscription.schedule = null; }),
    },
  };
  return { stripe, subscription, update, scheduleUpdate, profile: { stripe_subscription_id: subscription.id } };
}

describe('manage-subscription action sequencing', () => {
  it('applies cancel, resume, and cancel again in the same period', async () => {
    const { stripe, subscription, update, profile } = setup();
    await moduleExports.cancelSubscription(stripe, {}, profile, false);
    await moduleExports.resumeSubscription(stripe, {}, profile);
    await moduleExports.cancelSubscription(stripe, {}, profile, false);
    expect(subscription.cancel_at_period_end).toBe(true);
    expect(new Set(update.mock.calls.map((call) => call[2].idempotencyKey)).size).toBe(3);
  });

  it('applies repeated immediate changes to the same target', async () => {
    const { stripe, subscription, update, profile } = setup();
    await moduleExports.changePlan(stripe, {}, profile, { targetTier: 'pro', immediate: true });
    await moduleExports.changePlan(stripe, {}, profile, { targetTier: 'max', immediate: true });
    await moduleExports.changePlan(stripe, {}, profile, { targetTier: 'pro', immediate: true });
    expect(subscription.tier).toBe('pro');
    expect(new Set(update.mock.calls.map((call) => call[2].idempotencyKey)).size).toBe(3);
  });

  it('updates a scheduled change back to a previously selected interval', async () => {
    const { stripe, scheduleUpdate, profile } = setup();
    for (const billingInterval of ['annual', 'monthly', 'annual']) {
      await moduleExports.changePlan(stripe, {}, profile, { targetTier: 'pro', billingInterval });
    }
    expect(scheduleUpdate).toHaveBeenCalledTimes(3);
    expect(new Set(scheduleUpdate.mock.calls.map((call) => call[2].idempotencyKey)).size).toBe(3);
    expect((await scheduleUpdate.mock.results[2].value).target).toBe('pro-annual');
  });

  it.each([
    { tier: 'pro', interval: 'monthly', targetTier: 'max', billingInterval: 'monthly' },
    { tier: 'max', interval: 'monthly', targetTier: 'max', billingInterval: 'annual' },
  ])('preserves pending cancellation for an immediate plan change', async ({ tier, interval, targetTier, billingInterval }) => {
    const { stripe, subscription, update, profile } = setup();
    subscription.tier = tier;
    subscription.interval = interval;
    subscription.cancel_at_period_end = true;
    const response = await moduleExports.changePlan(stripe, {}, profile, { targetTier, billingInterval });
    expect(response.status).toBe(409);
    expect(subscription.cancel_at_period_end).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it('preserves pending cancellation without attempting a schedule', async () => {
    const { stripe, subscription, update, profile } = setup();
    subscription.cancel_at_period_end = true;
    stripe.subscriptionSchedules.create.mockRejectedValue(new Error('schedule failed'));
    const response = await moduleExports.changePlan(stripe, {}, profile, { targetTier: 'pro' });
    expect(response.status).toBe(409);
    expect(subscription.cancel_at_period_end).toBe(true);
    expect(update).not.toHaveBeenCalled();
    expect(stripe.subscriptionSchedules.create).not.toHaveBeenCalled();
  });
});
