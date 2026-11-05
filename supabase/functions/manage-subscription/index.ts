import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@14.21.0";
import {
  getRequiredTierPriceId,
  type BillingInterval,
  type SubscriptionTier,
} from '../_shared/stripe-config.ts';
import {
  getSubscriptionBillingInterval,
  getSubscriptionTier,
  syncSubscriptionToProfile,
} from '../_shared/stripe-sync.ts';
import { getFrontendUrl } from '../_shared/site-url.ts';
import { getServiceRoleKey } from '../_shared/service-role.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const TIER_HIERARCHY: Record<SubscriptionTier, number> = { free: 0, pro: 1, max: 2 };

const isSimulatedId = (value: string | null | undefined): boolean =>
  Boolean(
    value?.startsWith('cus_simulated_') ||
    value?.startsWith('sub_simulated_') ||
    value?.startsWith('test_sub_'),
  );

function getScheduleId(subscription: Stripe.Subscription): string | null {
  if (!subscription.schedule) return null;
  return typeof subscription.schedule === 'string'
    ? subscription.schedule
    : subscription.schedule.id;
}

async function releaseScheduleIfPresent(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<void> {
  const scheduleId = getScheduleId(subscription);
  if (!scheduleId) return;

  try {
    await stripe.subscriptionSchedules.release(scheduleId);
  } catch (error) {
    // A released schedule is already gone; anything else should fail loudly.
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes('released')) {
      throw error;
    }
  }
}

async function schedulePlanChange(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  targetPriceId: string,
): Promise<Stripe.SubscriptionSchedule> {
  const existingScheduleId = getScheduleId(subscription);
  const schedule = existingScheduleId
    ? await stripe.subscriptionSchedules.retrieve(existingScheduleId)
    : await stripe.subscriptionSchedules.create({ from_subscription: subscription.id });

  const nowSeconds = Math.floor(Date.now() / 1000);
  const currentPhase = schedule.phases.find((phase: Stripe.SubscriptionSchedule.Phase) =>
    phase.start_date <= nowSeconds && (!phase.end_date || phase.end_date > nowSeconds)
  ) ?? schedule.phases[schedule.phases.length - 1];

  if (!currentPhase) {
    throw new Error('Stripe subscription schedule has no current phase');
  }

  const currentItems: Array<{ price: string; quantity: number }> = currentPhase.items.map((item: any) => ({
    price: typeof item.price === 'string' ? item.price : item.price.id,
    quantity: item.quantity ?? 1,
  }));

  if (currentItems.length === 0) {
    throw new Error('Stripe subscription has no items');
  }

  const targetItems = currentItems.map((item, index) =>
    index === 0 ? { ...item, price: targetPriceId } : item
  );

  return await stripe.subscriptionSchedules.update(
    schedule.id,
    {
      end_behavior: 'release',
      phases: [
        {
          items: currentItems,
          start_date: currentPhase.start_date,
          end_date: subscription.current_period_end,
          proration_behavior: 'none',
        },
        {
          items: targetItems,
          start_date: subscription.current_period_end,
          proration_behavior: 'none',
        },
      ],
    },
    {
      idempotencyKey: `schedule:${crypto.randomUUID()}`,
    },
  );
}

async function getSubscriptionOrNull(
  stripe: Stripe,
  subscriptionId: string | null | undefined,
): Promise<Stripe.Subscription | null> {
  if (!subscriptionId || isSimulatedId(subscriptionId)) return null;

  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === 'resource_missing') {
      return null;
    }
    throw error;
  }
}

async function getSubscriptionStatus(
  stripe: Stripe,
  profile: any,
): Promise<Response> {
  const subscription = await getSubscriptionOrNull(stripe, profile.stripe_subscription_id);

  if (!subscription) {
    return jsonResponse({
      status: profile.subscription_status ?? 'inactive',
      tier: profile.subscription_tier ?? 'free',
      cancelAtPeriodEnd: Boolean(profile.cancel_at_period_end),
      // NULL means this profile has not been reconciled from Stripe yet; the
      // client must not present it as a verified monthly plan.
      billingInterval: profile.billing_interval,
      billingIntervalReconciled: profile.billing_interval !== null,
    });
  }

  return jsonResponse({
    status: subscription.status,
    tier: getSubscriptionTier(subscription),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    billingInterval: getSubscriptionBillingInterval(subscription),
  });
}

