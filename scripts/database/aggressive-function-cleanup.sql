-- Aggressive Function Cleanup and Recreation
-- This script removes ALL unified_search functions and recreates them properly

-- Drop ALL unified_search functions regardless of signature
DO $$
DECLARE
    func_record RECORD;
    drop_statement TEXT;
BEGIN
    -- Find and drop all unified_search functions
    FOR func_record IN 
        SELECT 
            p.proname,
            pg_get_function_identity_arguments(p.oid) as args,
            p.oid
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'unified_search'
    LOOP
        drop_statement := 'DROP FUNCTION IF EXISTS public.unified_search(' || func_record.args || ') CASCADE';
        RAISE NOTICE 'Executing: %', drop_statement;
        EXECUTE drop_statement;
    END LOOP;
    
    RAISE NOTICE 'All unified_search functions have been dropped';
END
$$;

-- Now create the unified search function with a clean slate
CREATE FUNCTION unified_search(
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

-- Create the missing stats functions
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

-- Create the unified search stats function
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION unified_search TO authenticated;
GRANT EXECUTE ON FUNCTION get_embedding_migration_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_unified_search_stats TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '=== AGGRESSIVE CLEANUP COMPLETED ===';
    RAISE NOTICE 'All unified_search functions dropped and recreated';
    RAISE NOTICE 'Missing stats functions created';
    RAISE NOTICE 'Run diagnostics again to verify success';
END
$$;
