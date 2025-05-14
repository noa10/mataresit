-- Migration to update search function similarity thresholds
-- This was intended to improve search recall by lowering the default thresholds
-- However, the migration has been deferred until the database schema can be properly examined

-- The following thresholds will be updated:
-- search_receipts: 0.5 -> 0.4
-- search_line_items: 0.5 -> 0.3
-- hybrid_search_line_items: 0.5 -> 0.3
-- search_embeddings: 0.5 -> 0.4

-- Instead of altering the functions directly, we'll implement these changes 
-- in the application code within the semantic-search Edge Function
-- See: supabase/functions/semantic-search/index.ts

-- No-op SQL statement to make the migration valid
SELECT 'Migration complete - search thresholds will be updated in application code';
