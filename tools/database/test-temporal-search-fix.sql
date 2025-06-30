-- Test script to verify the temporal search fix
-- This script tests that the enhanced_hybrid_search function now properly supports receipt_ids_filter

-- First, let's check what receipts exist for June 27, 2025
SELECT 
  id, 
  merchant, 
  total, 
  date, 
  created_at
FROM receipts 
WHERE date = '2025-06-27'
ORDER BY created_at DESC;

-- Get a sample user ID for testing
SELECT id as user_id FROM auth.users LIMIT 1;

-- Test the enhanced_hybrid_search function with receipt_ids_filter
-- We'll use a mock embedding vector (all zeros for testing)
WITH test_receipt_ids AS (
  SELECT ARRAY_AGG(id) as receipt_ids
  FROM receipts 
  WHERE date = '2025-06-27'
  LIMIT 5
),
mock_embedding AS (
  SELECT ARRAY(SELECT 0.0 FROM generate_series(1, 1536))::vector(1536) as embedding
)
SELECT 
  'Testing enhanced_hybrid_search with receipt_ids_filter' as test_description,
  COUNT(*) as result_count
FROM enhanced_hybrid_search(
  (SELECT embedding FROM mock_embedding),
  'receipts',
  ARRAY['receipt'],
  NULL,
  0.0, -- Very low similarity threshold for testing
  0.0, -- Very low trigram threshold for testing
  0.6,
  0.25,
  0.15,
  50,
  (SELECT id FROM auth.users LIMIT 1), -- Use first user
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  (SELECT receipt_ids FROM test_receipt_ids) -- Filter to June 27 receipts only
);

-- Test without receipt_ids_filter to compare
SELECT 
  'Testing enhanced_hybrid_search WITHOUT receipt_ids_filter' as test_description,
  COUNT(*) as result_count
FROM enhanced_hybrid_search(
  ARRAY(SELECT 0.0 FROM generate_series(1, 1536))::vector(1536),
  'receipts',
  ARRAY['receipt'],
  NULL,
  0.0,
  0.0,
  0.6,
  0.25,
  0.15,
  50,
  (SELECT id FROM auth.users LIMIT 1),
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL -- No receipt filter
);

-- Verify the function signature includes receipt_ids_filter
SELECT 
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'enhanced_hybrid_search'
AND n.nspname = 'public';
