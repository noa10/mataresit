import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types for the enhanced subscription enforcement
export interface SubscriptionActionPayload {
  batch_size?: number;
  file_size_mb?: number;
  feature?: string;
  [key: string]: any;
}

export interface SubscriptionUsageInfo {
  receipts_this_month: number;
  storage_used_mb: number;
  monthly_receipts_limit: number;
  storage_limit_mb: number;
  batch_upload_limit: number;
}

export interface SubscriptionActionResult {
  allowed: boolean;
  reason: string;
  tier: 'free' | 'pro' | 'max';
  usage?: SubscriptionUsageInfo;
  current_usage?: number;
  limit?: number;
  batch_size?: number;
  feature?: string;
  [key: string]: any;
}

export type SubscriptionAction = 
  | 'upload_receipt'
  | 'upload_batch'
  | 'check_feature';

/**
 * Enhanced subscription enforcement service
 * Provides comprehensive backend validation for all subscription limits
 */
export class SubscriptionEnforcementService {
  /**
   * Check if a user can perform a specific action based on their subscription limits
   */
  static async canPerformAction(
    action: SubscriptionAction,
    payload: SubscriptionActionPayload = {},
    userId?: string
  ): Promise<SubscriptionActionResult> {
    try {
      const { data, error } = await supabase.rpc('can_perform_action', {
        _user_id: userId || undefined, // Let the function use auth.uid() if not provided
        _action: action,
        _payload: payload
      });

      if (error) {
        console.error('Error checking subscription action:', error);
        throw error;
      }

      return data as SubscriptionActionResult;
    } catch (error) {
      console.error('Subscription enforcement error:', error);
      
      // Return a safe default that blocks the action
      return {
        allowed: false,
        reason: 'Unable to verify subscription limits. Please try again.',
        tier: 'free'
      };
    }
  }

  /**
   * Check if user can upload a single receipt
   */
  static async canUploadReceipt(fileSizeMB: number = 0.5): Promise<SubscriptionActionResult> {
    return this.canPerformAction('upload_receipt', { file_size_mb: fileSizeMB });
  }

  /**
   * Check if user can upload a batch of receipts
   */
  static async canUploadBatch(
    batchSize: number, 
    averageFileSizeMB: number = 0.5
  ): Promise<SubscriptionActionResult> {
    return this.canPerformAction('upload_batch', {
      batch_size: batchSize,
      file_size_mb: averageFileSizeMB
    });
  }

  /**
   * Check if a specific feature is available for the user's tier
   */
  static async isFeatureAvailable(feature: string): Promise<SubscriptionActionResult> {
    return this.canPerformAction('check_feature', { feature });
  }

  /**
   * Get user's current subscription usage and limits
   */
  static async getUsageInfo(): Promise<SubscriptionUsageInfo | null> {
    try {
      const result = await this.canPerformAction('upload_receipt');
      return result.usage || null;
    } catch (error) {
      console.error('Error getting usage info:', error);
      return null;
    }
  }

  /**
   * Validate and show appropriate error messages for failed actions
   */
  static handleActionResult(
    result: SubscriptionActionResult,
    action: string = 'perform this action'
  ): boolean {
    if (result.allowed) {
      return true;
    }

    // Show user-friendly error messages based on the reason
    switch (result.reason) {
      case 'Monthly receipt limit exceeded':
        toast.error(
          `You've reached your monthly limit of ${result.limit} receipts. ` +
          `Upgrade your plan to process more receipts.`,
          {
            action: {
              label: 'Upgrade',
              onClick: () => window.location.href = '/pricing'
            }
          }
        );
        break;

      case 'Monthly receipt limit would be exceeded by batch':
        toast.error(
          `This batch would exceed your monthly limit. ` +
          `You have ${result.limit! - result.current_usage!} receipts remaining. ` +
          `Consider upgrading or reducing the batch size.`,
          {
            action: {
              label: 'Upgrade',
              onClick: () => window.location.href = '/pricing'
            }
          }
        );
        break;

      case 'Batch upload limit exceeded':
        toast.error(
          `Your plan allows batches of up to ${result.limit} files. ` +
          `You're trying to upload ${result.batch_size} files. ` +
          `Please upgrade or reduce the batch size.`,
          {
            action: {
              label: 'Upgrade',
              onClick: () => window.location.href = '/pricing'
            }
          }
        );
        break;

      case 'Storage limit exceeded':
      case 'Storage limit would be exceeded by batch':
        toast.error(
          `You've reached your storage limit. ` +
          `Upgrade your plan for more storage space.`,
          {
            action: {
              label: 'Upgrade',
              onClick: () => window.location.href = '/pricing'
            }
          }
        );
        break;

      case 'Feature not available for tier':
        toast.error(
          `This feature is not available on your current plan. ` +
          `Upgrade to access ${result.feature}.`,
          {
            action: {
              label: 'Upgrade',
              onClick: () => window.location.href = '/pricing'
            }
          }
        );
        break;

      default:
        toast.error(
          `Unable to ${action}: ${result.reason}`,
          {
            action: {
              label: 'Upgrade',
              onClick: () => window.location.href = '/pricing'
            }
          }
        );
    }

    return false;
  }

  /**
   * Backward compatibility function for existing checkCanUpload calls
   */
  static async checkCanUpload(): Promise<boolean> {
    const result = await this.canUploadReceipt();
    return result.allowed;
  }
}

// Export convenience functions for common use cases
export const canUploadReceipt = SubscriptionEnforcementService.canUploadReceipt.bind(SubscriptionEnforcementService);
export const canUploadBatch = SubscriptionEnforcementService.canUploadBatch.bind(SubscriptionEnforcementService);
export const isFeatureAvailable = SubscriptionEnforcementService.isFeatureAvailable.bind(SubscriptionEnforcementService);
export const handleActionResult = SubscriptionEnforcementService.handleActionResult.bind(SubscriptionEnforcementService);
export const checkCanUpload = SubscriptionEnforcementService.checkCanUpload.bind(SubscriptionEnforcementService);
