/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
/// <reference types="https://deno.land/x/deno/cli/types/v1.39.1/index.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.2.0';
import { ContentExtractor } from './contentExtractors.ts';
import { BatchProcessor } from './batchProcessor.ts';
import { validateAndConvertEmbedding, EMBEDDING_DIMENSIONS } from '../_shared/vector-validation.ts';
import { EmbeddingMetricsCollector, createMetricsCollector, withMetricsCollection } from './metricsCollector.ts';

// Phase 3: Import rate limiting system
import {
  initializeRateLimiting,
  getRateLimitingManager,
  generateEmbeddingWithRateLimit,
  processBatchWithRateLimit,
  getRateLimitingStatus,
  updateProcessingStrategy,
  estimateTokensForContent
} from './rateLimitingUtils.ts';
import { ProcessingStrategy } from './rateLimitingManager.ts';

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma, expires, x-requested-with, user-agent, accept',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Get environment variables
const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!geminiApiKey) {
  throw new Error('GEMINI_API_KEY is not set in environment variables');
}

// Phase 3: Initialize rate limiting system
const defaultStrategy: ProcessingStrategy = (Deno.env.get('RATE_LIMIT_STRATEGY') as ProcessingStrategy) || 'balanced';
const rateLimitingEnabled = Deno.env.get('ENABLE_RATE_LIMITING') !== 'false'; // Default to enabled

if (rateLimitingEnabled && supabaseUrl && supabaseServiceKey) {
  initializeRateLimiting(defaultStrategy, supabaseUrl, supabaseServiceKey);
  console.log(`🚀 Rate limiting initialized with strategy: ${defaultStrategy}`);
} else {
  console.log('⚠️ Rate limiting disabled or missing Supabase configuration');
}

// Create a type for embedding input
interface EmbeddingInput {
  text: string;
  model?: string;
}

// Update the interface for the request body to include useImprovedDimensionHandling
interface BaseEmbeddingRequest {
  model?: string;
  useImprovedDimensionHandling?: boolean; // New flag to indicate using improved dimension handling
  forceRegenerate?: boolean;
}

interface ReceiptEmbeddingRequest extends BaseEmbeddingRequest {
  receiptId: string;
  contentType: string;
  content: string;
  metadata?: Record<string, any>;
}

interface LineItemEmbeddingRequest extends BaseEmbeddingRequest {
  lineItemId: string;
  receiptId: string;
  content: string;
  metadata?: Record<string, any>;
}

interface BatchEmbeddingRequest extends BaseEmbeddingRequest {
  receiptId: string;
  processAllFields?: boolean;
  processLineItems?: boolean;
  contentTypes?: string[];
  lineItemIds?: string[]; // Optional specific line item IDs to process
}

// Phase 4: New interfaces for unified embedding system
interface UnifiedEmbeddingRequest extends BaseEmbeddingRequest {
  mode: 'realtime' | 'batch' | 'maintenance';
  sourceType?: string; // 'receipts', 'claims', 'team_members', 'custom_categories', 'malaysian_business_directory'
  sourceId?: string;
  batchSize?: number;
  priority?: 'high' | 'medium' | 'low';
}

interface QueueProcessingRequest extends BaseEmbeddingRequest {
  mode: 'queue';
  limit?: number;
  priority?: 'high' | 'medium' | 'low';
}

// Default embedding model configuration
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536; // OpenAI's standard dimension

/**
 * Generate embeddings for a text using Google's Gemini embedding model
 * Enhanced with Phase 3 rate limiting and improved error handling
 */
