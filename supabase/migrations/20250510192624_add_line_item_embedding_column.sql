-- Add embedding column to line_items table
ALTER TABLE public.line_items
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create index for vector similarity search on line_items
CREATE INDEX IF NOT EXISTS line_items_embedding_idx ON public.line_items
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Function to generate embeddings for line items
CREATE OR REPLACE FUNCTION generate_line_item_embeddings(
  p_line_item_id UUID,
  p_embedding vector(1536)
) 
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the line item with the provided embedding
  UPDATE public.line_items
  SET 
    embedding = p_embedding,
    updated_at = NOW()
  WHERE id = p_line_item_id;
  
  RETURN FOUND;
END;
$$;
