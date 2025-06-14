-- Migration to add a function for retrieving receipts that have line items without embeddings
-- This function helps optimize the line item embedding generation process

-- Function to get receipts that have line items without embeddings
CREATE OR REPLACE FUNCTION get_receipts_with_missing_line_item_embeddings(p_limit integer DEFAULT 50)
RETURNS TABLE(id uuid) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT r.id
  FROM public.receipts r
  WHERE EXISTS (
    SELECT 1
    FROM public.line_items li
    WHERE li.receipt_id = r.id
      AND li.description IS NOT NULL -- Only include items that can be processed
      AND NOT EXISTS ( -- Check if embedding does NOT exist in the receipt_embeddings table
         SELECT 1
         FROM public.receipt_embeddings re
         WHERE re.content_type = 'line_item'
           AND re.receipt_id = r.id
           AND (re.metadata->>'line_item_id')::uuid = li.id
      )
  )
  ORDER BY r.date DESC -- Order by most recent first
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION get_receipts_with_missing_line_item_embeddings(integer) TO service_role;
GRANT EXECUTE ON FUNCTION get_receipts_with_missing_line_item_embeddings(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_receipts_with_missing_line_item_embeddings(integer) TO anon;