async function cancelSubscription(
  stripe: Stripe,
  supabaseAdmin: any,
  profile: any,
  immediate: boolean,
): Promise<Response> {
  const subscription = await getSubscriptionOrNull(stripe, profile.stripe_subscription_id);

  if (!subscription) {
    return jsonResponse({ error: 'No active subscription found' }, 404);
  }

  await releaseScheduleIfPresent(stripe, subscription);

  if (immediate) {
    const canceled = await stripe.subscriptions.cancel(subscription.id, {
      prorate: true,
    });

    await syncSubscriptionToProfile(supabaseAdmin, canceled, {
      tier: 'free',
      status: 'canceled',
      cancelAtPeriodEnd: false,
      billingInterval: 'monthly',
    });

    return jsonResponse({
      success: true,
      message: 'Subscription canceled immediately',
      newTier: 'free',
      effectiveDate: new Date().toISOString(),
    });
  }

  const updated = await stripe.subscriptions.update(
    subscription.id,
    { cancel_at_period_end: true },
    { idempotencyKey: `cancel:${crypto.randomUUID()}` },
  );

  await syncSubscriptionToProfile(supabaseAdmin, updated, { cancelAtPeriodEnd: true });

  return jsonResponse({
    success: true,
    message: 'Subscription will be canceled at the end of the current billing period',
    newTier: 'free',
    effectiveDate: new Date(updated.current_period_end * 1000).toISOString(),
    cancelAtPeriodEnd: true,
  });
}

async function resumeSubscription(
  stripe: Stripe,
  supabaseAdmin: any,
  profile: any,
): Promise<Response> {
  const subscription = await getSubscriptionOrNull(stripe, profile.stripe_subscription_id);

  if (!subscription) {
    return jsonResponse({ error: 'No active subscription found' }, 404);
  }

  if (!subscription.cancel_at_period_end) {
    return jsonResponse({
      success: true,
      message: 'Subscription is already active',
      cancelAtPeriodEnd: false,
    });
  }

  const updated = await stripe.subscriptions.update(
    subscription.id,
    { cancel_at_period_end: false },
    { idempotencyKey: `resume:${crypto.randomUUID()}` },
  );

  await syncSubscriptionToProfile(supabaseAdmin, updated, { cancelAtPeriodEnd: false });

  return jsonResponse({
    success: true,
    message: 'Subscription resumed',
    cancelAtPeriodEnd: false,
    currentPeriodEnd: new Date(updated.current_period_end * 1000).toISOString(),
  });
}

