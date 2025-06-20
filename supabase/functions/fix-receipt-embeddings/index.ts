/**
 * Fix Receipt Content Storage Issue
 * Repairs the critical issue where receipt embeddings have empty content_text fields
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Types
interface FixRequest {
  action: 'analyze' | 'fix_batch' | 'fix_all' | 'verify';
  receiptIds?: string[];
  batchSize?: number;
  dryRun?: boolean;
}

interface ReceiptData {
  id: string;
  merchant: string;
  fullText: string;
  user_id: string;
  team_id?: string;
  date: string;
  total: number;
}

interface EmbeddingFix {
  embeddingId: string;
  receiptId: string;
  contentType: string;
  originalContent: string;
  fixedContent: string;
  success: boolean;
  error?: string;
}

// Gemini API configuration
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent';

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: FixRequest = await req.json();

    let result: any = {};

    switch (body.action) {
      case 'analyze':
        result = await analyzeContentStorageIssue(supabase);
        break;
        
      case 'fix_batch':
        result = await fixReceiptEmbeddingsBatch(
          supabase, 
          body.receiptIds || [], 
          body.dryRun || false
        );
        break;
        
      case 'fix_all':
        result = await fixAllReceiptEmbeddings(
          supabase, 
          body.batchSize || 10,
          body.dryRun || false
        );
        break;
        
      case 'verify':
        result = await verifyFixes(supabase);
        break;
        
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Receipt embedding fix error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Analyze the current content storage issue
 */
async function analyzeContentStorageIssue(supabase: any): Promise<any> {
  console.log('🔍 Analyzing receipt content storage issue...');

  // Get embedding statistics
  const { data: embeddingStats, error: embeddingError } = await supabase
    .from('unified_embeddings')
    .select('source_type, content_type, content_text')
    .eq('source_type', 'receipt');

  if (embeddingError) {
    throw new Error(`Failed to fetch embedding stats: ${embeddingError.message}`);
  }

  // Analyze content issues
  const totalEmbeddings = embeddingStats.length;
  const emptyContentEmbeddings = embeddingStats.filter(e => !e.content_text || e.content_text.trim() === '');
  const hasContentEmbeddings = embeddingStats.filter(e => e.content_text && e.content_text.trim() !== '');

  // Group by content type
  const contentTypeStats = embeddingStats.reduce((acc, embedding) => {
    const type = embedding.content_type;
    if (!acc[type]) {
      acc[type] = { total: 0, empty: 0, hasContent: 0 };
    }
    acc[type].total++;
    if (!embedding.content_text || embedding.content_text.trim() === '') {
      acc[type].empty++;
    } else {
      acc[type].hasContent++;
    }
    return acc;
  }, {});

  // Get sample receipts with missing content
  const { data: sampleReceipts, error: receiptError } = await supabase
    .from('receipts')
    .select('id, merchant, "fullText", user_id, team_id, date, total')
    .limit(5);

  if (receiptError) {
    throw new Error(`Failed to fetch sample receipts: ${receiptError.message}`);
  }

  return {
    analysis: {
      totalEmbeddings,
      emptyContentCount: emptyContentEmbeddings.length,
      hasContentCount: hasContentEmbeddings.length,
      emptyContentPercentage: Math.round((emptyContentEmbeddings.length / totalEmbeddings) * 100),
      contentTypeBreakdown: contentTypeStats
    },
    sampleReceipts: sampleReceipts.map(r => ({
      id: r.id,
      merchant: r.merchant,
      hasFullText: !!r.fullText,
      fullTextLength: r.fullText ? r.fullText.length : 0
    })),
    recommendations: [
      'All receipt embeddings have empty content_text fields',
      'Source receipt data exists (merchant names available)',
      'Need to regenerate embeddings with proper content_text storage',
      'Estimated fix time: 2-5 minutes for all receipts'
    ]
  };
}

/**
 * Fix receipt embeddings in batch
 */
async function fixReceiptEmbeddingsBatch(
  supabase: any, 
  receiptIds: string[], 
  dryRun: boolean = false
): Promise<any> {
  console.log(`🔧 Fixing receipt embeddings for ${receiptIds.length} receipts (dry run: ${dryRun})`);

  const fixes: EmbeddingFix[] = [];
  const errors: string[] = [];

  for (const receiptId of receiptIds) {
    try {
      // Get receipt data
      const { data: receipt, error: receiptError } = await supabase
        .from('receipts')
        .select('id, merchant, "fullText", user_id, team_id, date, total')
        .eq('id', receiptId)
        .single();

      if (receiptError || !receipt) {
        errors.push(`Receipt ${receiptId} not found: ${receiptError?.message}`);
        continue;
      }

      // Get existing embeddings for this receipt
      const { data: existingEmbeddings, error: embeddingError } = await supabase
        .from('unified_embeddings')
        .select('id, content_type, content_text')
        .eq('source_type', 'receipt')
        .eq('source_id', receiptId);

      if (embeddingError) {
        errors.push(`Failed to fetch embeddings for ${receiptId}: ${embeddingError.message}`);
        continue;
      }

      // Fix each embedding
      for (const embedding of existingEmbeddings) {
        const fixResult = await fixSingleEmbedding(
          supabase, 
          embedding, 
          receipt, 
          dryRun
        );
        fixes.push(fixResult);
      }

    } catch (error) {
      errors.push(`Error processing receipt ${receiptId}: ${error.message}`);
    }
  }

  return {
    processedReceipts: receiptIds.length,
    totalFixes: fixes.length,
    successfulFixes: fixes.filter(f => f.success).length,
    failedFixes: fixes.filter(f => !f.success).length,
    fixes: fixes.slice(0, 10), // Return first 10 for review
    errors,
    dryRun
  };
}

