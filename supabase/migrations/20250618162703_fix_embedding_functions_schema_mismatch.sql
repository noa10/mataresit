-- Fix the embedding functions that have schema mismatches

-- 1. Fix migrate_receipt_embeddings_to_unified function
-- The issue: trying to access re.user_id which doesn't exist in receipt_embeddings table
CREATE OR REPLACE FUNCTION migrate_receipt_embeddings_to_unified()
RETURNS TABLE (
  migrated_count BIGINT,
  skipped_count BIGINT,
  error_count BIGINT,
  total_processed BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  migrated BIGINT := 0;
  skipped BIGINT := 0;
  errors BIGINT := 0;
  total BIGINT := 0;
  rec RECORD;
  receipt_data RECORD;
  content_text TEXT;
BEGIN
  -- Process old receipt embeddings
  -- JOIN with receipts table to get user_id
  FOR rec IN
    SELECT re.id, re.receipt_id, re.content_type, re.embedding, re.metadata, re.created_at,
           r.user_id, r.merchant, r."fullText", r.notes, r.date, r.total
    FROM receipt_embeddings re
    INNER JOIN receipts r ON r.id = re.receipt_id
    LEFT JOIN unified_embeddings ue ON ue.source_id = re.receipt_id
                                    AND ue.source_type = 'receipt'
                                    AND ue.content_type = re.content_type
    WHERE ue.id IS NULL
  LOOP
    BEGIN
      total := total + 1;

      -- Determine content text based on content type
      CASE rec.content_type
        WHEN 'full_text' THEN
          content_text := COALESCE(rec."fullText", '');
        WHEN 'merchant' THEN
          content_text := COALESCE(rec.merchant, '');
        WHEN 'notes' THEN
          content_text := COALESCE(rec.notes, '');
        ELSE
          content_text := COALESCE(rec.merchant, ''); -- fallback
      END CASE;

      -- Skip if content is empty
      IF content_text IS NULL OR TRIM(content_text) = '' THEN
        skipped := skipped + 1;
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
        created_at,
        updated_at
      ) VALUES (
        'receipt',
        rec.receipt_id,
        rec.content_type,
        content_text,
        rec.embedding,
        COALESCE(rec.metadata, '{}'::JSONB) || jsonb_build_object(
          'migrated_from', 'receipt_embeddings',
          'migration_date', NOW(),
          'receipt_date', rec.date,
          'receipt_total', rec.total
        ),
        rec.user_id,
        'en',
        rec.created_at,
        NOW()
      );

      migrated := migrated + 1;

    EXCEPTION WHEN OTHERS THEN
      errors := errors + 1;
      RAISE WARNING 'Error migrating embedding for receipt %: %', rec.receipt_id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT migrated, skipped, errors, total;
END;
$$;

-- 2. Fix find_receipts_missing_embeddings function
-- The issue: function signature doesn't match what Edge Function expects
CREATE OR REPLACE FUNCTION find_receipts_missing_embeddings(limit_count INT DEFAULT 10)
RETURNS TABLE (
  receipt_id UUID,
  merchant TEXT,
  date DATE,
  missing_content_types TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.merchant,
    r.date,
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
    ) AS missing_content_types
  FROM receipts r
  WHERE EXISTS (
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
  )
  ORDER BY r.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION migrate_receipt_embeddings_to_unified TO authenticated;
GRANT EXECUTE ON FUNCTION find_receipts_missing_embeddings TO authenticated;