/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

/**
 * Performance Cache Edge Function
 * Provides caching and optimization services for Malaysian multi-language features
 */

interface CacheRequest {
  action: 'get' | 'set' | 'invalidate' | 'refresh_views' | 'get_metrics';
  key?: string;
  value?: any;
  ttl?: number; // Time to live in seconds
  metric_type?: string;
  start_date?: string;
  end_date?: string;
}

interface CacheEntry {
  key: string;
  value: any;
  expires_at: string;
  created_at: string;
}

// In-memory cache for this Edge Function instance
const memoryCache = new Map<string, CacheEntry>();

/**
 * Generate cache key for Malaysian business data
 */
function generateCacheKey(type: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|');
  return `${type}:${sortedParams}`;
}

/**
 * Check if cache entry is expired
 */
function isCacheExpired(entry: CacheEntry): boolean {
  return new Date() > new Date(entry.expires_at);
}

/**
 * Get cached Malaysian business data
 */
async function getCachedData(key: string): Promise<any | null> {
  // Check memory cache first
  const memoryEntry = memoryCache.get(key);
  if (memoryEntry && !isCacheExpired(memoryEntry)) {
    console.log(`🎯 Memory cache hit for key: ${key}`);
    return memoryEntry.value;
  }

  // Remove expired entry from memory
  if (memoryEntry && isCacheExpired(memoryEntry)) {
    memoryCache.delete(key);
  }

  // Check database cache (for persistent caching across function instances)
  try {
    const { data, error } = await supabase
      .from('performance_cache')
      .select('*')
      .eq('cache_key', key)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      console.log(`❌ Cache miss for key: ${key}`);
      return null;
    }

    console.log(`💾 Database cache hit for key: ${key}`);
    
    // Store in memory cache for faster subsequent access
    const cacheEntry: CacheEntry = {
      key: data.cache_key,
      value: data.cache_value,
      expires_at: data.expires_at,
      created_at: data.created_at
    };
    memoryCache.set(key, cacheEntry);

    return data.cache_value;
  } catch (error) {
    console.error('Error accessing cache:', error);
    return null;
  }
}

/**
 * Set cached data
 */
async function setCachedData(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  
  const cacheEntry: CacheEntry = {
    key,
    value,
    expires_at: expiresAt.toISOString(),
    created_at: new Date().toISOString()
  };

  // Store in memory cache
  memoryCache.set(key, cacheEntry);

  // Store in database cache for persistence
  try {
    const { error } = await supabase
      .from('performance_cache')
      .upsert({
        cache_key: key,
        cache_value: value,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error storing cache in database:', error);
    } else {
      console.log(`✅ Cached data for key: ${key} (TTL: ${ttlSeconds}s)`);
    }
  } catch (error) {
    console.error('Error storing cache:', error);
  }
}

/**
 * Invalidate cache entries
 */
async function invalidateCache(pattern?: string): Promise<void> {
  if (pattern) {
    // Remove matching entries from memory cache
    for (const [key] of memoryCache) {
      if (key.includes(pattern)) {
        memoryCache.delete(key);
      }
    }

    // Remove matching entries from database cache
    try {
      const { error } = await supabase
        .from('performance_cache')
        .delete()
        .like('cache_key', `%${pattern}%`);

      if (error) {
        console.error('Error invalidating cache:', error);
      } else {
        console.log(`🗑️ Invalidated cache entries matching: ${pattern}`);
      }
    } catch (error) {
      console.error('Error invalidating cache:', error);
    }
  } else {
    // Clear all cache
    memoryCache.clear();
    
    try {
      const { error } = await supabase
        .from('performance_cache')
        .delete()
        .neq('cache_key', ''); // Delete all entries

      if (error) {
        console.error('Error clearing cache:', error);
      } else {
        console.log('🗑️ Cleared all cache entries');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
}

/**
 * Refresh materialized views
 */
async function refreshMaterializedViews(): Promise<void> {
  try {
    const { error } = await supabase.rpc('refresh_malaysian_materialized_views');
    
    if (error) {
      console.error('Error refreshing materialized views:', error);
      throw error;
    }

    console.log('✅ Materialized views refreshed successfully');
    
    // Invalidate related cache entries
    await invalidateCache('malaysian_business');
    await invalidateCache('malaysian_reference');
  } catch (error) {
    console.error('Error refreshing materialized views:', error);
    throw error;
  }
}

/**
 * Get performance metrics
 */
async function getPerformanceMetrics(metricType?: string, startDate?: string, endDate?: string): Promise<any> {
  try {
    const cacheKey = generateCacheKey('performance_metrics', {
      metric_type: metricType || 'all',
      start_date: startDate || 'week',
      end_date: endDate || 'now'
    });

    // Check cache first
    const cachedMetrics = await getCachedData(cacheKey);
    if (cachedMetrics) {
      return cachedMetrics;
    }

    // Query fresh metrics
    let query = supabase
      .from('performance_metrics')
      .select('*')
      .order('created_at', { ascending: false });

    if (metricType) {
      query = query.eq('metric_type', metricType);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query.limit(1000);

    if (error) {
      throw error;
    }

    // Cache the results for 5 minutes
    await setCachedData(cacheKey, data, 300);

    return data;
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, key, value, ttl, metric_type, start_date, end_date }: CacheRequest = await req.json();

    let result: any;

    switch (action) {
      case 'get':
        if (!key) {
          throw new Error('Cache key is required for get action');
        }
        result = await getCachedData(key);
        break;

      case 'set':
        if (!key || value === undefined) {
          throw new Error('Cache key and value are required for set action');
        }
        await setCachedData(key, value, ttl || 3600);
        result = { success: true, message: 'Data cached successfully' };
        break;

      case 'invalidate':
        await invalidateCache(key);
        result = { success: true, message: 'Cache invalidated successfully' };
        break;

      case 'refresh_views':
        await refreshMaterializedViews();
        result = { success: true, message: 'Materialized views refreshed successfully' };
        break;

      case 'get_metrics':
        result = await getPerformanceMetrics(metric_type, start_date, end_date);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Performance cache error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
