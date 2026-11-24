# Production cutover — PR #234 billing migrations

Run only with owner authorization, a maintenance window, and a fresh backup.
This is the sanctioned path (`supabase` CLI + linked project), not direct
database access.

## Preconditions

- PR #234 is merged to `main` (apply migrations from the merged commit).
- Stripe is still in test mode; do not switch to live keys in the same window.
- The exposed `service_role` credentials are rotated/revoked and `git status`
  is clean.
- You have the production database password and are logged in to the Supabase
  CLI (`supabase projects list` shows `autoreceipt`).
- The CLI is v3 (`supabase --version`). v3 targets the local stack by default;
  every hosted *database* command below passes `--remote`. `functions deploy`
  targets the linked project by default; `--remote` only selects another one.

> **`--include-all` is required.** The remote database already has
> `20261106010000` (the gamification leaderboard fix from #235), while the
> billing restore and the billing/fencing migrations are older and still
> pending. `supabase db push` refuses this out-of-order set with a
> `missing-remote` error unless `--include-all` is passed. The flag only adds
> local migrations missing from the remote history; it does not re-apply
> anything already recorded there.

> **Current live state.** The deployed frontend already selects
> `profiles.cancel_at_period_end`/`billing_interval` and calls
> `change_plan`/`resume`. Until the migration (step 3) and the function deploy
> (step 6) are complete, subscription state may fail to load and plan-change
> actions may return 400.

## 1. Preflight

```bash
git switch main && git pull
set -a; . ./.env.local; set +a   # supplies SUPABASE_DB_PASSWORD
supabase link --project-ref mpmkbtsufihzdelrlszs
supabase migration list --remote
```

`migration list` must show the billing restore plus every later billing/fencing
migration that the remote lacks. As of this branch, the migrations this runbook
depends on are:

```
20261103000000  restore_billing_schema_drift
20261104000000  stripe_production_hardening
20261104000001  batch_item_vault_trigger
20261106000000  stripe_checkout_locks_and_payment_fencing
20261110010000  stripe_fencing_regressions
20261110020000  fix_profile_timezone_normalization
```

The remote may also lack `20261109000000` and `20261110000000` (index-only
migrations); those are safe to apply with the chain. `20261106010000` (the
gamification leaderboard fix from #235) is already applied remotely and must not
reappear as pending. If a migration outside this billing/fencing/index set is
pending, or the local/remote history disagrees, stop.

Dry run:

```bash
supabase db push --remote --dry-run --include-all
```

Confirm the dry run lists exactly the pending migrations above. Do not run
`supabase db reset --remote` under any circumstance.

## 2. Vault secret — before the migrations

Dashboard → Database → Vault → **New secret**:

- name: `service_role_key` (lowercase — Vault secret names are case-sensitive)
- value: the production service-role key from Project Settings → API

There must be exactly one row with that name. Never put the value in a file, a
migration, or chat.

**Known hosted mismatch.** Hosted currently has a single uppercase
`SERVICE_ROLE_KEY` Vault secret and no lowercase `service_role_key`.
`20261104000001_batch_item_vault_trigger.sql:48` counts only the lowercase name,
so it raises `Expected exactly one service_role_key Vault secret` and aborts the
push even though a service-role key is present. Create the lowercase secret
(same value) before step 3, or rename the uppercase one if nothing else reads
it. The migration is forward-only and cannot be fixed by a later migration
because it aborts first.

This step **must** happen before step 3. Verify both the lowercase requirement
and the uppercase duplicate:

```sql
select name, count(*)
from vault.decrypted_secrets
where name in ('service_role_key', 'SERVICE_ROLE_KEY')
group by name
order by name;
-- service_role_key | 1   (required)
-- SERVICE_ROLE_KEY | 1   (may remain; it does not satisfy the migration)
```

## 3. Apply

```bash
supabase db push --remote --include-all --yes
supabase migration list --remote   # every pending migration now applied
```

If the push stops on `20261104000001` because the Vault secret is missing,
create the secret (step 2) and rerun the same push. Migrations already applied
in the first attempt are skipped.

## 4. Batch dispatch configuration (legacy path, currently unattached)

`20261104000001` creates `batch_item_dispatch_config` empty and replaces
`handle_new_batch_item()`, but it **does not create a trigger**. No
`CREATE TRIGGER` referencing `handle_new_batch_item` exists anywhere in this
repository, and hosted has no non-internal trigger invoking it. The current
batch upload path does not use this function: it writes
`batch_upload_sessions` / `batch_upload_files`
(`20250720000003_batch_upload_optimization.sql`) and posts each file to
`process-receipt` (`src/services/receiptService.ts:1940`). No repo migration
creates `batches` or `batch_items`.

Hosted does still carry a legacy `process-batch-item` Edge Function
(`verify_jwt: false`, version 77, last updated 2025-04-16) that is **not tracked
in this repository** and whose deployed source cannot be retrieved because its
deployment metadata is missing. Do not redeploy or delete it during this
cutover, and do not treat it as live: nothing in the repository or hosted
database invokes it, so it receives no traffic from the current upload path.

Consequently the empty config table does **not** block existing batch uploads,
and leaving it empty is safe. Do not point it at a hostname until a trigger is
deliberately attached and the legacy function is reviewed; an asynchronous
`net.http_post` enqueue is not proof of delivery. If the legacy trigger is ever
reattached, inserts fail closed with
`Missing administrator-configured batch item endpoint` until this row is set
(the table is owned by `postgres` and is not accessible to application roles):

```sql
-- only when a trigger is deliberately attached and the endpoint exists
INSERT INTO public.batch_item_dispatch_config (singleton, endpoint_url)
VALUES (true, 'https://<environment-ref>.supabase.co/functions/v1/process-batch-item')
ON CONFLICT (singleton) DO UPDATE SET endpoint_url = EXCLUDED.endpoint_url;
```

Verify the current (unattached) state:

```sql
select n.nspname as schema, c.relname as table_name, t.tgname
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal and p.proname = 'handle_new_batch_item';
-- expected: zero rows
```

## 5. Verification

In the Dashboard SQL editor:

```sql
select count(*) from vault.decrypted_secrets where name = 'service_role_key'; -- 1
select column_name from information_schema.columns
 where table_schema='public' and table_name='profiles'
   and column_name in ('next_billing_date','payment_method_brand','payment_method_last_four','cancel_at_period_end','billing_interval');
select to_regclass('public.stripe_checkout_locks'),
       to_regclass('public.stripe_webhook_events'),
       to_regclass('public.stripe_subscription_event_order');
select endpoint_url from public.batch_item_dispatch_config; -- zero rows expected; see step 4
```

Confirm no trigger is attached (the query in step 4 must return zero rows).
`batch_item_dispatch` is not a table in this project; the only table is
`batch_item_dispatch_config`, and it is deliberately empty after the migration.

Smoke test with a test-mode event (never a live charge): send one
`customer.subscription.updated` event to the deployed `stripe-webhook` and
confirm a `stripe_webhook_events` row reaches `processed` and the profile row is
fenced correctly.

## 5a. Billing preferences and reminder compatibility

Do this before step 6 and keep the window open until the frontend cache is
invalidated.

1. Record the hosted constraint shapes before pushing. The restore migration
   drops every `CHECK` on `billing_email_schedule` that references
   `scheduled_for` and a time source, not just the checked-in expression:

   ```sql
   select conname, pg_get_expr(conbin, conrelid) as definition
   from pg_constraint
   where conrelid = 'public.billing_email_schedule'::regclass
     and contype = 'c';
   ```

   After the push, rerun this query. It must return no expression containing
   both `scheduled_for` and `now()`/`CURRENT_TIMESTAMP` (or the other timestamp
   functions). The migration raises and aborts if one survives; do not bypass
   that failure.

2. Record the hosted `mark_billing_reminder_sent` definition and signature:

   ```sql
   select p.oid::regprocedure as signature, pg_get_functiondef(p.oid) as definition
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'mark_billing_reminder_sent';
   ```

   The restore replaces the canonical
   `mark_billing_reminder_sent(uuid,boolean,text)` with explicit
   `billing_email_status` casts. If the hosted signature differs, stop and
   inspect before continuing; do not create a second overload blindly.

3. Deploy the frontend build in the same window, after the database push, then
   invalidate the Vercel/CDN cache. The restore keeps the legacy
   `get_billing_preferences(uuid)` as a self-scoped compatibility alias, so
   already-open tabs and cached bundles continue to load their own preferences;
   the new build uses `get_my_billing_preferences()` and quiet-hours fields.
   Do not remove the legacy alias until the cache window has closed and
   telemetry shows no legacy calls.

4. Open Settings → Billing in a fresh tab and in an old/cached tab. Both must
   load preferences; saving must not overwrite stored values with defaults. If
   the old tab fails with `42501`, stop and verify the alias grant and the
   authenticated self-scope check before proceeding.

5. Confirm the legacy billing RPCs are no longer callable by browser roles.
   `20261103000000_restore_billing_schema_drift.sql` revokes `PUBLIC`, `anon`
   and `authenticated` execute on every overload of a broad billing RPC list,
   including four functions that hosted currently exposes: 
   `schedule_billing_reminder`, `get_upcoming_renewals`,
   `get_email_delivery_stats`, and `cleanup_old_email_schedules`. Before the
   restore an anonymous caller could queue reminder mail for any user, read
   every subscriber's renewal rows, read cross-tenant delivery counts, and
   delete old schedule rows. All four are called only from Edge Functions using
   the service-role client, so no redeploy is needed. This is the same migration
   that restores the drifted functions — there is no separate grant migration.

   ```sql
   select p.oid::regprocedure as signature,
          has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
          has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
          has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('schedule_billing_reminder', 'get_upcoming_renewals',
                       'get_email_delivery_stats', 'cleanup_old_email_schedules');
   -- every row: anon = false, authenticated = false, service_role = true
   ```

   `supabase/tests/billing_rpc_grants.sql` asserts this in the `sql-regression`
   CI job. Then call each Edge Function that uses them (`email-scheduler` with a
   `schedule_billing_reminders` action, `billing-auto-renewal`) and confirm a
   `200` rather than `42501`; service-role access is the path those functions
   use.

## 6. Deploy the functions

Schema alone does not restore the live application contract. The production
Edge Functions are the 2025-09-02 builds, while the deployed frontend already
calls `change_plan` and `resume`. After the migration, deploy from the same
merged commit:

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy create-checkout-session manage-subscription
```

Optionally deploy `initialize-user-subscription` as well; it now returns 410.
Then set the Edge Function and Vercel secrets and register the Stripe webhook
as described in `docs/BILLING_DEPLOYMENT_GUIDE.md`. Verify a Stripe test event
returns 200 and that upgrade/downgrade/cancel/resume work from the UI before
switching to live keys.

## 7. Rollback

Migrations are forward-only. Take a database backup before step 3. To roll back
application code, revert the merge; to roll back schema, restore the backup and
re-apply only the migrations you intend. Do not attempt `db reset` on the
linked project.
