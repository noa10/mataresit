-- Fix Enhanced Hybrid Search: Add receipt_ids_filter parameter
-- This migration adds the missing receipt_ids_filter parameter to enhanced_hybrid_search
-- to enable proper temporal search filtering

-- Drop the existing function to recreate with new signature
DROP FUNCTION IF EXISTS enhanced_hybrid_search(
  vector, text, text[], text[], float, float, float, float, float, int, uuid, uuid, text, float, float, text
);

-- Enhanced hybrid search function with receipt_ids_filter support
CREATE OR REPLACE FUNCTION enhanced_hybrid_search(
  query_embedding VECTOR(1536),
  query_text TEXT,
  source_types TEXT[] DEFAULT ARRAY['receipt', 'claim', 'team_member', 'custom_category', 'business_directory'],
  content_types TEXT[] DEFAULT NULL,
  similarity_threshold FLOAT DEFAULT 0.2,
  trigram_threshold FLOAT DEFAULT 0.3,
  semantic_weight FLOAT DEFAULT 0.6,
  keyword_weight FLOAT DEFAULT 0.25,
  trigram_weight FLOAT DEFAULT 0.15,
  match_count INT DEFAULT 20,
  user_filter UUID DEFAULT NULL,
  team_filter UUID DEFAULT NULL,
  language_filter TEXT DEFAULT NULL,
  amount_min FLOAT DEFAULT NULL,
  amount_max FLOAT DEFAULT NULL,
  amount_currency TEXT DEFAULT NULL,
  -- NEW: Receipt IDs filter for temporal search
  receipt_ids_filter UUID[] DEFAULT NULL
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
  -- Validate weights sum to approximately 1.0
  IF ABS((semantic_weight + keyword_weight + trigram_weight) - 1.0) > 0.01 THEN
    RAISE EXCEPTION 'Weights must sum to approximately 1.0. Current sum: %', 
      (semantic_weight + keyword_weight + trigram_weight);
  END IF;

  RETURN QUERY
  WITH combined_results AS (
    SELECT 
      ue.id,
      ue.source_type,
      ue.source_id,
      ue.content_type,
      ue.content_text,
      -- Semantic similarity (vector distance)
      GREATEST(0, 1 - (ue.embedding <=> query_embedding)) as semantic_sim,
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
    -- Join with receipts for amount filtering and receipt ID filtering
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
      
      -- Amount filtering (only for receipts)
      AND (ue.source_type != 'receipt' OR r.id IS NOT NULL)
      AND (amount_min IS NULL OR ue.source_type != 'receipt' OR r.total >= amount_min)
      AND (amount_max IS NULL OR ue.source_type != 'receipt' OR r.total <= amount_max)
      AND (amount_currency IS NULL OR ue.source_type != 'receipt' OR r.currency = amount_currency)
      
      -- 🔧 NEW: Receipt IDs filtering for temporal search
      AND (receipt_ids_filter IS NULL OR ue.source_type != 'receipt' OR ue.source_id = ANY(receipt_ids_filter))
      
      -- Ensure we have valid content and embeddings
      AND ue.content_text IS NOT NULL 
      AND TRIM(ue.content_text) != ''
      AND ue.embedding IS NOT NULL
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
    -- Combined weighted score
    (cr.semantic_sim * semantic_weight) + 
    (cr.trigram_sim * trigram_weight) + 
    (cr.keyword_sc * keyword_weight) as combined_score,
    cr.metadata
  FROM combined_results cr
  WHERE
    -- Ensure at least one search method found a match above threshold
    (cr.semantic_sim > similarity_threshold OR
     cr.trigram_sim > trigram_threshold OR
     cr.keyword_sc > 0.01)
  ORDER BY 
    -- Primary sort by combined score
    combined_score DESC,
    -- Secondary sort by semantic similarity
    cr.semantic_sim DESC,
    -- Tertiary sort by trigram similarity
    cr.trigram_sim DESC
  LIMIT match_count;
END;
$$;

-- Update function comment
COMMENT ON FUNCTION enhanced_hybrid_search IS 'Enhanced hybrid search with receipt_ids_filter support for temporal search queries';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION enhanced_hybrid_search TO authenticated;
GRANT EXECUTE ON FUNCTION enhanced_hybrid_search TO anon;

-- Create index to optimize receipt ID filtering if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_unified_embeddings_source_id_receipt 
ON unified_embeddings (source_id) 
WHERE source_type = 'receipt';

-- Log the migration
INSERT INTO migration_log (migration_name, description, applied_at)
VALUES (
  '20250629160000_fix_enhanced_hybrid_search_receipt_filter',
  'Added receipt_ids_filter parameter to enhanced_hybrid_search function for temporal search support',
  NOW()
) ON CONFLICT (migration_name) DO NOTHING;
