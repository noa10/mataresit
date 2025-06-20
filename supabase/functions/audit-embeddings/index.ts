/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma, expires',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json'
}

interface EmbeddingAuditResult {
  totalReceipts: number;
  receiptsWithOldEmbeddings: number;
  receiptsWithUnifiedEmbeddings: number;
  receiptsMissingEmbeddings: number;
  migrationNeeded: boolean;
  embeddingHealthByType: Array<{
    source_type: string;
    content_type: string;
    total_embeddings: number;
    empty_content: number;
    has_content: number;
    content_health_percentage: number;
  }>;
  missingEmbeddingsSample: Array<{
    receipt_id: string;
    merchant: string;
    date: string;
    missing_content_types: string[];
  }>;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl) {
      throw new Error('Missing SUPABASE_URL environment variable');
    }

    // Try service key first, fall back to anon key with user auth
    let supabase;
    if (supabaseServiceKey) {
      supabase = createClient(supabaseUrl, supabaseServiceKey);
    } else if (supabaseAnonKey) {
      // Get the authorization header
      const authHeader = req.headers.get('Authorization');

      if (authHeader) {
        // Extract the token from "Bearer <token>"
        const token = authHeader.replace('Bearer ', '');

        // Check if this is the anon key or a user session token
        if (token === supabaseAnonKey) {
          // This is the anon key - use it directly for admin operations
          console.log('Using anon key for admin operations');
          supabase = createClient(supabaseUrl, supabaseAnonKey);
        } else {
          // This is a user session token - use it with the anon key
          console.log('Using user session token');
          supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
              headers: {
                Authorization: authHeader
              }
            }
          });
        }
      } else {
        throw new Error('Missing authorization header - please ensure you are logged in');
      }
    } else {
      throw new Error('Missing both SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY environment variables');
    }

    if (req.method === 'POST') {
      const { action } = await req.json();

      switch (action) {
        case 'audit':
          return await performEmbeddingAudit(supabase);
        
        case 'migrate':
          return await migrateEmbeddings(supabase);
        
        case 'fix_content':
          return await fixEmbeddingContent(supabase);
        
        case 'generate_missing':
          return await generateMissingEmbeddings(supabase);
        
        default:
          return new Response(
            JSON.stringify({ error: 'Invalid action' }),
            { status: 400, headers: corsHeaders }
          );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Audit embeddings error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});

/**
 * Perform comprehensive embedding audit
 */
async function performEmbeddingAudit(supabase: any): Promise<Response> {
  try {
    console.log('Starting comprehensive embedding audit...');

    // Get migration statistics
    const { data: migrationStats, error: migrationError } = await supabase
      .rpc('get_embedding_migration_stats');

    if (migrationError) {
      throw new Error(`Migration stats error: ${migrationError.message}`);
    }

    // Get embedding health by type
    const { data: healthStats, error: healthError } = await supabase
      .from('embedding_content_health')
      .select('*');

    if (healthError) {
      console.warn('Could not get health stats:', healthError.message);
    }

    // Get sample of missing embeddings
    const { data: missingSample, error: missingError } = await supabase
      .rpc('find_receipts_missing_embeddings', { limit_count: 10 });

    if (missingError) {
      console.warn('Could not get missing embeddings sample:', missingError.message);
    }

    // Get unified search stats
    const { data: searchStats, error: searchError } = await supabase
      .rpc('get_unified_search_stats');

    if (searchError) {
      console.warn('Could not get search stats:', searchError.message);
    }

    const auditResult: EmbeddingAuditResult = {
      totalReceipts: migrationStats?.[0]?.total_receipts || 0,
      receiptsWithOldEmbeddings: migrationStats?.[0]?.receipts_with_old_embeddings || 0,
      receiptsWithUnifiedEmbeddings: migrationStats?.[0]?.receipts_with_unified_embeddings || 0,
      receiptsMissingEmbeddings: migrationStats?.[0]?.receipts_missing_embeddings || 0,
      migrationNeeded: migrationStats?.[0]?.migration_needed || false,
      embeddingHealthByType: healthStats || [],
      missingEmbeddingsSample: missingSample || []
    };

    console.log('Audit completed:', auditResult);

    return new Response(
      JSON.stringify({
        success: true,
        audit: auditResult,
        searchStats: searchStats || [],
        recommendations: generateRecommendations(auditResult)
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Audit error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Migrate existing receipt embeddings to unified format
 */
async function migrateEmbeddings(supabase: any): Promise<Response> {
  try {
    console.log('Starting embedding migration...');

    const { data: migrationResult, error: migrationError } = await supabase
      .rpc('migrate_receipt_embeddings_to_unified');

    if (migrationError) {
      throw new Error(`Migration error: ${migrationError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        migration: migrationResult?.[0] || {}
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Fix embedding content issues
 */
async function fixEmbeddingContent(supabase: any): Promise<Response> {
  try {
    console.log('Fixing embedding content issues...');

    const { data: fixResult, error: fixError } = await supabase
      .rpc('fix_receipt_embedding_content');

    if (fixError) {
      throw new Error(`Fix content error: ${fixError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        fixes: fixResult || []
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Fix content error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Generate missing embeddings for receipts
 */
async function generateMissingEmbeddings(supabase: any): Promise<Response> {
  try {
    console.log('Generating missing embeddings...');

    // Get receipts missing embeddings
    const { data: missingReceipts, error: missingError } = await supabase
      .rpc('find_receipts_missing_embeddings', { limit_count: 20 });

    if (missingError) {
      throw new Error(`Error finding missing embeddings: ${missingError.message}`);
    }

    if (!missingReceipts || missingReceipts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No receipts missing embeddings found',
          processed: 0
        }),
        { headers: corsHeaders }
      );
    }

    // Queue receipts for embedding generation
    const queueItems = missingReceipts.map((receipt: any) => ({
      source_type: 'receipts',
      source_id: receipt.receipt_id,
      operation: 'INSERT',
      priority: 'high',
      metadata: {
        missing_content_types: receipt.missing_content_types,
        audit_generated: true
      }
    }));

    const { error: queueError } = await supabase
      .from('embedding_queue')
      .insert(queueItems);

    if (queueError) {
      throw new Error(`Error queuing embeddings: ${queueError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Queued ${queueItems.length} receipts for embedding generation`,
        queued: queueItems.length,
        receipts: missingReceipts.map((r: any) => r.receipt_id)
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Generate missing embeddings error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Generate recommendations based on audit results
 */
function generateRecommendations(audit: EmbeddingAuditResult): string[] {
  const recommendations: string[] = [];

  if (audit.migrationNeeded) {
    recommendations.push('Migration needed: Run migration to move old embeddings to unified format');
  }

  if (audit.receiptsMissingEmbeddings > 0) {
    recommendations.push(`${audit.receiptsMissingEmbeddings} receipts are missing embeddings - run batch generation`);
  }

  const unhealthyTypes = audit.embeddingHealthByType.filter(
    type => type.content_health_percentage < 80
  );

  if (unhealthyTypes.length > 0) {
    recommendations.push(`${unhealthyTypes.length} content types have health issues - run content fix`);
  }

  if (audit.totalReceipts > 0 && audit.receiptsWithUnifiedEmbeddings === 0) {
    recommendations.push('No unified embeddings found - search will not work until embeddings are generated');
  }

  if (recommendations.length === 0) {
    recommendations.push('Embedding system appears healthy - no immediate action needed');
  }

  return recommendations;
}
