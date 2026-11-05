const migrationUrl = new URL('../../migrations/20261104000000_stripe_production_hardening.sql', import.meta.url);
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
