/**
 * Centralized Stripe Configuration
 * 
 * This file contains all Stripe-related configuration including price IDs,
 * tier mappings, and utility functions. This eliminates duplication across
 * multiple serverless functions and ensures consistency.
 */

// Subscription tier type
export type SubscriptionTier = 'free' | 'pro' | 'max';

// Billing interval type
export type BillingInterval = 'monthly' | 'annual';

/**
 * Stripe Price ID Configuration
 * These should match your actual Stripe price IDs from your Stripe dashboard
 */
export const STRIPE_PRICE_IDS = {
  pro: {
    monthly: 'price_1RSiggPHa6JfBjtMFGNcoKnZ',
    annual: 'price_1RSiiHPHa6JfBjtMOIItG7RA'
  },
  max: {
    monthly: 'price_1RSiixPHa6JfBjtMXI9INFRf',
    annual: 'price_1RSik1PHa6JfBjtMbYhspNSR'
  }
} as const;

/**
 * Reverse mapping: Price ID to Tier
 * Automatically generated from STRIPE_PRICE_IDS to ensure consistency
 */
export const PRICE_ID_TO_TIER_MAP: Record<string, SubscriptionTier> = {
  [STRIPE_PRICE_IDS.pro.monthly]: 'pro',
  [STRIPE_PRICE_IDS.pro.annual]: 'pro',
  [STRIPE_PRICE_IDS.max.monthly]: 'max',
  [STRIPE_PRICE_IDS.max.annual]: 'max',
} as const;

/**
 * Subscription tier limits and features
 * This mirrors the database subscription_limits table but provides
 * a fallback for when database access is not available
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
    }
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
    }
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
    }
  }
} as const;

/**
 * Utility Functions
 */

/**
 * Map a Stripe price ID to a subscription tier
 * @param priceId - The Stripe price ID
 * @returns The corresponding subscription tier, defaults to 'free' if not found
 */
export function mapPriceIdToTier(priceId: string): SubscriptionTier {
  const tier = PRICE_ID_TO_TIER_MAP[priceId];
  
  if (!tier) {
    console.warn(`Unknown price ID: ${priceId}, defaulting to 'free' tier`);
    return 'free';
  }
  
  return tier;
}

/**
 * Get the price ID for a specific tier and billing interval
 * @param tier - The subscription tier
 * @param billingInterval - The billing interval
 * @returns The Stripe price ID, or null if not found
 */
export function getTierPriceId(tier: 'pro' | 'max', billingInterval: BillingInterval): string | null {
  return STRIPE_PRICE_IDS[tier]?.[billingInterval] || null;
}

/**
 * Get all price IDs for a specific tier
 * @param tier - The subscription tier
 * @returns Object with monthly and annual price IDs
 */
export function getTierPriceIds(tier: 'pro' | 'max'): { monthly: string; annual: string } | null {
  return STRIPE_PRICE_IDS[tier] || null;
}

/**
 * Check if a price ID is valid
 * @param priceId - The price ID to validate
 * @returns True if the price ID is recognized
 */
export function isValidPriceId(priceId: string): boolean {
  return priceId in PRICE_ID_TO_TIER_MAP;
}

/**
 * Get billing interval from price ID
 * @param priceId - The Stripe price ID
 * @returns The billing interval, or null if not found
 */
export function getBillingIntervalFromPriceId(priceId: string): BillingInterval | null {
  for (const [tier, prices] of Object.entries(STRIPE_PRICE_IDS)) {
    if (prices.monthly === priceId) return 'monthly';
    if (prices.annual === priceId) return 'annual';
  }
  return null;
}

/**
 * Get tier limits and features
 * @param tier - The subscription tier
 * @returns The limits and features for the tier
 */
export function getTierLimits(tier: SubscriptionTier) {
  return TIER_LIMITS[tier];
}

/**
 * Map Stripe subscription status to our internal status
 * @param stripeStatus - The Stripe subscription status
 * @returns Our internal subscription status
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
 * Validate environment variables for Stripe
 * @returns Object indicating which environment variables are missing
 */
export function validateStripeEnvironment() {
  const requiredVars = {
    STRIPE_SECRET_KEY: Deno.env.get('STRIPE_SECRET_KEY'),
    STRIPE_WEBHOOK_SECRET: Deno.env.get('STRIPE_WEBHOOK_SECRET'),
  };

  const missing = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key, _]) => key);

  return {
    isValid: missing.length === 0,
    missing,
    present: Object.keys(requiredVars).filter(key => !missing.includes(key))
  };
}

/**
 * Database-driven price ID functions (optional alternative to hardcoded values)
 * These functions can be used when you want to store price IDs in the database
 * instead of hardcoding them in the serverless functions
 */

/**
 * Get price ID from database (requires Supabase client)
 * @param supabaseClient - Supabase client instance
 * @param tier - The subscription tier
 * @param billingInterval - The billing interval
 * @returns Promise resolving to price ID or null
 */
export async function getPriceIdFromDatabase(
  supabaseClient: any,
  tier: 'pro' | 'max',
  billingInterval: BillingInterval
): Promise<string | null> {
  try {
    const { data, error } = await supabaseClient.rpc('get_stripe_price_id', {
      _tier: tier,
      _billing_interval: billingInterval
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
 * Map price ID to tier using database (requires Supabase client)
 * @param supabaseClient - Supabase client instance
 * @param priceId - The Stripe price ID
 * @returns Promise resolving to subscription tier
 */
export async function getTierFromPriceIdDatabase(
  supabaseClient: any,
  priceId: string
): Promise<SubscriptionTier> {
  try {
    const { data, error } = await supabaseClient.rpc('get_tier_from_price_id', {
      _price_id: priceId
    });

    if (error) {
      console.error('Error getting tier from database:', error);
      return 'free';
    }

    return data || 'free';
  } catch (error) {
    console.error('Failed to get tier from database:', error);
    return 'free';
  }
}

/**
 * Debug information for troubleshooting
 * @param priceId - Optional price ID to debug
 * @returns Debug information object
 */
export function getDebugInfo(priceId?: string) {
  const info = {
    availablePriceIds: Object.values(STRIPE_PRICE_IDS).flatMap(tier => Object.values(tier)),
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
      }
    };
  }

  return info;
}
