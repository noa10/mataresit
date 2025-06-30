-- Financial Pattern Analysis RPC Functions
-- This migration creates comprehensive RPC functions for financial analysis
-- to enable the chatbot to answer analytical questions about spending patterns

-- Function: Get spending by category with time period analysis
CREATE OR REPLACE FUNCTION get_spending_by_category(
  user_filter UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  currency_filter TEXT DEFAULT 'MYR'
)
RETURNS TABLE (
  category TEXT,
  total_amount DECIMAL(12,2),
  transaction_count BIGINT,
  average_amount DECIMAL(12,2),
  percentage_of_total DECIMAL(5,2),
  first_transaction DATE,
  last_transaction DATE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_spending DECIMAL(12,2);
BEGIN
  -- Calculate total spending for percentage calculation
  SELECT COALESCE(SUM(r.total), 0) INTO total_spending
  FROM receipts r
  WHERE r.user_id = user_filter
    AND r.currency = currency_filter
    AND (start_date IS NULL OR r.date >= start_date)
    AND (end_date IS NULL OR r.date <= end_date);

  -- Return category breakdown
  RETURN QUERY
  SELECT 
    COALESCE(r.predicted_category, 'Uncategorized') as category,
    COALESCE(SUM(r.total), 0)::DECIMAL(12,2) as total_amount,
    COUNT(*)::BIGINT as transaction_count,
    COALESCE(AVG(r.total), 0)::DECIMAL(12,2) as average_amount,
    CASE 
      WHEN total_spending > 0 THEN (COALESCE(SUM(r.total), 0) / total_spending * 100)::DECIMAL(5,2)
      ELSE 0::DECIMAL(5,2)
    END as percentage_of_total,
    MIN(r.date) as first_transaction,
    MAX(r.date) as last_transaction
  FROM receipts r
  WHERE r.user_id = user_filter
    AND r.currency = currency_filter
    AND (start_date IS NULL OR r.date >= start_date)
    AND (end_date IS NULL OR r.date <= end_date)
  GROUP BY COALESCE(r.predicted_category, 'Uncategorized')
  ORDER BY total_amount DESC;
END;
$$;

-- Function: Get monthly spending trends
CREATE OR REPLACE FUNCTION get_monthly_spending_trends(
  user_filter UUID,
  months_back INTEGER DEFAULT 12,
  currency_filter TEXT DEFAULT 'MYR'
)
RETURNS TABLE (
  year INTEGER,
  month INTEGER,
  month_name TEXT,
  total_amount DECIMAL(12,2),
  transaction_count BIGINT,
  average_amount DECIMAL(12,2),
  top_category TEXT,
  top_merchant TEXT,
  business_expense_amount DECIMAL(12,2),
  personal_expense_amount DECIMAL(12,2)
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH monthly_data AS (
    SELECT 
      EXTRACT(YEAR FROM r.date)::INTEGER as year,
      EXTRACT(MONTH FROM r.date)::INTEGER as month,
      TO_CHAR(r.date, 'Month') as month_name,
      SUM(r.total) as total_amount,
      COUNT(*) as transaction_count,
      AVG(r.total) as average_amount,
      SUM(CASE WHEN r.is_business_expense = true THEN r.total ELSE 0 END) as business_expense_amount,
      SUM(CASE WHEN r.is_business_expense = false OR r.is_business_expense IS NULL THEN r.total ELSE 0 END) as personal_expense_amount
    FROM receipts r
    WHERE r.user_id = user_filter
      AND r.currency = currency_filter
      AND r.date >= (CURRENT_DATE - INTERVAL '1 month' * months_back)
    GROUP BY EXTRACT(YEAR FROM r.date), EXTRACT(MONTH FROM r.date), TO_CHAR(r.date, 'Month')
  ),
  top_categories AS (
    SELECT 
      EXTRACT(YEAR FROM r.date)::INTEGER as year,
      EXTRACT(MONTH FROM r.date)::INTEGER as month,
      r.predicted_category,
      SUM(r.total) as category_total,
      ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM r.date), EXTRACT(MONTH FROM r.date) ORDER BY SUM(r.total) DESC) as rn
    FROM receipts r
    WHERE r.user_id = user_filter
      AND r.currency = currency_filter
      AND r.date >= (CURRENT_DATE - INTERVAL '1 month' * months_back)
      AND r.predicted_category IS NOT NULL
    GROUP BY EXTRACT(YEAR FROM r.date), EXTRACT(MONTH FROM r.date), r.predicted_category
  ),
  top_merchants AS (
    SELECT 
      EXTRACT(YEAR FROM r.date)::INTEGER as year,
      EXTRACT(MONTH FROM r.date)::INTEGER as month,
      COALESCE(r.merchant_normalized, r.merchant) as merchant,
      SUM(r.total) as merchant_total,
      ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM r.date), EXTRACT(MONTH FROM r.date) ORDER BY SUM(r.total) DESC) as rn
    FROM receipts r
    WHERE r.user_id = user_filter
      AND r.currency = currency_filter
      AND r.date >= (CURRENT_DATE - INTERVAL '1 month' * months_back)
    GROUP BY EXTRACT(YEAR FROM r.date), EXTRACT(MONTH FROM r.date), COALESCE(r.merchant_normalized, r.merchant)
  )
  SELECT 
    md.year,
    md.month,
    md.month_name,
    md.total_amount::DECIMAL(12,2),
    md.transaction_count::BIGINT,
    md.average_amount::DECIMAL(12,2),
    tc.predicted_category as top_category,
    tm.merchant as top_merchant,
    md.business_expense_amount::DECIMAL(12,2),
    md.personal_expense_amount::DECIMAL(12,2)
  FROM monthly_data md
  LEFT JOIN top_categories tc ON md.year = tc.year AND md.month = tc.month AND tc.rn = 1
  LEFT JOIN top_merchants tm ON md.year = tm.year AND md.month = tm.month AND tm.rn = 1
  ORDER BY md.year DESC, md.month DESC;
