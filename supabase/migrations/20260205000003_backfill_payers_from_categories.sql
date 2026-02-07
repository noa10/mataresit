-- Migration: Backfill payers from payer-named categories
-- Date: 2026-02-05
-- Purpose: Migrate "Bakaris"/"Abah" category data to paid_by table, infer categories from predicted_category

-- This migration is idempotent - can be run multiple times safely

-- =============================================
-- 1. CREATE PAYERS FROM PAYER-NAMED CATEGORIES
-- =============================================

-- Insert payers from existing payer-named categories
-- Uses ON CONFLICT to handle duplicates if run multiple times
INSERT INTO public.paid_by (user_id, team_id, name, created_at)
SELECT DISTINCT 
  cc.user_id, 
  cc.team_id, 
  cc.name,
  cc.created_at
FROM public.custom_categories cc
WHERE lower(cc.name) IN ('bakaris', 'abah')
ON CONFLICT (user_id, COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name)) 
DO NOTHING;

-- =============================================
-- 2. UPDATE RECEIPTS WITH PAYER AND INFERRED CATEGORY
-- =============================================

-- First, create a temporary table for category mappings
CREATE TEMP TABLE IF NOT EXISTS category_mapping (
  predicted text PRIMARY KEY,
  category_pattern text
);

-- Insert common mappings (case-insensitive matching will be used)
INSERT INTO category_mapping VALUES
  ('groceries', 'food%'),
  ('dining', 'food%'),
  ('food', 'food%'),
  ('restaurant', 'food%'),
  ('shopping', 'shopping'),
  ('transportation', 'transportation'),
  ('transport', 'transportation'),
  ('travel', 'travel%'),
  ('utilities', 'utilities'),
  ('healthcare', 'healthcare'),
  ('medical', 'healthcare'),
  ('entertainment', 'entertainment'),
  ('business', 'business'),
  ('equipment', 'equipment'),
  ('office', 'office%'),
  ('meals', 'meals%')
ON CONFLICT (predicted) DO NOTHING;

-- Update receipts: set paid_by_id and try to infer category
-- This is done in a single UPDATE using subqueries

WITH affected_receipts AS (
  SELECT 
    r.id as receipt_id,
    r.user_id as receipt_user_id,
    r.team_id as receipt_team_id,
    r.predicted_category,
    cc.id as old_category_id,
    cc.name as old_category_name,
    cc.team_id as category_team_id
  FROM public.receipts r
  JOIN public.custom_categories cc ON r.custom_category_id = cc.id
  WHERE lower(cc.name) IN ('bakaris', 'abah')
),
payer_lookup AS (
  SELECT 
    ar.receipt_id,
    pb.id as payer_id
  FROM affected_receipts ar
  JOIN public.paid_by pb ON 
    pb.user_id = ar.receipt_user_id
    AND COALESCE(pb.team_id, '00000000-0000-0000-0000-000000000000') = COALESCE(ar.category_team_id, '00000000-0000-0000-0000-000000000000')
    AND lower(pb.name) = lower(ar.old_category_name)
),
category_lookup AS (
  -- Try to find matching category based on predicted_category
  SELECT 
    ar.receipt_id,
    (
      SELECT c.id 
      FROM public.custom_categories c
      WHERE c.user_id = ar.receipt_user_id
        AND COALESCE(c.team_id, '00000000-0000-0000-0000-000000000000') = COALESCE(ar.receipt_team_id, '00000000-0000-0000-0000-000000000000')
        AND lower(c.name) NOT IN ('bakaris', 'abah')
        AND (
          -- Direct name match
          lower(c.name) = lower(ar.predicted_category)
          OR
          -- "Dining" matches "Food & Dining"
          (lower(ar.predicted_category) = 'dining' AND lower(c.name) LIKE 'food%')
          OR
          -- "Groceries" matches "Food & Dining" or "Shopping"
          (lower(ar.predicted_category) = 'groceries' AND (lower(c.name) LIKE 'food%' OR lower(c.name) = 'shopping'))
          OR
          -- "Transportation" exact match
          (lower(ar.predicted_category) = 'transportation' AND lower(c.name) = 'transportation')
          OR
          -- "Travel" matches "Travel" or "Travel & Transport"
          (lower(ar.predicted_category) = 'travel' AND lower(c.name) LIKE 'travel%')
        )
      LIMIT 1
    ) as inferred_category_id
  FROM affected_receipts ar
  WHERE ar.predicted_category IS NOT NULL 
    AND ar.predicted_category != ''
    AND lower(ar.predicted_category) != lower(ar.old_category_name)
)
UPDATE public.receipts r
SET 
  paid_by_id = pl.payer_id,
  custom_category_id = COALESCE(cl.inferred_category_id, NULL),
  updated_at = now()
FROM payer_lookup pl
LEFT JOIN category_lookup cl ON pl.receipt_id = cl.receipt_id
WHERE r.id = pl.receipt_id;

-- =============================================
-- 3. ARCHIVE/DELETE PAYER-NAMED CATEGORIES
-- =============================================

-- First archive them (in case we need to reference later)
UPDATE public.custom_categories
SET archived = true, updated_at = now()
WHERE lower(name) IN ('bakaris', 'abah');

-- Then delete them permanently (per user request)
DELETE FROM public.custom_categories
WHERE lower(name) IN ('bakaris', 'abah');

-- =============================================
-- 4. CLEANUP
-- =============================================

DROP TABLE IF EXISTS category_mapping;

-- Log migration results (for debugging, check via SQL console)
DO $$
DECLARE
  v_payers_created int;
  v_receipts_migrated int;
  v_categories_deleted int;
BEGIN
  SELECT COUNT(*) INTO v_payers_created FROM public.paid_by WHERE lower(name) IN ('bakaris', 'abah');
  SELECT COUNT(*) INTO v_receipts_migrated FROM public.receipts WHERE paid_by_id IS NOT NULL;
  SELECT COUNT(*) INTO v_categories_deleted FROM public.custom_categories WHERE lower(name) IN ('bakaris', 'abah');
  
  RAISE NOTICE 'Payer migration complete: % payers created, % receipts migrated, % orphan categories remaining', 
    v_payers_created, v_receipts_migrated, v_categories_deleted;
END $$;
