-- Migration to add a function for regenerating line item embeddings

-- Function to regenerate embeddings for line items and store in the unified embeddings table
CREATE OR REPLACE FUNCTION update_line_item_embedding(
  p_line_item_id UUID,
  p_embedding vector(1536)
) 
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt_id UUID;
  v_embedding_id UUID;
BEGIN
  -- Get the receipt_id for this line item
  SELECT receipt_id INTO v_receipt_id
  FROM line_items
  WHERE id = p_line_item_id;
  
  IF v_receipt_id IS NULL THEN
    RAISE EXCEPTION 'Line item % not found', p_line_item_id;
  END IF;

  -- Use the add_embedding function to update or insert the embedding
  -- This handles the case where the embedding already exists or needs to be created
  SELECT add_embedding(
    'line_item',            -- source_type
    p_line_item_id,         -- source_id
    v_receipt_id,           -- receipt_id
    'line_item',            -- content_type
    p_embedding,            -- embedding
    jsonb_build_object('updated_at', NOW(), 'regenerated', true)  -- metadata with regeneration flag
  ) INTO v_embedding_id;
  
  RETURN v_embedding_id;
END;
$$;
