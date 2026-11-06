const migrationUrl = new URL('../../migrations/20261104000000_stripe_production_hardening.sql', import.meta.url);
const checkoutMigrationUrl = new URL('../../migrations/20261106000000_stripe_checkout_locks_and_payment_fencing.sql', import.meta.url);
const checkoutFunctionUrl = new URL('../create-checkout-session/index.ts', import.meta.url);
const webhookUrl = new URL('./index.ts', import.meta.url);

Deno.test('subscription preferences are created inside the fenced transaction', async () => {
  const migration = await Deno.readTextFile(migrationUrl);
  const webhook = await Deno.readTextFile(webhookUrl);
  const start = migration.indexOf('CREATE OR REPLACE FUNCTION public.apply_fenced_stripe_subscription_event(');
  const end = migration.indexOf('\n$$;', start);
  const body = migration.slice(start, end);

  if (start < 0 || end < 0 || !body.includes('PERFORM public.assert_active_stripe_claim(_event_id, _claim_token)') ||
    !body.includes('INSERT INTO public.billing_preferences (user_id)') ||
    !body.includes('ON CONFLICT (user_id) DO NOTHING') ||
    webhook.includes("rpc('initialize_billing_preferences'")) {
    throw new Error('Billing preferences must be created by the fenced subscription transaction');
  }
});

Deno.test('equal-timestamp events fail closed without ordering opaque IDs', async () => {
  const migration = await Deno.readTextFile(migrationUrl);
  const start = migration.indexOf('CREATE OR REPLACE FUNCTION public.assert_stripe_event_order(');
  const end = migration.indexOf('\n$$;', start);
  const body = migration.slice(start, end);

  if (start < 0 || end < 0 ||
    !body.includes('_event_created = v_last_created AND _event_id <> v_last_event_id') ||
    !body.includes("USING ERRCODE = 'serialization_failure'") ||
    /_event_id\s*[<>]\s*v_last_event_id/.test(body)) {
    throw new Error('Ambiguous Stripe event ordering must fail closed');
  }
});

