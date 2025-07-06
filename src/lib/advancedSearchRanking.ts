/**
 * Advanced Search Ranking Algorithm
 * Optimized based on multi-source quality validation results
 */

import { UnifiedSearchResult, UnifiedSearchParams } from '@/types/unified-search';

// Quality validation findings - source performance scores
const SOURCE_QUALITY_SCORES = {
  'custom_categories': 0.95,    // A+ grade, perfect exact matching (1.0 similarity)
  'business_directory': 0.92,   // A+ grade, excellent cross-language (0.7597 avg)
  'receipts': 1.0,             // A+ grade after content fix (was 0.65)
  'claims': 0.80,              // Estimated based on system performance
  'conversations': 0.75,        // Estimated based on system performance
  'team_members': 0.85         // Estimated based on system performance
} as const;

// Content type performance weights based on validation findings
const CONTENT_TYPE_WEIGHTS = {
  // High-performing content types
  'merchant': 2.0,             // Excellent for business searches
  'title': 1.8,               // Strong exact matching performance
  'keywords': 1.7,            // Perfect cross-language matching
  'business_name': 1.9,       // Outstanding business directory performance
  'category_name': 2.0,       // Perfect category matching
  
  // Medium-performing content types
  'description': 1.4,         // Good semantic relationships
  'full_text': 1.3,          // Good when content available
  'line_item': 1.2,          // Specific receipt details
  
  // Standard content types
  'fallback': 1.0,           // Baseline performance
  'profile': 1.1,            // Team member information
  'conversation': 1.0        // Chat history
} as const;

// Boost factors for specific matching patterns
const BOOST_FACTORS = {
  // Exact matching boosts (based on perfect 1.0 similarity findings)
  exact_title_match: 3.0,
  exact_merchant_match: 2.5,
  exact_keyword_match: 2.2,
  exact_category_match: 2.8,
  exact_business_match: 2.6,
  
  // Semantic relationship boosts (based on 0.66-0.76 avg similarity)
  semantic_relationship: 1.5,
  cross_language_match: 1.8,  // Based on excellent cross-language performance
  category_relationship: 1.6,
  business_relationship: 1.7,
  
  // Context boosts
  user_content_boost: 1.2,    // User's own content is more relevant
  team_content_boost: 1.1,    // Team content is relevant
  recent_content_boost: 1.3,  // Recent content is more relevant
  
  // Quality boosts
  high_confidence_boost: 1.4, // High similarity scores
  multi_term_match: 1.3,     // Multiple query terms matched
  complete_match: 1.5        // All query terms matched
} as const;

interface RankingContext {
  query: string;
  queryTerms: string[];
  language: 'en' | 'ms' | 'mixed';
  searchType: 'exact' | 'semantic' | 'cross_language' | 'business';
  userPreferences?: {
    preferredSources?: string[];
    recentSearches?: string[];
  };
}

interface RankingScore {
  baseScore: number;
  sourceQualityScore: number;
  contentTypeScore: number;
  boostScore: number;
  finalScore: number;
  explanation: string[];
}

class AdvancedSearchRanking {
  /**
   * Calculate advanced ranking score for a search result
   */
  calculateRankingScore(
    result: UnifiedSearchResult,
    context: RankingContext,
    params: UnifiedSearchParams
  ): RankingScore {
    const explanation: string[] = [];
    
    // 1. Base similarity score
    const baseScore = result.similarity;
    explanation.push(`Base similarity: ${baseScore.toFixed(3)}`);

    // 2. Source quality multiplier (based on validation findings)
    const sourceQuality = SOURCE_QUALITY_SCORES[result.sourceType] || 0.7;
    const sourceQualityScore = baseScore * sourceQuality;
    explanation.push(`Source quality (${result.sourceType}): ${sourceQuality} → ${sourceQualityScore.toFixed(3)}`);

    // 3. Content type weighting
    const contentWeight = CONTENT_TYPE_WEIGHTS[result.contentType] || 1.0;
    const contentTypeScore = sourceQualityScore * contentWeight;
    explanation.push(`Content type (${result.contentType}): ${contentWeight} → ${contentTypeScore.toFixed(3)}`);

    // 4. Apply boost factors
    let boostScore = contentTypeScore;
    const appliedBoosts: string[] = [];

    // Exact matching boosts
    const exactBoosts = this.calculateExactMatchBoosts(result, context);
    exactBoosts.forEach(boost => {
      boostScore *= boost.factor;
      appliedBoosts.push(`${boost.type}: ${boost.factor}`);
    });

    // Semantic relationship boosts
    const semanticBoosts = this.calculateSemanticBoosts(result, context);
    semanticBoosts.forEach(boost => {
      boostScore *= boost.factor;
      appliedBoosts.push(`${boost.type}: ${boost.factor}`);
    });

    // Context boosts
    const contextBoosts = this.calculateContextBoosts(result, context);
    contextBoosts.forEach(boost => {
      boostScore *= boost.factor;
      appliedBoosts.push(`${boost.type}: ${boost.factor}`);
    });

    // Quality boosts
    const qualityBoosts = this.calculateQualityBoosts(result, context);
    qualityBoosts.forEach(boost => {
      boostScore *= boost.factor;
      appliedBoosts.push(`${boost.type}: ${boost.factor}`);
    });

    if (appliedBoosts.length > 0) {
      explanation.push(`Boosts applied: ${appliedBoosts.join(', ')} → ${boostScore.toFixed(3)}`);
    }

    // 5. Final score normalization (cap at 1.0 for consistency)
    const finalScore = Math.min(1.0, boostScore);
    
    if (finalScore !== boostScore) {
      explanation.push(`Capped at 1.0: ${finalScore.toFixed(3)}`);
    }

    return {
      baseScore,
      sourceQualityScore,
      contentTypeScore,
      boostScore,
      finalScore,
      explanation
    };
  }

