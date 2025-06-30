-- Test Temporal Search Database Function
-- Run this to verify the temporal search is working at the database level

-- First, check if the unified_search function exists and its signature
SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname = 'unified_search';

-- Check if we have any receipts in the database
SELECT 
  COUNT(*) as total_receipts,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM receipts;

-- Check if we have any recent receipts (last 7 days)
SELECT 
  COUNT(*) as recent_receipts,
  MIN(date) as earliest_recent,
  MAX(date) as latest_recent
FROM receipts 
WHERE date >= CURRENT_DATE - INTERVAL '7 days';

-- Test the temporal search function with a dummy embedding
-- This tests if the function accepts the new parameters
SELECT
  COUNT(*) as search_results
FROM unified_search(
  array_fill(0.1, ARRAY[1536])::VECTOR(1536), -- dummy embedding
  ARRAY['receipt'], -- source types
  NULL, -- content types
  0.0, -- very low similarity threshold to get all results
  100, -- match count
  NULL, -- user filter (will be handled by RLS)
  NULL, -- team filter
  NULL, -- language filter
  (CURRENT_DATE - INTERVAL '3 days')::DATE, -- start_date (last 3 days)
  CURRENT_DATE::DATE, -- end_date (today)
  NULL, -- min_amount
  NULL  -- max_amount
);

-- Test yesterday's receipts
SELECT
  COUNT(*) as yesterday_results
FROM unified_search(
  array_fill(0.1, ARRAY[1536])::VECTOR(1536), -- dummy embedding
  ARRAY['receipt'], -- source types
  NULL, -- content types
  0.0, -- very low similarity threshold
  100, -- match count
  NULL, NULL, NULL,
  (CURRENT_DATE - INTERVAL '1 day')::DATE, -- yesterday start
  (CURRENT_DATE - INTERVAL '1 day')::DATE, -- yesterday end
  NULL, NULL
);

-- Check if unified_embeddings table has receipt data
SELECT 
  source_type,
  COUNT(*) as embedding_count
FROM unified_embeddings 
WHERE source_type = 'receipt'
GROUP BY source_type;

-- Check if receipts are properly linked to embeddings
SELECT 
  COUNT(DISTINCT r.id) as receipts_with_embeddings,
  COUNT(DISTINCT ue.source_id) as embedding_source_ids
FROM receipts r
LEFT JOIN unified_embeddings ue ON ue.source_type = 'receipt' AND ue.source_id = r.id;
