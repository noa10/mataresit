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
import {
  llmCacheWrapper,
  searchCacheWrapper,
  financialCacheWrapper,
  EdgeCacheKeyGenerator
} from '../_shared/edge-cache.ts';

// Pipeline stage interfaces
export interface RAGPipelineContext {
  originalQuery: string;
  user: any;
  supabase: any;
  params: UnifiedSearchParams;
  startTime: number;
  metadata: SearchMetadata;
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
    console.log('🔍 DEBUG: About to enter try block...');

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

      // Stage 2: Embedding Generation
      const embeddingResult = await this.stage2_EmbeddingGeneration(preprocessingResult.data!);
      if (!embeddingResult.success) {
        return this.createErrorResult('Embedding generation failed', embeddingResult.error);
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
      
      return {
        success: true,
        results: responseResult.data!.results,
        totalResults: responseResult.data!.totalResults,
        searchMetadata: this.context.metadata
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

      // Fetch fresh preprocessing result
      const preprocessingResult = await llmPreprocessQuery(this.context.originalQuery);

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

      // Enhanced temporal query routing
      const temporalRouting = this.context.params.temporalRouting;
      console.log('🔍 DEBUG: Temporal routing check:', {
        hasTemporalRouting: !!temporalRouting,
        isTemporalQuery: temporalRouting?.isTemporalQuery,
        routingStrategy: temporalRouting?.routingStrategy,
        hasSemanticContent: temporalRouting?.hasSemanticContent,
        semanticTerms: temporalRouting?.semanticTerms
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

      // Try enhanced hybrid search first with amount filtering support
      let searchResults, error;
      try {
        // Prepare amount filtering parameters (FIXED: access correct property names)
        const filters = this.context.params.filters || {};
        const amountParams = {
          amount_min: filters.minAmount || null,
          amount_max: filters.maxAmount || null,
          amount_currency: filters.currency || null
        };

        console.log('💰 Amount filtering params:', amountParams);

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

        const fallbackResult = await this.context.supabase.rpc('unified_search', {
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
        });

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
   * Execute temporal search with hybrid routing strategy
   */
  private async executeTemporalSearch(
    queryEmbedding: number[],
    temporalRouting: NonNullable<UnifiedSearchParams['temporalRouting']>
  ): Promise<PipelineStageResult<UnifiedSearchResult[]>> {
    const stageStart = Date.now();
    console.log('⏰ Executing temporal search with strategy:', temporalRouting.routingStrategy);

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
        .limit(this.context.params.limit || 20);

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
      const { data: dateFilteredReceipts, error: dateError } = await this.context.supabase
        .from('receipts')
        .select('id')
        .eq('user_id', this.context.user.id)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end);

      if (dateError) {
        throw new Error(`Date filtering failed: ${dateError.message}`);
      }

      const receiptIds = (dateFilteredReceipts || []).map(r => r.id);
      console.log(`📅 Found ${receiptIds.length} receipts in date range`);
      console.log('🔍 DEBUG: Receipt IDs in date range:', receiptIds);

      if (receiptIds.length === 0) {
        return {
          success: true,
          data: [],
          processingTime: Date.now() - stageStart,
          metadata: {
            searchMethod: 'hybrid_temporal_semantic',
            dateRange,
            receiptIdsInRange: 0,
            semanticResults: 0
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

      const { data: semanticResults, error: semanticError } = await this.context.supabase.rpc('enhanced_hybrid_search', {
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

      // Prepare amount filtering parameters (FIXED: access correct property names)
      const filters = this.context.params.filters || {};
      const amountParams = {
        amount_min: filters.minAmount || null,
        amount_max: filters.maxAmount || null,
        amount_currency: filters.currency || null
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
   * Stage 4: Result Re-ranking
   * Uses advanced LLM to re-order results based on contextual relevance
   */
  private async stage4_ResultReRanking(searchResults: UnifiedSearchResult[]): Promise<PipelineStageResult<UnifiedSearchResult[]>> {
    const stageStart = Date.now();
    console.log('🎯 Stage 4: Result Re-ranking');

    try {
      if (searchResults.length <= 1) {
        console.log('⚠️ Skipping re-ranking - insufficient candidates');
        console.log('🔍 DEBUG: Stage 4 re-ranking bypass:', {
          searchResultsLength: searchResults.length,
          limit: this.context.params.limit,
          sliceResult: searchResults.slice(0, this.context.params.limit || 20).length
        });

        this.context.metadata.reRanking = {
          applied: false,
          modelUsed: 'none',
          processingTime: 0,
          candidatesCount: searchResults.length,
          confidenceLevel: 'low'
        };

        const finalResults = searchResults.slice(0, this.context.params.limit || 20);
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
        reRankingResult = await reRankSearchResults({
          originalQuery: this.context.originalQuery,
          candidates: reRankingCandidates,
          maxResults: this.context.params.limit
        });

        // Validate that reRankingResult has the expected structure
        if (!reRankingResult || !reRankingResult.reRankingMetadata) {
          throw new Error('Invalid reRankingResult structure: missing reRankingMetadata');
        }

      } catch (reRankError) {
        console.error('❌ Re-ranking failed, creating fallback result:', reRankError);

        // Create a fallback result with proper structure
        reRankingResult = {
          rerankedResults: searchResults.slice(0, this.context.params.limit),
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
          // FIXED: Handle min-only and max-only filtering correctly
          const passesMin = min === undefined || min === null || amount >= min;
          const passesMax = max === undefined || max === null || amount <= max;
          const passes = passesMin && passesMax;
          console.log('💰 DEBUG: Amount filter result:', { amount, min, max, passesMin, passesMax, passes });
          return passes;
        } else if (typeof amount === 'string' && !isNaN(Number(amount))) {
          // Handle string amounts by converting to number
          const numericAmount = Number(amount);
          // FIXED: Handle min-only and max-only filtering correctly
          const passesMin = min === undefined || min === null || numericAmount >= min;
          const passesMax = max === undefined || max === null || numericAmount <= max;
          const passes = passesMin && passesMax;
          console.log('💰 DEBUG: String amount converted and filtered:', { amount, numericAmount, min, max, passesMin, passesMax, passes });
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
    // For now, we'll add this as a placeholder
    // In a full implementation, this would generate spending charts, category breakdowns, etc.
    console.log('📊 Would generate financial analysis components');
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
   * Create error result
   */
  private createErrorResult(message: string, error?: string): RAGPipelineResult {
    this.context.metadata.searchDuration = Date.now() - this.context.startTime;

    return {
      success: false,
      results: [],
      totalResults: 0,
      searchMetadata: this.context.metadata,
      error: error || message
    };
  }
}
