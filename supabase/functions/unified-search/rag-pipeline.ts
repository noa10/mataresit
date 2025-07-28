/**
 * Formalized RAG (Retrieval-Augmented Generation) Pipeline
 * 
 * This module implements a clear, maintainable RAG pipeline with explicit stages:
 * 1. User Query → 2. LLM Pre-processing → 3. Hybrid Search → 4. Re-ranking → 
 * 5. Context Compilation → 6. Final Response Generation
 */

import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.1.3';
import {
  UnifiedSearchParams,
  UnifiedSearchResult,
  LLMPreprocessResult,
  SearchMetadata,
  ReRankingCandidate
} from './types.ts';
import {
  llmPreprocessQuery,
  reRankSearchResults
} from './utils.ts';
import {
  enhancedReRanking,
  calculateContextualFeatures,
  ReRankingCandidate as EnhancedReRankingCandidate,
  EnhancedReRankingParams
} from '../_shared/enhanced-reranking.ts';
import {
  extractContextualSnippets,
  SnippetExtractionParams
} from '../_shared/contextual-snippets.ts';
import { performLineItemSearch } from '../semantic-search/performLineItemSearch.ts';
import {
  llmCacheWrapper,
  searchCacheWrapper,
  financialCacheWrapper,
  EdgeCacheKeyGenerator
} from '../_shared/edge-cache.ts';
import {
  analyzeAvailableDates,
  convertToFollowUpSuggestions,
  generateZeroResultsMessage,
  type DateAnalysis
} from '../_shared/smart-date-suggestions.ts';

// Pipeline stage interfaces
export interface RAGPipelineContext {
  originalQuery: string;
  user: any;
  supabase: any;
  params: UnifiedSearchParams;
  startTime: number;
  metadata: SearchMetadata;
  // Smart suggestions for zero results
  smartSuggestions?: {
    dateAnalysis?: DateAnalysis;
    followUpSuggestions?: string[];
    enhancedMessage?: string;
  };
}

export interface PipelineStageResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  processingTime: number;
  metadata?: Record<string, any>;
}

export interface RAGPipelineResult {
  success: boolean;
  results: UnifiedSearchResult[];
  totalResults: number;
  searchMetadata: SearchMetadata;
  error?: string;
  // Smart suggestions for zero results
  smartSuggestions?: {
    dateAnalysis?: DateAnalysis;
    followUpSuggestions?: string[];
    enhancedMessage?: string;
  };
}

/**
 * Main RAG Pipeline Orchestrator
 */
export class RAGPipeline {
  private context: RAGPipelineContext;

  constructor(context: RAGPipelineContext) {
    console.log('🔧 RAG Pipeline constructor called');
    console.log('🔍 DEBUG: Constructor context check:', {
      hasContext: !!context,
      originalQuery: context?.originalQuery,
      hasUser: !!context?.user,
      hasParams: !!context?.params,
      hasStartTime: !!context?.startTime,
      hasMetadata: !!context?.metadata
    });
    this.context = context;
    console.log('🔧 RAG Pipeline constructor completed');
  }

  /**
   * Execute the complete RAG pipeline
   */
  async execute(): Promise<RAGPipelineResult> {
    console.log('🚀 Starting RAG Pipeline execution');
    console.log('🔍 DEBUG: Execute function called - checking context...');
    console.log('🔍 DEBUG: RAG Pipeline context check:', {
      hasContext: !!this.context,
      originalQuery: this.context?.originalQuery,
      hasUser: !!this.context?.user,
      hasParams: !!this.context?.params,
      hasStartTime: !!this.context?.startTime,
      hasMetadata: !!this.context?.metadata
    });

    // CRITICAL FIX: Validate user context at the start of pipeline execution
    if (!this.context?.user?.id) {
      console.error('❌ CRITICAL: User context missing or invalid at pipeline start');
      console.error('🔍 DEBUG: User context details:', {
        userExists: !!this.context?.user,
        userId: this.context?.user?.id || 'MISSING',
        userObject: this.context?.user
      });
      return {
        success: false,
        error: 'User authentication required for search execution',
        data: [],
        processingTime: 0
      };
    }

    console.log('✅ User context validated:', {
      userId: this.context.user.id,
      userEmail: this.context.user.email || 'not provided'
    });

    console.log('🔍 DEBUG: About to enter try block...');

    // Add timeout protection - if we're already close to timeout, fail fast
    const MAX_PIPELINE_TIME = 75000; // 75 seconds max for pipeline execution
    const timeElapsed = Date.now() - this.context.startTime;
    if (timeElapsed > MAX_PIPELINE_TIME * 0.8) { // If 80% of time already used
      console.warn('⚠️ RAG Pipeline: Approaching timeout, failing fast to allow fallback');
      return this.createErrorResult('Pipeline timeout protection triggered', 'Insufficient time remaining for pipeline execution');
    }

    try {
      console.log('🔍 DEBUG: About to start Stage 1 - Query Preprocessing');
      // Stage 1: Query Understanding & Preprocessing
      let preprocessingResult;
      try {
        preprocessingResult = await this.stage1_QueryPreprocessing();
        console.log('🔍 DEBUG: Stage 1 completed successfully');
      } catch (stage1Error) {
        console.error('❌ ERROR in Stage 1:', stage1Error);
        return this.createErrorResult('Query preprocessing failed with exception', stage1Error);
      }

      if (!preprocessingResult.success) {
        console.log('🔍 DEBUG: Stage 1 returned failure:', preprocessingResult.error);
        return this.createErrorResult('Query preprocessing failed', preprocessingResult.error);
      }

      // Check timeout before Stage 2
      if (Date.now() - this.context.startTime > MAX_PIPELINE_TIME * 0.5) {
        console.warn('⚠️ RAG Pipeline: Timeout check before Stage 2 - switching to fast path');
        return this.createErrorResult('Pipeline timeout protection - Stage 2', 'Switching to fallback for performance');
      }

      // Stage 2: Embedding Generation
      const embeddingResult = await this.stage2_EmbeddingGeneration(preprocessingResult.data!);
      if (!embeddingResult.success) {
        return this.createErrorResult('Embedding generation failed', embeddingResult.error);
      }

      // Check timeout before Stage 3 (most expensive stage)
      if (Date.now() - this.context.startTime > MAX_PIPELINE_TIME * 0.6) {
        console.warn('⚠️ RAG Pipeline: Timeout check before Stage 3 - switching to fast path');
        return this.createErrorResult('Pipeline timeout protection - Stage 3', 'Switching to fallback for performance');
      }

      // Stage 3: Hybrid Search Execution
      const searchResult = await this.stage3_HybridSearch(embeddingResult.data!);
      if (!searchResult.success) {
        return this.createErrorResult('Search execution failed', searchResult.error);
      }

      // Stage 4: Result Re-ranking
      const reRankingResult = await this.stage4_ResultReRanking(searchResult.data!);
      if (!reRankingResult.success) {
        return this.createErrorResult('Re-ranking failed', reRankingResult.error);
      }

      // Stage 5: Context Compilation
      const contextResult = await this.stage5_ContextCompilation(reRankingResult.data!);
      if (!contextResult.success) {
        return this.createErrorResult('Context compilation failed', contextResult.error);
      }

      // Stage 6: Final Response Generation
      const responseResult = await this.stage6_ResponseGeneration(contextResult.data!);
      
      // Update final metadata
      this.context.metadata.searchDuration = Date.now() - this.context.startTime;
      
      // Add temporal routing and filters to metadata for response generation
      this.context.metadata.temporalRouting = this.context.params.temporalRouting || this.context.metadata.llmPreprocessing?.temporalRouting;

      // CRITICAL FIX: Preserve original date range in metadata even if fallbacks were used
      const originalFilters = { ...this.context.params.filters };

      // If this was a fallback result, preserve the original date range for display
      if (this.context.metadata.isFallbackResult && this.context.metadata.originalDateRange) {
        console.log('🔍 DEBUG: Preserving original date range in metadata for fallback result');
        originalFilters.startDate = this.context.metadata.originalDateRange.start;
        originalFilters.endDate = this.context.metadata.originalDateRange.end;
      }

      this.context.metadata.filters = originalFilters;

      console.log('🔍 DEBUG: Final metadata filters set:', {
        startDate: this.context.metadata.filters?.startDate,
        endDate: this.context.metadata.filters?.endDate,
        isFallbackResult: this.context.metadata.isFallbackResult,
        originalDateRange: this.context.metadata.originalDateRange
      });

      return {
        success: true,
        results: responseResult.data!.results,
        totalResults: responseResult.data!.totalResults,
        searchMetadata: this.context.metadata,
        smartSuggestions: this.context.smartSuggestions
      };

    } catch (error) {
      console.error('❌ RAG Pipeline execution failed:', error);
      return this.createErrorResult('Pipeline execution failed', error.message);
    }
  }

  /**
   * Stage 1: Query Understanding & Preprocessing with Caching
   * Analyzes user intent, extracts entities, and expands the query
   */
  private async stage1_QueryPreprocessing(): Promise<PipelineStageResult<LLMPreprocessResult>> {
    const stageStart = Date.now();
    console.log('📝 Stage 1: Query Preprocessing with Caching');

    try {
      // Generate cache key for LLM preprocessing
      const cacheKey = EdgeCacheKeyGenerator.generateLLMKey(
        this.context.originalQuery,
        this.context.user?.id
      );

      // Try to get from cache first
      const cachedResult = await llmCacheWrapper.get(cacheKey);
      if (cachedResult) {
        console.log('🎯 Cache HIT for LLM preprocessing');
        this.context.metadata.llmPreprocessing = cachedResult;

        return {
          success: true,
          data: cachedResult,
          processingTime: Date.now() - stageStart,
          metadata: { cacheHit: true }
        };
      }

      console.log('🔄 Cache MISS for LLM preprocessing - fetching fresh data');

      // Check if this is a simple query that doesn't need LLM preprocessing
      const isSimpleQuery = this.context.originalQuery.trim().split(/\s+/).length === 1 &&
                           this.context.originalQuery.length < 20 &&
                           !/[?!@#$%^&*()+={}[\]|\\:";'<>,.\/]/.test(this.context.originalQuery);

      let preprocessingResult;

      if (isSimpleQuery) {
        console.log('⚡ Using fast-path for simple query, skipping LLM preprocessing');
        // Create a simple preprocessing result without LLM call
        preprocessingResult = {
          intent: 'document_retrieval',
          confidence: 0.8,
          expandedQuery: this.context.originalQuery,
          entities: [],
          queryType: 'simple_search',
          processingTime: 0
        };
      } else {
        // Add timeout protection for LLM preprocessing
        const LLM_PREPROCESSING_TIMEOUT = 10000; // 10 seconds max
        const preprocessingPromise = llmPreprocessQuery(this.context.originalQuery);

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('LLM preprocessing timeout')), LLM_PREPROCESSING_TIMEOUT);
        });

