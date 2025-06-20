-- Fix Receipt Embedding Content Storage Issue
-- This migration addresses the critical issue where receipt embeddings have empty content_text fields

-- First, let's add better validation to the add_unified_embedding function
CREATE OR REPLACE FUNCTION add_unified_embedding(
  p_source_type TEXT,
  p_source_id UUID,
  p_content_type TEXT,
  p_content_text TEXT,
  p_embedding VECTOR(1536),
  p_metadata JSONB DEFAULT '{}',
  p_user_id UUID DEFAULT NULL,
  p_team_id UUID DEFAULT NULL,
  p_language TEXT DEFAULT 'en'
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  embedding_id UUID;
BEGIN
  -- Validate that content_text is not empty
  IF p_content_text IS NULL OR TRIM(p_content_text) = '' THEN
    RAISE EXCEPTION 'Content text cannot be null or empty for embedding storage. Source: % ID: % Type: %', 
      p_source_type, p_source_id, p_content_type;
  END IF;

  -- Validate that embedding is not null
  IF p_embedding IS NULL THEN
    RAISE EXCEPTION 'Embedding vector cannot be null. Source: % ID: % Type: %', 
      p_source_type, p_source_id, p_content_type;
  END IF;

  -- Log the embedding storage for debugging
  RAISE NOTICE 'Storing embedding: source_type=%, source_id=%, content_type=%, content_length=%', 
    p_source_type, p_source_id, p_content_type, LENGTH(p_content_text);

  -- Insert or update embedding with proper validation
  INSERT INTO unified_embeddings (
    source_type, source_id, content_type, content_text,
    embedding, metadata, user_id, team_id, language
  ) VALUES (
    p_source_type, p_source_id, p_content_type, p_content_text,
    p_embedding, p_metadata, p_user_id, p_team_id, p_language
  )
  ON CONFLICT (source_type, source_id, content_type) 
  DO UPDATE SET
    content_text = EXCLUDED.content_text,
    embedding = EXCLUDED.embedding,
    metadata = EXCLUDED.metadata,
    user_id = EXCLUDED.user_id,
    team_id = EXCLUDED.team_id,
    language = EXCLUDED.language,
    updated_at = NOW()
  RETURNING id INTO embedding_id;

  -- Log successful storage
  RAISE NOTICE 'Successfully stored embedding with ID: %', embedding_id;

  RETURN embedding_id;
END;
$$;

-- Add a function to fix existing receipt embeddings with empty content
CREATE OR REPLACE FUNCTION fix_receipt_embedding_content()
RETURNS TABLE (
  embedding_id UUID,
  receipt_id UUID,
  content_type TEXT,
  original_content TEXT,
  fixed_content TEXT,
  success BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  receipt_data RECORD;
  new_content TEXT;
  fix_success BOOLEAN;
  error_msg TEXT;
BEGIN
  -- Loop through all receipt embeddings with empty content
  FOR rec IN 
    SELECT id, source_id, content_type, content_text
    FROM unified_embeddings 
    WHERE source_type = 'receipt' 
      AND (content_text IS NULL OR TRIM(content_text) = '')
  LOOP
    -- Get the receipt data
    SELECT r.merchant, r."fullText", r.date, r.total, r.payment_method, r.predicted_category
    INTO receipt_data
    FROM receipts r
    WHERE r.id = rec.source_id;

    -- Initialize variables
    new_content := '';
    fix_success := FALSE;
    error_msg := NULL;

    BEGIN
      -- Determine content based on content_type
      CASE rec.content_type
        WHEN 'merchant' THEN
          new_content := COALESCE(receipt_data.merchant, '');
        WHEN 'full_text' THEN
          new_content := COALESCE(receipt_data."fullText", '');
        WHEN 'fallback' THEN
          new_content := CONCAT_WS(E'\n',
            CASE WHEN receipt_data.merchant IS NOT NULL THEN 'Merchant: ' || receipt_data.merchant END,
            CASE WHEN receipt_data.date IS NOT NULL THEN 'Date: ' || receipt_data.date END,
            CASE WHEN receipt_data.total IS NOT NULL THEN 'Total: ' || receipt_data.total END
          );
        ELSE
          new_content := COALESCE(receipt_data.merchant, '');
      END CASE;

      -- Only update if we have content
      IF new_content IS NOT NULL AND TRIM(new_content) != '' THEN
        UPDATE unified_embeddings 
        SET content_text = new_content, updated_at = NOW()
        WHERE id = rec.id;
        
        fix_success := TRUE;
      ELSE
        error_msg := 'No content available to fix';
      END IF;

    EXCEPTION WHEN OTHERS THEN
      fix_success := FALSE;
      error_msg := SQLERRM;
    END;

    -- Return the result
    embedding_id := rec.id;
    receipt_id := rec.source_id;
    content_type := rec.content_type;
    original_content := rec.content_text;
    fixed_content := new_content;
    success := fix_success;
    error_message := error_msg;
    
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Add a function to analyze the current embedding content storage status
CREATE OR REPLACE FUNCTION analyze_embedding_content_storage()
RETURNS TABLE (
  source_type TEXT,
  content_type TEXT,
  total_embeddings BIGINT,
  empty_content_count BIGINT,
  has_content_count BIGINT,
  empty_content_percentage NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.source_type,
    ue.content_type,
    COUNT(*) as total_embeddings,
    COUNT(CASE WHEN ue.content_text IS NULL OR TRIM(ue.content_text) = '' THEN 1 END) as empty_content_count,
    COUNT(CASE WHEN ue.content_text IS NOT NULL AND TRIM(ue.content_text) != '' THEN 1 END) as has_content_count,
    ROUND(
      (COUNT(CASE WHEN ue.content_text IS NULL OR TRIM(ue.content_text) = '' THEN 1 END) * 100.0 / COUNT(*)), 
      2
    ) as empty_content_percentage
  FROM unified_embeddings ue
  GROUP BY ue.source_type, ue.content_type
  ORDER BY empty_content_percentage DESC, ue.source_type, ue.content_type;
END;
$$;

-- Add a constraint to prevent empty content_text in future insertions
-- Note: We'll add this as a check constraint that can be temporarily disabled during fixes
ALTER TABLE unified_embeddings 
ADD CONSTRAINT check_content_text_not_empty 
CHECK (content_text IS NOT NULL AND TRIM(content_text) != '')
NOT VALID; -- Start as NOT VALID so existing data doesn't cause issues

-- Add an index to quickly find embeddings with content issues
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_embeddings_empty_content 
ON unified_embeddings (source_type, content_type) 
WHERE content_text IS NULL OR TRIM(content_text) = '';

-- Add an index for better performance on content_text searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_embeddings_content_text_gin 
ON unified_embeddings USING GIN (to_tsvector('english', content_text))
WHERE content_text IS NOT NULL AND TRIM(content_text) != '';

-- Create a view for monitoring embedding content health
CREATE OR REPLACE VIEW embedding_content_health AS
SELECT 
  source_type,
  content_type,
  COUNT(*) as total_embeddings,
  COUNT(CASE WHEN content_text IS NULL OR TRIM(content_text) = '' THEN 1 END) as empty_content,
  COUNT(CASE WHEN content_text IS NOT NULL AND TRIM(content_text) != '' THEN 1 END) as has_content,
  ROUND(
    (COUNT(CASE WHEN content_text IS NOT NULL AND TRIM(content_text) != '' THEN 1 END) * 100.0 / COUNT(*)), 
    2
  ) as content_health_percentage,
  MIN(LENGTH(content_text)) FILTER (WHERE content_text IS NOT NULL AND TRIM(content_text) != '') as min_content_length,
  MAX(LENGTH(content_text)) FILTER (WHERE content_text IS NOT NULL AND TRIM(content_text) != '') as max_content_length,
  AVG(LENGTH(content_text)) FILTER (WHERE content_text IS NOT NULL AND TRIM(content_text) != '') as avg_content_length
FROM unified_embeddings
GROUP BY source_type, content_type
ORDER BY content_health_percentage ASC, source_type, content_type;

-- Add a trigger to log embedding insertions for debugging
CREATE OR REPLACE FUNCTION log_embedding_insertion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Log embedding insertions to help debug content storage issues
  RAISE NOTICE 'Embedding inserted: ID=%, source_type=%, source_id=%, content_type=%, content_length=%', 
    NEW.id, NEW.source_type, NEW.source_id, NEW.content_type, 
    CASE WHEN NEW.content_text IS NOT NULL THEN LENGTH(NEW.content_text) ELSE 0 END;
  
  -- Warn if content is empty
  IF NEW.content_text IS NULL OR TRIM(NEW.content_text) = '' THEN
    RAISE WARNING 'Empty content_text detected for embedding: ID=%, source_type=%, source_id=%, content_type=%', 
      NEW.id, NEW.source_type, NEW.source_id, NEW.content_type;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger (can be disabled in production if too verbose)
DROP TRIGGER IF EXISTS trigger_log_embedding_insertion ON unified_embeddings;
CREATE TRIGGER trigger_log_embedding_insertion
  AFTER INSERT ON unified_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION log_embedding_insertion();

-- Add comments for documentation
COMMENT ON FUNCTION add_unified_embedding IS 'Enhanced embedding storage function with validation to prevent empty content_text fields';
COMMENT ON FUNCTION fix_receipt_embedding_content IS 'Fixes existing receipt embeddings that have empty content_text fields';
COMMENT ON FUNCTION analyze_embedding_content_storage IS 'Analyzes the current state of embedding content storage across all sources';
COMMENT ON VIEW embedding_content_health IS 'Monitoring view for embedding content health metrics';
COMMENT ON CONSTRAINT check_content_text_not_empty ON unified_embeddings IS 'Prevents insertion of embeddings with empty content_text (can be temporarily disabled during fixes)';

-- Log the migration completion
DO $$
BEGIN
  RAISE NOTICE 'Receipt embedding content storage fix migration completed successfully';
  RAISE NOTICE 'Use SELECT * FROM analyze_embedding_content_storage() to check current status';
  RAISE NOTICE 'Use SELECT * FROM fix_receipt_embedding_content() to fix existing issues';
END;
$$;
