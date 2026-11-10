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
> `20261106010000` (the gamification leaderboard fix from #235), while the three
> billing migrations are older and still pending. `supabase db push` refuses
> this out-of-order set with a `missing-remote` error unless `--include-all` is
> passed. The flag only adds local migrations missing from the remote history;
> it does not re-apply anything already recorded there.

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

`migration list` must show exactly these three as pending and nothing else:

```
20261104000000  stripe_production_hardening
20261104000001  batch_item_vault_trigger
20261106000000  stripe_checkout_locks_and_payment_fencing
```

The remote head will still be `20261106010000`; that is expected. If any other
migration is pending, or the local/remote history disagrees, stop.

Dry run:

```bash
supabase db push --remote --dry-run --include-all
```

Confirm the dry run lists exactly the three migrations above. Do not run
`supabase db reset --remote` under any circumstance.

## 2. Vault secret — before the migrations

Dashboard → Database → Vault → **New secret**:

- name: `service_role_key`
- value: the production service-role key from Project Settings → API

There must be exactly one row with that name. Never put the value in a file, a
migration, or chat.

This step **must** happen before step 3:
`20261104000001_batch_item_vault_trigger.sql` raises
`Expected exactly one service_role_key Vault secret` and aborts the migration
when the secret is absent.

Verify:

```sql
select count(*) from vault.decrypted_secrets where name = 'service_role_key'; -- 1
```

## 3. Apply

```bash
supabase db push --remote --include-all --yes
supabase migration list --remote   # all three now applied
```

If the push stops on `20261104000001` because the Vault secret is missing,
create the secret (step 2) and rerun the same push. Migrations already applied
in the first attempt are skipped.

## 4. Batch dispatch configuration

`handle_new_batch_item()` raises until `batch_item_dispatch_config` has one
row. Insert it **before batch uploads resume** (Dashboard SQL editor; the table
is owned by `postgres` and is not accessible to application roles):

```sql
INSERT INTO public.batch_item_dispatch_config (singleton, endpoint_url)
VALUES (true, 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/process-batch-item')
ON CONFLICT (singleton) DO UPDATE SET endpoint_url = EXCLUDED.endpoint_url;
```

An asynchronous `net.http_post` enqueue is not proof of delivery; confirm a
batch item reaches `process-batch-item` after the maintenance window.

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
select endpoint_url from public.batch_item_dispatch_config; -- one row
```

Confirm the `handle_new_batch_item` trigger is attached to `batch_item_dispatch`
as expected in this environment (the migration replaces the function, not the
trigger).

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
