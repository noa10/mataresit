/**
 * API Subscription Enforcement
 * Integrates external API with existing subscription limits
 */

import type { ApiContext } from './api-auth.ts';

export interface SubscriptionLimits {
  tier: 'free' | 'pro' | 'max';
  receiptsPerMonth: number;
  receiptsUsedThisMonth: number;
  receiptsRemaining: number;
  batchUploadLimit: number;
  storageUsedMB: number;
  storageLimitMB: number;
  storageRemaining: number;
  apiRequestsPerHour: number;
  canUploadReceipts: boolean;
  canCreateClaims: boolean;
  canUseBatchUpload: boolean;
  canUseAdvancedFeatures: boolean;
}

export interface EnforcementResult {
  allowed: boolean;
  reason?: string;
  limits?: SubscriptionLimits;
  upgradeRequired?: boolean;
}

/**
 * Checks if user can perform a specific action based on subscription
 */
export async function checkSubscriptionLimits(
  context: ApiContext,
  action: 'upload_receipt' | 'upload_batch' | 'create_claim' | 'advanced_search',
  payload: any = {}
): Promise<EnforcementResult> {
  try {
    // Use existing subscription enforcement function
    const { data, error } = await context.supabase.rpc('can_perform_action', {
      _user_id: context.userId,
      _action: action,
      _payload: payload
    });

    if (error) {
      console.error('Subscription enforcement error:', error);
      return {
        allowed: false,
        reason: 'Unable to verify subscription limits',
        upgradeRequired: false
      };
    }

    // Get detailed subscription info
    const limits = await getSubscriptionLimits(context);

    return {
      allowed: data?.allowed || false,
      reason: data?.reason,
      limits,
      upgradeRequired: !data?.allowed && data?.tier === 'free'
    };

  } catch (error) {
    console.error('Error checking subscription limits:', error);
    return {
      allowed: false,
      reason: 'Subscription check failed',
      upgradeRequired: false
    };
  }
}

/**
 * Gets detailed subscription limits for the user
 */
export async function getSubscriptionLimits(context: ApiContext): Promise<SubscriptionLimits> {
  try {
    // Get user profile with subscription info
    const { data: profile, error: profileError } = await context.supabase
      .from('profiles')
      .select(`
        subscription_tier,
        receipts_used_this_month,
        monthly_reset_date
      `)
      .eq('id', context.userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      throw profileError;
    }

    const tier = profile?.subscription_tier || 'free';

    // Get tier limits
    const { data: tierLimits, error: limitsError } = await context.supabase
      .from('subscription_limits')
      .select('*')
      .eq('tier', tier)
      .single();

    if (limitsError) {
      console.error('Error fetching tier limits:', limitsError);
      throw limitsError;
    }

    // Calculate storage usage (simplified - in production you'd query actual usage)
    const storageUsedMB = 0; // TODO: Calculate actual storage usage
    const storageLimitMB = tierLimits?.storage_limit_mb || 1024;

    // Calculate receipts usage
    const receiptsUsedThisMonth = profile?.receipts_used_this_month || 0;
    const receiptsPerMonth = tierLimits?.monthly_receipts || 50;
    const receiptsRemaining = Math.max(0, receiptsPerMonth - receiptsUsedThisMonth);

    // Determine capabilities based on tier
    const capabilities = getTierCapabilities(tier);

    return {
      tier: tier as 'free' | 'pro' | 'max',
      receiptsPerMonth,
      receiptsUsedThisMonth,
      receiptsRemaining,
      batchUploadLimit: tierLimits?.batch_upload_limit || 1,
      storageUsedMB,
      storageLimitMB,
      storageRemaining: Math.max(0, storageLimitMB - storageUsedMB),
      apiRequestsPerHour: getApiRateLimit(tier),
      canUploadReceipts: receiptsRemaining > 0,
      canCreateClaims: capabilities.canCreateClaims,
      canUseBatchUpload: capabilities.canUseBatchUpload,
      canUseAdvancedFeatures: capabilities.canUseAdvancedFeatures
    };

  } catch (error) {
    console.error('Error getting subscription limits:', error);
    
    // Return safe defaults on error
    return {
      tier: 'free',
      receiptsPerMonth: 50,
      receiptsUsedThisMonth: 0,
      receiptsRemaining: 50,
      batchUploadLimit: 5,
      storageUsedMB: 0,
      storageLimitMB: 1024,
      storageRemaining: 1024,
      apiRequestsPerHour: 100,
      canUploadReceipts: true,
      canCreateClaims: false,
      canUseBatchUpload: false,
      canUseAdvancedFeatures: false
    };
  }
}

