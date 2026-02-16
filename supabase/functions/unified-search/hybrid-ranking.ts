/**
 * Hybrid Search Ranking Module
 * 
 * Implements a multi-factor ranking algorithm combining:
 * - Vector similarity score (40% weight)
 * - Full-text search rank ts_rank (30% weight)
 * - Recency boost (20% weight)
 * - Category/merchant popularity (10% weight)
 * 
 * Also implements configurable result diversity mode and fallback chain.
 */

import { UnifiedSearchResult, UnifiedSearchParams } from './types.ts';

export interface HybridRankingConfig {
  vectorWeight: number;      // Default: 0.4
  fullTextWeight: number;     // Default: 0.3
  recencyWeight: number;     // Default: 0.2
  popularityWeight: number;   // Default: 0.1
  diversityMode?: 'relevance' | 'diversity' | 'recency';
  maxResultsPerSource?: number;
}

export interface RankingScore {
  resultId: string;
  vectorScore: number;
  fullTextScore: number;
  recencyScore: number;
  popularityScore: number;
  combinedScore: number;
}

export interface FallbackChainResult {
  method: 'vector' | 'full_text' | 'fuzzy' | 'keyword';
  results: UnifiedSearchResult[];
  success: boolean;
  error?: string;
}

const DEFAULT_CONFIG: HybridRankingConfig = {
  vectorWeight: 0.4,
  fullTextWeight: 0.3,
  recencyWeight: 0.2,
  popularityWeight: 0.1,
  diversityMode: 'relevance'
};

/**
 * Calculate recency score based on createdAt date
 * Recent items get higher scores (1.0), decreasing over time
 */
function calculateRecencyScore(createdAt: string, decayFactor: number = 0.05): number {
  if (!createdAt) return 0.5;
  
  const now = new Date();
  const created = new Date(createdAt);
  const daysDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
  
  // Exponential decay - older items get lower scores
  // After 60 days, score drops to ~0.05
  const score = Math.exp(-decayFactor * daysDiff);
  return Math.max(0.05, Math.min(1.0, score));
}

/**
 * Get popularity score based on metadata (usage count, category frequency)
 */
async function calculatePopularityScore(
  result: UnifiedSearchResult,
  supabase: any,
  userId: string
): Promise<number> {
  let popularityScore = 0.5; // Default neutral score
  
  try {
    switch (result.sourceType) {
      case 'receipt': {
        // Check category frequency for this user
        const category = result.metadata?.category;
        if (category) {
          const { data: categoryData } = await supabase
            .from('receipts')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('predicted_category', category);
          
          // Normalize: more receipts = higher popularity (max at 100)
          const count = categoryData?.length || 0;
          popularityScore = Math.min(1.0, count / 100 + 0.3);
        }
        break;
      }
      case 'business_directory': {
        // Business directory popularity based on keywords match count
        const keywords = result.metadata?.keywords || [];
        popularityScore = Math.min(1.0, keywords.length * 0.1 + 0.5);
        break;
      }
      default:
        popularityScore = 0.5;
    }
  } catch (error) {
    console.warn('Error calculating popularity score:', error);
  }
  
  return popularityScore;
}

/**
 * Normalize score to 0-1 range
 */
function normalizeScore(score: number, min?: number, max?: number): number {
  if (min === undefined || max === undefined) {
    return Math.max(0, Math.min(1, score));
  }
  if (max === min) return 1;
  return Math.max(0, Math.min(1, (score - min) / (max - min)));
}

/**
 * Apply diversity mode to results
 */
function applyDiversityMode(
  results: UnifiedSearchResult[],
  mode: 'relevance' | 'diversity' | 'recency',
  maxPerSource?: number
): UnifiedSearchResult[] {
  if (mode === 'relevance') {
    // Just sort by similarity descending
    return results.sort((a, b) => b.similarity - a.similarity);
  }
  
  if (mode === 'recency') {
    // Sort by date descending
    return results.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
  }
  
  // Diversity mode: distribute results across different sources
  if (mode === 'diversity') {
    const sourceGroups = new Map<string, UnifiedSearchResult[]>();
    
    // Group by source type
    results.forEach(result => {
      const sourceType = result.sourceType;
      if (!sourceGroups.has(sourceType)) {
        sourceGroups.set(sourceType, []);
      }
      sourceGroups.get(sourceType)!.push(result);
    });
    
    // Interleave results from each source
    const interleaved: UnifiedSearchResult[] = [];
    let hasMore = true;
    let sourceIndices = new Map<string, number>();
    
    sourceGroups.forEach((_, key) => sourceIndices.set(key, 0));
    
    const maxPer = maxPerSource || Math.ceil(results.length / sourceGroups.size);
    
    while (interleaved.length < results.length && hasMore) {
      hasMore = false;
      
      for (const [sourceType, groupResults] of sourceGroups) {
        const currentIndex = sourceIndices.get(sourceType) || 0;
        
        if (currentIndex < groupResults.length && currentIndex < maxPer) {
          interleaved.push(groupResults[currentIndex]);
          sourceIndices.set(sourceType, currentIndex + 1);
          hasMore = true;
        }
      }
    }
    
    return interleaved;
  }
  
  return results;
}

