-- Fix Embedding System Migrations
-- This script handles the function name conflict and ensures proper setup

-- First, let's check what unified_search functions already exist
DO $$
DECLARE
    func_record RECORD;
BEGIN
    RAISE NOTICE 'Checking existing unified_search functions...';
    
    FOR func_record IN 
        SELECT 
            p.proname,
            pg_get_function_identity_arguments(p.oid) as args,
            p.oid
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'unified_search'
    LOOP
        RAISE NOTICE 'Found function: unified_search(%) with OID: %', func_record.args, func_record.oid;
    END LOOP;
END
$$;

-- Drop existing unified_search functions to avoid conflicts
DROP FUNCTION IF EXISTS unified_search(vector, float, int, text[], text[], uuid, uuid);
DROP FUNCTION IF EXISTS unified_search(vector, float, int);
DROP FUNCTION IF EXISTS unified_search(vector);

-- Create the unified search function with proper signature
CREATE OR REPLACE FUNCTION unified_search(
  query_embedding VECTOR(1536),
  similarity_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10,
  source_types TEXT[] DEFAULT NULL,
  content_types TEXT[] DEFAULT NULL,
  user_filter UUID DEFAULT NULL,
  team_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_id UUID,
  content_type TEXT,
  content_text TEXT,
  similarity FLOAT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.id,
    ue.source_type,
    ue.source_id,
    ue.content_type,
    ue.content_text,
    (1 - (ue.embedding <=> query_embedding)) AS similarity,
    ue.metadata,
    ue.created_at
  FROM unified_embeddings ue
  WHERE 
    (1 - (ue.embedding <=> query_embedding)) > similarity_threshold
    AND (source_types IS NULL OR ue.source_type = ANY(source_types))
    AND (content_types IS NULL OR ue.content_type = ANY(content_types))
    AND (user_filter IS NULL OR ue.user_id = user_filter)
    AND (team_filter IS NULL OR ue.team_id = team_filter)
    AND (auth.uid() = ue.user_id OR ue.user_id IS NULL)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Create or replace migration stats function
CREATE OR REPLACE FUNCTION get_embedding_migration_stats()
RETURNS TABLE (
  total_receipts BIGINT,
  receipts_with_old_embeddings BIGINT,
  receipts_with_unified_embeddings BIGINT,
  receipts_missing_embeddings BIGINT,
  migration_needed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_count BIGINT;
  old_embedding_count BIGINT;
  unified_embedding_count BIGINT;
  missing_count BIGINT;
BEGIN
  -- Get total receipts
  SELECT COUNT(*) INTO total_count FROM receipts;
  
  -- Get receipts with old embeddings
  SELECT COUNT(DISTINCT receipt_id) INTO old_embedding_count 
  FROM receipt_embeddings;
  
  -- Get receipts with unified embeddings
  SELECT COUNT(DISTINCT source_id) INTO unified_embedding_count 
  FROM unified_embeddings 
  WHERE source_type = 'receipt';
  
  -- Calculate missing
  missing_count := total_count - unified_embedding_count;
  
  RETURN QUERY SELECT 
    total_count,
    old_embedding_count,
    unified_embedding_count,
    missing_count,
    (old_embedding_count > 0 AND unified_embedding_count < old_embedding_count) AS migration_needed;
END;
$$;

-- Create or replace function to find receipts missing embeddings
CREATE OR REPLACE FUNCTION find_receipts_missing_embeddings(limit_count INT DEFAULT 10)
RETURNS TABLE (
  receipt_id UUID,
  merchant TEXT,
  date DATE,
  missing_content_types TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.merchant,
    r.date,
    ARRAY['full_text', 'merchant', 'notes'] AS missing_content_types
  FROM receipts r
  LEFT JOIN unified_embeddings ue ON ue.source_id = r.id AND ue.source_type = 'receipt'
  WHERE ue.id IS NULL
    AND (auth.uid() = r.user_id OR r.user_id IS NULL)
  ORDER BY r.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Create or replace unified search stats function
CREATE OR REPLACE FUNCTION get_unified_search_stats()
RETURNS TABLE (
  source_type TEXT,
  content_type TEXT,
  total_embeddings BIGINT,
  avg_content_length NUMERIC,
  latest_created TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.source_type,
    ue.content_type,
    COUNT(*) as total_embeddings,
    AVG(LENGTH(ue.content_text)) as avg_content_length,
    MAX(ue.created_at) as latest_created
  FROM unified_embeddings ue
  WHERE auth.uid() = ue.user_id OR ue.user_id IS NULL
  GROUP BY ue.source_type, ue.content_type
  ORDER BY ue.source_type, ue.content_type;
END;
$$;

-- Create function to migrate receipt embeddings to unified format
CREATE OR REPLACE FUNCTION migrate_receipt_embeddings_to_unified()
RETURNS TABLE (
  migrated_count BIGINT,
  skipped_count BIGINT,
  error_count BIGINT,
  total_processed BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  migrated BIGINT := 0;
  skipped BIGINT := 0;
  errors BIGINT := 0;
  total BIGINT := 0;
  rec RECORD;
  receipt_data RECORD;
BEGIN
  -- Process old receipt embeddings
  FOR rec IN 
    SELECT DISTINCT re.receipt_id, re.user_id
    FROM receipt_embeddings re
    LEFT JOIN unified_embeddings ue ON ue.source_id = re.receipt_id AND ue.source_type = 'receipt'
    WHERE ue.id IS NULL
  LOOP
    BEGIN
      total := total + 1;
      
      -- Get receipt data
      SELECT r.merchant, r."fullText", r.notes
      INTO receipt_data
      FROM receipts r
      WHERE r.id = rec.receipt_id;
      
      IF NOT FOUND THEN
        errors := errors + 1;
        CONTINUE;
      END IF;
      
      -- Insert unified embeddings for different content types
      -- Full text embedding
      IF receipt_data."fullText" IS NOT NULL AND TRIM(receipt_data."fullText") != '' THEN
        INSERT INTO unified_embeddings (
          source_type, source_id, content_type, content_text, 
          user_id, created_at, updated_at
        ) VALUES (
          'receipt', rec.receipt_id, 'full_text', receipt_data."fullText",
          rec.user_id, NOW(), NOW()
        ) ON CONFLICT (source_type, source_id, content_type) DO NOTHING;
      END IF;
      
      -- Merchant embedding
      IF receipt_data.merchant IS NOT NULL AND TRIM(receipt_data.merchant) != '' THEN
        INSERT INTO unified_embeddings (
          source_type, source_id, content_type, content_text,
          user_id, created_at, updated_at
        ) VALUES (
          'receipt', rec.receipt_id, 'merchant', receipt_data.merchant,
          rec.user_id, NOW(), NOW()
        ) ON CONFLICT (source_type, source_id, content_type) DO NOTHING;
      END IF;
      
      -- Notes embedding
      IF receipt_data.notes IS NOT NULL AND TRIM(receipt_data.notes) != '' THEN
        INSERT INTO unified_embeddings (
          source_type, source_id, content_type, content_text,
          user_id, created_at, updated_at
        ) VALUES (
          'receipt', rec.receipt_id, 'notes', receipt_data.notes,
          rec.user_id, NOW(), NOW()
        ) ON CONFLICT (source_type, source_id, content_type) DO NOTHING;
      END IF;
      
      migrated := migrated + 1;
      
    EXCEPTION WHEN OTHERS THEN
      errors := errors + 1;
    END;
  END LOOP;
  
  RETURN QUERY SELECT migrated, skipped, errors, total;
END;
$$;

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_unified_embedding'
    ) THEN
        ALTER TABLE unified_embeddings 
        ADD CONSTRAINT unique_unified_embedding 
        UNIQUE (source_type, source_id, content_type);
        RAISE NOTICE 'Added unique constraint to unified_embeddings';
    ELSE
        RAISE NOTICE 'Unique constraint already exists on unified_embeddings';
    END IF;
END
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION unified_search TO authenticated;
GRANT EXECUTE ON FUNCTION get_embedding_migration_stats TO authenticated;
GRANT EXECUTE ON FUNCTION find_receipts_missing_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION get_unified_search_stats TO authenticated;
GRANT EXECUTE ON FUNCTION migrate_receipt_embeddings_to_unified TO authenticated;

-- Create or replace embedding content health view
DROP VIEW IF EXISTS embedding_content_health;
CREATE VIEW embedding_content_health AS
SELECT 
  source_type,
  content_type,
  COUNT(*) as total_embeddings,
  COUNT(CASE WHEN content_text IS NULL OR TRIM(content_text) = '' THEN 1 END) as empty_content,
  COUNT(CASE WHEN content_text IS NOT NULL AND TRIM(content_text) != '' THEN 1 END) as has_content,
  ROUND(
    (COUNT(CASE WHEN content_text IS NOT NULL AND TRIM(content_text) != '' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100, 
    2
  ) as content_health_percentage
FROM unified_embeddings
GROUP BY source_type, content_type
ORDER BY source_type, content_type;

GRANT SELECT ON embedding_content_health TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '=== EMBEDDING SYSTEM MIGRATION COMPLETED ===';
    RAISE NOTICE 'Fixed function conflicts and created all required functions';
    RAISE NOTICE 'You can now test the embedding system functionality';
    RAISE NOTICE 'Run the diagnostics again to verify all functions work';
END
$$;
