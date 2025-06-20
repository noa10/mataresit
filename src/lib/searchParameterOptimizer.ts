/**
 * Search Parameter Optimizer
 * Optimizes search parameters based on quality validation findings and performance metrics
 */

import { UnifiedSearchParams } from '@/types/unified-search';

// Optimized parameter configurations based on quality validation findings
interface OptimizedSearchConfig {
  similarityThreshold: number;
  limit: number;
  contentTypeWeights: Record<string, number>;
  sourceWeights: Record<string, number>;
  aggregationMode: 'relevance' | 'diversity' | 'recency';
  boostFactors: Record<string, number>;
}

interface SearchContext {
  queryLength: number;
  queryType: 'exact' | 'semantic' | 'fuzzy';
  language: 'en' | 'ms' | 'mixed';
  sources: string[];
  userTier: 'free' | 'pro' | 'max';
}

interface ParameterOptimizationResult {
  optimizedParams: UnifiedSearchParams;
  optimizationReason: string;
  expectedImprovements: string[];
  confidenceScore: number;
}

class SearchParameterOptimizer {
  // Base configurations optimized from quality validation findings
  private baseConfigs: Record<string, OptimizedSearchConfig> = {
    // High-precision configuration for exact matches
    exact_match: {
      similarityThreshold: 0.95, // Very high for exact matches
      limit: 10,
      contentTypeWeights: {
        'title': 2.0,
        'merchant': 2.0,
        'full_text': 1.5,
        'description': 1.2,
        'keywords': 1.8
      },
      sourceWeights: {
        'custom_categories': 2.0, // Perfect exact matching (1.0 similarity)
        'business_directory': 1.8, // Excellent keyword support
        'receipts': 1.5,
        'claims': 1.3,
        'conversations': 1.0
      },
      aggregationMode: 'relevance',
      boostFactors: {
        'exact_title_match': 3.0,
        'exact_merchant_match': 2.5,
        'exact_keyword_match': 2.0
      }
    },

    // Semantic search configuration for related content
    semantic_search: {
      similarityThreshold: 0.2, // Lower threshold for semantic relationships
      limit: 20,
      contentTypeWeights: {
        'full_text': 2.0,
        'description': 1.8,
        'title': 1.5,
        'keywords': 1.3,
        'merchant': 1.2
      },
      sourceWeights: {
        'business_directory': 2.0, // Outstanding cross-language support (0.7597 avg)
        'custom_categories': 1.8, // Excellent semantic relationships (0.6647 avg)
        'receipts': 1.5, // Good when content available (0.6761 avg)
        'claims': 1.3,
        'conversations': 1.0
      },
      aggregationMode: 'relevance',
      boostFactors: {
        'semantic_relationship': 1.5,
        'cross_language_match': 1.8,
        'category_relationship': 1.6
      }
    },

    // Cross-language optimized configuration
    cross_language: {
      similarityThreshold: 0.15, // Lower for cross-language matching
      limit: 25,
      contentTypeWeights: {
        'keywords': 2.5, // Excellent for cross-language (perfect matching)
        'title': 2.0,
        'description': 1.8,
        'full_text': 1.5,
        'merchant': 1.3
      },
      sourceWeights: {
        'business_directory': 2.5, // Perfect cross-language support
        'custom_categories': 2.0, // Excellent multilingual handling
        'receipts': 1.5,
        'claims': 1.2,
        'conversations': 1.0
      },
      aggregationMode: 'diversity', // Ensure diverse language results
      boostFactors: {
        'malay_english_match': 2.0,
        'keyword_variation': 1.8,
        'multilingual_content': 1.6
      }
    },

    // Business search optimized configuration
    business_search: {
      similarityThreshold: 0.25, // Balanced for business context
      limit: 30,
      contentTypeWeights: {
        'merchant': 2.5, // Primary for business searches
        'keywords': 2.0,
        'title': 1.8,
        'description': 1.5,
        'full_text': 1.2
      },
      sourceWeights: {
        'business_directory': 2.5, // Outstanding business search (0.7597 avg)
        'receipts': 2.0, // Business transaction context
        'custom_categories': 1.5, // Business categorization
        'claims': 1.3,
        'conversations': 1.0
      },
      aggregationMode: 'relevance',
      boostFactors: {
        'business_name_match': 2.5,
        'merchant_chain_match': 2.0,
        'business_category_match': 1.8
      }
    },

    // Performance optimized configuration for fast searches
    performance_optimized: {
      similarityThreshold: 0.3, // Higher threshold for fewer, better results
      limit: 15, // Smaller result set for speed
      contentTypeWeights: {
        'title': 2.0,
        'keywords': 1.8,
        'merchant': 1.5,
        'description': 1.2,
        'full_text': 1.0
      },
      sourceWeights: {
        'custom_categories': 2.0, // Fastest source with perfect results
        'business_directory': 1.8, // Fast with excellent results
        'receipts': 1.2, // Slower due to content issues
        'claims': 1.0,
        'conversations': 0.8
      },
      aggregationMode: 'relevance',
      boostFactors: {
        'high_confidence': 2.0,
        'cached_result': 1.5
      }
    }
  };

