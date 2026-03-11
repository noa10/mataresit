-- Missions schema, deterministic progress evaluation, and missions RPC.

CREATE TABLE IF NOT EXISTS public.gamification_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  mission_type TEXT NOT NULL CHECK (mission_type IN ('one_time', 'weekly', 'community')),
  objective_type TEXT NOT NULL CHECK (objective_type IN ('receipts_scanned', 'deductible_receipts', 'deductible_total_amount', 'scan_streak_days', 'xp_earned')),
  target_value NUMERIC(12,2) NOT NULL CHECK (target_value > 0),
  reward_xp INTEGER NOT NULL DEFAULT 0 CHECK (reward_xp >= 0),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_mission_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES public.gamification_missions(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL DEFAULT 'lifetime',
  current_value NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (current_value >= 0),
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  source_event_id UUID REFERENCES public.gamification_xp_events(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_mission_progress_user_id_mission_id_period_key_key UNIQUE (user_id, mission_id, period_key)
);

CREATE TABLE IF NOT EXISTS public.community_mission_progress (
  mission_id UUID PRIMARY KEY REFERENCES public.gamification_missions(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  current_value NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (current_value >= 0),
  target_value NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (target_value >= 0),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.gamification_missions IS 'Mission definitions for one-time, weekly, and community progression goals.';
COMMENT ON TABLE public.user_mission_progress IS 'Per-user mission progress snapshots keyed by mission period for deterministic reward tracking.';
COMMENT ON TABLE public.community_mission_progress IS 'Shared mission progress snapshot for active community challenges.';

CREATE INDEX IF NOT EXISTS idx_gamification_missions_active_window
  ON public.gamification_missions (is_active, mission_type, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_user_mission_progress_user_period
  ON public.user_mission_progress (user_id, period_key, updated_at DESC);

DROP TRIGGER IF EXISTS update_gamification_missions_updated_at ON public.gamification_missions;
CREATE TRIGGER update_gamification_missions_updated_at
  BEFORE UPDATE ON public.gamification_missions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_mission_progress_updated_at ON public.user_mission_progress;
CREATE TRIGGER update_user_mission_progress_updated_at
  BEFORE UPDATE ON public.user_mission_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_community_mission_progress_updated_at ON public.community_mission_progress;
CREATE TRIGGER update_community_mission_progress_updated_at
  BEFORE UPDATE ON public.community_mission_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.gamification_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mission_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_mission_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active gamification missions" ON public.gamification_missions;
CREATE POLICY "Authenticated users can view active gamification missions" ON public.gamification_missions
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

DROP POLICY IF EXISTS "Users can view their own mission progress" ON public.user_mission_progress;
CREATE POLICY "Users can view their own mission progress" ON public.user_mission_progress
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view community mission progress" ON public.community_mission_progress;
CREATE POLICY "Authenticated users can view community mission progress" ON public.community_mission_progress
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.get_gamification_mission_period_key(
  p_mission_type TEXT,
  p_reference_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE COALESCE(p_mission_type, '')
    WHEN 'weekly' THEN TO_CHAR(DATE_TRUNC('week', p_reference_time AT TIME ZONE 'UTC'), 'IYYY-"W"IW')
    WHEN 'community' THEN TO_CHAR(DATE_TRUNC('month', p_reference_time AT TIME ZONE 'UTC'), 'YYYY-MM')
    ELSE 'lifetime'
  END;
$function$;

CREATE OR REPLACE FUNCTION public.get_gamification_metric_value(
  p_user_id UUID,
  p_objective_type TEXT,
  p_period_key TEXT,
  p_reference_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_stats public.user_gamification_stats;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_value NUMERIC := 0;
BEGIN
  SELECT * INTO v_stats
  FROM public.user_gamification_stats
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF COALESCE(p_period_key, 'lifetime') <> 'lifetime' THEN
    IF p_period_key ~ '^[0-9]{4}-W[0-9]{2}$' THEN
      v_period_start := TO_TIMESTAMP(p_period_key || '-1', 'IYYY-"W"IW-ID');
      v_period_end := v_period_start + INTERVAL '7 days';
    ELSIF p_period_key ~ '^[0-9]{4}-[0-9]{2}$' THEN
      v_period_start := TO_TIMESTAMP(p_period_key || '-01', 'YYYY-MM-DD');
      v_period_end := v_period_start + INTERVAL '1 month';
    END IF;
  END IF;

  CASE p_objective_type
    WHEN 'receipts_scanned' THEN
      IF COALESCE(p_period_key, 'lifetime') = 'lifetime' THEN
        v_value := COALESCE(v_stats.total_receipts_scanned, 0);
      ELSE
        SELECT COUNT(*)::NUMERIC INTO v_value
        FROM public.gamification_xp_events event
        WHERE event.user_id = p_user_id
          AND event.source_type = 'receipt_scan'
          AND COALESCE(event.awarded_at, event.created_at, p_reference_time) >= v_period_start
          AND COALESCE(event.awarded_at, event.created_at, p_reference_time) < v_period_end;
      END IF;
    WHEN 'deductible_receipts' THEN
      IF COALESCE(p_period_key, 'lifetime') = 'lifetime' THEN
        v_value := COALESCE(v_stats.deductible_receipt_count, 0);
      ELSE
        SELECT COUNT(*)::NUMERIC INTO v_value
        FROM public.gamification_xp_events event
        WHERE event.user_id = p_user_id
          AND event.source_type = 'tax_bonus'
          AND COALESCE(event.awarded_at, event.created_at, p_reference_time) >= v_period_start
          AND COALESCE(event.awarded_at, event.created_at, p_reference_time) < v_period_end;
      END IF;
    WHEN 'deductible_total_amount' THEN
      IF COALESCE(p_period_key, 'lifetime') = 'lifetime' THEN
        v_value := COALESCE(v_stats.deductible_total_amount, 0);
      ELSE
        SELECT COALESCE(SUM(COALESCE((event.metadata ->> 'total')::NUMERIC, 0)), 0) INTO v_value
        FROM public.gamification_xp_events event
        WHERE event.user_id = p_user_id
          AND event.source_type = 'tax_bonus'
          AND COALESCE(event.awarded_at, event.created_at, p_reference_time) >= v_period_start
          AND COALESCE(event.awarded_at, event.created_at, p_reference_time) < v_period_end;
      END IF;
    WHEN 'scan_streak_days' THEN
      v_value := COALESCE(v_stats.scan_streak_days, 0);
    WHEN 'xp_earned' THEN
      IF COALESCE(p_period_key, 'lifetime') = 'lifetime' THEN
        v_value := COALESCE(v_stats.total_xp, 0);
      ELSE
        SELECT COALESCE(SUM(event.amount), 0)::NUMERIC INTO v_value
        FROM public.gamification_xp_events event
        WHERE event.user_id = p_user_id
          AND COALESCE(event.awarded_at, event.created_at, p_reference_time) >= v_period_start
          AND COALESCE(event.awarded_at, event.created_at, p_reference_time) < v_period_end;
      END IF;
  END CASE;

  RETURN COALESCE(v_value, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.evaluate_gamification_missions(
  p_user_id UUID,
  p_source_event_id UUID DEFAULT NULL,
  p_reference_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_mission RECORD;
  v_period_key TEXT;
  v_current_value NUMERIC;
  v_completed_count INTEGER := 0;
  v_inserted_count INTEGER := 0;
  v_claimed_at TIMESTAMPTZ;
  v_reward_event_id UUID;
  v_titles TEXT[] := ARRAY[]::TEXT[];
  v_reward_metadata JSONB;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id cannot be null';
  END IF;

  PERFORM public.ensure_user_gamification_stats(p_user_id);

  FOR v_mission IN
    SELECT *
    FROM public.gamification_missions mission
    WHERE mission.is_active = true
      AND (mission.starts_at IS NULL OR mission.starts_at <= COALESCE(p_reference_time, NOW()))
      AND (mission.ends_at IS NULL OR mission.ends_at >= COALESCE(p_reference_time, NOW()))
    ORDER BY mission.mission_type, mission.created_at, mission.code
  LOOP
    v_period_key := public.get_gamification_mission_period_key(v_mission.mission_type, COALESCE(p_reference_time, NOW()));
    v_current_value := public.get_gamification_metric_value(
      p_user_id,
      v_mission.objective_type,
      v_period_key,
      COALESCE(p_reference_time, NOW())
    );

    INSERT INTO public.user_mission_progress (
      user_id,
      mission_id,
      period_key,
      current_value,
      completed_at,
      claimed_at,
      source_event_id,
      metadata
    )
    VALUES (
      p_user_id,
      v_mission.id,
      v_period_key,
      LEAST(v_current_value, v_mission.target_value),
      CASE WHEN v_current_value >= v_mission.target_value THEN COALESCE(p_reference_time, NOW()) ELSE NULL END,
      NULL,
      p_source_event_id,
      jsonb_build_object('mission_code', v_mission.code, 'mission_type', v_mission.mission_type)
    )
    ON CONFLICT (user_id, mission_id, period_key) DO UPDATE
      SET current_value = EXCLUDED.current_value,
          completed_at = COALESCE(public.user_mission_progress.completed_at, EXCLUDED.completed_at),
          source_event_id = COALESCE(EXCLUDED.source_event_id, public.user_mission_progress.source_event_id),
          updated_at = NOW();

    IF v_mission.mission_type = 'community' THEN
      INSERT INTO public.community_mission_progress (
        mission_id,
        period_key,
        current_value,
        target_value,
        completed_at,
        updated_at
      )
      VALUES (
        v_mission.id,
        v_period_key,
        LEAST(v_current_value, v_mission.target_value),
        v_mission.target_value,
        CASE WHEN v_current_value >= v_mission.target_value THEN COALESCE(p_reference_time, NOW()) ELSE NULL END,
        NOW()
      )
      ON CONFLICT (mission_id) DO UPDATE
        SET period_key = EXCLUDED.period_key,
            current_value = EXCLUDED.current_value,
            target_value = EXCLUDED.target_value,
            completed_at = COALESCE(public.community_mission_progress.completed_at, EXCLUDED.completed_at),
            updated_at = NOW();
    END IF;

    IF v_current_value < v_mission.target_value OR v_mission.reward_xp <= 0 THEN
      CONTINUE;
    END IF;

    SELECT claimed_at INTO v_claimed_at
    FROM public.user_mission_progress
    WHERE user_id = p_user_id
      AND mission_id = v_mission.id
      AND period_key = v_period_key;

    IF v_claimed_at IS NOT NULL THEN
      CONTINUE;
    END IF;

    v_reward_metadata := jsonb_build_object(
      'mission_code', v_mission.code,
      'mission_title', v_mission.title,
      'mission_type', v_mission.mission_type,
      'objective_type', v_mission.objective_type,
      'target_value', v_mission.target_value,
      'period_key', v_period_key,
      'source_event_id', p_source_event_id,
      'missions_completed', jsonb_build_array(jsonb_build_object('code', v_mission.code, 'title', v_mission.title))
    );

    v_reward_event_id := public.insert_gamification_xp_event(
      p_user_id,
      'mission_completion',
      v_mission.reward_xp,
      FORMAT('mission_completion:%s:%s:%s', p_user_id, v_mission.code, v_period_key),
      v_mission.id,
      NULL,
      v_reward_metadata,
      COALESCE(p_reference_time, NOW())
    );

    IF v_reward_event_id IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.user_mission_progress
    SET claimed_at = COALESCE(claimed_at, COALESCE(p_reference_time, NOW())),
        source_event_id = COALESCE(source_event_id, v_reward_event_id),
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND mission_id = v_mission.id
      AND period_key = v_period_key
      AND claimed_at IS NULL;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
    IF v_inserted_count > 0 THEN
      v_completed_count := v_completed_count + 1;
      v_titles := array_append(v_titles, v_mission.title);
      PERFORM public.evaluate_gamification_badges(p_user_id, v_reward_event_id);
    END IF;
  END LOOP;

  IF v_completed_count > 0 THEN
    UPDATE public.gamification_xp_events
    SET metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object(
      'missions_completed', to_jsonb(v_titles)
    )
    WHERE id = p_source_event_id;
  END IF;

  RETURN v_completed_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_gamification_missions()
RETURNS TABLE(
  id UUID,
  mission_id UUID,
  current_value NUMERIC,
  target_value NUMERIC,
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  mission JSONB,
  community_current_value NUMERIC,
  community_target_value NUMERIC,
  community_completed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  PERFORM public.ensure_user_gamification_stats(v_user_id);
  PERFORM public.evaluate_gamification_missions(v_user_id, NULL, v_now);

  RETURN QUERY
  WITH active_missions AS (
    SELECT
      mission.*,
      public.get_gamification_mission_period_key(mission.mission_type, v_now) AS period_key
    FROM public.gamification_missions mission
    WHERE mission.is_active = true
      AND (mission.starts_at IS NULL OR mission.starts_at <= v_now)
      AND (mission.ends_at IS NULL OR mission.ends_at >= v_now)
  )
  SELECT
    COALESCE(progress.id, gen_random_uuid()) AS id,
    active_missions.id AS mission_id,
    COALESCE(
      progress.current_value,
      public.get_gamification_metric_value(v_user_id, active_missions.objective_type, active_missions.period_key, v_now),
      0
    ) AS current_value,
    active_missions.target_value,
    progress.completed_at,
    progress.claimed_at,
    jsonb_build_object(
      'id', active_missions.id,
      'code', active_missions.code,
      'title', active_missions.title,
      'description', active_missions.description,
      'missionType', active_missions.mission_type,
      'objectiveType', active_missions.objective_type,
      'targetValue', active_missions.target_value,
      'rewardXp', active_missions.reward_xp,
      'startsAt', active_missions.starts_at,
      'endsAt', active_missions.ends_at,
      'metadata', COALESCE(active_missions.metadata, '{}'::JSONB)
    ) AS mission,
    community.current_value AS community_current_value,
    community.target_value AS community_target_value,
    community.completed_at AS community_completed_at
  FROM active_missions
  LEFT JOIN public.user_mission_progress progress
    ON progress.user_id = v_user_id
    AND progress.mission_id = active_missions.id
    AND progress.period_key = active_missions.period_key
  LEFT JOIN public.community_mission_progress community
    ON community.mission_id = active_missions.id
    AND community.period_key = active_missions.period_key
  ORDER BY CASE active_missions.mission_type
      WHEN 'one_time' THEN 1
      WHEN 'weekly' THEN 2
      ELSE 3
    END,
    active_missions.created_at,
    active_missions.code;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_gamification_mission_period_key(TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gamification_mission_period_key(TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_gamification_metric_value(UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gamification_metric_value(UUID, TEXT, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_gamification_missions(UUID, UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_gamification_missions(UUID, UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_gamification_missions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gamification_missions() TO service_role;

INSERT INTO public.gamification_missions (
  code,
  title,
  description,
  mission_type,
  objective_type,
  target_value,
  reward_xp,
  starts_at,
  ends_at,
  metadata,
  is_active
)
VALUES
  (
    'first_receipt_complete',
    'First receipt complete',
    'Finish your first successful receipt scan.',
    'one_time',
    'receipts_scanned',
    1,
    40,
    NULL,
    NULL,
    jsonb_build_object('theme', 'onboarding', 'sortOrder', 10),
    true
  ),
  (
    'tax_receipt_starter',
    'Tax receipt starter',
    'Mark 3 receipts as tax-claimable to build your deduction habit.',
    'one_time',
    'deductible_receipts',
    3,
    60,
    NULL,
    NULL,
    jsonb_build_object('theme', 'onboarding', 'sortOrder', 20),
    true
  ),
  (
    'seven_day_scan_streak',
    'Seven-day scan streak',
    'Reach a 7-day scan streak once to lock in a momentum milestone.',
    'one_time',
    'scan_streak_days',
    7,
    90,
    NULL,
    NULL,
    jsonb_build_object('theme', 'onboarding', 'sortOrder', 30),
    true
  ),
  (
    'weekly_receipt_sprint',
    'Weekly receipt sprint',
    'Complete 5 receipt scans this week.',
    'weekly',
    'receipts_scanned',
    5,
    75,
    DATE_TRUNC('week', NOW()),
    DATE_TRUNC('week', NOW()) + INTERVAL '7 days' - INTERVAL '1 second',
    jsonb_build_object('theme', 'weekly', 'sortOrder', 40),
    true
  ),
  (
    'weekly_tax_focus',
    'Weekly tax focus',
    'Track RM250 of deductible receipts this week.',
    'weekly',
    'deductible_total_amount',
    250,
    80,
    DATE_TRUNC('week', NOW()),
    DATE_TRUNC('week', NOW()) + INTERVAL '7 days' - INTERVAL '1 second',
    jsonb_build_object('theme', 'weekly', 'sortOrder', 50),
    true
  ),
  (
    'monthly_community_xp_push',
    'Monthly community XP push',
    'As a community, earn 2,500 XP during the current month.',
    'community',
    'xp_earned',
    2500,
    120,
    DATE_TRUNC('month', NOW()),
    DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 second',
    jsonb_build_object('theme', 'community', 'sortOrder', 60),
    true
  )
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  mission_type = EXCLUDED.mission_type,
  objective_type = EXCLUDED.objective_type,
  target_value = EXCLUDED.target_value,
  reward_xp = EXCLUDED.reward_xp,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at,
  metadata = EXCLUDED.metadata,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

UPDATE public.gamification_missions mission
SET metadata = COALESCE(mission.metadata, '{}'::JSONB) || jsonb_build_object(
  'periodKey', public.get_gamification_mission_period_key(mission.mission_type, NOW())
)
WHERE mission.is_active = true;

CREATE OR REPLACE FUNCTION public.evaluate_gamification_badges(
  p_user_id UUID,
  p_source_event_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_stats public.user_gamification_stats;
  v_badge RECORD;
  v_metric TEXT;
  v_operator TEXT;
  v_required_value NUMERIC;
  v_current_value NUMERIC;
  v_unlocked_count INTEGER := 0;
  v_rows_inserted INTEGER := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id cannot be null';
  END IF;

  PERFORM public.ensure_user_gamification_stats(p_user_id);

  SELECT *
  INTO v_stats
  FROM public.user_gamification_stats
  WHERE user_id = p_user_id;

  FOR v_badge IN
    SELECT gb.*
    FROM public.gamification_badges gb
    WHERE gb.is_active = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_badges ub
        WHERE ub.user_id = p_user_id
          AND ub.badge_id = gb.id
      )
    ORDER BY gb.sort_order, gb.code
  LOOP
    v_metric := COALESCE(v_badge.criteria ->> 'metric', '');
    v_operator := COALESCE(v_badge.criteria ->> 'operator', '>=');
    v_required_value := NULLIF(v_badge.criteria ->> 'value', '')::NUMERIC;
    v_current_value := NULL;

    CASE v_metric
      WHEN 'total_receipts_scanned' THEN v_current_value := COALESCE(v_stats.total_receipts_scanned, 0);
      WHEN 'deductible_receipt_count' THEN v_current_value := COALESCE(v_stats.deductible_receipt_count, 0);
      WHEN 'deductible_total_amount' THEN v_current_value := COALESCE(v_stats.deductible_total_amount, 0);
      WHEN 'current_level' THEN v_current_value := COALESCE(v_stats.current_level, 1);
      WHEN 'successful_referrals' THEN v_current_value := COALESCE(v_stats.successful_referrals, 0);
      WHEN 'missions_completed' THEN
        SELECT COUNT(*)::NUMERIC
        INTO v_current_value
        FROM public.user_mission_progress progress
        WHERE progress.user_id = p_user_id
          AND progress.claimed_at IS NOT NULL;
      WHEN 'tax_claimable_days' THEN
        SELECT COUNT(DISTINCT public.get_user_local_date(p_user_id, gxe.awarded_at))::NUMERIC
        INTO v_current_value
        FROM public.gamification_xp_events gxe
        WHERE gxe.user_id = p_user_id
          AND gxe.source_type = 'tax_bonus';
      ELSE
        CONTINUE;
    END CASE;

    IF v_required_value IS NULL THEN
      CONTINUE;
    END IF;

    IF (
      (v_operator = '>=' AND v_current_value >= v_required_value)
      OR (v_operator = '>' AND v_current_value > v_required_value)
      OR (v_operator = '<=' AND v_current_value <= v_required_value)
      OR (v_operator = '<' AND v_current_value < v_required_value)
      OR (v_operator = '=' AND v_current_value = v_required_value)
    ) THEN
      INSERT INTO public.user_badges (
        user_id,
        badge_id,
        source_event_id,
        metadata
      )
      VALUES (
        p_user_id,
        v_badge.id,
        p_source_event_id,
        jsonb_build_object('badge_code', v_badge.code, 'criteria', v_badge.criteria)
      )
      ON CONFLICT (user_id, badge_id) DO NOTHING;

      GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
      v_unlocked_count := v_unlocked_count + v_rows_inserted;
    END IF;
  END LOOP;

  RETURN v_unlocked_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_receipt_review(_receipt_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor_id UUID := auth.uid();
  v_receipt RECORD;
  v_event_id UUID;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT r.id, r.user_id, r.team_id, r.status
  INTO v_receipt
  FROM public.receipts r
  WHERE r.id = _receipt_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt not found';
  END IF;

  IF v_receipt.user_id IS DISTINCT FROM v_actor_id
     AND NOT EXISTS (
       SELECT 1
       FROM public.team_members tm
       WHERE tm.team_id = v_receipt.team_id
         AND tm.user_id = v_actor_id
     ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF COALESCE(v_receipt.status, 'unreviewed') <> 'reviewed' THEN
    RETURN false;
  END IF;

  v_event_id := public.insert_gamification_xp_event(
    v_actor_id,
    'manual_review',
    5,
    FORMAT('manual_review:%s:%s', v_actor_id, _receipt_id),
    _receipt_id,
    _receipt_id,
    jsonb_build_object(
      'reviewer_id', v_actor_id,
      'receipt_owner_id', v_receipt.user_id,
      'team_id', v_receipt.team_id
    )
  );

  IF v_event_id IS NOT NULL THEN
    PERFORM public.evaluate_gamification_badges(v_actor_id, v_event_id);
    PERFORM public.evaluate_gamification_missions(v_actor_id, v_event_id);
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_receipt_gamification_rewards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_stats public.user_gamification_stats;
  v_local_date DATE;
  v_new_scan_streak INTEGER;
  v_scan_xp INTEGER;
  v_scan_event_id UUID;
  v_daily_goal_event_id UUID;
  v_tax_event_id UUID;
  v_old_is_deductible BOOLEAN := false;
  v_new_is_deductible BOOLEAN := COALESCE(NEW.is_business_expense, false);
  v_count_delta INTEGER := 0;
  v_amount_delta NUMERIC(12,2) := 0;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_old_is_deductible := COALESCE(OLD.is_business_expense, false);
  END IF;

  PERFORM public.ensure_user_gamification_stats(NEW.user_id);

  SELECT *
  INTO v_stats
  FROM public.user_gamification_stats
  WHERE user_id = NEW.user_id
  FOR UPDATE;

  IF NEW.processing_status = 'complete'
     AND (
       TG_OP = 'INSERT'
       OR (TG_OP <> 'INSERT' AND COALESCE(OLD.processing_status, '') IS DISTINCT FROM 'complete')
     ) THEN
    v_local_date := public.get_user_local_date(NEW.user_id, COALESCE(NEW.updated_at, NOW()));
    v_scan_xp := ROUND(10 * public.get_gamification_login_multiplier(v_stats.login_streak_days))::INTEGER;

    v_scan_event_id := public.insert_gamification_xp_event(
      NEW.user_id,
      'receipt_scan',
      v_scan_xp,
      FORMAT('receipt_scan:%s', NEW.id),
      NEW.id,
      NEW.id,
      jsonb_build_object(
        'receipt_owner_id', NEW.user_id,
        'local_date', v_local_date,
        'login_streak_days', v_stats.login_streak_days,
        'login_multiplier', public.get_gamification_login_multiplier(v_stats.login_streak_days)
      ),
      COALESCE(NEW.updated_at, NOW())
    );

    IF v_scan_event_id IS NOT NULL THEN
      UPDATE public.user_gamification_stats
      SET total_receipts_scanned = total_receipts_scanned + 1
      WHERE user_id = NEW.user_id
      RETURNING * INTO v_stats;

      IF v_stats.last_scan_date IS DISTINCT FROM v_local_date THEN
        v_new_scan_streak := CASE
          WHEN v_stats.last_scan_date = (v_local_date - 1) THEN v_stats.scan_streak_days + 1
          ELSE 1
        END;

        UPDATE public.user_gamification_stats
        SET scan_streak_days = v_new_scan_streak,
            longest_scan_streak_days = GREATEST(longest_scan_streak_days, v_new_scan_streak),
            last_scan_date = v_local_date
        WHERE user_id = NEW.user_id
        RETURNING * INTO v_stats;

        v_daily_goal_event_id := public.insert_gamification_xp_event(
          NEW.user_id,
          'daily_goal_bonus',
          50,
          FORMAT('daily_goal_bonus:%s:%s', NEW.user_id, v_local_date),
          NEW.id,
          NEW.id,
          jsonb_build_object(
            'receipt_owner_id', NEW.user_id,
            'local_date', v_local_date,
            'scan_streak_days', v_new_scan_streak
          ),
          COALESCE(NEW.updated_at, NOW())
        );
      END IF;

      PERFORM public.evaluate_gamification_badges(
        NEW.user_id,
        COALESCE(v_daily_goal_event_id, v_scan_event_id)
      );
      PERFORM public.evaluate_gamification_missions(
        NEW.user_id,
        COALESCE(v_daily_goal_event_id, v_scan_event_id),
        COALESCE(NEW.updated_at, NOW())
      );
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_count_delta := CASE WHEN v_new_is_deductible THEN 1 ELSE 0 END;
    v_amount_delta := CASE WHEN v_new_is_deductible THEN COALESCE(NEW.total, 0)::NUMERIC(12,2) ELSE 0 END;
  ELSE
    v_count_delta := (CASE WHEN v_new_is_deductible THEN 1 ELSE 0 END)
      - (CASE WHEN v_old_is_deductible THEN 1 ELSE 0 END);
    v_amount_delta :=
      (CASE WHEN v_new_is_deductible THEN COALESCE(NEW.total, 0)::NUMERIC(12,2) ELSE 0 END)
      - (CASE WHEN v_old_is_deductible THEN COALESCE(OLD.total, 0)::NUMERIC(12,2) ELSE 0 END);
  END IF;

  IF v_count_delta <> 0 OR v_amount_delta <> 0 OR (v_new_is_deductible AND NOT v_old_is_deductible) THEN
    UPDATE public.user_gamification_stats
    SET deductible_receipt_count = GREATEST(deductible_receipt_count + v_count_delta, 0),
        deductible_total_amount = GREATEST(deductible_total_amount + v_amount_delta, 0)
    WHERE user_id = NEW.user_id
    RETURNING * INTO v_stats;

    IF v_new_is_deductible AND NOT v_old_is_deductible THEN
      v_tax_event_id := public.insert_gamification_xp_event(
        NEW.user_id,
        'tax_bonus',
        20,
        FORMAT('tax_bonus:%s', NEW.id),
        NEW.id,
        NEW.id,
        jsonb_build_object(
          'receipt_owner_id', NEW.user_id,
          'total', NEW.total,
          'date', NEW.date
        ),
        COALESCE(NEW.updated_at, NOW())
      );
    END IF;

    PERFORM public.evaluate_gamification_badges(NEW.user_id, v_tax_event_id);
    PERFORM public.evaluate_gamification_missions(NEW.user_id, v_tax_event_id, COALESCE(NEW.updated_at, NOW()));
  END IF;

  RETURN NEW;
END;
$function$;