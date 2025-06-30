/**
 * Fallback search implementations for when primary search methods fail
 */

import { UnifiedSearchParams, UnifiedSearchResult, FallbackResult } from './types.ts';

/**
 * Execute fallback text search when vector search fails
 */
export async function executeFallbackSearch(
  supabase: any,
  params: UnifiedSearchParams,
  user: any,
  error: Error
): Promise<{ results: UnifiedSearchResult[]; fallbackInfo: FallbackResult }> {
  console.log('Executing fallback search due to error:', error.message);
  
  const startTime = Date.now();
  let results: UnifiedSearchResult[] = [];
  let method: FallbackResult['method'] = 'text_search';
  
  try {
    // Try text-based search first
    if (params.sources?.includes('receipt')) {
      const receiptResults = await fallbackReceiptSearch(supabase, params, user);
      results.push(...receiptResults);
    }
    
    if (params.sources?.includes('business_directory')) {
      const businessResults = await fallbackBusinessDirectorySearch(supabase, params, user);
      results.push(...businessResults);
    }
    
    if (params.sources?.includes('claim')) {
      const claimResults = await fallbackClaimSearch(supabase, params, user);
      results.push(...claimResults);
    }
    
    if (params.sources?.includes('custom_category')) {
      const categoryResults = await fallbackCustomCategorySearch(supabase, params, user);
      results.push(...categoryResults);
    }
    
    // Sort by relevance (basic text matching score)
    results.sort((a, b) => b.similarity - a.similarity);
    
    // Apply pagination
    const paginatedResults = results.slice(params.offset!, params.offset! + params.limit!);
    
    const fallbackInfo: FallbackResult = {
      method,
      reason: error.message,
      resultsCount: paginatedResults.length,
      performance: {
        duration: Date.now() - startTime,
        success: true
      }
    };
    
    return { results: paginatedResults, fallbackInfo };
    
  } catch (fallbackError) {
    console.error('Fallback search also failed:', fallbackError);
    
    const fallbackInfo: FallbackResult = {
      method: 'basic_filter',
      reason: `Primary search failed: ${error.message}, Fallback failed: ${fallbackError.message}`,
      resultsCount: 0,
      performance: {
        duration: Date.now() - startTime,
        success: false
      }
    };
    
    return { results: [], fallbackInfo };
  }
}

/**
 * Fallback search for receipts using text search
 */
async function fallbackReceiptSearch(
  supabase: any,
  params: UnifiedSearchParams,
  user: any
): Promise<UnifiedSearchResult[]> {
  const query = params.query.toLowerCase();
  const results: UnifiedSearchResult[] = [];

  try {
    // Safety check for user authentication
    if (!user || !user.id) {
      console.error('❌ fallbackReceiptSearch: User not authenticated');
      return results;
    }

    // Build query with amount filtering
    let receiptQuery = supabase
      .from('receipts')
      .select('id, merchant, total, currency, date, status, predicted_category, "fullText", created_at')
      .eq('user_id', user.id)
      .or(`merchant.ilike.%${query}%,"fullText".ilike.%${query}%`);

    // Apply amount filtering if specified
    if (params.filters?.amountRange) {
      const { min, max } = params.filters.amountRange;
      console.log('💰 Applying fallback amount filtering:', { min, max });

      if (min !== undefined && min > 0) {
        console.log('💰 DEBUG: Applying min amount filter:', {
          min,
          type: typeof min,
          isNumber: !isNaN(Number(min))
        });

        // Ensure the amount is a number for proper comparison
        const numericMin = Number(min);
        receiptQuery = receiptQuery.gte('total', numericMin);
        console.log('Applied minimum amount filter:', numericMin);
      }
      if (max !== undefined && max < Number.MAX_SAFE_INTEGER) {
        console.log('💰 DEBUG: Applying max amount filter:', {
          max,
          type: typeof max,
          isNumber: !isNaN(Number(max))
        });

        // Ensure the amount is a number for proper comparison
        const numericMax = Number(max);
        receiptQuery = receiptQuery.lte('total', numericMax);
        console.log('Applied maximum amount filter:', numericMax);
      }
    }

    const { data: receipts, error } = await receiptQuery
      .order('created_at', { ascending: false })
      .limit(params.limit! * 2); // Get extra for filtering
    
    if (error) {
      console.error('Fallback receipt search error:', error);
      return results;
    }

    console.log(`💰 DEBUG: Fallback search results:`, {
      totalFound: receipts?.length || 0,
      query,
      amountFilters: params.filters?.amountRange,
      sampleResults: receipts?.slice(0, 3).map(r => ({
        id: r.id,
        merchant: r.merchant,
        total: r.total,
        totalType: typeof r.total,
        currency: r.currency
      }))
    });

    receipts?.forEach((receipt: any) => {
      const similarity = calculateTextSimilarity(query, [
        receipt.merchant,
        receipt.fullText,
        receipt.predicted_category
      ].filter(Boolean).join(' '));
      
      if (similarity > 0.1) { // Minimum relevance threshold
        results.push({
          id: receipt.id,
          sourceType: 'receipt',
          sourceId: receipt.id,
          contentType: 'full_text',
          title: receipt.merchant || 'Unknown Merchant',
          description: `${receipt.currency || ''} ${receipt.total || 'N/A'} on ${receipt.date || 'Unknown date'}`,
          similarity,
          metadata: {
            merchant: receipt.merchant,
            total: receipt.total,
            currency: receipt.currency,
            date: receipt.date,
            status: receipt.status,
            category: receipt.predicted_category
          },
          accessLevel: 'user',
          createdAt: receipt.created_at
        });
      }
    });
    
  } catch (error) {
    console.error('Error in fallback receipt search:', error);
  }
  
  return results;
}

