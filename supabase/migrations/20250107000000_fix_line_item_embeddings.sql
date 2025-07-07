-- Fix line item embeddings in unified_embeddings table
-- This migration corrects the critical bug where line item embeddings contain merchant names instead of product descriptions

-- Step 1: Create function to fix existing wrong line item embeddings
CREATE OR REPLACE FUNCTION fix_line_item_embeddings()
RETURNS TABLE (
  line_item_id UUID,
  embedding_id UUID,
  old_content TEXT,
  new_content TEXT,
  status TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  line_item_data RECORD;
  new_content_text TEXT;
  fix_success BOOLEAN;
  error_msg TEXT;
BEGIN
  -- Fix all line item embeddings that contain wrong content (merchant names)
  FOR rec IN 
    SELECT 
      ue.id as embedding_id,
      ue.content_text as current_content,
      ue.metadata->>'line_item_id' as line_item_id,
      ue.source_id as receipt_id
    FROM unified_embeddings ue
    WHERE ue.source_type = 'receipt' 
      AND ue.content_type = 'line_item'
      AND ue.metadata->>'line_item_id' IS NOT NULL
  LOOP
    BEGIN
      -- Get the actual line item description
      SELECT li.id, li.description, li.amount, li.receipt_id
      INTO line_item_data
      FROM line_items li
      WHERE li.id = rec.line_item_id::uuid;

      IF NOT FOUND THEN
        -- Line item not found, return error
        line_item_id := rec.line_item_id::uuid;
        embedding_id := rec.embedding_id;
        old_content := rec.current_content;
        new_content := NULL;
        status := 'error';
        error_message := 'Line item not found';
        RETURN NEXT;
        CONTINUE;
      END IF;

      -- Use the actual line item description
      new_content_text := TRIM(line_item_data.description);

      -- Skip if no description available
      IF new_content_text IS NULL OR new_content_text = '' THEN
        line_item_id := rec.line_item_id::uuid;
        embedding_id := rec.embedding_id;
        old_content := rec.current_content;
        new_content := new_content_text;
        status := 'skipped';
        error_message := 'No line item description available';
        RETURN NEXT;
        CONTINUE;
      END IF;

      -- Update the embedding with correct content
      UPDATE unified_embeddings 
      SET 
        content_text = new_content_text,
        updated_at = NOW()
      WHERE id = rec.embedding_id;

      -- Return success result
      line_item_id := rec.line_item_id::uuid;
      embedding_id := rec.embedding_id;
      old_content := rec.current_content;
      new_content := new_content_text;
      status := 'fixed';
      error_message := NULL;
      RETURN NEXT;

    EXCEPTION WHEN OTHERS THEN
      -- Return error result
      line_item_id := rec.line_item_id::uuid;
      embedding_id := rec.embedding_id;
      old_content := rec.current_content;
      new_content := NULL;
      status := 'error';
      error_message := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

-- Step 2: Create function to generate embeddings for missing line items
CREATE OR REPLACE FUNCTION find_line_items_missing_embeddings(
  limit_count INTEGER DEFAULT 100
)
RETURNS TABLE (
  line_item_id UUID,
  receipt_id UUID,
  description TEXT,
  amount NUMERIC,
  merchant TEXT,
  receipt_date DATE,
  user_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    li.id as line_item_id,
    li.receipt_id,
    li.description,
    li.amount,
    r.merchant,
    r.date as receipt_date,
    r.user_id
  FROM line_items li
  JOIN receipts r ON li.receipt_id = r.id
  WHERE li.description IS NOT NULL 
    AND TRIM(li.description) != ''
    AND NOT EXISTS (
      SELECT 1 FROM unified_embeddings ue 
      WHERE ue.source_type = 'receipt' 
        AND ue.content_type = 'line_item'
        AND ue.metadata->>'line_item_id' = li.id::text
    )
  ORDER BY r.date DESC, li.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Step 3: Create function to get line item embedding statistics
CREATE OR REPLACE FUNCTION get_line_item_embedding_stats()
RETURNS TABLE (
  total_line_items BIGINT,
  line_items_with_embeddings BIGINT,
  line_items_missing_embeddings BIGINT,
  coverage_percentage NUMERIC,
  wrong_content_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM line_items WHERE description IS NOT NULL AND TRIM(description) != '') as total_line_items,
    (SELECT COUNT(*) FROM unified_embeddings ue 
     WHERE ue.source_type = 'receipt' 
       AND ue.content_type = 'line_item'
       AND ue.metadata->>'line_item_id' IS NOT NULL) as line_items_with_embeddings,
    (SELECT COUNT(*) FROM find_line_items_missing_embeddings(10000)) as line_items_missing_embeddings,
    ROUND(
      (SELECT COUNT(*) FROM unified_embeddings ue 
       WHERE ue.source_type = 'receipt' 
         AND ue.content_type = 'line_item'
         AND ue.metadata->>'line_item_id' IS NOT NULL)::NUMERIC / 
      NULLIF((SELECT COUNT(*) FROM line_items WHERE description IS NOT NULL AND TRIM(description) != '')::NUMERIC, 0) * 100,
      2
    ) as coverage_percentage,
    (SELECT COUNT(*) FROM unified_embeddings ue
     JOIN line_items li ON ue.metadata->>'line_item_id' = li.id::text
     WHERE ue.source_type = 'receipt' 
       AND ue.content_type = 'line_item'
       AND ue.content_text != li.description) as wrong_content_count;
END;
$$;

-- Step 4: Create improved migration function with proper line item handling
CREATE OR REPLACE FUNCTION migrate_receipt_embeddings_to_unified_fixed()
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
  line_item_data RECORD;
  content_text TEXT;
BEGIN
  -- Migrate existing receipt_embeddings to unified_embeddings with proper line item handling
  FOR rec IN 
    SELECT re.id, re.receipt_id, re.content_type, re.embedding, re.metadata, re.created_at
    FROM receipt_embeddings re
    WHERE NOT EXISTS (
      SELECT 1 FROM unified_embeddings ue 
      WHERE ue.source_type = 'receipt' 
        AND ue.source_id = re.receipt_id 
        AND ue.content_type = re.content_type
        AND (
          (re.content_type != 'line_item') OR 
          (re.content_type = 'line_item' AND ue.metadata->>'line_item_id' = re.metadata->>'line_item_id')
        )
    )
  LOOP
    BEGIN
      -- Get receipt data
      SELECT r.merchant, r."fullText", r.notes, r.user_id, r.date, r.total
      INTO receipt_data
      FROM receipts r
      WHERE r.id = rec.receipt_id;
      
      IF NOT FOUND THEN
        skipped_count := skipped_count + 1;
        CONTINUE;
      END IF;
      
      -- Construct content_text based on content_type with PROPER line item handling
      CASE rec.content_type
        WHEN 'full_text' THEN
          content_text := COALESCE(receipt_data."fullText", '');
        WHEN 'merchant' THEN
          content_text := COALESCE(receipt_data.merchant, '');
        WHEN 'notes' THEN
          content_text := COALESCE(receipt_data.notes, '');
        WHEN 'line_item' THEN
          -- CRITICAL FIX: Extract actual line item description
          IF rec.metadata->>'line_item_id' IS NOT NULL THEN
            SELECT li.description INTO content_text
            FROM line_items li
            WHERE li.id = (rec.metadata->>'line_item_id')::uuid;
            
            IF content_text IS NULL OR TRIM(content_text) = '' THEN
              content_text := COALESCE(receipt_data.merchant, 'Unknown Product');
            END IF;
          ELSE
            content_text := COALESCE(receipt_data.merchant, 'Unknown Product');
          END IF;
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
        CONTINUE;
      END IF;
      
      -- Insert into unified_embeddings
      INSERT INTO unified_embeddings (
        source_type, source_id, content_type, content_text,
        embedding, metadata, user_id, language, created_at
      ) VALUES (
        'receipt', rec.receipt_id, rec.content_type, content_text,
        rec.embedding, 
        COALESCE(rec.metadata, '{}'::JSONB) || jsonb_build_object(
          'migrated_from', 'receipt_embeddings',
          'migration_date', NOW(),
          'receipt_date', receipt_data.date,
          'receipt_total', receipt_data.total
        ),
        receipt_data.user_id, 'en', rec.created_at
      );
      
      migrated_count := migrated_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
    END;
  END LOOP;
  
  RETURN QUERY SELECT migrated_count, skipped_count, error_count, details;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION fix_line_item_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION find_line_items_missing_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION get_line_item_embedding_stats TO authenticated;
GRANT EXECUTE ON FUNCTION migrate_receipt_embeddings_to_unified_fixed TO authenticated;

-- Add comments
COMMENT ON FUNCTION fix_line_item_embeddings IS 'Fixes existing line item embeddings that contain wrong content (merchant names instead of product descriptions)';
COMMENT ON FUNCTION find_line_items_missing_embeddings IS 'Finds line items that are missing embeddings entirely';
COMMENT ON FUNCTION get_line_item_embedding_stats IS 'Provides comprehensive statistics about line item embedding coverage and accuracy';
COMMENT ON FUNCTION migrate_receipt_embeddings_to_unified_fixed IS 'Improved migration function with proper line item content extraction';
