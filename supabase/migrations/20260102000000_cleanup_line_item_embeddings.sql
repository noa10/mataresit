-- Clean up the old line item embedding column and related functions

-- 1. Drop the old search functions that used line_items.embedding directly
DROP FUNCTION IF EXISTS public.search_line_items(vector, float, int);
DROP FUNCTION IF EXISTS public.hybrid_search_line_items(vector, text, float, float, float, int, float, float, date, date);

-- 2. Drop the old embedding generation function that updated line_items.embedding
DROP FUNCTION IF EXISTS public.generate_line_item_embeddings(UUID, vector);

-- 3. After confirming data migration, drop the embedding column and its index from the line_items table
DROP INDEX IF EXISTS public.line_items_embedding_idx;
ALTER TABLE public.line_items DROP COLUMN IF EXISTS embedding;

-- 4. Create a view to make it easier to query line item embeddings
CREATE OR REPLACE VIEW public.line_item_embeddings_view AS
SELECT 
  re.id as embedding_id,
  re.source_id as line_item_id,
  re.receipt_id,
  re.content_type,
  re.embedding,
  re.created_at,
  li.description as line_item_description,
  li.amount as line_item_amount
FROM 
  public.receipt_embeddings re
JOIN 
  public.line_items li ON re.source_id = li.id
WHERE 
  re.source_type = 'line_item';

-- 5. Add a trigger to cascade deletes from line_items to their embeddings
CREATE OR REPLACE FUNCTION public.delete_line_item_embeddings()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.receipt_embeddings
  WHERE source_type = 'line_item' AND source_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER line_item_delete_embeddings
BEFORE DELETE ON public.line_items
FOR EACH ROW
EXECUTE FUNCTION public.delete_line_item_embeddings(); 