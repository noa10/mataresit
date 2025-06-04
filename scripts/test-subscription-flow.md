# Subscription Flow Testing Guide

This guide helps you test the complete subscription upgrade flow to ensure both issues are resolved.

## Prerequisites

1. Ensure you have access to:
   - Supabase dashboard
   - Stripe dashboard
   - Application logs
   - Database logs

2. Deploy the updated code:
   ```bash
   # Deploy the updated webhook function
   supabase functions deploy stripe-webhook

   # Apply the database migration
   supabase db push
   ```

## Test Plan

### Phase 1: Verify Webhook Configuration

1. **Check Stripe Webhook Endpoint**
   - Go to Stripe Dashboard > Developers > Webhooks
   - Verify the webhook endpoint is pointing to your Supabase function
   - Ensure these events are enabled:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

2. **Test Webhook Connectivity**
   - In Stripe Dashboard, send a test webhook
   - Check Supabase function logs for incoming events

### Phase 2: Test Subscription Upgrade Flow

1. **Create Test User**
   - Sign up with a test email
   - Verify user profile is created in database

2. **Initial Subscription (Pro Plan)**
   - Navigate to pricing page
   - Subscribe to Pro plan using test card: `4242 4242 4242 4242`
   - Monitor logs during checkout process

3. **Verify Initial Subscription**
   - Check payment success page displays correctly
   - Verify user tier updated to 'pro' in database
   - Test "Manage Subscription" button opens billing portal

4. **Upgrade to Max Plan**
   - From billing portal, upgrade to Max plan
   - Complete payment with test card
   - Monitor webhook logs for subscription update events

5. **Verify Upgrade**
   - Check user tier updated to 'max' in database
   - Verify subscription status is 'active'
   - Test billing portal access again

### Phase 3: Debug Common Issues

#### Issue: Subscription Tier Not Updating

**Debugging Steps:**

1. **Check Webhook Logs**
   ```bash
   # View Supabase function logs
   supabase functions logs stripe-webhook
   ```

2. **Verify Price ID Mapping**
   - Check webhook logs for price ID values
   - Ensure price IDs match those in `mapPriceIdToTier` function
   - Update price IDs if they don't match

3. **Test Database Function Directly**
   ```bash
   # Use the debug script
   node scripts/debug-subscription.js list
   node scripts/debug-subscription.js debug <stripe_customer_id>
   ```

4. **Check Database Logs**
   ```sql
   -- In Supabase SQL Editor
   SELECT * FROM profiles WHERE stripe_customer_id = 'cus_your_customer_id';
   
   -- Check for function execution logs
   SELECT * FROM pg_stat_statements WHERE query LIKE '%update_subscription_from_stripe%';
   ```

#### Issue: Billing Portal Not Opening

**Debugging Steps:**

1. **Check Browser Console**
   - Look for JavaScript errors
   - Verify Stripe context is loaded

2. **Test Portal Session Creation**
   ```javascript
   // In browser console on payment success page
   console.log('Testing portal session...');
   // Click the "Manage Subscription" button and check network tab
   ```

3. **Verify Stripe Customer ID**
   ```sql
   -- Check if user has valid Stripe customer ID
   SELECT id, email, stripe_customer_id FROM profiles WHERE id = 'user_id';
   ```

### Phase 4: End-to-End Verification

1. **Complete Flow Test**
   - Start with free account
   - Upgrade to Pro
   - Verify Pro features work
   - Upgrade to Max
   - Verify Max features work
   - Access billing portal
   - Verify subscription details

2. **Edge Cases**
   - Test failed payments
   - Test subscription cancellation
   - Test reactivation

## Expected Results

### Successful Subscription Upgrade

1. **Webhook Processing**
   ```
   Processing webhook event: customer.subscription.updated
   Processing subscription change for customer cus_xxx: {...}
   Mapping for customer cus_xxx: priceId=price_xxx -> tier=max, status=active
   Successfully updated subscription for customer cus_xxx to tier max with status active
   Verification: Customer cus_xxx profile updated: {...}
   ```

2. **Database State**
   ```sql
   subscription_tier: 'max'
   subscription_status: 'active'
   stripe_subscription_id: 'sub_xxx'
   subscription_start_date: '2025-01-26T...'
   subscription_end_date: '2025-02-26T...'
   ```

3. **Payment Success Page**
   - Displays correct plan information
   - "Manage Subscription" button opens billing portal
   - No JavaScript errors in console

### Troubleshooting

If tests fail, check:

1. **Environment Variables**
   - `STRIPE_SECRET_KEY` in Supabase
   - `STRIPE_WEBHOOK_SECRET` in Supabase
   - `VITE_STRIPE_PUBLIC_KEY` in frontend

2. **Price ID Configuration**
   - Verify price IDs in Stripe dashboard
   - Update `mapPriceIdToTier` function if needed

3. **Database Permissions**
   - Ensure service role has access to `update_subscription_from_stripe`
   - Check RLS policies don't block updates

4. **Network Issues**
   - Verify webhook endpoint is reachable
   - Check for firewall or proxy issues

## Success Criteria

✅ Subscription upgrades update user tier in database
✅ Payment success page shows correct information  
✅ "Manage Subscription" button opens billing portal
✅ Webhook events are processed without errors
✅ Database function executes successfully
✅ User can access tier-appropriate features