async function changePlan(
  stripe: Stripe,
  supabaseAdmin: any,
  profile: any,
  body: {
    targetTier: SubscriptionTier;
    billingInterval?: BillingInterval;
    immediate?: boolean;
  },
): Promise<Response> {
  const { targetTier, billingInterval, immediate } = body;

  if (!['free', 'pro', 'max'].includes(targetTier)) {
    return jsonResponse({ error: 'Invalid target tier' }, 400);
  }

  const subscription = await getSubscriptionOrNull(stripe, profile.stripe_subscription_id);

  if (!subscription) {
    return jsonResponse({ error: 'No active subscription found' }, 404);
  }

  if (targetTier === 'free') {
    return await cancelSubscription(stripe, supabaseAdmin, profile, immediate === true);
  }

  if (subscription.cancel_at_period_end) {
    return jsonResponse({ error: 'Resume your subscription before changing plans' }, 409);
  }

  const currentTier = getSubscriptionTier(subscription);
  const currentInterval = getSubscriptionBillingInterval(subscription);
  const targetInterval = billingInterval ?? currentInterval;

  if (targetInterval !== 'monthly' && targetInterval !== 'annual') {
    return jsonResponse({ error: 'Invalid billing interval' }, 400);
  }

  if (targetTier === currentTier && targetInterval === currentInterval) {
    return jsonResponse({ error: 'You are already on this plan' }, 400);
  }

  const targetPriceId = getRequiredTierPriceId(targetTier, targetInterval);
  const targetLevel = TIER_HIERARCHY[targetTier];
  const currentLevel = TIER_HIERARCHY[currentTier];
  const isDowngrade = targetLevel < currentLevel;
  const isUpgrade = targetLevel > currentLevel;
  const isIntervalChange = targetTier === currentTier && targetInterval !== currentInterval;

  // Upgrades and interval changes are immediate. Downgrades default to the end
  // of the current period unless the caller explicitly asks for immediate.
  const shouldApplyImmediately = immediate ?? (isUpgrade || isIntervalChange);

  if (isDowngrade && !shouldApplyImmediately) {
    const schedule = await schedulePlanChange(stripe, subscription, targetPriceId);

    return jsonResponse({
      success: true,
      message: `Your plan will change to ${targetTier} at the end of the current billing period`,
      newTier: targetTier,
      effectiveDate: new Date(subscription.current_period_end * 1000).toISOString(),
      scheduledChange: true,
      scheduleId: schedule.id,
    });
  }

  await releaseScheduleIfPresent(stripe, subscription);

  const updated = await stripe.subscriptions.update(
    subscription.id,
    {
      items: [{
        id: subscription.items.data[0].id,
        price: targetPriceId,
      }],
      proration_behavior: 'create_prorations',
      cancel_at_period_end: false,
    },
    {
      idempotencyKey: `change-plan:${crypto.randomUUID()}`,
    },
  );

  await syncSubscriptionToProfile(supabaseAdmin, updated, {
    tier: targetTier,
    cancelAtPeriodEnd: false,
    billingInterval: targetInterval,
  });

  return jsonResponse({
    success: true,
    message: isDowngrade
      ? `Subscription changed to ${targetTier} immediately`
      : `Subscription upgraded to ${targetTier}`,
    newTier: targetTier,
    effectiveDate: new Date().toISOString(),
    nextBillingDate: new Date(updated.current_period_end * 1000).toISOString(),
  });
}

async function createPortalSession(
  stripe: Stripe,
  profile: any,
): Promise<Response> {
  if (!profile.stripe_customer_id || isSimulatedId(profile.stripe_customer_id)) {
    return jsonResponse({ error: 'No Stripe customer found' }, 404);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${getFrontendUrl()}/settings?tab=billing`,
  });

  return jsonResponse({ url: session.url });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = getServiceRoleKey();

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase environment variables');
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const action = body?.action;
    if (!action) {
      return jsonResponse({ error: 'Action is required' }, 400);
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY is missing');
      return jsonResponse({ error: 'Stripe is not configured' }, 500);
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select(
        'id, stripe_customer_id, stripe_subscription_id, subscription_tier, subscription_status, cancel_at_period_end, billing_interval',
      )
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Failed to load profile', profileError);
      return jsonResponse({ error: 'Profile not found' }, 404);
    }

    switch (action) {
      case 'get_status':
        return await getSubscriptionStatus(stripe, profile);

      case 'cancel':
        return await cancelSubscription(stripe, supabaseAdmin, profile, body.immediate === true);

      case 'resume':
        return await resumeSubscription(stripe, supabaseAdmin, profile);

      case 'downgrade':
      case 'change_plan': {
        const targetTier = body.targetTier;
        if (!targetTier) {
          return jsonResponse({ error: 'Target tier is required' }, 400);
        }

        const billingInterval = body.billingInterval
          ? body.billingInterval as BillingInterval
          : undefined;

        return await changePlan(stripe, supabaseAdmin, profile, {
          targetTier,
          billingInterval,
          immediate: body.immediate,
        });
      }

      case 'create_portal_session':
        return await createPortalSession(stripe, profile);

      default:
        return jsonResponse({ error: 'Invalid action' }, 400);
    }
  } catch (error) {
    console.error('Error in manage-subscription:', error);
    return jsonResponse({ error: 'Could not update your subscription. Please try again.' }, 500);
  }
});
