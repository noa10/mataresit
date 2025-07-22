/**
 * Quota Tracking Service
 * Phase 3: Batch Upload Optimization
 * 
 * Manages API quota tracking in the database for persistent
 * rate limiting across sessions and workers.
 */

import { supabase } from '../supabase';

export interface QuotaUsage {
  apiProvider: string;
  quotaType: 'requests' | 'tokens';
  timeWindow: Date;
  quotaUsed: number;
  quotaLimit: number;
  quotaRemaining: number;
  isRateLimited: boolean;
  rateLimitResetAt?: Date;
}

export interface QuotaUpdateResult {
  success: boolean;
  quotaUsage?: QuotaUsage;
  error?: string;
}

export class QuotaTrackingService {
  private static instance: QuotaTrackingService;
  private cache: Map<string, QuotaUsage> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds

  private constructor() {}

  static getInstance(): QuotaTrackingService {
    if (!QuotaTrackingService.instance) {
      QuotaTrackingService.instance = new QuotaTrackingService();
    }
    return QuotaTrackingService.instance;
  }

  /**
   * Record API usage and update quota tracking
   */
  async recordUsage(
    apiProvider: string,
    quotaType: 'requests' | 'tokens',
    usage: number,
    quotaLimit: number
  ): Promise<QuotaUpdateResult> {
    try {
      const timeWindow = this.getTimeWindow();
      const cacheKey = `${apiProvider}-${quotaType}-${timeWindow.getTime()}`;

      // Try to update existing record
      const { data: existingRecord, error: fetchError } = await supabase
        .from('api_quota_tracking')
        .select('*')
        .eq('api_provider', apiProvider)
        .eq('quota_type', quotaType)
        .eq('time_window', timeWindow.toISOString())
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw fetchError;
      }

      let quotaUsage: QuotaUsage;

      if (existingRecord) {
        // Update existing record
        const newUsage = existingRecord.quota_used + usage;
        const { data: updatedRecord, error: updateError } = await supabase
          .from('api_quota_tracking')
          .update({
            quota_used: newUsage,
            quota_limit: quotaLimit,
            is_rate_limited: newUsage >= quotaLimit,
            rate_limit_reset_at: newUsage >= quotaLimit ? this.getNextTimeWindow() : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRecord.id)
          .select()
          .single();

        if (updateError) throw updateError;

        quotaUsage = this.mapToQuotaUsage(updatedRecord);
      } else {
        // Create new record
        const { data: newRecord, error: insertError } = await supabase
          .from('api_quota_tracking')
          .insert({
            api_provider: apiProvider,
            quota_type: quotaType,
            time_window: timeWindow.toISOString(),
            quota_used: usage,
            quota_limit: quotaLimit,
            is_rate_limited: usage >= quotaLimit,
            rate_limit_reset_at: usage >= quotaLimit ? this.getNextTimeWindow() : null
          })
          .select()
          .single();

        if (insertError) throw insertError;

        quotaUsage = this.mapToQuotaUsage(newRecord);
      }

      // Update cache
      this.cache.set(cacheKey, quotaUsage);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

      return {
        success: true,
        quotaUsage
      };
    } catch (error) {
      console.error('Error recording quota usage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get current quota usage for an API provider
   */
  async getQuotaUsage(
    apiProvider: string,
    quotaType: 'requests' | 'tokens'
  ): Promise<QuotaUsage | null> {
    try {
      const timeWindow = this.getTimeWindow();
      const cacheKey = `${apiProvider}-${quotaType}-${timeWindow.getTime()}`;

      // Check cache first
      const cached = this.getCachedUsage(cacheKey);
      if (cached) {
        return cached;
      }

      // Fetch from database
      const { data, error } = await supabase
        .from('api_quota_tracking')
        .select('*')
        .eq('api_provider', apiProvider)
        .eq('quota_type', quotaType)
        .eq('time_window', timeWindow.toISOString())
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return null;
        }
        throw error;
      }

      const quotaUsage = this.mapToQuotaUsage(data);

      // Update cache
      this.cache.set(cacheKey, quotaUsage);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

      return quotaUsage;
    } catch (error) {
      console.error('Error fetching quota usage:', error);
      return null;
    }
  }

  /**
   * Check if API provider is currently rate limited
   */
  async isRateLimited(
    apiProvider: string,
    quotaType: 'requests' | 'tokens'
  ): Promise<boolean> {
    const usage = await this.getQuotaUsage(apiProvider, quotaType);
    if (!usage) return false;

    return usage.isRateLimited && (!usage.rateLimitResetAt || usage.rateLimitResetAt > new Date());
  }

  /**
   * Get remaining quota for an API provider
   */
  async getRemainingQuota(
    apiProvider: string,
    quotaType: 'requests' | 'tokens'
  ): Promise<number> {
    const usage = await this.getQuotaUsage(apiProvider, quotaType);
    return usage ? usage.quotaRemaining : 0;
  }

  /**
   * Reset quota tracking for a specific time window (admin function)
   */
  async resetQuota(
    apiProvider: string,
    quotaType: 'requests' | 'tokens',
    timeWindow?: Date
  ): Promise<boolean> {
    try {
      const targetWindow = timeWindow || this.getTimeWindow();
      
      const { error } = await supabase
        .from('api_quota_tracking')
        .update({
          quota_used: 0,
          is_rate_limited: false,
          rate_limit_reset_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('api_provider', apiProvider)
        .eq('quota_type', quotaType)
        .eq('time_window', targetWindow.toISOString());

      if (error) throw error;

      // Clear cache
      const cacheKey = `${apiProvider}-${quotaType}-${targetWindow.getTime()}`;
      this.cache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);

      return true;
    } catch (error) {
      console.error('Error resetting quota:', error);
      return false;
    }
  }

  /**
   * Get quota statistics for monitoring
   */
  async getQuotaStatistics(
    apiProvider: string,
    hours: number = 24
  ): Promise<{
    totalRequests: number;
    totalTokens: number;
    rateLimitHits: number;
    averageUsage: number;
  }> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('api_quota_tracking')
        .select('quota_type, quota_used, is_rate_limited')
        .eq('api_provider', apiProvider)
        .gte('time_window', since.toISOString());

      if (error) throw error;

      const stats = {
        totalRequests: 0,
        totalTokens: 0,
        rateLimitHits: 0,
        averageUsage: 0
      };

      if (data && data.length > 0) {
        data.forEach(record => {
          if (record.quota_type === 'requests') {
            stats.totalRequests += record.quota_used;
          } else if (record.quota_type === 'tokens') {
            stats.totalTokens += record.quota_used;
          }
          
          if (record.is_rate_limited) {
            stats.rateLimitHits++;
          }
        });

        stats.averageUsage = (stats.totalRequests + stats.totalTokens) / data.length;
      }

      return stats;
    } catch (error) {
      console.error('Error fetching quota statistics:', error);
      return {
        totalRequests: 0,
        totalTokens: 0,
        rateLimitHits: 0,
        averageUsage: 0
      };
    }
  }

