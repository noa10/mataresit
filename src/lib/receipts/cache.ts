// Cache for normalized merchant names
const merchantCache = new Map<string, string>();

// Maximum size for the cache to prevent memory issues
const MAX_CACHE_SIZE = 1000;

/**
 * Get a normalized merchant name from cache or compute and cache it
 * @param merchant The merchant name to normalize
 * @param normalizer The function to normalize the merchant name
 * @returns The normalized merchant name
 */
export function getCachedNormalizedMerchant(
  merchant: string,
  normalizer: (name: string) => string
): string {
  const key = merchant.toLowerCase();
  
  // Check cache first
  if (merchantCache.has(key)) {
    return merchantCache.get(key)!;
  }
  
  // If cache is full, remove oldest entries (20% of max size)
  if (merchantCache.size >= MAX_CACHE_SIZE) {
    const entriesToRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
    const keys = Array.from(merchantCache.keys()).slice(0, entriesToRemove);
    keys.forEach(k => merchantCache.delete(k));
  }
  
  // Compute and cache the normalized name
  const normalized = normalizer(merchant);
  merchantCache.set(key, normalized);
  
  return normalized;
}

/**
 * Clear the merchant name cache
 */
export function clearMerchantCache(): void {
  merchantCache.clear();
}

/**
 * Get the current size of the merchant cache
 */
export function getMerchantCacheSize(): number {
  return merchantCache.size;
}

/**
 * Check if a merchant name is in the cache
 */
export function isMerchantCached(merchant: string): boolean {
  return merchantCache.has(merchant.toLowerCase());
} 