/**
 * Main hybrid ranking function
 */
export async function hybridRankResults(
  results: UnifiedSearchResult[],
  supabase: any,
  userId: string,
  config: Partial<HybridRankingConfig> = {}
): Promise<UnifiedSearchResult[]> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  if (results.length === 0) {
    return results;
  }
  
  console.log('🔍 Hybrid ranking starting with', results.length, 'results');
  console.log('🔍 Config:', finalConfig);
  
  // Calculate all ranking scores
  const scores: RankingScore[] = await Promise.all(
    results.map(async (result) => {
      // Vector score comes from the similarity field (already 0-1)
      const vectorScore = result.similarity || 0;
      
      // Full-text score - use metadata if available, otherwise derive from similarity
      const fullTextScore = result.metadata?.tsRank || result.similarity || 0.5;
      
      // Recency score
      const recencyScore = calculateRecencyScore(result.createdAt);
      
      // Popularity score
      const popularityScore = await calculatePopularityScore(result, supabase, userId);
      
      // Combined weighted score
      const combinedScore = 
        (vectorScore * finalConfig.vectorWeight) +
        (fullTextScore * finalConfig.fullTextWeight) +
        (recencyScore * finalConfig.recencyWeight) +
        (popularityScore * finalConfig.popularityWeight);
      
      return {
        resultId: result.id,
        vectorScore,
        fullTextScore,
        recencyScore,
        popularityScore,
        combinedScore
      };
    })
  );
  
  // Log score distribution for debugging
  console.log('🔍 Score distribution:', {
    avgVector: (scores.reduce((a, b) => a + b.vectorScore, 0) / scores.length).toFixed(3),
    avgFullText: (scores.reduce((a, b) => a + b.fullTextScore, 0) / scores.length).toFixed(3),
    avgRecency: (scores.reduce((a, b) => a + b.recencyScore, 0) / scores.length).toFixed(3),
    avgPopularity: (scores.reduce((a, b) => a + b.popularityScore, 0) / scores.length).toFixed(3),
    avgCombined: (scores.reduce((a, b) => a + b.combinedScore, 0) / scores.length).toFixed(3)
  });
  
  // Attach scores to results for debugging
  results.forEach((result, index) => {
    (result as any).rankingScore = scores[index];
  });
  
  // Sort by combined score
  const sortedByScore = [...results].sort((a, b) => {
    const scoreA = (a as any).rankingScore?.combinedScore || 0;
    const scoreB = (b as any).rankingScore?.combinedScore || 0;
    return scoreB - scoreA;
  });
  
  // Apply diversity mode if specified
  const diversifiedResults = applyDiversityMode(
    sortedByScore,
    finalConfig.diversityMode || 'relevance',
    finalConfig.maxResultsPerSource
  );
  
  console.log('🔍 Hybrid ranking complete, results sorted by combined score');
  
  return diversifiedResults;
}

/**
 * Fallback chain execution
 * Tries methods in order: vector → full-text → fuzzy → keyword
 */
