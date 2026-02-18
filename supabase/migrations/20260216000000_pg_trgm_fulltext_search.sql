-- Hybrid Search with PostgreSQL Full-Text Search (ts_rank) and pg_trgm
-- This migration adds a dedicated hybrid_search function combining vector similarity
-- with full-text search ranking using ts_rank, and improves the text-only search

-- Create hybrid_search function combining vector similarity with full-text search using ts_rank
CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding VECTOR(1536),
  query_text TEXT,
  source_types TEXT[] DEFAULT ARRAY['receipt', 'claim', 'team_member', 'custom_category', 'business_directory'],
  content_types TEXT[] DEFAULT NULL,
  similarity_threshold FLOAT DEFAULT 0.2,
  text_rank_weight FLOAT DEFAULT 0.3,
  semantic_weight FLOAT DEFAULT 0.7,
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
  text_rank FLOAT,
  combined_score FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- Semantic vector search results
  semantic_results AS (
    SELECT 
      ue.id,
      ue.source_type,
      ue.source_id,
      ue.content_type,
      ue.content_text,
      1 - (ue.embedding <=> query_embedding) as semantic_sim,
      0.0 as text_rank,
      ue.metadata
    FROM unified_embeddings ue
    WHERE 
      (source_types IS NULL OR ue.source_type = ANY(source_types))
      AND (content_types IS NULL OR ue.content_type = ANY(content_types))
      AND (user_filter IS NULL OR ue.user_id = user_filter)
      AND (team_filter IS NULL OR ue.team_id = team_filter)
      AND (language_filter IS NULL OR ue.language = language_filter)
      AND (1 - (ue.embedding <=> query_embedding)) > similarity_threshold
      AND ue.content_text IS NOT NULL 
      AND TRIM(ue.content_text) != ''
      AND ue.embedding IS NOT NULL
  ),
  
  -- Full-text search results using PostgreSQL ts_rank
  text_results AS (
    SELECT 
      ue.id,
      ue.source_type,
      ue.source_id,
      ue.content_type,
      ue.content_text,
      0.0 as semantic_sim,
      ts_rank_cd(to_tsvector('english', coalesce(ue.content_text, '')), plainto_tsquery('english', coalesce(query_text, ''))) as text_rank,
      ue.metadata
    FROM unified_embeddings ue
    WHERE 
      query_text IS NOT NULL 
      AND query_text != ''
      AND (source_types IS NULL OR ue.source_type = ANY(source_types))
      AND (content_types IS NULL OR ue.content_type = ANY(content_types))
      AND (user_filter IS NULL OR ue.user_id = user_filter)
      AND (team_filter IS NULL OR ue.team_id = team_filter)
      AND (language_filter IS NULL OR ue.language = language_filter)
      AND to_tsvector('english', coalesce(ue.content_text, '')) @@ plainto_tsquery('english', coalesce(query_text, ''))
      AND ue.content_text IS NOT NULL 
      AND TRIM(ue.content_text) != ''
  ),
  
  -- Combine all results with weighted scoring
  combined_results AS (
    SELECT 
      COALESCE(s.id, t.id) as id,
      COALESCE(s.source_type, t.source_type) as source_type,
      COALESCE(s.source_id, t.source_id) as source_id,
      COALESCE(s.content_type, t.content_type) as content_type,
      COALESCE(s.content_text, t.content_text) as content_text,
      COALESCE(s.semantic_sim, 0.0) as semantic_sim,
      COALESCE(t.text_rank, 0.0) as text_rank,
      COALESCE(s.metadata, t.metadata) as metadata
    FROM semantic_results s
    FULL OUTER JOIN text_results t ON s.id = t.id
  )
  
  SELECT 
    cr.id,
    cr.source_type,
    cr.source_id,
    cr.content_type,
    cr.content_text,
    cr.semantic_sim as similarity,
    cr.text_rank,
    -- Combined weighted score
    (cr.semantic_sim * semantic_weight) + 
    (cr.text_rank * text_rank_weight) as combined_score,
    cr.metadata
  FROM combined_results cr
  WHERE
    -- Ensure at least one search method found a match above threshold
    (cr.semantic_sim > similarity_threshold OR cr.text_rank > 0.01)
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- Create text-only hybrid_search function using ts_rank for full-text search
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  source_types TEXT[] DEFAULT ARRAY['receipt', 'claim', 'team_member', 'custom_category', 'business_directory'],
  content_types TEXT[] DEFAULT NULL,
  similarity_threshold FLOAT DEFAULT 0.1,
  match_count INT DEFAULT 20,
  user_filter UUID DEFAULT NULL,
  team_filter UUID DEFAULT NULL,
  language_filter TEXT DEFAULT NULL,
  fuzzy_threshold FLOAT DEFAULT 0.3
) RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_id UUID,
  content_type TEXT,
  content_text TEXT,
  similarity FLOAT,
  trigram_similarity FLOAT,
  text_rank FLOAT,
  combined_score FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- Trigram fuzzy matching results
  trigram_results AS (
    SELECT 
      ue.id,
      ue.source_type,
      ue.source_id,
      ue.content_type,
      ue.content_text,
      similarity(ue.content_text, query_text) as trigram_sim,
      0.0 as text_rank,
      ue.metadata
    FROM unified_embeddings ue
    WHERE 
      query_text IS NOT NULL 
      AND query_text != ''
      AND (source_types IS NULL OR ue.source_type = ANY(source_types))
      AND (content_types IS NULL OR ue.content_type = ANY(content_types))
      AND (user_filter IS NULL OR ue.user_id = user_filter)
      AND (team_filter IS NULL OR ue.team_id = team_filter)
      AND (language_filter IS NULL OR ue.language = language_filter)
      AND similarity(ue.content_text, query_text) > fuzzy_threshold
      AND ue.content_text IS NOT NULL 
      AND TRIM(ue.content_text) != ''
  ),
  
  -- Full-text search results using PostgreSQL ts_rank
  text_results AS (
    SELECT 
      ue.id,
      ue.source_type,
      ue.source_id,
      ue.content_type,
      ue.content_text,
      0.0 as trigram_sim,
      ts_rank_cd(to_tsvector('english', coalesce(ue.content_text, '')), plainto_tsquery('english', coalesce(query_text, ''))) as text_rank,
      ue.metadata
    FROM unified_embeddings ue
    WHERE 
      query_text IS NOT NULL 
      AND query_text != ''
      AND (source_types IS NULL OR ue.source_type = ANY(source_types))
      AND (content_types IS NULL OR ue.content_type = ANY(content_types))
      AND (user_filter IS NULL OR ue.user_id = user_filter)
      AND (team_filter IS NULL OR ue.team_id = team_filter)
      AND (language_filter IS NULL OR ue.language = language_filter)
      AND to_tsvector('english', coalesce(ue.content_text, '')) @@ plainto_tsquery('english', coalesce(query_text, ''))
      AND ue.content_text IS NOT NULL 
      AND TRIM(ue.content_text) != ''
  ),
  
  -- Combine all results with weighted scoring
  combined_results AS (
    SELECT 
      COALESCE(t.id, k.id) as id,
      COALESCE(t.source_type, k.source_type) as source_type,
      COALESCE(t.source_id, k.source_id) as source_id,
      COALESCE(t.content_type, k.content_type) as content_type,
      COALESCE(t.content_text, k.content_text) as content_text,
      GREATEST(COALESCE(t.trigram_sim, 0.0), COALESCE(k.text_rank, 0.0)) as similarity,
      COALESCE(t.trigram_sim, 0.0) as trigram_sim,
      COALESCE(k.text_rank, 0.0) as text_rank,
      COALESCE(t.metadata, k.metadata) as metadata
    FROM trigram_results t
    FULL OUTER JOIN text_results k ON t.id = k.id
  )
  
  SELECT 
    cr.id,
    cr.source_type,
    cr.source_id,
    cr.content_type,
    cr.content_text,
    cr.similarity,
    cr.trigram_sim as trigram_similarity,
    cr.text_rank,
    -- Combined weighted score: prioritize trigram matches, then text rank
    CASE 
      WHEN cr.trigram_sim > 0 THEN (cr.trigram_sim * 0.5) + (cr.text_rank * 0.5)
      ELSE cr.text_rank
    END as combined_score,
    cr.metadata
  FROM combined_results cr
  WHERE
    -- Ensure at least one search method found a match above threshold
    (cr.trigram_sim > fuzzy_threshold OR cr.text_rank > 0.01)
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- Create a fuzzy text search function with configurable threshold
CREATE OR REPLACE FUNCTION fuzzy_text_search(
  search_query TEXT,
  fuzzy_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 20,
  user_filter UUID DEFAULT NULL,
  team_filter UUID DEFAULT NULL,
  source_types TEXT[] DEFAULT ARRAY['receipt', 'claim', 'team_member', 'custom_category', 'business_directory']
) RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_id UUID,
  content_type TEXT,
  content_text TEXT,
  trigram_score FLOAT,
  ts_rank_score FLOAT,
  combined_score FLOAT,
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
    similarity(ue.content_text, search_query) as trigram_score,
    ts_rank_cd(to_tsvector('english', ue.content_text), plainto_tsquery('english', search_query)) as ts_rank_score,
    -- Combined score: weighted average of trigram and ts_rank scores
    (similarity(ue.content_text, search_query) * 0.6) + 
    (ts_rank_cd(to_tsvector('english', ue.content_text), plainto_tsquery('english', search_query)) * 0.4) as combined_score,
    ue.metadata
  FROM unified_embeddings ue
  WHERE 
    search_query IS NOT NULL
    AND search_query != ''
    AND (source_types IS NULL OR ue.source_type = ANY(source_types))
    AND (user_filter IS NULL OR ue.user_id = user_filter)
    AND (team_filter IS NULL OR ue.team_id = team_filter)
    -- Match using either trigram similarity OR full-text search
    AND (
      similarity(ue.content_text, search_query) > fuzzy_threshold
      OR
      to_tsvector('english', ue.content_text) @@ plainto_tsquery('english', search_query)
    )
    AND ue.content_text IS NOT NULL 
    AND TRIM(ue.content_text) != ''
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION hybrid_search IS 'Hybrid search combining vector similarity with full-text search using ts_rank. Overloaded for both vector+text and text-only searches.';
COMMENT ON FUNCTION fuzzy_text_search IS 'Fuzzy text search using pg_trgm similarity combined with PostgreSQL ts_rank full-text search ranking.';

-- Create GIN index for trigram performance
CREATE INDEX IF NOT EXISTS idx_unified_embeddings_trgm 
ON unified_embeddings USING gin (content_text gin_trgm_ops);

-- Also add index on tsvector for full-text search performance  
CREATE INDEX IF NOT EXISTS idx_unified_embeddings_tsvector 
ON unified_embeddings USING gin (to_tsvector('english', content_text));
