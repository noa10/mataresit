-- Fix the leaderboard RPC, which failed on every call.
--
-- 20260310110000_add_gamification_leaderboard_rpc.sql declared
--   RETURNS TABLE(rank, user_id, display_name, is_current_user, is_anonymous,
--                 metric_value, gap_to_top_ten)
-- Those output columns are PL/pgSQL variables inside the function body. The
-- gap-to-top-ten subquery referenced `metric_value` without a table qualifier,
-- so the first call raised:
--
--   ERROR: 42702: column reference "metric_value" is ambiguous
--   DETAIL: It could refer to either a PL/pgSQL variable or a table column.
--
-- CREATE OR REPLACE FUNCTION does not compile a PL/pgSQL body at creation time,
-- so the migration applied cleanly and only failed at runtime. The frontend
-- translated the failed RPC into an empty leaderboard, which made the outage
-- look like "no opted-in members yet".
--
-- This replacement:
--   1. gives the rank-10 threshold its own CTE column name, so no output
--      parameter can shadow it;
--   2. rejects a NULL metric instead of silently falling through to
--      deductible_total (NULL NOT IN (...) is NULL, never TRUE);
--   3. drops the default PUBLIC EXECUTE grant and grants the two roles the
--      other gamification RPCs expose;
--   4. degrades an unparseable profiles.timezone_preference to the product
--      default instead of failing the monthly metric for every caller;
--   5. stops publishing the email local part and the stable user_id of
--      anonymous members;
--   6. validates timezone writes and hardens the functions' search paths.
--
-- The argument list and return type are unchanged, so CREATE OR REPLACE keeps
-- the existing PostgREST signature and does not require a schema-cache reload.

-- `TIMEZONE()` raises SQLSTATE 22023 for an unknown zone name, and the monthly
-- metric evaluates it once per eligible row. The column is user-writable
-- through PostgREST, so a single bad value would fail the whole leaderboard
-- query for every caller. The leaderboard query below degrades legacy bad rows
-- to the default; this trigger stops new bad values at the write path.
CREATE OR REPLACE FUNCTION public.validate_profile_timezone()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NULLIF(BTRIM(NEW.timezone_preference), '') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_timezone_names zone
       WHERE zone.name = BTRIM(NEW.timezone_preference)
     ) THEN
    RAISE EXCEPTION 'Invalid timezone: %', NEW.timezone_preference;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_profile_timezone ON public.profiles;
CREATE TRIGGER validate_profile_timezone
  BEFORE INSERT OR UPDATE OF timezone_preference ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_timezone();

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
      ON timezone_catalog.name = NULLIF(BTRIM(profile.timezone_preference), '')
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

COMMENT ON FUNCTION public.get_gamification_leaderboard(TEXT, TEXT, INTEGER)
  IS 'Returns the opt-in leaderboard (top N plus the caller) for weekly_xp, monthly_receipts, or deductible_total.';

-- Supabase's default privileges grant EXECUTE on new public functions to anon,
-- and CREATE OR REPLACE preserves the existing ACL, so REVOKE FROM PUBLIC alone
-- would leave a direct anon grant on the function created by the original
-- migration. Revoke anon explicitly; guard the role so a bare Postgres can
-- still apply this migration.
REVOKE ALL ON FUNCTION public.validate_profile_timezone() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_gamification_leaderboard(TEXT, TEXT, INTEGER) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.validate_profile_timezone() FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_gamification_leaderboard(TEXT, TEXT, INTEGER) FROM anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_gamification_leaderboard(TEXT, TEXT, INTEGER) TO authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_gamification_leaderboard(TEXT, TEXT, INTEGER) TO service_role';
  END IF;
END $$;
