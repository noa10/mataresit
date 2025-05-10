-- Create a function to provide fallback text search when vector search fails
CREATE OR REPLACE FUNCTION basic_search_receipts(
  p_query TEXT,
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_min_amount NUMERIC DEFAULT NULL,
  p_max_amount NUMERIC DEFAULT NULL,
  p_merchants TEXT[] DEFAULT NULL
) 
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query TEXT := p_query;
  v_receipts JSONB;
  v_total_count INTEGER;
  v_result JSONB;
BEGIN
  -- Convert query to lowercase and escape special characters
  v_query := lower(v_query);
  
  -- First count total matching results
  WITH matching_receipts AS (
    SELECT r.id
    FROM receipts r
    WHERE 
      -- Text search (basic like pattern)
      (
        v_query IS NULL OR v_query = '' OR
        lower(r.merchant) LIKE '%' || v_query || '%' OR
        CASE WHEN r.fulltext IS NOT NULL THEN lower(r.fulltext) ELSE '' END LIKE '%' || v_query || '%' OR
        CASE WHEN r.predicted_category IS NOT NULL THEN lower(r.predicted_category) ELSE '' END LIKE '%' || v_query || '%'
      )
      -- Date range filter
      AND (p_start_date IS NULL OR r.date >= p_start_date)
      AND (p_end_date IS NULL OR r.date <= p_end_date)
      -- Amount range filter
      AND (p_min_amount IS NULL OR r.total >= p_min_amount)
      AND (p_max_amount IS NULL OR r.total <= p_max_amount)
      -- Merchants filter
      AND (p_merchants IS NULL OR r.merchant = ANY(p_merchants))
  )
  SELECT COUNT(*) INTO v_total_count FROM matching_receipts;
  
  -- Then get the actual receipts with pagination
  WITH matching_receipts AS (
    SELECT 
      r.*,
      CASE
        WHEN lower(r.merchant) LIKE '%' || v_query || '%' THEN 0.9
        WHEN CASE WHEN r.predicted_category IS NOT NULL THEN lower(r.predicted_category) ELSE '' END LIKE '%' || v_query || '%' THEN 0.7
        WHEN CASE WHEN r.fulltext IS NOT NULL THEN lower(r.fulltext) ELSE '' END LIKE '%' || v_query || '%' THEN 0.5
        ELSE 0.1
      END AS match_score
    FROM receipts r
    WHERE 
      -- Text search (basic like pattern)
      (
        v_query IS NULL OR v_query = '' OR
        lower(r.merchant) LIKE '%' || v_query || '%' OR
        CASE WHEN r.fulltext IS NOT NULL THEN lower(r.fulltext) ELSE '' END LIKE '%' || v_query || '%' OR
        CASE WHEN r.predicted_category IS NOT NULL THEN lower(r.predicted_category) ELSE '' END LIKE '%' || v_query || '%'
      )
      -- Date range filter
      AND (p_start_date IS NULL OR r.date >= p_start_date)
      AND (p_end_date IS NULL OR r.date <= p_end_date)
      -- Amount range filter
      AND (p_min_amount IS NULL OR r.total >= p_min_amount)
      AND (p_max_amount IS NULL OR r.total <= p_max_amount)
      -- Merchants filter
      AND (p_merchants IS NULL OR r.merchant = ANY(p_merchants))
    ORDER BY match_score DESC, r.date DESC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_agg(jsonb_build_object(
    'id', r.id,
    'date', r.date,
    'merchant', r.merchant,
    'total', r.total,
    'currency', r.currency,
    'predicted_category', r.predicted_category,
    'status', r.status,
    'processing_status', r.processing_status,
    'similarity_score', r.match_score
  )) INTO v_receipts
  FROM matching_receipts r;
  
  -- Handle empty results
  IF v_receipts IS NULL THEN
    v_receipts := '[]'::jsonb;
  END IF;
  
  -- Build the final response
  v_result := jsonb_build_object(
    'success', TRUE,
    'results', jsonb_build_object(
      'receipts', v_receipts,
      'count', jsonb_array_length(v_receipts),
      'total', v_total_count
    ),
    'searchParams', jsonb_build_object(
      'query', p_query,
      'isVectorSearch', FALSE
    )
  );
  
  RETURN v_result;
END;
$$;