export async function executeFallbackChain(
  supabase: any,
  params: UnifiedSearchParams,
  userId: string,
  queryEmbedding: number[]
): Promise<FallbackChainResult> {
  const methods: FallbackChainResult['method'][] = ['vector', 'full_text', 'fuzzy', 'keyword'];
  
  for (const method of methods) {
    console.log(`🔄 Trying fallback method: ${method}`);
    
    try {
      let results: UnifiedSearchResult[] = [];
      
      switch (method) {
        case 'vector': {
          // Vector search (primary)
          const vectorResult = await executeVectorSearch(supabase, params, userId, queryEmbedding);
          if (vectorResult.length > 0) {
            return { method, results: vectorResult, success: true };
          }
          break;
        }
        
        case 'full_text': {
          // Full-text search with ts_rank
          const ftResult = await executeFullTextSearch(supabase, params, userId);
          if (ftResult.length > 0) {
            return { method, results: ftResult, success: true };
          }
          break;
        }
        
        case 'fuzzy': {
          // Fuzzy matching (trigram)
          const fuzzyResult = await executeFuzzySearch(supabase, params, userId);
          if (fuzzyResult.length > 0) {
            return { method, results: fuzzyResult, success: true };
          }
          break;
        }
        
        case 'keyword': {
          // Basic keyword search
          const keywordResult = await executeKeywordSearch(supabase, params, userId);
          return { 
            method, 
            results: keywordResult, 
            success: keywordResult.length > 0,
            error: keywordResult.length === 0 ? 'No results found' : undefined
          };
        }
      }
    } catch (error) {
      console.warn(`⚠️ Fallback method ${method} failed:`, error);
      // Continue to next method
    }
  }
  
  return { 
    method: 'keyword', 
    results: [], 
    success: false, 
    error: 'All fallback methods exhausted' 
  };
}

/**
 * Vector similarity search
 */
async function executeVectorSearch(
  supabase: any,
  params: UnifiedSearchParams,
  userId: string,
  queryEmbedding: number[]
): Promise<UnifiedSearchResult[]> {
  try {
    const { data, error } = await supabase.rpc('unified_search', {
      query_embedding: queryEmbedding,
      source_types: params.sources,
      similarity_threshold: 0.0,
      match_count: params.limit || 20,
      user_filter: userId,
      team_filter: params.filters?.teamId
    });
    
    if (error) throw error;
    return transformResults(data || []);
  } catch (error) {
    console.warn('Vector search failed:', error);
    return [];
  }
}

/**
 * Full-text search with ts_rank
 */
async function executeFullTextSearch(
  supabase: any,
  params: UnifiedSearchParams,
  userId: string
): Promise<UnifiedSearchResult[]> {
  try {
    const query = params.query.toLowerCase();
    const sources = params.sources || ['receipt'];
    const results: UnifiedSearchResult[] = [];
    
    for (const source of sources) {
      let queryBuilder;
      
      switch (source) {
        case 'receipt':
          queryBuilder = supabase
            .from('receipts')
            .select('id, merchant, total, currency, date, status, predicted_category, "fullText", created_at')
            .eq('user_id', userId)
            .or(`merchant.ilike.%${query}%,"fullText".ilike.%${query}%`)
            .order('created_at', { ascending: false });
          break;
          
        case 'business_directory':
          queryBuilder = supabase
            .from('malaysian_business_directory')
            .select('id, business_name, business_name_malay, business_type, state, city, is_active, keywords')
            .eq('is_active', true)
            .or(`business_name.ilike.%${query}%,business_name_malay.ilike.%${query}%`)
            .order('business_name');
          break;
          
        default:
          continue;
      }
      
      const { data, error } = await queryBuilder.limit(params.limit || 20);
      
      if (!error && data) {
        results.push(...transformResults(data, source));
      }
    }
    
    return results;
  } catch (error) {
    console.warn('Full-text search failed:', error);
    return [];
  }
}

/**
 * Fuzzy search using trigram similarity
 */
async function executeFuzzySearch(
  supabase: any,
  params: UnifiedSearchParams,
  userId: string
): Promise<UnifiedSearchResult[]> {
  try {
    const query = params.query.toLowerCase();
    const sources = params.sources || ['receipt'];
    const results: UnifiedSearchResult[] = [];
    
    for (const source of sources) {
      let queryBuilder;
      
      switch (source) {
        case 'receipt':
          // Use ILIKE with wildcards for fuzzy matching
          queryBuilder = supabase
            .from('receipts')
            .select('id, merchant, total, currency, date, status, predicted_category, "fullText", created_at')
            .eq('user_id', userId)
            .or(`merchant.ilike.%${query}%,"fullText".ilike.%${query}%`)
            .order('created_at', { ascending: false });
          break;
          
        default:
          continue;
      }
      
      const { data, error } = await queryBuilder.limit(params.limit || 20);
      
      if (!error && data) {
        results.push(...transformResults(data, source));
      }
    }
    
    return results;
  } catch (error) {
    console.warn('Fuzzy search failed:', error);
    return [];
  }
}

/**
 * Basic keyword search
 */
