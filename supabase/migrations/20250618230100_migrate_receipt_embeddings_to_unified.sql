-- Migrate existing receipt embeddings to unified_embeddings table
-- This ensures backward compatibility and populates the unified search system

-- Create a function to migrate receipt embeddings to unified format
CREATE OR REPLACE FUNCTION migrate_receipt_embeddings_to_unified()
RETURNS TABLE (
  migrated_count INTEGER,
  skipped_count INTEGER,
  error_count INTEGER,
  details JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  migrated_count INTEGER := 0;
  skipped_count INTEGER := 0;
  error_count INTEGER := 0;
  details JSONB := '[]'::JSONB;
  receipt_data RECORD;
  content_text TEXT;
BEGIN
  -- Migrate existing receipt_embeddings to unified_embeddings
  FOR rec IN 
    SELECT re.id, re.receipt_id, re.content_type, re.embedding, re.metadata, re.created_at
    FROM receipt_embeddings re
    WHERE NOT EXISTS (
      SELECT 1 FROM unified_embeddings ue 
      WHERE ue.source_type = 'receipt' 
        AND ue.source_id = re.receipt_id 
        AND ue.content_type = re.content_type
    )
  LOOP
    BEGIN
      -- Get receipt data to construct content_text
      SELECT r.merchant, r."fullText", r.notes, r.user_id, r.date, r.total
      INTO receipt_data
      FROM receipts r
      WHERE r.id = rec.receipt_id;
      
      IF NOT FOUND THEN
        skipped_count := skipped_count + 1;
        details := details || jsonb_build_object(
          'receipt_id', rec.receipt_id,
          'status', 'skipped',
          'reason', 'receipt_not_found'
        );
        CONTINUE;
      END IF;
      
      -- Construct content_text based on content_type
      CASE rec.content_type
        WHEN 'full_text' THEN
          content_text := COALESCE(receipt_data."fullText", '');
        WHEN 'merchant' THEN
          content_text := COALESCE(receipt_data.merchant, '');
        WHEN 'notes' THEN
          content_text := COALESCE(receipt_data.notes, '');
        WHEN 'fallback' THEN
          content_text := COALESCE(
            receipt_data."fullText",
            receipt_data.merchant || ' - ' || receipt_data.total::TEXT,
            receipt_data.merchant,
            'Receipt from ' || receipt_data.date::TEXT
          );
        ELSE
          content_text := COALESCE(receipt_data.merchant, 'Unknown');
      END CASE;
      
      -- Skip if no content available
      IF content_text IS NULL OR TRIM(content_text) = '' THEN
        skipped_count := skipped_count + 1;
        details := details || jsonb_build_object(
          'receipt_id', rec.receipt_id,
          'content_type', rec.content_type,
          'status', 'skipped',
          'reason', 'no_content_available'
        );
        CONTINUE;
      END IF;
      
      -- Insert into unified_embeddings
      INSERT INTO unified_embeddings (
        source_type,
        source_id,
        content_type,
        content_text,
        embedding,
        metadata,
        user_id,
        language,
        created_at
      ) VALUES (
        'receipt',
        rec.receipt_id,
        rec.content_type,
        content_text,
        rec.embedding,
        COALESCE(rec.metadata, '{}'::JSONB) || jsonb_build_object(
          'migrated_from', 'receipt_embeddings',
          'migration_date', NOW(),
          'receipt_date', receipt_data.date,
          'receipt_total', receipt_data.total
        ),
        receipt_data.user_id,
        'en', -- Default to English
        rec.created_at
      );
      
      migrated_count := migrated_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      details := details || jsonb_build_object(
        'receipt_id', rec.receipt_id,
        'content_type', rec.content_type,
        'status', 'error',
        'error_message', SQLERRM
      );
    END;
  END LOOP;
  
  RETURN QUERY SELECT migrated_count, skipped_count, error_count, details;
END;
$$;

-- Create a function to identify receipts missing embeddings
CREATE OR REPLACE FUNCTION find_receipts_missing_embeddings(
  limit_count INTEGER DEFAULT 100
)
RETURNS TABLE (
  receipt_id UUID,
  merchant TEXT,
  date DATE,
  user_id UUID,
  missing_content_types TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id as receipt_id,
    r.merchant,
    r.date,
    r.user_id,
    ARRAY(
      SELECT content_type 
      FROM (VALUES ('full_text'), ('merchant'), ('notes')) AS ct(content_type)
      WHERE NOT EXISTS (
        SELECT 1 FROM unified_embeddings ue 
        WHERE ue.source_type = 'receipt' 
          AND ue.source_id = r.id 
          AND ue.content_type = ct.content_type
      )
      AND (
        (ct.content_type = 'full_text' AND r."fullText" IS NOT NULL AND TRIM(r."fullText") != '') OR
        (ct.content_type = 'merchant' AND r.merchant IS NOT NULL AND TRIM(r.merchant) != '') OR
        (ct.content_type = 'notes' AND r.notes IS NOT NULL AND TRIM(r.notes) != '')
      )
    ) as missing_content_types
  FROM receipts r
  WHERE EXISTS (
    SELECT 1 FROM (VALUES ('full_text'), ('merchant'), ('notes')) AS ct(content_type)
    WHERE NOT EXISTS (
      SELECT 1 FROM unified_embeddings ue 
      WHERE ue.source_type = 'receipt' 
        AND ue.source_id = r.id 
        AND ue.content_type = ct.content_type
    )
    AND (
      (ct.content_type = 'full_text' AND r."fullText" IS NOT NULL AND TRIM(r."fullText") != '') OR
      (ct.content_type = 'merchant' AND r.merchant IS NOT NULL AND TRIM(r.merchant) != '') OR
      (ct.content_type = 'notes' AND r.notes IS NOT NULL AND TRIM(r.notes) != '')
    )
  )
  ORDER BY r.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Create a function to get embedding statistics
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
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM receipts) as total_receipts,
    (SELECT COUNT(DISTINCT receipt_id) FROM receipt_embeddings) as receipts_with_old_embeddings,
    (SELECT COUNT(DISTINCT source_id) FROM unified_embeddings WHERE source_type = 'receipt') as receipts_with_unified_embeddings,
    (SELECT COUNT(*) FROM find_receipts_missing_embeddings(1000)) as receipts_missing_embeddings,
    (SELECT COUNT(DISTINCT receipt_id) FROM receipt_embeddings) > 
    (SELECT COUNT(DISTINCT source_id) FROM unified_embeddings WHERE source_type = 'receipt') as migration_needed;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION migrate_receipt_embeddings_to_unified IS 'Migrates existing receipt_embeddings to unified_embeddings table with proper content_text';
COMMENT ON FUNCTION find_receipts_missing_embeddings IS 'Identifies receipts that are missing embeddings in the unified system';
COMMENT ON FUNCTION get_embedding_migration_stats IS 'Provides statistics about the embedding migration status';

-- Create a function to add unified embeddings safely
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
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  embedding_id UUID;
BEGIN
  -- Insert or update the embedding
  INSERT INTO unified_embeddings (
    source_type,
    source_id,
    content_type,
    content_text,
    embedding,
    metadata,
    user_id,
    team_id,
    language,
    created_at,
    updated_at
  ) VALUES (
    p_source_type,
    p_source_id,
    p_content_type,
    p_content_text,
    p_embedding,
    p_metadata,
    p_user_id,
    p_team_id,
    p_language,
    NOW(),
    NOW()
  )
  ON CONFLICT (source_type, source_id, content_type)
  DO UPDATE SET
    content_text = EXCLUDED.content_text,
    embedding = EXCLUDED.embedding,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING id INTO embedding_id;

  RETURN embedding_id;
END;
$$;

-- Create a function to fix receipt embedding content
CREATE OR REPLACE FUNCTION fix_receipt_embedding_content()
RETURNS TABLE (
  receipt_id UUID,
  content_type TEXT,
  status TEXT,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  receipt_data RECORD;
  new_content TEXT;
BEGIN
  -- Fix embeddings with empty or null content
  FOR rec IN
    SELECT ue.id, ue.source_id, ue.content_type, ue.content_text
    FROM unified_embeddings ue
    WHERE ue.source_type = 'receipt'
      AND (ue.content_text IS NULL OR TRIM(ue.content_text) = '')
  LOOP
    BEGIN
      -- Get receipt data
      SELECT r.merchant, r."fullText", r.notes
      INTO receipt_data
      FROM receipts r
      WHERE r.id = rec.source_id;

      IF NOT FOUND THEN
        RETURN QUERY SELECT rec.source_id, rec.content_type, 'error', 'Receipt not found';
        CONTINUE;
      END IF;

      -- Determine new content based on content type
      CASE rec.content_type
        WHEN 'full_text' THEN
          new_content := COALESCE(receipt_data."fullText", '');
        WHEN 'merchant' THEN
          new_content := COALESCE(receipt_data.merchant, '');
        WHEN 'notes' THEN
          new_content := COALESCE(receipt_data.notes, '');
        ELSE
          new_content := COALESCE(receipt_data.merchant, 'Unknown');
      END CASE;

      -- Update if we have content
      IF new_content IS NOT NULL AND TRIM(new_content) != '' THEN
        UPDATE unified_embeddings
        SET content_text = new_content, updated_at = NOW()
        WHERE id = rec.id;

        RETURN QUERY SELECT rec.source_id, rec.content_type, 'fixed', 'Content updated';
      ELSE
        RETURN QUERY SELECT rec.source_id, rec.content_type, 'skipped', 'No content available';
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT rec.source_id, rec.content_type, 'error', SQLERRM;
    END;
  END LOOP;
END;
$$;

-- Create a view for embedding content health
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

-- Add unique constraint to prevent duplicates
ALTER TABLE unified_embeddings
ADD CONSTRAINT unique_unified_embedding
UNIQUE (source_type, source_id, content_type);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION migrate_receipt_embeddings_to_unified TO authenticated;
GRANT EXECUTE ON FUNCTION find_receipts_missing_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION get_embedding_migration_stats TO authenticated;
GRANT EXECUTE ON FUNCTION add_unified_embedding TO authenticated;
GRANT EXECUTE ON FUNCTION fix_receipt_embedding_content TO authenticated;
GRANT SELECT ON embedding_content_health TO authenticated;
