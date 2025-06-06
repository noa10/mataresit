import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Loader2, Crown, Zap, Gift, Calendar, CreditCard, Mail, RefreshCw, AlertTriangle } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useStripe } from "@/contexts/StripeContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { refreshSubscription, createPortalSession, isLoading: stripeLoading } = useStripe();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<'pending' | 'success' | 'delayed' | 'failed'>('pending');
  const [retryCount, setRetryCount] = useState(0);
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

    // Enhanced payment verification with comprehensive webhook failure handling
    const verifyPayment = async () => {
      try {
        console.log('PaymentSuccessPage: Starting enhanced payment verification for session:', sessionId);
        setWebhookStatus('pending');

        // Initial wait for webhook processing
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Enhanced polling with exponential backoff
        let subscriptionData = null;
        let currentRetry = 0;
        const maxRetries = 8; // Increased from 5
        const baseDelay = 1500; // Base delay in ms
        const maxDelay = 10000; // Maximum delay in ms

        while (!subscriptionData && currentRetry < maxRetries) {
          setRetryCount(currentRetry + 1);
          console.log(`PaymentSuccessPage: Polling attempt ${currentRetry + 1}/${maxRetries}`);

          // Update webhook status based on retry count
          if (currentRetry === 0) {
            setWebhookStatus('pending');
          } else if (currentRetry < 4) {
            setWebhookStatus('pending');
          } else if (currentRetry < 7) {
            setWebhookStatus('delayed');
          } else {
            setWebhookStatus('failed');
          }

          try {
            // Parallel refresh of user and subscription data
            await Promise.all([
              refreshUser(),
              refreshSubscription()
            ]);

            // Get updated subscription status
            subscriptionData = await refreshSubscription();

            // Check if subscription has been updated from free tier
            if (subscriptionData && subscriptionData.tier !== 'free') {
              console.log('PaymentSuccessPage: Subscription successfully updated:', subscriptionData);
              setWebhookStatus('success');
              break;
            }

            // If still showing free tier, implement exponential backoff
            currentRetry++;
            if (currentRetry < maxRetries) {
              const delay = Math.min(baseDelay * Math.pow(1.5, currentRetry), maxDelay);
              console.log(`PaymentSuccessPage: Still showing free tier, retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          } catch (refreshError) {
            console.error(`PaymentSuccessPage: Error during refresh attempt ${currentRetry + 1}:`, refreshError);
            currentRetry++;
            if (currentRetry < maxRetries) {
              const delay = Math.min(baseDelay * Math.pow(2, currentRetry), maxDelay);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
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
          console.warn('PaymentSuccessPage: Could not retrieve subscription data after all retries');
          setWebhookStatus('failed');

          // Set basic payment details with warning
          setPaymentDetails({
            tier: 'pro', // Default assumption for successful payment
            status: 'active',
            planName: 'Pro Plan',
            billingInterval: 'monthly'
          });

          // Show user-friendly message about the delay
          toast.warning(
            "Your payment was successful, but we're still updating your account. " +
            "Please wait a moment and use the refresh button below if needed.",
            { duration: 8000 }
          );
        }
      } catch (error) {
        console.error('PaymentSuccessPage: Error verifying payment:', error);
        setWebhookStatus('failed');

        // Set basic payment details even on error
        setPaymentDetails({
          tier: 'pro',
          status: 'active',
          planName: 'Pro Plan',
          billingInterval: 'monthly'
        });

        toast.error(
          "Your payment was successful, but there was an issue updating your account. " +
          "Please use the refresh button below or contact support if the issue persists."
        );
      } finally {
        setIsLoading(false);
      }
    };

    // Manual refresh function for webhook failures
    const manualRefresh = async () => {
      if (isRefreshing) return;

      setIsRefreshing(true);
      setWebhookStatus('pending');

      try {
        console.log('PaymentSuccessPage: Manual refresh triggered');

        // Refresh subscription data
        await Promise.all([
          refreshUser(),
          refreshSubscription()
        ]);

        const subscriptionData = await refreshSubscription();

        if (subscriptionData && subscriptionData.tier !== 'free') {
          setWebhookStatus('success');

          // Update payment details with fresh data
          const planNames = {
            'pro': 'Pro Plan',
            'max': 'Max Plan',
            'free': 'Free Plan'
          };

          setPaymentDetails(prev => ({
            ...prev,
            tier: subscriptionData.tier,
            status: subscriptionData.status,
            planName: planNames[subscriptionData.tier as keyof typeof planNames] || subscriptionData.tier,
          }));

          toast.success("Subscription status updated successfully!");
        } else {
          setWebhookStatus('delayed');
          toast.warning("Still updating your subscription. Please try again in a moment.");
        }
      } catch (error) {
        console.error('PaymentSuccessPage: Manual refresh failed:', error);
        setWebhookStatus('failed');
        toast.error("Failed to refresh subscription status. Please try again.");
      } finally {
        setIsRefreshing(false);
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
          <p className="text-lg text-muted-foreground mb-2">Verifying your payment...</p>
          {retryCount > 0 && (
            <p className="text-sm text-muted-foreground">
              Checking subscription status... (Attempt {retryCount}/8)
            </p>
          )}
          {webhookStatus === 'delayed' && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Taking longer than usual to update your subscription...
                </p>
              </div>
            </div>
          )}
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

            {/* Webhook Status Indicator */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Subscription Status:
                  </div>
                  {webhookStatus === 'success' && (
                    <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Updated
                    </Badge>
                  )}
                  {webhookStatus === 'pending' && (
                    <Badge variant="secondary">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Updating...
                    </Badge>
                  )}
                  {webhookStatus === 'delayed' && (
                    <Badge variant="outline" className="border-yellow-300 text-yellow-700 dark:border-yellow-600 dark:text-yellow-400">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Delayed
                    </Badge>
                  )}
                  {webhookStatus === 'failed' && (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Needs Refresh
                    </Badge>
                  )}
                </div>

                {(webhookStatus === 'delayed' || webhookStatus === 'failed') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={manualRefresh}
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Refresh Status
                      </>
                    )}
                  </Button>
                )}
              </div>

              {webhookStatus === 'failed' && (
                <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Your payment was successful, but we're still updating your account.
                    Please click "Refresh Status" or wait a moment and try again.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col space-y-3 pt-4">
              <Button asChild size="lg">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
              <Button
                variant="outline"
                onClick={createPortalSession}
                disabled={stripeLoading}
              >
                {stripeLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Opening Portal...
                  </>
                ) : (
                  'Manage Subscription'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
