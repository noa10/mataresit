/**
 * Centralized Stripe configuration for Edge Functions.
 *
 * Live price IDs must come from Supabase Edge Function secrets:
 *   STRIPE_PRO_MONTHLY_PRICE_ID
 *   STRIPE_PRO_ANNUAL_PRICE_ID
 *   STRIPE_MAX_MONTHLY_PRICE_ID
 *   STRIPE_MAX_ANNUAL_PRICE_ID
 *
 * In test mode the test price IDs are used as a fallback so existing local and
 * test-mode flows keep working. In live mode a missing price ID is a
 * configuration error, not a silent "free" tier.
 */

// Subscription tier type
export type SubscriptionTier = 'free' | 'pro' | 'max';
export type PaidTier = Exclude<SubscriptionTier, 'free'>;

// Billing interval type
export type BillingInterval = 'monthly' | 'annual';

const TEST_PRICE_IDS: Record<PaidTier, Record<BillingInterval, string>> = {
  pro: {
    monthly: 'price_1RSiggPHa6JfBjtMFGNcoKnZ',
    annual: 'price_1RSiiHPHa6JfBjtMOIItG7RA',
  },
  max: {
    monthly: 'price_1RSiixPHa6JfBjtMXI9INFRf',
    annual: 'price_1RSik1PHa6JfBjtMbYhspNSR',
  },
};

const PRICE_ID_ENV_VARS: Record<PaidTier, Record<BillingInterval, string>> = {
  pro: {
    monthly: 'STRIPE_PRO_MONTHLY_PRICE_ID',
    annual: 'STRIPE_PRO_ANNUAL_PRICE_ID',
  },
  max: {
    monthly: 'STRIPE_MAX_MONTHLY_PRICE_ID',
    annual: 'STRIPE_MAX_ANNUAL_PRICE_ID',
  },
};

