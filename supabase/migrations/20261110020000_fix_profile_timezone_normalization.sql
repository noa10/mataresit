-- Normalize new writes and tolerate values stored before timezone validation.
-- Replacing the functions preserves their existing ownership and grants.
CREATE OR REPLACE FUNCTION public.validate_profile_timezone()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.timezone_preference := NULLIF(
    pg_catalog.regexp_replace(NEW.timezone_preference, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    ''
  );

  IF NEW.timezone_preference IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_timezone_names zone
       WHERE zone.name = NEW.timezone_preference
     ) THEN
    RAISE EXCEPTION 'Invalid timezone: %', NEW.timezone_preference;
  END IF;
  RETURN NEW;
END;
$$;

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
  resolved_timezone TEXT;
BEGIN
  IF auth.role() = 'authenticated' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'You can only resolve the local date for your own account';
  END IF;

  SELECT COALESCE(zone.name, 'Asia/Kuala_Lumpur')
  INTO resolved_timezone
  FROM public.profiles p
  LEFT JOIN pg_catalog.pg_timezone_names zone
    ON zone.name = NULLIF(pg_catalog.regexp_replace(p.timezone_preference, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '')
  WHERE p.id = p_user_id;

  -- Preserve the existing NULL result for a missing profile or reference time.
  IF NOT FOUND OR p_reference_time IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN pg_catalog.timezone(resolved_timezone, p_reference_time)::DATE;
  EXCEPTION WHEN invalid_parameter_value THEN
    -- Legacy profiles can contain names that the write trigger now rejects.
    RETURN pg_catalog.timezone('Asia/Kuala_Lumpur', p_reference_time)::DATE;
  END;
END;
$function$;

-- Apply the same whitespace normalization to legacy leaderboard profiles.
CREATE OR REPLACE FUNCTION public.get_gamification_leaderboard(
  _metric TEXT,
  _country_code TEXT DEFAULT NULL,
  _limit INTEGER DEFAULT 100
)
RETURNS TABLE(
  rank BIGINT,
  user_id UUID,
  display_name TEXT,
  is_current_user BOOLEAN,
  is_anonymous BOOLEAN,
  metric_value NUMERIC,
  gap_to_top_ten NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  viewer_id UUID := auth.uid();
  normalized_country TEXT := NULLIF(UPPER(BTRIM(COALESCE(_country_code, ''))), '');
  normalized_limit INTEGER := LEAST(GREATEST(COALESCE(_limit, 100), 1), 100);
BEGIN
  IF viewer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _metric IS NULL
     OR _metric NOT IN ('weekly_xp', 'monthly_receipts', 'deductible_total') THEN
    RAISE EXCEPTION 'Unsupported leaderboard metric: %', _metric;
  END IF;

  RETURN QUERY
  -- pg_timezone_names() builds the full zone list from tzdata and costs
  -- milliseconds per call, so materialize it once per statement and join it to
  -- each eligible profile. Calling a per-row validation helper here would add
  -- seconds to the monthly metric at a few thousand opted-in members.
  WITH timezone_catalog AS MATERIALIZED (
    SELECT zone.name
    FROM pg_catalog.pg_timezone_names zone
  ),
  profile_base AS (
    SELECT
      stats.user_id,
      (
        COALESCE(stats.leaderboard_display_mode, 'anonymous') = 'anonymous'
        OR NULLIF(BTRIM(CONCAT_WS(' ', profile.first_name, profile.last_name)), '') IS NULL
      ) AS is_anonymous,
      NULLIF(BTRIM(CONCAT_WS(' ', profile.first_name, profile.last_name)), '') AS public_name,
      COALESCE(timezone_catalog.name, 'Asia/Kuala_Lumpur') AS timezone_name,
      stats.deductible_total_amount
    FROM public.user_gamification_stats stats
    LEFT JOIN public.profiles profile ON profile.id = stats.user_id
    LEFT JOIN timezone_catalog
      ON timezone_catalog.name = NULLIF(pg_catalog.regexp_replace(profile.timezone_preference, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '')
    WHERE stats.leaderboard_opt_in = TRUE
      AND (
        normalized_country IS NULL
        OR UPPER(COALESCE(stats.country_code, '')) = normalized_country
      )
  ),
  eligible AS (
    SELECT
      base.user_id,
      base.is_anonymous,
      base.public_name,
      CASE
        WHEN _metric = 'weekly_xp' THEN COALESCE((
          SELECT SUM(event.amount)::NUMERIC
          FROM public.gamification_xp_events event
          WHERE event.user_id = base.user_id
            AND COALESCE(event.awarded_at, event.created_at, NOW()) >= NOW() - INTERVAL '7 days'
        ), 0)
        WHEN _metric = 'monthly_receipts' THEN COALESCE((
          SELECT COUNT(*)::NUMERIC
          FROM public.receipts receipt
          WHERE receipt.user_id = base.user_id
            AND COALESCE(receipt.processing_status, 'complete') = 'complete'
            AND DATE_TRUNC(
              'month',
              TIMEZONE(base.timezone_name, receipt.created_at)
            ) = DATE_TRUNC(
              'month',
              TIMEZONE(base.timezone_name, NOW())
            )
        ), 0)
        ELSE COALESCE(base.deductible_total_amount, 0)::NUMERIC
      END AS metric_value
    FROM profile_base base
  ),
  ranked AS (
    SELECT
      ROW_NUMBER() OVER (ORDER BY eligible.metric_value DESC, eligible.user_id) AS rank,
      eligible.user_id,
      eligible.public_name,
      eligible.is_anonymous,
      eligible.metric_value
    FROM eligible
  ),
  top_ten_threshold AS (
    -- Distinct name: `metric_value` is also a RETURNS TABLE output parameter,
    -- and an unqualified reference resolves to that variable, not the CTE.
    SELECT ranked.metric_value AS threshold_value
    FROM ranked
    WHERE ranked.rank = 10
  ),
  visible_rows AS (
    SELECT *
    FROM ranked
    WHERE ranked.rank <= normalized_limit
       OR ranked.user_id = viewer_id
  )
  SELECT
    visible_rows.rank,
    CASE
      WHEN visible_rows.is_anonymous AND visible_rows.user_id <> viewer_id THEN NULL
      ELSE visible_rows.user_id
    END AS user_id,
    CASE
      WHEN visible_rows.is_anonymous THEN FORMAT('Anonymous #%s', visible_rows.rank)
      ELSE visible_rows.public_name
    END AS display_name,
    visible_rows.user_id = viewer_id AS is_current_user,
    visible_rows.is_anonymous,
    visible_rows.metric_value,
    CASE
      WHEN visible_rows.rank <= 10 THEN 0::NUMERIC
      WHEN EXISTS (SELECT 1 FROM top_ten_threshold) THEN GREATEST(
        (SELECT top_ten_threshold.threshold_value FROM top_ten_threshold LIMIT 1) - visible_rows.metric_value,
        0::NUMERIC
      )
      ELSE 0::NUMERIC
    END AS gap_to_top_ten
  FROM visible_rows
  ORDER BY visible_rows.rank;
END;
$function$;