Deno.test('payment handlers write billing state only through fenced RPCs', async () => {
  const webhook = await Deno.readTextFile(webhookUrl);
  const start = webhook.indexOf('async function handlePaymentSucceeded(');
  const end = webhook.indexOf('async function handleUpcomingInvoice(');
  const handlers = webhook.slice(start, end);

  if (start < 0 || end < 0 ||
    !handlers.includes('applyFencedStripePaymentEvent(') ||
    !handlers.includes('applyFencedRenewalFailure(') ||
    !handlers.includes('applyFencedProfileStatus(') ||
    !handlers.includes('applyFencedRenewalTracking(')) {
    throw new Error('Payment handlers must use the fenced payment RPCs');
  }

  // Profiles, payment history, and retry tracking are written by the RPCs; a
  // direct .update()/.insert() in these handlers would bypass the claim fence,
  // and so would an unfenced RPC that writes billing state.
  if (/\.from\('profiles'\)[\s\S]{0,80}\.update\(/.test(handlers) ||
    /\.from\('payment_history'\)/.test(handlers) ||
    /\.from\('payment_retry_tracking'\)/.test(handlers) ||
    handlers.includes("rpc('update_subscription_renewal_tracking'")) {
    throw new Error('Payment handlers must not write billing state outside the fence');
  }
});

Deno.test('checkout completion releases the per-user checkout lock', async () => {
  const webhook = await Deno.readTextFile(webhookUrl);

  if (!webhook.includes('releaseCheckoutLock(supabaseClient, session.client_reference_id, { sessionId: session.id })')) {
    throw new Error('checkout.session.completed must release the checkout ownership lock by session id');
  }
});

Deno.test('checkout sessions are created only while holding the checkout lock', async () => {
  const checkout = await Deno.readTextFile(checkoutFunctionUrl);
  const webhook = await Deno.readTextFile(webhookUrl);

  if (!checkout.includes('acquireCheckoutOwnership(') ||
    !checkout.includes('bindCheckoutSession(') ||
    !checkout.includes('releaseCheckoutLock(supabaseAdmin, user.id, { lockToken })') ||
    checkout.includes('releaseCheckoutLock(supabaseAdmin, user.id, null)')) {
    throw new Error('create-checkout-session must acquire, bind, and release the checkout lock by token');
  }

  // The Stripe session must be bound before the response reports success.
  const createIndex = checkout.indexOf('checkout.sessions.create(');
  const bindIndex = checkout.indexOf('bindCheckoutSession(');
  if (createIndex < 0 || bindIndex < 0 || bindIndex < createIndex) {
    throw new Error('The checkout lock must be bound after the session is created');
  }

  if (!webhook.includes('releaseCheckoutLock(')) {
    throw new Error('The webhook must release the lock when checkout completes');
  }
});

Deno.test('an out-of-order recorded payment does not advance renewal tracking', async () => {
  const webhook = await Deno.readTextFile(webhookUrl);
  const start = webhook.indexOf('const paymentOutcome = await applyFencedStripePaymentEvent(');
  const end = webhook.indexOf('// Email is a best-effort external effect');
  const section = webhook.slice(start, end);

  // `apply_fenced_stripe_payment_event` records a payment row and returns
  // 'recorded' for a one-off, superseded, or out-of-order event without
  // advancing state. Renewal tracking shares the payment-family watermark, so
  // calling it after a 'recorded' outcome would fail the order check and turn
  // a recorded payment into a 500 retry loop.
  if (start < 0 || end < 0 ||
    !section.includes("if (subscription && paymentOutcome === 'applied')") ||
    !section.includes("paymentOutcome === 'recorded'")) {
    throw new Error('Renewal tracking must run only for an applied payment');
  }
});

Deno.test('a created checkout session keeps its lock until bound or expired', async () => {
  const checkout = await Deno.readTextFile(checkoutFunctionUrl);

  // The generic failure path must not release the lock once a session exists:
  // releasing would allow a second completable session next to the first.
  const catchStart = checkout.indexOf('} catch (error) {\n      if (createdSession)');
  const missingUrlStart = checkout.indexOf('if (!session.url || !session.expires_at)');
  const expireIndex = checkout.indexOf('checkout.sessions.expire(session.id)', missingUrlStart);
  const releaseIndex = checkout.indexOf('releaseCheckoutLock(supabaseAdmin, user.id, { lockToken })', missingUrlStart);

  if (catchStart < 0) {
    throw new Error('The post-create failure path must check createdSession before releasing the lock');
  }
  if (missingUrlStart < 0 || expireIndex < 0 || releaseIndex < 0 || expireIndex > releaseIndex) {
    throw new Error('An incomplete Checkout Session must be expired before its lock is released');
  }
});

Deno.test('the checkout lock cannot outlive the session it protects', async () => {
  const migration = await Deno.readTextFile(checkoutMigrationUrl);
  const start = migration.indexOf('CREATE OR REPLACE FUNCTION public.bind_checkout_session(');
  const end = migration.indexOf('\n$$;', start);
  const body = migration.slice(start, end);

  if (start < 0 || end < 0 ||
    !body.includes('expires_at = _expires_at') ||
    !body.includes('session_id IS NULL') ||
    !body.includes('expires_at > clock_timestamp()')) {
    throw new Error('Binding the checkout lock must require a live pre-bind lock and adopt the session expiry');
  }
});

Deno.test('payment fencing RPCs check the claim before every write', async () => {
  const subscriptionMigration = await Deno.readTextFile(migrationUrl);
  const checkoutMigration = await Deno.readTextFile(checkoutMigrationUrl);

  for (const [migrationText, fn] of [
    [subscriptionMigration, 'apply_fenced_stripe_subscription_event'],
    [checkoutMigration, 'apply_fenced_stripe_payment_event'],
    [checkoutMigration, 'apply_fenced_renewal_failure'],
    [checkoutMigration, 'apply_fenced_profile_status'],
    [checkoutMigration, 'apply_fenced_renewal_tracking'],
  ] as const) {
    const start = migrationText.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`);
    const end = migrationText.indexOf('\n$$;', start);
    const body = migrationText.slice(start, end);
    const claimCheck = body.indexOf('PERFORM public.assert_active_stripe_claim(');
    // The first write of any kind: INSERT, UPDATE, or DELETE on a real table.
    const writeMatches = [
      body.indexOf('INSERT INTO public.'),
      body.indexOf('UPDATE public.'),
      body.indexOf('DELETE FROM public.'),
    ].filter((index) => index >= 0);
    const firstWrite = Math.min(...(writeMatches.length ? writeMatches : [body.length]));

    if (start < 0 || end < 0 || claimCheck < 0) {
      throw new Error(`${fn} must verify the webhook claim`);
    }

    if (firstWrite < 0 || claimCheck > firstWrite) {
      throw new Error(`${fn} must check the claim before writing`);
    }
  }
});
