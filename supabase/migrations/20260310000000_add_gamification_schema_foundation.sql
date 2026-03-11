-- Gamification schema foundation
-- Creates the core progression tables, helper SQL, badge seeds, and RLS.

-- ============================================================================
-- 1. HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_gamification_level(total_xp INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT GREATEST(FLOOR(GREATEST(COALESCE(total_xp, 0), 0)::NUMERIC / 500)::INTEGER + 1, 1);
$function$;

CREATE OR REPLACE FUNCTION public.get_gamification_level_floor(level INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT GREATEST(COALESCE(level, 1) - 1, 0) * 500;
$function$;

CREATE OR REPLACE FUNCTION public.get_gamification_level_ceiling(level INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT GREATEST(COALESCE(level, 1), 1) * 500;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_local_date(
  p_user_id UUID,
  p_reference_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  resolved_timezone TEXT := 'Asia/Kuala_Lumpur';
BEGIN
  IF auth.role() = 'authenticated' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'You can only resolve the local date for your own account';
  END IF;

  SELECT COALESCE(NULLIF(p.timezone_preference, ''), 'Asia/Kuala_Lumpur')
  INTO resolved_timezone
  FROM public.profiles p
  WHERE p.id = p_user_id;

  RETURN timezone(resolved_timezone, p_reference_time)::DATE;
END;
$function$;

COMMENT ON FUNCTION public.calculate_gamification_level(INTEGER) IS 'Deterministically maps total XP to the current level using floor(total_xp / 500) + 1.';
COMMENT ON FUNCTION public.get_gamification_level_floor(INTEGER) IS 'Returns the minimum inclusive total XP required for the provided level.';
COMMENT ON FUNCTION public.get_gamification_level_ceiling(INTEGER) IS 'Returns the exclusive XP threshold for the next level from the provided level.';
COMMENT ON FUNCTION public.get_user_local_date(UUID, TIMESTAMPTZ) IS 'Resolves a user-local date from profiles.timezone_preference with Asia/Kuala_Lumpur fallback.';

REVOKE ALL ON FUNCTION public.get_user_local_date(UUID, TIMESTAMPTZ) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.calculate_gamification_level(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_gamification_level(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_gamification_level_floor(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gamification_level_floor(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_gamification_level_ceiling(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gamification_level_ceiling(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_local_date(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_local_date(UUID, TIMESTAMPTZ) TO service_role;

-- ============================================================================
-- 2. CORE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_gamification_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp INTEGER NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  current_level INTEGER GENERATED ALWAYS AS (public.calculate_gamification_level(total_xp)) STORED,
  login_streak_days INTEGER NOT NULL DEFAULT 0 CHECK (login_streak_days >= 0),
  scan_streak_days INTEGER NOT NULL DEFAULT 0 CHECK (scan_streak_days >= 0),
  longest_login_streak_days INTEGER NOT NULL DEFAULT 0 CHECK (longest_login_streak_days >= 0),
  longest_scan_streak_days INTEGER NOT NULL DEFAULT 0 CHECK (longest_scan_streak_days >= 0),
  last_login_date DATE,
  last_scan_date DATE,
  total_receipts_scanned INTEGER NOT NULL DEFAULT 0 CHECK (total_receipts_scanned >= 0),
  deductible_receipt_count INTEGER NOT NULL DEFAULT 0 CHECK (deductible_receipt_count >= 0),
  deductible_total_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deductible_total_amount >= 0),
  leaderboard_opt_in BOOLEAN NOT NULL DEFAULT false,
  leaderboard_display_mode TEXT NOT NULL DEFAULT 'anonymous' CHECK (leaderboard_display_mode IN ('anonymous', 'name')),
  country_code TEXT NOT NULL DEFAULT 'MY' CHECK (char_length(country_code) = 2),
  referral_code TEXT UNIQUE,
  successful_referrals INTEGER NOT NULL DEFAULT 0 CHECK (successful_referrals >= 0),
  selected_scanner_theme TEXT NOT NULL DEFAULT 'default' CHECK (selected_scanner_theme IN ('default', 'ocean', 'forest', 'sunset')),
  unlocked_scanner_themes TEXT[] NOT NULL DEFAULT ARRAY['default']::TEXT[] CHECK (
    unlocked_scanner_themes <@ ARRAY['default', 'ocean', 'forest', 'sunset']::TEXT[]
    AND cardinality(unlocked_scanner_themes) > 0
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gamification_xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (
    source_type IN (
      'daily_login',
      'receipt_scan',
      'daily_goal_bonus',
      'manual_review',
      'tax_bonus',
      'badge_unlock',
      'mission_completion',
      'referral_reward',
      'admin_adjustment'
    )
  ),
  source_id UUID,
  receipt_id UUID REFERENCES public.receipts(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  idempotency_key TEXT NOT NULL UNIQUE CHECK (char_length(TRIM(idempotency_key)) > 0),
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gamification_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('onboarding', 'streak', 'volume', 'tax', 'level', 'missions', 'referral')),
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  criteria JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.gamification_badges(id) ON DELETE CASCADE,
  source_event_id UUID REFERENCES public.gamification_xp_events(id) ON DELETE SET NULL,
  equipped BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_badges_user_id_badge_id_key UNIQUE (user_id, badge_id)
);

COMMENT ON TABLE public.user_gamification_stats IS 'Per-user progression snapshot used for live gamification state and user preferences.';
COMMENT ON TABLE public.gamification_xp_events IS 'Immutable gamification XP ledger with idempotency protection for every reward event.';
COMMENT ON TABLE public.gamification_badges IS 'Reference table for badge definitions shown in the rewards experience.';
COMMENT ON TABLE public.user_badges IS 'Immutable unlock history plus equip state for badges owned by a user.';

COMMENT ON COLUMN public.user_gamification_stats.current_level IS 'Generated from total_xp using calculate_gamification_level(total_xp).';
COMMENT ON COLUMN public.user_gamification_stats.referral_code IS 'Reserved for the future referral feature; uniqueness is enforced when present.';
COMMENT ON COLUMN public.user_gamification_stats.unlocked_scanner_themes IS 'Theme variants unlocked through progression milestones.';
COMMENT ON COLUMN public.gamification_xp_events.idempotency_key IS 'Unique caller-defined reward key preventing duplicate XP awards.';
COMMENT ON COLUMN public.gamification_badges.criteria IS 'Declarative rule payload consumed by later badge evaluation logic.';
COMMENT ON COLUMN public.user_badges.source_event_id IS 'Optional XP event that triggered the badge unlock.';

-- ============================================================================
-- 3. INDEXES AND TRIGGERS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_gamification_stats_total_xp
  ON public.user_gamification_stats (total_xp DESC);

CREATE INDEX IF NOT EXISTS idx_user_gamification_stats_current_level
  ON public.user_gamification_stats (current_level DESC);

CREATE INDEX IF NOT EXISTS idx_user_gamification_stats_leaderboard_opt_in
  ON public.user_gamification_stats (leaderboard_opt_in, total_xp DESC)
  WHERE leaderboard_opt_in = true;

CREATE INDEX IF NOT EXISTS idx_gamification_xp_events_user_awarded_at
  ON public.gamification_xp_events (user_id, awarded_at DESC);

CREATE INDEX IF NOT EXISTS idx_gamification_xp_events_source_type
  ON public.gamification_xp_events (source_type, user_id);

CREATE INDEX IF NOT EXISTS idx_gamification_xp_events_receipt_id
  ON public.gamification_xp_events (receipt_id)
  WHERE receipt_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gamification_badges_active_sort
  ON public.gamification_badges (is_active, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_unlocked_at
  ON public.user_badges (user_id, unlocked_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_equipped
  ON public.user_badges (user_id, equipped)
  WHERE equipped = true;

DROP TRIGGER IF EXISTS update_user_gamification_stats_updated_at ON public.user_gamification_stats;
CREATE TRIGGER update_user_gamification_stats_updated_at
  BEFORE UPDATE ON public.user_gamification_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_gamification_badges_updated_at ON public.gamification_badges;
CREATE TRIGGER update_gamification_badges_updated_at
  BEFORE UPDATE ON public.gamification_badges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_badges_updated_at ON public.user_badges;
CREATE TRIGGER update_user_badges_updated_at
  BEFORE UPDATE ON public.user_badges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 4. SHARED HELPERS FOR LATER RPCS/TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ensure_user_gamification_stats(p_user_id UUID DEFAULT auth.uid())
RETURNS public.user_gamification_stats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_stats public.user_gamification_stats;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id cannot be null';
  END IF;

  IF auth.role() = 'authenticated' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'You can only initialize your own gamification stats';
  END IF;

  INSERT INTO public.user_gamification_stats (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
  INTO v_stats
  FROM public.user_gamification_stats
  WHERE user_id = p_user_id;

  RETURN v_stats;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_default_gamification_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.user_gamification_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.ensure_user_gamification_stats(UUID) IS 'Ensures a stats row exists for the target user and returns the current snapshot.';
COMMENT ON FUNCTION public.create_default_gamification_stats() IS 'Trigger helper that creates a default gamification stats row for each new auth user.';

REVOKE ALL ON FUNCTION public.ensure_user_gamification_stats(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_default_gamification_stats() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ensure_user_gamification_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_gamification_stats(UUID) TO service_role;

DROP TRIGGER IF EXISTS create_gamification_stats_trigger ON auth.users;
CREATE TRIGGER create_gamification_stats_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_gamification_stats();

-- Backfill existing auth users safely.
INSERT INTO public.user_gamification_stats (user_id)
SELECT au.id
FROM auth.users au
LEFT JOIN public.user_gamification_stats ugs ON ugs.user_id = au.id
WHERE ugs.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.user_gamification_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own gamification stats" ON public.user_gamification_stats;
CREATE POLICY "Users can view their own gamification stats" ON public.user_gamification_stats
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own gamification XP events" ON public.gamification_xp_events;
CREATE POLICY "Users can view their own gamification XP events" ON public.gamification_xp_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view active gamification badges" ON public.gamification_badges;
CREATE POLICY "Authenticated users can view active gamification badges" ON public.gamification_badges
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

DROP POLICY IF EXISTS "Users can view their own unlocked badges" ON public.user_badges;
CREATE POLICY "Users can view their own unlocked badges" ON public.user_badges
  FOR SELECT USING (auth.uid() = user_id);

-- Direct client writes are intentionally not exposed here. Later reward RPCs and
-- triggers can mutate these tables through SECURITY DEFINER entrypoints.

-- ============================================================================
-- 6. BADGE SEEDS
-- ============================================================================

INSERT INTO public.gamification_badges (
  code,
  name,
  description,
  icon_name,
  category,
  rarity,
  sort_order,
  criteria,
  is_active
)
VALUES
  (
    'first_scan',
    'First Scan',
    'Complete your first successful receipt scan.',
    'scan-search',
    'onboarding',
    'common',
    10,
    jsonb_build_object('metric', 'total_receipts_scanned', 'operator', '>=', 'value', 1),
    true
  ),
  (
    'tax_saver_10',
    'Tax Saver',
    'Mark 10 receipts as tax-claimable expenses.',
    'receipt-tax',
    'tax',
    'common',
    20,
    jsonb_build_object('metric', 'deductible_receipt_count', 'operator', '>=', 'value', 10),
    true
  ),
  (
    'tax_warrior_7',
    'Tax Warrior',
    'Log tax-claimable activity on 7 different local days.',
    'shield-tax',
    'tax',
    'rare',
    30,
    jsonb_build_object('metric', 'tax_claimable_days', 'operator', '>=', 'value', 7),
    true
  ),
  (
    'receipt_marathon_30',
    'Receipt Marathon',
    'Complete 30 receipt scans.',
    'receipt-stack',
    'volume',
    'rare',
    40,
    jsonb_build_object('metric', 'total_receipts_scanned', 'operator', '>=', 'value', 30),
    true
  ),
  (
    'scanner_pro_100',
    'Scanner Pro',
    'Complete 100 receipt scans.',
    'scan-pro',
    'volume',
    'epic',
    50,
    jsonb_build_object('metric', 'total_receipts_scanned', 'operator', '>=', 'value', 100),
    true
  ),
  (
    'malaysia_tax_hero_5000',
    'Malaysia Tax Hero',
    'Track RM5,000 in cumulative deductible receipts.',
    'tax-hero',
    'tax',
    'epic',
    60,
    jsonb_build_object('metric', 'deductible_total_amount', 'operator', '>=', 'value', 5000),
    true
  ),
  (
    'level_5',
    'Level 5',
    'Reach level 5.',
    'level-five',
    'level',
    'common',
    70,
    jsonb_build_object('metric', 'current_level', 'operator', '>=', 'value', 5),
    true
  ),
  (
    'level_10',
    'Level 10',
    'Reach level 10.',
    'level-ten',
    'level',
    'rare',
    80,
    jsonb_build_object('metric', 'current_level', 'operator', '>=', 'value', 10),
    true
  ),
  (
    'mission_master',
    'Mission Master',
    'Complete your first mission reward milestone.',
    'mission-master',
    'missions',
    'epic',
    90,
    jsonb_build_object('metric', 'missions_completed', 'operator', '>=', 'value', 1),
    true
  ),
  (
    'recruiter',
    'Recruiter',
    'Invite your first friend who becomes an active scanner.',
    'referral-star',
    'referral',
    'epic',
    100,
    jsonb_build_object('metric', 'successful_referrals', 'operator', '>=', 'value', 1),
    true
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon_name = EXCLUDED.icon_name,
  category = EXCLUDED.category,
  rarity = EXCLUDED.rarity,
  sort_order = EXCLUDED.sort_order,
  criteria = EXCLUDED.criteria,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
