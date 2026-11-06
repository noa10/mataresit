# Stripe Integration Documentation

This document outlines the complete Stripe integration implementation for the ReceiptScan application.

## Overview

The Stripe integration provides subscription-based billing with three tiers:
- **Free**: 50 receipts/month, 1GB storage, 7-day retention
- **Pro**: 500 receipts/month, 10GB storage, 90-day retention (RM 10/month or RM 108/year)
- **Max**: Unlimited receipts, unlimited storage, 1-year retention (RM 20/month or RM 216/year)

The UI and Stripe prices must use the same currency. Confirm the currency of the
live Stripe prices before switching keys; the UI displays MYR.

## Architecture

### Frontend Components
- **StripeContext**: React context for Stripe operations
- **PricingPage**: Updated with Stripe checkout integration
- **PaymentSuccessPage**: Handles post-payment flow
- **SubscriptionStatus**: Displays current plan and usage
- **useSubscription**: Custom hook for subscription management

### Backend Components
- **Supabase Edge Functions**:
  - `create-checkout-session`: Creates Stripe checkout sessions
  - `stripe-webhook`: Handles Stripe webhook events
  - `manage-subscription`: Subscription management operations

### Database Schema
- **subscription_limits**: Defines limits for each tier
- **payment_history**: Stores payment transaction history
- **profiles**: Extended with subscription fields

## Setup Instructions

### 1. Environment Variables

Create a `.env` file with the following variables:

```env
# Frontend (Vite)
VITE_STRIPE_PUBLIC_KEY=pk_test_your_stripe_public_key
VITE_STRIPE_PRO_MONTHLY_PRICE_ID=price_pro_monthly_id
VITE_STRIPE_PRO_ANNUAL_PRICE_ID=price_pro_annual_id
VITE_STRIPE_MAX_MONTHLY_PRICE_ID=price_max_monthly_id
VITE_STRIPE_MAX_ANNUAL_PRICE_ID=price_max_annual_id
```

### 2. Supabase Secrets

Set these secrets in your Supabase project. Live mode requires all four price
IDs; the Edge Functions fail closed when a live price ID is missing instead of
downgrading the subscriber to free.

```bash
# Backend (Supabase Edge Functions)
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRO_MONTHLY_PRICE_ID=price_... \
  STRIPE_PRO_ANNUAL_PRICE_ID=price_... \
  STRIPE_MAX_MONTHLY_PRICE_ID=price_... \
  STRIPE_MAX_ANNUAL_PRICE_ID=price_...
```

The `handle_new_batch_item()` database trigger reads the service-role key from
Supabase Vault. Create a Vault secret named `service_role_key` in
**Dashboard → Database → Vault**. Do not put the key in a migration, a tracked
file, or the frontend environment.

Billing Edge Functions use the injected `SUPABASE_SERVICE_ROLE_KEY`. Do not
replace it with a new-format `sb_secret_...` key: these functions pin
supabase-js 2.7.1, which sends the key as a Bearer token, and the platform
rejects a non-JWT bearer when JWT verification is enabled. Migrating to
`sb_secret_...` requires upgrading supabase-js and sending the key on the
`apikey` header only. `SERVICE_ROLE_KEY` is used only as a fallback when the
built-in variable is absent.

### 3. Database Migration

Three migrations must be applied, in order:

- `supabase/migrations/20261104000000_stripe_production_hardening.sql` — adds
  `billing_interval` / `cancel_at_period_end`, guards billing columns on INSERT
  and UPDATE, restricts billing RPCs to the service role, creates
  `stripe_webhook_events` plus the atomic claim/complete RPCs, and enforces
  payment-history uniqueness. It **aborts** if duplicate payment intent IDs
  exist, rather than deleting rows.