END;
$$;

-- Function: Get merchant analysis with spending patterns
CREATE OR REPLACE FUNCTION get_merchant_analysis(
  user_filter UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  currency_filter TEXT DEFAULT 'MYR',
  limit_results INTEGER DEFAULT 20
)
RETURNS TABLE (
  merchant TEXT,
  merchant_category TEXT,
  business_type TEXT,
  location_city TEXT,
  location_state TEXT,
  total_amount DECIMAL(12,2),
  transaction_count BIGINT,
  average_amount DECIMAL(12,2),
  first_visit DATE,
  last_visit DATE,
  frequency_score DECIMAL(5,2),
  loyalty_programs TEXT[],
  payment_methods TEXT[],
  business_expense_ratio DECIMAL(5,2)
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH merchant_stats AS (
    SELECT 
      COALESCE(r.merchant_normalized, r.merchant) as merchant,
      r.merchant_category,
      r.business_type,
      r.location_city,
      r.location_state,
      SUM(r.total) as total_amount,
      COUNT(*) as transaction_count,
      AVG(r.total) as average_amount,
      MIN(r.date) as first_visit,
      MAX(r.date) as last_visit,
      -- Calculate frequency score based on visit pattern
      CASE 
        WHEN MAX(r.date) - MIN(r.date) > 0 THEN 
          COUNT(*)::DECIMAL / EXTRACT(DAYS FROM (MAX(r.date) - MIN(r.date)) + 1) * 30
        ELSE COUNT(*)::DECIMAL
      END as frequency_score,
      ARRAY_AGG(DISTINCT r.loyalty_program) FILTER (WHERE r.loyalty_program IS NOT NULL) as loyalty_programs,
      ARRAY_AGG(DISTINCT r.payment_method) FILTER (WHERE r.payment_method IS NOT NULL) as payment_methods,
      CASE 
        WHEN COUNT(*) > 0 THEN 
          (COUNT(*) FILTER (WHERE r.is_business_expense = true)::DECIMAL / COUNT(*) * 100)
        ELSE 0
      END as business_expense_ratio
    FROM receipts r
    WHERE r.user_id = user_filter
      AND r.currency = currency_filter
      AND (start_date IS NULL OR r.date >= start_date)
      AND (end_date IS NULL OR r.date <= end_date)
    GROUP BY 
      COALESCE(r.merchant_normalized, r.merchant),
      r.merchant_category,
      r.business_type,
      r.location_city,
      r.location_state
  )
  SELECT 
    ms.merchant,
    ms.merchant_category,
    ms.business_type,
    ms.location_city,
    ms.location_state,
    ms.total_amount::DECIMAL(12,2),
    ms.transaction_count::BIGINT,
    ms.average_amount::DECIMAL(12,2),
    ms.first_visit,
    ms.last_visit,
    ms.frequency_score::DECIMAL(5,2),
    ms.loyalty_programs,
    ms.payment_methods,
    ms.business_expense_ratio::DECIMAL(5,2)
  FROM merchant_stats ms
  ORDER BY ms.total_amount DESC
  LIMIT limit_results;
END;
$$;

-- Function: Get spending anomalies and insights
CREATE OR REPLACE FUNCTION get_spending_anomalies(
  user_filter UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  currency_filter TEXT DEFAULT 'MYR'
)
RETURNS TABLE (
  receipt_id UUID,
  merchant TEXT,
  date DATE,
  amount DECIMAL(12,2),
  category TEXT,
  anomaly_type TEXT,
  anomaly_score DECIMAL(5,2),
  description TEXT,
  comparison_baseline DECIMAL(12,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  avg_transaction DECIMAL(12,2);
  std_dev_transaction DECIMAL(12,2);
BEGIN
  -- Calculate baseline statistics
  SELECT
    AVG(r.total),
    STDDEV(r.total)
  INTO avg_transaction, std_dev_transaction
  FROM receipts r
  WHERE r.user_id = user_filter
    AND r.currency = currency_filter
    AND (start_date IS NULL OR r.date >= start_date)
    AND (end_date IS NULL OR r.date <= end_date);

  -- Return anomalies
  RETURN QUERY
  WITH anomaly_detection AS (
    SELECT
      r.id as receipt_id,
      COALESCE(r.merchant_normalized, r.merchant) as merchant,
      r.date,
      r.total as amount,
      r.predicted_category as category,
      CASE
        WHEN r.total > (avg_transaction + 2 * std_dev_transaction) THEN 'high_amount'
        WHEN r.total < (avg_transaction - 2 * std_dev_transaction) AND r.total > 0 THEN 'low_amount'
        WHEN r.anomaly_flags IS NOT NULL THEN 'ai_detected'
        WHEN EXTRACT(HOUR FROM r.transaction_time) < 6 OR EXTRACT(HOUR FROM r.transaction_time) > 23 THEN 'unusual_time'
        WHEN r.discount_amount > (r.subtotal * 0.5) THEN 'high_discount'
        ELSE NULL
      END as anomaly_type,
      CASE
        WHEN r.total > (avg_transaction + 2 * std_dev_transaction) THEN
          LEAST(100, ((r.total - avg_transaction) / std_dev_transaction * 10))
        WHEN r.total < (avg_transaction - 2 * std_dev_transaction) AND r.total > 0 THEN
          LEAST(100, ((avg_transaction - r.total) / std_dev_transaction * 10))
        WHEN r.anomaly_flags IS NOT NULL THEN 85
        WHEN EXTRACT(HOUR FROM r.transaction_time) < 6 OR EXTRACT(HOUR FROM r.transaction_time) > 23 THEN 60
        WHEN r.discount_amount > (r.subtotal * 0.5) THEN 70
        ELSE 0
      END as anomaly_score,
      CASE
        WHEN r.total > (avg_transaction + 2 * std_dev_transaction) THEN
          'Unusually high transaction amount compared to your average'
        WHEN r.total < (avg_transaction - 2 * std_dev_transaction) AND r.total > 0 THEN
          'Unusually low transaction amount'
        WHEN r.anomaly_flags IS NOT NULL THEN
          'AI detected unusual patterns in this transaction'
        WHEN EXTRACT(HOUR FROM r.transaction_time) < 6 OR EXTRACT(HOUR FROM r.transaction_time) > 23 THEN
          'Transaction occurred at unusual hours'
        WHEN r.discount_amount > (r.subtotal * 0.5) THEN
          'Unusually high discount percentage'
        ELSE 'Normal transaction'
      END as description,
      avg_transaction as comparison_baseline
    FROM receipts r
    WHERE r.user_id = user_filter
      AND r.currency = currency_filter
      AND (start_date IS NULL OR r.date >= start_date)
      AND (end_date IS NULL OR r.date <= end_date)
  )
  SELECT
    ad.receipt_id,
    ad.merchant,
    ad.date,
    ad.amount::DECIMAL(12,2),
    ad.category,
    ad.anomaly_type,
    ad.anomaly_score::DECIMAL(5,2),
    ad.description,
    ad.comparison_baseline::DECIMAL(12,2)
  FROM anomaly_detection ad
  WHERE ad.anomaly_type IS NOT NULL
    AND ad.anomaly_score > 50
  ORDER BY ad.anomaly_score DESC, ad.date DESC;
END;
$$;

-- Function: Get time-based spending patterns
CREATE OR REPLACE FUNCTION get_time_based_patterns(
  user_filter UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  currency_filter TEXT DEFAULT 'MYR'
)
RETURNS TABLE (
  time_period TEXT,
  period_value TEXT,
  total_amount DECIMAL(12,2),
  transaction_count BIGINT,
  average_amount DECIMAL(12,2),
  top_category TEXT,
  top_merchant TEXT,
  business_expense_ratio DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  -- Day of week patterns
  WITH dow_patterns AS (
    SELECT
      'day_of_week' as time_period,
      TO_CHAR(r.date, 'Day') as period_value,
      SUM(r.total) as total_amount,
      COUNT(*) as transaction_count,
      AVG(r.total) as average_amount,
      MODE() WITHIN GROUP (ORDER BY r.predicted_category) as top_category,
      MODE() WITHIN GROUP (ORDER BY COALESCE(r.merchant_normalized, r.merchant)) as top_merchant,
      CASE
        WHEN COUNT(*) > 0 THEN
          (COUNT(*) FILTER (WHERE r.is_business_expense = true)::DECIMAL / COUNT(*) * 100)
        ELSE 0
      END as business_expense_ratio
    FROM receipts r
    WHERE r.user_id = user_filter
      AND r.currency = currency_filter
      AND (start_date IS NULL OR r.date >= start_date)
      AND (end_date IS NULL OR r.date <= end_date)
    GROUP BY TO_CHAR(r.date, 'Day'), EXTRACT(DOW FROM r.date)
    ORDER BY EXTRACT(DOW FROM r.date)
  ),
  -- Hour of day patterns
  hour_patterns AS (
    SELECT
      'hour_of_day' as time_period,
      CASE
        WHEN EXTRACT(HOUR FROM r.transaction_time) BETWEEN 6 AND 11 THEN 'Morning (6-11)'
        WHEN EXTRACT(HOUR FROM r.transaction_time) BETWEEN 12 AND 17 THEN 'Afternoon (12-17)'
        WHEN EXTRACT(HOUR FROM r.transaction_time) BETWEEN 18 AND 22 THEN 'Evening (18-22)'
        ELSE 'Night (23-5)'
      END as period_value,
      SUM(r.total) as total_amount,
      COUNT(*) as transaction_count,
      AVG(r.total) as average_amount,
      MODE() WITHIN GROUP (ORDER BY r.predicted_category) as top_category,
      MODE() WITHIN GROUP (ORDER BY COALESCE(r.merchant_normalized, r.merchant)) as top_merchant,
      CASE
        WHEN COUNT(*) > 0 THEN
          (COUNT(*) FILTER (WHERE r.is_business_expense = true)::DECIMAL / COUNT(*) * 100)
        ELSE 0
      END as business_expense_ratio
    FROM receipts r
    WHERE r.user_id = user_filter
      AND r.currency = currency_filter
      AND r.transaction_time IS NOT NULL
      AND (start_date IS NULL OR r.date >= start_date)
      AND (end_date IS NULL OR r.date <= end_date)
    GROUP BY
      CASE
        WHEN EXTRACT(HOUR FROM r.transaction_time) BETWEEN 6 AND 11 THEN 'Morning (6-11)'
        WHEN EXTRACT(HOUR FROM r.transaction_time) BETWEEN 12 AND 17 THEN 'Afternoon (12-17)'
        WHEN EXTRACT(HOUR FROM r.transaction_time) BETWEEN 18 AND 22 THEN 'Evening (18-22)'
        ELSE 'Night (23-5)'
      END
  )
  SELECT
    dp.time_period,
    dp.period_value,
    dp.total_amount::DECIMAL(12,2),
    dp.transaction_count::BIGINT,
    dp.average_amount::DECIMAL(12,2),
    dp.top_category,
    dp.top_merchant,
    dp.business_expense_ratio::DECIMAL(5,2)
  FROM dow_patterns dp
  UNION ALL
  SELECT
    hp.time_period,
    hp.period_value,
    hp.total_amount::DECIMAL(12,2),
    hp.transaction_count::BIGINT,
    hp.average_amount::DECIMAL(12,2),
    hp.top_category,
    hp.top_merchant,
    hp.business_expense_ratio::DECIMAL(5,2)
  FROM hour_patterns hp
  ORDER BY time_period, total_amount DESC;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_spending_by_category(UUID, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_spending_trends(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_analysis(UUID, DATE, DATE, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_spending_anomalies(UUID, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_time_based_patterns(UUID, DATE, DATE, TEXT) TO authenticated;
