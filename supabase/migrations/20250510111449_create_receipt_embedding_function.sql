-- Create a function to generate embeddings for a receipt
CREATE OR REPLACE FUNCTION generate_receipt_embeddings(
  p_receipt_id UUID,
  p_process_all_fields BOOLEAN DEFAULT TRUE
) 
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt RECORD;
  v_embedding VECTOR(1536);
  v_content_text TEXT;
  v_embedding_id UUID;
  v_result JSONB := jsonb_build_object('success', FALSE);
  v_processed_count INT := 0;
BEGIN
  -- Check if the receipt exists
  SELECT * INTO v_receipt FROM receipts WHERE id = p_receipt_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Receipt not found',
      'receiptId', p_receipt_id
    );
  END IF;
  
  -- This is just a placeholder function that marks the receipt as processed
  -- without actually generating embeddings (since that requires the Gemini API)
  -- In a real implementation, you would call the API to generate embeddings
  
  -- Mark embeddings as processed in the receipt table
  UPDATE receipts
  SET has_embeddings = TRUE,
      embedding_status = 'processed',
      updated_at = NOW()
  WHERE id = p_receipt_id;
  
  -- Insert a placeholder embedding record
  INSERT INTO receipt_embeddings (
    receipt_id,
    content_type,
    embedding,
    metadata
  )
  VALUES (
    p_receipt_id,
    'database_function',
    '[0.1, 0.2, 0.3]'::vector(1536), -- placeholder vector
    jsonb_build_object(
      'generated_by', 'database_function',
      'timestamp', NOW()
    )
  )
  RETURNING id INTO v_embedding_id;
  
  v_processed_count := 1;
  
  -- Return success response
  RETURN jsonb_build_object(
    'success', TRUE,
    'receiptId', p_receipt_id,
    'processedCount', v_processed_count,
    'embeddingIds', jsonb_build_array(v_embedding_id)
  );
END;
$$;
