-- Create embedding quality metrics table for tracking AI vision embedding performance
-- This table helps monitor the quality and effectiveness of the enhanced embedding generation

CREATE TABLE IF NOT EXISTS public.embedding_quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  total_content_types INTEGER NOT NULL DEFAULT 0,
  successful_embeddings INTEGER NOT NULL DEFAULT 0,
  failed_embeddings INTEGER NOT NULL DEFAULT 0,
  synthetic_content_used BOOLEAN NOT NULL DEFAULT FALSE,
  overall_quality_score INTEGER NOT NULL DEFAULT 0 CHECK (overall_quality_score >= 0 AND overall_quality_score <= 100),
  processing_method TEXT NOT NULL CHECK (processing_method IN ('enhanced', 'fallback', 'legacy')),
  content_quality_scores JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_embedding_quality_metrics_receipt_id 
ON public.embedding_quality_metrics (receipt_id);

CREATE INDEX IF NOT EXISTS idx_embedding_quality_metrics_processing_method 
ON public.embedding_quality_metrics (processing_method);

CREATE INDEX IF NOT EXISTS idx_embedding_quality_metrics_quality_score 
ON public.embedding_quality_metrics (overall_quality_score);

CREATE INDEX IF NOT EXISTS idx_embedding_quality_metrics_created_at 
ON public.embedding_quality_metrics (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_embedding_quality_metrics_synthetic_content 
ON public.embedding_quality_metrics (synthetic_content_used);

-- Enable RLS
ALTER TABLE public.embedding_quality_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own embedding quality metrics" 
ON public.embedding_quality_metrics
FOR SELECT 
USING (
  receipt_id IN (
    SELECT id FROM public.receipts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "System can insert embedding quality metrics" 
ON public.embedding_quality_metrics
FOR INSERT 
WITH CHECK (
  receipt_id IN (
    SELECT id FROM public.receipts WHERE user_id = auth.uid()
  )
);

-- Create function to get quality metrics summary
CREATE OR REPLACE FUNCTION get_embedding_quality_summary(
  p_user_id UUID DEFAULT NULL,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_receipts BIGINT,
  avg_quality_score NUMERIC,
  synthetic_content_rate NUMERIC,
  enhanced_processing_rate NUMERIC,
  recent_quality_trend NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use provided user_id or current authenticated user
  p_user_id := COALESCE(p_user_id, auth.uid());
  
  RETURN QUERY
  WITH quality_data AS (
    SELECT 
      eqm.*,
      r.user_id,
      CASE 
        WHEN eqm.created_at >= NOW() - INTERVAL '7 days' THEN 'recent'
        ELSE 'older'
      END as period
    FROM embedding_quality_metrics eqm
    JOIN receipts r ON eqm.receipt_id = r.id
    WHERE r.user_id = p_user_id
      AND eqm.created_at >= NOW() - INTERVAL '1 day' * p_days_back
  ),
  summary_stats AS (
    SELECT 
      COUNT(*) as total_receipts,
      AVG(overall_quality_score) as avg_quality_score,
      AVG(CASE WHEN synthetic_content_used THEN 1.0 ELSE 0.0 END) as synthetic_content_rate,
      AVG(CASE WHEN processing_method = 'enhanced' THEN 1.0 ELSE 0.0 END) as enhanced_processing_rate
    FROM quality_data
  ),
  trend_data AS (
    SELECT 
      AVG(CASE WHEN period = 'recent' THEN overall_quality_score END) as recent_avg,
      AVG(CASE WHEN period = 'older' THEN overall_quality_score END) as older_avg
    FROM quality_data
  )
  SELECT 
    s.total_receipts,
    ROUND(s.avg_quality_score, 2) as avg_quality_score,
    ROUND(s.synthetic_content_rate, 3) as synthetic_content_rate,
    ROUND(s.enhanced_processing_rate, 3) as enhanced_processing_rate,
    ROUND(
      CASE 
        WHEN t.older_avg > 0 THEN (t.recent_avg - t.older_avg) / t.older_avg * 100
        ELSE 0
      END, 
      2
    ) as recent_quality_trend
  FROM summary_stats s
  CROSS JOIN trend_data t;
END;
$$;

-- Create function to identify receipts needing embedding quality improvement
CREATE OR REPLACE FUNCTION find_low_quality_embeddings(
  p_user_id UUID DEFAULT NULL,
  p_min_quality_score INTEGER DEFAULT 50,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  receipt_id UUID,
  merchant TEXT,
  date DATE,
  overall_quality_score INTEGER,
  processing_method TEXT,
  synthetic_content_used BOOLEAN,
  successful_embeddings INTEGER,
  total_content_types INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use provided user_id or current authenticated user
  p_user_id := COALESCE(p_user_id, auth.uid());
  
  RETURN QUERY
  SELECT 
    eqm.receipt_id,
    r.merchant,
    r.date,
    eqm.overall_quality_score,
    eqm.processing_method,
    eqm.synthetic_content_used,
    eqm.successful_embeddings,
    eqm.total_content_types,
    eqm.created_at
  FROM embedding_quality_metrics eqm
  JOIN receipts r ON eqm.receipt_id = r.id
  WHERE r.user_id = p_user_id
    AND eqm.overall_quality_score < p_min_quality_score
  ORDER BY eqm.overall_quality_score ASC, eqm.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Create function to track quality improvements over time
CREATE OR REPLACE FUNCTION track_quality_improvements(
  p_user_id UUID DEFAULT NULL,
  p_days_back INTEGER DEFAULT 90
)
RETURNS TABLE (
  date_bucket DATE,
  avg_quality_score NUMERIC,
  total_receipts BIGINT,
  synthetic_content_rate NUMERIC,
  enhanced_processing_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use provided user_id or current authenticated user
  p_user_id := COALESCE(p_user_id, auth.uid());
  
  RETURN QUERY
  SELECT 
    DATE(eqm.created_at) as date_bucket,
    ROUND(AVG(eqm.overall_quality_score), 2) as avg_quality_score,
    COUNT(*) as total_receipts,
    ROUND(AVG(CASE WHEN eqm.synthetic_content_used THEN 1.0 ELSE 0.0 END), 3) as synthetic_content_rate,
    ROUND(AVG(CASE WHEN eqm.processing_method = 'enhanced' THEN 1.0 ELSE 0.0 END), 3) as enhanced_processing_rate
  FROM embedding_quality_metrics eqm
  JOIN receipts r ON eqm.receipt_id = r.id
  WHERE r.user_id = p_user_id
    AND eqm.created_at >= NOW() - INTERVAL '1 day' * p_days_back
  GROUP BY DATE(eqm.created_at)
  ORDER BY date_bucket DESC;
END;
$$;

-- Add comments for documentation
COMMENT ON TABLE embedding_quality_metrics IS 'Tracks the quality and effectiveness of embedding generation for AI vision processed receipts';
COMMENT ON COLUMN embedding_quality_metrics.overall_quality_score IS 'Overall quality score from 0-100 based on content quality and success rate';
COMMENT ON COLUMN embedding_quality_metrics.synthetic_content_used IS 'Whether synthetic content generation was used due to missing fullText';
COMMENT ON COLUMN embedding_quality_metrics.processing_method IS 'Method used for embedding generation: enhanced, fallback, or legacy';
COMMENT ON COLUMN embedding_quality_metrics.content_quality_scores IS 'Detailed quality scores for each content type processed';

COMMENT ON FUNCTION get_embedding_quality_summary IS 'Provides summary statistics for embedding quality metrics';
COMMENT ON FUNCTION find_low_quality_embeddings IS 'Identifies receipts with low quality embeddings that may need reprocessing';
COMMENT ON FUNCTION track_quality_improvements IS 'Tracks embedding quality improvements over time for monitoring trends';