- `supabase/migrations/20261104000001_batch_item_vault_trigger.sql` — moves
  `handle_new_batch_item()` off the hardcoded credential onto Vault. It requires
  exactly one `service_role_key` Vault entry. After migration, a trusted database
  administrator must insert or update the singleton row in
  `public.batch_item_dispatch_config`, setting `endpoint_url` to the environment's
  HTTPS URL ending in `/functions/v1/process-batch-item`. The table is owned by
  postgres, has RLS enabled, and grants no privileges to PUBLIC, anon,
  authenticated, or service_role. Batch-item inserts fail until the URL is
  configured; schedule a maintenance window. The migration does not validate the
  endpoint before applying.
- `supabase/migrations/20261106000000_stripe_checkout_locks_and_payment_fencing.sql`
  — adds `stripe_checkout_locks` and the checkout ownership RPCs, the
  service-only receipt-usage counter and trigger, and the fenced
  payment/renewal/status/profile RPCs used by the webhook.

Before the first migration: export `payment_history` and reconcile duplicate
payment intent IDs against Stripe. After it: backfill `billing_interval` from
Stripe, since the column is NULL until reconciled and the UI cannot otherwise
report annual subscriptions correctly.

#### Verification status

The five billing SQL suites in `supabase/tests/` (`stripe_webhook_claim_fencing`,
`payment_state_fencing`, `stripe_checkout_locks`,
`profile_billing_column_protection`, and `batch_item_dispatch_config`) were
executed successfully on 2026-11-06 against a disposable PostgreSQL 15
database. The runner builds it from `20231126000000_initial_schema.sql`, three
intermediate billing migrations, a two-line `email`-column shim, and the three
migrations above. `bootstrap.sql` substitutes the platform pieces: roles,
`auth.uid()` / `auth.role()` shims (created only when absent), a minimal
`auth.users` table, a `vault.decrypted_secrets` placeholder, and a `pg_net`
stub that raises instead of delivering HTTP. The contract under test is the
billing tables and functions, not a byte-identical production schema. Run the
suites with:

```bash
bash .github/sql-regression/run-sql-regression.sh
```

The runner creates a loopback-only `postgres:15-alpine` container, applies the
curated schema, and removes the container on exit. It then runs
`.github/sql-regression/two-session-races.sh` on the same target: two real
connections race `try_acquire_checkout_lock` and `claim_stripe_webhook_event`,
and the harness asserts one owner, one claim, owner-scoped bind/release, stale
token rejection, and expired-lock stealing. The `sql-regression` CI job runs
both. CI execution is observed on `a316a8c` and later commits.

These suites are single-session. Two-session checkout-lock and webhook-lease
races, live Stripe lifecycle behavior (Checkout, proration collection,
cancellation, dunning, 3DS), and webhook forwarding remain user-gated
nonproduction checks before cutover.

### 3b. Webhook idempotency

`claim_stripe_webhook_event` is a single atomic `INSERT ... ON CONFLICT`, so at
most one delivery holds an active lease. The webhook returns:

- `200` with `duplicate: true` for an already-processed event,
- `409` while another delivery holds the lease (Stripe retries),
- `500` when a handler throws or the idempotency store fails (Stripe retries).

Failed events and expired leases can be reclaimed regardless of the attempt
count, including an expired fifth lease. `last_error` records the latest failure
when completion succeeds. Unexpected legacy `exhausted` results fail closed rather
than acknowledging unprocessed work. Stripe's own retry window still applies.

Completion is fenced by a per-claim token, so a slow worker cannot mark a newer
claim processed. Webhook subscription-state updates additionally call
`apply_fenced_stripe_subscription_event`: that RPC locks the claim row, checks
its token and processing status, and renews the lease by five minutes **in the
same transaction** as the profile update. The row lock prevents another
delivery from reclaiming that event during the transaction, and the renewal
keeps a handler that is still working from being reclaimed for the next five
minutes. An expired lease is rejected, not renewed; an owner that lost its
lease cannot resurrect it. The RPC also records an event timestamp per
subscription, but that does not reliably order events from different
subscriptions, invoice handlers, or administrative updates. Stripe event IDs
are not a chronological tie-breaker for events created in the same second;
distinct events with the same timestamp are rejected for manual reconciliation.
Older events are also rejected rather than acknowledged as stale, so they can
retry until Stripe's retry window expires. An expired or superseded claim or a
returned RPC error causes the handler to fail and Stripe to retry.

