# Stripe Integration Documentation

This document outlines the complete Stripe integration implementation for the ReceiptScan application.

## Overview

The Stripe integration provides subscription-based billing with three tiers:
- **Free**: 50 receipts/month, 1GB storage, 7-day retention
- **Pro**: 500 receipts/month, 10GB storage, 90-day retention ($10/month)
- **Max**: Unlimited receipts, unlimited storage, 1-year retention ($20/month)

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

Set these secrets in your Supabase project:

```bash
# Backend (Supabase Edge Functions)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### 3. Database Migration

Run the subscription schema migration:

```sql
-- Apply the migration file
-- supabase/migrations/20250115000000_add_subscription_schema.sql
```

### 4. Stripe Configuration

1. Create products and prices in Stripe Dashboard
2. Configure webhook endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
3. Enable these webhook events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

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

const { createPortalSession, cancelSubscription } = useStripe();

// Open Stripe billing portal
await createPortalSession();

// Cancel subscription
await cancelSubscription();
```

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

1. **API Keys**: Never expose secret keys in frontend code
2. **Webhook Verification**: All webhooks are verified using Stripe signatures
3. **User Authorization**: All subscription operations require authentication
4. **Data Isolation**: Users can only access their own subscription data

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
