-- Gamification reward rules and receipt integration
-- Adds deterministic XP helpers, receipt-trigger awarding, and public login/review RPCs.

-- ============================================================================
-- 1. HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_gamification_login_multiplier(p_login_streak_days INTEGER)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT 1 + ((LEAST(GREATEST(COALESCE(p_login_streak_days, 1), 1), 7) - 1)::NUMERIC / 6);
$function$;

CREATE OR REPLACE FUNCTION public.insert_gamification_xp_event(
  p_user_id UUID,
  p_source_type TEXT,
  p_amount INTEGER,
  p_idempotency_key TEXT,
  p_source_id UUID DEFAULT NULL,
  p_receipt_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_awarded_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_event_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id cannot be null';
  END IF;

  IF COALESCE(TRIM(p_idempotency_key), '') = '' THEN
    RAISE EXCEPTION 'p_idempotency_key cannot be empty';
  END IF;

  PERFORM public.ensure_user_gamification_stats(p_user_id);

  INSERT INTO public.gamification_xp_events (
    user_id,
    source_type,
    source_id,
    receipt_id,
    amount,
    metadata,
    idempotency_key,
    awarded_at
  )
  VALUES (
    p_user_id,
    p_source_type,
    p_source_id,
    p_receipt_id,
    p_amount,
    COALESCE(p_metadata, '{}'::JSONB),
    p_idempotency_key,
    COALESCE(p_awarded_at, NOW())
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NOT NULL THEN
    UPDATE public.user_gamification_stats
    SET total_xp = GREATEST(total_xp + p_amount, 0)
    WHERE user_id = p_user_id;
  END IF;

  RETURN v_event_id;
END;
$function$;

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

COMMENT ON FUNCTION public.get_gamification_login_multiplier(INTEGER) IS 'Maps login streak day 1..7 to a linear 1.0x..2.0x scan XP multiplier capped at day 7.';
COMMENT ON FUNCTION public.insert_gamification_xp_event(UUID, TEXT, INTEGER, TEXT, UUID, UUID, JSONB, TIMESTAMPTZ) IS 'Internal idempotent XP-award helper that inserts a ledger event once and increments total_xp only when a new event is created.';
COMMENT ON FUNCTION public.evaluate_gamification_badges(UUID, UUID) IS 'Evaluates active badge criteria against the current gamification snapshot and unlocks missing badges inside the caller transaction.';

REVOKE ALL ON FUNCTION public.insert_gamification_xp_event(UUID, TEXT, INTEGER, TEXT, UUID, UUID, JSONB, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.evaluate_gamification_badges(UUID, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_gamification_login_multiplier(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gamification_login_multiplier(INTEGER) TO service_role;

-- ============================================================================
-- 2. PUBLIC RPCS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_daily_login()
RETURNS public.user_gamification_stats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_today DATE;
  v_stats public.user_gamification_stats;
  v_new_streak INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  PERFORM public.ensure_user_gamification_stats(v_user_id);

  SELECT *
  INTO v_stats
  FROM public.user_gamification_stats
  WHERE user_id = v_user_id
  FOR UPDATE;

  v_today := public.get_user_local_date(v_user_id);

  IF v_stats.last_login_date IS NOT DISTINCT FROM v_today THEN
    RETURN v_stats;
  END IF;

  v_new_streak := CASE
    WHEN v_stats.last_login_date = (v_today - 1) THEN v_stats.login_streak_days + 1
    ELSE 1
  END;

  UPDATE public.user_gamification_stats
  SET login_streak_days = v_new_streak,
      longest_login_streak_days = GREATEST(longest_login_streak_days, v_new_streak),
      last_login_date = v_today
  WHERE user_id = v_user_id
  RETURNING * INTO v_stats;

  RETURN v_stats;
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

  IF NOT (
    v_receipt.user_id = v_actor_id
    OR (
      v_receipt.team_id IS NOT NULL
      AND public.is_team_member(v_receipt.team_id, v_actor_id, 'member')
    )
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
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

COMMENT ON FUNCTION public.record_daily_login() IS 'Records the authenticated user''s local-day login streak state once per day using profiles.timezone_preference with Asia/Kuala_Lumpur fallback.';
COMMENT ON FUNCTION public.record_receipt_review(UUID) IS 'Awards the acting reviewer +5 XP at most once per actor/receipt after a reviewed receipt save succeeds.';

REVOKE ALL ON FUNCTION public.record_daily_login() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_receipt_review(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_daily_login() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_daily_login() TO service_role;
GRANT EXECUTE ON FUNCTION public.record_receipt_review(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_receipt_review(UUID) TO service_role;

-- ============================================================================
-- 3. RECEIPT TRIGGER INTEGRATION
-- ============================================================================

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
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_receipt_gamification_rewards() IS 'Handles deterministic receipt-scan XP, first-scan daily goal bonus, deductible-stat updates, and first-true tax bonus directly from receipt row changes.';

REVOKE ALL ON FUNCTION public.handle_receipt_gamification_rewards() FROM PUBLIC;

DROP TRIGGER IF EXISTS receipt_gamification_rewards_trigger ON public.receipts;
CREATE TRIGGER receipt_gamification_rewards_trigger
  AFTER INSERT OR UPDATE OF processing_status, is_business_expense, total
  ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_receipt_gamification_rewards();