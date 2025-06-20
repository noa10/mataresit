import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.1.3';
import { supabaseClient } from '../_shared/supabase-client.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { validateSearchParams, preprocessQuery, shouldUseFallback } from './utils.ts';
import { executeFallbackSearch } from './fallback.ts';
import type { UnifiedSearchParams, UnifiedSearchResult, UnifiedSearchResponse } from './types.ts';

// Environment variables
const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Model configuration for embeddings
const DEFAULT_EMBEDDING_MODEL = 'embedding-001';
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generate embedding for search query
 */
async function generateEmbedding(text: string): Promise<number[]> {
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: DEFAULT_EMBEDDING_MODEL });
    const result = await model.embedContent(text);
    let embedding = result.embedding.values;

    // Handle dimension mismatch - Gemini returns 768 dimensions but we need 1536 for pgvector
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      console.log(`Converting embedding dimensions from ${embedding.length} to ${EMBEDDING_DIMENSIONS}`);
      
      if (embedding.length === 768) {
        // Pad with zeros to reach 1536 dimensions
        const paddedEmbedding = new Array(EMBEDDING_DIMENSIONS).fill(0);
        for (let i = 0; i < embedding.length; i++) {
          paddedEmbedding[i] = embedding[i];
        }
        embedding = paddedEmbedding;
      } else {
        throw new Error(`Unexpected embedding dimension: ${embedding.length}`);
      }
    }

    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

/**
 * Validate and authenticate request
 */
async function validateRequest(req: Request): Promise<{ params: UnifiedSearchParams; user: any }> {
  // Check authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }

  const supabase = supabaseClient(authHeader);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Invalid authentication token');
  }

  // Parse and validate request body
  const body = await req.json();
  const validation = validateSearchParams(body);

  if (!validation.isValid) {
    throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
  }

  // Preprocess query for better search results
  const processedQuery = preprocessQuery(validation.sanitizedParams!.query);

  const params: UnifiedSearchParams = {
    ...validation.sanitizedParams!,
    query: processedQuery
  };

  return { params, user };
}

/**
 * Check subscription limits and enforce tier-based access
 */
async function enforceSubscriptionLimits(
  supabase: any,
  user: any,
  params: UnifiedSearchParams
): Promise<{ allowed: boolean; filteredParams: UnifiedSearchParams; limits: any }> {
  try {
    const { data: subscriptionCheck, error } = await supabase.rpc('can_perform_unified_search', {
      p_user_id: user.id,
      p_sources: params.sources,
      p_result_limit: params.limit
    });

    if (error) {
      console.error('Error checking subscription limits:', error);
      throw new Error('Failed to verify subscription limits');
    }

    if (!subscriptionCheck.allowed) {
      return {
        allowed: false,
        filteredParams: params,
        limits: subscriptionCheck
      };
    }

    // Apply subscription-based filtering
    const filteredParams: UnifiedSearchParams = {
      ...params,
      sources: subscriptionCheck.filtered_sources || params.sources,
      limit: subscriptionCheck.filtered_limit || params.limit
    };

    return {
      allowed: true,
      filteredParams,
      limits: subscriptionCheck
    };
  } catch (error) {
    console.error('Subscription enforcement error:', error);
    throw new Error('Failed to enforce subscription limits');
  }
}