/**
 * Fallback search for business directory using text search
 */
async function fallbackBusinessDirectorySearch(
  supabase: any,
  params: UnifiedSearchParams,
  user: any
): Promise<UnifiedSearchResult[]> {
  const query = params.query.toLowerCase();
  const results: UnifiedSearchResult[] = [];
  
  try {
    const { data: businesses, error } = await supabase
      .from('malaysian_business_directory')
      .select('id, business_name, business_name_malay, business_type, state, city, address_line1, address_line2, postcode, is_active, keywords')
      .eq('is_active', true)
      .or(`business_name.ilike.%${query}%,business_name_malay.ilike.%${query}%,business_type.ilike.%${query}%`)
      .order('business_name')
      .limit(params.limit!);
    
    if (error) {
      console.error('Fallback business directory search error:', error);
      return results;
    }
    
    businesses?.forEach((business: any) => {
      const searchableText = [
        business.business_name,
        business.business_name_malay,
        business.business_type,
        business.keywords?.join(' ')
      ].filter(Boolean).join(' ');
      
      const similarity = calculateTextSimilarity(query, searchableText);
      
      if (similarity > 0.1) {
        results.push({
          id: business.id,
          sourceType: 'business_directory',
          sourceId: business.id,
          contentType: 'business_name',
          title: business.business_name || business.business_name_malay || 'Business',
          description: `${business.business_type || 'Business'} in ${business.city || business.state || 'Malaysia'}`,
          similarity,
          metadata: {
            business_name: business.business_name,
            business_name_malay: business.business_name_malay,
            business_type: business.business_type,
            state: business.state,
            city: business.city,
            address_line1: business.address_line1,
            address_line2: business.address_line2,
            postcode: business.postcode,
            full_address: [business.address_line1, business.address_line2, business.city, business.state, business.postcode].filter(Boolean).join(', '),
            is_active: business.is_active,
            keywords: business.keywords
          },
          accessLevel: 'public',
          createdAt: new Date().toISOString() // Business directory doesn't have created_at
        });
      }
    });
    
  } catch (error) {
    console.error('Error in fallback business directory search:', error);
  }
  
  return results;
}

/**
 * Fallback search for claims using text search
 */
async function fallbackClaimSearch(
  supabase: any,
  params: UnifiedSearchParams,
  user: any
): Promise<UnifiedSearchResult[]> {
  const query = params.query.toLowerCase();
  const results: UnifiedSearchResult[] = [];
  
  try {
    // Only search claims if user has team access
    if (!params.filters?.teamId) {
      return results;
    }
    
    const { data: claims, error } = await supabase
      .from('claims')
      .select('id, title, description, status, priority, amount, currency, created_at')
      .eq('team_id', params.filters.teamId)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(params.limit!);
    
    if (error) {
      console.error('Fallback claim search error:', error);
      return results;
    }
    
    claims?.forEach((claim: any) => {
      const similarity = calculateTextSimilarity(query, [
        claim.title,
        claim.description
      ].filter(Boolean).join(' '));
      
      if (similarity > 0.1) {
        results.push({
          id: claim.id,
          sourceType: 'claim',
          sourceId: claim.id,
          contentType: 'title',
          title: claim.title || 'Untitled Claim',
          description: claim.description || 'No description',
          similarity,
          metadata: {
            title: claim.title,
            status: claim.status,
            priority: claim.priority,
            amount: claim.amount,
            currency: claim.currency
          },
          accessLevel: 'team',
          createdAt: claim.created_at
        });
      }
    });
    
  } catch (error) {
    console.error('Error in fallback claim search:', error);
  }
  
  return results;
}

/**
 * Fallback search for custom categories using text search
 */
async function fallbackCustomCategorySearch(
  supabase: any,
  params: UnifiedSearchParams,
  user: any
): Promise<UnifiedSearchResult[]> {
  const query = params.query.toLowerCase();
  const results: UnifiedSearchResult[] = [];

  try {
    // Safety check for user authentication
    if (!user || !user.id) {
      console.error('❌ fallbackCustomCategorySearch: User not authenticated');
      return results;
    }

    const { data: categories, error } = await supabase
      .from('custom_categories')
      .select('id, name, color, icon, user_id, created_at')
      .eq('user_id', user.id)
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(params.limit!);
    
    if (error) {
      console.error('Fallback custom category search error:', error);
      return results;
    }
    
    categories?.forEach((category: any) => {
      const similarity = calculateTextSimilarity(query, category.name);
      
      if (similarity > 0.1) {
        results.push({
          id: category.id,
          sourceType: 'custom_category',
          sourceId: category.id,
          contentType: 'name',
          title: category.name || 'Custom Category',
          description: `Category: ${category.name || 'Unnamed'}`,
          similarity,
          metadata: {
            name: category.name,
            color: category.color,
            icon: category.icon,
            user_id: category.user_id
          },
          accessLevel: 'user',
          createdAt: category.created_at
        });
      }
    });
    
  } catch (error) {
    console.error('Error in fallback custom category search:', error);
  }
  
  return results;
}

/**
 * Calculate text similarity using simple string matching
 */
function calculateTextSimilarity(query: string, text: string): number {
  if (!text) return 0;
  
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  
  // Exact match gets highest score
  if (textLower.includes(queryLower)) {
    return 0.9;
  }
  
  // Word-based matching
  const queryWords = queryLower.split(/\s+/);
  const textWords = textLower.split(/\s+/);
  
  let matchCount = 0;
  queryWords.forEach(queryWord => {
    if (textWords.some(textWord => textWord.includes(queryWord) || queryWord.includes(textWord))) {
      matchCount++;
    }
  });
  
  const similarity = matchCount / queryWords.length;
  return Math.min(0.8, similarity); // Cap at 0.8 for text-based matching
}
