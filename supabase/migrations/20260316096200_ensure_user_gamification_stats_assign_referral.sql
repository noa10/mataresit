-- Ensure existing users get referral codes lazily without full-table backfill

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

  IF COALESCE(TRIM(v_stats.referral_code), '') = '' THEN
    UPDATE public.user_gamification_stats
    SET referral_code = public.generate_unique_referral_code()
    WHERE user_id = p_user_id
    RETURNING * INTO v_stats;
  END IF;

  RETURN v_stats;
END;
$function$;