This is **single-active-claim, not exactly-once** for external effects. Emails
and audit rows happen outside the fenced profile transaction; they remain
at-least-once and must each stay independently idempotent. Payment-history
inserts, the grace-period reset, retry-tracking close, payment event ordering,
and renewal tracking (`next_billing_date` / `subscription_renewal_tracking`
via `apply_fenced_renewal_tracking`) are now fenced:
`apply_fenced_stripe_payment_event` (successful payments),
`apply_fenced_renewal_failure` (grace start on failure),
`apply_fenced_profile_status` (`incomplete` / `past_due` status changes), and
`apply_fenced_renewal_tracking` (billing-period bookkeeping) each verify the
claim before writing, and status writes are scoped to the invoice's own
subscription so a late event cannot change a superseded subscription's state.
The payment RPC records the payment row before the order check and skips —
rather than fails — the state advance for one-off, superseded, or out-of-order
payments ('recorded'), so collected money is always recorded and Stripe is not
sent into a permanent retry for a completed fact. Payment history remains
idempotent through the payment intent unique index. A worker that has already
committed external effects can lose its lease before completing, so
nonproduction concurrency testing is required before cutover. Required
database writes throw on returned `{ error }` values; optional notification
and audit failures are logged rather than retried. Residual unfenced webhook
writes, all in `supabase/functions/stripe-webhook/index.ts`:

- `invoice.finalized` (`handleInvoiceFinalized`, ~879-927) updates
  `profiles.next_billing_date` directly.
- `payment_method.attached` / `detached` (~1013-1117) and
  `setup_intent.succeeded` (~1123-1179) update card display fields directly.
- Reminder scheduling and the payment-success/failure/trial-ending emails stay
  outside the fence and remain at-least-once.
- `manage-subscription` admin syncs and the `billing-auto-renewal` cron path
  are administrative and intentionally unfenced.

These are display/bookkeeping writes, not entitlement grants, and are accepted
as best-effort for this PR. The following known limitations remain open and
are **not** claimed as fixed: a paid upgrade can sync the target tier before
Stripe collects the proration invoice (`manage-subscription` `changePlan`);
`handle_renewal_failure` records a hardcoded USD amount (2999/9999 cents) and
resets `payment_retry_attempts` to 1; and `apply_fenced_profile_status` can
still update the display-only status of a profile whose
`stripe_subscription_id` is NULL when a late event for a deleted subscription
arrives. Each needs a dedicated follow-up migration or product decision.

### 3c. Checkout ownership

`stripe_checkout_locks` holds at most one row per user, and
`create-checkout-session` must own that row before it creates a customer or a
Checkout Session:

1. `try_acquire_checkout_lock` is atomic (`INSERT ... ON CONFLICT`). An expired
   row is deleted and the insert retried; a live row reports its bound session
   id instead. Each acquisition returns a `lock_token` identifying the owner.
2. If a session is already bound and still `open` at Stripe **for the same
   plan** (tier + billing interval from its metadata), the endpoint returns
   that same session (`reused: true`) instead of creating a second one. An
   open session for a different plan is expired at Stripe and replaced. The
   `SUBSCRIPTION_EXISTS` guard runs before reuse too, so a session can never
   be handed out next to an existing subscription. A session that completed
   but whose webhook has not released the lock yet returns
   `409 CHECKOUT_IN_PROGRESS`; an expired session lets the caller steal the
   lock and start a new checkout. An inspection failure (including a
   `resource_missing` error, which points at a key or mode mismatch) fails
   closed as `409 CHECKOUT_IN_PROGRESS` rather than freeing the lock.
