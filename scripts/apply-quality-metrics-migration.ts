#!/usr/bin/env deno run --allow-env --allow-net

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzAxMjM4OSwiZXhwIjoyMDU4NTg4Mzg5fQ.o6Xn7TTIYF4U9zAOhGWVf5MoAcl_BGPtQ_BRcR2xV0o';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyQualityMetricsMigration() {
  console.log('🚀 Applying embedding_quality_metrics migration...');
  
  const migrationSQL = `
-- Create embedding quality metrics table for tracking AI vision embedding performance
CREATE TABLE IF NOT EXISTS public.embedding_quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  total_content_types INTEGER NOT NULL DEFAULT 0,
  successful_embeddings INTEGER NOT NULL DEFAULT 0,
  failed_embeddings INTEGER NOT NULL DEFAULT 0,
  synthetic_content_used BOOLEAN NOT NULL DEFAULT FALSE,
  overall_quality_score INTEGER NOT NULL DEFAULT 0 CHECK (overall_quality_score >= 0 AND overall_quality_score <= 100),
  processing_method TEXT NOT NULL CHECK (processing_method IN ('enhanced', 'fallback', 'legacy')),
  content_quality_scores JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_embedding_quality_metrics_receipt_id 
ON public.embedding_quality_metrics (receipt_id);

CREATE INDEX IF NOT EXISTS idx_embedding_quality_metrics_processing_method 
ON public.embedding_quality_metrics (processing_method);

CREATE INDEX IF NOT EXISTS idx_embedding_quality_metrics_quality_score 
ON public.embedding_quality_metrics (overall_quality_score);

CREATE INDEX IF NOT EXISTS idx_embedding_quality_metrics_created_at 
ON public.embedding_quality_metrics (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_embedding_quality_metrics_synthetic_content 
ON public.embedding_quality_metrics (synthetic_content_used);

-- Enable RLS
ALTER TABLE embedding_quality_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own quality metrics" ON embedding_quality_metrics
FOR SELECT USING (
  receipt_id IN (
    SELECT id FROM receipts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own quality metrics" ON embedding_quality_metrics
FOR INSERT WITH CHECK (
  receipt_id IN (
    SELECT id FROM receipts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own quality metrics" ON embedding_quality_metrics
FOR UPDATE USING (
  receipt_id IN (
    SELECT id FROM receipts WHERE user_id = auth.uid()
  )
);
`;

  try {
    // Execute the migration SQL directly
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({ sql: migrationSQL })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Migration failed:', error);
      return false;
    }

    console.log('✅ embedding_quality_metrics migration applied successfully');
    return true;
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Applying Quality Metrics Migration');
  console.log('====================================');
  
  const success = await applyQualityMetricsMigration();
  
  if (success) {
    console.log('✅ Migration completed successfully');
    Deno.exit(0);
  } else {
    console.log('❌ Migration failed');
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
