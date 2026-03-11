-- ==========================================================================
-- Wave 3 growth loop: referral redemption + reward release on first scan
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.generate_unique_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_candidate TEXT;
BEGIN
  LOOP
    v_candidate := UPPER(ENCODE(gen_random_bytes(5), 'hex'));

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.user_gamification_stats ugs
      WHERE ugs.referral_code = v_candidate
    );
  END LOOP;

  RETURN v_candidate;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_user_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF COALESCE(TRIM(NEW.referral_code), '') = '' THEN
    NEW.referral_code := public.generate_unique_referral_code();
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.generate_unique_referral_code() IS 'Generates a unique uppercase referral code for user_gamification_stats rows.';
COMMENT ON FUNCTION public.assign_user_referral_code() IS 'Ensures each gamification stats row receives a referral code before insert.';
COMMENT ON COLUMN public.user_gamification_stats.referral_code IS 'Shareable growth-loop referral code generated automatically for each user.';

REVOKE ALL ON FUNCTION public.generate_unique_referral_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_user_referral_code() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.generate_unique_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_unique_referral_code() TO service_role;

DROP TRIGGER IF EXISTS assign_user_referral_code_trigger ON public.user_gamification_stats;
CREATE TRIGGER assign_user_referral_code_trigger
  BEFORE INSERT ON public.user_gamification_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_user_referral_code();

UPDATE public.user_gamification_stats
SET referral_code = public.generate_unique_referral_code()
WHERE COALESCE(TRIM(referral_code), '') = '';

CREATE TABLE IF NOT EXISTS public.gamification_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reward_released_at TIMESTAMPTZ,
  inviter_reward_event_id UUID REFERENCES public.gamification_xp_events(id) ON DELETE SET NULL,
  invitee_reward_event_id UUID REFERENCES public.gamification_xp_events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gamification_referrals_unique_invitee UNIQUE (invitee_user_id),
  CONSTRAINT gamification_referrals_not_self CHECK (inviter_user_id <> invitee_user_id)
);

COMMENT ON TABLE public.gamification_referrals IS 'Tracks referral-code redemption for new invitees and whether the delayed reward has been released.';

CREATE INDEX IF NOT EXISTS idx_gamification_referrals_inviter_status
  ON public.gamification_referrals (inviter_user_id, reward_released_at, redeemed_at DESC);

CREATE INDEX IF NOT EXISTS idx_gamification_referrals_invitee_status
  ON public.gamification_referrals (invitee_user_id, reward_released_at);

CREATE INDEX IF NOT EXISTS idx_gamification_referrals_code
  ON public.gamification_referrals (referral_code);

DROP TRIGGER IF EXISTS update_gamification_referrals_updated_at ON public.gamification_referrals;
CREATE TRIGGER update_gamification_referrals_updated_at
  BEFORE UPDATE ON public.gamification_referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.gamification_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own gamification referrals" ON public.gamification_referrals;
CREATE POLICY "Users can view their own gamification referrals" ON public.gamification_referrals
  FOR SELECT USING (auth.uid() = inviter_user_id OR auth.uid() = invitee_user_id);

