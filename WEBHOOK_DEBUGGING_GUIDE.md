# 🔧 Webhook Debugging Guide

## 🚨 **Issue Identified**

**Problem**: After payment completion, users are redirected to dashboard instead of payment success page because webhooks are not processing subscription creation events.

**Evidence**:
- ✅ User `samcodersam7@gmail.com` was created
- ✅ Stripe customer ID `cus_SR7nI5ssKzRpVw` exists
- ❌ Subscription tier remains 'free' (should be 'pro')
- ❌ No Stripe subscription ID in database
- ❌ No subscription dates recorded

## 🔍 **Root Cause Analysis**

The webhook processing chain is broken at one of these points:

### 1. **Stripe Webhook Configuration**
- Webhook endpoint might not be configured in Stripe dashboard
- Required events might not be enabled
- Webhook secret might be incorrect

### 2. **Supabase Environment Variables**
- `STRIPE_SECRET_KEY` might be missing or incorrect
- `STRIPE_WEBHOOK_SECRET` might be missing or incorrect

### 3. **Subscription Creation in Checkout**
- Checkout session might not be creating subscriptions properly
- Price IDs might be incorrect

## 🛠️ **Immediate Fixes**

### Fix 1: Manual User Update (Temporary)
```bash
# Update the current user to Pro tier
VITE_SUPABASE_URL=https://mpmkbtsufihzdelrlszs.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzAxMjM4OSwiZXhwIjoyMDU4NTg4Mzg5fQ.o6Xn7TTIYF4U9zAOhGWVf5MoAcl_BGPtQ_BRcR2xV0o \
node scripts/test-payment-flow.js simulate samcodersam7@gmail.com
```

**Result**: ✅ User updated to Pro tier, payment success page now works!

### Fix 2: Check Stripe Dashboard

#### A. Verify Webhook Endpoint
1. **Go to**: [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/webhooks)
2. **Check if endpoint exists**: `https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/stripe-webhook`
3. **Verify events are enabled**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

#### B. Check Recent Webhook Deliveries
1. **Click on your webhook endpoint**
2. **Check "Recent deliveries" tab**
3. **Look for failed deliveries** around the time of payment
4. **Check error messages** if any deliveries failed

#### C. Get Webhook Secret
1. **Click "Reveal" next to webhook signing secret**
2. **Copy the secret** (starts with `whsec_`)

### Fix 3: Update Supabase Environment Variables

#### A. Check Current Variables
1. **Go to**: [Supabase Dashboard > Project Settings > Edge Functions](https://supabase.com/dashboard/project/mpmkbtsufihzdelrlszs/settings/functions)
2. **Check if these variables exist**:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`

#### B. Add Missing Variables
```bash
# Set Stripe secret key (get from Stripe Dashboard > Developers > API Keys)
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key

# Set webhook secret (get from Stripe Dashboard > Developers > Webhooks)
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

## 🧪 **Testing Steps**

### Step 1: Test Webhook Endpoint
```bash
# Check if webhook endpoint is accessible
curl -X POST https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/stripe-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Expected: 400 or 401 (not 404 or 500)
```

### Step 2: Test Subscription Update Function
```bash
# Test with existing user
VITE_SUPABASE_URL=https://mpmkbtsufihzdelrlszs.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your_service_key \
node scripts/debug-subscription.js debug cus_SR7nI5ssKzRpVw
```

### Step 3: Test Payment Success Page
1. **With session ID**: http://localhost:5001/payment-success?session_id=cs_test_123
2. **Should show**: Payment success page with Pro plan details
3. **Test button**: "Manage Subscription" should open billing portal

### Step 4: Test Complete Flow
1. **Create new test user**
2. **Go to pricing page**
3. **Subscribe to Pro plan**
4. **Use test card**: 4242 4242 4242 4242
5. **Monitor webhook logs** in Supabase dashboard
6. **Verify redirect** to payment success page

## 🔧 **Permanent Solutions**

### Solution 1: Fix Webhook Configuration

#### A. Create/Update Webhook in Stripe
```bash
# Using Stripe CLI (if available)
stripe listen --forward-to https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/stripe-webhook
```

#### B. Manual Configuration
1. **Go to**: Stripe Dashboard > Developers > Webhooks
2. **Click**: "Add endpoint"
3. **Endpoint URL**: `https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/stripe-webhook`
4. **Events to send**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

### Solution 2: Enhanced Error Handling

Add better error handling to the checkout session creation:

```typescript
// In create-checkout-session function
const session = await stripe.checkout.sessions.create({
  // ... existing config
  success_url: successUrl,
  cancel_url: cancelUrl,
  
  // Add webhook fallback
  payment_intent_data: {
    metadata: {
      user_id: user.id,
      fallback_tier: 'pro' // In case webhook fails
    }
  }
});
```

### Solution 3: Client-Side Fallback

Add client-side verification in payment success page:

```typescript
// If webhook hasn't processed after retries, show manual verification option
if (retryCount >= maxRetries && subscriptionData?.tier === 'free') {
  // Show "Contact Support" or "Verify Payment" button
  // Log the issue for manual resolution
}
```

## 📊 **Current Status**

### ✅ **Working**
- Database function for subscription updates
- Payment success page UI and billing portal integration
- User creation and Stripe customer creation
- Manual subscription updates

### ❌ **Not Working**
- Automatic webhook processing of subscription creation
- Redirect to payment success page after payment
- Real-time subscription tier updates

### 🔄 **Next Steps**
1. **Check Stripe webhook configuration** (highest priority)
2. **Verify Supabase environment variables**
3. **Test webhook delivery** with Stripe CLI or test events
4. **Monitor webhook logs** during next payment test
5. **Implement fallback mechanisms** for webhook failures

## 🎯 **Success Criteria**

After fixes:
- ✅ User completes payment
- ✅ Webhook processes subscription creation
- ✅ User tier updates to 'pro' automatically
- ✅ User redirected to payment success page
- ✅ "Manage Subscription" button opens billing portal
- ✅ No manual intervention required
