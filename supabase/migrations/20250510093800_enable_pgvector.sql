-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Create table for storing embeddings
CREATE TABLE IF NOT EXISTS public.receipt_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  content_type text NOT NULL, -- 'full_text', 'merchant', 'items', etc.
  embedding vector(1536), -- Standard Gemini embedding dimension
  metadata jsonb,
  created_at timestamp WITH time zone DEFAULT now(),
  
  CONSTRAINT fk_receipt
    FOREIGN KEY (receipt_id)
    REFERENCES receipts(id)
    ON DELETE CASCADE
);

-- Create indexes for vector similarity search
CREATE INDEX ON receipt_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Create a function to search for similar receipts based on vector similarity
CREATE OR REPLACE FUNCTION search_receipts(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  content_type text DEFAULT 'full_text'
) RETURNS TABLE (
  id uuid,
  receipt_id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    re.id,
    re.receipt_id,
    1 - (re.embedding <=> query_embedding) AS similarity
  FROM receipt_embeddings re
  WHERE
    re.content_type = search_receipts.content_type
    AND 1 - (re.embedding <=> query_embedding) > similarity_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Create a helper function to check pgvector status
CREATE OR REPLACE FUNCTION check_pgvector_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  extension_exists boolean;
  vector_table_exists boolean;
  api_key_exists boolean;
  result json;
BEGIN
  -- Check if pgvector extension is installed
  SELECT exists(
    SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'vector'
  ) INTO extension_exists;

  -- Check if receipt_embeddings table exists
  SELECT exists(
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'receipt_embeddings'
  ) INTO vector_table_exists;
  
  -- Check if Gemini API key is set
  SELECT exists(
    SELECT 1 FROM pg_settings WHERE name = 'app.settings.gemini_api_key' AND setting IS NOT NULL AND setting != ''
  ) INTO api_key_exists;

  -- Return results as JSON
  result := json_build_object(
    'extension_exists', extension_exists,
    'vector_table_exists', vector_table_exists,
    'api_key_exists', api_key_exists
  );

  RETURN result;
END;
$$;

-- Create a hybrid search function (combines full-text and vector search)
CREATE OR REPLACE FUNCTION hybrid_search_receipts(
  search_text text,
  query_embedding vector(1536),
  content_type text DEFAULT 'full_text',
  similarity_weight float DEFAULT 0.7,
  text_weight float DEFAULT 0.3,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  receipt_id uuid,
  score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT 
      e.receipt_id,
      1 - (e.embedding <=> query_embedding) AS similarity
    FROM receipt_embeddings e
    WHERE e.content_type = hybrid_search_receipts.content_type
  ),
  text_results AS (
    SELECT 
      r.id AS receipt_id,
      ts_rank_cd(to_tsvector('english', coalesce(r.merchant, '') || ' ' || 
                coalesce(r.notes, '') || ' ' || 
                coalesce(r.raw_text, '')), 
                plainto_tsquery('english', search_text)) AS text_similarity
    FROM receipts r
  ),
  combined_results AS (
    SELECT 
      coalesce(v.receipt_id, t.receipt_id) AS receipt_id,
      (coalesce(v.similarity, 0) * similarity_weight) + 
      (coalesce(t.text_similarity, 0) * text_weight) AS score
    FROM vector_results v
    FULL OUTER JOIN text_results t ON v.receipt_id = t.receipt_id
  )
  SELECT * FROM combined_results
  WHERE score > 0
  ORDER BY score DESC
  LIMIT match_count;
END;
$$;
