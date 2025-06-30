-- Enhanced Hybrid Search with PostgreSQL Trigram Extension
-- This migration adds trigram-based fuzzy matching and improved hybrid search capabilities

-- Enable the pg_trgm extension for trigram-based fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram indexes for fuzzy text matching on unified_embeddings
CREATE INDEX IF NOT EXISTS idx_unified_embeddings_content_trigram 
ON unified_embeddings USING gin (content_text gin_trgm_ops);

-- Create trigram indexes for specific content types that benefit from fuzzy matching
CREATE INDEX IF NOT EXISTS idx_unified_embeddings_merchant_trigram 
ON unified_embeddings USING gin (content_text gin_trgm_ops) 
WHERE content_type = 'merchant';

-- Enhanced hybrid search function with trigram support and amount filtering
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
  amount_currency TEXT DEFAULT NULL
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
      0.0 as trigram_sim,
      0.0 as keyword_sc,
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
  
  -- Trigram fuzzy matching results
  trigram_results AS (
    SELECT 
      ue.id,
      ue.source_type,
      ue.source_id,
      ue.content_type,
      ue.content_text,
      0.0 as semantic_sim,
      similarity(ue.content_text, query_text) as trigram_sim,
      0.0 as keyword_sc,
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
      AND similarity(ue.content_text, query_text) > trigram_threshold
      AND ue.content_text IS NOT NULL 
      AND TRIM(ue.content_text) != ''
  ),
  
  -- Full-text search results using PostgreSQL's built-in text search
  keyword_results AS (
    SELECT 
      ue.id,
      ue.source_type,
      ue.source_id,
      ue.content_type,
      ue.content_text,
      0.0 as semantic_sim,
      0.0 as trigram_sim,
      ts_rank_cd(to_tsvector('english', ue.content_text), plainto_tsquery('english', query_text)) as keyword_sc,
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
      AND to_tsvector('english', ue.content_text) @@ plainto_tsquery('english', query_text)
      AND ue.content_text IS NOT NULL 
      AND TRIM(ue.content_text) != ''
  ),
  
  -- Combine all results with weighted scoring
  combined_results AS (
    SELECT 
      COALESCE(s.id, t.id, k.id) as id,
      COALESCE(s.source_type, t.source_type, k.source_type) as source_type,
      COALESCE(s.source_id, t.source_id, k.source_id) as source_id,
      COALESCE(s.content_type, t.content_type, k.content_type) as content_type,
      COALESCE(s.content_text, t.content_text, k.content_text) as content_text,
      COALESCE(s.semantic_sim, 0.0) as semantic_sim,
      COALESCE(t.trigram_sim, 0.0) as trigram_sim,
      COALESCE(k.keyword_sc, 0.0) as keyword_sc,
      COALESCE(s.metadata, t.metadata, k.metadata) as metadata
    FROM semantic_results s
    FULL OUTER JOIN trigram_results t ON s.id = t.id
    FULL OUTER JOIN keyword_results k ON COALESCE(s.id, t.id) = k.id
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

    -- Apply amount filtering for receipts and claims
    AND (
      cr.source_type NOT IN ('receipt', 'claim') OR
      (
        (amount_min IS NULL OR (cr.metadata->>'total')::FLOAT >= amount_min OR (cr.metadata->>'amount')::FLOAT >= amount_min) AND
        (amount_max IS NULL OR (cr.metadata->>'total')::FLOAT <= amount_max OR (cr.metadata->>'amount')::FLOAT <= amount_max)
      )
    )
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- Create a specialized function for merchant name fuzzy matching
CREATE OR REPLACE FUNCTION fuzzy_merchant_search(
  merchant_query TEXT,
  similarity_threshold FLOAT DEFAULT 0.4,
  match_count INT DEFAULT 10,
  user_filter UUID DEFAULT NULL
) RETURNS TABLE (
  merchant_name TEXT,
  similarity_score FLOAT,
  occurrence_count BIGINT,
  latest_date DATE,
  total_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.content_text as merchant_name,
    similarity(ue.content_text, merchant_query) as similarity_score,
    COUNT(*) as occurrence_count,
    MAX((ue.metadata->>'date')::DATE) as latest_date,
    SUM((ue.metadata->>'total')::NUMERIC) as total_amount
  FROM unified_embeddings ue
  WHERE 
    ue.content_type = 'merchant'
    AND (user_filter IS NULL OR ue.user_id = user_filter)
    AND similarity(ue.content_text, merchant_query) > similarity_threshold
    AND ue.content_text IS NOT NULL 
    AND TRIM(ue.content_text) != ''
  GROUP BY ue.content_text
  ORDER BY similarity_score DESC, occurrence_count DESC
  LIMIT match_count;
END;
$$;

-- Create a function for contextual snippet extraction
CREATE OR REPLACE FUNCTION extract_contextual_snippets(
  content_text TEXT,
  query_text TEXT,
  snippet_length INT DEFAULT 200,
  max_snippets INT DEFAULT 3
) RETURNS TEXT[]
LANGUAGE plpgsql
AS $$
DECLARE
  snippets TEXT[] := '{}';
  words TEXT[];
  query_words TEXT[];
  word_positions INT[];
  snippet_start INT;
  snippet_end INT;
  snippet TEXT;
  i INT;
  j INT;
BEGIN
  -- Return empty array if inputs are invalid
  IF content_text IS NULL OR query_text IS NULL OR 
     TRIM(content_text) = '' OR TRIM(query_text) = '' THEN
    RETURN snippets;
  END IF;

  -- Split content and query into words
  words := string_to_array(lower(content_text), ' ');
  query_words := string_to_array(lower(query_text), ' ');

  -- Find positions of query words in content
  FOR i IN 1..array_length(query_words, 1) LOOP
    FOR j IN 1..array_length(words, 1) LOOP
      IF words[j] LIKE '%' || query_words[i] || '%' THEN
        word_positions := array_append(word_positions, j);
      END IF;
    END LOOP;
  END LOOP;

  -- Extract snippets around found positions
  FOR i IN 1..LEAST(array_length(word_positions, 1), max_snippets) LOOP
    snippet_start := GREATEST(1, word_positions[i] - snippet_length / 2);
    snippet_end := LEAST(array_length(words, 1), word_positions[i] + snippet_length / 2);
    
    snippet := array_to_string(words[snippet_start:snippet_end], ' ');
    
    -- Add ellipsis if snippet doesn't start/end at content boundaries
    IF snippet_start > 1 THEN
      snippet := '...' || snippet;
    END IF;
    IF snippet_end < array_length(words, 1) THEN
      snippet := snippet || '...';
    END IF;
    
    snippets := array_append(snippets, snippet);
  END LOOP;

  -- If no specific matches found, return beginning of content
  IF array_length(snippets, 1) = 0 THEN
    snippet := substring(content_text FROM 1 FOR snippet_length);
    IF length(content_text) > snippet_length THEN
      snippet := snippet || '...';
    END IF;
    snippets := array_append(snippets, snippet);
  END IF;

  RETURN snippets;
END;
$$;

-- Create an enhanced search statistics function
CREATE OR REPLACE FUNCTION get_enhanced_search_stats(
  user_filter UUID DEFAULT NULL
) RETURNS TABLE (
  total_embeddings BIGINT,
  semantic_ready BIGINT,
  trigram_indexed BIGINT,
  avg_content_length NUMERIC,
  top_content_types JSONB,
  search_performance_metrics JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stats_result RECORD;
BEGIN
  -- Get comprehensive search statistics
  SELECT 
    COUNT(*) as total_emb,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as semantic_ready_emb,
    COUNT(CASE WHEN content_text IS NOT NULL AND TRIM(content_text) != '' THEN 1 END) as trigram_ready_emb,
    AVG(LENGTH(content_text)) FILTER (WHERE content_text IS NOT NULL) as avg_len
  INTO stats_result
  FROM unified_embeddings ue
  WHERE (user_filter IS NULL OR ue.user_id = user_filter);

  RETURN QUERY
  SELECT 
    stats_result.total_emb as total_embeddings,
    stats_result.semantic_ready_emb as semantic_ready,
    stats_result.trigram_ready_emb as trigram_indexed,
    stats_result.avg_len as avg_content_length,
    
    -- Top content types
    (SELECT jsonb_agg(
      jsonb_build_object(
        'content_type', content_type,
        'count', cnt,
        'percentage', ROUND((cnt::NUMERIC / stats_result.total_emb * 100), 2)
      ) ORDER BY cnt DESC
    )
    FROM (
      SELECT content_type, COUNT(*) as cnt
      FROM unified_embeddings ue2
      WHERE (user_filter IS NULL OR ue2.user_id = user_filter)
      GROUP BY content_type
      LIMIT 10
    ) top_types) as top_content_types,
    
    -- Performance metrics
    jsonb_build_object(
      'semantic_coverage', ROUND((stats_result.semantic_ready_emb::NUMERIC / NULLIF(stats_result.total_emb, 0) * 100), 2),
      'trigram_coverage', ROUND((stats_result.trigram_ready_emb::NUMERIC / NULLIF(stats_result.total_emb, 0) * 100), 2),
      'avg_content_length', ROUND(stats_result.avg_len, 2)
    ) as search_performance_metrics;
END;
$$;

-- Add helpful comments
COMMENT ON FUNCTION enhanced_hybrid_search IS 'Enhanced hybrid search combining semantic vectors, trigram fuzzy matching, and keyword search with weighted scoring';
COMMENT ON FUNCTION fuzzy_merchant_search IS 'Specialized fuzzy search for merchant names using trigram similarity';
COMMENT ON FUNCTION extract_contextual_snippets IS 'Extract relevant text snippets around query matches for better context presentation';
COMMENT ON FUNCTION get_enhanced_search_stats IS 'Get comprehensive statistics about search index coverage and performance';
