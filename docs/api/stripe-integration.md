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

Two migrations must be applied, in order:

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

Before the first migration: export `payment_history` and reconcile duplicate
payment intent IDs against Stripe. After it: backfill `billing_interval` from
Stripe, since the column is NULL until reconciled and the UI cannot otherwise
report annual subscriptions correctly.

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
`apply_fenced_stripe_subscription_event`: that RPC locks the claim row and
checks its token, processing status, and unexpired lease **in the same
transaction** as the profile update. The row lock prevents another delivery
from reclaiming that event during the transaction; it does not impose a hard
wall-clock deadline on a transaction that continues past its lease expiry. The
RPC also records an event timestamp per
subscription, but that does not reliably order events from different
subscriptions, invoice handlers, or administrative updates. Stripe event IDs
are not a chronological tie-breaker for events created in the same second;
distinct events with the same timestamp are rejected for manual reconciliation.
Older events are also rejected rather than acknowledged as stale, so they can
retry until Stripe's retry window expires. An expired or superseded claim or a
returned RPC error causes the handler to fail and Stripe to retry.

This is **single-active-claim, not exactly-once** for external effects. Emails,
audit rows, payment-history inserts, reminder scheduling, and renewal-tracking
RPCs happen outside the fenced profile transaction; they remain at-least-once
and must each stay independently idempotent. A worker that has already
committed those effects can lose its lease before completing, so nonproduction
concurrency testing is required before cutover. Required database writes now
throw on returned `{ error }` values; optional notification and audit failures
are logged rather than retried.

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
  subscription among the first 10. Simultaneous requests can still create
  duplicate customers and open Checkout Sessions, both of which can complete,
  so duplicate subscriptions remain a blocker.
- Existing subscribers use `manage-subscription` action `change_plan`.
  Upgrades and interval changes apply immediately with proration. Downgrades
  default to a Stripe subscription schedule at the current period end. A
  subscription already scheduled to cancel must be resumed before scheduling a
  paid-tier downgrade.
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
