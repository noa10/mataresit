-- Migration to unify embeddings from line_items and receipt_embeddings tables

-- 1. Add new fields to receipt_embeddings table
ALTER TABLE public.receipt_embeddings
ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'receipt',
ADD COLUMN IF NOT EXISTS source_id UUID NOT NULL DEFAULT gen_random_uuid(),
ADD CONSTRAINT enforce_unique_sources UNIQUE(source_type, source_id);

-- Create index for source_id lookups
CREATE INDEX IF NOT EXISTS idx_receipt_embeddings_source_id ON public.receipt_embeddings(source_id);

-- Create index for source_type lookups
CREATE INDEX IF NOT EXISTS idx_receipt_embeddings_source_type ON public.receipt_embeddings(source_type);

-- 2. Migrate existing receipt embeddings to use the new fields
-- Set source_id = receipt_id for existing records
UPDATE public.receipt_embeddings
SET source_id = receipt_id
WHERE source_type = 'receipt';

-- 3. Migrate line item embeddings to receipt_embeddings table
INSERT INTO public.receipt_embeddings (receipt_id, content_type, embedding, source_type, source_id, created_at)
SELECT 
  receipt_id,
  'line_item', -- content_type
  embedding,
  'line_item', -- source_type
  id, -- source_id
  NOW() -- created_at
FROM 
  public.line_items
WHERE 
  embedding IS NOT NULL;

-- 4. Create a new unified search function
CREATE OR REPLACE FUNCTION search_embeddings(
  query_embedding vector(1536),
  search_type text DEFAULT 'all', -- 'all', 'receipt', or 'line_item'
  content_type text DEFAULT NULL,
  similarity_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
) RETURNS TABLE (
  id uuid,
  source_id uuid,
  source_type text,
  receipt_id uuid,
  content_type text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    re.id,
    re.source_id,
    re.source_type,
    re.receipt_id,
    re.content_type,
    1 - (re.embedding <=> query_embedding) as similarity
  FROM receipt_embeddings re
  WHERE
    (re.embedding IS NOT NULL)
    AND (search_type = 'all' OR re.source_type = search_type)
    AND (content_type IS NULL OR re.content_type = content_type)
    AND (1 - (re.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- 5. Create a hybrid search function for the unified embedding model
CREATE OR REPLACE FUNCTION hybrid_search_embeddings(
  search_text text,
  query_embedding vector(1536),
  search_type text DEFAULT 'all', -- 'all', 'receipt', or 'line_item'
  content_type text DEFAULT NULL,
  similarity_weight float DEFAULT 0.7,
  text_weight float DEFAULT 0.3,
  match_count int DEFAULT 10,
  min_amount float DEFAULT NULL,
  max_amount float DEFAULT NULL,
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  source_id uuid,
  source_type text,
  receipt_id uuid,
  content_type text,
  score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      re.id,
      re.source_id,
      re.source_type,
      re.receipt_id,
      re.content_type,
      1 - (re.embedding <=> query_embedding) as similarity
    FROM receipt_embeddings re
    WHERE
      re.embedding IS NOT NULL
      AND (search_type = 'all' OR re.source_type = search_type)
      AND (content_type IS NULL OR re.content_type = content_type)
  ),
  text_results AS (
    SELECT
      r.id as receipt_id,
      ts_rank_cd(to_tsvector('english', coalesce(r.merchant, '') || ' ' || 
                coalesce(r.notes, '') || ' ' || 
                coalesce(r.raw_text, '')), 
                plainto_tsquery('english', search_text)) as text_similarity
    FROM receipts r
    WHERE
      (min_amount IS NULL OR r.total >= min_amount)
      AND (max_amount IS NULL OR r.total <= max_amount)
      AND (start_date IS NULL OR r.date >= start_date)
      AND (end_date IS NULL OR r.date <= end_date)
  ),
  line_item_text_results AS (
    SELECT
      li.id as line_item_id,
      li.receipt_id,
      ts_rank(to_tsvector('english', coalesce(li.description, '')), 
              plainto_tsquery('english', search_text)) as text_similarity
    FROM line_items li
    JOIN receipts r ON li.receipt_id = r.id
    WHERE
      (min_amount IS NULL OR li.amount >= min_amount)
      AND (max_amount IS NULL OR li.amount <= max_amount)
      AND (start_date IS NULL OR r.date >= start_date)
      AND (end_date IS NULL OR r.date <= end_date)
  ),
  combined_results AS (
    SELECT 
      vr.id,
      vr.source_id,
      vr.source_type,
      vr.receipt_id,
      vr.content_type,
      CASE
        WHEN vr.source_type = 'receipt' THEN
          (vr.similarity * similarity_weight) + 
          (COALESCE((SELECT text_similarity FROM text_results WHERE receipt_id = vr.source_id), 0) * text_weight)
        WHEN vr.source_type = 'line_item' THEN
          (vr.similarity * similarity_weight) + 
          (COALESCE((SELECT text_similarity FROM line_item_text_results WHERE line_item_id = vr.source_id), 0) * text_weight)
        ELSE
          vr.similarity
      END as score
    FROM vector_results vr
  )
  SELECT * FROM combined_results
  WHERE score > 0
  ORDER BY score DESC
  LIMIT match_count;
END;
$$;

-- 6. Function to add a new embedding (generic for any source type)
CREATE OR REPLACE FUNCTION add_embedding(
  p_source_type TEXT,
  p_source_id UUID,
  p_receipt_id UUID,
  p_content_type TEXT,
  p_embedding VECTOR(1536),
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_embedding_id UUID;
BEGIN
  -- Check if embedding already exists for this source
  SELECT id INTO v_embedding_id
  FROM receipt_embeddings
  WHERE source_type = p_source_type AND source_id = p_source_id AND content_type = p_content_type;
  
  -- If existing, update it
  IF v_embedding_id IS NOT NULL THEN
    UPDATE receipt_embeddings
    SET 
      embedding = p_embedding,
      metadata = p_metadata,
      receipt_id = p_receipt_id -- Update receipt_id in case it changed
    WHERE id = v_embedding_id;
  
  -- If not existing, insert new
  ELSE
    INSERT INTO receipt_embeddings
      (source_type, source_id, receipt_id, content_type, embedding, metadata)
    VALUES
      (p_source_type, p_source_id, p_receipt_id, p_content_type, p_embedding, p_metadata)
    RETURNING id INTO v_embedding_id;
  END IF;
  
  RETURN v_embedding_id;
END;
$$; 