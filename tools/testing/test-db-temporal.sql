-- Test temporal search database function
-- This tests if the unified_search function properly filters by date

-- Test 1: Check if we have any receipts in the database
SELECT 
  COUNT(*) as total_receipts,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM receipts;

-- Test 2: Check receipts from yesterday (2025-07-14)
SELECT 
  COUNT(*) as yesterday_receipts,
  ARRAY_AGG(DISTINCT date ORDER BY date) as dates_found
FROM receipts 
WHERE date = '2025-07-14';

-- Test 3: Check receipts from today (2025-07-15)
SELECT 
  COUNT(*) as today_receipts,
  ARRAY_AGG(DISTINCT date ORDER BY date) as dates_found
FROM receipts 
WHERE date = '2025-07-15';

-- Test 4: Check receipts from last week (2025-07-06 to 2025-07-13)
SELECT 
  COUNT(*) as last_week_receipts,
  ARRAY_AGG(DISTINCT date ORDER BY date) as dates_found
FROM receipts 
WHERE date >= '2025-07-06' AND date <= '2025-07-13';

-- Test 5: Test the unified_search function with temporal filtering
-- This uses a dummy embedding to test the date filtering logic
SELECT
  COUNT(*) as search_results_yesterday
FROM unified_search(
  array_fill(0.1, ARRAY[1536])::VECTOR(1536), -- dummy embedding
  ARRAY['receipt'], -- source types
  NULL, -- content types
  0.0, -- very low similarity threshold to get all results
  100, -- match count
  NULL, -- user filter (will be handled by RLS)
  NULL, -- team filter
  NULL, -- language filter
  '2025-07-14'::DATE, -- start_date (yesterday)
  '2025-07-14'::DATE, -- end_date (yesterday)
  NULL, -- min_amount
  NULL  -- max_amount
);

-- Test 6: Test the unified_search function for today
SELECT
  COUNT(*) as search_results_today
FROM unified_search(
  array_fill(0.1, ARRAY[1536])::VECTOR(1536), -- dummy embedding
  ARRAY['receipt'], -- source types
  NULL, -- content types
  0.0, -- very low similarity threshold to get all results
  100, -- match count
  NULL, -- user filter (will be handled by RLS)
  NULL, -- team filter
  NULL, -- language filter
  '2025-07-15'::DATE, -- start_date (today)
  '2025-07-15'::DATE, -- end_date (today)
  NULL, -- min_amount
  NULL  -- max_amount
);