  /**
   * Calculate exact match boosts based on validation findings
   */
  private calculateExactMatchBoosts(
    result: UnifiedSearchResult,
    context: RankingContext
  ): Array<{ type: string; factor: number }> {
    const boosts: Array<{ type: string; factor: number }> = [];
    const queryLower = context.query.toLowerCase();
    const titleLower = result.title.toLowerCase();

    // Exact title match (perfect 1.0 similarity in validation)
    if (titleLower === queryLower) {
      boosts.push({ type: 'exact_title_match', factor: BOOST_FACTORS.exact_title_match });
    } else if (titleLower.includes(queryLower)) {
      boosts.push({ type: 'partial_title_match', factor: 1.5 });
    }

    // Exact merchant match (excellent performance in business searches)
    if (result.metadata.merchant && result.metadata.merchant.toLowerCase() === queryLower) {
      boosts.push({ type: 'exact_merchant_match', factor: BOOST_FACTORS.exact_merchant_match });
    }

    // Exact category match (perfect category performance)
    if (result.sourceType === 'custom_categories' && titleLower === queryLower) {
      boosts.push({ type: 'exact_category_match', factor: BOOST_FACTORS.exact_category_match });
    }

    // Exact business match (outstanding business directory performance)
    if (result.sourceType === 'business_directory' && 
        (result.metadata.business_name?.toLowerCase() === queryLower || titleLower === queryLower)) {
      boosts.push({ type: 'exact_business_match', factor: BOOST_FACTORS.exact_business_match });
    }

    // Keyword exact match (perfect cross-language performance)
    if (result.metadata.keywords) {
      const keywords = Array.isArray(result.metadata.keywords) 
        ? result.metadata.keywords 
        : [result.metadata.keywords];
      
      if (keywords.some(keyword => keyword.toLowerCase() === queryLower)) {
        boosts.push({ type: 'exact_keyword_match', factor: BOOST_FACTORS.exact_keyword_match });
      }
    }

    return boosts;
  }

  /**
   * Calculate semantic relationship boosts
   */
  private calculateSemanticBoosts(
    result: UnifiedSearchResult,
    context: RankingContext
  ): Array<{ type: string; factor: number }> {
    const boosts: Array<{ type: string; factor: number }> = [];

    // Cross-language boost (excellent 0.7597 avg performance)
    if (context.language === 'mixed' || context.language === 'ms') {
      if (result.sourceType === 'business_directory' || result.sourceType === 'custom_categories') {
        boosts.push({ type: 'cross_language_match', factor: BOOST_FACTORS.cross_language_match });
      }
    }

    // Semantic relationship boost (0.66-0.76 avg similarity range)
    if (result.similarity >= 0.6 && result.similarity < 0.8) {
      boosts.push({ type: 'semantic_relationship', factor: BOOST_FACTORS.semantic_relationship });
    }

    // Category relationship boost
    if (result.sourceType === 'custom_categories' && result.similarity >= 0.6) {
      boosts.push({ type: 'category_relationship', factor: BOOST_FACTORS.category_relationship });
    }

    // Business relationship boost
    if (result.sourceType === 'business_directory' && result.similarity >= 0.7) {
      boosts.push({ type: 'business_relationship', factor: BOOST_FACTORS.business_relationship });
    }

    return boosts;
  }

