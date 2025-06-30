-- Create the missing unified_search database function
-- This function is critical for the AI search functionality to work

-- First, ensure the unified_embeddings table exists with proper structure
CREATE TABLE IF NOT EXISTS public.unified_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL, -- 'receipt', 'claim', 'team_member', 'custom_category', 'business_directory', 'conversation'
  source_id UUID NOT NULL, -- References the actual record ID
  content_type TEXT NOT NULL, -- 'full_text', 'title', 'description', 'merchant', 'line_items', 'profile', 'keywords'
  content_text TEXT NOT NULL, -- The actual text that was embedded
  embedding VECTOR(1536), -- Gemini embedding
  metadata JSONB DEFAULT '{}', -- Additional context and search hints
  user_id UUID, -- For access control and filtering
  team_id UUID, -- For team-scoped searches
  language TEXT DEFAULT 'en', -- For i18n support (en/ms)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create essential indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_unified_embeddings_vector_search 
ON unified_embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_unified_embeddings_source_type 
ON unified_embeddings (source_type, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_unified_embeddings_team_scope 
ON unified_embeddings (team_id, source_type, created_at DESC) 
WHERE team_id IS NOT NULL;

-- Enable RLS if not already enabled
ALTER TABLE unified_embeddings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies if they don't exist
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS unified_embeddings_user_access ON unified_embeddings;
  DROP POLICY IF EXISTS unified_embeddings_team_access ON unified_embeddings;
  
  -- User-scoped content policy
  CREATE POLICY unified_embeddings_user_access ON unified_embeddings
  FOR ALL USING (
    user_id = auth.uid() OR
    (source_type = 'business_directory') -- Public business directory
  );
  
  -- Team-scoped content policy
  CREATE POLICY unified_embeddings_team_access ON unified_embeddings
  FOR ALL USING (
    user_id = auth.uid() OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members 
      WHERE team_id = unified_embeddings.team_id 
      AND user_id = auth.uid()
    )) OR
    (source_type = 'business_directory')
  );
END $$;

-- Create the core unified_search function with temporal filtering support
CREATE OR REPLACE FUNCTION unified_search(
  query_embedding VECTOR(1536),
  source_types TEXT[] DEFAULT ARRAY['receipt', 'claim', 'team_member', 'custom_category', 'business_directory'],
  content_types TEXT[] DEFAULT NULL,
  similarity_threshold FLOAT DEFAULT 0.2,
  match_count INT DEFAULT 20,
  user_filter UUID DEFAULT NULL,
  team_filter UUID DEFAULT NULL,
  language_filter TEXT DEFAULT NULL,
  -- NEW: Date filtering parameters for temporal search
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  -- NEW: Amount filtering parameters
  min_amount NUMERIC DEFAULT NULL,
  max_amount NUMERIC DEFAULT NULL
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
  -- NEW: Join with receipts table for date/amount filtering when searching receipts
  LEFT JOIN receipts r ON (ue.source_type = 'receipt' AND ue.source_id = r.id)
  WHERE
    -- Source type filtering
    (source_types IS NULL OR ue.source_type = ANY(source_types))

    -- Content type filtering
    AND (content_types IS NULL OR ue.content_type = ANY(content_types))

    -- User filtering (if specified)
    AND (user_filter IS NULL OR ue.user_id = user_filter)

    -- Team filtering (if specified)
    AND (team_filter IS NULL OR ue.team_id = team_filter)

    -- Language filtering (if specified)
    AND (language_filter IS NULL OR ue.language = language_filter)

    -- NEW: Date range filtering for receipts
    AND (
      ue.source_type != 'receipt' OR
      (start_date IS NULL OR r.date >= start_date) AND
      (end_date IS NULL OR r.date <= end_date)
    )

    -- NEW: Amount range filtering for receipts
    AND (
      ue.source_type != 'receipt' OR
      (min_amount IS NULL OR r.total >= min_amount) AND
      (max_amount IS NULL OR r.total <= max_amount)
    )

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

-- Create a helper function to get search statistics
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
    (user_filter IS NULL OR ue.user_id = user_filter)
  GROUP BY ue.source_type, ue.content_type
  ORDER BY ue.source_type, ue.content_type;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION unified_search IS 'Core unified search function that performs vector similarity search across all embedding sources with temporal and amount filtering support';
COMMENT ON FUNCTION get_unified_search_stats IS 'Helper function to get statistics about embeddings for debugging and monitoring';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION unified_search TO authenticated;
GRANT EXECUTE ON FUNCTION get_unified_search_stats TO authenticated;