CREATE OR REPLACE FUNCTION public.redeem_referral_code(p_referral_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_invitee_stats public.user_gamification_stats;
  v_inviter_stats public.user_gamification_stats;
  v_existing public.gamification_referrals;
  v_normalized_code TEXT := UPPER(TRIM(COALESCE(p_referral_code, '')));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_normalized_code = '' THEN
    RETURN false;
  END IF;

  SELECT *
  INTO v_invitee_stats
  FROM public.ensure_user_gamification_stats(v_user_id);

  IF COALESCE(v_invitee_stats.total_receipts_scanned, 0) > 0 THEN
    RETURN false;
  END IF;

  SELECT *
  INTO v_inviter_stats
  FROM public.user_gamification_stats
  WHERE referral_code = v_normalized_code;

  IF NOT FOUND OR v_inviter_stats.user_id = v_user_id THEN
    RETURN false;
  END IF;

  SELECT *
  INTO v_existing
  FROM public.gamification_referrals
  WHERE invitee_user_id = v_user_id
  FOR UPDATE;

  IF FOUND THEN
    RETURN v_existing.inviter_user_id = v_inviter_stats.user_id;
  END IF;

  INSERT INTO public.gamification_referrals (
    inviter_user_id,
    invitee_user_id,
    referral_code,
    redeemed_at
  )
  VALUES (
    v_inviter_stats.user_id,
    v_user_id,
    v_normalized_code,
    NOW()
  );

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_pending_referral_rewards(
  p_invitee_user_id UUID,
  p_receipt_id UUID DEFAULT NULL,
  p_awarded_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_referral public.gamification_referrals;
  v_inviter_event_id UUID;
  v_invitee_event_id UUID;
  v_release_count INTEGER := 0;
  v_effective_awarded_at TIMESTAMPTZ := COALESCE(p_awarded_at, NOW());
BEGIN
  IF p_invitee_user_id IS NULL THEN
    RAISE EXCEPTION 'p_invitee_user_id cannot be null';
  END IF;

  FOR v_referral IN
    SELECT *
    FROM public.gamification_referrals gr
    WHERE gr.invitee_user_id = p_invitee_user_id
      AND gr.redeemed_at IS NOT NULL
      AND gr.reward_released_at IS NULL
    FOR UPDATE
  LOOP
    v_inviter_event_id := public.insert_gamification_xp_event(
      v_referral.inviter_user_id,
      'referral_reward',
      200,
      FORMAT('referral_reward:inviter:%s', v_referral.id),
      v_referral.id,
      p_receipt_id,
      jsonb_build_object(
        'role', 'inviter',
        'referral_id', v_referral.id,
        'invitee_user_id', v_referral.invitee_user_id,
        'receipt_id', p_receipt_id
      ),
      v_effective_awarded_at
    );

    v_invitee_event_id := public.insert_gamification_xp_event(
      v_referral.invitee_user_id,
      'referral_reward',
      200,
      FORMAT('referral_reward:invitee:%s', v_referral.id),
      v_referral.id,
      p_receipt_id,
      jsonb_build_object(
        'role', 'invitee',
        'referral_id', v_referral.id,
        'inviter_user_id', v_referral.inviter_user_id,
        'receipt_id', p_receipt_id
      ),
      v_effective_awarded_at
    );

    IF v_inviter_event_id IS NULL THEN
      SELECT id
      INTO v_inviter_event_id
      FROM public.gamification_xp_events
      WHERE idempotency_key = FORMAT('referral_reward:inviter:%s', v_referral.id);
    END IF;

    IF v_invitee_event_id IS NULL THEN
      SELECT id
      INTO v_invitee_event_id
      FROM public.gamification_xp_events
      WHERE idempotency_key = FORMAT('referral_reward:invitee:%s', v_referral.id);
    END IF;

    UPDATE public.gamification_referrals
    SET reward_released_at = COALESCE(reward_released_at, v_effective_awarded_at),
        inviter_reward_event_id = COALESCE(inviter_reward_event_id, v_inviter_event_id),
        invitee_reward_event_id = COALESCE(invitee_reward_event_id, v_invitee_event_id),
        updated_at = NOW()
    WHERE id = v_referral.id
      AND reward_released_at IS NULL;

    IF FOUND THEN
      UPDATE public.user_gamification_stats
      SET successful_referrals = (
        SELECT COUNT(*)::INTEGER
        FROM public.gamification_referrals gr
        WHERE gr.inviter_user_id = v_referral.inviter_user_id
          AND gr.reward_released_at IS NOT NULL
      )
      WHERE user_id = v_referral.inviter_user_id;

      PERFORM public.evaluate_gamification_badges(v_referral.inviter_user_id, COALESCE(v_inviter_event_id, v_invitee_event_id));
      v_release_count := v_release_count + 1;
    END IF;
  END LOOP;

  RETURN v_release_count;
END;
$function$;

COMMENT ON FUNCTION public.redeem_referral_code(TEXT) IS 'Stores an authenticated invitee''s referral redemption before any reward is released.';
COMMENT ON FUNCTION public.release_pending_referral_rewards(UUID, UUID, TIMESTAMPTZ) IS 'Releases pending inviter/invitee referral XP after the invitee completes their first successful scan.';

REVOKE ALL ON FUNCTION public.redeem_referral_code(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_pending_referral_rewards(UUID, UUID, TIMESTAMPTZ) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.redeem_referral_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_referral_code(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_pending_referral_rewards(UUID, UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_pending_referral_rewards(UUID, UUID, TIMESTAMPTZ) TO service_role;

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

      PERFORM public.release_pending_referral_rewards(
        NEW.user_id,
        NEW.id,
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
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_receipt_gamification_rewards() IS 'Handles deterministic receipt rewards, delayed referral release, deductible-stat updates, and tax bonus awarding from receipt changes.';