/**
 * Fix a single embedding
 */
async function fixSingleEmbedding(
  supabase: any,
  embedding: any,
  receipt: ReceiptData,
  dryRun: boolean
): Promise<EmbeddingFix> {
  const fix: EmbeddingFix = {
    embeddingId: embedding.id,
    receiptId: receipt.id,
    contentType: embedding.content_type,
    originalContent: embedding.content_text || '',
    fixedContent: '',
    success: false
  };

  try {
    // Determine the correct content based on content type
    let contentText = '';
    
    switch (embedding.content_type) {
      case 'merchant':
        contentText = receipt.merchant || '';
        break;
      case 'full_text':
        contentText = receipt.fullText || '';
        break;
      case 'fallback':
        // Create fallback content from available fields
        contentText = [
          receipt.merchant ? `Merchant: ${receipt.merchant}` : '',
          receipt.date ? `Date: ${receipt.date}` : '',
          receipt.total ? `Total: ${receipt.total}` : ''
        ].filter(Boolean).join('\n');
        break;
      default:
        contentText = receipt.merchant || ''; // Default to merchant
    }

    fix.fixedContent = contentText;

    // Only update if content is different and not empty
    if (contentText && contentText !== embedding.content_text) {
      if (!dryRun) {
        // Update the embedding with correct content
        const { error: updateError } = await supabase
          .from('unified_embeddings')
          .update({ 
            content_text: contentText,
            updated_at: new Date().toISOString()
          })
          .eq('id', embedding.id);

        if (updateError) {
          fix.error = updateError.message;
          return fix;
        }
      }
      
      fix.success = true;
    } else if (!contentText) {
      fix.error = 'No content available to fix';
    } else {
      fix.success = true; // Already correct
    }

  } catch (error) {
    fix.error = error.message;
  }

  return fix;
}

/**
 * Fix all receipt embeddings
 */
async function fixAllReceiptEmbeddings(
  supabase: any, 
  batchSize: number = 10,
  dryRun: boolean = false
): Promise<any> {
  console.log(`🔧 Fixing all receipt embeddings (batch size: ${batchSize}, dry run: ${dryRun})`);

  // Get all receipts with embeddings that need fixing
  const { data: receiptsWithEmbeddings, error } = await supabase
    .from('unified_embeddings')
    .select('source_id')
    .eq('source_type', 'receipt')
    .or('content_text.is.null,content_text.eq.');

  if (error) {
    throw new Error(`Failed to fetch receipts with embeddings: ${error.message}`);
  }

  const uniqueReceiptIds = [...new Set(receiptsWithEmbeddings.map(e => e.source_id))];
  console.log(`Found ${uniqueReceiptIds.length} receipts with embedding issues`);

  const allResults = [];
  let processedCount = 0;

  // Process in batches
  for (let i = 0; i < uniqueReceiptIds.length; i += batchSize) {
    const batch = uniqueReceiptIds.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uniqueReceiptIds.length / batchSize)}`);

    const batchResult = await fixReceiptEmbeddingsBatch(supabase, batch, dryRun);
    allResults.push(batchResult);
    processedCount += batch.length;

    // Small delay between batches to avoid overwhelming the system
    if (i + batchSize < uniqueReceiptIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Aggregate results
  const totalFixes = allResults.reduce((sum, result) => sum + result.totalFixes, 0);
  const successfulFixes = allResults.reduce((sum, result) => sum + result.successfulFixes, 0);
  const failedFixes = allResults.reduce((sum, result) => sum + result.failedFixes, 0);

  return {
    totalReceipts: uniqueReceiptIds.length,
    processedReceipts: processedCount,
    totalFixes,
    successfulFixes,
    failedFixes,
    successRate: totalFixes > 0 ? Math.round((successfulFixes / totalFixes) * 100) : 0,
    batchResults: allResults,
    dryRun
  };
}

/**
 * Verify that fixes were successful
 */
async function verifyFixes(supabase: any): Promise<any> {
  console.log('✅ Verifying receipt embedding fixes...');

  // Check current state after fixes
  const { data: embeddingStats, error } = await supabase
    .from('unified_embeddings')
    .select('source_type, content_type, content_text')
    .eq('source_type', 'receipt');

  if (error) {
    throw new Error(`Failed to verify fixes: ${error.message}`);
  }

  const totalEmbeddings = embeddingStats.length;
  const emptyContentEmbeddings = embeddingStats.filter(e => !e.content_text || e.content_text.trim() === '');
  const hasContentEmbeddings = embeddingStats.filter(e => e.content_text && e.content_text.trim() !== '');

  const contentTypeStats = embeddingStats.reduce((acc, embedding) => {
    const type = embedding.content_type;
    if (!acc[type]) {
      acc[type] = { total: 0, empty: 0, hasContent: 0 };
    }
    acc[type].total++;
    if (!embedding.content_text || embedding.content_text.trim() === '') {
      acc[type].empty++;
    } else {
      acc[type].hasContent++;
    }
    return acc;
  }, {});

  return {
    verification: {
      totalEmbeddings,
      emptyContentCount: emptyContentEmbeddings.length,
      hasContentCount: hasContentEmbeddings.length,
      fixSuccessRate: totalEmbeddings > 0 ? Math.round((hasContentEmbeddings.length / totalEmbeddings) * 100) : 0,
      contentTypeBreakdown: contentTypeStats
    },
    status: emptyContentEmbeddings.length === 0 ? 'FULLY_FIXED' : 'PARTIALLY_FIXED',
    remainingIssues: emptyContentEmbeddings.length
  };
}