/** True when the function is running with a live Stripe secret key. */
export function isLiveStripeMode(): boolean {
  return (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim().startsWith('sk_live_');
}

function readConfiguredPriceId(tier: PaidTier, interval: BillingInterval): string {
  const fromEnv = Deno.env.get(PRICE_ID_ENV_VARS[tier][interval])?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  // Test mode keeps the historical test IDs as a fallback. Live mode must
  // never fall back to a test price ID.
  return isLiveStripeMode() ? '' : TEST_PRICE_IDS[tier][interval];
}

/**
 * Stripe Price ID configuration.
 * Empty strings indicate a missing live-mode configuration.
 */
export const STRIPE_PRICE_IDS = {
  pro: {
    monthly: readConfiguredPriceId('pro', 'monthly'),
    annual: readConfiguredPriceId('pro', 'annual'),
  },
  max: {
    monthly: readConfiguredPriceId('max', 'monthly'),
    annual: readConfiguredPriceId('max', 'annual'),
  },
} as const;

function buildPriceMap(): {
  tier: Record<string, SubscriptionTier>;
  interval: Record<string, BillingInterval>;
} {
  const tier: Record<string, SubscriptionTier> = {};
  const interval: Record<string, BillingInterval> = {};

  (Object.keys(STRIPE_PRICE_IDS) as PaidTier[]).forEach((paidTier) => {
    (Object.keys(STRIPE_PRICE_IDS[paidTier]) as BillingInterval[]).forEach((billingInterval) => {
      const priceId = STRIPE_PRICE_IDS[paidTier][billingInterval];
      if (!priceId) return;
      tier[priceId] = paidTier;
      interval[priceId] = billingInterval;
    });
  });

  return { tier, interval };
}

const PRICE_MAP = buildPriceMap();

/** Reverse mapping: price ID to tier. Unknown price IDs are absent. */
export const PRICE_ID_TO_TIER_MAP: Record<string, SubscriptionTier> = PRICE_MAP.tier;

/** Reverse mapping: price ID to billing interval. */
export const PRICE_ID_TO_INTERVAL_MAP: Record<string, BillingInterval> = PRICE_MAP.interval;

/**
 * Subscription tier limits and features.
 * This mirrors the database subscription_limits table.
 */
export const TIER_LIMITS = {
  free: {
    monthlyReceipts: 50,
    storageLimitMB: 1024, // 1GB
    retentionDays: 7,
    batchUploadLimit: 5,
    features: {
      versionControl: false,
      integrations: 'none',
      customBranding: false,
      maxUsers: 1,
      supportLevel: 'basic',
      apiAccess: false,
    },
  },
  pro: {
    monthlyReceipts: 500,
    storageLimitMB: 10240, // 10GB
    retentionDays: 90,
    batchUploadLimit: 50,
    features: {
      versionControl: true,
      integrations: 'basic',
      customBranding: true,
      maxUsers: 5,
      supportLevel: 'standard',
      apiAccess: false,
    },
  },
  max: {
    monthlyReceipts: -1, // unlimited
    storageLimitMB: -1, // unlimited
    retentionDays: 365,
    batchUploadLimit: 100,
    features: {
      versionControl: true,
      integrations: 'advanced',
      customBranding: true,
      maxUsers: -1, // unlimited
      supportLevel: 'priority',
      apiAccess: true,
    },
  },
} as const;

/**
 * Check whether a value is a database subscription tier.
 *
 * Stripe metadata and profile fallbacks are untyped at the boundary, so this
 * guard keeps an unexpected string from being written to the tier enum.
 */
export function isSubscriptionTier(value: unknown): value is SubscriptionTier {
  return value === 'free' || value === 'pro' || value === 'max';
}

/**
 * Map a Stripe price ID to a subscription tier.
 *
 * Returns null for an unknown price. Callers that update entitlements must use
 * resolveTierFromPriceId() so an unregistered live price fails closed instead
 * of silently downgrading a paying customer to free.
 */
export function mapPriceIdToTier(priceId: string | null | undefined): SubscriptionTier | null {
  if (!priceId) return null;
  return PRICE_ID_TO_TIER_MAP[priceId] ?? null;
}

/**
 * Resolve a price ID to a tier, throwing on an unknown price.
 */
export function resolveTierFromPriceId(priceId: string | null | undefined): SubscriptionTier {
  const tier = mapPriceIdToTier(priceId);
  if (!tier) {
    throw new Error(
      `Unrecognized Stripe price ID: ${priceId ?? '<missing>'}. ` +
      'Register the live price ID in the Edge Function secrets.',
    );
  }
  return tier;
}

/**
 * Get the price ID for a specific tier and billing interval.
 * Returns null when the price is not configured.
 */
export function getTierPriceId(
  tier: PaidTier,
  billingInterval: BillingInterval,
): string | null {
  return STRIPE_PRICE_IDS[tier]?.[billingInterval] || null;
}

/**
 * Get the price ID for a specific tier and billing interval, throwing when it
 * is missing.
 */
export function getRequiredTierPriceId(
  tier: PaidTier,
  billingInterval: BillingInterval,
): string {
  const priceId = getTierPriceId(tier, billingInterval);
  if (!priceId) {
    throw new Error(
      `Missing Stripe price ID for ${tier}/${billingInterval}. ` +
      `Set ${PRICE_ID_ENV_VARS[tier][billingInterval]} in the Edge Function secrets.`,
    );
  }
  return priceId;
}

/**
 * Get all price IDs for a specific tier.
 */
export function getTierPriceIds(tier: PaidTier): { monthly: string; annual: string } | null {
  const ids = STRIPE_PRICE_IDS[tier];
  if (!ids || !ids.monthly || !ids.annual) return null;
  return ids;
}

/**
 * Check if a price ID is configured and recognized.
 */
export function isValidPriceId(priceId: string): boolean {
  return priceId in PRICE_ID_TO_TIER_MAP;
}

/**
 * Get the billing interval for a price ID. Returns null for unknown prices.
 */
export function getBillingIntervalFromPriceId(priceId: string | null | undefined): BillingInterval | null {
  if (!priceId) return null;
  return PRICE_ID_TO_INTERVAL_MAP[priceId] ?? null;
}

/**
 * Resolve a price ID to a billing interval, throwing on an unknown price.
 */
export function resolveBillingIntervalFromPriceId(
  priceId: string | null | undefined,
): BillingInterval {
  const interval = getBillingIntervalFromPriceId(priceId);
  if (!interval) {
    throw new Error(
      `Unrecognized Stripe price ID: ${priceId ?? '<missing>'}. ` +
      'Register the live price ID in the Edge Function secrets.',
    );
  }
  return interval;
}

/**
 * Get tier limits and features.
 */
export function getTierLimits(tier: SubscriptionTier) {
  return TIER_LIMITS[tier];
}

/**
 * Map Stripe subscription status to our internal status.
 */
export function mapStripeStatusToOurStatus(stripeStatus: string): string {
  const statusMap: Record<string, string> = {
    'active': 'active',
    'trialing': 'trialing',
    'past_due': 'past_due',
    'canceled': 'canceled',
    'unpaid': 'unpaid',
    'incomplete': 'incomplete',
    'incomplete_expired': 'incomplete_expired',
  };

  return statusMap[stripeStatus] || 'inactive';
}

/**
 * Resolve a Stripe status to a value accepted by the database enum.
 * Throws instead of writing an invalid enum value.
 */
export function resolveStripeStatusForDatabase(stripeStatus: string): string {
  const mapped = mapStripeStatusToOurStatus(stripeStatus);
  if (mapped === 'inactive') {
    throw new Error(`Unsupported Stripe subscription status: ${stripeStatus}`);
  }
  return mapped;
}

/**
 * Validate the Stripe environment, including live price IDs.
 */
export function validateStripeEnvironment() {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const requiredVars = {
    STRIPE_SECRET_KEY: secretKey,
    STRIPE_WEBHOOK_SECRET: Deno.env.get('STRIPE_WEBHOOK_SECRET'),
  };

  const missing = Object.entries(requiredVars)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  const missingPriceIds = isLiveStripeMode()
    ? (Object.keys(PRICE_ID_ENV_VARS) as PaidTier[]).flatMap((tier) =>
      (Object.keys(PRICE_ID_ENV_VARS[tier]) as BillingInterval[])
        .filter((interval) => !STRIPE_PRICE_IDS[tier][interval])
        .map((interval) => PRICE_ID_ENV_VARS[tier][interval])
    )
    : [];

  return {
    isValid: missing.length === 0 && missingPriceIds.length === 0,
    missing,
    missingPriceIds,
    present: Object.keys(requiredVars).filter((key) => !missing.includes(key)),
  };
}

/**
 * Database-driven price ID helpers (optional).
 */
export async function getPriceIdFromDatabase(
  supabaseClient: any,
  tier: PaidTier,
  billingInterval: BillingInterval,
): Promise<string | null> {
  try {
    const { data, error } = await supabaseClient.rpc('get_stripe_price_id', {
      _tier: tier,
      _billing_interval: billingInterval,
    });

    if (error) {
      console.error('Error getting price ID from database:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to get price ID from database:', error);
    return null;
  }
}

/**
 * Map price ID to tier using the database. Returns null on failure rather than
 * defaulting to free.
 */
export async function getTierFromPriceIdDatabase(
  supabaseClient: any,
  priceId: string,
): Promise<SubscriptionTier | null> {
  try {
    const { data, error } = await supabaseClient.rpc('get_tier_from_price_id', {
      _price_id: priceId,
    });

    if (error) {
      console.error('Error getting tier from database:', error);
      return null;
    }

    return data ?? null;
  } catch (error) {
    console.error('Failed to get tier from database:', error);
    return null;
  }
}

/**
 * Debug information for troubleshooting. Does not expose secret values.
 */
export function getDebugInfo(priceId?: string) {
  const info = {
    liveMode: isLiveStripeMode(),
    availablePriceIds: Object.values(STRIPE_PRICE_IDS).flatMap((tier) => Object.values(tier)).filter(Boolean),
    priceIdToTierMap: PRICE_ID_TO_TIER_MAP,
    environment: validateStripeEnvironment(),
  };

  if (priceId) {
    return {
      ...info,
      priceIdDebug: {
        priceId,
        isValid: isValidPriceId(priceId),
        mappedTier: mapPriceIdToTier(priceId),
        billingInterval: getBillingIntervalFromPriceId(priceId),
      },
    };
  }

  return info;
}
