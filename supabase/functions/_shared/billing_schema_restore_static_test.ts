const restoreUrl = new URL('../../migrations/20261103000000_restore_billing_schema_drift.sql', import.meta.url);
const harnessUrl = new URL('../../../.github/sql-regression/run-sql-regression.sh', import.meta.url);

Deno.test('the restore migration recreates every missing billing function', async () => {
  const migration = await Deno.readTextFile(restoreUrl);

  for (
    const fn of [
      'create_default_billing_preferences',
      'update_billing_preferences_updated_at',
      'update_billing_email_schedule_updated_at',
      'update_subscription_renewal_tracking_updated_at',
      'update_payment_retry_tracking_updated_at',
      'update_subscription_renewal_tracking',
      'create_payment_retry_tracking',
      'get_pending_billing_reminders',
      'process_auto_renewal',
      'handle_renewal_failure',
      'schedule_multiple_billing_reminders',
    ] as const
  ) {
    if (!migration.includes(`CREATE OR REPLACE FUNCTION public.${fn}(`)) {
      throw new Error(`The restore migration must recreate public.${fn}`);
    }
  }
});

Deno.test('the restore migration recreates the missing triggers idempotently', async () => {
  const migration = await Deno.readTextFile(restoreUrl);

  const triggers = [
    ['create_billing_preferences_trigger', 'auth.users'],
    ['billing_preferences_updated_at_trigger', 'public.billing_preferences'],
    ['billing_email_schedule_updated_at_trigger', 'public.billing_email_schedule'],
    ['subscription_renewal_tracking_updated_at_trigger', 'public.subscription_renewal_tracking'],
    ['payment_retry_tracking_updated_at_trigger', 'public.payment_retry_tracking'],
  ] as const;

  for (const [trigger, table] of triggers) {
    if (!migration.includes(`DROP TRIGGER IF EXISTS ${trigger} ON ${table};`) ||
      !migration.includes(`CREATE TRIGGER ${trigger}`)) {
      throw new Error(`The restore migration must recreate ${trigger} on ${table} idempotently`);
    }
  }
});

Deno.test('the restore migration revokes every overload including the stray anon-executable one', async () => {
  const migration = await Deno.readTextFile(restoreUrl);

  // The unversioned eight-argument function must be revoked, but not dropped:
  // the deployed older build may still call it.
  if (migration.includes('DROP FUNCTION') ||
    !migration.includes('pg_get_function_identity_arguments(p.oid)') ||
    !migration.includes("'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated'") ||
    !migration.includes("'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role'")) {
    throw new Error(
      'The restore migration must revoke every overload by identity arguments and grant service_role only',
    );
  }
});

Deno.test('the restore migration is applied before the pending hardening migration', async () => {
  const harness = await Deno.readTextFile(harnessUrl);
  const restoreIndex = harness.indexOf('20261103000000_restore_billing_schema_drift.sql');
  const hardeningIndex = harness.indexOf('20261104000000_stripe_production_hardening.sql');

  if (restoreIndex < 0 || hardeningIndex < 0 || restoreIndex > hardeningIndex) {
    throw new Error(
      'The SQL regression harness must apply the restore migration before the hardening migration',
    );
  }
});
