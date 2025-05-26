import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { PRICE_IDS } from '@/config/stripe';

const TestStripePage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testCreateCheckoutSession = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      console.log('Testing create-checkout-session function...');
      console.log('Supabase URL:', supabase.supabaseUrl);
      console.log('Supabase Key:', supabase.supabaseKey?.substring(0, 20) + '...');

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
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/stripe-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.supabaseKey}`,
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
      console.log('Supabase URL:', supabase.supabaseUrl);

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
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Stripe Integration Test</h1>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Test Create Checkout Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Test the create-checkout-session Edge Function with valid price ID
            </p>
            <Button
              onClick={testCreateCheckoutSession}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Testing...' : 'Test Checkout Session'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test with Real Price ID</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Test with actual price ID from environment variables
            </p>
            <Button
              onClick={testWithRealPriceId}
              disabled={isLoading}
              variant="secondary"
              className="w-full"
            >
              {isLoading ? 'Testing...' : 'Test Real Price ID'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Stripe Webhook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Test the stripe-webhook Edge Function accessibility
            </p>
            <Button
              onClick={testStripeWebhook}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              {isLoading ? 'Testing...' : 'Test Webhook'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Test Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md overflow-auto text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TestStripePage;