/**
 * Main unified search handler
 */
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let searchMetadata = {
    queryEmbedding: undefined as number[] | undefined,
    sourcesSearched: [] as string[],
    searchDuration: 0,
    subscriptionLimitsApplied: false,
    fallbacksUsed: [] as string[]
  };

  try {
    console.log('Unified search request received');

    // Validate request and authenticate user
    const { params, user } = await validateRequest(req);
    console.log('Request validated for user:', user.id);

    // Check subscription limits
    const supabase = supabaseClient(req.headers.get('Authorization')!);
    const { allowed, filteredParams, limits } = await enforceSubscriptionLimits(supabase, user, params);

    if (!allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: limits.reason || 'Search not allowed for current subscription',
          results: [],
          totalResults: 0,
          searchMetadata,
          pagination: { hasMore: false, totalPages: 0 }
        } as UnifiedSearchResponse),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    searchMetadata.subscriptionLimitsApplied = true;
    console.log('Subscription limits enforced:', limits);

    // Generate query embedding
    console.log('Generating embedding for query:', filteredParams.query);
    const queryEmbedding = await generateEmbedding(filteredParams.query);
    searchMetadata.queryEmbedding = queryEmbedding;
    console.log('Embedding generated successfully');

    // Execute unified search with fallback handling
    let searchResults;
    let fallbackUsed = false;

    try {
      searchResults = await executeUnifiedSearch(supabase, queryEmbedding, filteredParams, user);
      searchMetadata.sourcesSearched = filteredParams.sources || [];
    } catch (searchError) {
      console.error('Primary search failed:', searchError);

      if (shouldUseFallback(searchError)) {
        console.log('Attempting fallback search...');
        const fallbackResult = await executeFallbackSearch(supabase, filteredParams, user, searchError);
        searchResults = {
          results: fallbackResult.results,
          totalResults: fallbackResult.results.length,
          hasMore: false
        };
        searchMetadata.fallbacksUsed.push(fallbackResult.fallbackInfo.method);
        fallbackUsed = true;
      } else {
        throw searchError; // Re-throw if fallback not appropriate
      }
    }

    // Calculate search duration
    searchMetadata.searchDuration = Date.now() - startTime;

    // Return successful response
    const response: UnifiedSearchResponse = {
      success: true,
      results: searchResults.results,
      totalResults: searchResults.totalResults,
      searchMetadata: {
        ...searchMetadata,
        modelUsed: fallbackUsed ? 'text-search-fallback' : 'gemini-embedding-001',
        embeddingDimensions: fallbackUsed ? undefined : EMBEDDING_DIMENSIONS
      },
      pagination: {
        hasMore: searchResults.hasMore,
        nextOffset: searchResults.nextOffset,
        totalPages: Math.ceil(searchResults.totalResults / filteredParams.limit!)
      }
    };

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Unified search error:', error);
    searchMetadata.searchDuration = Date.now() - startTime;

    const errorResponse: UnifiedSearchResponse = {
      success: false,
      error: error.message || 'Internal server error',
      results: [],
      totalResults: 0,
      searchMetadata,
      pagination: { hasMore: false, totalPages: 0 }
    };

    return new Response(
      JSON.stringify(errorResponse),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

/**
 * Execute unified search across multiple sources
 */
async function executeUnifiedSearch(
  supabase: any,
  queryEmbedding: number[],
  params: UnifiedSearchParams,
  user: any
): Promise<{ results: UnifiedSearchResult[]; totalResults: number; hasMore: boolean; nextOffset?: number }> {
  try {
    console.log('Executing unified search with sources:', params.sources);

    // Execute search using the unified_search database function
    const { data: searchResults, error } = await supabase.rpc('unified_search', {
      query_embedding: queryEmbedding,
      source_types: params.sources,
      content_types: params.contentTypes,
      similarity_threshold: params.similarityThreshold,
      match_count: (params.limit! + params.offset!) * 2, // Get extra results for filtering
      user_filter: user.id,
      team_filter: params.filters?.teamId,
      language_filter: params.filters?.language
    });

    if (error) {
      console.error('Database search error:', error);
      throw new Error(`Search failed: ${error.message}`);
    }

    if (!searchResults || searchResults.length === 0) {
      console.log('No search results found');
      return {
        results: [],
        totalResults: 0,
        hasMore: false
      };
    }

    console.log(`Found ${searchResults.length} raw search results`);

    // Transform database results to unified format
    const transformedResults = await transformSearchResults(supabase, searchResults, params);

    // Apply additional filtering if needed
    const filteredResults = applyAdditionalFilters(transformedResults, params);

    // Apply pagination
    const paginatedResults = filteredResults.slice(params.offset!, params.offset! + params.limit!);
    const hasMore = filteredResults.length > params.offset! + params.limit!;
    const nextOffset = hasMore ? params.offset! + params.limit! : undefined;

    // Apply aggregation/sorting
    const finalResults = applyAggregation(paginatedResults, params.aggregationMode!);

    console.log(`Returning ${finalResults.length} results (${filteredResults.length} total found)`);

    return {
      results: finalResults,
      totalResults: filteredResults.length,
      hasMore,
      nextOffset
    };

  } catch (error) {
    console.error('Error in executeUnifiedSearch:', error);
    throw error;
  }
}

/**
 * Transform database search results to unified format
 */
async function transformSearchResults(
  supabase: any,
  searchResults: any[],
  params: UnifiedSearchParams
): Promise<UnifiedSearchResult[]> {
  const transformedResults: UnifiedSearchResult[] = [];

  for (const result of searchResults) {
    try {
      const transformed = await transformSingleResult(supabase, result, params);
      if (transformed) {
        transformedResults.push(transformed);
      }
    } catch (error) {
      console.warn('Error transforming result:', error);
      // Continue with other results
    }
  }

  return transformedResults;
}

/**
 * Transform a single search result based on its source type
 */
async function transformSingleResult(
  supabase: any,
  result: any,
  params: UnifiedSearchParams
): Promise<UnifiedSearchResult | null> {
  const baseResult = {
    id: result.id,
    sourceType: result.source_type,
    sourceId: result.source_id,
    contentType: result.content_type,
    similarity: result.similarity,
    createdAt: result.created_at
  };

  // Get source-specific data based on source type
  switch (result.source_type) {
    case 'receipt':
      return await transformReceiptResult(supabase, baseResult, result);
    case 'claim':
      return await transformClaimResult(supabase, baseResult, result);
    case 'team_member':
      return await transformTeamMemberResult(supabase, baseResult, result);
    case 'custom_category':
      return await transformCustomCategoryResult(supabase, baseResult, result);
    case 'business_directory':
      return await transformBusinessDirectoryResult(supabase, baseResult, result);
    default:
      console.warn('Unknown source type:', result.source_type);
      return null;
  }
}

/**
 * Transform receipt search result
 */
async function transformReceiptResult(
  supabase: any,
  baseResult: any,
  result: any
): Promise<UnifiedSearchResult> {
  // Get receipt details
  const { data: receipt } = await supabase
    .from('receipts')
    .select('merchant, total, currency, date, status, predicted_category')
    .eq('id', result.source_id)
    .single();

  return {
    ...baseResult,
    title: receipt?.merchant || 'Unknown Merchant',
    description: `${receipt?.currency || ''} ${receipt?.total || 'N/A'} on ${receipt?.date || 'Unknown date'}`,
    metadata: {
      ...result.metadata,
      merchant: receipt?.merchant,
      total: receipt?.total,
      currency: receipt?.currency,
      date: receipt?.date,
      status: receipt?.status,
      category: receipt?.predicted_category
    },
    accessLevel: 'user'
  };
}

/**
 * Transform claim search result
 */
async function transformClaimResult(
  supabase: any,
  baseResult: any,
  result: any
): Promise<UnifiedSearchResult> {
  // Get claim details
  const { data: claim } = await supabase
    .from('claims')
    .select('title, description, status, priority, amount, currency')
    .eq('id', result.source_id)
    .single();

  return {
    ...baseResult,
    title: claim?.title || 'Untitled Claim',
    description: claim?.description || 'No description',
    metadata: {
      ...result.metadata,
      title: claim?.title,
      status: claim?.status,
      priority: claim?.priority,
      amount: claim?.amount,
      currency: claim?.currency
    },
    accessLevel: 'team'
  };
}

/**
 * Transform team member search result
 */
async function transformTeamMemberResult(
  supabase: any,
  baseResult: any,
  result: any
): Promise<UnifiedSearchResult> {
  // Get team member details with profile
  const { data: teamMember } = await supabase
    .from('team_members')
    .select(`
      role, status, team_id,
      profiles:user_id (first_name, last_name, email)
    `)
    .eq('id', result.source_id)
    .single();

  const profile = teamMember?.profiles;
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');

  return {
    ...baseResult,
    title: fullName || profile?.email || 'Team Member',
    description: `${teamMember?.role || 'Member'} - ${profile?.email || ''}`,
    metadata: {
      ...result.metadata,
      role: teamMember?.role,
      email: profile?.email,
      first_name: profile?.first_name,
      last_name: profile?.last_name,
      status: teamMember?.status,
      team_id: teamMember?.team_id
    },
    accessLevel: 'team'
  };
}

/**
 * Transform custom category search result
 */
async function transformCustomCategoryResult(
  supabase: any,
  baseResult: any,
  result: any
): Promise<UnifiedSearchResult> {
  // Get category details
  const { data: category } = await supabase
    .from('custom_categories')
    .select('name, color, icon, user_id')
    .eq('id', result.source_id)
    .single();

  return {
    ...baseResult,
    title: category?.name || 'Custom Category',
    description: `Category: ${category?.name || 'Unnamed'}`,
    metadata: {
      ...result.metadata,
      name: category?.name,
      color: category?.color,
      icon: category?.icon,
      user_id: category?.user_id
    },
    accessLevel: 'user'
  };
}

/**
 * Transform business directory search result
 */
async function transformBusinessDirectoryResult(
  supabase: any,
  baseResult: any,
  result: any
): Promise<UnifiedSearchResult> {
  // Get business details
  const { data: business } = await supabase
    .from('malaysian_business_directory')
    .select('business_name, business_name_malay, business_type, state, city, address, is_active')
    .eq('id', result.source_id)
    .single();

  return {
    ...baseResult,
    title: business?.business_name || business?.business_name_malay || 'Business',
    description: `${business?.business_type || 'Business'} in ${business?.city || business?.state || 'Malaysia'}`,
    metadata: {
      ...result.metadata,
      business_name: business?.business_name,
      business_name_malay: business?.business_name_malay,
      business_type: business?.business_type,
      state: business?.state,
      city: business?.city,
      address: business?.address,
      is_active: business?.is_active
    },
    accessLevel: 'public'
  };
}

/**
 * Apply additional filters to search results
 */
function applyAdditionalFilters(
  results: UnifiedSearchResult[],
  params: UnifiedSearchParams
): UnifiedSearchResult[] {
  let filteredResults = results;

  // Apply date range filter
  if (params.filters?.dateRange) {
    const { start, end } = params.filters.dateRange;
    filteredResults = filteredResults.filter(result => {
      const resultDate = new Date(result.createdAt);
      return resultDate >= new Date(start) && resultDate <= new Date(end);
    });
  }

  // Apply amount range filter (for receipts and claims)
  if (params.filters?.amountRange) {
    const { min, max } = params.filters.amountRange;
    filteredResults = filteredResults.filter(result => {
      const amount = result.metadata?.total || result.metadata?.amount;
      if (typeof amount === 'number') {
        return amount >= min && amount <= max;
      }
      return true; // Keep results without amount data
    });
  }

  // Apply status filter
  if (params.filters?.status && params.filters.status.length > 0) {
    filteredResults = filteredResults.filter(result => {
      const status = result.metadata?.status;
      return !status || params.filters!.status!.includes(status);
    });
  }

  // Apply priority filter (for claims)
  if (params.filters?.priority) {
    filteredResults = filteredResults.filter(result => {
      if (result.sourceType !== 'claim') return true;
      return result.metadata?.priority === params.filters!.priority;
    });
  }

  return filteredResults;
}

/**
 * Apply aggregation and sorting to results
 */
function applyAggregation(
  results: UnifiedSearchResult[],
  mode: 'relevance' | 'diversity' | 'recency'
): UnifiedSearchResult[] {
  switch (mode) {
    case 'relevance':
      return results.sort((a, b) => b.similarity - a.similarity);

    case 'recency':
      return results.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    case 'diversity':
      return applyDiversitySort(results);

    default:
      return results.sort((a, b) => b.similarity - a.similarity);
  }
}

/**
 * Apply diversity sorting to ensure variety across source types
 */
function applyDiversitySort(results: UnifiedSearchResult[]): UnifiedSearchResult[] {
  const diverseResults: UnifiedSearchResult[] = [];
  const sourceTypeCounts = new Map<string, number>();

  // Sort by similarity first
  const sortedResults = results.sort((a, b) => b.similarity - a.similarity);

  // Select results ensuring diversity across source types
  for (const result of sortedResults) {
    const currentCount = sourceTypeCounts.get(result.sourceType) || 0;
    const maxPerSource = Math.ceil(results.length / 6); // Distribute across up to 6 source types

    if (currentCount < maxPerSource) {
      diverseResults.push(result);
      sourceTypeCounts.set(result.sourceType, currentCount + 1);
    }

    if (diverseResults.length >= results.length) break;
  }

  return diverseResults;
}
