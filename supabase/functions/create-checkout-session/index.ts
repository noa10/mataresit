import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@14.21.0";
import {
  getBillingIntervalFromPriceId,
  getDebugInfo,
  isValidPriceId,
  resolveTierFromPriceId,
} from '../_shared/stripe-config.ts';
import { getFrontendUrl } from '../_shared/site-url.ts';
import { getServiceRoleKey } from '../_shared/service-role.ts';
import {
  acquireCheckoutOwnership,
  bindCheckoutSession,
  releaseCheckoutLock,
  type CheckoutSessionInspection,
} from '../_shared/checkout-locks.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// The Checkout Session's own lifetime. Stripe's minimum is 30 minutes; 1860
// adds a minute of clock-skew headroom so Stripe never rejects the value as
// "less than 30 minutes in the future".
const SESSION_TTL_SECONDS = 1860;
// The lock's preparation TTL must outlive SESSION_TTL_SECONDS: if this request
// dies between creating the session and binding it, the unbound lock expires
// only after the orphan session can no longer be completed, so a later request
// can never steal the lock while a second session could still be paid for.
const LOCK_TTL_SECONDS = SESSION_TTL_SECONDS + 300;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const isSimulatedId = (value: string | null | undefined): boolean =>
  Boolean(
    value?.startsWith('cus_simulated_') ||
    value?.startsWith('sub_simulated_') ||
    value?.startsWith('test_sub_'),
  );

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

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace('Bearer ', '');
    // `getUser` returns a null user for an invalid or expired token; the outer
    // catch turns transport failures into a 500.
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    let body: { priceId?: string; billingInterval?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const { priceId, billingInterval = 'monthly' } = body;

    if (!priceId) {
      return jsonResponse({ error: 'Price ID is required' }, 400);
    }

    if (billingInterval !== 'monthly' && billingInterval !== 'annual') {
      return jsonResponse({ error: 'Billing interval must be monthly or annual' }, 400);
    }

    if (!isValidPriceId(priceId)) {
      console.error('Rejected unconfigured price ID', { priceId, debug: getDebugInfo(priceId) });
      return jsonResponse({ error: 'This price is not available' }, 400);
    }

    const priceInterval = getBillingIntervalFromPriceId(priceId);
    if (priceInterval !== billingInterval) {
      return jsonResponse({ error: 'Billing interval does not match the selected price' }, 400);
    }

    const targetTier = resolveTierFromPriceId(priceId);

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY is missing');
      return jsonResponse({ error: 'Stripe is not configured' }, 500);
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

    const inspectCheckoutSession = async (
      sessionId: string,
    ): Promise<CheckoutSessionInspection> => {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.status === 'open' && session.url) {
          // The open session must be for the plan this request is buying: a
          // session for a different plan must not be reused for this one, or
          // the user pays for a plan they did not select. Expire the stale
          // session and let the lock be stolen for a fresh one.
          const sessionTier = session.metadata?.tier;
          const sessionInterval = session.metadata?.billing_interval;
          if (sessionTier !== targetTier || sessionInterval !== billingInterval) {
            try {
              await stripe.checkout.sessions.expire(sessionId);
              return { status: 'expired' };
            } catch (expireError) {
              console.warn(`Could not expire Checkout Session ${sessionId} for a plan change:`, expireError);
              return { status: 'unknown' };
            }
          }
          return { status: 'open', url: session.url };
        }
        if (session.status === 'complete') return { status: 'complete' };
        if (session.status === 'expired') return { status: 'expired' };
        return { status: 'unknown' };
      } catch (error) {
        // Inspection failure is treated as unknown: the session may still be
        // open, and creating a second one could sell a second subscription.
        // This includes resource_missing: Stripe not recognising the session
        // points at a key or mode mismatch, and failing closed (busy) is
        // safer than freeing a lock whose session might still be completable.
        console.warn(`Could not inspect Checkout Session ${sessionId}:`, error);
        return { status: 'unknown' };
      }
    };

    // One request at a time owns this user's checkout. A second request reuses
    // the open session instead of creating a duplicate customer or session.
    const ownership = await acquireCheckoutOwnership(
      supabaseAdmin,
      user.id,
      inspectCheckoutSession,
      { ttlSeconds: LOCK_TTL_SECONDS },
    );

    if (ownership.kind === 'busy') {
      return jsonResponse({
        error: 'A checkout is already in progress. Complete it or try again shortly.',
        code: 'CHECKOUT_IN_PROGRESS',
      }, 409);
    }

    if (ownership.kind === 'reuse') {
      // The open session predates this request. A subscription created since
      // it was opened — by a completed checkout whose webhook already released
      // the lock, or from the Stripe dashboard — would make completing it a
      // second sale, so the same SUBSCRIPTION_EXISTS guard as the create path
      // applies before handing out the URL.
      const { data: reuseProfile, error: reuseProfileError } = await supabaseAdmin
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single();

      if (reuseProfileError) {
        // Cannot verify, so the URL is not handed out. The lock stays bound to
        // the open session: once verification works again, the next request
        // reuses it.
        console.error('Failed to load profile for checkout reuse verification', reuseProfileError);
        return jsonResponse({ error: 'Could not start checkout. Please try again.' }, 500);
      }

      const reuseCustomerId = reuseProfile?.stripe_customer_id;
      if (typeof reuseCustomerId === 'string' && reuseCustomerId && !isSimulatedId(reuseCustomerId)) {
        const existingSubscriptions = await stripe.subscriptions.list({
          customer: reuseCustomerId,
          status: 'all',
          limit: 10,
        });

        const blockingSubscription = existingSubscriptions.data.find(
          (subscription: Stripe.Subscription) =>
            !['canceled', 'incomplete_expired'].includes(subscription.status),
        );

        if (blockingSubscription) {
          // The open session must not stay completable next to an existing
          // subscription. Expiring it is best-effort: if Stripe refuses, the
          // guard fires again on the next request.
          try {
            await stripe.checkout.sessions.expire(ownership.sessionId);
          } catch (expireError) {
            console.warn(`Could not expire reused Checkout Session ${ownership.sessionId}:`, expireError);
          }
          await releaseCheckoutLock(supabaseAdmin, user.id, { sessionId: ownership.sessionId });
          return jsonResponse({
            error: 'You already have an active subscription. Use the plan change option instead.',
            code: 'SUBSCRIPTION_EXISTS',
            tier: targetTier,
          }, 409);
        }
      }

      return jsonResponse({
        sessionId: ownership.sessionId,
        url: ownership.url,
        reused: true,
      });
    }

    // From here on this request owns the lock. Any failure before a Checkout
    // Session exists releases the pre-bind lock so the user is not locked out
    // for the full acquisition TTL. Once a session exists, releasing would let
    // the next request create a second completable session.
    const lockToken = ownership.lockToken;
    let createdSession: Stripe.Checkout.Session | null = null;

    try {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, stripe_customer_id, stripe_subscription_id, subscription_tier')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        await releaseCheckoutLock(supabaseAdmin, user.id, { lockToken });
        console.error('Failed to load profile', profileError);
        return jsonResponse({ error: 'Profile not found' }, 404);
      }

      // Legacy simulated IDs are not real Stripe objects. Clear them before a
      // real checkout so the user cannot keep a fake paid entitlement.
      if (isSimulatedId(profile.stripe_customer_id) || isSimulatedId(profile.stripe_subscription_id)) {
        const { error: resetError } = await supabaseAdmin
          .from('profiles')
          .update({
            stripe_customer_id: null,
            stripe_subscription_id: null,
            subscription_tier: 'free',
            subscription_status: 'active',
            subscription_start_date: null,
            subscription_end_date: null,
            trial_end_date: null,
            cancel_at_period_end: false,
            billing_interval: 'monthly',
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (resetError) {
          await releaseCheckoutLock(supabaseAdmin, user.id, { lockToken });
          console.error('Failed to clear simulated subscription', resetError);
          return jsonResponse({ error: 'Could not prepare your account for checkout' }, 500);
        }

        profile.stripe_customer_id = null;
        profile.stripe_subscription_id = null;
      }

      let customerId: string | null = profile.stripe_customer_id ?? null;

      if (!customerId) {
        // Customer creation runs under the checkout lock, so two concurrent
        // requests cannot create two Stripe customers for one profile. The
        // idempotency key makes an ambiguous network failure replay the same
        // customer instead of creating a second one, and lets a later request
        // re-derive a customer whose profile link failed.
        const customer = await stripe.customers.create({
          email: user.email ?? profile.email ?? undefined,
          metadata: { supabase_user_id: user.id },
        }, {
          idempotencyKey: `checkout-customer-${user.id}`,
        });

        customerId = customer.id;

        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            stripe_customer_id: customerId,
            email: user.email ?? profile.email ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (updateError) {
          // The customer exists at Stripe and the idempotency key re-derives
          // it on retry, so freeing the lock is safe: the next attempt links
          // the same customer instead of creating a second one. Holding the
          // lock for the full TTL would lock the user out of checkout for
          // half an hour over a transient database error.
          await releaseCheckoutLock(supabaseAdmin, user.id, { lockToken });
          console.error('Failed to store Stripe customer ID', updateError);
          return jsonResponse({ error: 'Could not prepare your account for checkout' }, 500);
        }
      }

      // A second Checkout Session for an existing subscriber creates a second
      // subscription. Plan changes must go through manage-subscription.
      const existingSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 10,
      });

      const blockingSubscription = existingSubscriptions.data.find((subscription: Stripe.Subscription) =>
        !['canceled', 'incomplete_expired'].includes(subscription.status)
      );

      if (blockingSubscription) {
        await releaseCheckoutLock(supabaseAdmin, user.id, { lockToken });
        return jsonResponse({
          error: 'You already have an active subscription. Use the plan change option instead.',
          code: 'SUBSCRIPTION_EXISTS',
          tier: targetTier,
        }, 409);
      }

      const baseUrl = getFrontendUrl();
      const successUrl = `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/pricing`;

      createdSession = await stripe.checkout.sessions.create({
        customer: customerId,
        client_reference_id: user.id,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
        metadata: {
          user_id: user.id,
          tier: targetTier,
          billing_interval: billingInterval,
        },
        subscription_data: {
          metadata: {
            user_id: user.id,
            tier: targetTier,
            billing_interval: billingInterval,
          },
        },
      }, {
        // Scoped to this lock acquisition: a retry inside this request replays
        // the same session, in this request's scope only — a later request gets
        // a fresh token and so can never replay a long-expired session back to
        // life.
        idempotencyKey: `checkout-session-${lockToken}`,
      });

      const session = createdSession;

      if (!session.url || !session.expires_at) {
        // Stripe may have created a payable object even though the SDK returned
        // no URL. Expire it before freeing the lock; if it cannot be expired,
        // keep the lock so a second session cannot be opened alongside it.
        let expired = false;
        try {
          await stripe.checkout.sessions.expire(session.id);
          expired = true;
        } catch (expireError) {
          console.error('Could not expire the incomplete Checkout Session; keeping the lock', expireError);
        }
        if (expired) {
          await releaseCheckoutLock(supabaseAdmin, user.id, { lockToken });
        }
        console.error('Checkout Session is missing a URL or expiry', { sessionId: session.id });
        return jsonResponse({ error: 'Could not start checkout. Please try again.' }, 500);
      }

      const bound = await bindCheckoutSession(
        supabaseAdmin,
        user.id,
        lockToken,
        session.id,
        session.expires_at,
      );

      if (!bound) {
        // The session exists and is completable, so releasing would allow a
        // second session. Keep the lock: it self-heals after the session can
        // no longer be completed (LOCK_TTL_SECONDS > SESSION_TTL_SECONDS), and
        // the completion webhook releases it by session id.
        console.error(`Failed to bind Checkout Session ${session.id} to the checkout lock`);
        return jsonResponse({ error: 'Could not start checkout. Please try again.' }, 500);
      }

      return jsonResponse({ sessionId: session.id, url: session.url });
    } catch (error) {
      if (createdSession) {
        // The session exists and may still be completable. Releasing here would
        // let the next request open a second one; the lock self-heals once the
        // session can no longer be paid.
        console.error('Checkout Session exists but the request failed before binding; keeping the lock', {
          sessionId: createdSession.id,
        });
      } else {
        await releaseCheckoutLock(supabaseAdmin, user.id, { lockToken });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return jsonResponse({ error: 'Could not start checkout. Please try again.' }, 500);
  }
});
