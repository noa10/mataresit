-- Fix Enhanced Hybrid Search: Add text-only version for frontend compatibility
-- This migration creates a text-only version of enhanced_hybrid_search that can be called
-- without requiring vector embeddings, which matches the frontend call signature

-- Create a text-only version of enhanced_hybrid_search that matches frontend calls
CREATE OR REPLACE FUNCTION enhanced_hybrid_search(
  query_text TEXT,
  source_types TEXT[] DEFAULT ARRAY['receipt', 'claim', 'team_member', 'custom_category', 'business_directory'],
  similarity_threshold FLOAT DEFAULT 0.2,
  match_count INT DEFAULT 20,
  user_filter UUID DEFAULT NULL,
  team_filter UUID DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_id UUID,
  content_type TEXT,
  content_text TEXT,
  similarity FLOAT,
  trigram_similarity FLOAT,
  keyword_score FLOAT,
  combined_score FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH combined_results AS (
    SELECT 
      ue.id,
      ue.source_type,
      ue.source_id,
      ue.content_type,
      ue.content_text,
      -- For text-only search, use trigram similarity as primary similarity
      GREATEST(0, similarity(ue.content_text, query_text)) as semantic_sim,
      -- Trigram similarity for fuzzy matching
      GREATEST(0, similarity(ue.content_text, query_text)) as trigram_sim,
      -- Keyword matching score (simple text search)
      CASE 
        WHEN ue.content_text ILIKE '%' || query_text || '%' THEN 1.0
        WHEN ue.content_text ILIKE '%' || split_part(query_text, ' ', 1) || '%' THEN 0.7
        WHEN ue.content_text ILIKE '%' || split_part(query_text, ' ', -1) || '%' THEN 0.7
        ELSE 0.0
      END as keyword_sc,
      ue.metadata
    FROM unified_embeddings ue
    -- Join with receipts for amount filtering
    LEFT JOIN receipts r ON (ue.source_type = 'receipt' AND ue.source_id = r.id)
    WHERE 
      -- Source type filtering
      (source_types IS NULL OR ue.source_type = ANY(source_types))
      
      -- User filtering (if specified)
      AND (user_filter IS NULL OR ue.user_id = user_filter)
      
      -- Team filtering (if specified)
      AND (team_filter IS NULL OR ue.team_id = team_filter)
      
      -- Ensure we have valid content
      AND ue.content_text IS NOT NULL 
      AND TRIM(ue.content_text) != ''
  )
  
  SELECT 
    cr.id,
    cr.source_type,
    cr.source_id,
    cr.content_type,
    cr.content_text,
    cr.semantic_sim as similarity,
    cr.trigram_sim as trigram_similarity,
    cr.keyword_sc as keyword_score,
    -- Combined weighted score (equal weights for text-only search)
    (cr.semantic_sim * 0.4) + 
    (cr.trigram_sim * 0.3) + 
    (cr.keyword_sc * 0.3) as combined_score,
    cr.metadata
  FROM combined_results cr
  WHERE
    -- Ensure at least one search method found a match above threshold
    (cr.semantic_sim > similarity_threshold OR
     cr.trigram_sim > similarity_threshold OR
     cr.keyword_sc > 0.01)
  ORDER BY 
    -- Primary sort by combined score
    combined_score DESC,
    -- Secondary sort by trigram similarity
    cr.trigram_sim DESC,
    -- Tertiary sort by keyword score
    cr.keyword_sc DESC
  LIMIT match_count;
END;
$$;

-- Update function comment
COMMENT ON FUNCTION enhanced_hybrid_search(text, text[], float, int, uuid, uuid) IS 'Text-only enhanced hybrid search for frontend compatibility';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION enhanced_hybrid_search(text, text[], float, int, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION enhanced_hybrid_search(text, text[], float, int, uuid, uuid) TO anon;

-- Log the migration
INSERT INTO migration_log (migration_name, description, applied_at)
VALUES (
  '20250713000000_fix_enhanced_hybrid_search_text_only',
  'Added text-only version of enhanced_hybrid_search function for frontend compatibility',
  NOW()
) ON CONFLICT (migration_name) DO NOTHING;