  /**
   * Calculate context-based boosts
   */
  private calculateContextBoosts(
    result: UnifiedSearchResult,
    context: RankingContext
  ): Array<{ type: string; factor: number }> {
    const boosts: Array<{ type: string; factor: number }> = [];

    // User content boost
    if (result.accessLevel === 'user') {
      boosts.push({ type: 'user_content_boost', factor: BOOST_FACTORS.user_content_boost });
    }

    // Team content boost
    if (result.accessLevel === 'team') {
      boosts.push({ type: 'team_content_boost', factor: BOOST_FACTORS.team_content_boost });
    }

    // Recent content boost (within last 30 days)
    const daysSinceCreated = (Date.now() - new Date(result.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated <= 30) {
      const recencyFactor = Math.max(1.0, BOOST_FACTORS.recent_content_boost * (1 - daysSinceCreated / 30));
      boosts.push({ type: 'recent_content_boost', factor: recencyFactor });
    }

    return boosts;
  }

  /**
   * Calculate quality-based boosts
   */
  private calculateQualityBoosts(
    result: UnifiedSearchResult,
    context: RankingContext
  ): Array<{ type: string; factor: number }> {
    const boosts: Array<{ type: string; factor: number }> = [];

    // High confidence boost (similarity > 0.8)
    if (result.similarity > 0.8) {
      boosts.push({ type: 'high_confidence_boost', factor: BOOST_FACTORS.high_confidence_boost });
    }

    // Multi-term match boost
    const queryTerms = context.queryTerms;
    const content = `${result.title} ${result.description}`.toLowerCase();
    const matchedTerms = queryTerms.filter(term => content.includes(term.toLowerCase()));
    
    if (matchedTerms.length > 1) {
      const matchRatio = matchedTerms.length / queryTerms.length;
      if (matchRatio === 1.0) {
        boosts.push({ type: 'complete_match', factor: BOOST_FACTORS.complete_match });
      } else if (matchRatio > 0.5) {
        boosts.push({ type: 'multi_term_match', factor: BOOST_FACTORS.multi_term_match });
      }
    }

    return boosts;
  }

  /**
   * Analyze search context for ranking optimization
   */
  analyzeSearchContext(query: string, params: UnifiedSearchParams): RankingContext {
    const queryTerms = this.extractQueryTerms(query);
    const language = this.detectLanguage(query);
    const searchType = this.detectSearchType(query, params);

    return {
      query,
      queryTerms,
      language,
      searchType
    };
  }

  /**
   * Extract meaningful query terms
   */
  private extractQueryTerms(query: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'dari', 'ke', 'di', 'dan', 'atau', 'untuk', 'dengan', 'pada', 'yang', 'adalah'
    ]);

    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 2 && !stopWords.has(term))
      .slice(0, 10);
  }

  /**
   * Detect query language
   */
  private detectLanguage(query: string): 'en' | 'ms' | 'mixed' {
    const malayWords = ['sdn', 'bhd', 'kedai', 'restoran', 'pasar', 'mamak', 'warung'];
    const hasMalay = malayWords.some(word => query.toLowerCase().includes(word));
    const hasEnglish = /[a-z]/.test(query);

    if (hasMalay && hasEnglish) return 'mixed';
    if (hasMalay) return 'ms';
    return 'en';
  }

  /**
   * Detect search type
   */
  private detectSearchType(query: string, params: UnifiedSearchParams): 'exact' | 'semantic' | 'cross_language' | 'business' {
    if (query.includes('"') || query.length < 10) return 'exact';
    if (this.detectLanguage(query) !== 'en') return 'cross_language';
    if (params.sources?.includes('business_directory')) return 'business';
    return 'semantic';
  }

  /**
   * Rank search results using advanced algorithm
   */
  rankSearchResults(
    results: UnifiedSearchResult[],
    context: RankingContext,
    params: UnifiedSearchParams
  ): UnifiedSearchResult[] {
    // Calculate ranking scores for all results
    const scoredResults = results.map(result => {
      const rankingScore = this.calculateRankingScore(result, context, params);
      return {
        ...result,
        similarity: rankingScore.finalScore, // Update similarity with optimized score
        rankingMetadata: {
          originalSimilarity: result.similarity,
          rankingScore,
          explanation: rankingScore.explanation
        }
      };
    });

    // Sort by final ranking score
    scoredResults.sort((a, b) => {
      // Primary sort: final score
      if (b.similarity !== a.similarity) {
        return b.similarity - a.similarity;
      }
      
      // Secondary sort: source quality
      const aSourceQuality = SOURCE_QUALITY_SCORES[a.sourceType] || 0.7;
      const bSourceQuality = SOURCE_QUALITY_SCORES[b.sourceType] || 0.7;
      if (bSourceQuality !== aSourceQuality) {
        return bSourceQuality - aSourceQuality;
      }
      
      // Tertiary sort: recency
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return scoredResults;
  }
}

// Export singleton instance
export const advancedSearchRanking = new AdvancedSearchRanking();
export type { RankingContext, RankingScore };
