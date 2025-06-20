-- Apply Embedding System Migrations
-- Run this script to set up the embedding system if migrations haven't been applied

-- First, check if unified_embeddings table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'unified_embeddings') THEN
        RAISE NOTICE 'Creating unified_embeddings table...';
        
        -- Create unified_embeddings table
        CREATE TABLE unified_embeddings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            source_type TEXT NOT NULL,
            source_id UUID NOT NULL,
            content_type TEXT NOT NULL,
            content_text TEXT,
            embedding VECTOR(1536),
            metadata JSONB DEFAULT '{}',
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            team_id UUID,
            language TEXT DEFAULT 'en',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Create indexes
        CREATE INDEX idx_unified_embeddings_source ON unified_embeddings(source_type, source_id);
        CREATE INDEX idx_unified_embeddings_content_type ON unified_embeddings(content_type);
        CREATE INDEX idx_unified_embeddings_user ON unified_embeddings(user_id);
        CREATE INDEX idx_unified_embeddings_team ON unified_embeddings(team_id);
        CREATE INDEX idx_unified_embeddings_created ON unified_embeddings(created_at);

        -- Enable RLS
        ALTER TABLE unified_embeddings ENABLE ROW LEVEL SECURITY;

        -- Create RLS policies
        CREATE POLICY "Users can view their own embeddings" ON unified_embeddings
            FOR SELECT USING (auth.uid() = user_id);

        CREATE POLICY "Users can insert their own embeddings" ON unified_embeddings
            FOR INSERT WITH CHECK (auth.uid() = user_id);

        CREATE POLICY "Users can update their own embeddings" ON unified_embeddings
            FOR UPDATE USING (auth.uid() = user_id);

        CREATE POLICY "Users can delete their own embeddings" ON unified_embeddings
            FOR DELETE USING (auth.uid() = user_id);

        RAISE NOTICE 'unified_embeddings table created successfully';
    ELSE
        RAISE NOTICE 'unified_embeddings table already exists';
    END IF;
END
$$;

-- Create unified search function
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

-- Create migration stats function
CREATE OR REPLACE FUNCTION get_embedding_migration_stats()
RETURNS TABLE (
  total_receipts BIGINT,
  receipts_with_old_embeddings BIGINT,
  receipts_with_unified_embeddings BIGINT,
  receipts_missing_embeddings BIGINT,
  migration_needed BOOLEAN
)
LANGUAGE plpgsql
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

-- Create function to find receipts missing embeddings
CREATE OR REPLACE FUNCTION find_receipts_missing_embeddings(limit_count INT DEFAULT 10)
RETURNS TABLE (
  receipt_id UUID,
  merchant TEXT,
  date DATE,
  missing_content_types TEXT[]
)
LANGUAGE plpgsql
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

-- Create unified search stats function
CREATE OR REPLACE FUNCTION get_unified_search_stats()
RETURNS TABLE (
  source_type TEXT,
  content_type TEXT,
  total_embeddings BIGINT,
  avg_content_length NUMERIC,
  latest_created TIMESTAMPTZ
)
LANGUAGE plpgsql
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
GRANT EXECUTE ON FUNCTION find_receipts_missing_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION get_unified_search_stats TO authenticated;

-- Create embedding content health view
CREATE OR REPLACE VIEW embedding_content_health AS
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
    RAISE NOTICE 'Embedding system migrations applied successfully!';
    RAISE NOTICE 'You can now test the embedding system functionality.';
END
$$;
