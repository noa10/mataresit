# Production cutover — PR #234 billing migrations

Run only with owner authorization, a maintenance window, and a fresh backup.
This is the sanctioned path (`supabase` CLI + linked project), not direct
database access. The steps below are reusable guidance for any remaining or
future rollout; check the actual state before taking action.

**Rollout status (reported 2026-11-25; not freshly revalidated):** the seven
original migrations listed below, including the restore from commit `498f0fa`,
were applied on 2026-11-25. The follow-up
`20261126000000_fix_billing_reminder_enum_compatibility` migration has not been
deployed; PR #266 remains open. The frontend was deployed before the push, and
Edge Functions were deployed on 2026-11-25. Cache invalidation is unverified, and
the fresh-tab and old/cached-tab billing preference smoke tests are incomplete.
Check remote migration history and deployed function versions before deciding
what remains to be done.

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

> **Out-of-order migrations.** If the dry run shows an approved migration older
> than one already recorded remotely, `supabase db push` may require
> `--include-all`. The flag includes local migrations missing from remote
> history; it does not re-apply recorded migrations. Review the entire dry-run
> list before using it, since it can include other missing migrations too.

> **Historical frontend observation (before the 2026-11-25 push).** The deployed
> frontend selected `profiles.cancel_at_period_end`/`billing_interval` and called
> `change_plan`/`resume` before the database push. Missing schema or outdated
> functions could cause subscription loading failures or 400 responses; the
> push alone does not establish that the deployed application now works.

## 1. Preflight

```bash
git switch main && git pull
set -a; . ./.env.local; set +a   # supplies SUPABASE_DB_PASSWORD
supabase link --project-ref mpmkbtsufihzdelrlszs
supabase migration list --remote
```

Compare local and remote history and review every migration that is actually
pending. The following seven were observed pending on 2026-11-24 and reported
applied on 2026-11-25; this is a historical list, not an expected pending set:

```
20261103000000  restore_billing_schema_drift
20261104000000  stripe_production_hardening
20261104000001  batch_item_vault_trigger
20261106000000  stripe_checkout_locks_and_payment_fencing
20261109000000  receipt_neighbor_lookup_indexes
20261110000000  receipt_neighbor_date_indexes
20261110010000  stripe_fencing_regressions
```

