# Billing System Deployment and Testing Guide

## Overview

This guide provides step-by-step instructions for deploying and testing the Mataresit billing system. Follow these procedures to ensure a successful deployment with comprehensive validation.

## Pre-Deployment Checklist

### Environment Requirements

- [ ] Supabase project with PostgreSQL 15+
- [ ] Stripe account with API keys
- [ ] Email service provider (configured)
- [ ] Node.js 18+ for local development
- [ ] Supabase CLI installed and configured

### Configuration Verification

- [ ] Environment variables configured
- [ ] Database connection established
- [ ] Stripe webhook endpoint configured
- [ ] Email service API keys validated
- [ ] Frontend build configuration updated

## Stripe Production Cutover

**Blocked:** The database half is now locally verified; the Stripe lifecycle is
not. On 2026-11-06 the five billing SQL suites
(`stripe_webhook_claim_fencing`, `payment_state_fencing`,
`stripe_checkout_locks`, `profile_billing_column_protection`,
`batch_item_dispatch_config`) passed against a disposable PostgreSQL 15
database built from a curated baseline (initial schema plus the subscription
and billing-schema migrations) and the three hardening migrations (see
`Verification status` below). CI is wired through the `sql-regression` job but
has not been observed on this branch.

Still blocking cutover:

- Live/test-mode Stripe lifecycle behavior — Checkout, upgrade/proration
  collection, cancel/resume, interval switch, payment failure/dunning, 3DS,
  replayed and out-of-order webhook delivery, and a worker paused past its
  lease — has not been exercised.
- Two-session checkout-lock and webhook-claim races are not covered by the
  single-session SQL suites.
- Paid upgrades still sync the target tier before the proration invoice is
  collected (see the proration limitation in `docs/api/stripe-integration.md`).
- Legacy service-role JWT revocation/rotation and production Vault creation
  require dashboard or management access and are not verified here.
- The app-wide TypeScript baseline remains non-zero; CI's root `tsc` command
  check is not evidence. Only the billing-specific diagnostics were fixed.

### Verification status

Local SQL execution (2026-11-06):

```bash
bash .github/sql-regression/run-sql-regression.sh
```

The tracked runner creates a loopback-only `postgres:15-alpine` container,
applies a curated production-shaped baseline plus
`20261104000000_stripe_production_hardening.sql`,
`20261104000001_batch_item_vault_trigger.sql`, and
`20261106000000_stripe_checkout_locks_and_payment_fencing.sql`, then runs the
five suites. All five exited 0. The full historical migration chain is **not**
replayed: it contains remote placeholders and out-of-band schema drift, so it
is not a valid bootstrap.

The baseline is `20231126000000_initial_schema.sql`, then
`20250115000000_add_subscription_schema.sql`,
`20250120000000_fix_profiles_insert_policy.sql`, and
`20250722000000_enhance_billing_system_schema.sql`, plus a two-line
`email`-column shim. `.github/sql-regression/bootstrap.sql` substitutes the
Supabase platform pieces those migrations assume: it creates the `anon`,
`authenticated`, and `service_role` roles, `auth.uid()` / `auth.role()` shims
(only when absent), a minimal `auth.users` table, a `vault.decrypted_secrets`
placeholder, and a `pg_net` stub that raises instead of delivering HTTP. Read
"production-shaped" as "matches the billing table and function contract", not
"identical to production".

The `invitation-auth-regression` CI job continues to own
`supabase/tests/invitation_acceptance_auth.sql` separately.

CI status: `sql-regression` is wired in `.github/workflows/supabase-validate.yml`
and runs the same runner. Executing it requires a push; the local run above is
the execution evidence for this branch.

Complete these steps in order before switching to live Stripe keys. Do not skip
the migration; the Edge Functions call RPCs and columns it creates.