  /**
   * Clean up old quota records (maintenance function)
   */
  async cleanupOldRecords(daysToKeep: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('api_quota_tracking')
        .delete()
        .lt('time_window', cutoffDate.toISOString())
        .select('id');

      if (error) throw error;

      return data ? data.length : 0;
    } catch (error) {
      console.error('Error cleaning up old quota records:', error);
      return 0;
    }
  }

  private getTimeWindow(): Date {
    // Round down to the nearest minute
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0);
  }

  private getNextTimeWindow(): Date {
    const current = this.getTimeWindow();
    return new Date(current.getTime() + 60000); // Add 1 minute
  }

  private getCachedUsage(cacheKey: string): QuotaUsage | null {
    const expiry = this.cacheExpiry.get(cacheKey);
    if (!expiry || Date.now() > expiry) {
      this.cache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);
      return null;
    }
    return this.cache.get(cacheKey) || null;
  }

  private mapToQuotaUsage(record: any): QuotaUsage {
    return {
      apiProvider: record.api_provider,
      quotaType: record.quota_type,
      timeWindow: new Date(record.time_window),
      quotaUsed: record.quota_used,
      quotaLimit: record.quota_limit,
      quotaRemaining: record.quota_remaining,
      isRateLimited: record.is_rate_limited,
      rateLimitResetAt: record.rate_limit_reset_at ? new Date(record.rate_limit_reset_at) : undefined
    };
  }
}