async function generateEmbedding(
  text: string,
  contentType: string = 'default',
  retryCount = 0,
  metricsCollector?: EmbeddingMetricsCollector,
  metricId?: string
): Promise<number[]> {
  // Handle empty or invalid text
  if (!text || typeof text !== 'string' || text.trim() === '') {
    console.warn('Empty or invalid text provided for embedding generation');
    // Return a zero vector instead of failing
    return new Array(EMBEDDING_DIMENSIONS).fill(0);
  }

  // Trim very long text to avoid API limits
  const trimmedText = text.length > 10000 ? text.substring(0, 10000) : text;

  // Phase 3: Use rate limiting if enabled
  const rateLimiter = getRateLimitingManager();

  if (rateLimiter) {
    try {
      const result = await generateEmbeddingWithRateLimit(
        trimmedText,
        contentType,
        async (text: string) => {
          const genAI = new GoogleGenerativeAI(geminiApiKey);
          const model = genAI.getGenerativeModel({ model: 'embedding-001' });

          const apiResult = await model.embedContent(text);
          let embedding = apiResult.embedding.values;

          // Use shared validation utility to prevent corruption
          embedding = validateAndConvertEmbedding(embedding, EMBEDDING_DIMENSIONS);

          return embedding;
        },
        rateLimiter
      );

      // Record metrics if available
      if (metricsCollector && metricId) {
        metricsCollector.recordApiCall(metricId, result.tokensUsed, result.rateLimited);
      }

      return result.embedding;
    } catch (error) {
      console.error('Error with rate-limited embedding generation:', error);

      // Implement retry logic for transient errors
      if (retryCount < 3) {
        console.log(`Retrying embedding generation (attempt ${retryCount + 1})`);
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        return generateEmbedding(text, contentType, retryCount + 1, metricsCollector, metricId);
      }

      throw error;
    }
  }

  // Fallback to original implementation if rate limiting is disabled
  try {
    // Estimate tokens for metrics (rough approximation: 1 token ≈ 4 characters)
    const estimatedTokens = Math.ceil(trimmedText.length / 4);

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'embedding-001' });

    // Record API call start
    const apiCallStart = performance.now();
    const result = await model.embedContent(trimmedText);
    const apiCallEnd = performance.now();

    // Record API metrics
    if (metricsCollector && metricId) {
      metricsCollector.recordApiCall(metricId, estimatedTokens, false);
    }

    let embedding = result.embedding.values;

    // Use shared validation utility to prevent corruption
    embedding = validateAndConvertEmbedding(embedding, EMBEDDING_DIMENSIONS);

    console.log(`API call completed in ${(apiCallEnd - apiCallStart).toFixed(2)}ms, estimated tokens: ${estimatedTokens}`);

    return embedding;
  } catch (error) {
    console.error('Error calling Gemini API:', error);

    // Check if this is a rate limiting error
    const isRateLimit = error.message?.includes('rate limit') ||
                       error.message?.includes('quota') ||
                       error.message?.includes('429');

    // Record rate limiting in metrics
    if (metricsCollector && metricId && isRateLimit) {
      const estimatedTokens = Math.ceil(text.length / 4);
      metricsCollector.recordApiCall(metricId, estimatedTokens, true);
    }

    // Implement retry logic for transient errors
    if (retryCount < 3) {
      console.log(`Retrying embedding generation (attempt ${retryCount + 1})`);
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
      return generateEmbedding(text, contentType, retryCount + 1, metricsCollector, metricId);
    }

    // If we've exhausted retries, throw the error
    throw error;
  }
}

/**
 * Store embeddings in the database using the current table structure
 */