        try {
          preprocessingResult = await Promise.race([preprocessingPromise, timeoutPromise]);
        } catch (timeoutError) {
          console.warn('⚠️ LLM preprocessing timed out, using fallback');
          // Create a fallback preprocessing result
          preprocessingResult = {
            intent: 'document_retrieval',
            confidence: 0.6,
            expandedQuery: this.context.originalQuery,
            entities: [],
            queryType: 'timeout_fallback',
            processingTime: LLM_PREPROCESSING_TIMEOUT
          };
        }
      }

      // Cache the result for future use
      await llmCacheWrapper.set(cacheKey, preprocessingResult);

      // Store preprocessing results in metadata
      this.context.metadata.llmPreprocessing = preprocessingResult;

      console.log(`✅ Stage 1 completed in ${Date.now() - stageStart}ms`, {
        intent: preprocessingResult.intent,
        confidence: preprocessingResult.confidence,
        expandedQuery: preprocessingResult.expandedQuery,
        cached: false
      });

      return {
        success: true,
        data: preprocessingResult,
        processingTime: Date.now() - stageStart,
        metadata: { cacheHit: false }
      };

    } catch (error) {
      console.error('❌ Stage 1 failed:', error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - stageStart
      };
    }
  }

  /**
   * Stage 2: Embedding Generation
   * Converts the expanded query into vector embeddings
   */
  private async stage2_EmbeddingGeneration(preprocessing: LLMPreprocessResult): Promise<PipelineStageResult<number[]>> {
    const stageStart = Date.now();
    console.log('🔢 Stage 2: Embedding Generation');

    try {
      const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
      }

      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'embedding-001' });
      
      // Use expanded query for better embeddings
      const queryForEmbedding = preprocessing.expandedQuery || this.context.originalQuery;
      const result = await model.embedContent(queryForEmbedding);
      let embedding = result.embedding.values;

      // Handle dimension mismatch - Gemini returns 768 dimensions but we need 1536 for pgvector
      if (embedding.length !== 1536) {
        console.log(`Converting embedding dimensions from ${embedding.length} to 1536`);
        
        if (embedding.length === 768) {
          // Pad with zeros to reach 1536 dimensions
          const paddedEmbedding = new Array(1536).fill(0);
          for (let i = 0; i < embedding.length; i++) {
            paddedEmbedding[i] = embedding[i];
          }
          embedding = paddedEmbedding;
        } else {
          throw new Error(`Unexpected embedding dimension: ${embedding.length}`);
        }
      }

      // Store embedding in metadata
      this.context.metadata.queryEmbedding = embedding;
      this.context.metadata.embeddingDimensions = 1536;

      console.log(`✅ Stage 2 completed in ${Date.now() - stageStart}ms`);

      return {
        success: true,
        data: embedding,
        processingTime: Date.now() - stageStart
      };

    } catch (error) {
      console.error('❌ Stage 2 failed:', error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - stageStart
      };
    }
  }

  /**
   * Stage 3: Enhanced Hybrid Search Execution with Temporal Routing
   * Performs vector similarity search with keyword matching, financial analysis routing,
   * and enhanced temporal query handling
   */
  private async stage3_HybridSearch(queryEmbedding: number[]): Promise<PipelineStageResult<UnifiedSearchResult[]>> {
    const stageStart = Date.now();
    console.log('🔍 Stage 3: Enhanced Hybrid Search Execution with Temporal Routing');

    try {
      // Check if this is a financial analysis query
      const preprocessing = this.context.metadata.llmPreprocessing;
      if (preprocessing && preprocessing.intent === 'financial_analysis') {
        console.log('💰 Detected financial analysis intent - routing to financial functions');
        return await this.executeFinancialAnalysis(preprocessing);
      }

      // Check if this is a line item query
      console.log('🔍 DEBUG: Checking line item query for:', this.context.originalQuery);
      const isLineItem = this.isLineItemQuery(this.context.originalQuery);
      console.log('🔍 DEBUG: Line item detection result:', isLineItem);

      if (isLineItem) {
        console.log('🍜 Detected line item query - routing to enhanced line item search');
        return await this.executeEnhancedLineItemSearch(queryEmbedding);
      } else {
        console.log('❌ NOT detected as line item query');
      }

      // Enhanced temporal query routing - check both params and preprocessing result
      const temporalRouting = this.context.params.temporalRouting || this.context.metadata.llmPreprocessing?.temporalRouting;
      console.log('🔍 DEBUG: Temporal routing check:', {
        hasTemporalRouting: !!temporalRouting,
        isTemporalQuery: temporalRouting?.isTemporalQuery,
        routingStrategy: temporalRouting?.routingStrategy,
        hasSemanticContent: temporalRouting?.hasSemanticContent,
        semanticTerms: temporalRouting?.semanticTerms,
        sourceParams: !!this.context.params.temporalRouting,
        sourcePreprocessing: !!this.context.metadata.llmPreprocessing?.temporalRouting
      });

      console.log('🔍 DEBUG: About to check temporal routing condition...');
      console.log('🔍 DEBUG: temporalRouting?.isTemporalQuery =', temporalRouting?.isTemporalQuery);
      console.log('🔍 DEBUG: temporalRouting?.routingStrategy =', temporalRouting?.routingStrategy);

      if (temporalRouting?.isTemporalQuery) {
        console.log('⏰ Detected temporal query - routing strategy:', temporalRouting.routingStrategy);
        console.log('🔍 DEBUG: Temporal routing details:', {
          isTemporalQuery: temporalRouting.isTemporalQuery,
          routingStrategy: temporalRouting.routingStrategy,
          hasSemanticContent: temporalRouting.hasSemanticContent,
          semanticTerms: temporalRouting.semanticTerms,
          temporalConfidence: temporalRouting.temporalConfidence
        });
        console.log('🔍 DEBUG: Date filters from params:', {
          startDate: this.context.params.filters?.startDate,
          endDate: this.context.params.filters?.endDate,
          allFilters: this.context.params.filters
        });

        try {
          console.log('🔍 DEBUG: About to use existing query embedding for temporal search...');
          // Use the query embedding that was already generated in Stage 2
          const queryEmbedding = this.context.metadata.queryEmbedding;
          if (!queryEmbedding) {
            throw new Error('Query embedding not found in metadata - Stage 2 may have failed');
          }
          console.log('🔍 DEBUG: Using existing query embedding with', queryEmbedding.length, 'dimensions');

          console.log('🔍 DEBUG: About to execute temporal search...');
          const temporalResult = await this.executeTemporalSearch(queryEmbedding, temporalRouting);
          console.log('🔍 DEBUG: Temporal search returned to stage3:', {
            success: temporalResult.success,
            dataLength: temporalResult.data?.length || 0,
            error: temporalResult.error
          });
          return temporalResult;
        } catch (temporalError) {
          console.error('❌ ERROR in temporal search execution:', temporalError);
          console.log('🔍 DEBUG: Temporal search failed, falling back to regular search');
          // Continue to regular search below
        }
      } else {
        console.log('❌ No temporal routing detected, falling back to regular search');
        console.log('🔍 DEBUG: Why no temporal routing?', {
          hasTemporalRouting: !!temporalRouting,
          isTemporalQuery: temporalRouting?.isTemporalQuery,
          routingStrategy: temporalRouting?.routingStrategy
        });
      }

      // Enhanced hybrid search execution with trigram support
      const candidateLimit = Math.max(50, (this.context.params.limit || 20) * 3);

      // Check if we should use fast simple search for basic queries
      const isSimpleQuery = this.context.originalQuery.trim().split(/\s+/).length === 1 &&
                           this.context.originalQuery.length < 20 &&
                           !/[?!@#$%^&*()+={}[\]|\\:";'<>,.\/]/.test(this.context.originalQuery);

      if (isSimpleQuery) {
        console.log('⚡ Using fast simple search for basic query');
        return await this.executeSimpleSearch(queryEmbedding);
      }

      // Try enhanced hybrid search first with amount filtering support
      let searchResults, error;
      try {
        // Prepare amount filtering parameters (CRITICAL FIX: handle both amountRange and direct amount params)
        const filters = this.context.params.filters || {};
        const amountParams = {
          amount_min: filters.amountRange?.min || filters.minAmount || null,
          amount_max: filters.amountRange?.max || filters.maxAmount || null,
          amount_currency: filters.amountRange?.currency || filters.currency || null
        };

        console.log('💰 ENHANCED AMOUNT FILTERING PARAMS:', {
          originalFilters: filters,
          extractedAmountParams: amountParams,
          hasMinAmount: amountParams.amount_min !== null,
          hasMaxAmount: amountParams.amount_max !== null,
          minAmountValue: amountParams.amount_min,
          maxAmountValue: amountParams.amount_max,
          currency: amountParams.amount_currency,
          amountRange: filters.amountRange
        });

        // MONETARY QUERY FIX: Bypass semantic similarity for monetary queries
        const isMonetaryQuery = amountParams.amount_min !== null || amountParams.amount_max !== null;
        const adjustedSimilarityThreshold = isMonetaryQuery ? 0.0 : (this.context.params.similarityThreshold || 0.2); // 0.0 = bypass semantic similarity
        const adjustedTrigramThreshold = isMonetaryQuery ? 0.0 : 0.3; // 0.0 = bypass trigram similarity

        console.log('💰 DEBUG: Monetary query threshold adjustment (BYPASS SEMANTIC):', {
          isMonetaryQuery,
          originalThreshold: this.context.params.similarityThreshold || 0.2,
          adjustedSimilarityThreshold,
          adjustedTrigramThreshold,
          hasAmountMin: amountParams.amount_min !== null,
          hasAmountMax: amountParams.amount_max !== null,
          bypassingSemantic: isMonetaryQuery
        });

        // Add timeout protection for database query
        const DB_QUERY_TIMEOUT = 30000; // 30 seconds for database query
        const dbQueryPromise = this.context.supabase.rpc('enhanced_hybrid_search', {
          query_embedding: queryEmbedding,
          query_text: this.context.originalQuery,
          source_types: this.context.params.sources,
          content_types: this.context.params.contentTypes,
          similarity_threshold: adjustedSimilarityThreshold,
          trigram_threshold: adjustedTrigramThreshold,
          semantic_weight: 0.6,
          keyword_weight: 0.25,
          trigram_weight: 0.15,
          match_count: candidateLimit,
          user_filter: this.context.user.id,
          team_filter: this.context.params.filters?.teamId,
          language_filter: this.context.params.filters?.language,
          ...amountParams
        });

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Database query timeout')), DB_QUERY_TIMEOUT);
        });

        const enhancedResult = await Promise.race([dbQueryPromise, timeoutPromise]);

        searchResults = enhancedResult.data;
        error = enhancedResult.error;

        if (!error && searchResults) {
          console.log(`✅ Enhanced hybrid search found ${searchResults.length} results`);
          this.context.metadata.sourcesSearched.push('enhanced_hybrid_search');
        }
      } catch (enhancedError) {
        console.warn('Enhanced hybrid search failed, falling back to regular search:', enhancedError);

        // Fallback to regular unified search with temporal filtering
        const dateRange = this.context.params.filters?.dateRange;
        const amountRange = this.context.params.filters?.amountRange;

        console.log('🔄 Fallback unified_search with temporal filters:', {
          dateRange, amountRange
        });

        // 🔧 FIX: Apply monetary query threshold adjustment to fallback path too (BYPASS SEMANTIC)
        const isMonetaryQueryFallback = (amountRange?.min !== null && amountRange?.min !== undefined) ||
                                       (amountRange?.max !== null && amountRange?.max !== undefined);
        const fallbackSimilarityThreshold = isMonetaryQueryFallback ? 0.0 : this.context.params.similarityThreshold; // 0.0 = bypass semantic

        console.log('💰 DEBUG: Fallback monetary query threshold adjustment (BYPASS SEMANTIC):', {
          isMonetaryQueryFallback,
          originalThreshold: this.context.params.similarityThreshold,
          fallbackSimilarityThreshold,
          amountRange,
          bypassingSemantic: isMonetaryQueryFallback
        });

        // 💰 ENHANCED LOGGING: Log database call parameters
        const dbCallParams = {
          query_embedding: queryEmbedding,
          source_types: this.context.params.sources,
          content_types: this.context.params.contentTypes,
          similarity_threshold: fallbackSimilarityThreshold,
          match_count: candidateLimit,
          user_filter: this.context.user.id,
          team_filter: this.context.params.filters?.teamId,
          language_filter: this.context.params.filters?.language,
          // CRITICAL FIX: Pass temporal filters to database function
          start_date: dateRange?.start || null,
          end_date: dateRange?.end || null,
          min_amount: amountRange?.min || null,
          max_amount: amountRange?.max || null
        };

        console.log('💰 🔍 DATABASE CALL PARAMETERS (unified_search):', {
          min_amount: dbCallParams.min_amount,
          max_amount: dbCallParams.max_amount,
          start_date: dbCallParams.start_date,
          end_date: dbCallParams.end_date,
          similarity_threshold: dbCallParams.similarity_threshold,
          match_count: dbCallParams.match_count,
          source_types: dbCallParams.source_types,
          hasAmountFiltering: dbCallParams.min_amount !== null || dbCallParams.max_amount !== null
        });

        const fallbackResult = await this.context.supabase.rpc('unified_search', dbCallParams);

        searchResults = fallbackResult.data;
        error = fallbackResult.error;
        this.context.metadata.fallbacksUsed.push('regular_unified_search');
      }

      if (error) {
        throw new Error(`Search failed: ${error.message}`);
      }

      if (!searchResults || searchResults.length === 0) {
        console.log('⚠️ No search results found');
        return {
          success: true,
          data: [],
          processingTime: Date.now() - stageStart
        };
      }

      // Transform database results to unified format
      const transformedResults = await this.transformSearchResults(searchResults);

      // Store sources searched in metadata
      this.context.metadata.sourcesSearched = this.context.params.sources || [];

      console.log(`✅ Stage 3 completed in ${Date.now() - stageStart}ms - Found ${transformedResults.length} candidates`);

      return {
        success: true,
        data: transformedResults,
        processingTime: Date.now() - stageStart,
        metadata: {
          candidatesFound: transformedResults.length,
          sourcesSearched: this.context.params.sources
        }
      };

    } catch (error) {
      console.error('❌ Stage 3 failed:', error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - stageStart
      };
    }
  }

  /**
   * Validate temporal search prerequisites
   */
  private validateTemporalSearchPrerequisites(routingStrategy?: string): { isValid: boolean; error?: string } {
    const startDate = this.context.params.filters?.startDate;
    const endDate = this.context.params.filters?.endDate;
    const hasAmountRange = !!(this.context.params.filters?.amountRange ||
                             this.context.params.filters?.minAmount !== undefined ||
                             this.context.params.filters?.maxAmount !== undefined);

    console.log('🔍 TEMPORAL VALIDATION: Checking prerequisites:', {
      routingStrategy,
      hasStartDate: !!startDate,
      hasEndDate: !!endDate,
      hasAmountRange,
      amountRange: this.context.params.filters?.amountRange,
      minAmount: this.context.params.filters?.minAmount,
      maxAmount: this.context.params.filters?.maxAmount
    });

    // CRITICAL FIX: For semantic_only routing with amount filtering, dates are not required
    if (routingStrategy === 'semantic_only' && hasAmountRange) {
      console.log('✅ TEMPORAL VALIDATION: semantic_only with amount range - dates not required');
      return { isValid: true };
    }

    // For date-based or hybrid routing, dates are required
    if (!startDate || !endDate) {
      return {
        isValid: false,
        error: 'Date range is required for temporal search but was not provided'
      };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return {
        isValid: false,
        error: 'Invalid date format in temporal search parameters'
      };
    }

    if (start > end) {
      return {
        isValid: false,
        error: 'Start date cannot be after end date in temporal search'
      };
    }

    return { isValid: true };
  }

  /**
   * Execute temporal search with hybrid routing strategy
   */
  private async executeTemporalSearch(
    queryEmbedding: number[],
    temporalRouting: NonNullable<UnifiedSearchParams['temporalRouting']>
  ): Promise<PipelineStageResult<UnifiedSearchResult[]>> {
    const stageStart = Date.now();
    console.log('⏰ Executing temporal search with strategy:', temporalRouting.routingStrategy);

    // Validate prerequisites with routing strategy
    const validation = this.validateTemporalSearchPrerequisites(temporalRouting.routingStrategy);
    if (!validation.isValid) {
      console.error('❌ Temporal search validation failed:', validation.error);
      return {
        success: false,
        error: validation.error!,
        processingTime: Date.now() - stageStart
      };
    }

    try {
      let result;
      switch (temporalRouting.routingStrategy) {
        case 'date_filter_only':
          result = await this.executeDateFilterOnlySearch();
          console.log('🔍 DEBUG: Date filter only search result:', {
            success: result.success,
            dataLength: result.data?.length || 0,
            error: result.error
          });
          return result;

        case 'hybrid_temporal_semantic':
          result = await this.executeHybridTemporalSemanticSearch(queryEmbedding, temporalRouting);
          console.log('🔍 DEBUG: Hybrid temporal semantic search result:', {
            success: result.success,
            dataLength: result.data?.length || 0,
            error: result.error
          });

          // CRITICAL FIX: If hybrid search returns 0 results, try date filter only as fallback
          if (result.success && result.data && result.data.length === 0) {
            console.log('🔄 Hybrid temporal semantic search returned 0 results, trying date filter only fallback...');
            const dateFilterResult = await this.executeDateFilterOnlySearch();
            if (dateFilterResult.success && dateFilterResult.data && dateFilterResult.data.length > 0) {
              console.log(`✅ Date filter fallback found ${dateFilterResult.data.length} results`);
              // Update metadata to indicate this was a fallback
              dateFilterResult.metadata = {
                ...dateFilterResult.metadata,
                searchMethod: 'date_filter_only_fallback_from_hybrid',
                originalSearchMethod: 'hybrid_temporal_semantic',
                fallbackReason: 'hybrid_search_returned_zero_results'
              };
              return dateFilterResult;
            }
          }

          return result;

        case 'semantic_only':
        default:
          // Fall through to regular semantic search
          result = await this.executeOriginalHybridSearch(queryEmbedding);
          console.log('🔍 DEBUG: Original hybrid search result:', {
            success: result.success,
            dataLength: result.data?.length || 0,
            error: result.error
          });
          return result;
      }
    } catch (error) {
      console.error('❌ Temporal search execution failed:', error);
      return {
        success: false,
        error: `Temporal search failed: ${error.message}`,
        processingTime: Date.now() - stageStart
      };
    }
  }

  /**
   * Execute date filtering only (for pure temporal queries like "last week receipts")
   */
  private async executeDateFilterOnlySearch(): Promise<PipelineStageResult<UnifiedSearchResult[]>> {
    const stageStart = Date.now();
    console.log('📅 Executing date filter only search');

    try {
      // Get date range from filters (set by temporal parsing)
      const startDate = this.context.params.filters?.startDate;
      const endDate = this.context.params.filters?.endDate;

      console.log('🔍 DEBUG: Date filter search - checking filters:', {
        startDate,
        endDate,
        allFilters: this.context.params.filters
      });

      if (!startDate || !endDate) {
        throw new Error('Date range required for date filter only search');
      }

      const dateRange = { start: startDate, end: endDate };
      console.log('📅 Using date range:', dateRange);

      // Debug: Log the exact query parameters
      console.log('🔍 DEBUG: Query parameters:', {
        user_id: this.context.user.id,
        date_start: dateRange.start,
        date_end: dateRange.end,
        limit: this.context.params.limit || 20
      });

      // CRITICAL FIX: Add comprehensive debugging for date filter only search
      console.log('🔍 DEBUG: Date filter only search parameters:', {
        userId: this.context.user?.id,
        dateRangeStart: dateRange.start,
        dateRangeEnd: dateRange.end,
        limit: this.context.params.limit || 20,
        userContextExists: !!this.context.user
      });

      // CRITICAL FIX: Validate user context before executing query
      if (!this.context.user?.id) {
        console.error('❌ CRITICAL: User context missing in date filter only search');
        throw new Error('User authentication required for date filter search');
      }

      // CRITICAL FIX: For temporal queries, we need to return ALL receipts in the date range
      // First, check if we have information about the total count from previous steps
      const expectedReceiptCount = this.context.metadata?.receiptIdsInRange ||
                                   this.context.metadata?.totalReceiptsInRange;

      // Calculate appropriate limit: use expected count + buffer, or default limit
      const dynamicLimit = expectedReceiptCount ?
        Math.max(expectedReceiptCount + 10, this.context.params.limit || 20) :
        (this.context.params.limit || 20);

      console.log('🔍 DEBUG: Dynamic limit calculation:', {
        expectedReceiptCount,
        originalLimit: this.context.params.limit || 20,
        dynamicLimit,
        reasoning: expectedReceiptCount ?
          'Using expected count + buffer for temporal query' :
          'Using default limit (no count available)'
      });

      // Query receipts table directly with date filtering
      const { data: receipts, error } = await this.context.supabase
        .from('receipts')
        .select(`
          id, merchant, total, currency, date, created_at,
          predicted_category, payment_method, status
        `)
        .eq('user_id', this.context.user.id)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date', { ascending: false })
        .limit(dynamicLimit);

      console.log('🔍 DEBUG: Date filter only query result:', {
        error: error?.message || null,
        resultCount: receipts?.length || 0,
        sampleResults: receipts?.slice(0, 3)?.map(r => ({ id: r.id, merchant: r.merchant, date: r.date })) || []
      });

      console.log('🔍 DEBUG: Database query result:', {
        error: error,
        receipts_count: receipts?.length || 0,
        receipts_sample: receipts?.slice(0, 2) || []
      });

      if (error) {
        console.error('❌ Database query error:', error);
        throw new Error(`Database query failed: ${error.message}`);
      }

      // Transform receipts to UnifiedSearchResult format
      console.log('🔍 DEBUG: Starting result transformation for receipts:', receipts?.length || 0);

      const results: UnifiedSearchResult[] = (receipts || []).map(receipt => {
        console.log('🔍 DEBUG: Transforming receipt:', {
          id: receipt.id,
          merchant: receipt.merchant,
          date: receipt.date,
          total: receipt.total
        });

        return {
          id: receipt.id,
          sourceType: 'receipt' as const,
          sourceId: receipt.id,
          contentType: 'full_text',
          title: `${receipt.merchant} - ${receipt.currency} ${receipt.total}`,
          description: `Receipt from ${receipt.date}${receipt.predicted_category ? ` • ${receipt.predicted_category}` : ''}`,
          similarity: 1.0, // Perfect match for date filtering
          metadata: {
            merchant: receipt.merchant,
            total: receipt.total,
            currency: receipt.currency,
            date: receipt.date,
            category: receipt.predicted_category,
            payment_method: receipt.payment_method,
            status: receipt.status
          },
          accessLevel: 'user' as const,
          createdAt: receipt.created_at,
          updatedAt: receipt.created_at
        };
      });

      console.log('🔍 DEBUG: Final transformed results count:', results.length);

      console.log(`✅ Date filter search found ${results.length} results`);
      console.log('🔍 DEBUG: Returning results:', {
        success: true,
        results_count: results.length,
        sample_results: results.slice(0, 2).map(r => ({ id: r.id, title: r.title }))
      });

      // If no results found, try fallback temporal search with broader date ranges
      if (results.length === 0) {
        console.log('🔄 No results found for temporal query, trying fallback search...');
        const fallbackResult = await this.executeFallbackTemporalSearch(dateRange, stageStart);
        if (fallbackResult.success && fallbackResult.data && fallbackResult.data.length > 0) {
          console.log(`✅ Fallback temporal search found ${fallbackResult.data.length} results`);
          return fallbackResult;
        }
      }

      this.context.metadata.sourcesSearched.push('date_filter_receipts');

      return {
        success: true,
        data: results,
        processingTime: Date.now() - stageStart,
        metadata: {
          searchMethod: 'date_filter_only',
          dateRange,
          resultsCount: results.length
        }
      };
    } catch (error) {
      console.error('❌ Date filter search failed:', error);
      return {
        success: false,
        error: `Date filter search failed: ${error.message}`,
        processingTime: Date.now() - stageStart
      };
    }
  }

  /**
   * Execute fallback temporal search with broader date ranges
   */
  private async executeFallbackTemporalSearch(
    originalDateRange: { start: string; end: string },
    originalStageStart: number
  ): Promise<PipelineStageResult<UnifiedSearchResult[]>> {
    console.log('🔄 Executing fallback temporal search with broader date ranges');
    console.log('🔍 DEBUG: Fallback search triggered with original date range:', originalDateRange);

    // CRITICAL FIX: Validate user context before fallback
    if (!this.context.user?.id) {
      console.error('❌ CRITICAL: User context missing in fallback temporal search');
      return {
        success: false,
        error: 'User authentication required for fallback temporal search',
        processingTime: Date.now() - originalStageStart
      };
    }

    // Define fallback strategies in order of preference
    const fallbackStrategies = [
      {
        name: 'last_2_months',
        getDateRange: () => {
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
          const end = new Date(now.getFullYear(), now.getMonth(), 0);
          return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
          };
        }
      },
      {
        name: 'last_3_months',
        getDateRange: () => {
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          const end = new Date(now.getFullYear(), now.getMonth(), 0);
          return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
          };
        }
      },
      {
        name: 'recent_receipts',
        getDateRange: () => {
          const now = new Date();
          const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
          return {
            start: start.toISOString().split('T')[0],
            end: now.toISOString().split('T')[0]
          };
        }
      }
    ];

    for (const strategy of fallbackStrategies) {
      const fallbackDateRange = strategy.getDateRange();
      console.log(`🔄 Trying fallback strategy: ${strategy.name}`, fallbackDateRange);

      // CRITICAL FIX: Add detailed debugging for each fallback strategy
      console.log('🔍 DEBUG: Fallback strategy details:', {
        strategyName: strategy.name,
        originalDateRange,
        fallbackDateRange,
        daysDifference: Math.ceil((new Date(fallbackDateRange.end).getTime() - new Date(fallbackDateRange.start).getTime()) / (1000 * 60 * 60 * 24)) + 1
      });

      try {
        const { data: receipts, error } = await this.context.supabase
          .from('receipts')
          .select(`
            id, merchant, total, currency, date, created_at,
            predicted_category, payment_method, status
          `)
          .eq('user_id', this.context.user.id)
          .gte('date', fallbackDateRange.start)
          .lte('date', fallbackDateRange.end)
          .order('date', { ascending: false })
          .limit(Math.max(this.context.params.limit || 20, 50)); // CRITICAL FIX: Use higher limit for fallback temporal results

        console.log(`🔍 DEBUG: Fallback strategy ${strategy.name} query result:`, {
          error: error?.message || null,
          resultCount: receipts?.length || 0,
          sampleResults: receipts?.slice(0, 3)?.map(r => ({ id: r.id, merchant: r.merchant, date: r.date })) || []
        });

        if (error) {
          console.warn(`⚠️ Fallback strategy ${strategy.name} failed:`, error);
          continue;
        }

        if (receipts && receipts.length > 0) {
          console.log(`✅ Fallback strategy ${strategy.name} found ${receipts.length} results`);

          // Transform receipts to UnifiedSearchResult format
          const results: UnifiedSearchResult[] = receipts.map(receipt => ({
            id: receipt.id,
            sourceType: 'receipt' as const,
            sourceId: receipt.id,
            contentType: 'full_text',
            title: `${receipt.merchant} - ${receipt.currency} ${receipt.total}`,
            description: `Receipt from ${receipt.date}${receipt.predicted_category ? ` • ${receipt.predicted_category}` : ''}`,
            similarity: 0.8, // Lower similarity to indicate fallback result
            metadata: {
              merchant: receipt.merchant,
              total: receipt.total,
              currency: receipt.currency,
              date: receipt.date,
              category: receipt.predicted_category,
              payment_method: receipt.payment_method,
              status: receipt.status,
              fallbackStrategy: strategy.name,
              originalDateRange,
              expandedDateRange: fallbackDateRange
            },
            accessLevel: 'user' as const,
            createdAt: receipt.created_at,
            updatedAt: receipt.created_at
          }));

          this.context.metadata.sourcesSearched.push(`fallback_temporal_${strategy.name}`);

          // CRITICAL FIX: Mark this as a fallback result in the context metadata
          // This will be used later to preserve the original date range for display
          console.log('🔍 DEBUG: Marking context as fallback result with original date range');
          this.context.metadata.isFallbackResult = true;
          this.context.metadata.fallbackStrategy = strategy.name;
          this.context.metadata.originalDateRange = originalDateRange;
          this.context.metadata.expandedDateRange = fallbackDateRange;

          return {
            success: true,
            data: results,
            processingTime: Date.now() - originalStageStart,
            metadata: {
              searchMethod: 'fallback_temporal',
              fallbackStrategy: strategy.name,
              originalDateRange,
              expandedDateRange: fallbackDateRange,
              resultsCount: results.length
            }
          };
        }
      } catch (error) {
        console.warn(`⚠️ Fallback strategy ${strategy.name} error:`, error);
        continue;
      }
    }

    console.log('❌ All fallback temporal strategies failed to find results');
    return {
      success: true,
      data: [],
      processingTime: Date.now() - originalStageStart,
      metadata: {
        searchMethod: 'fallback_temporal_failed',
        originalDateRange,
        fallbackStrategiesTried: fallbackStrategies.map(s => s.name),
        resultsCount: 0
      }
    };
  }

  /**
   * Execute hybrid temporal + semantic search
   */
  private async executeHybridTemporalSemanticSearch(
    queryEmbedding: number[],
    temporalRouting: NonNullable<UnifiedSearchParams['temporalRouting']>
  ): Promise<PipelineStageResult<UnifiedSearchResult[]>> {
    const stageStart = Date.now();
    console.log('🔄 Executing hybrid temporal + semantic search');
    console.log('🎯 Semantic terms:', temporalRouting.semanticTerms);

    try {
      // Get date range from filters (set by temporal parsing)
      const startDate = this.context.params.filters?.startDate;
      const endDate = this.context.params.filters?.endDate;

      if (!startDate || !endDate) {
        throw new Error('Date range required for hybrid temporal search');
      }

      const dateRange = { start: startDate, end: endDate };
      console.log('🔄 Using date range for hybrid search:', dateRange);

      // Step 1: Get receipt IDs within date range
      // CRITICAL FIX: Add comprehensive debugging for date filtering
      console.log('🔍 DEBUG: Date filtering query parameters:', {
        userId: this.context.user?.id,
        dateRangeStart: dateRange.start,
        dateRangeEnd: dateRange.end,
        userContextExists: !!this.context.user,
        supabaseExists: !!this.context.supabase
      });

      // CRITICAL FIX: Validate user context before executing query
      if (!this.context.user?.id) {
        console.error('❌ CRITICAL: User context missing in hybrid temporal search');
        throw new Error('User authentication required for temporal search');
      }

      const { data: dateFilteredReceipts, error: dateError } = await this.context.supabase
        .from('receipts')
        .select('id')
        .eq('user_id', this.context.user.id)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end);

      console.log('🔍 DEBUG: Date filtering query result:', {
        error: dateError?.message || null,
        resultCount: dateFilteredReceipts?.length || 0,
        sampleResults: dateFilteredReceipts?.slice(0, 3)
      });

      if (dateError) {
        console.error('❌ Date filtering query failed:', dateError);
        throw new Error(`Date filtering failed: ${dateError.message}`);
      }

      const receiptIds = (dateFilteredReceipts || []).map(r => r.id);
      console.log(`📅 Found ${receiptIds.length} receipts in date range ${dateRange.start} to ${dateRange.end}`);
      console.log('🔍 DEBUG: Receipt IDs in date range:', receiptIds.slice(0, 10)); // Limit to first 10 for readability

      // CRITICAL FIX: Store receipt count in metadata for dynamic limit calculation
      this.context.metadata.totalReceiptsInRange = receiptIds.length;
      this.context.metadata.receiptIdsInRange = receiptIds.length;
      console.log('🔍 DEBUG: Stored receipt count in metadata for dynamic limiting:', {
        totalReceiptsInRange: receiptIds.length,
        dateRange: `${dateRange.start} to ${dateRange.end}`
      });

      // CRITICAL FIX: If no receipts found, verify the issue before triggering fallback
      if (receiptIds.length === 0) {
        console.log('⚠️ CRITICAL: No receipts found in date range - investigating...');

        // Check if receipts exist for this user at all
        const { data: userReceiptCount, error: countError } = await this.context.supabase
          .from('receipts')
          .select('id', { count: 'exact' })
          .eq('user_id', this.context.user.id);

        console.log('🔍 DEBUG: User receipt verification:', {
          totalUserReceipts: userReceiptCount?.length || 0,
          countError: countError?.message || null
        });

        // Check if receipts exist in the date range for any user (debugging)
        const { data: dateRangeReceipts, error: dateRangeError } = await this.context.supabase
          .from('receipts')
          .select('id, user_id, date')
          .gte('date', dateRange.start)
          .lte('date', dateRange.end)
          .limit(5);

        console.log('🔍 DEBUG: Date range verification (any user):', {
          receiptsInDateRange: dateRangeReceipts?.length || 0,
          sampleReceipts: dateRangeReceipts?.map(r => ({ id: r.id, date: r.date, user_id: r.user_id })) || [],
          dateRangeError: dateRangeError?.message || null
        });
      }

      // PERFORMANCE FIX: Check for large date ranges that might cause timeouts
      const rangeStartDate = new Date(dateRange.start);
      const rangeEndDate = new Date(dateRange.end);
      const daysDiff = Math.ceil((rangeEndDate.getTime() - rangeStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const isLargeDateRange = daysDiff > 7 || receiptIds.length > 50;

      if (isLargeDateRange) {
        console.log(`⚠️ Large temporal query detected: ${daysDiff} days, ${receiptIds.length} receipts - using optimized approach`);

        // For large date ranges, skip semantic search and go directly to date filter only
        if (daysDiff > 14 || receiptIds.length > 100) {
          console.log('🔄 Date range too large for hybrid search, falling back to date filter only');
          const fallbackResult = await this.executeDateFilterOnlySearch();
          if (fallbackResult.success && fallbackResult.data && fallbackResult.data.length > 0) {
            console.log(`✅ Date filter fallback found ${fallbackResult.data.length} results for large range`);
            fallbackResult.metadata = {
              ...fallbackResult.metadata,
              searchMethod: 'date_filter_only_large_range_optimization',
              originalSearchMethod: 'hybrid_temporal_semantic',
              optimizationReason: 'large_date_range_performance',
              daysDiff,
              receiptIdsInRange: receiptIds.length
            };
            return fallbackResult;
          }
        }
      }

      if (receiptIds.length === 0) {
        console.log('🔄 No receipts found in date range for hybrid search, trying fallback...');
        console.log('🔍 DEBUG: Fallback trigger details:', {
          originalDateRange: dateRange,
          userHasReceipts: this.context.user?.id ? 'checked above' : 'unknown',
          searchMethod: 'hybrid_temporal_semantic'
        });

        // CRITICAL FIX: Before triggering fallback, try date filter only search first
        // This ensures we use the correct date range before expanding to broader ranges
        console.log('🔄 Trying date filter only search with original date range before fallback...');
        const dateFilterResult = await this.executeDateFilterOnlySearch();
        if (dateFilterResult.success && dateFilterResult.data && dateFilterResult.data.length > 0) {
          console.log(`✅ Date filter only search found ${dateFilterResult.data.length} results with original date range`);

          // CRITICAL FIX: Ensure the original date range is preserved when using date filter as fallback
          console.log('🔍 DEBUG: Date filter fallback preserving original date range');
          this.context.metadata.isFallbackResult = false; // This is not a fallback, it's using the correct date range
          this.context.metadata.originalDateRange = dateRange; // Preserve the original date range

          dateFilterResult.metadata = {
            ...dateFilterResult.metadata,
            searchMethod: 'date_filter_only_from_hybrid_fallback',
            originalSearchMethod: 'hybrid_temporal_semantic',
            fallbackReason: 'no_receipt_ids_found_in_hybrid_search',
            preservedOriginalDateRange: true
          };
          return dateFilterResult;
        }

        // If date filter only also fails, then try broader fallback
        console.log('🔄 Date filter only search also failed, trying broader temporal fallback...');
        const fallbackResult = await this.executeFallbackTemporalSearch(dateRange, stageStart);
        if (fallbackResult.success && fallbackResult.data && fallbackResult.data.length > 0) {
          console.log(`✅ Fallback temporal search found ${fallbackResult.data.length} results for hybrid query`);
          // Update metadata to indicate this was a hybrid query with fallback
          fallbackResult.metadata = {
            ...fallbackResult.metadata,
            searchMethod: 'hybrid_temporal_semantic_with_fallback',
            originalSearchMethod: 'hybrid_temporal_semantic'
          };
          return fallbackResult;
        }

        return {
          success: true,
          data: [],
          processingTime: Date.now() - stageStart,
          metadata: {
            searchMethod: 'hybrid_temporal_semantic',
            dateRange,
            receiptIdsInRange: 0,
            semanticResults: 0,
            fallbackAttempted: true
          }
        };
      }

      // Step 2: Perform semantic search within those receipt IDs
      const semanticQuery = temporalRouting.semanticTerms.join(' ');
      console.log('🔍 Performing semantic search for:', semanticQuery);

      const candidateLimit = Math.max(50, (this.context.params.limit || 20) * 2);

      console.log('🔍 DEBUG: Calling enhanced_hybrid_search with receipt_ids_filter:', {
        receiptIds,
        receiptIdsCount: receiptIds.length,
        semanticQuery,
        candidateLimit
      });

      // CRITICAL FIX: Add timeout protection for temporal search database query
      const TEMPORAL_DB_QUERY_TIMEOUT = 25000; // 25 seconds for temporal database query (shorter than regular)
      const temporalDbQueryPromise = this.context.supabase.rpc('enhanced_hybrid_search', {
        query_embedding: queryEmbedding,
        query_text: semanticQuery,
        source_types: ['receipt'],
        content_types: this.context.params.contentTypes,
        similarity_threshold: 0.1, // Lower threshold for temporal queries
        trigram_threshold: 0.2,
        semantic_weight: 0.7, // Higher semantic weight for hybrid queries
        keyword_weight: 0.2,
        trigram_weight: 0.1,
        match_count: candidateLimit,
        user_filter: this.context.user.id,
        team_filter: this.context.params.filters?.teamId,
        language_filter: this.context.params.filters?.language,
        amount_min: null,
        amount_max: null,
        amount_currency: null,
        receipt_ids_filter: receiptIds // 🔧 FIX: Constrain search to date-filtered receipts
      });

      const temporalTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Temporal database query timeout')), TEMPORAL_DB_QUERY_TIMEOUT);
      });

      let semanticResults, semanticError;
      try {
        const result = await Promise.race([temporalDbQueryPromise, temporalTimeoutPromise]);
        semanticResults = result.data;
        semanticError = result.error;
      } catch (timeoutError) {
        console.warn('⚠️ Temporal database query timed out, falling back to date filter only');
        semanticError = timeoutError;
        semanticResults = null;
      }

      console.log('🔍 DEBUG: enhanced_hybrid_search results:', {
        resultsCount: semanticResults?.length || 0,
        error: semanticError?.message || null,
        sampleResults: semanticResults?.slice(0, 3)?.map(r => ({
          source_id: r.source_id,
          merchant: r.metadata?.merchant,
          date: r.metadata?.date
        })) || []
      });

      if (semanticError) {
        console.warn('Semantic search failed, falling back to date filter only:', semanticError);
        return await this.executeDateFilterOnlySearch();
      }

      // Step 3: Filter semantic results to only include receipts in date range
      const filteredResults = (semanticResults || []).filter(result =>
        result.source_type === 'receipt' && receiptIds.includes(result.source_id)
      );

      console.log(`🔍 Semantic search results: ${semanticResults?.length || 0} total, ${filteredResults.length} in date range`);

      // CRITICAL FIX: If semantic search returns 0 results but we have receipts in date range,
      // fall back to returning the receipts directly (no embeddings available)
      if (filteredResults.length === 0 && receiptIds.length > 0) {
        console.log('🔄 Semantic search returned 0 results but receipts exist in date range - falling back to direct receipt query');
        console.log(`📅 Falling back to date filter only search for ${receiptIds.length} receipts in range`);
        console.log('💡 This suggests that receipts exist but embeddings are missing - this is expected for recently uploaded receipts');

        // Fall back to date filter only search which queries receipts table directly
        const fallbackResult = await this.executeDateFilterOnlySearch();
        if (fallbackResult.success && fallbackResult.data && fallbackResult.data.length > 0) {
          console.log(`✅ Date filter fallback found ${fallbackResult.data.length} results`);

          // Add user-friendly message about why fallback was used
          const fallbackMessage = `Found ${fallbackResult.data.length} receipt${fallbackResult.data.length === 1 ? '' : 's'} from the specified date range. Note: These receipts may still be processing for enhanced search capabilities.`;

          // Update metadata to indicate this was a hybrid query with fallback
          fallbackResult.metadata = {
            ...fallbackResult.metadata,
            searchMethod: 'hybrid_temporal_semantic_with_date_fallback',
            originalSearchMethod: 'hybrid_temporal_semantic',
            fallbackReason: 'no_embeddings_for_receipts_in_date_range',
            receiptIdsInRange: receiptIds.length,
            semanticResults: 0,
            userMessage: fallbackMessage,
            isEmbeddingFallback: true
          };
          return fallbackResult;
        }
      }

      // Step 4: Deduplicate and transform to UnifiedSearchResult format
      // Group by source_id to handle multiple embeddings per receipt
      const resultsBySourceId = new Map<string, any>();

      for (const result of filteredResults) {
        const sourceId = result.source_id;
        const currentScore = result.similarity || result.combined_score || 0;

        if (!resultsBySourceId.has(sourceId) ||
            (resultsBySourceId.get(sourceId).similarity || 0) < currentScore) {
          resultsBySourceId.set(sourceId, result);
        }
      }

      console.log(`🔍 Temporal deduplication: ${filteredResults.length} results → ${resultsBySourceId.size} unique receipts`);

      const results: UnifiedSearchResult[] = Array.from(resultsBySourceId.values()).map(result => ({
        id: result.id,
        sourceType: result.source_type as 'receipt',
        sourceId: result.source_id,
        contentType: result.content_type,
        title: `${result.metadata?.merchant || 'Unknown'} - ${result.metadata?.currency || ''} ${result.metadata?.total || ''}`,
        description: `${result.content_text} • ${result.metadata?.date || ''}`,
        similarity: result.similarity || result.combined_score || 0,
        metadata: result.metadata || {},
        accessLevel: 'user' as const,
        createdAt: result.metadata?.created_at || new Date().toISOString(),
        updatedAt: result.metadata?.updated_at
      }));

      console.log(`✅ Hybrid temporal search found ${results.length} results (${semanticResults?.length || 0} semantic, ${receiptIds.length} in date range)`);
      this.context.metadata.sourcesSearched.push('hybrid_temporal_semantic');

      return {
        success: true,
        data: results,
        processingTime: Date.now() - stageStart,
        metadata: {
          searchMethod: 'hybrid_temporal_semantic',
          dateRange,
          receiptIdsInRange: receiptIds.length,
          semanticResults: semanticResults?.length || 0,
          filteredResults: results.length,
          semanticTerms: temporalRouting.semanticTerms
        }
      };
    } catch (error) {
      console.error('❌ Hybrid temporal search failed:', error);
      return {
        success: false,
        error: `Hybrid temporal search failed: ${error.message}`,
        processingTime: Date.now() - stageStart
      };
    }
  }

  /**
   * Execute original hybrid search (renamed for clarity)
   */
  private async executeOriginalHybridSearch(queryEmbedding: number[]): Promise<PipelineStageResult<UnifiedSearchResult[]>> {
    const stageStart = Date.now();
    console.log('🔍 Executing original hybrid search');

    try {
      // Continue with the existing hybrid search logic from the original method
      const candidateLimit = Math.max(50, (this.context.params.limit || 20) * 3);

      // Prepare amount filtering parameters (CRITICAL FIX: handle both amountRange and direct amount params)
      const filters = this.context.params.filters || {};
      const amountParams = {
        amount_min: filters.amountRange?.min || filters.minAmount || null,
        amount_max: filters.amountRange?.max || filters.maxAmount || null,
        amount_currency: filters.amountRange?.currency || filters.currency || null
      };

      console.log('💰 Amount filtering params:', amountParams);

      // MONETARY QUERY FIX: Bypass semantic similarity for monetary queries (second location)
      const isMonetaryQuery = amountParams.amount_min !== null || amountParams.amount_max !== null;
      const adjustedSimilarityThreshold = isMonetaryQuery ? 0.0 : (this.context.params.similarityThreshold || 0.2); // 0.0 = bypass semantic
      const adjustedTrigramThreshold = isMonetaryQuery ? 0.0 : 0.3; // 0.0 = bypass trigram

      console.log('💰 DEBUG: Monetary query threshold adjustment (location 2, BYPASS SEMANTIC):', {
        isMonetaryQuery,
        adjustedSimilarityThreshold,
        adjustedTrigramThreshold,
        bypassingSemantic: isMonetaryQuery
      });

      const enhancedResult = await this.context.supabase.rpc('enhanced_hybrid_search', {
        query_embedding: queryEmbedding,
        query_text: this.context.originalQuery,
        source_types: this.context.params.sources,
        content_types: this.context.params.contentTypes,
        similarity_threshold: adjustedSimilarityThreshold,
        trigram_threshold: adjustedTrigramThreshold,
        semantic_weight: 0.6,
        keyword_weight: 0.25,
        trigram_weight: 0.15,
        match_count: candidateLimit,
        user_filter: this.context.user.id,
        team_filter: this.context.params.filters?.teamId,
        language_filter: this.context.params.filters?.language,
        ...amountParams
      });

      const searchResults = enhancedResult.data;
      const error = enhancedResult.error;

      if (error) {
        throw new Error(`Enhanced hybrid search failed: ${error.message}`);
      }

      if (!searchResults) {
        throw new Error('No search results returned');
      }

      console.log(`✅ Enhanced hybrid search found ${searchResults.length} results`);
      this.context.metadata.sourcesSearched.push('enhanced_hybrid_search');

      // Transform results
      const transformedResults = await this.transformSearchResults(searchResults);

      return {
        success: true,
        data: transformedResults,
        processingTime: Date.now() - stageStart,
        metadata: {
          searchMethod: 'enhanced_hybrid_search',
          resultsCount: transformedResults.length
        }
      };
    } catch (error) {
      console.error('❌ Original hybrid search failed:', error);
      return {
        success: false,
        error: `Original hybrid search failed: ${error.message}`,
        processingTime: Date.now() - stageStart
      };
    }
  }

  /**
   * Execute financial analysis using appropriate RPC functions with caching
   */
  private async executeFinancialAnalysis(preprocessing: any): Promise<PipelineStageResult<UnifiedSearchResult[]>> {
    const stageStart = Date.now();
    console.log('📊 Executing Financial Analysis with Caching');

    try {
      const query = this.context.originalQuery.toLowerCase();
      let analysisResults: any[] = [];
      let analysisType = 'general';

      // Determine which financial analysis to perform based on query content
      if (query.includes('category') || query.includes('categories') || query.includes('spending by')) {
        analysisType = 'category_analysis';

        // Generate cache key for this financial function
        const cacheKey = EdgeCacheKeyGenerator.generateFinancialKey(
          'get_spending_by_category',
          this.context.user.id,
          {
            start_date: this.context.params.filters?.dateRange?.start || null,
            end_date: this.context.params.filters?.dateRange?.end || null,
            currency_filter: 'MYR'
          }
        );

        // Try cache first
        const cachedResult = await financialCacheWrapper.get(cacheKey);
        if (cachedResult) {
          console.log('🎯 Cache HIT for spending by category');
          analysisResults = cachedResult;
        } else {
          console.log('🔄 Cache MISS for spending by category - fetching fresh data');
          const { data, error } = await this.context.supabase.rpc('get_spending_by_category', {
            user_filter: this.context.user.id,
            start_date: this.context.params.filters?.dateRange?.start || null,
            end_date: this.context.params.filters?.dateRange?.end || null,
            currency_filter: 'MYR'
          });
          if (!error) {
            analysisResults = data || [];
            // Cache the result
            await financialCacheWrapper.set(cacheKey, analysisResults);
          }
        }
      }
      else if (query.includes('monthly') || query.includes('month') || query.includes('trend')) {
        analysisType = 'monthly_trends';

        const cacheKey = EdgeCacheKeyGenerator.generateFinancialKey(
          'get_monthly_spending_trends',
          this.context.user.id,
          { months_back: 12, currency_filter: 'MYR' }
        );

        const cachedResult = await financialCacheWrapper.get(cacheKey);
        if (cachedResult) {
          console.log('🎯 Cache HIT for monthly spending trends');
          analysisResults = cachedResult;
        } else {
          console.log('🔄 Cache MISS for monthly spending trends - fetching fresh data');
          const { data, error } = await this.context.supabase.rpc('get_monthly_spending_trends', {
            user_filter: this.context.user.id,
            months_back: 12,
            currency_filter: 'MYR'
          });
          if (!error) {
            analysisResults = data || [];
            await financialCacheWrapper.set(cacheKey, analysisResults);
          }
        }
      }
      else if (query.includes('merchant') || query.includes('store') || query.includes('shop')) {
        analysisType = 'merchant_analysis';
        const { data, error } = await this.context.supabase.rpc('get_merchant_analysis', {
          user_filter: this.context.user.id,
          start_date: this.context.params.filters?.dateRange?.start || null,
          end_date: this.context.params.filters?.dateRange?.end || null,
          currency_filter: 'MYR',
          limit_results: 20
        });
        if (!error) analysisResults = data || [];
      }
      else if (query.includes('anomal') || query.includes('unusual') || query.includes('strange')) {
        analysisType = 'anomaly_analysis';
        const { data, error } = await this.context.supabase.rpc('get_spending_anomalies', {
          user_filter: this.context.user.id,
          start_date: this.context.params.filters?.dateRange?.start || null,
          end_date: this.context.params.filters?.dateRange?.end || null,
          currency_filter: 'MYR'
        });
        if (!error) analysisResults = data || [];
      }
      else if (query.includes('time') || query.includes('when') || query.includes('pattern')) {
        analysisType = 'time_patterns';
        const { data, error } = await this.context.supabase.rpc('get_time_based_patterns', {
          user_filter: this.context.user.id,
          start_date: this.context.params.filters?.dateRange?.start || null,
          end_date: this.context.params.filters?.dateRange?.end || null,
          currency_filter: 'MYR'
        });
        if (!error) analysisResults = data || [];
      }

      // Convert analysis results to UnifiedSearchResult format
      const unifiedResults = this.convertAnalysisToUnifiedResults(analysisResults, analysisType);

      console.log(`✅ Financial Analysis completed in ${Date.now() - stageStart}ms - Generated ${unifiedResults.length} insights`);

      return {
        success: true,
        data: unifiedResults,
        processingTime: Date.now() - stageStart,
        metadata: {
          analysisType,
          resultsCount: analysisResults.length,
          financialAnalysis: true
        }
      };

    } catch (error) {
      console.error('❌ Financial Analysis failed:', error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - stageStart
      };
    }
  }

  /**
   * Execute enhanced line item search using the improved performLineItemSearch function
   */
  private async executeEnhancedLineItemSearch(queryEmbedding: number[]): Promise<PipelineStageResult<UnifiedSearchResult[]>> {
    const stageStart = Date.now();
    console.log('🍜 Executing Enhanced Line Item Search');

    try {
      // Prepare parameters for line item search
      const searchParams = {
        limit: this.context.params.limit || 20,
        offset: this.context.params.offset || 0,
        startDate: this.context.params.filters?.startDate,
        endDate: this.context.params.filters?.endDate,
        minAmount: this.context.params.filters?.minAmount,
        maxAmount: this.context.params.filters?.maxAmount,
        query: this.context.originalQuery,
        useHybridSearch: true // Enable hybrid search by default
      };

      console.log('🔍 Line item search parameters:', searchParams);

      // Call our enhanced line item search function
      const lineItemResults = await performLineItemSearch(
        this.context.supabase,
        queryEmbedding,
        searchParams
      );

      console.log(`✅ Enhanced line item search found ${lineItemResults.lineItems.length} results`);
      this.context.metadata.sourcesSearched.push('enhanced_line_item_search');

      // Transform line item results to unified format
      const rawResults: UnifiedSearchResult[] = lineItemResults.lineItems.map((item: any) => ({
        id: `line-item-${item.line_item_id}`,
        sourceType: 'line_item', // 🔧 FIX: Set correct sourceType for line items
        sourceId: item.line_item_id, // 🔧 FIX: Use line_item_id as sourceId for line items
        contentType: 'line_item',
        title: `${item.description} - ${item.merchant}`,
        content: item.description,
        similarity: item.similarity || 0.8,
        metadata: {
          merchant: item.merchant,
          amount: item.amount, // 🔧 FIX: Use line item amount, not receipt total
          line_item_price: item.amount, // Keep for compatibility
          currency: item.currency || 'MYR',
          date: item.date,
          parent_receipt_date: item.date,
          parent_receipt_merchant: item.merchant,
          line_item_id: item.line_item_id,
          receipt_id: item.receipt_id, // Keep receipt reference
          description: item.description,
          match_type: item.matchType || 'hybrid'
        },
        createdAt: item.date
      }));

      // For line item searches, we want to show individual line items, not deduplicated receipts
      // Each line item should be displayed separately (e.g., multiple "IKAN LONGGOK" entries)
      const transformedResults = rawResults;

      console.log(`🔧 Line item results: ${rawResults.length} individual line items found`);

      return {
        success: true,
        data: transformedResults,
        processingTime: Date.now() - stageStart,
        metadata: {
          searchMethod: 'enhanced_line_item_search',
          resultsCount: transformedResults.length,
          exactMatches: lineItemResults.metadata?.exactMatches || 0,
          semanticMatches: lineItemResults.metadata?.semanticMatches || 0,
          searchStrategy: lineItemResults.metadata?.searchStrategy || 'hybrid'
        }
      };

    } catch (error) {
      console.error('❌ Enhanced Line Item Search failed:', error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - stageStart
      };
    }
  }

  /**
   * Transform database search results to unified format with deduplication
   */
  private async transformSearchResults(searchResults: any[]): Promise<UnifiedSearchResult[]> {
    const transformedResults: UnifiedSearchResult[] = [];

    // Group results by source_id to handle deduplication
    const resultsBySourceId = new Map<string, any[]>();

    for (const result of searchResults) {
      const sourceKey = `${result.source_type}-${result.source_id}`;
      if (!resultsBySourceId.has(sourceKey)) {
        resultsBySourceId.set(sourceKey, []);
      }
      resultsBySourceId.get(sourceKey)!.push(result);
    }

    console.log(`🔍 Deduplication: ${searchResults.length} raw results grouped into ${resultsBySourceId.size} unique sources`);

    // Process each unique source, keeping the best result
    for (const [sourceKey, sourceResults] of resultsBySourceId) {
      try {
        // Sort by similarity/combined_score to get the best match
        const bestResult = sourceResults.sort((a, b) => {
          const scoreA = a.combined_score || a.similarity || 0;
          const scoreB = b.combined_score || b.similarity || 0;
          return scoreB - scoreA;
        })[0];

        const transformed = await this.transformSingleResult(bestResult);
        if (transformed) {
          transformedResults.push(transformed);
        }
      } catch (error) {
        console.warn(`Error transforming result for ${sourceKey}:`, error);
        // Continue with other results
      }
    }

    console.log(`✅ Deduplication complete: ${transformedResults.length} unique results after transformation`);
    return transformedResults;
  }

  /**
   * Transform a single search result based on its source type
   */
  private async transformSingleResult(result: any): Promise<UnifiedSearchResult | null> {
    const baseResult = {
      id: result.id,
      sourceType: result.source_type,
      sourceId: result.source_id,
      contentType: result.content_type,
      similarity: typeof result.similarity === 'number' && !isNaN(result.similarity)
        ? result.similarity
        : (typeof result.combined_score === 'number' && !isNaN(result.combined_score) ? result.combined_score : 0),
      createdAt: result.created_at
    };

    // Get source-specific data based on source type
    switch (result.source_type) {
      case 'receipt':
        return await this.transformReceiptResult(baseResult, result);
      case 'claim':
        return await this.transformClaimResult(baseResult, result);
      case 'team_member':
        return await this.transformTeamMemberResult(baseResult, result);
      case 'custom_category':
        return await this.transformCustomCategoryResult(baseResult, result);
      case 'business_directory':
        return await this.transformBusinessDirectoryResult(baseResult, result);
      default:
        console.warn('Unknown source type:', result.source_type);
        return null;
    }
  }

  // Transform methods for different source types (simplified for space)
  private async transformReceiptResult(baseResult: any, result: any): Promise<UnifiedSearchResult> {
    const { data: receipt, error } = await this.context.supabase
      .from('receipts')
      .select('merchant, total, currency, date, status, predicted_category')
      .eq('id', result.source_id)
      .single();

    if (error) {
      console.error(`Error fetching receipt ${result.source_id}:`, error);
      throw error;
    }

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

  private async transformClaimResult(baseResult: any, result: any): Promise<UnifiedSearchResult> {
    const { data: claim } = await this.context.supabase
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

  private async transformTeamMemberResult(baseResult: any, result: any): Promise<UnifiedSearchResult> {
    const { data: teamMember } = await this.context.supabase
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

  private async transformCustomCategoryResult(baseResult: any, result: any): Promise<UnifiedSearchResult> {
    const { data: category } = await this.context.supabase
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

  private async transformBusinessDirectoryResult(baseResult: any, result: any): Promise<UnifiedSearchResult> {
    const { data: business } = await this.context.supabase
      .from('malaysian_business_directory')
      .select('business_name, business_name_malay, business_type, state, city, address_line1, address_line2, postcode, is_active')
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
        address_line1: business?.address_line1,
        address_line2: business?.address_line2,
        postcode: business?.postcode,
        full_address: [business?.address_line1, business?.address_line2, business?.city, business?.state, business?.postcode].filter(Boolean).join(', '),
        is_active: business?.is_active
      },
      accessLevel: 'public'
    };
  }

  /**
   * Helper method to get effective limit for temporal queries
   * Uses dynamic limit when available, falls back to original limit
   */
  private getEffectiveLimit(): number {
    // Check if we have dynamic limit information from temporal search
    const dynamicLimit = this.context.metadata?.totalReceiptsInRange ||
                        this.context.metadata?.receiptIdsInRange;

    if (dynamicLimit && dynamicLimit > (this.context.params.limit || 20)) {
      const effectiveLimit = Math.max(dynamicLimit + 10, this.context.params.limit || 20);
      console.log('🔍 DEBUG: Using dynamic limit for re-ranking:', {
        originalLimit: this.context.params.limit || 20,
        dynamicLimit,
        effectiveLimit,
        reason: 'temporal_query_with_more_results_available'
      });
      return effectiveLimit;
    }

    return this.context.params.limit || 20;
  }

  /**
   * Stage 4: Result Re-ranking
   * Uses advanced LLM to re-order results based on contextual relevance
   */
  private async stage4_ResultReRanking(searchResults: UnifiedSearchResult[]): Promise<PipelineStageResult<UnifiedSearchResult[]>> {
    const stageStart = Date.now();
    console.log('🎯 Stage 4: Result Re-ranking');

    try {
      // Check if we're approaching timeout - skip re-ranking if so
      const timeElapsed = Date.now() - this.context.startTime;
      const MAX_PIPELINE_TIME = 75000; // 75 seconds max
      if (timeElapsed > MAX_PIPELINE_TIME * 0.7) { // If 70% of time already used
        console.warn('⚠️ Stage 4: Approaching timeout, skipping re-ranking for performance');

        // CRITICAL FIX: Use dynamic limit for temporal queries instead of original limit
        const effectiveLimit = this.getEffectiveLimit();
        const fastResults = searchResults.slice(0, effectiveLimit);

        this.context.metadata.reRanking = {
          applied: false,
          modelUsed: 'timeout-skip',
          processingTime: 0,
          candidatesCount: searchResults.length,
          confidenceLevel: 'medium'
        };

        return {
          success: true,
          data: fastResults,
          processingTime: Date.now() - stageStart
        };
      }

      // Skip re-ranking for simple single-word queries to improve performance
      const isSimpleQuery = this.context.originalQuery.trim().split(/\s+/).length === 1 &&
                           this.context.originalQuery.length < 20;

      if (isSimpleQuery && searchResults.length <= 10) {
        console.log('⚡ Skipping re-ranking for simple query to improve performance');

        // CRITICAL FIX: Use dynamic limit for temporal queries
        const effectiveLimit = this.getEffectiveLimit();
        const fastResults = searchResults.slice(0, effectiveLimit);

        this.context.metadata.reRanking = {
          applied: false,
          modelUsed: 'simple-query-skip',
          processingTime: 0,
          candidatesCount: searchResults.length,
          confidenceLevel: 'medium'
        };

        return {
          success: true,
          data: fastResults,
          processingTime: Date.now() - stageStart
        };
      }

      if (searchResults.length <= 1) {
        console.log('⚠️ Skipping re-ranking - insufficient candidates');
        // CRITICAL FIX: Use dynamic limit for temporal queries
        const effectiveLimit = this.getEffectiveLimit();
        console.log('🔍 DEBUG: Stage 4 re-ranking bypass:', {
          searchResultsLength: searchResults.length,
          originalLimit: this.context.params.limit,
          effectiveLimit,
          sliceResult: searchResults.slice(0, effectiveLimit).length
        });

        this.context.metadata.reRanking = {
          applied: false,
          modelUsed: 'none',
          processingTime: 0,
          candidatesCount: searchResults.length,
          confidenceLevel: 'low'
        };

        // CRITICAL FIX: Use dynamic limit for temporal queries
        const effectiveLimit2 = this.getEffectiveLimit();
        const finalResults = searchResults.slice(0, effectiveLimit2);
        console.log('🔍 DEBUG: Stage 4 returning results:', {
          originalCount: searchResults.length,
          finalCount: finalResults.length,
          sampleResult: finalResults[0]?.id || 'none'
        });

        return {
          success: true,
          data: finalResults,
          processingTime: Date.now() - stageStart
        };
      }

      // Prepare candidates for re-ranking
      const reRankingCandidates: ReRankingCandidate[] = searchResults.map((result, index) => ({
        result,
        originalRank: index + 1
      }));

      let reRankingResult;
      try {
        // Add timeout protection for re-ranking
        const RERANKING_TIMEOUT = 15000; // 15 seconds max for re-ranking
        // CRITICAL FIX: Use dynamic limit for temporal queries in re-ranking
        const maxResults = this.getEffectiveLimit();
        console.log('🔍 DEBUG: Re-ranking with dynamic limit:', {
          originalLimit: this.context.params.limit,
          maxResults,
          candidatesCount: reRankingCandidates.length
        });

        const reRankingPromise = reRankSearchResults({
          originalQuery: this.context.originalQuery,
          candidates: reRankingCandidates,
          maxResults
        });

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Re-ranking timeout')), RERANKING_TIMEOUT);
        });

        reRankingResult = await Promise.race([reRankingPromise, timeoutPromise]);

        // Validate that reRankingResult has the expected structure
        if (!reRankingResult || !reRankingResult.reRankingMetadata) {
          throw new Error('Invalid reRankingResult structure: missing reRankingMetadata');
        }

      } catch (reRankError) {
        console.error('❌ Re-ranking failed, creating fallback result:', reRankError);

        // Create a fallback result with proper structure
        const fallbackLimit = this.getEffectiveLimit();
        reRankingResult = {
          rerankedResults: searchResults.slice(0, fallbackLimit),
          reRankingMetadata: {
            modelUsed: 'fallback-error',
            processingTime: 0,
            candidatesCount: searchResults.length,
            reRankingScore: 0.3,
            confidenceLevel: 'low' as const
          }
        };
      }

      // Store re-ranking metadata (now guaranteed to exist)
      this.context.metadata.reRanking = {
        applied: true,
        modelUsed: reRankingResult.reRankingMetadata.modelUsed,
        processingTime: reRankingResult.reRankingMetadata.processingTime,
        candidatesCount: reRankingResult.reRankingMetadata.candidatesCount,
        confidenceLevel: reRankingResult.reRankingMetadata.confidenceLevel
      };

      // Additional validation for reranked results
      const finalResults = reRankingResult.rerankedResults || [];
      const resultCount = finalResults.length;

      console.log(`✅ Stage 4 completed in ${Date.now() - stageStart}ms - Re-ranked ${resultCount} results`);

      return {
        success: true,
        data: finalResults,
        processingTime: Date.now() - stageStart,
        metadata: {
          reRankingConfidence: reRankingResult.reRankingMetadata.confidenceLevel,
          originalCandidates: searchResults.length,
          finalResults: resultCount
        }
      };

    } catch (error) {
      console.error('❌ Stage 4 failed, using original results:', error);

      // Fallback to original results
      this.context.metadata.reRanking = {
        applied: false,
        modelUsed: 'fallback',
        processingTime: Date.now() - stageStart,
        candidatesCount: searchResults.length,
        confidenceLevel: 'low'
      };

      return {
        success: true,
        data: searchResults.slice(0, this.context.params.limit),
        processingTime: Date.now() - stageStart
      };
    }
  }

  /**
   * Stage 5: Context Compilation
   * Applies additional filtering, pagination, and result enhancement
   */
  private async stage5_ContextCompilation(reRankedResults: UnifiedSearchResult[]): Promise<PipelineStageResult<UnifiedSearchResult[]>> {
    const stageStart = Date.now();
    console.log('📋 Stage 5: Context Compilation');

    try {
      // Apply additional filters if specified
      let filteredResults = this.applyAdditionalFilters(reRankedResults);

      // Check if temporal filtering resulted in zero results and trigger fallback
      const isTemporalQuery = this.context.params.temporalRouting?.isTemporalQuery;
      const hasDateFilter = this.context.params.filters?.startDate && this.context.params.filters?.endDate;

      if (isTemporalQuery && hasDateFilter && filteredResults.length === 0 && reRankedResults.length > 0) {
        console.log('🔄 Temporal query resulted in 0 results after date filtering, triggering fallback...');

        const originalDateRange = {
          start: this.context.params.filters.startDate!,
          end: this.context.params.filters.endDate!
        };

        const fallbackResult = await this.executeFallbackTemporalSearch(originalDateRange, stageStart);
        if (fallbackResult.success && fallbackResult.data && fallbackResult.data.length > 0) {
          console.log(`✅ Temporal fallback found ${fallbackResult.data.length} results in Stage 5`);

          // Mark this as a fallback result for response generation
          this.context.metadata.isFallbackResult = true;
          this.context.metadata.fallbackStrategy = fallbackResult.metadata?.fallbackStrategy;
          this.context.metadata.originalDateRange = originalDateRange;
          this.context.metadata.expandedDateRange = fallbackResult.metadata?.expandedDateRange;

          // Use fallback results instead of empty filtered results
          filteredResults = fallbackResult.data;
        }
      }

      // Apply final result enhancements
      const enhancedResults = await this.enhanceResults(filteredResults);

      console.log(`✅ Stage 5 completed in ${Date.now() - stageStart}ms - Compiled ${enhancedResults.length} results`);

      return {
        success: true,
        data: enhancedResults,
        processingTime: Date.now() - stageStart,
        metadata: {
          filtersApplied: Object.keys(this.context.params.filters || {}).length,
          finalResultCount: enhancedResults.length
        }
      };

    } catch (error) {
      console.error('❌ Stage 5 failed:', error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - stageStart
      };
    }
  }

  /**
   * Stage 6: Final Response Generation with UI Components
   * Formats the final response with metadata, pagination, and generates UI components
   */
  private async stage6_ResponseGeneration(compiledResults: UnifiedSearchResult[]): Promise<PipelineStageResult<{results: UnifiedSearchResult[], totalResults: number}>> {
    const stageStart = Date.now();
    console.log('📤 Stage 6: Response Generation with UI Components');

    try {
      // Final result preparation
      const finalResults = compiledResults;
      const totalResults = finalResults.length;

      // Generate UI components based on results and query intent
      await this.generateUIComponents(finalResults);

      // Update model used in metadata
      this.context.metadata.modelUsed = this.context.metadata.reRanking?.applied
        ? 'gemini-embedding-001-with-reranking'
        : 'gemini-embedding-001';

      console.log(`✅ Stage 6 completed in ${Date.now() - stageStart}ms - Generated response with ${totalResults} results and UI components`);

      return {
        success: true,
        data: { results: finalResults, totalResults },
        processingTime: Date.now() - stageStart,
        metadata: {
          totalResults,
          pipelineComplete: true,
          uiComponentsGenerated: true
        }
      };

    } catch (error) {
      console.error('❌ Stage 6 failed:', error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - stageStart
      };
    }
  }

  /**
   * Apply additional filters to search results
   */
  private applyAdditionalFilters(results: UnifiedSearchResult[]): UnifiedSearchResult[] {
    let filteredResults = results;

    // Apply date range filter - FIXED: Use startDate/endDate from temporal parsing instead of dateRange
    const startDate = this.context.params.filters?.startDate;
    const endDate = this.context.params.filters?.endDate;

    if (startDate && endDate) {
      console.log('🔍 DEBUG: Applying date range filter (FIXED):', {
        startDate,
        endDate,
        resultsCount: filteredResults.length,
        note: 'Using startDate/endDate from temporal parsing instead of dateRange object'
      });

      filteredResults = filteredResults.filter(result => {
        // For receipts, use the actual receipt date from metadata, not the upload timestamp
        const receiptDate = result.metadata?.date || result.createdAt;
        const resultDate = new Date(receiptDate);
        const filterStartDate = new Date(startDate);
        const filterEndDate = new Date(endDate);

        const isInRange = resultDate >= filterStartDate && resultDate <= filterEndDate;

        console.log('🔍 DEBUG: Date filter check (FIXED):', {
          resultId: result.id,
          receiptDate,
          resultDate: resultDate.toISOString().split('T')[0],
          startDate: filterStartDate.toISOString().split('T')[0],
          endDate: filterEndDate.toISOString().split('T')[0],
          isInRange
        });

        return isInRange;
      });

      console.log('🔍 DEBUG: After date filtering (FIXED):', {
        originalCount: results.length,
        filteredCount: filteredResults.length
      });

      // SMART SUGGESTIONS: Generate intelligent suggestions for zero results
      if (filteredResults.length === 0 && results.length > 0) {
        console.log('🔍 DEBUG: No results found in date range, generating smart suggestions...');

        const dateAnalysis = analyzeAvailableDates(
          results,
          { start: startDate, end: endDate },
          this.context.originalQuery
        );

        const followUpSuggestions = convertToFollowUpSuggestions(dateAnalysis.suggestions);
        const enhancedMessage = generateZeroResultsMessage(
          this.context.originalQuery,
          { start: startDate, end: endDate },
          dateAnalysis
        );

        console.log('🔍 DEBUG: Smart suggestions generated:', {
          totalSuggestions: dateAnalysis.suggestions.length,
          followUpSuggestions,
          enhancedMessage,
          availableDateRange: dateAnalysis.dateRange
        });

        // Store suggestions in context for later use
        this.context.smartSuggestions = {
          dateAnalysis,
          followUpSuggestions,
          enhancedMessage
        };
      }
    } else if (this.context.params.filters?.dateRange) {
      // LEGACY: Fallback to dateRange object if startDate/endDate not available
      const { start, end } = this.context.params.filters.dateRange;
      console.log('🔍 DEBUG: Using legacy dateRange filter:', { start, end, resultsCount: filteredResults.length });

      filteredResults = filteredResults.filter(result => {
        // For receipts, use the actual receipt date from metadata, not the upload timestamp
        const receiptDate = result.metadata?.date || result.createdAt;
        const resultDate = new Date(receiptDate);
        const filterStartDate = new Date(start);
        const filterEndDate = new Date(end);

        const isInRange = resultDate >= filterStartDate && resultDate <= filterEndDate;

        console.log('🔍 DEBUG: Legacy date filter check:', {
          resultId: result.id,
          receiptDate,
          resultDate: resultDate.toISOString().split('T')[0],
          startDate: filterStartDate.toISOString().split('T')[0],
          endDate: filterEndDate.toISOString().split('T')[0],
          isInRange
        });

        return isInRange;
      });

      console.log('🔍 DEBUG: After legacy date filtering:', {
        originalCount: results.length,
        filteredCount: filteredResults.length
      });

      // SMART SUGGESTIONS: Generate intelligent suggestions for zero results (legacy path)
      if (filteredResults.length === 0 && results.length > 0) {
        console.log('🔍 DEBUG: No results found in date range (legacy), generating smart suggestions...');

        const dateAnalysis = analyzeAvailableDates(
          results,
          { start, end },
          this.context.originalQuery
        );

        const followUpSuggestions = convertToFollowUpSuggestions(dateAnalysis.suggestions);
        const enhancedMessage = generateZeroResultsMessage(
          this.context.originalQuery,
          { start, end },
          dateAnalysis
        );

        console.log('🔍 DEBUG: Smart suggestions generated (legacy):', {
          totalSuggestions: dateAnalysis.suggestions.length,
          followUpSuggestions,
          enhancedMessage,
          availableDateRange: dateAnalysis.dateRange
        });

        // Store suggestions in context for later use
        this.context.smartSuggestions = {
          dateAnalysis,
          followUpSuggestions,
          enhancedMessage
        };
      }
    }

    // Apply amount range filter (for receipts and claims)
    if (this.context.params.filters?.amountRange) {
      const { min, max } = this.context.params.filters.amountRange;
      console.log('💰 DEBUG: Applying RAG pipeline amount filtering:', { min, max });

      filteredResults = filteredResults.filter(result => {
        const amount = result.metadata?.total || result.metadata?.amount;
        console.log('💰 DEBUG: Checking result amount:', {
          amount,
          type: typeof amount,
          isNumber: typeof amount === 'number',
          asNumber: Number(amount),
          min,
          max
        });

        if (typeof amount === 'number') {
          // CRITICAL FIX: Use strict inequalities for proper "less than" and "over" semantics
          const passesMin = min === undefined || min === null || amount > min;  // "over X" means > X
          const passesMax = max === undefined || max === null || amount < max;  // "less than X" means < X
          const passes = passesMin && passesMax;
          console.log('💰 DEBUG: Amount filter result (strict inequalities):', { amount, min, max, passesMin, passesMax, passes });
          return passes;
        } else if (typeof amount === 'string' && !isNaN(Number(amount))) {
          // Handle string amounts by converting to number
          const numericAmount = Number(amount);
          // CRITICAL FIX: Use strict inequalities for proper "less than" and "over" semantics
          const passesMin = min === undefined || min === null || numericAmount > min;  // "over X" means > X
          const passesMax = max === undefined || max === null || numericAmount < max;  // "less than X" means < X
          const passes = passesMin && passesMax;
          console.log('💰 DEBUG: String amount converted and filtered (strict inequalities):', { amount, numericAmount, min, max, passesMin, passesMax, passes });
          return passes;
        }
        console.log('💰 DEBUG: Keeping result without valid amount data:', { amount });
        return true; // Keep results without amount data
      });

      console.log('💰 DEBUG: RAG pipeline filtering complete:', {
        originalCount: filteredResults.length,
        filteredCount: filteredResults.length
      });
    }

    // Apply status filter
    if (this.context.params.filters?.status && this.context.params.filters.status.length > 0) {
      filteredResults = filteredResults.filter(result => {
        const status = result.metadata?.status;
        return !status || this.context.params.filters!.status!.includes(status);
      });
    }

    return filteredResults;
  }

  /**
   * Enhance results with additional context and formatting
   */
  private async enhanceResults(results: UnifiedSearchResult[]): Promise<UnifiedSearchResult[]> {
    // Add any additional enhancements like relevance scores, formatting, etc.
    return results.map(result => ({
      ...result,
      // Add enhanced metadata or formatting here if needed
    }));
  }

  /**
   * Convert financial analysis results to UnifiedSearchResult format
   */
  private convertAnalysisToUnifiedResults(analysisResults: any[], analysisType: string): UnifiedSearchResult[] {
    return analysisResults.map((result, index) => {
      let title = '';
      let description = '';
      let metadata = { ...result, analysisType };

      switch (analysisType) {
        case 'category_analysis':
          title = `${result.category} - ${result.total_amount} MYR`;
          description = `${result.transaction_count} transactions, avg ${result.average_amount} MYR (${result.percentage_of_total}% of total)`;
          break;
        case 'monthly_trends':
          title = `${result.month_name} ${result.year} - ${result.total_amount} MYR`;
          description = `${result.transaction_count} transactions, top category: ${result.top_category}, top merchant: ${result.top_merchant}`;
          break;
        case 'merchant_analysis':
          title = `${result.merchant} - ${result.total_amount} MYR`;
          description = `${result.transaction_count} visits, avg ${result.average_amount} MYR, frequency: ${result.frequency_score}/month`;
          break;
        case 'anomaly_analysis':
          title = `${result.merchant} - ${result.amount} MYR (${result.anomaly_type})`;
          description = `${result.description} on ${result.date}`;
          break;
        case 'time_patterns':
          title = `${result.period_value} - ${result.total_amount} MYR`;
          description = `${result.transaction_count} transactions, avg ${result.average_amount} MYR, top: ${result.top_category}`;
          break;
        default:
          title = `Analysis Result ${index + 1}`;
          description = JSON.stringify(result);
      }

      return {
        id: `analysis-${analysisType}-${index}`,
        sourceType: 'financial_analysis' as any,
        sourceId: `${analysisType}-${index}`,
        contentType: 'analysis' as any,
        title,
        description,
        similarity: 1.0 - (index * 0.01), // Decrease similarity slightly for each result
        metadata,
        accessLevel: 'user' as any,
        createdAt: new Date().toISOString()
      };
    });
  }

  /**
   * Generate UI Components based on search results and query intent
   */
  private async generateUIComponents(results: UnifiedSearchResult[]): Promise<void> {
    try {
      console.log('🎨 Generating UI components for results...');

      const intent = this.context.metadata.llmPreprocessing?.intent || 'general_search';
      const queryType = this.context.metadata.llmPreprocessing?.queryType || 'conversational';

      // Store UI components in metadata for later use
      this.context.metadata.uiComponents = [];

      // Generate components based on intent and results
      if (intent === 'financial_analysis' && results.length > 0) {
        await this.generateFinancialAnalysisComponents(results);
      } else if (intent === 'document_retrieval' && results.some(r => r.sourceType === 'receipt')) {
        await this.generateReceiptComponents(results);
      } else if (results.length === 0) {
        await this.generateEmptyStateComponents();
      }

      // Always add helpful action buttons
      await this.generateActionButtons(intent, results);

      console.log(`✅ Generated ${this.context.metadata.uiComponents.length} UI components`);

    } catch (error) {
      console.error('❌ UI component generation failed:', error);
      // Don't fail the entire pipeline if UI component generation fails
    }
  }

  /**
   * Generate financial analysis UI components
   */
  private async generateFinancialAnalysisComponents(results: UnifiedSearchResult[]): Promise<void> {
    console.log('📊 Generating financial analysis components for', results.length, 'results');

    // Filter line item results for financial analysis
    const lineItemResults = results.filter(r => r.sourceType === 'line_item' || r.sourceType === 'lineItem');

    if (lineItemResults.length > 0) {
      console.log(`🍽️ Processing ${lineItemResults.length} line item results for financial analysis`);

      // Generate line item cards for financial analysis
      lineItemResults.forEach(result => {
        this.context.metadata.uiComponents.push({
          type: 'ui_component' as const,
          component: 'line_item_card',
          data: {
            line_item_id: result.sourceId,
            receipt_id: result.metadata?.receipt_id || result.metadata?.parent_receipt_id,
            description: result.metadata?.description || result.title || 'Unknown Item',
            amount: result.metadata?.amount || result.metadata?.line_item_price || 0,
            currency: result.metadata?.currency || 'MYR',
            merchant: result.metadata?.merchant || result.metadata?.parent_receipt_merchant || 'Unknown Merchant',
            date: result.metadata?.date || result.metadata?.parent_receipt_date || result.createdAt,
            confidence: result.similarity || 0.8,
            quantity: result.metadata?.quantity || 1
          },
          metadata: {
            title: 'Line Item Card',
            interactive: true,
            actions: ['view_receipt', 'view_item_details']
          }
        });
      });

      console.log(`🎯 Generated ${lineItemResults.length} line item cards for financial analysis`);
    }

    // Add financial summary if we have results
    if (results.length > 0) {
      const totalAmount = results.reduce((sum, r) => sum + (r.metadata?.amount || r.metadata?.total || 0), 0);

      this.context.metadata.uiComponents.push({
        type: 'ui_component' as const,
        component: 'summary_card',
        data: {
          title: 'Total Amount',
          value: totalAmount,
          currency: 'MYR',
          icon: 'dollar-sign',
          color: 'primary'
        },
        metadata: {
          title: 'Financial Summary',
          interactive: true
        }
      });

      console.log(`💰 Added financial summary card with total: MYR ${totalAmount}`);
    }
  }

  /**
   * Generate receipt card components
   */
  private async generateReceiptComponents(results: UnifiedSearchResult[]): Promise<void> {
    const receiptResults = results.filter(r => r.sourceType === 'receipt'); // Show all receipt results

    for (const result of receiptResults) {
      const receiptComponent = {
        type: 'ui_component',
        component: 'receipt_card',
        data: {
          receipt_id: result.sourceId,
          merchant: result.metadata.merchant || result.title,
          total: result.metadata.total || result.metadata.amount || 0,
          currency: result.metadata.currency || 'MYR',
          date: result.metadata.date || result.createdAt,
          category: result.metadata.category,
          confidence: result.similarity,
          line_items_count: result.metadata.line_items_count,
        },
        metadata: {
          title: 'Receipt Summary',
          interactive: true,
          actions: ['view_receipt', 'edit_receipt', 'categorize_receipt']
        }
      };

      this.context.metadata.uiComponents.push(receiptComponent);
    }
  }

  /**
   * Generate empty state components
   */
  private async generateEmptyStateComponents(): Promise<void> {
    const uploadButton = {
      type: 'ui_component',
      component: 'action_button',
      data: {
        action: 'upload_receipt',
        label: 'Upload Your First Receipt',
        variant: 'primary',
        icon: 'upload'
      },
      metadata: {
        title: 'Get Started',
        interactive: true
      }
    };

    this.context.metadata.uiComponents.push(uploadButton);
  }

  /**
   * Generate helpful action buttons
   */
  private async generateActionButtons(intent: string, results: UnifiedSearchResult[]): Promise<void> {
    if (intent === 'financial_analysis') {
      const analyticsButton = {
        type: 'ui_component',
        component: 'action_button',
        data: {
          action: 'view_analytics',
          label: 'View Full Analytics',
          variant: 'secondary',
          icon: 'chart'
        },
        metadata: {
          title: 'Analytics',
          interactive: true
        }
      };

      this.context.metadata.uiComponents.push(analyticsButton);
    }
  }

  /**
   * Detect if query is specifically looking for line items/food items
   * Enhanced with intelligent product name detection
   * 🔧 FIX: Added monetary query detection to prevent misclassification
   */
  private isLineItemQuery(query: string): boolean {
    const queryLower = query.toLowerCase().trim();

    // 🔧 FIX: First check if this is a monetary query - if so, it's NOT a line item query
    if (this.isMonetaryQuery(queryLower)) {
      console.log('🔍 DEBUG: isLineItemQuery - MONETARY QUERY DETECTED, returning false:', queryLower);
      return false;
    }
    const lineItemIndicators = [
      // Food items
      'yee mee', 'mee', 'nasi', 'roti', 'teh', 'kopi', 'ayam', 'ikan', 'daging',
      'sayur', 'buah', 'noodles', 'rice', 'chicken', 'fish', 'beef', 'vegetables',
      'fruit', 'bread', 'cake', 'pizza', 'burger', 'sandwich', 'salad', 'soup',
      // Line item specific terms
      'item', 'items', 'line item', 'line items', 'product', 'products',
      'bought', 'purchased', 'ordered', 'ate', 'food', 'drink', 'beverage',
      // Malaysian food terms
      'laksa', 'rendang', 'satay', 'char kway teow', 'hokkien mee', 'wan tan mee',
      'bak kut teh', 'cendol', 'ais kacang', 'rojak', 'popiah', 'dim sum',
      // Common grocery items
      'minced', 'oil', 'egg', 'eggs', 'telur', 'minyak', 'garam', 'salt', 'sugar',
      'gula', 'beras', 'flour', 'tepung', 'susu', 'milk', 'cheese', 'butter',
      // Common product brands and items (for accuracy fix)
      'powercat', 'coca cola', 'pepsi', 'sprite', 'fanta', 'nestle', 'maggi',
      'milo', 'horlicks', 'ovaltine', 'kit kat', 'snickers', 'twix', 'oreo'
    ];

    console.log('🔍 DEBUG: isLineItemQuery - checking query:', queryLower);

    // Step 1: Check for known indicators
    const knownIndicatorMatch = lineItemIndicators.some(indicator => {
      const match = queryLower.includes(indicator.toLowerCase());
      if (match) {
        console.log('🔍 DEBUG: isLineItemQuery - FOUND KNOWN INDICATOR:', indicator);
      }
      return match;
    });

    if (knownIndicatorMatch) {
      console.log('🔍 DEBUG: isLineItemQuery - result: true (known indicator)');
      return true;
    }

    // Step 2: Enhanced heuristics for potential product names
    const potentialProductMatch = this.isPotentialProductName(queryLower);
    if (potentialProductMatch) {
      console.log('🔍 DEBUG: isLineItemQuery - FOUND POTENTIAL PRODUCT:', queryLower);
      console.log('🔍 DEBUG: isLineItemQuery - result: true (potential product)');
      return true;
    }

    console.log('🔍 DEBUG: isLineItemQuery - result: false (no match)');
    return false;
  }

  /**
   * Enhanced heuristics to detect potential product names
   */
  private isPotentialProductName(query: string): boolean {
    // First check: Explicit temporal phrases that should never be considered products
    const temporalPhrases = [
      'last month', 'this month', 'next month', 'last week', 'this week', 'next week',
      'last year', 'this year', 'next year', 'last quarter', 'this quarter',
      'yesterday', 'today', 'tomorrow', 'recent', 'past month', 'past week',
      'past year', 'current month', 'current week', 'current year'
    ];

    const queryLower = query.toLowerCase().trim();
    if (temporalPhrases.some(phrase => queryLower.includes(phrase))) {
      console.log('🔍 DEBUG: isPotentialProduct - TEMPORAL PHRASE DETECTED, returning false:', queryLower);
      return false;
    }

    // Common stop words that are unlikely to be product names
    const stopWords = [
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
      'after', 'above', 'below', 'between', 'among', 'this', 'that', 'these',
      'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
      'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his',
      'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself',
      'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which',
      'who', 'whom', 'whose', 'this', 'that', 'these', 'those', 'am', 'is',
      'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'having', 'do', 'does', 'did', 'doing', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'shall', 'receipt', 'receipts',
      'transaction', 'transactions', 'purchase', 'purchases', 'expense', 'expenses',
      // Temporal keywords to prevent misclassification
      'last', 'this', 'next', 'previous', 'current', 'recent', 'past', 'future',
      'today', 'yesterday', 'tomorrow', 'week', 'month', 'year', 'day', 'time',
      'ago', 'since', 'until', 'when', 'while', 'now', 'then', 'later', 'earlier'
    ];

    // Clean the query
    const cleanQuery = query.replace(/[^\w\s]/g, '').trim();

    // Heuristic 1: Single word that's not a stop word (like "powercat")
    const words = cleanQuery.split(/\s+/).filter(word => word.length > 0);
    if (words.length === 1) {
      const word = words[0].toLowerCase();
      if (!stopWords.includes(word) && word.length >= 3 && word.length <= 20) {
        console.log('🔍 DEBUG: isPotentialProduct - single word heuristic matched:', word);
        return true;
      }
    }

    // Heuristic 2: Two words that could be a brand + product (like "coca cola")
    if (words.length === 2) {
      const allWordsValid = words.every(word => {
        const w = word.toLowerCase();
        return !stopWords.includes(w) && w.length >= 2 && w.length <= 15;
      });
      if (allWordsValid) {
        console.log('🔍 DEBUG: isPotentialProduct - two word brand heuristic matched:', words.join(' '));
        return true;
      }
    }

    // Heuristic 3: Contains numbers (like "7up", "100plus")
    if (/\d/.test(cleanQuery) && cleanQuery.length <= 20) {
      const hasLetters = /[a-zA-Z]/.test(cleanQuery);
      if (hasLetters) {
        console.log('🔍 DEBUG: isPotentialProduct - alphanumeric product heuristic matched:', cleanQuery);
        return true;
      }
    }

    return false;
  }

  /**
   * 🔧 FIX: Detect if query is a monetary query to prevent misclassification as line item
   */
  private isMonetaryQuery(query: string): boolean {
    const monetaryPatterns = [
      // "over $100", "above RM50", "more than $25", "receipts over 100"
      /\b(over|above|more\s+than|greater\s+than)\s*(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)/i,
      // "under $50", "below RM25", "less than $100"
      /\b(under|below|less\s+than|cheaper\s+than)\s*(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)/i,
      // "$50 to $100", "RM25-RM50", "between $10 and $20"
      /\b(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)\s*(?:to|[-–]|and)\s*(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)/i,
      // "receipts over 100", "expenses above 50" (without currency symbols)
      /\b(receipts?|expenses?|transactions?|purchases?|bills?)\s+(over|above|more\s+than|greater\s+than|under|below|less\s+than)\s+(\d+(?:\.\d{2})?)/i
    ];

    const isMonetary = monetaryPatterns.some(pattern => pattern.test(query));

    if (isMonetary) {
      console.log('💰 DEBUG: isMonetaryQuery - DETECTED monetary query:', query);
    }

    return isMonetary;
  }

  /**
   * Execute simple search for basic queries - much faster than hybrid search
   */
  private async executeSimpleSearch(queryEmbedding: number[]): Promise<PipelineStageResult<UnifiedSearchResult[]>> {
    const stageStart = Date.now();
    console.log('⚡ Executing simple search for basic query');

    try {
      // Use a simple vector similarity search without complex CTEs
      const { data: simpleResults, error } = await this.context.supabase
        .from('unified_embeddings')
        .select('*')
        .eq('source_type', 'receipt')
        .eq('user_id', this.context.user.id)
        .ilike('content_text', `%${this.context.originalQuery}%`)
        .limit(this.context.params.limit || 20);

      if (error) {
        throw new Error(`Simple search failed: ${error.message}`);
      }

      // Convert to UnifiedSearchResult format
      const results: UnifiedSearchResult[] = (simpleResults || []).map(row => ({
        id: row.id,
        sourceId: row.source_id,
        sourceType: row.source_type,
        contentType: row.content_type,
        title: row.metadata?.merchant || 'Unknown',
        content: row.content_text,
        similarity: 0.8, // Default similarity for simple search
        metadata: row.metadata,
        createdAt: row.created_at
      }));

      console.log(`✅ Simple search completed in ${Date.now() - stageStart}ms - Found ${results.length} results`);

      return {
        success: true,
        data: results,
        processingTime: Date.now() - stageStart,
        metadata: { searchMethod: 'simple_search' }
      };

    } catch (error) {
      console.error('❌ Simple search failed:', error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - stageStart
      };
    }
  }

  /**
   * Create error result
   */
  private createErrorResult(message: string, error?: string): RAGPipelineResult {
    this.context.metadata.searchDuration = Date.now() - this.context.startTime;

    // Add temporal routing and filters to metadata even for errors
    this.context.metadata.temporalRouting = this.context.params.temporalRouting;
    this.context.metadata.filters = this.context.params.filters;

    return {
      success: false,
      results: [],
      totalResults: 0,
      searchMetadata: this.context.metadata,
      error: error || message
    };
  }
}
