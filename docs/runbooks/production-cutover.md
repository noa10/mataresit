# Production cutover — PR #234 billing migrations

Run only with owner authorization, a maintenance window, and a fresh backup.
This is the sanctioned path (`supabase` CLI + linked project), not direct
database access.

## Preconditions

- PR #234 is merged to `main` (apply migrations from the merged commit).
- Stripe is still in test mode; do not switch to live keys in the same window.
- The four exposed `service_role` literals are rotated/revoked and the tree is
  clean (`git status`).
- You have the production database password and are logged in to the Supabase
  CLI (`supabase projects list` shows `autoreceipt`).

## 1. Preflight

```bash
git switch main && git pull
set -a; . ./.env.local; set +a   # supplies SUPABASE_DB_PASSWORD

supabase link --project-ref mpmkbtsufihzdelrlszs
supabase migration list --linked
```

`migration list` must show exactly these three as pending and nothing else:

```
20261104000000  stripe_production_hardening
20261104000001  batch_item_vault_trigger
20261106000000  stripe_checkout_locks_and_payment_fencing
```

If anything else is pending or the local/remote history disagrees, stop. Do not
run `supabase db reset --linked` under any circumstance.

Dry run:

```bash
supabase db push --linked --dry-run
```

## 2. Apply

```bash
supabase db push --linked
supabase migration list --linked   # all three now applied
```

## 3. Vault secret

Dashboard → Database → Vault → **New secret**:

- name: `service_role_key`
- value: the production service-role key from Project Settings → API

There must be exactly one row with that name; the batch trigger counts rows and
fails closed otherwise. Never put the value in a file, a migration, or chat.

## 4. Verification

In the Dashboard SQL editor:

```sql
select count(*) from vault.decrypted_secrets where name = 'service_role_key'; -- 1
select column_name from information_schema.columns
 where table_schema='public' and table_name='profiles'
   and column_name in ('next_billing_date','payment_method_brand','payment_method_last_four');
select to_regclass('public.stripe_checkout_locks'),
       to_regclass('public.stripe_webhook_events'),
       to_regclass('public.stripe_subscription_event_order');
```

Confirm the `handle_new_batch_item` trigger is attached to `batch_item_dispatch`
as expected in this environment (the migration replaces the function, not the
trigger), and that `batch_item_dispatch_config` has the environment's endpoint
row.

Smoke test with a test-mode event (never a live charge): send one
`customer.subscription.updated` event to the deployed `stripe-webhook` and
confirm a `stripe_webhook_events` row reaches `processed` and the profile row is
fenced correctly.

## 5. Rollback

Migrations are forward-only. Take a database backup before step 2. To roll back
application code, revert the merge; to roll back schema, restore the backup and
re-apply only the migrations you intend. Do not attempt `db reset` on the linked
project.
