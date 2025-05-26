import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import Stripe from "https://esm.sh/stripe@14.21.0";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!signature || !webhookSecret) {
    return new Response('Missing signature or webhook secret', { status: 400 });
  }

  try {
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    console.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(`Webhook error: ${error.message}`, { status: 400 });
  }
});

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await handleSubscriptionChange(subscription);
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Get the price ID to determine tier
  const priceId = subscription.items.data[0]?.price.id;
  const tier = mapPriceIdToTier(priceId);

  const status = mapStripeStatusToOurStatus(subscription.status);

  await supabaseClient.rpc('update_subscription_from_stripe', {
    _stripe_customer_id: customerId,
    _stripe_subscription_id: subscription.id,
    _tier: tier,
    _status: status,
    _current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    _current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    _trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
  });

  console.log(`Updated subscription for customer ${customerId} to tier ${tier} with status ${status}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  await supabaseClient.rpc('update_subscription_from_stripe', {
    _stripe_customer_id: customerId,
    _stripe_subscription_id: subscription.id,
    _tier: 'free',
    _status: 'canceled',
    _current_period_start: new Date().toISOString(),
    _current_period_end: new Date().toISOString(),
    _trial_end: null,
  });

  console.log(`Subscription deleted for customer ${customerId}, reverted to free tier`);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string;

  // Record payment in payment_history
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('id, subscription_tier')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profile) {
    await supabaseClient
      .from('payment_history')
      .insert({
        user_id: profile.id,
        stripe_payment_intent_id: invoice.payment_intent as string,
        stripe_subscription_id: subscriptionId,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: 'succeeded',
        tier: profile.subscription_tier,
        billing_period_start: new Date(invoice.period_start * 1000).toISOString(),
        billing_period_end: new Date(invoice.period_end * 1000).toISOString(),
      });

    // Send payment confirmation email
    await sendPaymentConfirmationEmail(profile.id, {
      amount: invoice.amount_paid / 100, // Convert from cents
      currency: invoice.currency.toUpperCase(),
      tier: profile.subscription_tier,
      billingPeriodStart: new Date(invoice.period_start * 1000),
      billingPeriodEnd: new Date(invoice.period_end * 1000),
    });
  }

  console.log(`Payment succeeded for customer ${customerId}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  // Update subscription status to past_due
  await supabaseClient
    .from('profiles')
    .update({ subscription_status: 'past_due' })
    .eq('stripe_customer_id', customerId);

  console.log(`Payment failed for customer ${customerId}, marked as past_due`);
}

async function sendPaymentConfirmationEmail(userId: string, paymentDetails: {
  amount: number;
  currency: string;
  tier: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
}) {
  try {
    // Get user email from auth.users
    const { data: user, error: userError } = await supabaseClient.auth.admin.getUserById(userId);

    if (userError || !user?.user?.email) {
      console.error('Error getting user email:', userError);
      return;
    }

    const email = user.user.email;
    const planNames = {
      'pro': 'Pro Plan',
      'max': 'Max Plan',
      'free': 'Free Plan'
    };

    // Create email content
    const subject = `Payment Confirmation - ${planNames[paymentDetails.tier as keyof typeof planNames]} Subscription`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .success-icon { font-size: 48px; margin-bottom: 20px; }
          .amount { font-size: 24px; font-weight: bold; color: #4CAF50; margin: 20px 0; }
          .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
          .detail-label { font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="success-icon">✅</div>
          <h1>Payment Successful!</h1>
          <p>Thank you for subscribing to ReceiptScan</p>
        </div>

        <div class="content">
          <div class="amount">${paymentDetails.currency} ${paymentDetails.amount.toFixed(2)}</div>

          <div class="details">
            <div class="detail-row">
              <span class="detail-label">Plan:</span>
              <span>${planNames[paymentDetails.tier as keyof typeof planNames]}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Amount:</span>
              <span>${paymentDetails.currency} ${paymentDetails.amount.toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Billing Period:</span>
              <span>${paymentDetails.billingPeriodStart.toLocaleDateString()} - ${paymentDetails.billingPeriodEnd.toLocaleDateString()}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Next Billing Date:</span>
              <span>${paymentDetails.billingPeriodEnd.toLocaleDateString()}</span>
            </div>
          </div>

          <p>Your subscription is now active! You can start enjoying all the features of your ${planNames[paymentDetails.tier as keyof typeof planNames]}.</p>

          <div style="text-align: center;">
            <a href="${Deno.env.get('SITE_URL') || 'https://paperless-maverick.vercel.app'}/dashboard" class="button">
              Go to Dashboard
            </a>
          </div>

          <p>If you have any questions, please don't hesitate to contact our support team.</p>
        </div>

        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ReceiptScan. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    // Send email using our send-email edge function
    try {
      const emailResponse = await supabaseClient.functions.invoke('send-email', {
        body: {
          to: email,
          subject: subject,
          html: htmlContent,
        },
      });

      if (emailResponse.error) {
        console.error('Error sending email:', emailResponse.error);
      } else {
        console.log('Payment confirmation email sent successfully to:', email);
      }
    } catch (emailError) {
      console.error('Failed to send payment confirmation email:', emailError);
    }

  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
  }
}

function mapPriceIdToTier(priceId: string): 'free' | 'pro' | 'max' {
  // Map your actual Stripe price IDs to tiers
  const priceToTierMap: Record<string, 'free' | 'pro' | 'max'> = {
    // Your actual Stripe price IDs from .env.local
    'price_1RSiggPHa6JfBjtMFGNcoKnZ': 'pro',  // Pro Monthly
    'price_1RSiiHPHa6JfBjtMOIItG7RA': 'pro',  // Pro Annual
    'price_1RSiixPHa6JfBjtMXI9INFRf': 'max',  // Max Monthly
    'price_1RSik1PHa6JfBjtMbYhspNSR': 'max',  // Max Annual
  };

  console.log(`Mapping price ID ${priceId} to tier:`, priceToTierMap[priceId] || 'free');
  return priceToTierMap[priceId] || 'free';
}

function mapStripeStatusToOurStatus(stripeStatus: string): 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'unpaid' {
  const statusMap: Record<string, 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'unpaid'> = {
    'active': 'active',
    'trialing': 'trialing',
    'past_due': 'past_due',
    'canceled': 'canceled',
    'incomplete': 'incomplete',
    'incomplete_expired': 'incomplete_expired',
    'unpaid': 'unpaid',
  };

  return statusMap[stripeStatus] || 'canceled';
}