3. Customer creation runs under the lock with a per-user Stripe idempotency
   key, so concurrent requests cannot create duplicate Stripe customers and
   an ambiguous network failure replays the same customer instead of a second
   one.
4. `bind_checkout_session` ties the lock's expiry to the Checkout Session's
   own `expires_at` (30 minutes), and the acquisition TTL is set higher than
   the session TTL, so a crash between creating the session and binding it
   can never leave a stealable lock while the orphan session is still
   completable. Binding requires a live, unbound lock **and the owner's
   token**.
5. Failure paths release by token; `checkout.session.completed` releases by
   session id before syncing. Both match only the exact row, so a stale
   request or a delayed redelivery cannot free a newer checkout's lock.

This guarantees at most one completable Checkout Session per user for the
normal flow. The residual case is a request that dies between Stripe creating
the session and the bind: the session is completable for its 30-minute
lifetime, but the URL was never returned to any client and the lock outlives
it, so a second session cannot be created until the session is dead. A user
holding the orphaned session URL in another tab could still complete it,
which is why nonproduction checkout-concurrency testing remains a cutover
requirement.

### 3d. Manage-subscription retries

`manage-subscription` mutations (`cancel`, `resume`, `change_plan` /
`downgrade`) accept an `x-idempotency-key` request header. The value must be
8–128 characters of `A–Z`, `a–z`, `0–9`, `_` or `-`; anything else is rejected
with `400` rather than silently ignored. The endpoint scopes the key to the
authenticated user, the action, and that action's parameters before passing it
to Stripe, so one client key reused for a different plan or target cannot
replay another intent's result. The browser client (`StripeContext`) mints one
key per request body and keeps it only while the outcome is ambiguous — a
transport failure or `5xx` retries the same key, while a success or `4xx`
settles it. Clients that send no header keep the previous per-request random
keys, which means an older client can still duplicate a mutation on retry.
Retries of an applied `resume` short-circuit on the fresh Stripe read; retries
of a scheduled downgrade replay the same `subscriptionSchedules.update`
instead of replacing the schedule.

### 3e. Receipt usage counter