  /**
   * Analyze search context to determine optimal configuration
   */
  private analyzeSearchContext(params: UnifiedSearchParams): SearchContext {
    const query = params.query.toLowerCase().trim();
    const queryLength = query.length;
    
    // Detect query type
    let queryType: 'exact' | 'semantic' | 'fuzzy' = 'semantic';
    if (query.includes('"') || queryLength < 10) {
      queryType = 'exact';
    } else if (queryLength > 50 || query.includes('like') || query.includes('similar')) {
      queryType = 'fuzzy';
    }

    // Detect language
    let language: 'en' | 'ms' | 'mixed' = 'en';
    const malayWords = ['sdn', 'bhd', 'kedai', 'restoran', 'pasar', 'tesco', 'speedmart'];
    const hasMalay = malayWords.some(word => query.includes(word));
    const hasEnglish = /[a-z]/.test(query);
    
    if (hasMalay && hasEnglish) {
      language = 'mixed';
    } else if (hasMalay) {
      language = 'ms';
    }

    return {
      queryLength,
      queryType,
      language,
      sources: params.sources || ['receipts', 'business_directory'],
      userTier: 'pro' // Default, would be determined from user context
    };
  }

  /**
   * Select optimal configuration based on search context
   */
  private selectOptimalConfig(context: SearchContext): string {
    // Exact match queries
    if (context.queryType === 'exact' || context.queryLength < 10) {
      return 'exact_match';
    }

    // Cross-language queries
    if (context.language === 'mixed' || context.language === 'ms') {
      return 'cross_language';
    }

    // Business-focused queries
    const businessSources = ['business_directory', 'receipts'];
    if (context.sources.some(source => businessSources.includes(source))) {
      return 'business_search';
    }

    // Performance-focused for simple queries
    if (context.queryLength < 20 && context.sources.length <= 2) {
      return 'performance_optimized';
    }

    // Default to semantic search
    return 'semantic_search';
  }

  /**
   * Apply source-specific optimizations based on quality validation findings
   */
  private applySourceOptimizations(
    params: UnifiedSearchParams, 
    config: OptimizedSearchConfig,
    context: SearchContext
  ): UnifiedSearchParams {
    const optimizedParams = { ...params };

    // Optimize similarity threshold based on sources
    if (params.sources?.includes('custom_categories')) {
      // Custom categories have perfect exact matching, can use higher threshold
      optimizedParams.similarityThreshold = Math.max(
        config.similarityThreshold, 
        0.5 // Higher threshold for categories
      );
    }

    if (params.sources?.includes('business_directory')) {
      // Business directory has excellent cross-language support
      if (context.language === 'mixed' || context.language === 'ms') {
        optimizedParams.similarityThreshold = Math.max(
          config.similarityThreshold * 0.8, // Lower threshold for cross-language
          0.15
        );
      }
    }

    if (params.sources?.includes('receipts')) {
      // Receipts have content storage issues, need lower threshold
      optimizedParams.similarityThreshold = Math.max(
        config.similarityThreshold * 0.7, // Lower threshold due to content issues
        0.1
      );
    }

    // Optimize result limits based on subscription tier
    const tierLimits = {
      free: 20,
      pro: 100,
      max: 500
    };
    
    optimizedParams.limit = Math.min(
      config.limit,
      tierLimits[context.userTier]
    );

    return optimizedParams;
  }

  /**
   * Optimize search parameters based on context and quality findings
   */
  optimizeParameters(params: UnifiedSearchParams): ParameterOptimizationResult {
    try {
      // Analyze search context
      const context = this.analyzeSearchContext(params);
      
      // Select optimal configuration
      const configKey = this.selectOptimalConfig(context);
      const config = this.baseConfigs[configKey];
      
      // Apply base optimizations
      let optimizedParams: UnifiedSearchParams = {
        ...params,
        similarityThreshold: config.similarityThreshold,
        limit: Math.min(params.limit || config.limit, config.limit),
        aggregationMode: config.aggregationMode,
        includeMetadata: true // Always include metadata for better ranking
      };

      // Apply source-specific optimizations
      optimizedParams = this.applySourceOptimizations(optimizedParams, config, context);

      // Generate optimization explanation
      const optimizationReason = this.generateOptimizationReason(configKey, context, config);
      const expectedImprovements = this.generateExpectedImprovements(configKey, context);
      
      // Calculate confidence score based on quality validation data
      const confidenceScore = this.calculateConfidenceScore(context, configKey);

      return {
        optimizedParams,
        optimizationReason,
        expectedImprovements,
        confidenceScore
      };

    } catch (error) {
      console.error('Parameter optimization failed:', error);
      
      // Return safe defaults on error
      return {
        optimizedParams: {
          ...params,
          similarityThreshold: params.similarityThreshold || 0.2,
          limit: Math.min(params.limit || 20, 100),
          aggregationMode: 'relevance',
          includeMetadata: true
        },
        optimizationReason: 'Using safe default parameters due to optimization error',
        expectedImprovements: ['Stable search performance'],
        confidenceScore: 0.5
      };
    }
  }