async function storeEmbedding(
  client: any,
  receiptId: string,
  contentType: string,
  embedding: number[],
  metadata: Record<string, any> = {},
  sourceType: string = 'receipt',
  sourceId?: string
) {
  // For line items, store the ID in metadata
  if (sourceType === 'line_item' && sourceId) {
    metadata = {
      ...metadata,
      line_item_id: sourceId
    };
  }

  // Insert directly into receipt_embeddings table
  const { data, error } = await client
    .from('receipt_embeddings')
    .insert({
      receipt_id: receiptId,
      content_type: contentType,
      embedding: embedding,
      metadata: metadata
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Error storing embedding: ${error.message}`);
  }

  return data;
}

/**
 * Process receipt data and generate embeddings
 * Enhanced with metrics collection
 */
async function processReceiptEmbedding(
  request: ReceiptEmbeddingRequest,
  supabaseClient: any,
  metricsCollector?: EmbeddingMetricsCollector,
  metricId?: string
) {
  const { receiptId, contentType, content, metadata = {} } = request;
  // Note: model parameter is not used directly but kept in the interface for future use

  // Validate inputs
  if (!receiptId || !contentType || !content) {
    throw new Error('Missing required parameters: receiptId, contentType, or content');
  }

  console.log(`Generating ${contentType} embedding for receipt ${receiptId}`);

  // Record content processing in metrics
  if (metricsCollector && metricId) {
    const syntheticContent = metadata.is_synthetic || metadata.extraction_method === 'ai_vision_enhanced';
    metricsCollector.recordContentProcessing(metricId, contentType, content.length, syntheticContent);
  }

  // Generate the embedding
  const embedding = await generateEmbedding(content, contentType, 0, metricsCollector, metricId);

  console.log(`Successfully generated embedding with ${embedding.length} dimensions`);

  // Store the embedding in the database
  await storeEmbedding(supabaseClient, receiptId, contentType, embedding, metadata);

  return {
    success: true,
    receiptId,
    contentType,
    dimensions: embedding.length,
    contentText: content, // Add content text for quality analysis
    metadata: metadata // Add metadata for quality analysis
  };
}

/**
 * Process line item data and generate embeddings
 */
async function processLineItemEmbedding(request: LineItemEmbeddingRequest, supabaseClient: any) {
  const { lineItemId, receiptId, content, metadata = {} } = request;
  // Note: model parameter is not used directly but kept in the interface for future use

  // Validate inputs
  if (!lineItemId || !receiptId || !content) {
    throw new Error('Missing required parameters: lineItemId, receiptId, or content');
  }

  console.log(`Generating embedding for line item ${lineItemId} in receipt ${receiptId}`);

  // Generate the embedding
  const embedding = await generateEmbedding(content, 'line_item');

  console.log(`Successfully generated line item embedding with ${embedding.length} dimensions`);

  // Store the embedding using the unified model
  await storeEmbedding(
    supabaseClient,
    receiptId,
    'line_item', // content_type for line items
    embedding,
    metadata,
    'line_item', // source_type
    lineItemId // source_id
  );

  return {
    success: true,
    lineItemId,
    receiptId,
    dimensions: embedding.length
  };
}

/**
 * Generate embeddings for multiple content types from a receipt
 * Enhanced with metrics collection
 */
async function generateReceiptEmbeddings(
  supabaseClient: any,
  receiptId: string,
  model?: string,
  uploadContext: 'single' | 'batch' = 'single'
) {
  // Create metrics collector
  const metricsCollector = createMetricsCollector(supabaseClient);

  // Start metrics collection
  const metricId = await metricsCollector.startMetricsCollection({
    receiptId,
    uploadContext,
    modelUsed: model || 'gemini-embedding-001'
  });

  try {
    // Fetch the receipt data
    const { data: receipt, error } = await supabaseClient
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .single();

    if (error) {
      throw new Error(`Error fetching receipt: ${error.message}`);
    }

    if (!receipt) {
      throw new Error(`Receipt with ID ${receiptId} not found`);
    }

    console.log(`Processing receipt: ${receiptId}, fields available:`, Object.keys(receipt));

  // Import enhanced content extraction and quality metrics
  const { ContentExtractor } = await import('./contentExtractors.ts');
  const {
    generateEmbeddingQualityMetrics,
    logEmbeddingQualityMetrics,
    storeEmbeddingQualityMetrics
  } = await import('../_shared/embedding-quality-metrics.ts');

  // Define the type for embedding results
  type EmbeddingResult = {
    success: boolean;
    receiptId: string;
    contentType: string;
    dimensions: number;
    contentText?: string; // Add content text for quality analysis
    metadata?: any; // Add metadata for quality analysis
  };

  const results: EmbeddingResult[] = [];
  let contentProcessed = false;

  console.log(`🔄 Starting enhanced embedding generation for receipt ${receiptId}`);

  // Use enhanced content extraction to get all content types
  try {
    const extractedContents = await ContentExtractor.extractReceiptContent(receipt);
    console.log(`📋 Extracted ${extractedContents.length} content types for receipt ${receiptId}`);

    // Process each extracted content type
    for (const extractedContent of extractedContents) {
      if (!extractedContent.contentText || extractedContent.contentText.trim().length === 0) {
        console.log(`⚠️ Skipping empty content for type: ${extractedContent.contentType}`);
        continue;
      }

      contentProcessed = true;
      console.log(`🔄 Processing ${extractedContent.contentType} content (${extractedContent.contentText.length} chars)`);

      const embeddingResult = await processReceiptEmbedding({
        receiptId,
        contentType: extractedContent.contentType,
        content: extractedContent.contentText,
        metadata: {
          ...extractedContent.metadata,
          // Temporal metadata will be auto-enriched by add_unified_embedding function
          source_metadata: `enhanced_${extractedContent.contentType}`,
          extraction_method: 'ai_vision_enhanced'
        },
        model
      }, supabaseClient, metricsCollector, metricId);

      results.push(embeddingResult);
      console.log(`✅ Successfully processed ${extractedContent.contentType} embedding for receipt ${receiptId}`);
    }

  } catch (extractionError) {
    console.error(`❌ Error during enhanced content extraction for receipt ${receiptId}:`, extractionError);

    // Fallback to legacy extraction method
    console.log(`🔄 Falling back to legacy extraction for receipt ${receiptId}`);

    // Generate embedding for the full text (check both raw_text and fullText fields)
    const fullTextContent = receipt.raw_text || receipt.fullText;
    console.log(`Receipt ${receiptId} fullText content available: ${!!fullTextContent}`);

    if (fullTextContent) {
      contentProcessed = true;
      console.log(`Processing full text content for receipt ${receiptId}, length: ${fullTextContent.length}`);
      const fullTextResult = await processReceiptEmbedding({
        receiptId,
        contentType: 'full_text',
        content: fullTextContent,
        metadata: {
          receipt_date: receipt.date,
          total: receipt.total,
          currency: receipt.currency,
          merchant: receipt.merchant,
          category: receipt.predicted_category,
          payment_method: receipt.payment_method,
          source_metadata: 'legacy_full_text_content'
        },
        model
      }, supabaseClient, metricsCollector, metricId);
      results.push(fullTextResult);
      console.log(`Successfully processed full text embedding for receipt ${receiptId}`);
    } else {
      console.log(`No full text content found for receipt ${receiptId}`);
    }
  }

  // Process notes separately if they exist (not handled by enhanced extraction)
  if (receipt.notes && receipt.notes.trim()) {
    contentProcessed = true;
    console.log(`🔄 Processing notes for receipt ${receiptId}: "${receipt.notes.substring(0, 50)}..."`);
    const notesResult = await processReceiptEmbedding({
      receiptId,
      contentType: 'notes',
      content: receipt.notes,
      metadata: {
        receipt_date: receipt.date,
        total: receipt.total,
        currency: receipt.currency,
        merchant: receipt.merchant,
        category: receipt.predicted_category,
        payment_method: receipt.payment_method,
        // Temporal metadata will be auto-enriched by add_unified_embedding function
        source_metadata: 'receipt_notes',
        extraction_method: 'direct_field'
      },
      model
    }, supabaseClient, metricsCollector, metricId);
    results.push(notesResult);
    console.log(`✅ Successfully processed notes embedding for receipt ${receiptId}`);
  }

  // If no content was processable, use a combination of available fields as fallback
  if (!contentProcessed) {
    console.log(`No standard fields available for embedding on receipt ${receiptId}, using fallback`);

    // Build a composite text from whatever data is available
    const fallbackText = [
      receipt.merchant ? `Merchant: ${receipt.merchant}` : '',
      receipt.date ? `Date: ${receipt.date}` : '',
      receipt.total ? `Total: ${receipt.total}` : '',
      receipt.currency ? `Currency: ${receipt.currency}` : '',
      receipt.predicted_category ? `Category: ${receipt.predicted_category}` : '',
    ].filter(Boolean).join('\n');

    console.log(`Fallback text for receipt ${receiptId}: "${fallbackText}"`);

    if (fallbackText.trim()) {
      console.log(`Processing fallback text for receipt ${receiptId}, length: ${fallbackText.length}`);
      const fallbackResult = await processReceiptEmbedding({
        receiptId,
        contentType: 'fallback',
        content: fallbackText,
        metadata: {
          receipt_date: receipt.date,
          total: receipt.total,
          currency: receipt.currency,
          merchant: receipt.merchant,
          category: receipt.predicted_category,
          payment_method: receipt.payment_method,
          is_fallback: true,
          // Temporal metadata will be auto-enriched by add_unified_embedding function
          source_metadata: 'fallback_content'
        },
        model
      }, supabaseClient, metricsCollector, metricId);
      results.push(fallbackResult);
      console.log(`Successfully processed fallback embedding for receipt ${receiptId}`);
    } else {
      console.error(`Receipt ${receiptId} has no embeddable content`);
      throw new Error(`Receipt ${receiptId} has no embeddable content`);
    }
  }

  // Generate and log quality metrics
  console.log(`📊 Generating quality metrics for receipt ${receiptId}`);
  const qualityMetrics = generateEmbeddingQualityMetrics(
    receiptId,
    results.map(r => ({
      ...r,
      contentText: r.contentText || '', // Use the correct field name
      metadata: r.metadata || {}
    })),
    contentProcessed ? 'enhanced' : 'fallback'
  );

  // Log quality metrics
  logEmbeddingQualityMetrics(qualityMetrics);

  // Store quality metrics for analysis (optional, don't fail if it errors)
  try {
    await storeEmbeddingQualityMetrics(qualityMetrics, supabaseClient);
  } catch (metricsError) {
    console.warn('Failed to store quality metrics:', metricsError.message);
  }

  // Complete metrics collection successfully
  await metricsCollector.completeMetricsCollection(metricId);

  return {
    success: true,
    receiptId,
    results,
    qualityMetrics
  };

  } catch (error) {
    // Handle metrics collection failure
    const errorType = metricsCollector.classifyError(error as Error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await metricsCollector.failMetricsCollection(metricId, errorType, errorMessage);

    // Re-throw the error
    throw error;
  }
}

/**
 * Generate embeddings for all line items in a receipt
 */
async function generateLineItemEmbeddings(supabaseClient: any, receiptId: string, model?: string, forceRegenerate: boolean = false) {
  // Log the forceRegenerate flag for debugging
  console.log(`Edge fn: Generating line items for receipt ${receiptId}, forceRegenerate: ${forceRegenerate}`);

  let lineItemsToProcess: {id: string, description: string, amount: number}[] = [];

  if (forceRegenerate) {
    // Fetch all line items for the receipt
    console.log(`Edge fn: Fetching ALL line items for receipt ${receiptId}`);
    const { data, error } = await supabaseClient
      .from('line_items')
      .select('id, description, amount')
      .eq('receipt_id', receiptId)
      .not('description', 'is', null); // Exclude items with no description upfront

    if (error) throw new Error(`Error fetching all line items: ${error.message}`);
    lineItemsToProcess = data || [];
  } else {
    // Fetch only line items WITHOUT existing embeddings using the RPC function
    console.log(`Edge fn: Fetching line items WITHOUT embeddings for receipt ${receiptId}`);
    const { data, error } = await supabaseClient
      .rpc('get_line_items_without_embeddings_for_receipt', { p_receipt_id: receiptId });

    if (error) throw new Error(`Error fetching line items without embeddings via RPC: ${error.message}`);
    lineItemsToProcess = data || [];
  }

  // Early exit if no items need processing
  if (!lineItemsToProcess || lineItemsToProcess.length === 0) {
    console.log(`Edge fn: No line items need processing for receipt ${receiptId}`);
    return {
      success: true,
      receiptId,
      lineItems: [],
      count: 0
    };
  }

  console.log(`Edge fn: Found ${lineItemsToProcess.length} line items to process for receipt ${receiptId}`);

  // *** Start: Parallel Processing Logic ***
  console.log(`Edge fn: Starting parallel processing for ${lineItemsToProcess.length} line items.`);

  // Define types for our promise results
  type LineItemEmbeddingResult = {
    success: boolean;
    lineItemId: string;
    receiptId: string;
    dimensions: number;
  };

  type SettledResult =
    | { status: 'fulfilled'; value: LineItemEmbeddingResult }
    | { status: 'rejected'; reason: string; lineItemId: string };

  const processingPromises = lineItemsToProcess.map(async (lineItem) => {
    try {
      // Get receipt data for temporal metadata
      const { data: receipt } = await supabaseClient
        .from('receipts')
        .select('date, total, currency, merchant, predicted_category, payment_method')
        .eq('id', receiptId)
        .single();

      const result = await processLineItemEmbedding({
        lineItemId: lineItem.id,
        receiptId,
        content: lineItem.description,
        metadata: {
          amount: lineItem.amount,
          receipt_date: receipt?.date,
          total: receipt?.total,
          currency: receipt?.currency,
          merchant: receipt?.merchant,
          category: receipt?.predicted_category,
          payment_method: receipt?.payment_method,
          // Temporal metadata will be auto-enriched by add_unified_embedding function
          source_metadata: 'line_item'
        },
        model
      }, supabaseClient);

      return {
        status: 'fulfilled' as const,
        value: result
      };
    } catch (error) {
      // Log error but allow others to continue
      console.error(`Edge fn: Error processing line item ${lineItem.id} in parallel:`, error.message || error);
      return {
        status: 'rejected' as const,
        reason: error.message || String(error),
        lineItemId: lineItem.id
      };
    }
  });

  // Wait for all promises to complete (success or failure)
  const settledResults = await Promise.all(processingPromises) as SettledResult[];

  // Collect successful results
  const successfulResults = settledResults
    .filter((result): result is { status: 'fulfilled'; value: LineItemEmbeddingResult } =>
      result.status === 'fulfilled')
    .map(result => result.value);

  const failedCount = settledResults.length - successfulResults.length;

  console.log(`Edge fn: Finished parallel processing for receipt ${receiptId}. Successful: ${successfulResults.length}, Failed: ${failedCount}`);
  // *** End: Parallel Processing Logic ***

  // Return summary result
  return {
    success: true,
    receiptId,
    lineItems: successfulResults,
    count: successfulResults.length,
    failedCount: failedCount,
    totalProcessed: settledResults.length
  };
}

/**
 * Enhanced batch processing for missing embeddings
 */
async function processMissingEmbeddingsBatch(supabaseClient: any, batchSize: number = 10): Promise<any> {
  console.log(`Processing batch of missing embeddings, batch size: ${batchSize}`);

  try {
    // Get receipts missing embeddings
    const { data: missingReceipts, error: missingError } = await supabaseClient
      .rpc('find_receipts_missing_embeddings', { limit_count: batchSize });

    if (missingError) {
      throw new Error(`Error finding missing embeddings: ${missingError.message}`);
    }

    if (!missingReceipts || missingReceipts.length === 0) {
      return {
        success: true,
        processed: 0,
        message: 'No receipts missing embeddings found'
      };
    }

    console.log(`Found ${missingReceipts.length} receipts missing embeddings`);

    let processed = 0;
    let errors = 0;
    const results = [];

    // Process each receipt
    for (const receipt of missingReceipts) {
      try {
        console.log(`Processing receipt ${receipt.receipt_id} with missing types: ${receipt.missing_content_types.join(', ')}`);

        // Generate embeddings for this receipt
        const result = await processReceiptEmbeddingsUnified({
          receiptId: receipt.receipt_id,
          forceRegenerate: false,
          processAllFields: true,
          contentTypes: receipt.missing_content_types
        }, supabaseClient);

        if (result.success) {
          processed++;
          results.push({
            receiptId: receipt.receipt_id,
            success: true,
            contentTypes: receipt.missing_content_types
          });
        } else {
          errors++;
          results.push({
            receiptId: receipt.receipt_id,
            success: false,
            error: result.error || 'Unknown error'
          });
        }

      } catch (error) {
        console.error(`Error processing receipt ${receipt.receipt_id}:`, error);
        errors++;
        results.push({
          receiptId: receipt.receipt_id,
          success: false,
          error: error.message
        });
      }

      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      success: true,
      processed,
      errors,
      total: missingReceipts.length,
      results
    };

  } catch (error) {
    console.error('Batch processing error:', error);
    throw error;
  }
}

/**
 * Enhanced receipt embedding processing for unified system
 */
async function processReceiptEmbeddingsUnified(
  request: { receiptId: string; forceRegenerate?: boolean; processAllFields?: boolean; contentTypes?: string[] },
  supabaseClient: any
): Promise<any> {
  const { receiptId, forceRegenerate = false, processAllFields = true, contentTypes } = request;

  console.log(`Processing unified embeddings for receipt ${receiptId}`);

  try {
    // Get receipt data
    const { data: receipt, error: receiptError } = await supabaseClient
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .single();

    if (receiptError || !receipt) {
      throw new Error(`Receipt not found: ${receiptError?.message || 'Unknown error'}`);
    }

    const results = [];

    console.log(`🔄 Using enhanced content extraction for unified processing of receipt ${receiptId}`);

    // Use enhanced content extraction
    try {
      const extractedContents = await ContentExtractor.extractReceiptContent(receipt);
      console.log(`📋 Extracted ${extractedContents.length} content types for unified processing`);

      // Filter by requested content types if specified
      const contentsToProcess = contentTypes
        ? extractedContents.filter(content => contentTypes.includes(content.contentType))
        : extractedContents;

      console.log(`🎯 Processing ${contentsToProcess.length} content types: ${contentsToProcess.map(c => c.contentType).join(', ')}`);

      // Process each extracted content type
      for (const extractedContent of contentsToProcess) {
        try {
          if (!extractedContent.contentText || extractedContent.contentText.trim() === '') {
            console.log(`⚠️ Skipping empty content for type: ${extractedContent.contentType}`);
            continue;
          }

          console.log(`🔄 Processing ${extractedContent.contentType} content (${extractedContent.contentText.length} chars)`);

          // Generate embedding
          const embedding = await generateEmbedding(extractedContent.contentText, 'receipt_full');

          // Store in unified_embeddings table
          const { data: embeddingData, error: embeddingError } = await supabaseClient
            .rpc('add_unified_embedding', {
              p_source_type: 'receipt',
              p_source_id: receiptId,
              p_content_type: extractedContent.contentType,
              p_content_text: extractedContent.contentText,
              p_embedding: embedding,
              p_metadata: {
                ...extractedContent.metadata,
                source_metadata: `unified_enhanced_${extractedContent.contentType}`,
                extraction_method: 'ai_vision_enhanced'
              },
              p_user_id: extractedContent.userId || receipt.user_id,
              p_team_id: extractedContent.teamId,
              p_language: extractedContent.language || 'en'
            });

          if (embeddingError) {
            console.error(`❌ Error storing ${extractedContent.contentType} embedding for receipt ${receiptId}:`, embeddingError);
            results.push({
              contentType: extractedContent.contentType,
              success: false,
              error: embeddingError.message
            });
          } else {
            console.log(`✅ Successfully stored ${extractedContent.contentType} embedding for receipt ${receiptId}`);
            results.push({
              contentType: extractedContent.contentType,
              success: true,
              embeddingId: embeddingData,
              contentLength: extractedContent.contentText.length
            });
          }

        } catch (error) {
          console.error(`❌ Error processing ${extractedContent.contentType} for receipt ${receiptId}:`, error);
          results.push({
            contentType: extractedContent.contentType,
            success: false,
            error: error.message
          });
        }
      }

    } catch (extractionError) {
      console.error(`❌ Error during enhanced content extraction for receipt ${receiptId}:`, extractionError);

      // Fallback to basic processing if enhanced extraction fails
      console.log(`🔄 Falling back to basic processing for receipt ${receiptId}`);

      const basicContentTypes = contentTypes || ['full_text', 'merchant'];
      for (const contentType of basicContentTypes) {
        try {
          let content = '';
          switch (contentType) {
            case 'full_text':
              content = receipt.fullText || '';
              break;
            case 'merchant':
              content = receipt.merchant || '';
              break;
            default:
              continue;
          }

          if (!content || content.trim() === '') {
            console.log(`⚠️ Skipping ${contentType} for receipt ${receiptId} - no content`);
            continue;
          }

          const embedding = await generateEmbedding(content, contentType);

          const { data: embeddingData, error: embeddingError } = await supabaseClient
            .rpc('add_unified_embedding', {
              p_source_type: 'receipt',
              p_source_id: receiptId,
              p_content_type: contentType,
              p_content_text: content,
              p_embedding: embedding,
              p_metadata: {
                receipt_date: receipt.date,
                total: receipt.total,
                currency: receipt.currency,
                merchant: receipt.merchant,
                source_metadata: `unified_fallback_${contentType}`,
                extraction_method: 'fallback'
              },
              p_user_id: receipt.user_id,
              p_language: 'en'
            });

          if (embeddingError) {
            results.push({
              contentType,
              success: false,
              error: embeddingError.message
            });
          } else {
            results.push({
              contentType,
              success: true,
              embeddingId: embeddingData,
              fallback: true
            });
          }

        } catch (error) {
          results.push({
            contentType,
            success: false,
            error: error.message
          });
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return {
      success: successCount > 0,
      receiptId,
      processed: successCount,
      errors: errorCount,
      results
    };

  } catch (error) {
    console.error(`Error processing receipt ${receiptId}:`, error);
    return {
      success: false,
      receiptId,
      error: error.message
    };
  }
}

/**
 * Phase 4: Process unified embedding request for any data source
 */
async function processUnifiedEmbeddingRequest(request: UnifiedEmbeddingRequest, supabaseClient: any) {
  const { mode, sourceType, sourceId, batchSize = 5, priority = 'medium' } = request;

  console.log(`Processing unified embedding request: mode=${mode}, sourceType=${sourceType}, sourceId=${sourceId}`);

  const batchProcessor = new BatchProcessor(supabaseClient, generateEmbedding);

  switch (mode) {
    case 'realtime':
      if (!sourceType || !sourceId) {
        throw new Error('sourceType and sourceId are required for realtime mode');
      }

      // Process single item immediately
      const queueItem = {
        id: 'realtime-' + Date.now(),
        source_type: sourceType,
        source_id: sourceId,
        operation: 'INSERT',
        priority,
        metadata: { realtime: true }
      };

      const realtimeResult = await batchProcessor.processBatch([queueItem], 1);
      return {
        success: realtimeResult.success,
        mode: 'realtime',
        sourceType,
        sourceId,
        processed: realtimeResult.processed,
        errors: realtimeResult.errors
      };

    case 'batch':
      if (!sourceType) {
        throw new Error('sourceType is required for batch mode');
      }

      // Find missing embeddings and process them
      const { data: missingRecords } = await supabaseClient.rpc('find_missing_embeddings', {
        source_table: sourceType,
        limit_count: batchSize
      });

      if (!missingRecords || missingRecords.length === 0) {
        return {
          success: true,
          mode: 'batch',
          sourceType,
          processed: 0,
          message: 'No missing embeddings found'
        };
      }

      const batchItems = missingRecords.map((record: any) => ({
        id: 'batch-' + record.id,
        source_type: sourceType,
        source_id: record.id,
        operation: 'INSERT',
        priority,
        metadata: { batch: true, missing_content_types: record.missing_content_types }
      }));

      const batchResult = await batchProcessor.processBatch(batchItems, batchSize);
      return {
        success: batchResult.success,
        mode: 'batch',
        sourceType,
        processed: batchResult.processed,
        failed: batchResult.failed,
        errors: batchResult.errors
      };

    case 'maintenance':
      // Process maintenance tasks (find and queue missing embeddings)
      const maintenanceResult = await batchProcessor.processMaintenanceTasks();
      return {
        success: true,
        mode: 'maintenance',
        ...maintenanceResult
      };

    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
}

/**
 * Phase 4: Process embedding queue
 */
async function processEmbeddingQueue(request: QueueProcessingRequest, supabaseClient: any) {
  const { limit = 50, priority } = request;

  console.log(`Processing embedding queue: limit=${limit}, priority=${priority}`);

  const batchProcessor = new BatchProcessor(supabaseClient, generateEmbedding);

  // Get pending queue items
  const queueItems = await batchProcessor.getPendingQueueItems(limit);

  if (queueItems.length === 0) {
    return {
      success: true,
      mode: 'queue',
      processed: 0,
      message: 'No pending queue items found'
    };
  }

  // Filter by priority if specified
  const filteredItems = priority
    ? queueItems.filter(item => item.priority === priority)
    : queueItems;

  if (filteredItems.length === 0) {
    return {
      success: true,
      mode: 'queue',
      processed: 0,
      message: `No pending queue items found with priority: ${priority}`
    };
  }

  // Process the queue items
  const result = await batchProcessor.processBatch(filteredItems);

  return {
    success: result.success,
    mode: 'queue',
    processed: result.processed,
    failed: result.failed,
    errors: result.errors,
    totalQueueItems: queueItems.length,
    filteredItems: filteredItems.length
  };
}

serve(async (req: Request) => {
  // Log request details for debugging
  console.log('Request received:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
  });

  // Log authorization header presence (without sensitive values)
  console.log('Authorization header present:', !!req.headers.get('Authorization'));
  console.log('API key header present:', !!req.headers.get('apikey'));

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Responding to OPTIONS request with CORS headers');
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      supabaseUrl ?? '',
      supabaseServiceKey ?? ''
    );

    // Check if environment variables are set
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Server configuration error: Missing Supabase credentials'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the request
    if (req.method === 'POST') {
      let requestBody: any;
      try {
        requestBody = await req.json();
        console.log('Received POST body for generate-embeddings:', JSON.stringify(requestBody));
      } catch (jsonError) {
        console.error('Error parsing JSON body:', jsonError);
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid JSON body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check for the new useImprovedDimensionHandling flag
      const useImprovedDimensionHandling = Boolean(requestBody.useImprovedDimensionHandling);
      console.log(`Using ${useImprovedDimensionHandling ? 'improved' : 'standard'} dimension handling`);

      const {
        receiptId,
        contentType,
        content,
        metadata,
        model,
        processAllFields,
        lineItemId,
        processLineItems,
        forceRegenerate = false, // Add support for forced regeneration
        // Enhanced: Batch processing parameter
        processMissingBatch,
        // Phase 4: New unified embedding parameters
        mode,
        sourceType,
        sourceId,
        batchSize,
        priority,
        limit,
        // Phase 1: Metrics collection parameter
        uploadContext = 'single' // Default to single if not specified
      } = requestBody;

      console.log('Parsed generate-embeddings parameters:', {
        receiptId,
        processLineItems,
        forceRegenerate,
        lineItemId,
        processAllFields,
        contentType,
        hasContent: !!content
      });

      // Log the incoming request parameters (excluding any sensitive data)
      console.log('Received embedding request:', {
        receiptId,
        contentType,
        processAllFields,
        lineItemId,
        processLineItems,
        hasContent: !!content,
        hasMetadata: !!metadata,
        // Phase 4: New parameters
        mode,
        sourceType,
        sourceId,
        batchSize,
        priority
      });

      // Enhanced: Handle batch processing of missing embeddings
      if (processMissingBatch) {
        try {
          const batchSize = requestBody.batchSize || 10;
          const result = await processMissingEmbeddingsBatch(supabaseClient, batchSize);

          return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Error processing missing embeddings batch:', error);
          return new Response(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              action: 'processMissingBatch'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Phase 4: Handle unified embedding requests
      if (mode === 'queue') {
        try {
          const result = await processEmbeddingQueue({
            mode: 'queue',
            limit,
            priority,
            model
          }, supabaseClient);

          return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Error processing embedding queue:', error);
          return new Response(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              mode: 'queue'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      if (mode && ['realtime', 'batch', 'maintenance'].includes(mode)) {
        try {
          const result = await processUnifiedEmbeddingRequest({
            mode,
            sourceType,
            sourceId,
            batchSize,
            priority,
            model
          }, supabaseClient);

          return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error(`Error processing unified embedding request (mode: ${mode}):`, error);
          return new Response(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              mode,
              sourceType,
              sourceId
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Process line items for a receipt
      if (processLineItems && receiptId) {
        try {
          // Pass the forceRegenerate flag to the function
          const result = await generateLineItemEmbeddings(supabaseClient, receiptId, model, forceRegenerate);
          return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error(`Error generating line item embeddings for receipt ${receiptId}:`, error);
          return new Response(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              receiptId
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      // Process a single line item
      else if (lineItemId && receiptId && content) {
        try {
          const result = await processLineItemEmbedding({
            lineItemId,
            receiptId,
            content,
            metadata,
            model
          }, supabaseClient);

          return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error(`Error processing single line item embedding for ${lineItemId}:`, error);
          return new Response(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              lineItemId,
              receiptId
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      // If processAllFields is true, generate embeddings for all fields
      else if (processAllFields && receiptId) {
        try {
          const result = await generateReceiptEmbeddings(supabaseClient, receiptId, model, uploadContext);
          return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error(`Error generating embeddings for receipt ${receiptId}:`, error);
          return new Response(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              receiptId
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      // Process a single embedding
      else if (receiptId && contentType && content) {
        try {
          // Use metrics collection wrapper for single embedding
          const result = await withMetricsCollection(
            createMetricsCollector(supabaseClient),
            {
              receiptId,
              uploadContext,
              modelUsed: model || 'gemini-embedding-001'
            },
            async (metricId) => {
              const metricsCollector = createMetricsCollector(supabaseClient);
              return await processReceiptEmbedding({
                receiptId,
                contentType,
                content,
                metadata,
                model
              }, supabaseClient, metricsCollector, metricId);
            }
          );

          return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error(`Error processing single embedding for receipt ${receiptId}:`, error);
          return new Response(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              receiptId,
              contentType
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // Handle GET request to check embedding status
    else if (req.method === 'GET') {
      const url = new URL(req.url);
      const receiptId = url.searchParams.get('receiptId');

      if (!receiptId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing receiptId parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        // Get all embeddings for the receipt
        const { data: embeddings, error } = await supabaseClient
          .from('receipt_embeddings')
          .select('id, content_type, created_at')
          .eq('receipt_id', receiptId);

        if (error) {
          throw new Error(`Error fetching embeddings: ${error.message}`);
        }

        return new Response(
          JSON.stringify({
            success: true,
            receiptId,
            count: embeddings ? embeddings.length : 0,
            embeddings
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error(`Error checking embeddings for receipt ${receiptId}:`, error);
        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            receiptId
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // Phase 3: Handle rate limiting management endpoints
    else if (req.method === 'GET') {
      const url = new URL(req.url);
      const action = url.searchParams.get('action');

      if (action === 'rate_limit_status') {
        // Return current rate limiting status
        try {
          const status = getRateLimitingStatus();
          return new Response(
            JSON.stringify({
              success: true,
              rateLimitStatus: status,
              timestamp: new Date().toISOString()
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Error getting rate limit status:', error);
          return new Response(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }
    // Handle strategy updates via PUT
    else if (req.method === 'PUT') {
      try {
        const body = await req.json();
        const { action, strategy } = body;

        if (action === 'update_strategy' && strategy) {
          const success = updateProcessingStrategy(strategy as ProcessingStrategy);

          if (success) {
            const status = getRateLimitingStatus();
            return new Response(
              JSON.stringify({
                success: true,
                message: `Processing strategy updated to ${strategy}`,
                rateLimitStatus: status,
                timestamp: new Date().toISOString()
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } else {
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Failed to update processing strategy'
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Invalid action or missing strategy parameter'
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (error) {
        console.error('Error handling PUT request:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ success: false, error: `Method ${req.method} not allowed` }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    // Catch any uncaught errors and ensure they return with CORS headers
    console.error('Uncaught error in edge function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
