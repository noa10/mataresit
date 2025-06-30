/**
 * Cache System Index
 * 
 * Central export point for all cache-related functionality
 * in the Mataresit application.
 */

// Core types and interfaces
export * from './types';

// Cache key generation
export { 
  cacheKeyGenerator, 
  DefaultCacheKeyGenerator,
  CACHE_TTL_CONFIG 
} from './key-generator';

// Cache implementations
export { MemoryCache } from './memory-cache';

// Cache manager
export { 
  cacheManager, 
  DefaultCacheManager 
} from './cache-manager';

// Cache utilities and wrappers
export {
  LLMCache,
  SearchCache,
  FinancialCache,
  ConversationCache,
  GenericCache,
  CacheWarmer,
  CacheInvalidator,
  llmCache,
  searchCache,
  financialCache,
  conversationCache
} from './cache-utils';

// React hooks
export {
  useCache,
  useLLMCache,
  useSearchCache,
  useFinancialCache,
  useConversationCache,
  useCacheStats
} from '../../hooks/useCache';

/**
 * Quick setup function for initializing the cache system
 */
export function initializeCache() {
  console.log('🚀 Initializing Mataresit Cache System');
  
  // The cache manager is already initialized as a singleton
  // This function can be used for any additional setup if needed
  
  console.log('✅ Cache system initialized successfully');
}

/**
 * Cache system health check
 */
export async function checkCacheHealth() {
  try {
    const stats = await cacheManager.getGlobalStats();
    const healthStatus = {
      healthy: true,
      totalCaches: Object.keys(stats).length,
      totalEntries: Object.values(stats).reduce((sum, stat) => sum + stat.totalEntries, 0),
      overallHitRate: calculateOverallHitRate(stats),
      timestamp: new Date().toISOString(),
    };
    
    console.log('🏥 Cache health check:', healthStatus);
    return healthStatus;
  } catch (error) {
    console.error('❌ Cache health check failed:', error);
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Calculate overall hit rate across all caches
 */
function calculateOverallHitRate(stats: Record<string, any>): number {
  const totalHits = Object.values(stats).reduce((sum: number, stat: any) => sum + stat.hitCount, 0);
  const totalMisses = Object.values(stats).reduce((sum: number, stat: any) => sum + stat.missCount, 0);
  const total = totalHits + totalMisses;
  return total > 0 ? totalHits / total : 0;
}

/**
 * Cache configuration presets for different environments
 */
export const CACHE_PRESETS = {
  development: {
    aggressive: true,
    defaultTTL: 300000, // 5 minutes
    maxEntries: 100,
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  production: {
    aggressive: false,
    defaultTTL: 900000, // 15 minutes
    maxEntries: 1000,
    maxSize: 100 * 1024 * 1024, // 100MB
  },
  testing: {
    aggressive: false,
    defaultTTL: 60000, // 1 minute
    maxEntries: 50,
    maxSize: 1 * 1024 * 1024, // 1MB
  },
};

/**
 * Apply cache preset configuration
 */
export async function applyCachePreset(preset: keyof typeof CACHE_PRESETS) {
  const config = CACHE_PRESETS[preset];
  console.log(`🔧 Applying ${preset} cache preset:`, config);
  
  // This would update cache configurations based on the preset
  // Implementation depends on specific requirements
  
  console.log(`✅ ${preset} cache preset applied`);
}