`receipts_used_this_month` previously never incremented: the Deno incrementer
called a non-existent client method. The increment is now a service-only RPC
(`increment_receipts_used`) plus an `AFTER INSERT` trigger on `public.receipts`
(`track_receipt_usage`), making the trigger the authoritative counter for
every insert path (web, external API, batch). The increment doubles as the
lazy monthly reset (mirroring `reset_monthly_usage`'s month-start semantics);
`reset_monthly_usage` itself is still not scheduled anywhere, so scheduling it
via pg_cron remains a deployment step (see the billing deployment guide).
Receipts for a user without a profile row are skipped by the trigger instead
of aborting the insert; the explicit RPC keeps strict behavior for its own
callers.

### 4. Stripe Configuration

1. Create products and prices in Stripe Dashboard, then put the price IDs in
   both the Vercel frontend environment and the Supabase Edge Function secrets.
2. Configure webhook endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
3. The webhook must be deployed with JWT verification disabled. Stripe sends a
   `Stripe-Signature` header, not a Supabase JWT. `supabase/config.toml` must
   contain:

   ```toml
   [functions.stripe-webhook]
   verify_jwt = false
   ```

   The handler verifies the Stripe signature itself.
4. Enable these webhook events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `invoice.payment_action_required`
   - `invoice.upcoming`
   - `invoice.finalized`
   - `customer.subscription.trial_will_end`
   - `payment_method.attached`
   - `payment_method.detached`
   - `setup_intent.succeeded`
5. Deploy the billing functions after the database migration:

   ```bash
   supabase db push
   supabase functions deploy stripe-webhook --no-verify-jwt
   supabase functions deploy create-checkout-session manage-subscription
   ```

## Usage

### Creating Subscriptions

```typescript
import { useStripe } from '@/contexts/StripeContext';

const { createCheckoutSession } = useStripe();

// Create checkout session
await createCheckoutSession('price_pro_monthly', 'monthly');
```

### Checking Subscription Limits

```typescript
import { useSubscription } from '@/hooks/useSubscription';

const { checkCanUpload, limits, usage } = useSubscription();

// Check if user can upload more receipts
const canUpload = await checkCanUpload();
```

### Managing Subscriptions

```typescript
import { useStripe } from '@/contexts/StripeContext';

const {
  createPortalSession,
  cancelSubscription,
  resumeSubscription,
  downgradeSubscription,
  upgradeSubscription,
} = useStripe();

// Open Stripe billing portal (payment methods, invoices)
await createPortalSession();

// Cancel at the end of the current billing period
await cancelSubscription();

// Undo a pending cancellation
await resumeSubscription();

// Upgrade Pro -> Max immediately (prorated)
await upgradeSubscription('max', 'monthly');

// Change Max -> Pro at the end of the current billing period
await downgradeSubscription('pro');

// Change billing interval on the same tier
await upgradeSubscription('pro', 'annual');
```

The backend rules are:

- New subscriptions use `create-checkout-session`. Checkout is rejected with
  `409 SUBSCRIPTION_EXISTS` when the customer already has a non-canceled
  subscription among the first 10, both before creating a new session and
  before reusing an open one (which is expired at Stripe when blocked).
  Concurrent requests for one user are serialized by the per-user checkout
  lock: a second request reuses the open session for the same plan, or gets
  `409 CHECKOUT_IN_PROGRESS` while another request is preparing one.
- Existing subscribers use `manage-subscription` action `change_plan`.
  Upgrades and interval changes apply immediately with
  `proration_behavior: 'create_prorations'`. **Known limitation:** the same
  request syncs `profiles.subscription_tier` to the target tier, so a customer
  can receive the higher tier before Stripe collects the proration invoice.
  The safe redesign uses `payment_behavior: 'pending_if_incomplete'` with
  `proration_behavior: 'always_invoice'`, handles
  `customer.subscription.pending_update_applied` / `pending_update_expired`,
  and only grants the tier after Stripe reports the update paid. That redesign
  is not implemented in this branch and remains a pre-production blocker.
  Downgrades default to a Stripe subscription schedule at the current period
  end. A subscription already scheduled to cancel must be resumed before
  scheduling a paid-tier downgrade.
- Cancellation sets `cancel_at_period_end`; resume clears it. Both are
  reflected in `profiles.cancel_at_period_end` immediately, with the webhook as
  the reconciliation path.
- The webhook claims each event atomically in `stripe_webhook_events`: a
  processed event is a 200 duplicate, an actively leased event returns 409 so
  Stripe retries, and a claim-store failure returns 500 instead of processing
  anyway. This is single-active-claim, not exactly-once — emails, audit rows,
  and renewal RPCs remain at-least-once. `payment_history` is unique per payment
  intent.

## Key Features

### Subscription Management
- Automatic tier-based limits enforcement
- Usage tracking and reporting
- Billing portal integration
- Subscription status monitoring

### Payment Processing
- Secure Stripe Checkout integration
- Webhook-based subscription updates
- Payment history tracking
- Failed payment handling

### User Experience
- Real-time usage indicators
- Upgrade prompts when limits reached
- Seamless billing management
- Trial period support

## Security Considerations

1. **API Keys**: Never expose secret keys in frontend code or tracked files.
   The batch trigger reads the service-role key from Supabase Vault.
2. **Webhook Verification**: All webhooks are verified using Stripe signatures;
   the function itself has JWT verification disabled because Stripe does not
   send a Supabase JWT.
3. **User Authorization**: All subscription operations require authentication.
4. **Billing column protection**: A `profiles` trigger rejects changes to
   `subscription_tier`, `subscription_status`, Stripe IDs, and related billing
   columns unless the caller is the service role. The legacy
   `update_subscription_from_stripe` RPC is revoked from `PUBLIC`, `anon`, and
   `authenticated`; only `service_role` can execute it.
5. **Data Isolation**: Users can only access their own subscription data.

## Testing

### Billing SQL suites (local, no hosted project)

```bash
bash .github/sql-regression/run-sql-regression.sh
```

This is the execution evidence used by the `sql-regression` CI job. It builds
a disposable loopback-only PostgreSQL 15 database, applies the curated initial
schema plus the three billing migrations, and runs the five suites. The
existing `invitation-auth-regression` job continues to own
`supabase/tests/invitation_acceptance_auth.sql` on its own bare-Postgres
database; it is not part of this runner.

### Test Cards
Use Stripe test cards for development:
- Success: `4242424242424242`
- Decline: `4000000000000002`
- 3D Secure: `4000002500003155`

### Webhook Testing
Use Stripe CLI for local webhook testing:
```bash
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

Live Stripe lifecycle checks — Checkout concurrency, upgrade/proration
collection, cancel/resume, payment failure and dunning, 3DS, and replayed or
out-of-order webhook delivery — are **not** covered by the SQL suites and
remain user-gated nonproduction tests. Do not mark this integration production
ready on the strength of the SQL run alone.

#### Running the lifecycle checks

Prerequisites (none of these are committed):

- a Stripe **test-mode** secret key (`sk_test_…`) for the project's account;
- the webhook signing secret printed by `stripe listen` (`whsec_…`);
- a local stack whose database already has the three PR migrations.

Create `supabase/functions/.env` with `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET`, start the stack and serve the two billing functions:

```bash
supabase start
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
stripe trigger customer.subscription.updated
```

Scenario matrix, all in test mode with a [test clock](https://docs.stripe.com/billing/testing/test-clocks):

| Scenario | Expected |
|---|---|
| Two `create-checkout-session` calls for one user | one session; the second reuses it or reports `SUBSCRIPTION_EXISTS` |
| Checkout completion | lock released by exact session id; profile tier updated once |
| Upgrade with proration | invoice raised; tier must not exceed the paid tier until collection succeeds |
| Cancel at period end, then resume | cancellation preserved; no tier change until period end |
| `invoice.payment_failed` then recovery | grace/retry rows recorded once per invoice; repeat delivery short-circuits |
| 3DS card `4000002500003155` | session completes after authentication; no duplicate payment row |
| Replay an old event after a newer one | older event is recorded but does not advance state |

The SQL suites cover the fencing primitives behind these scenarios
(`stripe_webhook_claim_fencing`, `payment_state_fencing`,
`stripe_checkout_locks`), and `two-session-races.sh` covers concurrent claims
and lock acquisition. The matrix above is the remaining live-service evidence.

Refuse to run any of it with an `sk_live_` key or against the production
project ref.

## Troubleshooting

### Common Issues

1. **Webhook Failures**
   - A `401 UNAUTHORIZED_NO_AUTH_HEADER` from the Supabase gateway means the
     function was deployed with `verify_jwt = true`. Add the
     `[functions.stripe-webhook]` override to `supabase/config.toml` and deploy
     with `--no-verify-jwt`.
   - Verify webhook secret is correct
   - Check Supabase function logs
   - Ensure webhook URL is accessible

2. **Payment Failures**
   - Check Stripe Dashboard for error details
   - Verify price IDs are correct
   - Ensure customer exists in Stripe

3. **Subscription Sync Issues**
   - Check webhook delivery in Stripe Dashboard
   - Verify database functions are working
   - Manual sync via Stripe API if needed

### Monitoring

Monitor these metrics:
- Subscription conversion rates
- Payment failure rates
- Webhook delivery success
- User upgrade patterns

## Future Enhancements

Potential improvements:
- Proration handling for mid-cycle upgrades
- Usage-based billing for overages
- Enterprise plans with custom pricing
- Multi-currency support
- Dunning management for failed payments
