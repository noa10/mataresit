-- Database Functions for Dynamic Tool System
-- This migration adds specialized database functions for the tool system

-- Function to calculate user spending totals with filters
CREATE OR REPLACE FUNCTION calculate_user_spending_total(
  user_id UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  merchant_filter TEXT DEFAULT NULL,
  category_filter TEXT DEFAULT NULL,
  currency_filter TEXT DEFAULT 'MYR'
) RETURNS TABLE (
  total_amount NUMERIC,
  transaction_count BIGINT,
  average_amount NUMERIC,
  currency TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(r.total), 0) as total_amount,
    COUNT(*) as transaction_count,
    COALESCE(AVG(r.total), 0) as average_amount,
    currency_filter as currency
  FROM receipts r
  WHERE 
    r.user_id = calculate_user_spending_total.user_id
    AND (start_date IS NULL OR r.date >= start_date)
    AND (end_date IS NULL OR r.date <= end_date)
    AND (merchant_filter IS NULL OR LOWER(r.merchant) LIKE LOWER('%' || merchant_filter || '%'))
    AND (category_filter IS NULL OR LOWER(r.category) LIKE LOWER('%' || category_filter || '%'))
    AND r.total IS NOT NULL
    AND r.total > 0;
END;
$$;

-- Function to get detailed merchant statistics
CREATE OR REPLACE FUNCTION get_merchant_statistics(
  user_id UUID,
  merchant_name TEXT,
  time_range TEXT DEFAULT NULL,
  include_comparison BOOLEAN DEFAULT FALSE
) RETURNS TABLE (
  merchant TEXT,
  total_spent NUMERIC,
  transaction_count BIGINT,
  average_transaction NUMERIC,
  first_visit DATE,
  last_visit DATE,
  visit_frequency NUMERIC,
  category_breakdown JSONB,
  comparison_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_date DATE;
  end_date DATE;
  total_days INTEGER;
BEGIN
  -- Parse time range
  IF time_range IS NOT NULL THEN
    CASE time_range
      WHEN 'last_month' THEN
        start_date := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');
        end_date := DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day';
      WHEN 'this_month' THEN
        start_date := DATE_TRUNC('month', CURRENT_DATE);
        end_date := CURRENT_DATE;
      WHEN 'last_year' THEN
        start_date := DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year');
        end_date := DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 day';
      WHEN 'this_year' THEN
        start_date := DATE_TRUNC('year', CURRENT_DATE);
        end_date := CURRENT_DATE;
      ELSE
        start_date := NULL;
        end_date := NULL;
    END CASE;
  END IF;

  RETURN QUERY
  WITH merchant_stats AS (
    SELECT 
      r.merchant,
      SUM(r.total) as total_spent,
      COUNT(*) as transaction_count,
      AVG(r.total) as average_transaction,
      MIN(r.date) as first_visit,
      MAX(r.date) as last_visit,
      -- Calculate visit frequency (transactions per month)
      CASE 
        WHEN MIN(r.date) = MAX(r.date) THEN 1
        ELSE COUNT(*)::NUMERIC / GREATEST(1, EXTRACT(EPOCH FROM (MAX(r.date) - MIN(r.date))) / (30 * 24 * 3600))
      END as visit_frequency
    FROM receipts r
    WHERE 
      r.user_id = get_merchant_statistics.user_id
      AND LOWER(r.merchant) LIKE LOWER('%' || merchant_name || '%')
      AND (start_date IS NULL OR r.date >= start_date)
      AND (end_date IS NULL OR r.date <= end_date)
      AND r.total IS NOT NULL
      AND r.total > 0
    GROUP BY r.merchant
  ),
  category_stats AS (
    SELECT 
      r.merchant,
      jsonb_agg(
        jsonb_build_object(
          'category', COALESCE(r.category, 'Uncategorized'),
          'amount', SUM(r.total),
          'count', COUNT(*)
        ) ORDER BY SUM(r.total) DESC
      ) as category_breakdown
    FROM receipts r
    WHERE 
      r.user_id = get_merchant_statistics.user_id
      AND LOWER(r.merchant) LIKE LOWER('%' || merchant_name || '%')
      AND (start_date IS NULL OR r.date >= start_date)
      AND (end_date IS NULL OR r.date <= end_date)
      AND r.total IS NOT NULL
      AND r.total > 0
    GROUP BY r.merchant
  ),
  comparison_stats AS (
    SELECT 
      jsonb_build_object(
        'user_rank', ROW_NUMBER() OVER (ORDER BY SUM(r.total) DESC),
        'total_merchants', COUNT(DISTINCT r.merchant),
        'percentile', PERCENT_RANK() OVER (ORDER BY SUM(r.total))
      ) as comparison_data
    FROM receipts r
    WHERE 
      r.user_id = get_merchant_statistics.user_id
      AND (start_date IS NULL OR r.date >= start_date)
      AND (end_date IS NULL OR r.date <= end_date)
      AND r.total IS NOT NULL
      AND r.total > 0
    GROUP BY r.merchant
    HAVING LOWER(r.merchant) LIKE LOWER('%' || merchant_name || '%')
  )
  SELECT 
    ms.merchant,
    ms.total_spent,
    ms.transaction_count,
    ms.average_transaction,
    ms.first_visit,
    ms.last_visit,
    ms.visit_frequency,
    COALESCE(cs.category_breakdown, '[]'::jsonb) as category_breakdown,
    CASE 
      WHEN include_comparison THEN COALESCE(comp.comparison_data, '{}'::jsonb)
      ELSE '{}'::jsonb
    END as comparison_data
  FROM merchant_stats ms
  LEFT JOIN category_stats cs ON ms.merchant = cs.merchant
  LEFT JOIN comparison_stats comp ON TRUE
  ORDER BY ms.total_spent DESC
  LIMIT 1;
END;
$$;

-- Function to get spending trends over time
CREATE OR REPLACE FUNCTION get_spending_trends(
  user_id UUID,
  analysis_type TEXT DEFAULT 'monthly',
  period_count INTEGER DEFAULT 12,
  category_filter TEXT DEFAULT NULL
) RETURNS TABLE (
  period_label TEXT,
  period_start DATE,
  period_end DATE,
  total_amount NUMERIC,
  transaction_count BIGINT,
  average_amount NUMERIC,
  period_over_period_change NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  interval_text TEXT;
  date_trunc_format TEXT;
BEGIN
  -- Set interval and format based on analysis type
  CASE analysis_type
    WHEN 'daily' THEN
      interval_text := '1 day';
      date_trunc_format := 'day';
    WHEN 'weekly' THEN
      interval_text := '1 week';
      date_trunc_format := 'week';
    WHEN 'monthly' THEN
      interval_text := '1 month';
      date_trunc_format := 'month';
    WHEN 'yearly' THEN
      interval_text := '1 year';
      date_trunc_format := 'year';
    ELSE
      interval_text := '1 month';
      date_trunc_format := 'month';
  END CASE;

  RETURN QUERY
  WITH period_series AS (
    SELECT 
      generate_series(
        DATE_TRUNC(date_trunc_format, CURRENT_DATE - (interval_text::INTERVAL * period_count)),
        DATE_TRUNC(date_trunc_format, CURRENT_DATE),
        interval_text::INTERVAL
      ) as period_start
  ),
  period_data AS (
    SELECT 
      ps.period_start,
      ps.period_start + interval_text::INTERVAL - INTERVAL '1 day' as period_end,
      COALESCE(SUM(r.total), 0) as total_amount,
      COUNT(r.id) as transaction_count,
      COALESCE(AVG(r.total), 0) as average_amount
    FROM period_series ps
    LEFT JOIN receipts r ON 
      r.user_id = get_spending_trends.user_id
      AND r.date >= ps.period_start
      AND r.date < ps.period_start + interval_text::INTERVAL
      AND (category_filter IS NULL OR LOWER(r.category) LIKE LOWER('%' || category_filter || '%'))
      AND r.total IS NOT NULL
      AND r.total > 0
    GROUP BY ps.period_start
    ORDER BY ps.period_start
  )
  SELECT 
    TO_CHAR(pd.period_start, 
      CASE analysis_type
        WHEN 'daily' THEN 'YYYY-MM-DD'
        WHEN 'weekly' THEN 'YYYY-"W"WW'
        WHEN 'monthly' THEN 'YYYY-MM'
        WHEN 'yearly' THEN 'YYYY'
        ELSE 'YYYY-MM'
      END
    ) as period_label,
    pd.period_start,
    pd.period_end,
    pd.total_amount,
    pd.transaction_count,
    pd.average_amount,
    -- Calculate period-over-period change
    CASE 
      WHEN LAG(pd.total_amount) OVER (ORDER BY pd.period_start) = 0 THEN 0
      WHEN LAG(pd.total_amount) OVER (ORDER BY pd.period_start) IS NULL THEN 0
      ELSE ((pd.total_amount - LAG(pd.total_amount) OVER (ORDER BY pd.period_start)) / 
            LAG(pd.total_amount) OVER (ORDER BY pd.period_start)) * 100
    END as period_over_period_change
  FROM period_data pd
  WHERE pd.period_start >= DATE_TRUNC(date_trunc_format, CURRENT_DATE - (interval_text::INTERVAL * period_count))
  ORDER BY pd.period_start;
END;
$$;

-- Function to get category breakdown with percentages
CREATE OR REPLACE FUNCTION get_category_breakdown(
  user_id UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  top_n INTEGER DEFAULT 10,
  minimum_amount NUMERIC DEFAULT 0
) RETURNS TABLE (
  category TEXT,
  total_amount NUMERIC,
  transaction_count BIGINT,
  percentage NUMERIC,
  average_amount NUMERIC,
  subcategory_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_spending NUMERIC;
BEGIN
  -- Calculate total spending for percentage calculations
  SELECT COALESCE(SUM(r.total), 0) INTO total_spending
  FROM receipts r
  WHERE 
    r.user_id = get_category_breakdown.user_id
    AND (start_date IS NULL OR r.date >= start_date)
    AND (end_date IS NULL OR r.date <= end_date)
    AND r.total IS NOT NULL
    AND r.total > 0;

  RETURN QUERY
  WITH category_stats AS (
    SELECT 
      COALESCE(r.category, 'Uncategorized') as category,
      SUM(r.total) as total_amount,
      COUNT(*) as transaction_count,
      AVG(r.total) as average_amount
    FROM receipts r
    WHERE 
      r.user_id = get_category_breakdown.user_id
      AND (start_date IS NULL OR r.date >= start_date)
      AND (end_date IS NULL OR r.date <= end_date)
      AND r.total IS NOT NULL
      AND r.total >= minimum_amount
    GROUP BY COALESCE(r.category, 'Uncategorized')
    HAVING SUM(r.total) >= minimum_amount
    ORDER BY SUM(r.total) DESC
    LIMIT top_n
  )
  SELECT 
    cs.category,
    cs.total_amount,
    cs.transaction_count,
    CASE 
      WHEN total_spending > 0 THEN (cs.total_amount / total_spending) * 100
      ELSE 0
    END as percentage,
    cs.average_amount,
    '[]'::jsonb as subcategory_breakdown -- Placeholder for future subcategory support
  FROM category_stats cs
  ORDER BY cs.total_amount DESC;
END;
$$;

-- Function to search receipts with advanced filters
CREATE OR REPLACE FUNCTION search_receipts_advanced(
  user_id UUID,
  search_query TEXT DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  min_amount NUMERIC DEFAULT NULL,
  max_amount NUMERIC DEFAULT NULL,
  merchants TEXT[] DEFAULT NULL,
  categories TEXT[] DEFAULT NULL,
  sort_by TEXT DEFAULT 'date',
  sort_order TEXT DEFAULT 'desc',
  result_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  id UUID,
  merchant TEXT,
  total NUMERIC,
  date DATE,
  category TEXT,
  notes TEXT,
  relevance_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.merchant,
    r.total,
    r.date,
    r.category,
    r.notes,
    -- Calculate relevance score based on search query
    CASE 
      WHEN search_query IS NULL THEN 1.0
      ELSE (
        CASE WHEN LOWER(r.merchant) LIKE LOWER('%' || search_query || '%') THEN 0.4 ELSE 0 END +
        CASE WHEN LOWER(COALESCE(r.category, '')) LIKE LOWER('%' || search_query || '%') THEN 0.3 ELSE 0 END +
        CASE WHEN LOWER(COALESCE(r.notes, '')) LIKE LOWER('%' || search_query || '%') THEN 0.3 ELSE 0 END
      )
    END as relevance_score
  FROM receipts r
  WHERE 
    r.user_id = search_receipts_advanced.user_id
    AND (search_query IS NULL OR (
      LOWER(r.merchant) LIKE LOWER('%' || search_query || '%') OR
      LOWER(COALESCE(r.category, '')) LIKE LOWER('%' || search_query || '%') OR
      LOWER(COALESCE(r.notes, '')) LIKE LOWER('%' || search_query || '%')
    ))
    AND (start_date IS NULL OR r.date >= start_date)
    AND (end_date IS NULL OR r.date <= end_date)
    AND (min_amount IS NULL OR r.total >= min_amount)
    AND (max_amount IS NULL OR r.total <= max_amount)
    AND (merchants IS NULL OR r.merchant = ANY(merchants))
    AND (categories IS NULL OR r.category = ANY(categories))
    AND r.total IS NOT NULL
  ORDER BY 
    CASE 
      WHEN sort_by = 'date' AND sort_order = 'desc' THEN r.date
    END DESC,
    CASE 
      WHEN sort_by = 'date' AND sort_order = 'asc' THEN r.date
    END ASC,
    CASE 
      WHEN sort_by = 'amount' AND sort_order = 'desc' THEN r.total
    END DESC,
    CASE 
      WHEN sort_by = 'amount' AND sort_order = 'asc' THEN r.total
    END ASC,
    CASE 
      WHEN sort_by = 'merchant' AND sort_order = 'desc' THEN r.merchant
    END DESC,
    CASE 
      WHEN sort_by = 'merchant' AND sort_order = 'asc' THEN r.merchant
    END ASC,
    CASE 
      WHEN sort_by = 'relevance' THEN (
        CASE WHEN LOWER(r.merchant) LIKE LOWER('%' || COALESCE(search_query, '') || '%') THEN 0.4 ELSE 0 END +
        CASE WHEN LOWER(COALESCE(r.category, '')) LIKE LOWER('%' || COALESCE(search_query, '') || '%') THEN 0.3 ELSE 0 END +
        CASE WHEN LOWER(COALESCE(r.notes, '')) LIKE LOWER('%' || COALESCE(search_query, '') || '%') THEN 0.3 ELSE 0 END
      )
    END DESC
  LIMIT result_limit;
END;
$$;

-- Add helpful comments
COMMENT ON FUNCTION calculate_user_spending_total IS 'Calculate total spending with flexible filters for time range, merchant, and category';
COMMENT ON FUNCTION get_merchant_statistics IS 'Get comprehensive statistics for a specific merchant including trends and comparisons';
COMMENT ON FUNCTION get_spending_trends IS 'Analyze spending trends over time with period-over-period comparisons';
COMMENT ON FUNCTION get_category_breakdown IS 'Calculate spending breakdown by category with percentages and subcategory support';
COMMENT ON FUNCTION search_receipts_advanced IS 'Advanced receipt search with multiple filters, sorting, and relevance scoring';
