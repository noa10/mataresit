-- Performance Optimizations for Malaysian Multi-language Support
-- This migration adds indexes, materialized views, and caching optimizations

-- Create composite indexes for frequently used queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipts_user_date_performance 
ON public.receipts(user_id, date DESC, id) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipts_merchant_category_performance 
ON public.receipts(merchant, category, total DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipts_malaysian_business_performance 
ON public.receipts(malaysian_business_category, detected_tax_type, currency) 
WHERE deleted_at IS NULL AND malaysian_business_category IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipts_embedding_search_performance 
ON public.receipts USING ivfflat (embedding vector_cosine_ops) 
WHERE embedding IS NOT NULL AND deleted_at IS NULL;

-- Optimize Malaysian business directory searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_malaysian_business_directory_search_performance 
ON public.malaysian_business_directory USING GIN(keywords, to_tsvector('english', business_name || ' ' || COALESCE(business_name_malay, ''))) 
WHERE is_active = true;

-- Optimize tax category lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_malaysian_tax_categories_lookup_performance 
ON public.malaysian_tax_categories(tax_type, is_active, effective_from, effective_to) 
WHERE is_active = true;

-- Optimize payment method detection
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_malaysian_payment_methods_search_performance 
ON public.malaysian_payment_methods USING GIN(keywords) 
WHERE is_active = true;

-- Optimize holiday lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_malaysian_holidays_date_state_performance 
ON public.malaysian_public_holidays(holiday_date, applicable_states) 
WHERE is_active = true;

-- Create materialized view for Malaysian business analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_malaysian_business_analytics AS
SELECT 
  mbd.business_type,
  mbd.industry_category,
  COUNT(r.id) as receipt_count,
  AVG(r.total) as avg_amount,
  SUM(r.total) as total_amount,
  COUNT(DISTINCT r.user_id) as unique_users,
  mtc.tax_type,
  mtc.tax_rate,
  COUNT(CASE WHEN r.detected_tax_type IS NOT NULL THEN 1 END) as receipts_with_tax,
  DATE_TRUNC('month', r.date) as month_year
FROM public.malaysian_business_directory mbd
LEFT JOIN public.receipts r ON LOWER(r.merchant) LIKE ANY(
  SELECT '%' || LOWER(keyword) || '%' 
  FROM unnest(mbd.keywords) AS keyword
)
LEFT JOIN public.malaysian_business_categories mbc ON mbc.business_type = mbd.business_type
LEFT JOIN public.malaysian_tax_categories mtc ON mtc.id = mbc.tax_category_id
WHERE mbd.is_active = true 
  AND (r.deleted_at IS NULL OR r.deleted_at IS NULL)
  AND r.date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY 
  mbd.business_type, 
  mbd.industry_category, 
  mtc.tax_type, 
  mtc.tax_rate,
  DATE_TRUNC('month', r.date);

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_malaysian_business_analytics_unique
ON public.mv_malaysian_business_analytics(business_type, industry_category, COALESCE(tax_type, 'NONE'), month_year);

-- Create materialized view for frequently accessed Malaysian data
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_malaysian_reference_data AS
SELECT 
  'business_directory' as data_type,
  mbd.business_name as name,
  mbd.business_type as category,
  mbd.keywords,
  mbd.confidence_score,
  NULL::DECIMAL as rate,
  NULL::TEXT[] as states
FROM public.malaysian_business_directory mbd
WHERE mbd.is_active = true

UNION ALL

SELECT 
  'tax_categories' as data_type,
  mtc.category_name as name,
  mtc.tax_type as category,
  NULL::TEXT[] as keywords,
  100 as confidence_score,
  mtc.tax_rate as rate,
  NULL::TEXT[] as states
FROM public.malaysian_tax_categories mtc
WHERE mtc.is_active = true

UNION ALL

SELECT 
  'payment_methods' as data_type,
  mpm.method_name as name,
  mpm.method_type as category,
  mpm.keywords,
  90 as confidence_score,
  mpm.processing_fee_percentage as rate,
  NULL::TEXT[] as states
FROM public.malaysian_payment_methods mpm
WHERE mpm.is_active = true

UNION ALL

SELECT 
  'holidays' as data_type,
  mph.holiday_name as name,
  mph.holiday_type as category,
  NULL::TEXT[] as keywords,
  100 as confidence_score,
  NULL::DECIMAL as rate,
  mph.applicable_states as states
FROM public.malaysian_public_holidays mph
WHERE mph.is_active = true 
  AND mph.holiday_date >= CURRENT_DATE - INTERVAL '1 year'
  AND mph.holiday_date <= CURRENT_DATE + INTERVAL '1 year';

-- Create index on reference data materialized view
CREATE INDEX IF NOT EXISTS idx_mv_malaysian_reference_data_type_category
ON public.mv_malaysian_reference_data(data_type, category);

CREATE INDEX IF NOT EXISTS idx_mv_malaysian_reference_data_keywords
ON public.mv_malaysian_reference_data USING GIN(keywords)
WHERE keywords IS NOT NULL;

-- Create performance monitoring table
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name VARCHAR(100) NOT NULL,
  metric_type VARCHAR(50) NOT NULL, -- 'query_time', 'cache_hit', 'ai_processing', 'search_performance'
  metric_value DECIMAL(10,3) NOT NULL,
  metric_unit VARCHAR(20) NOT NULL, -- 'ms', 'seconds', 'count', 'percentage'
  context JSONB, -- Additional context data
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance metrics
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name_type_date
ON public.performance_metrics(metric_name, metric_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_date
ON public.performance_metrics(user_id, created_at DESC)
WHERE user_id IS NOT NULL;

-- Create function to refresh materialized views
CREATE OR REPLACE FUNCTION public.refresh_malaysian_materialized_views()
RETURNS VOID
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Refresh business analytics view
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_malaysian_business_analytics;

  -- Refresh reference data view
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_malaysian_reference_data;

  -- Log the refresh
  INSERT INTO public.performance_metrics (metric_name, metric_type, metric_value, metric_unit, context)
  VALUES ('materialized_view_refresh', 'maintenance', 1, 'count',
          jsonb_build_object('timestamp', NOW(), 'views_refreshed', 2));
END;
$function$;

-- Create function to log performance metrics
CREATE OR REPLACE FUNCTION public.log_performance_metric(
  p_metric_name VARCHAR(100),
  p_metric_type VARCHAR(50),
  p_metric_value DECIMAL(10,3),
  p_metric_unit VARCHAR(20),
  p_context JSONB DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.performance_metrics (
    metric_name,
    metric_type,
    metric_value,
    metric_unit,
    context,
    user_id
  )
  VALUES (
    p_metric_name,
    p_metric_type,
    p_metric_value,
    p_metric_unit,
    p_context,
    p_user_id
  );
END;
$function$;

-- Create optimized Malaysian business search function
CREATE OR REPLACE FUNCTION public.search_malaysian_business_optimized(
  search_term TEXT,
  limit_results INTEGER DEFAULT 10,
  use_cache BOOLEAN DEFAULT true
)
RETURNS TABLE (
  business_name VARCHAR(200),
  business_type VARCHAR(100),
  industry_category VARCHAR(100),
  confidence_score INTEGER,
  is_chain BOOLEAN,
  keywords TEXT[]
)
LANGUAGE plpgsql
AS $function$
DECLARE
  start_time TIMESTAMP;
  end_time TIMESTAMP;
  execution_time DECIMAL(10,3);
BEGIN
  start_time := clock_timestamp();

  -- Use materialized view for better performance
  IF use_cache THEN
    RETURN QUERY
    SELECT
      mrd.name::VARCHAR(200) as business_name,
      mrd.category::VARCHAR(100) as business_type,
      mrd.category::VARCHAR(100) as industry_category,
      mrd.confidence_score::INTEGER,
      true as is_chain, -- Assume chains for cached data
      mrd.keywords
    FROM public.mv_malaysian_reference_data mrd
    WHERE
      mrd.data_type = 'business_directory'
      AND (
        LOWER(mrd.name) LIKE '%' || LOWER(search_term) || '%'
        OR EXISTS (
          SELECT 1 FROM unnest(mrd.keywords) AS keyword
          WHERE LOWER(keyword) LIKE '%' || LOWER(search_term) || '%'
        )
      )
    ORDER BY
      CASE WHEN LOWER(mrd.name) = LOWER(search_term) THEN 1 ELSE 2 END,
      mrd.confidence_score DESC,
      LENGTH(mrd.name)
    LIMIT limit_results;
  ELSE
    -- Fallback to direct table query
    RETURN QUERY
    SELECT
      mbd.business_name,
      mbd.business_type,
      mbd.industry_category,
      mbd.confidence_score,
      mbd.is_chain,
      mbd.keywords
    FROM public.malaysian_business_directory mbd
    WHERE
      mbd.is_active = true
      AND (
        LOWER(mbd.business_name) LIKE '%' || LOWER(search_term) || '%'
        OR EXISTS (
          SELECT 1 FROM unnest(mbd.keywords) AS keyword
          WHERE LOWER(keyword) LIKE '%' || LOWER(search_term) || '%'
        )
      )
    ORDER BY
      CASE WHEN LOWER(mbd.business_name) = LOWER(search_term) THEN 1 ELSE 2 END,
      mbd.confidence_score DESC,
      LENGTH(mbd.business_name)
    LIMIT limit_results;
  END IF;

  -- Log performance metric
  end_time := clock_timestamp();
  execution_time := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;

  PERFORM public.log_performance_metric(
    'malaysian_business_search',
    'query_time',
    execution_time,
    'ms',
    jsonb_build_object(
      'search_term', search_term,
      'use_cache', use_cache,
      'limit_results', limit_results
    )
  );
END;
$function$;

-- Create function to detect content language for AI optimization
CREATE OR REPLACE FUNCTION public.detect_content_language(
  content_text TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $function$
DECLARE
  malay_keywords TEXT[] := ARRAY[
    'ringgit', 'sen', 'jumlah', 'bayaran', 'cukai', 'gst', 'sst',
    'kedai', 'restoran', 'mamak', 'kopitiam', 'pasar', 'mall',
    'selamat', 'terima', 'kasih', 'sila', 'datang', 'lagi'
  ];
  english_keywords TEXT[] := ARRAY[
    'total', 'amount', 'payment', 'tax', 'receipt', 'invoice',
    'store', 'restaurant', 'shop', 'market', 'mall', 'center',
    'thank', 'you', 'please', 'come', 'again', 'welcome'
  ];
  chinese_keywords TEXT[] := ARRAY[
    '总额', '付款', '税', '收据', '商店', '餐厅', '谢谢'
  ];

  malay_count INTEGER := 0;
  english_count INTEGER := 0;
  chinese_count INTEGER := 0;
  total_words INTEGER;
  primary_language TEXT;
  confidence DECIMAL(5,2);

BEGIN
  -- Convert to lowercase for matching
  content_text := LOWER(content_text);

  -- Count keyword matches
  SELECT COUNT(*) INTO malay_count
  FROM unnest(malay_keywords) AS keyword
  WHERE content_text LIKE '%' || keyword || '%';

  SELECT COUNT(*) INTO english_count
  FROM unnest(english_keywords) AS keyword
  WHERE content_text LIKE '%' || keyword || '%';

  SELECT COUNT(*) INTO chinese_count
  FROM unnest(chinese_keywords) AS keyword
  WHERE content_text LIKE '%' || keyword || '%';

  -- Estimate total words
  total_words := array_length(string_to_array(trim(content_text), ' '), 1);

  -- Determine primary language
  IF malay_count >= english_count AND malay_count >= chinese_count THEN
    primary_language := 'ms';
    confidence := LEAST(95.0, (malay_count::DECIMAL / GREATEST(total_words, 1)) * 100 + 20);
  ELSIF chinese_count >= english_count THEN
    primary_language := 'zh';
    confidence := LEAST(95.0, (chinese_count::DECIMAL / GREATEST(total_words, 1)) * 100 + 20);
  ELSE
    primary_language := 'en';
    confidence := LEAST(95.0, (english_count::DECIMAL / GREATEST(total_words, 1)) * 100 + 30);
  END IF;

  -- Ensure minimum confidence
  confidence := GREATEST(confidence, 10.0);

  RETURN jsonb_build_object(
    'primary_language', primary_language,
    'confidence', confidence,
    'language_scores', jsonb_build_object(
      'malay', malay_count,
      'english', english_count,
      'chinese', chinese_count
    ),
    'total_words', total_words,
    'is_multilingual', (malay_count > 0 AND english_count > 0) OR
                      (malay_count > 0 AND chinese_count > 0) OR
                      (english_count > 0 AND chinese_count > 0)
  );
END;
$function$;

-- Create function to get performance analytics
CREATE OR REPLACE FUNCTION public.get_performance_analytics(
  start_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days',
  end_date DATE DEFAULT CURRENT_DATE,
  metric_types TEXT[] DEFAULT ARRAY['query_time', 'cache_hit', 'ai_processing']
)
RETURNS TABLE (
  metric_name VARCHAR(100),
  metric_type VARCHAR(50),
  avg_value DECIMAL(10,3),
  min_value DECIMAL(10,3),
  max_value DECIMAL(10,3),
  count_values BIGINT,
  metric_unit VARCHAR(20)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    pm.metric_name,
    pm.metric_type,
    AVG(pm.metric_value)::DECIMAL(10,3) as avg_value,
    MIN(pm.metric_value)::DECIMAL(10,3) as min_value,
    MAX(pm.metric_value)::DECIMAL(10,3) as max_value,
    COUNT(*)::BIGINT as count_values,
    pm.metric_unit
  FROM public.performance_metrics pm
  WHERE
    pm.created_at >= start_date
    AND pm.created_at <= end_date + INTERVAL '1 day'
    AND pm.metric_type = ANY(metric_types)
  GROUP BY pm.metric_name, pm.metric_type, pm.metric_unit
  ORDER BY pm.metric_name, pm.metric_type;
END;
$function$;

-- Create function to optimize AI model selection
CREATE OR REPLACE FUNCTION public.get_optimal_ai_model(
  content_text TEXT,
  processing_type VARCHAR(50) DEFAULT 'receipt_processing'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $function$
DECLARE
  language_info JSONB;
  recommended_model TEXT;
  model_config JSONB;
BEGIN
  -- Detect content language
  language_info := public.detect_content_language(content_text);

  -- Select optimal model based on content and processing type
  CASE
    WHEN (language_info->>'primary_language') = 'ms' AND processing_type = 'receipt_processing' THEN
      recommended_model := 'gemini-2.0-flash-lite';
      model_config := jsonb_build_object(
        'temperature', 0.2,
        'max_tokens', 2048,
        'supports_malay', true,
        'processing_priority', 'accuracy'
      );
    WHEN (language_info->>'is_multilingual')::BOOLEAN = true THEN
      recommended_model := 'gemini-2.5-flash-preview-05-20';
      model_config := jsonb_build_object(
        'temperature', 0.3,
        'max_tokens', 2048,
        'supports_multilingual', true,
        'processing_priority', 'multilingual'
      );
    WHEN processing_type = 'batch_processing' THEN
      recommended_model := 'gemini-2.0-flash-lite';
      model_config := jsonb_build_object(
        'temperature', 0.2,
        'max_tokens', 1024,
        'supports_batch', true,
        'processing_priority', 'speed'
      );
    ELSE
      recommended_model := 'gemini-2.0-flash-lite';
      model_config := jsonb_build_object(
        'temperature', 0.3,
        'max_tokens', 2048,
        'supports_general', true,
        'processing_priority', 'balanced'
      );
  END CASE;

  RETURN jsonb_build_object(
    'recommended_model', recommended_model,
    'model_config', model_config,
    'language_info', language_info,
    'processing_type', processing_type,
    'selection_reason', CASE
      WHEN (language_info->>'primary_language') = 'ms' THEN 'malay_optimized'
      WHEN (language_info->>'is_multilingual')::BOOLEAN = true THEN 'multilingual_support'
      WHEN processing_type = 'batch_processing' THEN 'batch_optimized'
      ELSE 'general_purpose'
    END
  );
END;
$function$;

-- Enable RLS on performance metrics table
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for performance metrics (admins can view all, users can view their own)
CREATE POLICY "Users can view their own performance metrics" ON public.performance_metrics
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Admins can view all performance metrics" ON public.performance_metrics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Grant execute permissions on optimization functions
GRANT EXECUTE ON FUNCTION public.refresh_malaysian_materialized_views() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_performance_metric(VARCHAR, VARCHAR, DECIMAL, VARCHAR, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_malaysian_business_optimized(TEXT, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_content_language(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_performance_analytics(DATE, DATE, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_optimal_ai_model(TEXT, VARCHAR) TO authenticated;

-- Create scheduled job to refresh materialized views (requires pg_cron extension)
-- This would typically be set up separately in production
-- SELECT cron.schedule('refresh-malaysian-views', '0 2 * * *', 'SELECT public.refresh_malaysian_materialized_views();');

-- Add comments for documentation
COMMENT ON TABLE public.performance_metrics IS 'Performance monitoring and analytics for Malaysian multi-language features';
COMMENT ON MATERIALIZED VIEW public.mv_malaysian_business_analytics IS 'Aggregated analytics for Malaysian business data and receipts';
COMMENT ON MATERIALIZED VIEW public.mv_malaysian_reference_data IS 'Cached reference data for Malaysian business, tax, payment, and holiday information';

COMMENT ON FUNCTION public.refresh_malaysian_materialized_views() IS 'Refreshes all Malaysian-related materialized views for performance optimization';
COMMENT ON FUNCTION public.log_performance_metric(VARCHAR, VARCHAR, DECIMAL, VARCHAR, JSONB, UUID) IS 'Logs performance metrics for monitoring and optimization';
COMMENT ON FUNCTION public.search_malaysian_business_optimized(TEXT, INTEGER, BOOLEAN) IS 'Optimized search function for Malaysian businesses with caching support';
COMMENT ON FUNCTION public.detect_content_language(TEXT) IS 'Detects primary language in content for AI model optimization';
COMMENT ON FUNCTION public.get_performance_analytics(DATE, DATE, TEXT[]) IS 'Retrieves performance analytics and metrics for specified date range';
COMMENT ON FUNCTION public.get_optimal_ai_model(TEXT, VARCHAR) IS 'Recommends optimal AI model based on content language and processing type';

-- Create cleanup job for old performance metrics (keep last 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_performance_metrics()
RETURNS VOID
LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM public.performance_metrics
  WHERE created_at < CURRENT_DATE - INTERVAL '30 days';

  -- Log cleanup activity
  INSERT INTO public.performance_metrics (metric_name, metric_type, metric_value, metric_unit, context)
  VALUES ('performance_metrics_cleanup', 'maintenance', 1, 'count',
          jsonb_build_object('cleanup_date', CURRENT_DATE, 'retention_days', 30));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_performance_metrics() TO authenticated;
