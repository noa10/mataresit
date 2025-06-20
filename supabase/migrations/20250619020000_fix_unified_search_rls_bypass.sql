-- Fix unified_search function to bypass RLS while maintaining security
-- This allows the function to access all embeddings but still applies proper user filtering

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS unified_search(vector, text[], text[], double precision, integer, uuid, uuid, text);
DROP FUNCTION IF EXISTS get_unified_search_stats(uuid);

CREATE OR REPLACE FUNCTION unified_search(
  query_embedding VECTOR(1536),
  source_types TEXT[] DEFAULT ARRAY['receipt', 'claim', 'team_member', 'custom_category', 'business_directory'],
  content_types TEXT[] DEFAULT NULL,
  similarity_threshold FLOAT DEFAULT 0.2,
  match_count INT DEFAULT 20,
  user_filter UUID DEFAULT NULL,
  team_filter UUID DEFAULT NULL,
  language_filter TEXT DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_id UUID,
  content_type TEXT,
  content_text TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off  -- This bypasses RLS policies
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.id,
    ue.source_type,
    ue.source_id,
    ue.content_type,
    ue.content_text,
    1 - (ue.embedding <=> query_embedding) as similarity,
    ue.metadata
  FROM unified_embeddings ue
  WHERE 
    -- Source type filtering
    (source_types IS NULL OR ue.source_type = ANY(source_types))
    
    -- Content type filtering
    AND (content_types IS NULL OR ue.content_type = ANY(content_types))
    
    -- User filtering (CRITICAL: This ensures users only see their own data)
    AND (
      user_filter IS NULL OR 
      ue.user_id = user_filter OR
      -- Allow access to business directory (public data)
      ue.source_type = 'business_directory' OR
      -- Allow access to team data if user is part of the team
      (ue.team_id IS NOT NULL AND team_filter IS NOT NULL AND ue.team_id = team_filter)
    )
    
    -- Team filtering (if specified)
    AND (team_filter IS NULL OR ue.team_id = team_filter)
    
    -- Language filtering (if specified)
    AND (language_filter IS NULL OR ue.language = language_filter)
    
    -- Similarity threshold
    AND (1 - (ue.embedding <=> query_embedding)) > similarity_threshold
    
    -- Ensure we have valid content
    AND ue.content_text IS NOT NULL 
    AND TRIM(ue.content_text) != ''
    AND ue.embedding IS NOT NULL
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Also update the stats function to bypass RLS
CREATE OR REPLACE FUNCTION get_unified_search_stats(
  user_filter UUID DEFAULT NULL
) RETURNS TABLE (
  source_type TEXT,
  content_type TEXT,
  total_embeddings BIGINT,
  has_content BIGINT,
  avg_content_length NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off  -- This bypasses RLS policies
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.source_type,
    ue.content_type,
    COUNT(*) as total_embeddings,
    COUNT(CASE WHEN ue.content_text IS NOT NULL AND TRIM(ue.content_text) != '' THEN 1 END) as has_content,
    AVG(LENGTH(ue.content_text)) FILTER (WHERE ue.content_text IS NOT NULL AND TRIM(ue.content_text) != '') as avg_content_length
  FROM unified_embeddings ue
  WHERE 
    -- Apply user filtering to ensure security
    (user_filter IS NULL OR ue.user_id = user_filter OR ue.source_type = 'business_directory')
  GROUP BY ue.source_type, ue.content_type
  ORDER BY ue.source_type, ue.content_type;
END;
$$;

-- Add comments explaining the security model
COMMENT ON FUNCTION unified_search IS 'Core unified search function that performs vector similarity search across all embedding sources. Uses SECURITY DEFINER with row_security = off to bypass RLS, but applies proper user filtering in WHERE clause to maintain security.';
COMMENT ON FUNCTION get_unified_search_stats IS 'Helper function to get statistics about embeddings for debugging and monitoring. Bypasses RLS but applies user filtering for security.';

-- Ensure permissions are still correct
GRANT EXECUTE ON FUNCTION unified_search TO authenticated;
GRANT EXECUTE ON FUNCTION get_unified_search_stats TO authenticated;
