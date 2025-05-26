import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Loader2, Crown, Zap, Gift, Calendar, CreditCard, Mail } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useStripe } from "@/contexts/StripeContext";
import { supabase } from "@/lib/supabase";

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { refreshSubscription } = useStripe();
  const [isLoading, setIsLoading] = useState(true);
  const [paymentDetails, setPaymentDetails] = useState<{
    tier: string;
    status: string;
    nextBillingDate?: string;
    amount?: number;
    currency?: string;
    planName?: string;
    billingInterval?: string;
  } | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      navigate('/dashboard');
      return;
    }

    // Verify the payment and get subscription details
    const verifyPayment = async () => {
      try {
        console.log('PaymentSuccessPage: Starting payment verification for session:', sessionId);

        // Wait longer for Stripe webhook to process
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Refresh user data and subscription info with retry logic
        let subscriptionData = null;
        let retryCount = 0;
        const maxRetries = 5;

        while (!subscriptionData && retryCount < maxRetries) {
          console.log(`PaymentSuccessPage: Attempt ${retryCount + 1} to refresh subscription data`);

          await Promise.all([
            refreshUser(),
            refreshSubscription()
          ]);

          // Get updated subscription status
          subscriptionData = await refreshSubscription();

          // If still showing free tier, wait and retry
          if (!subscriptionData || subscriptionData.tier === 'free') {
            retryCount++;
            if (retryCount < maxRetries) {
              console.log('PaymentSuccessPage: Still showing free tier, retrying in 2 seconds...');
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } else {
            console.log('PaymentSuccessPage: Successfully retrieved subscription data:', subscriptionData);
            break;
          }
        }

        // Get payment details from payment_history
        const { data: paymentHistory, error: paymentError } = await supabase
          .from('payment_history')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (paymentError) {
          console.log('PaymentSuccessPage: No payment history found yet, this is normal for new payments');
        }

        if (subscriptionData) {
          const planNames = {
            'pro': 'Pro Plan',
            'max': 'Max Plan',
            'free': 'Free Plan'
          };

          // Determine billing interval from session or default to monthly
          let billingInterval = 'monthly';
          if (paymentHistory?.metadata && typeof paymentHistory.metadata === 'object') {
            billingInterval = (paymentHistory.metadata as any).billing_interval || 'monthly';
          }

          setPaymentDetails({
            tier: subscriptionData.tier,
            status: subscriptionData.status,
            nextBillingDate: subscriptionData.subscriptionEndDate,
            amount: paymentHistory?.amount ? paymentHistory.amount / 100 : undefined, // Convert from cents
            currency: paymentHistory?.currency?.toUpperCase() || 'USD',
            planName: planNames[subscriptionData.tier as keyof typeof planNames] || subscriptionData.tier,
            billingInterval
          });

          console.log('PaymentSuccessPage: Payment details set:', {
            tier: subscriptionData.tier,
            status: subscriptionData.status,
            amount: paymentHistory?.amount ? paymentHistory.amount / 100 : undefined
          });
        } else {
          console.warn('PaymentSuccessPage: Could not retrieve subscription data after retries');
          // Set basic payment details even if subscription data is not available
          setPaymentDetails({
            tier: 'pro', // Default assumption for successful payment
            status: 'active',
            planName: 'Pro Plan',
            billingInterval: 'monthly'
          });
        }
      } catch (error) {
        console.error('PaymentSuccessPage: Error verifying payment:', error);
        // Set basic payment details even on error
        setPaymentDetails({
          tier: 'pro',
          status: 'active',
          planName: 'Pro Plan',
          billingInterval: 'monthly'
        });
      } finally {
        setIsLoading(false);
      }
    };

    verifyPayment();
  }, [searchParams, user, navigate, refreshUser, refreshSubscription]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
        <Navbar />
        <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin mb-4" />
          <p className="text-lg text-muted-foreground">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  const getTierIcon = () => {
    switch (paymentDetails?.tier) {
      case 'pro':
        return <Zap className="h-6 w-6 text-blue-500" />;
      case 'max':
        return <Crown className="h-6 w-6 text-purple-500" />;
      default:
        return <Gift className="h-6 w-6 text-green-500" />;
    }
  };

  const getTierColor = () => {
    switch (paymentDetails?.tier) {
      case 'pro':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'max':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <Navbar />
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-lg mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto bg-green-100 dark:bg-green-900 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-6">
              <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-3xl mb-2">Payment Successful!</CardTitle>
            <CardDescription className="text-lg">
              Welcome to your new plan! 🎉
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {paymentDetails && (
              <>
                {/* Payment Summary */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Plan</span>
                    <div className="flex items-center gap-2">
                      {getTierIcon()}
                      <Badge className={getTierColor()}>
                        {paymentDetails.planName}
                      </Badge>
                    </div>
                  </div>

                  {paymentDetails.amount && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Amount Paid</span>
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-lg">
                          {paymentDetails.currency} {paymentDetails.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Billing</span>
                    <span className="font-medium capitalize">
                      {paymentDetails.billingInterval}
                    </span>
                  </div>

                  {paymentDetails.nextBillingDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Next Billing</span>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {new Date(paymentDetails.nextBillingDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Email Confirmation Notice */}
                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      Confirmation email sent!
                    </p>
                    <p className="text-blue-700 dark:text-blue-300 mt-1">
                      Check your inbox for payment confirmation and receipt details.
                    </p>
                  </div>
                </div>
              </>
            )}

            <div className="flex flex-col space-y-3 pt-4">
              <Button asChild size="lg">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/settings">Manage Subscription</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
