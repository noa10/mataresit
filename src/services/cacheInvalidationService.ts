/**
 * Cache Invalidation Service
 * Manages cache invalidation across the application when data changes
 */

import { QueryClient } from '@tanstack/react-query';
import { subscriptionQueryKeys } from '@/hooks/useSubscription';

export class CacheInvalidationService {
  private static queryClient: QueryClient | null = null;

  /**
   * Initialize the service with a QueryClient instance
   */
  static initialize(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  /**
   * Get the QueryClient instance
   */
  private static getQueryClient(): QueryClient {
    if (!this.queryClient) {
      throw new Error('CacheInvalidationService not initialized. Call initialize() first.');
    }
    return this.queryClient;
  }

  /**
   * Invalidate usage statistics cache when receipts are uploaded/modified
   */
  static async invalidateUsageStats(userId: string) {
    const queryClient = this.getQueryClient();
    
    console.log('🗑️ Invalidating usage stats cache for user:', userId);
    
    await queryClient.invalidateQueries({
      queryKey: subscriptionQueryKeys.usage(userId)
    });
  }

  /**
   * Invalidate receipts cache when receipts are uploaded/modified/deleted
   */
  static async invalidateReceipts(userId?: string) {
    const queryClient = this.getQueryClient();

    console.log('🗑️ Invalidating receipts cache');

    await queryClient.invalidateQueries({
      queryKey: ['receipts']
    });

    // Also invalidate user-specific usage stats if userId provided
    if (userId) {
      await this.invalidateUsageStats(userId);
    }
  }

  /**
   * Invalidate categories cache for both personal and team contexts
   */
  static async invalidateCategories(teamId?: string | null) {
    const queryClient = this.getQueryClient();

    console.log('🗑️ Invalidating categories cache', teamId ? `for team: ${teamId}` : 'for personal workspace');

    if (teamId) {
      // Invalidate specific team categories
      await queryClient.invalidateQueries({
        queryKey: ['categories', teamId]
      });
    } else {
      // Invalidate personal categories
      await queryClient.invalidateQueries({
        queryKey: ['categories', null]
      });
    }

    // Also invalidate the general categories cache for safety
    await queryClient.invalidateQueries({
      queryKey: ['categories']
    });
  }

  /**
   * Invalidate analytics cache when data changes
   */
  static async invalidateAnalytics(userId?: string) {
    const queryClient = this.getQueryClient();
    
    console.log('🗑️ Invalidating analytics cache');
    
    await queryClient.invalidateQueries({
      queryKey: ['analytics']
    });

    await queryClient.invalidateQueries({
      queryKey: ['dailyExpenseDetails']
    });

    if (userId) {
      await this.invalidateUsageStats(userId);
    }
  }

  /**
   * Invalidate search cache when receipts change
   */
  static async invalidateSearch() {
    const queryClient = this.getQueryClient();
    
    console.log('🗑️ Invalidating search cache');
    
    await queryClient.invalidateQueries({
      queryKey: ['search']
    });
  }

  /**
   * Comprehensive invalidation when a receipt is uploaded
   * This ensures all related data is refreshed
   */
  static async onReceiptUploaded(userId: string) {
    console.log('📤 Receipt uploaded - invalidating related caches');
    
    await Promise.all([
      this.invalidateUsageStats(userId),
      this.invalidateReceipts(userId),
      this.invalidateAnalytics(userId),
      this.invalidateSearch(),
    ]);
  }

  /**
   * Comprehensive invalidation when a receipt is updated
   */
  static async onReceiptUpdated(userId: string) {
    console.log('✏️ Receipt updated - invalidating related caches');
    
    await Promise.all([
      this.invalidateReceipts(userId),
      this.invalidateAnalytics(userId),
      this.invalidateSearch(),
    ]);
  }

  /**
   * Comprehensive invalidation when a receipt is deleted
   */
  static async onReceiptDeleted(userId: string) {
    console.log('🗑️ Receipt deleted - invalidating related caches');
    
    await Promise.all([
      this.invalidateUsageStats(userId),
      this.invalidateReceipts(userId),
      this.invalidateAnalytics(userId),
      this.invalidateSearch(),
    ]);
  }

  /**
   * Invalidate subscription-related cache when subscription changes
   */
  static async onSubscriptionChanged(userId: string) {
    console.log('💳 Subscription changed - invalidating subscription caches');
    
    await this.invalidateUsageStats(userId);
  }

  /**
   * Force refresh all caches (use sparingly)
   */
  static async refreshAllCaches() {
    const queryClient = this.getQueryClient();
    
    console.log('🔄 Force refreshing all caches');
    
    await queryClient.invalidateQueries();
  }

  /**
   * Get cache statistics for debugging
   */
  static getCacheStats() {
    const queryClient = this.getQueryClient();
    
    return {
      queryCache: queryClient.getQueryCache(),
      mutationCache: queryClient.getMutationCache(),
      defaultOptions: queryClient.getDefaultOptions(),
    };
  }
}

/**
 * Hook to get cache invalidation functions
 * This provides a convenient way to access cache invalidation in components
 */
export function useCacheInvalidation() {
  return {
    invalidateUsageStats: CacheInvalidationService.invalidateUsageStats,
    invalidateReceipts: CacheInvalidationService.invalidateReceipts,
    invalidateAnalytics: CacheInvalidationService.invalidateAnalytics,
    invalidateSearch: CacheInvalidationService.invalidateSearch,
    onReceiptUploaded: CacheInvalidationService.onReceiptUploaded,
    onReceiptUpdated: CacheInvalidationService.onReceiptUpdated,
    onReceiptDeleted: CacheInvalidationService.onReceiptDeleted,
    onSubscriptionChanged: CacheInvalidationService.onSubscriptionChanged,
    refreshAllCaches: CacheInvalidationService.refreshAllCaches,
    getCacheStats: CacheInvalidationService.getCacheStats,
  };
}
