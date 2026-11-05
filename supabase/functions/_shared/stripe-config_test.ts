import { assertEquals, assertThrows } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Set live-mode values before importing the module: STRIPE_PRICE_IDS is
// computed at module load.
Deno.env.set('STRIPE_SECRET_KEY', 'sk_live_unit_test');
Deno.env.set('STRIPE_PRO_MONTHLY_PRICE_ID', 'price_live_pro_monthly');
Deno.env.set('STRIPE_PRO_ANNUAL_PRICE_ID', 'price_live_pro_annual');
Deno.env.set('STRIPE_MAX_MONTHLY_PRICE_ID', 'price_live_max_monthly');
Deno.env.set('STRIPE_MAX_ANNUAL_PRICE_ID', 'price_live_max_annual');

const config = await import('./stripe-config.ts');

Deno.test('resolves configured live price IDs', () => {
  assertEquals(config.isLiveStripeMode(), true);
  assertEquals(config.resolveTierFromPriceId('price_live_max_annual'), 'max');
  assertEquals(config.getBillingIntervalFromPriceId('price_live_pro_annual'), 'annual');
  assertEquals(config.getRequiredTierPriceId('pro', 'monthly'), 'price_live_pro_monthly');
});

Deno.test('unknown price IDs fail closed instead of becoming free', () => {
  assertEquals(config.mapPriceIdToTier('price_unknown'), null);
  assertEquals(config.isValidPriceId('price_unknown'), false);
  assertThrows(
    () => config.resolveTierFromPriceId('price_unknown'),
    Error,
    'Unrecognized Stripe price ID',
  );
});

Deno.test('live mode reports no missing price IDs when all four are configured', () => {
  const environment = config.validateStripeEnvironment();
  assertEquals(environment.missingPriceIds.length, 0);
});