async function executeKeywordSearch(
  supabase: any,
  params: UnifiedSearchParams,
  userId: string
): Promise<UnifiedSearchResult[]> {
  try {
    const query = params.query.toLowerCase();
    const sources = params.sources || ['receipt'];
    const results: UnifiedSearchResult[] = [];
    
    for (const source of sources) {
      let queryBuilder;
      
      switch (source) {
        case 'receipt':
          queryBuilder = supabase
            .from('receipts')
            .select('id, merchant, total, currency, date, status, predicted_category, created_at')
            .eq('user_id', userId)
            .ilike('merchant', `%${query}%`)
            .order('created_at', { ascending: false });
          break;
          
        case 'business_directory':
          queryBuilder = supabase
            .from('malaysian_business_directory')
            .select('id, business_name, business_name_malay, business_type, state, city, is_active')
            .eq('is_active', true)
            .ilike('business_name', `%${query}%`)
            .order('business_name');
          break;
          
        case 'custom_category':
          queryBuilder = supabase
            .from('custom_categories')
            .select('id, name, color, icon, user_id, created_at')
            .eq('user_id', userId)
            .ilike('name', `%${query}%`)
            .order('name');
          break;
          
        default:
          continue;
      }
      
      const { data, error } = await queryBuilder.limit(params.limit || 20);
      
      if (!error && data) {
        results.push(...transformResults(data, source));
      }
    }
    
    return results;
  } catch (error) {
    console.warn('Keyword search failed:', error);
    return [];
  }
}

/**
 * Transform database results to UnifiedSearchResult format
 */
function transformResults(data: any[], sourceType?: string): UnifiedSearchResult[] {
  return (data || []).map((item: any) => {
    const source = item.source_type || sourceType || 'receipt';
    
    switch (source) {
      case 'receipt':
        return {
          id: item.id,
          sourceType: 'receipt' as const,
          sourceId: item.id,
          contentType: 'full_text',
          title: item.merchant || 'Unknown Merchant',
          description: `${item.currency || ''} ${item.total || 'N/A'} on ${item.date || 'Unknown'}`,
          similarity: item.similarity || 0.5,
          metadata: {
            merchant: item.merchant,
            total: item.total,
            currency: item.currency,
            date: item.date,
            status: item.status,
            category: item.predicted_category,
            tsRank: item.ts_rank
          },
          accessLevel: 'user',
          createdAt: item.created_at || new Date().toISOString()
        };
        
      case 'business_directory':
        return {
          id: item.id,
          sourceType: 'business_directory' as const,
          sourceId: item.id,
          contentType: 'business_name',
          title: item.business_name || item.business_name_malay || 'Business',
          description: `${item.business_type || 'Business'} in ${item.city || item.state || 'Malaysia'}`,
          similarity: item.similarity || 0.5,
          metadata: {
            business_name: item.business_name,
            business_name_malay: item.business_name_malay,
            business_type: item.business_type,
            state: item.state,
            city: item.city,
            keywords: item.keywords,
            tsRank: item.ts_rank
          },
          accessLevel: 'public',
          createdAt: new Date().toISOString()
        };
        
      case 'custom_category':
        return {
          id: item.id,
          sourceType: 'custom_category' as const,
          sourceId: item.id,
          contentType: 'name',
          title: item.name || 'Category',
          description: `Category: ${item.name || 'Unnamed'}`,
          similarity: item.similarity || 0.5,
          metadata: {
            name: item.name,
            color: item.color,
            icon: item.icon,
            tsRank: item.ts_rank
          },
          accessLevel: 'user',
          createdAt: item.created_at || new Date().toISOString()
        };
        
      default:
        return {
          id: item.id,
          sourceType: source as any,
          sourceId: item.id,
          contentType: 'full_text',
          title: item.title || 'Result',
          description: item.description || '',
          similarity: item.similarity || 0.5,
          metadata: item,
          accessLevel: 'user',
          createdAt: item.created_at || new Date().toISOString()
        };
    }
  });
}

/**
 * Create ranking configuration from search params
 */
export function createRankingConfig(params: UnifiedSearchParams): HybridRankingConfig {
  return {
    vectorWeight: 0.4,
    fullTextWeight: 0.3,
    recencyWeight: 0.2,
    popularityWeight: 0.1,
    diversityMode: params.aggregationMode as any || 'relevance',
    maxResultsPerSource: Math.ceil((params.limit || 20) / (params.sources?.length || 2))
  };
}