In the 2026-11-24 observation, `20261106010000` (gamification leaderboard
fix, #235) and `20261110020000` (profile timezone normalization, #253) were
already applied. The two receipt-index migrations above use ordinary
`CREATE INDEX` statements and briefly lock `receipts`; the observed table had
806 rows at that time. For any future index migration, assess the current
size and lock impact when scheduling the window. If there is unexplained
history drift or an unreviewed migration appears, stop and investigate.

Dry run:

```bash
supabase db push --remote --dry-run --include-all
```

Confirm the dry run matches the reviewed, authorized pending set. If it is
empty, do not push; continue with the outstanding verification steps. Do not
run `supabase db reset --remote` under any circumstance.

## 2. Vault prerequisite

The Vault credential was already replaced for this rollout. Do not create,
replace, or delete either Vault entry as a routine step for the completed push.
The historical 2026-11-24 observation was one lowercase `service_role_key` and
one uppercase `SERVICE_ROLE_KEY`; it predates the replacement and is not a
statement of current Vault contents.

For a different environment where `20261104000001` is actually pending, verify
that exactly one lowercase `service_role_key` exists and holds the current
service-role key. The migration counts that case-sensitive name and aborts
otherwise; an uppercase entry does not satisfy the check. If remediation is
needed, follow the authorized credential-management procedure in Dashboard →
Database → Vault. Never put the value in a file, migration, or chat.

A name/count check, when authorized, does not establish that the stored value is
current:

```sql
select name, count(*)
from vault.decrypted_secrets
where name in ('service_role_key', 'SERVICE_ROLE_KEY')
group by name
order by name;
-- service_role_key | 1   (required if the migration is pending)
```

## 3. Apply

Only if the dry run identifies reviewed and authorized pending migrations, apply
the same set with the required flags (including `--include-all` when needed):

```bash
supabase db push --remote --include-all --yes
supabase migration list --remote   # confirm the reviewed migrations were applied
```

If a future push stops on `20261104000001` because the Vault secret is missing,
resolve the prerequisite through the authorized procedure in step 2, then rerun
the reviewed push. Migrations already applied in the first attempt are skipped.

## 4. Batch dispatch configuration (legacy path)

`20261104000001` creates `batch_item_dispatch_config` empty and replaces
`handle_new_batch_item()`, but it **does not create a trigger**. No
`CREATE TRIGGER` referencing `handle_new_batch_item` exists anywhere in this
repository; the 2026-11-24 hosted observation found no non-internal trigger
invoking it. The current
batch upload path does not use this function: it writes
`batch_upload_sessions` / `batch_upload_files`
(`20250720000003_batch_upload_optimization.sql`) and posts each file to
`process-receipt` (`src/services/receiptService.ts:1940`). No repo migration
creates `batches` or `batch_items`.

In the 2026-11-24 hosted observation, the legacy `process-batch-item` Edge Function
had `verify_jwt: false`, version 77, last updated 2025-04-16. It is **not tracked
in this repository** and its deployed source could not be retrieved because its
deployment metadata was missing. Do not redeploy or delete it during this
cutover. At the time, no repository or hosted database invocation was found;
verify the current state before relying on that observation.

If the trigger remains unattached, the empty config table does **not** block
existing batch uploads, and leaving it empty is safe. Do not point it at a
hostname until a trigger is
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

For a future rollout, record the constraint and function shapes before pushing,
and keep the window open through frontend cache invalidation and smoke tests.
For the 2026-11-25 rollout, the push and frontend deployment already happened;
cache invalidation remains unverified and both fresh and cached tab tests remain
incomplete. Verify them rather than treating the ideal sequence as history.

1. For a future push, record the hosted constraint shapes beforehand. The restore migration
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

   The applied restore replaces the canonical
   `mark_billing_reminder_sent(uuid,boolean,text)` without explicit
   `billing_email_status` casts. The observed hosted status column is varchar;
   the restore's failure-branch `CASE` assigns text. Do not infer enum-schema
   compatibility from the absence of casts. PR #266 remains open; check any
   follow-up migration's status and implementation separately. If the hosted
   signature differs, stop and inspect before continuing; do not create a
   second overload blindly.

3. For a future rollout, deploy the frontend build in the same window after the
   database push, then invalidate the Vercel/CDN cache. For the 2026-11-25
   rollout, the frontend was deployed before the push and cache invalidation is
   unverified. Confirm or perform the authorized invalidation. The restore keeps
   the legacy `get_billing_preferences(uuid)` as a self-scoped compatibility
   alias, so already-open tabs and cached bundles can load their own preferences;
   the new build uses `get_my_billing_preferences()` and quiet-hours fields. Do
   not remove the legacy alias until the cache window has closed and telemetry
   shows no legacy calls.

4. Complete the outstanding smoke tests: open Settings → Billing in a fresh tab
   and in an old/cached tab. Both must load preferences; saving must not
   overwrite stored values with defaults. If the old tab fails with `42501`,
   stop and verify the alias grant and the authenticated self-scope check before
   proceeding.

5. Confirm the legacy billing RPCs are no longer callable by browser roles.
   `20261103000000_restore_billing_schema_drift.sql` revokes `PUBLIC`, `anon`
   and `authenticated` execute on every overload of a broad billing RPC list,
      including four functions observed on hosted before the push:
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

Schema alone does not establish the deployed application contract. A historical
pre-push observation found production Edge Functions at 2025-09-02 builds,
while the deployed frontend already called `change_plan` and `resume`. An Edge
Function deployment was recorded on 2026-11-25. Check the current deployed
versions and verify the application behavior; the record is not fresh
validation. If deployment is still required, deploy from the authorized merged
commit:

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
