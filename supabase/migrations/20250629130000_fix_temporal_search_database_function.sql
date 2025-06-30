-- Fix Temporal Search Issues - Database Function Update
-- This migration addresses critical temporal search accuracy issues by:
-- 1. Adding date and amount filtering parameters to unified_search function
-- 2. Implementing proper JOIN with receipts table for temporal filtering
-- 3. Ensuring consistent date range filtering for receipt searches

-- Drop and recreate the unified_search function with temporal filtering support
DROP FUNCTION IF EXISTS unified_search(
  VECTOR(1536), TEXT[], TEXT[], FLOAT, INT, UUID, UUID, TEXT
);

-- Create the enhanced unified_search function with temporal filtering
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
  -- Log the temporal search parameters for debugging
  RAISE LOG 'unified_search called with temporal filters: start_date=%, end_date=%, min_amount=%, max_amount=%', 
    start_date, end_date, min_amount, max_amount;

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
  -- Join with receipts table for date/amount filtering when searching receipts
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
    
    -- Date range filtering for receipts (CRITICAL FIX)
    AND (
      ue.source_type != 'receipt' OR 
      (start_date IS NULL OR r.date >= start_date) AND
      (end_date IS NULL OR r.date <= end_date)
    )
    
    -- Amount range filtering for receipts
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
    
    -- Ensure receipts exist when filtering by date/amount
    AND (ue.source_type != 'receipt' OR r.id IS NOT NULL)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Update function comment
COMMENT ON FUNCTION unified_search IS 'Enhanced unified search function with temporal and amount filtering support for accurate receipt date searches';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION unified_search TO authenticated;
GRANT EXECUTE ON FUNCTION unified_search TO anon;

-- Create index to optimize the new JOIN operation
CREATE INDEX IF NOT EXISTS idx_unified_embeddings_receipt_source 
ON unified_embeddings (source_type, source_id) 
WHERE source_type = 'receipt';

-- Create index for receipt date filtering performance
CREATE INDEX IF NOT EXISTS idx_receipts_date_total_performance
ON receipts (date, total, id);

-- Add a helper function to test temporal search functionality
CREATE OR REPLACE FUNCTION test_temporal_search(
  test_query TEXT DEFAULT 'test',
  test_start_date DATE DEFAULT NULL,
  test_end_date DATE DEFAULT NULL
) RETURNS TABLE (
  total_results BIGINT,
  date_range_info TEXT,
  sample_dates DATE[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  dummy_embedding VECTOR(1536);
  result_count BIGINT;
  sample_receipt_dates DATE[];
BEGIN
  -- Create a dummy embedding for testing
  dummy_embedding := array_fill(0.1, ARRAY[1536])::VECTOR(1536);
  
  -- Count results with temporal filtering
  SELECT COUNT(*) INTO result_count
  FROM unified_search(
    dummy_embedding,
    ARRAY['receipt'],
    NULL,
    0.0, -- Very low threshold to get all results
    1000,
    NULL, NULL, NULL,
    test_start_date,
    test_end_date
  );
  
  -- Get sample dates from actual receipts in the range
  SELECT ARRAY_AGG(DISTINCT r.date ORDER BY r.date LIMIT 10) INTO sample_receipt_dates
  FROM receipts r
  WHERE (test_start_date IS NULL OR r.date >= test_start_date)
    AND (test_end_date IS NULL OR r.date <= test_end_date);
  
  RETURN QUERY SELECT 
    result_count,
    CASE 
      WHEN test_start_date IS NOT NULL AND test_end_date IS NOT NULL THEN 
        'Date range: ' || test_start_date::TEXT || ' to ' || test_end_date::TEXT
      WHEN test_start_date IS NOT NULL THEN 
        'From: ' || test_start_date::TEXT
      WHEN test_end_date IS NOT NULL THEN 
        'Until: ' || test_end_date::TEXT
      ELSE 'No date filter'
    END,
    COALESCE(sample_receipt_dates, ARRAY[]::DATE[]);
END;
$$;

COMMENT ON FUNCTION test_temporal_search IS 'Helper function to test and debug temporal search functionality';
GRANT EXECUTE ON FUNCTION test_temporal_search TO authenticated;
