-- Migration: Create paid_by table for receipt payer tracking
-- Date: 2026-02-05
-- Purpose: Separate payer data from categories, introduce normalized paid_by entity

-- =============================================
-- 1. CREATE PAID_BY TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.paid_by (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  archived boolean DEFAULT false NOT NULL,
  CONSTRAINT paid_by_valid_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 50)
);

ALTER TABLE public.paid_by OWNER TO postgres;

COMMENT ON TABLE public.paid_by IS 'Payer entities for tracking who paid for receipts';
COMMENT ON COLUMN public.paid_by.team_id IS 'Team ID for team-shared payers. NULL for personal payers.';
COMMENT ON COLUMN public.paid_by.archived IS 'Soft delete flag for payers';

-- =============================================
-- 2. CREATE INDEXES
-- =============================================

-- Unique constraint for user+team+name (case insensitive)
-- Use COALESCE to handle NULL team_id in unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_paid_by_unique_name 
  ON public.paid_by (user_id, COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- Standard lookup indexes
CREATE INDEX IF NOT EXISTS idx_paid_by_user_id ON public.paid_by(user_id);
CREATE INDEX IF NOT EXISTS idx_paid_by_team_id ON public.paid_by(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_paid_by_archived ON public.paid_by(archived) WHERE archived = false;

-- =============================================
-- 3. ADD PAID_BY_ID TO RECEIPTS TABLE
-- =============================================

-- Add paid_by_id column to receipts
ALTER TABLE public.receipts 
  ADD COLUMN IF NOT EXISTS paid_by_id uuid REFERENCES public.paid_by(id) ON DELETE SET NULL;

-- Index for paid_by lookups on receipts
CREATE INDEX IF NOT EXISTS idx_receipts_paid_by_id ON public.receipts(paid_by_id) WHERE paid_by_id IS NOT NULL;

COMMENT ON COLUMN public.receipts.paid_by_id IS 'Reference to the payer who paid for this receipt';

-- =============================================
-- 4. ADD ARCHIVED COLUMN TO CUSTOM_CATEGORIES
-- =============================================

-- Add archived column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'custom_categories' 
    AND column_name = 'archived'
  ) THEN
    ALTER TABLE public.custom_categories ADD COLUMN archived boolean DEFAULT false NOT NULL;
    COMMENT ON COLUMN public.custom_categories.archived IS 'Soft delete flag for categories';
    CREATE INDEX IF NOT EXISTS idx_custom_categories_archived ON public.custom_categories(archived) WHERE archived = false;
  END IF;
END $$;