- [ ] Create the Vault secret named `service_role_key` (Dashboard → Database →
      Vault). Never commit or log its value. Check that exactly one entry exists.
      Treat any previously exposed credential as compromised; redacting the
      repository does not rotate or revoke it. Verify revocation using
      Supabase's supported process without exposing the value. The credential
      inventory as of this branch (all redacted in the working tree, all still
      present in Git history):

      | Location | Kind |
      |---|---|
      | `20250503181349_remote_schema.sql` | legacy service-role JWT literal |
      | `docs/troubleshooting/WEBHOOK_DEBUGGING_GUIDE.md` | legacy service-role JWT literal |
      | `scripts/apply-missing-migrations.ts` | embedded fallback service-role key |
      | `scripts/apply-quality-metrics-migration.ts` | embedded fallback service-role key |
      | `scripts/setup-test-environment.js` | embedded service-role key constant |
      | `tools/debug/check-receipts.js` | embedded service-role key constant |

      Several scripts and test fixtures also contain `anon` JWTs. Those are
      public by design and are not part of the revocation gate, but they should
      be replaced with environment reads as they are touched.
      Legacy service-role JWTs are tied to the legacy JWT signing secret; plan
      any rotation or revocation with the [Supabase signing-key guide](https://supabase.com/docs/guides/auth/signing-keys),
      since it also affects other legacy keys and tokens. Replaying that
      historical migration installs a trigger with an invalid placeholder until
      the Vault-backed trigger migration is applied.
- [ ] Plan a batch-processing maintenance window. Confirm the existing
      `handle_new_batch_item` trigger attachment and timing in nonproduction:
      the migration replaces the function but does not create a trigger. The
      function returns `NEW`, so a BEFORE attachment no longer cancels the row;
      timing still decides whether dispatch is enqueued before or after commit.
- [ ] Apply the hardening migrations, in order:
      `20261104000000_stripe_production_hardening.sql` (billing columns,
      billing-field guard, service-only billing RPCs, fenced subscription-event
      RPC, webhook idempotency RPCs, payment-history uniqueness),
      `20261104000001_batch_item_vault_trigger.sql` (Vault-backed batch trigger),
      and `20261106000000_stripe_checkout_locks_and_payment_fencing.sql`
      (per-user checkout ownership, fenced payment/invoice-failure/status and
      renewal-tracking RPCs, receipt usage counter RPC + trigger, lazy monthly
      usage reset). The first aborts if duplicate payment intent IDs exist; the
      second aborts if exactly one Vault secret is not present.
- [ ] Schedule the monthly usage reset: `reset_monthly_usage()` is not
      scheduled anywhere in the application. The lazy reset inside
      `increment_receipts_used` keeps the counter correct for anyone who
      uploads after the month boundary; scheduling the function with pg_cron
      is what refreshes the displayed counter for users who upload nothing in
      a given month.
- [ ] Reconciliation is user-initiated only: admin syncs through
      `manage-subscription` remain unfenced by design. Do not run Stripe
      dashboard mutations in parallel with a user's own plan change — on those
      unfenced paths the last write wins.
- [ ] Immediately after the second migration, have a trusted database
      administrator configure the current environment's HTTPS endpoint. Verify
      the hostname belongs to that environment before executing the following
      example; never use the production hostname in a nonproduction environment:

      ```sql
      INSERT INTO public.batch_item_dispatch_config (singleton, endpoint_url)
      VALUES (true, 'https://YOUR_PROJECT.supabase.co/functions/v1/process-batch-item')
      ON CONFLICT (singleton) DO UPDATE SET endpoint_url = EXCLUDED.endpoint_url;
      ```

      The table is owned by `postgres`, has row-level security enabled, and is
      inaccessible to `PUBLIC`, `anon`, `authenticated`, and `service_role`.
      Only trusted database administrators should own it or receive privileges
      on it. Batch inserts invoking the trigger fail until it is configured.
      Test batch dispatch in nonproduction before resuming processing. An
      asynchronous enqueue does not prove delivery.
- [ ] Export `payment_history` before the first migration; reconcile duplicates
      against Stripe rather than deleting them.
- [ ] Reconcile existing subscriptions from Stripe. `billing_interval` is NULL
      until reconciled, so annual and scheduled-cancellation state must be
      backfilled before the UI can be trusted to report it.
- [ ] After applying the migrations, regenerate and commit frontend types into
      the file the browser client actually imports:
      `supabase gen types typescript --remote > src/types/supabase.ts`
      (`src/integrations/supabase/client.ts` imports `Database` from
      `src/types/supabase`; `src/integrations/supabase/types.ts` is stale and
      unused). This command targets the linked project; run it only in the
      authorized environment. Until the migrations are applied the generated
      types lack the new columns, so do not commit a regenerated file before
      then. The billing settings screen currently uses local row interfaces for
      the two missing objects, so type generation does not block local
      verification.
- [ ] Set Supabase Edge Function secrets: `STRIPE_SECRET_KEY`,
      `STRIPE_WEBHOOK_SECRET`, and all four live price IDs
      (`STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`,
      `STRIPE_MAX_MONTHLY_PRICE_ID`, `STRIPE_MAX_ANNUAL_PRICE_ID`).
- [ ] Set Vercel environment variables: `VITE_STRIPE_PUBLIC_KEY` and the four
      `VITE_STRIPE_*_PRICE_ID` values. These must be the same live prices as the
      Edge Function secrets.
- [ ] Confirm `supabase/config.toml` contains
      `[functions.stripe-webhook] verify_jwt = false`.
- [ ] Deploy `stripe-webhook` with `--no-verify-jwt`, and deploy
      `create-checkout-session` and `manage-subscription`.
- [ ] In Stripe, register the live webhook endpoint and the events listed in
      `docs/api/stripe-integration.md`.
- [ ] Verify in Stripe test mode using a test clock: new monthly and annual
      checkout, upgrade, period-end downgrade, cancel, resume, interval switch,
      failed payment, duplicate webhook delivery, out-of-order subscription and
      payment events, a worker paused past its webhook lease, and a required
      billing RPC returning an error. Confirm the DB tier and
      `cancel_at_period_end` after each step and verify that rejected stale
      writes leave profile state unchanged. For checkout ownership: double
      clicking "Upgrade" returns the same Checkout Session, two concurrent
      checkout requests create one Stripe customer and one session, and a
      completed session releases the lock before the next checkout starts.
      Separately perform controlled live-mode verification after cutover.
- [ ] Do not use the Stripe Customer Portal as the only cancellation path; the
      app now has in-app cancel and resume.

## Deployment Steps

### 1. Database Migration

Deploy the comprehensive billing system database schema:

```bash
# Navigate to project root
cd /path/to/mataresit

# Apply database migrations
supabase db push

# Verify migration success
supabase db diff
```

**Expected Output:**
- All billing tables created successfully
- Indexes and constraints applied
- RLS policies enabled
- Database functions deployed

**Verification Commands:**
```sql
-- Check table creation
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'billing_%';

-- Verify RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename LIKE 'billing_%';

-- Test database functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%billing%';
```

### 2. Edge Functions Deployment

Deploy all billing system Edge Functions:

```bash
# Deploy auto-renewal function
supabase functions deploy billing-auto-renewal

# Deploy email scheduler
supabase functions deploy email-scheduler

# Deploy enhanced email sender
supabase functions deploy send-email

# Deploy monitoring system
supabase functions deploy billing-monitor

# Deploy alerting system
supabase functions deploy billing-alerting

# Deploy health check cron job
supabase functions deploy billing-health-check

# Deploy test suite
supabase functions deploy billing-test-suite
```

**Verification:**
```bash
# List deployed functions
supabase functions list

# Test function accessibility
curl -X POST "${SUPABASE_URL}/functions/v1/billing-monitor" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_health_metrics"}'
```

### 3. Webhook Configuration

Configure Stripe webhooks for billing system integration:

```bash
# Using Stripe CLI (recommended for development)
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# For production, configure webhook endpoint in Stripe Dashboard:
# Endpoint URL: https://your-project.supabase.co/functions/v1/stripe-webhook
```

**Required Webhook Events:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `invoice.payment_action_required`
- `invoice.upcoming`
- `invoice.finalized`
- `payment_method.attached`
- `payment_method.detached`
- `setup_intent.succeeded`

### 4. Cron Job Setup

Configure automated health monitoring:

```bash
# For production deployment, set up cron job
# Add to crontab (every 5 minutes):
*/5 * * * * curl -X POST https://your-project.supabase.co/functions/v1/billing-health-check \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}' > /dev/null 2>&1
```

**Alternative: Supabase Cron (if available):**
```sql
-- Create cron job for health checks
SELECT cron.schedule('billing-health-check', '*/5 * * * *', 
  'SELECT net.http_post(
    url := ''https://your-project.supabase.co/functions/v1/billing-health-check'',
    headers := ''{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '", "Content-Type": "application/json"}'',
    body := ''{}''
  );'
);
```

### 5. Frontend Integration

Update frontend configuration and deploy UI components:

```bash
# Build frontend with updated configuration
npm run build

# Deploy to hosting platform
npm run deploy
```

**Configuration Updates:**
```typescript
// Update environment variables
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_key
```

## Post-Deployment Testing

### 1. Automated Test Suite

Run the comprehensive billing system test suite:

```bash
# Using Supabase client
supabase functions invoke billing-test-suite --data '{
  "action": "run_all_tests",
  "test_config": {
    "test_user_id": "test-user-deployment",
    "include_cleanup": true,
    "generate_test_data": true
  }
}'
```

**Expected Results:**
- All test suites pass (100% success rate)
- Email templates render correctly
- Auto-renewal logic functions properly
- Payment processing works as expected
- Monitoring system is operational

### 2. Manual Testing Procedures

#### Email Template Testing

```bash
# Test email template rendering
curl -X POST "${SUPABASE_URL}/functions/v1/send-email" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "template_name": "upcoming_renewal",
    "template_data": {
      "recipientName": "Test User",
      "subscriptionTier": "pro",
      "renewalDate": "2024-01-01T00:00:00Z",
      "amount": 29.99,
      "currency": "usd"
    },
    "preview_mode": true
  }'
```

#### Auto-Renewal Testing

```bash
# Test auto-renewal configuration
curl -X POST "${SUPABASE_URL}/functions/v1/billing-auto-renewal" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "configure_auto_renewal",
    "userId": "test-user-id",
    "enabled": true,
    "frequency": "monthly"
  }'
```

#### Monitoring System Testing

```bash
# Test health metrics
curl -X POST "${SUPABASE_URL}/functions/v1/billing-monitor" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "get_health_metrics",
    "timeframe": "24h"
  }'
```

### 3. Integration Testing

#### Stripe Webhook Testing

```bash
# Test webhook processing with Stripe CLI
stripe trigger customer.subscription.created

# Verify webhook processing in logs
supabase functions logs stripe-webhook
```

#### End-to-End Workflow Testing

1. **Create a test user** through Supabase Auth in the isolated test project.
   Record the user's UUID for the following checks.

2. **Verify default billing preferences:**
   ```sql
   SELECT * FROM public.billing_preferences
   WHERE user_id = '00000000-0000-0000-0000-000000000000'::uuid;
   ```
   Replace the example UUID with the test user's UUID. The Auth user creation
   trigger creates the preferences row; preserve any settings already present.

3. **Schedule Billing Reminders:**
   ```bash
   curl -X POST "${SUPABASE_URL}/functions/v1/email-scheduler" \
     -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "schedule_billing_reminders",
       "userId": "test-user-e2e",
       "subscriptionId": "test-sub-e2e",
       "renewalDate": "2024-01-01T00:00:00Z"
     }'
   ```

4. **Verify Email Scheduling:**
   ```sql
   SELECT * FROM billing_email_schedule 
   WHERE user_id = 'test-user-e2e';
   ```

5. **Test Email Processing:**
   ```bash
   curl -X POST "${SUPABASE_URL}/functions/v1/email-scheduler" \
     -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "process_scheduled_emails",
       "limit": 10
     }'
   ```

## Performance Testing

### Load Testing

Test system performance under load:

```bash
# Install artillery for load testing
npm install -g artillery

# Create load test configuration
cat > billing-load-test.yml << EOF
config:
  target: '${SUPABASE_URL}'
  phases:
    - duration: 60
      arrivalRate: 10
  defaults:
    headers:
      Authorization: 'Bearer ${SERVICE_ROLE_KEY}'
      Content-Type: 'application/json'

scenarios:
  - name: 'Health Metrics'
    weight: 50
    flow:
      - post:
          url: '/functions/v1/billing-monitor'
          json:
            action: 'get_health_metrics'
            timeframe: '24h'
  
  - name: 'Email Template Preview'
    weight: 30
    flow:
      - post:
          url: '/functions/v1/send-email'
          json:
            to: 'test@example.com'
            template_name: 'upcoming_renewal'
            template_data:
              recipientName: 'Load Test User'
              subscriptionTier: 'pro'
            preview_mode: true
  
  - name: 'Auto-Renewal Check'
    weight: 20
    flow:
      - post:
          url: '/functions/v1/billing-auto-renewal'
          json:
            action: 'check_subscription_health'
            userId: 'load-test-user'
EOF

# Run load test
artillery run billing-load-test.yml
```

### Database Performance Testing

```sql
-- Test query performance
EXPLAIN ANALYZE SELECT * FROM billing_preferences WHERE user_id = 'test-user';
EXPLAIN ANALYZE SELECT * FROM billing_email_schedule WHERE status = 'scheduled';
EXPLAIN ANALYZE SELECT * FROM billing_audit_trail WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Check index usage
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
FROM pg_stat_user_indexes 
WHERE schemaname = 'public' AND tablename LIKE 'billing_%';
```

## Monitoring and Validation

### 1. System Health Validation

```bash
# Check overall system health
curl -X POST "${SUPABASE_URL}/functions/v1/billing-monitor" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"action": "trigger_health_check"}' | jq '.'
```

### 2. Alert System Validation

```bash
# Test alert creation
curl -X POST "${SUPABASE_URL}/functions/v1/billing-alerting" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_alert",
    "alert_type": "deployment_test",
    "severity": "low",
    "title": "Deployment Test Alert",
    "message": "Testing alert system after deployment",
    "component": "test"
  }'

# Verify alert was created
curl -X POST "${SUPABASE_URL}/functions/v1/billing-monitor" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_system_alerts"}' | jq '.alerts'
```

### 3. Audit Trail Validation

```sql
-- Check audit trail is working
SELECT event_type, event_description, created_at 
FROM billing_audit_trail 
ORDER BY created_at DESC 
LIMIT 10;

-- Verify webhook events are logged
SELECT event_type, COUNT(*) 
FROM billing_audit_trail 
WHERE triggered_by = 'stripe_webhook' 
GROUP BY event_type;
```

## Rollback Procedures

### Emergency Rollback

If critical issues are discovered:

1. **Disable Cron Jobs:**
   ```bash
   # Remove cron job
   crontab -e
   # Comment out billing-health-check line
   ```

2. **Revert Edge Functions:**
   ```bash
   # Deploy previous version
   git checkout previous-version
   supabase functions deploy billing-auto-renewal
   supabase functions deploy email-scheduler
   # ... deploy other functions
   ```

3. **Database recovery:** Do not reset the production database or replay old
   migrations as a rollback. Assess the impact, preserve the affected data, and
   prepare a reviewed forward migration or a tested backup-recovery procedure.
   Apply it only after confirming the target environment and obtaining approval.

### Partial Rollback

For specific component issues:

```bash
# Rollback specific function
git checkout HEAD~1 -- supabase/functions/billing-auto-renewal/
supabase functions deploy billing-auto-renewal

# Disable specific features
UPDATE billing_preferences SET auto_renewal_enabled = false;
```

## Production Checklist

### Pre-Go-Live

- [ ] All tests pass (100% success rate)
- [ ] Performance testing completed
- [ ] Security audit completed
- [ ] Monitoring alerts configured
- [ ] Backup procedures tested
- [ ] Rollback procedures documented
- [ ] Team training completed

### Go-Live

- [ ] Deploy during maintenance window
- [ ] Monitor system health continuously
- [ ] Verify webhook processing
- [ ] Check email delivery rates
- [ ] Validate payment processing
- [ ] Confirm monitoring alerts

### Post-Go-Live

- [ ] 24-hour monitoring period
- [ ] Performance metrics review
- [ ] User feedback collection
- [ ] System optimization based on real usage
- [ ] Documentation updates

## Troubleshooting

### Common Issues

1. **Function Deployment Failures:**
   ```bash
   # Check function logs
   supabase functions logs function-name
   
   # Verify environment variables
   supabase secrets list
   ```

2. **Database Connection Issues:**
   ```bash
   # Test database connection
   supabase db ping
   
   # Check connection pool
   SELECT * FROM pg_stat_activity;
   ```

3. **Webhook Processing Failures:**
   ```bash
   # Check webhook logs
   supabase functions logs stripe-webhook
   
   # Verify webhook signature
   stripe webhooks list
   ```

4. **Email Delivery Issues:**
   ```bash
   # Check email scheduler logs
   supabase functions logs email-scheduler
   
   # Verify email service configuration
   curl -X POST "${SUPABASE_URL}/functions/v1/send-email" \
     -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
     -d '{"to": "test@example.com", "subject": "Test", "text": "Test", "preview_mode": true}'
   ```

### Support Contacts

- **Technical Issues**: Use built-in monitoring and alerting system
- **Performance Issues**: Check system health metrics
- **Integration Issues**: Review webhook and API logs
- **User Issues**: Check billing preferences and audit trail

## Maintenance Schedule

### Daily
- Monitor system health metrics
- Review alert status
- Check email delivery rates

### Weekly
- Analyze performance trends
- Review audit trail for anomalies
- Update documentation as needed

### Monthly
- Comprehensive system testing
- Performance optimization review
- Security audit and updates

This deployment guide ensures a successful and reliable billing system deployment with comprehensive testing and monitoring capabilities.