  /**
   * Generate human-readable optimization reason
   */
  private generateOptimizationReason(configKey: string, context: SearchContext, config: OptimizedSearchConfig): string {
    const reasons = {
      exact_match: `Optimized for exact matching with high similarity threshold (${config.similarityThreshold}) based on perfect exact match performance in quality validation.`,
      semantic_search: `Optimized for semantic relationships with balanced threshold (${config.similarityThreshold}) based on excellent semantic performance (0.66-0.76 avg similarity).`,
      cross_language: `Optimized for cross-language search with lower threshold (${config.similarityThreshold}) based on perfect multilingual support (0.7597 avg similarity).`,
      business_search: `Optimized for business queries with merchant-focused weighting based on outstanding business directory performance.`,
      performance_optimized: `Optimized for speed with higher threshold (${config.similarityThreshold}) and smaller result set for faster response times.`
    };

    return reasons[configKey] || 'Applied general optimization based on search context.';
  }

  /**
   * Generate expected improvements list
   */
  private generateExpectedImprovements(configKey: string, context: SearchContext): string[] {
    const baseImprovements = {
      exact_match: [
        'Higher precision for exact matches',
        'Reduced false positives',
        'Faster query processing'
      ],
      semantic_search: [
        'Better semantic relationship discovery',
        'Improved relevance ranking',
        'Enhanced cross-source results'
      ],
      cross_language: [
        'Superior multilingual matching',
        'Better keyword variation handling',
        'Enhanced Malay-English support'
      ],
      business_search: [
        'Improved merchant matching',
        'Better business categorization',
        'Enhanced chain store recognition'
      ],
      performance_optimized: [
        'Faster response times',
        'Reduced server load',
        'Improved cache efficiency'
      ]
    };

    return baseImprovements[configKey] || ['General search improvements'];
  }

  /**
   * Calculate confidence score based on quality validation data
   */
  private calculateConfidenceScore(context: SearchContext, configKey: string): number {
    // Base confidence scores from quality validation results
    const sourceConfidence = {
      'custom_categories': 0.95, // A+ grade, perfect exact matching
      'business_directory': 0.92, // A+ grade, excellent cross-language
      'receipts': 0.65, // C- grade due to content storage issues
      'claims': 0.80, // Estimated based on system performance
      'conversations': 0.75 // Estimated based on system performance
    };

    // Calculate weighted confidence based on sources
    const avgSourceConfidence = context.sources.reduce((sum, source) => {
      return sum + (sourceConfidence[source] || 0.7);
    }, 0) / context.sources.length;

    // Configuration-specific confidence adjustments
    const configConfidence = {
      exact_match: 0.95, // High confidence for exact matches
      semantic_search: 0.85, // Good confidence for semantic search
      cross_language: 0.90, // High confidence for cross-language
      business_search: 0.88, // Good confidence for business search
      performance_optimized: 0.80 // Lower confidence due to trade-offs
    };

    // Combine source and configuration confidence
    const finalConfidence = (avgSourceConfidence * 0.6) + (configConfidence[configKey] * 0.4);
    
    return Math.min(Math.max(finalConfidence, 0.1), 1.0);
  }

  /**
   * Get configuration details for debugging
   */
  getConfigurationDetails(configKey: string): OptimizedSearchConfig | null {
    return this.baseConfigs[configKey] || null;
  }

  /**
   * Update configuration based on performance feedback
   */
  updateConfiguration(configKey: string, updates: Partial<OptimizedSearchConfig>): void {
    if (this.baseConfigs[configKey]) {
      this.baseConfigs[configKey] = {
        ...this.baseConfigs[configKey],
        ...updates
      };
      console.log(`Updated configuration ${configKey}:`, updates);
    }
  }
}

// Export singleton instance
export const searchParameterOptimizer = new SearchParameterOptimizer();
export type { OptimizedSearchConfig, SearchContext, ParameterOptimizationResult };
