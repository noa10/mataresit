import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Retired endpoint.
 *
 * This function used to write `cus_simulated_*` / `sub_simulated_*` IDs for
 * every user that did not have Stripe IDs yet. Those IDs are not Stripe
 * objects and must never be treated as a subscription. Checkout creates a real
 * customer instead.
 */
serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: 'This endpoint is retired. Start a subscription from the pricing page.',
      code: 'GONE',
    }),
    {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
});
