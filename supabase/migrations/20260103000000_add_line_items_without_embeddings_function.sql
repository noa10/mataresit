-- Migration to add a function for retrieving line items without embeddings
-- This function helps optimize the line item embedding generation process

-- Function to get line items without embeddings for a specific receipt
CREATE OR REPLACE FUNCTION get_line_items_without_embeddings_for_receipt(p_receipt_id uuid)
RETURNS TABLE(id uuid, description text, amount numeric) AS $$
BEGIN
  RETURN QUERY
  SELECT li.id, li.description, li.amount
  FROM public.line_items li
  WHERE li.receipt_id = p_receipt_id
    AND li.description IS NOT NULL -- Only include items that can be processed
    AND NOT EXISTS ( -- Check if embedding does NOT exist in the receipt_embeddings table
       SELECT 1
       FROM public.receipt_embeddings re
       WHERE re.content_type = 'line_item'
         AND re.receipt_id = p_receipt_id
         -- Use a JSON field to store the line item ID since we don't have source_id
         AND (re.metadata->>'line_item_id')::uuid = li.id
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION get_line_items_without_embeddings_for_receipt(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION get_line_items_without_embeddings_for_receipt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_line_items_without_embeddings_for_receipt(uuid) TO anon;