/**
 * Gets tier-specific capabilities
 */
function getTierCapabilities(tier: string) {
  switch (tier) {
    case 'free':
      return {
        canCreateClaims: false,
        canUseBatchUpload: false,
        canUseAdvancedFeatures: false
      };
    case 'pro':
      return {
        canCreateClaims: true,
        canUseBatchUpload: true,
        canUseAdvancedFeatures: false
      };
    case 'max':
      return {
        canCreateClaims: true,
        canUseBatchUpload: true,
        canUseAdvancedFeatures: true
      };
    default:
      return {
        canCreateClaims: false,
        canUseBatchUpload: false,
        canUseAdvancedFeatures: false
      };
  }
}

/**
 * Gets API rate limit based on tier
 */
function getApiRateLimit(tier: string): number {
  switch (tier) {
    case 'free':
      return 100; // 100 requests per hour
    case 'pro':
      return 1000; // 1000 requests per hour
    case 'max':
      return 5000; // 5000 requests per hour
    default:
      return 100;
  }
}

/**
 * Creates a subscription error response with upgrade information
 */
export function createSubscriptionErrorResponse(
  result: EnforcementResult,
  action: string
): Response {
  const message = result.reason || `Subscription limit reached for ${action}`;
  
  const responseBody = {
    error: true,
    message,
    code: 'SUBSCRIPTION_LIMIT_EXCEEDED',
    action,
    limits: result.limits,
    upgradeRequired: result.upgradeRequired,
    upgradeUrl: result.upgradeRequired ? '/pricing' : undefined,
    timestamp: new Date().toISOString()
  };

  return new Response(
    JSON.stringify(responseBody),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-Subscription-Tier': result.limits?.tier || 'unknown',
        'X-Upgrade-Required': result.upgradeRequired ? 'true' : 'false'
      }
    }
  );
}

/**
 * Validates batch size against subscription limits
 */
export async function validateBatchSize(
  context: ApiContext,
  batchSize: number
): Promise<EnforcementResult> {
  const limits = await getSubscriptionLimits(context);
  
  if (batchSize > limits.batchUploadLimit) {
    return {
      allowed: false,
      reason: `Batch size ${batchSize} exceeds limit of ${limits.batchUploadLimit} for ${limits.tier} tier`,
      limits,
      upgradeRequired: limits.tier === 'free'
    };
  }

  if (batchSize > limits.receiptsRemaining) {
    return {
      allowed: false,
      reason: `Batch size ${batchSize} exceeds remaining monthly limit of ${limits.receiptsRemaining}`,
      limits,
      upgradeRequired: limits.tier === 'free'
    };
  }

  return {
    allowed: true,
    limits
  };
}

/**
 * Records usage for subscription tracking
 */
export async function recordUsage(
  context: ApiContext,
  action: 'receipt_upload' | 'claim_created' | 'api_request',
  quantity: number = 1
): Promise<void> {
  try {
    // Update usage counters based on action
    switch (action) {
      case 'receipt_upload':
        await context.supabase
          .from('profiles')
          .update({
            receipts_used_this_month: context.supabase.raw(`receipts_used_this_month + ${quantity}`)
          })
          .eq('id', context.userId);
        break;
      
      case 'api_request':
        // API request usage is tracked in rate limiting
        break;
      
      default:
        console.log(`Usage tracking not implemented for action: ${action}`);
    }

  } catch (error) {
    console.error('Error recording usage:', error);
    // Don't throw - usage tracking failures shouldn't break API
  }
}
