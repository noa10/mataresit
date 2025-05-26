import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { PRICE_IDS } from '@/config/stripe';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export function StripeTestingCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testCreateCheckoutSession = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      console.log('Testing create-checkout-session function...');
      console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
      console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...');

      // Check current session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log('Current session:', {
        hasSession: !!sessionData.session,
        hasUser: !!sessionData.session?.user,
        userId: sessionData.session?.user?.id,
        userEmail: sessionData.session?.user?.email,
        accessToken: sessionData.session?.access_token ? 'present' : 'missing',
        tokenPreview: sessionData.session?.access_token?.substring(0, 30) + '...',
        sessionError
      });

      if (!sessionData.session) {
        throw new Error('No active session found. Please log in first.');
      }

      // Test the function call with detailed logging
      console.log('Making function call with body:', {
        priceId: PRICE_IDS.pro.monthly,
        billingInterval: 'monthly'
      });

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId: PRICE_IDS.pro.monthly, // Use actual price ID
          billingInterval: 'monthly'
        },
      });

      console.log('Function response:', { data, error });

      if (error) {
        setResult({ error: error.message, details: error });
        toast.error(`Function error: ${error.message}`);
      } else {
        setResult({ success: true, data });
        toast.success('Function called successfully!');
      }
    } catch (error: any) {
      console.error('Error calling function:', error);
      setResult({ error: error.message, details: error });
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testStripeWebhook = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      console.log('Testing stripe-webhook function...');

      // This is just to test if the function is accessible
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ test: true }),
      });

      const text = await response.text();
      console.log('Webhook response:', { status: response.status, text });

      setResult({
        status: response.status,
        response: text,
        ok: response.ok
      });

      if (response.ok) {
        toast.success('Webhook endpoint is accessible!');
      } else {
        toast.error(`Webhook returned status: ${response.status}`);
      }
    } catch (error: any) {
      console.error('Error testing webhook:', error);
      setResult({ error: error.message, details: error });
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testWithRealPriceId = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      console.log('=== Testing with real price ID ===');
      console.log('Available price IDs:', PRICE_IDS);
      console.log('Using price ID:', PRICE_IDS.pro.monthly);
      console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);

      // Check current session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log('Current session:', {
        hasSession: !!sessionData.session,
        hasUser: !!sessionData.session?.user,
        userId: sessionData.session?.user?.id,
        userEmail: sessionData.session?.user?.email,
        accessToken: sessionData.session?.access_token ? 'present' : 'missing',
        tokenPreview: sessionData.session?.access_token?.substring(0, 30) + '...',
        sessionError
      });

      if (!sessionData.session) {
        throw new Error('No active session found. Please log in first.');
      }

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId: PRICE_IDS.pro.monthly, // Use actual price ID from config
          billingInterval: 'monthly'
        },
      });

      console.log('=== Function response ===');
      console.log('Data:', data);
      console.log('Error:', error);

      if (error) {
        console.error('Function error details:', error);
        setResult({ error: error.message, details: error });
        toast.error(`Function error: ${error.message}`);
      } else {
        console.log('Success! Data received:', data);
        setResult({ success: true, data });
        toast.success('Function called successfully!');
      }
    } catch (error: any) {
      console.error('=== Caught error ===', error);
      setResult({ error: error.message, details: error });
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-primary" />
          Stripe Integration Testing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-sm text-muted-foreground">
          Test Stripe integration functionality including checkout sessions and webhook endpoints.
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Checkout Session</h4>
            <p className="text-xs text-muted-foreground">
              Test the create-checkout-session Edge Function with valid price ID
            </p>
            <Button
              onClick={testCreateCheckoutSession}
              disabled={isLoading}
              size="sm"
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Checkout'
              )}
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Real Price ID</h4>
            <p className="text-xs text-muted-foreground">
              Test with actual price ID from environment variables
            </p>
            <Button
              onClick={testWithRealPriceId}
              disabled={isLoading}
              variant="secondary"
              size="sm"
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Real Price'
              )}
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Webhook</h4>
            <p className="text-xs text-muted-foreground">
              Test the stripe-webhook Edge Function accessibility
            </p>
            <Button
              onClick={testStripeWebhook}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Webhook'
              )}
            </Button>
          </div>
        </div>

        {result && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Test Result</h4>
            {result.error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Error: {result.error}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Test completed successfully!
                </AlertDescription>
              </Alert>
            )}
            <div className="bg-muted p-3 rounded-md overflow-auto text-xs">
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
