-- Privacy-aware leaderboard RPC for the leaderboard page.

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
SET search_path = public
AS $function$
DECLARE
  viewer_id UUID := auth.uid();
  normalized_country TEXT := NULLIF(UPPER(BTRIM(COALESCE(_country_code, ''))), '');
  normalized_limit INTEGER := LEAST(GREATEST(COALESCE(_limit, 100), 1), 100);
BEGIN
  IF viewer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _metric NOT IN ('weekly_xp', 'monthly_receipts', 'deductible_total') THEN
    RAISE EXCEPTION 'Unsupported leaderboard metric: %', _metric;
  END IF;

  RETURN QUERY
  WITH eligible AS (
    SELECT
      stats.user_id,
      COALESCE(stats.leaderboard_display_mode, 'anonymous') = 'anonymous' AS is_anonymous,
      COALESCE(
        NULLIF(BTRIM(CONCAT_WS(' ', profile.first_name, profile.last_name)), ''),
        NULLIF(SPLIT_PART(COALESCE(profile.email, ''), '@', 1), ''),
        'Anonymous'
      ) AS public_name,
      CASE
        WHEN _metric = 'weekly_xp' THEN COALESCE((
          SELECT SUM(event.amount)::NUMERIC
          FROM public.gamification_xp_events event
          WHERE event.user_id = stats.user_id
            AND COALESCE(event.awarded_at, event.created_at, NOW()) >= NOW() - INTERVAL '7 days'
        ), 0)
        WHEN _metric = 'monthly_receipts' THEN COALESCE((
          SELECT COUNT(*)::NUMERIC
          FROM public.receipts receipt
          WHERE receipt.user_id = stats.user_id
            AND COALESCE(receipt.processing_status, 'complete') = 'complete'
            AND DATE_TRUNC(
              'month',
              TIMEZONE(COALESCE(NULLIF(profile.timezone_preference, ''), 'Asia/Kuala_Lumpur'), receipt.created_at)
            ) = DATE_TRUNC(
              'month',
              TIMEZONE(COALESCE(NULLIF(profile.timezone_preference, ''), 'Asia/Kuala_Lumpur'), NOW())
            )
        ), 0)
        ELSE COALESCE(stats.deductible_total_amount, 0)::NUMERIC
      END AS metric_value
    FROM public.user_gamification_stats stats
    LEFT JOIN public.profiles profile ON profile.id = stats.user_id
    WHERE stats.leaderboard_opt_in = TRUE
      AND (
        normalized_country IS NULL
        OR UPPER(COALESCE(stats.country_code, '')) = normalized_country
      )
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
    SELECT ranked.metric_value
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
    visible_rows.user_id,
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
        (SELECT metric_value FROM top_ten_threshold LIMIT 1) - visible_rows.metric_value,
        0::NUMERIC
      )
      ELSE 0::NUMERIC
    END AS gap_to_top_ten
  FROM visible_rows
  ORDER BY visible_rows.rank;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_gamification_leaderboard(TEXT, TEXT, INTEGER) TO authenticated;