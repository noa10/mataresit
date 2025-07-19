# Phase 1: Embedding Success Rate Monitoring Dashboard

## Database Schema Changes

### 1.1 New Tables

```sql
-- Migration: 20250717000001_create_embedding_metrics_tables.sql

-- Embedding performance metrics table
CREATE TABLE IF NOT EXISTS public.embedding_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES public.receipts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  
  -- Processing context
  upload_context TEXT NOT NULL CHECK (upload_context IN ('single', 'batch')),
  model_used TEXT NOT NULL,
  
  -- Timing metrics
  embedding_start_time TIMESTAMPTZ NOT NULL,
  embedding_end_time TIMESTAMPTZ,
  total_duration_ms INTEGER,
  
  -- Success/failure tracking
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'success', 'failed', 'timeout')),
  retry_count INTEGER DEFAULT 0,
  error_type TEXT, -- 'api_limit', 'network', 'validation', 'timeout', 'unknown'
  error_message TEXT,
  
  -- Content metrics
  content_types_processed TEXT[], -- ['merchant', 'full_text', 'items_description']
  total_content_types INTEGER DEFAULT 0,
  successful_content_types INTEGER DEFAULT 0,
  failed_content_types INTEGER DEFAULT 0,
  
  -- API metrics
  api_calls_made INTEGER DEFAULT 0,
  api_tokens_used INTEGER DEFAULT 0,
  api_rate_limited BOOLEAN DEFAULT FALSE,
  
  -- Quality metrics
  embedding_dimensions INTEGER,
  content_length INTEGER,
  synthetic_content_used BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hourly aggregated metrics for dashboard performance
CREATE TABLE IF NOT EXISTS public.embedding_hourly_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hour_bucket TIMESTAMPTZ NOT NULL, -- Truncated to hour
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  
  -- Volume metrics
  total_attempts INTEGER DEFAULT 0,
  successful_attempts INTEGER DEFAULT 0,
  failed_attempts INTEGER DEFAULT 0,
  timeout_attempts INTEGER DEFAULT 0,
  
  -- Context breakdown
  single_upload_attempts INTEGER DEFAULT 0,
  batch_upload_attempts INTEGER DEFAULT 0,
  single_upload_success INTEGER DEFAULT 0,
  batch_upload_success INTEGER DEFAULT 0,
  
  -- Performance metrics
  avg_duration_ms NUMERIC(10,2),
  p95_duration_ms NUMERIC(10,2),
  total_api_calls INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  rate_limited_count INTEGER DEFAULT 0,
  
  -- Error breakdown
  api_limit_errors INTEGER DEFAULT 0,
  network_errors INTEGER DEFAULT 0,
  validation_errors INTEGER DEFAULT 0,
  timeout_errors INTEGER DEFAULT 0,
  unknown_errors INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(hour_bucket, team_id)
);

-- Daily aggregated metrics for trend analysis
CREATE TABLE IF NOT EXISTS public.embedding_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_bucket DATE NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  
  -- Volume metrics
  total_attempts INTEGER DEFAULT 0,
  successful_attempts INTEGER DEFAULT 0,
  failed_attempts INTEGER DEFAULT 0,
  success_rate NUMERIC(5,2), -- Percentage
  
  -- Performance metrics
  avg_duration_ms NUMERIC(10,2),
  p95_duration_ms NUMERIC(10,2),
  p99_duration_ms NUMERIC(10,2),
  
  -- Cost metrics
  total_api_calls INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  estimated_cost_usd NUMERIC(10,4),
  
  -- Quality metrics
  synthetic_content_percentage NUMERIC(5,2),
  avg_content_types_per_receipt NUMERIC(3,1),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(date_bucket, team_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_embedding_metrics_receipt_id ON public.embedding_performance_metrics(receipt_id);
CREATE INDEX IF NOT EXISTS idx_embedding_metrics_user_team ON public.embedding_performance_metrics(user_id, team_id);
CREATE INDEX IF NOT EXISTS idx_embedding_metrics_status_time ON public.embedding_performance_metrics(status, created_at);
CREATE INDEX IF NOT EXISTS idx_embedding_metrics_upload_context ON public.embedding_performance_metrics(upload_context, created_at);

CREATE INDEX IF NOT EXISTS idx_embedding_hourly_stats_time_team ON public.embedding_hourly_stats(hour_bucket, team_id);
CREATE INDEX IF NOT EXISTS idx_embedding_daily_stats_date_team ON public.embedding_daily_stats(date_bucket, team_id);

-- Enable RLS
ALTER TABLE public.embedding_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embedding_hourly_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embedding_daily_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY embedding_metrics_team_access ON public.embedding_performance_metrics
FOR ALL USING (
  team_id IN (
    SELECT team_id FROM public.team_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY embedding_hourly_stats_team_access ON public.embedding_hourly_stats
FOR ALL USING (
  team_id IN (
    SELECT team_id FROM public.team_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY embedding_daily_stats_team_access ON public.embedding_daily_stats
FOR ALL USING (
  team_id IN (
    SELECT team_id FROM public.team_members 
    WHERE user_id = auth.uid()
  )
);
```

### 1.2 Database Functions

```sql
-- Function to aggregate hourly stats
CREATE OR REPLACE FUNCTION aggregate_embedding_hourly_stats()
RETURNS VOID AS $$
DECLARE
  current_hour TIMESTAMPTZ;
BEGIN
  -- Get the current hour bucket
  current_hour := date_trunc('hour', NOW() - INTERVAL '1 hour');
  
  -- Aggregate metrics for the previous hour
  INSERT INTO public.embedding_hourly_stats (
    hour_bucket,
    team_id,
    total_attempts,
    successful_attempts,
    failed_attempts,
    timeout_attempts,
    single_upload_attempts,
    batch_upload_attempts,
    single_upload_success,
    batch_upload_success,
    avg_duration_ms,
    p95_duration_ms,
    total_api_calls,
    total_tokens_used,
    rate_limited_count,
    api_limit_errors,
    network_errors,
    validation_errors,
    timeout_errors,
    unknown_errors
  )
  SELECT 
    current_hour,
    team_id,
    COUNT(*) as total_attempts,
    COUNT(*) FILTER (WHERE status = 'success') as successful_attempts,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_attempts,
    COUNT(*) FILTER (WHERE status = 'timeout') as timeout_attempts,
    COUNT(*) FILTER (WHERE upload_context = 'single') as single_upload_attempts,
    COUNT(*) FILTER (WHERE upload_context = 'batch') as batch_upload_attempts,
    COUNT(*) FILTER (WHERE upload_context = 'single' AND status = 'success') as single_upload_success,
    COUNT(*) FILTER (WHERE upload_context = 'batch' AND status = 'success') as batch_upload_success,
    AVG(total_duration_ms) as avg_duration_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_duration_ms) as p95_duration_ms,
    SUM(api_calls_made) as total_api_calls,
    SUM(api_tokens_used) as total_tokens_used,
    COUNT(*) FILTER (WHERE api_rate_limited = TRUE) as rate_limited_count,
    COUNT(*) FILTER (WHERE error_type = 'api_limit') as api_limit_errors,
    COUNT(*) FILTER (WHERE error_type = 'network') as network_errors,
    COUNT(*) FILTER (WHERE error_type = 'validation') as validation_errors,
    COUNT(*) FILTER (WHERE error_type = 'timeout') as timeout_errors,
    COUNT(*) FILTER (WHERE error_type = 'unknown') as unknown_errors
  FROM public.embedding_performance_metrics
  WHERE created_at >= current_hour 
    AND created_at < current_hour + INTERVAL '1 hour'
  GROUP BY team_id
  ON CONFLICT (hour_bucket, team_id) DO UPDATE SET
    total_attempts = EXCLUDED.total_attempts,
    successful_attempts = EXCLUDED.successful_attempts,
    failed_attempts = EXCLUDED.failed_attempts,
    timeout_attempts = EXCLUDED.timeout_attempts,
    single_upload_attempts = EXCLUDED.single_upload_attempts,
    batch_upload_attempts = EXCLUDED.batch_upload_attempts,
    single_upload_success = EXCLUDED.single_upload_success,
    batch_upload_success = EXCLUDED.batch_upload_success,
    avg_duration_ms = EXCLUDED.avg_duration_ms,
    p95_duration_ms = EXCLUDED.p95_duration_ms,
    total_api_calls = EXCLUDED.total_api_calls,
    total_tokens_used = EXCLUDED.total_tokens_used,
    rate_limited_count = EXCLUDED.rate_limited_count,
    api_limit_errors = EXCLUDED.api_limit_errors,
    network_errors = EXCLUDED.network_errors,
    validation_errors = EXCLUDED.validation_errors,
    timeout_errors = EXCLUDED.timeout_errors,
    unknown_errors = EXCLUDED.unknown_errors;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate daily stats
CREATE OR REPLACE FUNCTION aggregate_embedding_daily_stats()
RETURNS VOID AS $$
DECLARE
  current_date DATE;
BEGIN
  current_date := (NOW() - INTERVAL '1 day')::DATE;
  
  INSERT INTO public.embedding_daily_stats (
    date_bucket,
    team_id,
    total_attempts,
    successful_attempts,
    failed_attempts,
    success_rate,
    avg_duration_ms,
    p95_duration_ms,
    p99_duration_ms,
    total_api_calls,
    total_tokens_used,
    estimated_cost_usd,
    synthetic_content_percentage,
    avg_content_types_per_receipt
  )
  SELECT 
    current_date,
    team_id,
    COUNT(*) as total_attempts,
    COUNT(*) FILTER (WHERE status = 'success') as successful_attempts,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_attempts,
    ROUND(
      (COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / COUNT(*)) * 100, 
      2
    ) as success_rate,
    AVG(total_duration_ms) as avg_duration_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_duration_ms) as p95_duration_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY total_duration_ms) as p99_duration_ms,
    SUM(api_calls_made) as total_api_calls,
    SUM(api_tokens_used) as total_tokens_used,
    -- Estimate cost based on Gemini pricing: $0.00015 per 1K tokens
    ROUND((SUM(api_tokens_used) / 1000.0) * 0.00015, 4) as estimated_cost_usd,
    ROUND(
      (COUNT(*) FILTER (WHERE synthetic_content_used = TRUE)::NUMERIC / COUNT(*)) * 100,
      2
    ) as synthetic_content_percentage,
    AVG(total_content_types) as avg_content_types_per_receipt
  FROM public.embedding_performance_metrics
  WHERE created_at::DATE = current_date
  GROUP BY team_id
  ON CONFLICT (date_bucket, team_id) DO UPDATE SET
    total_attempts = EXCLUDED.total_attempts,
    successful_attempts = EXCLUDED.successful_attempts,
    failed_attempts = EXCLUDED.failed_attempts,
    success_rate = EXCLUDED.success_rate,
    avg_duration_ms = EXCLUDED.avg_duration_ms,
    p95_duration_ms = EXCLUDED.p95_duration_ms,
    p99_duration_ms = EXCLUDED.p99_duration_ms,
    total_api_calls = EXCLUDED.total_api_calls,
    total_tokens_used = EXCLUDED.total_tokens_used,
    estimated_cost_usd = EXCLUDED.estimated_cost_usd,
    synthetic_content_percentage = EXCLUDED.synthetic_content_percentage,
    avg_content_types_per_receipt = EXCLUDED.avg_content_types_per_receipt;
END;
$$ LANGUAGE plpgsql;
```

## Implementation Steps

### Priority 1: Core Infrastructure (Week 1-2)

1. **Database Migration**
   - Create migration file with new tables and functions
   - Deploy to development environment
   - Validate schema and indexes

2. **Metrics Collection Integration**
   - Modify `generate-embeddings` function to collect metrics
   - Update `triggerPostProcessing` to track timing
   - Add error classification logic

3. **Aggregation Scheduler**
   - Create cron job for hourly aggregation
   - Create cron job for daily aggregation
   - Set up monitoring for aggregation jobs

### Priority 2: Dashboard Backend (Week 2-3)

1. **API Endpoints**
   - Create metrics API endpoints
   - Implement real-time metrics queries
   - Add caching layer for dashboard performance

2. **Data Processing**
   - Implement trend calculation algorithms
   - Create alert threshold logic
   - Add data export functionality

### Priority 3: Frontend Dashboard (Week 3-4)

1. **Dashboard Components**
   - Success rate overview cards
   - Time-series charts for trends
   - Error breakdown visualizations
   - Performance metrics displays

2. **Interactive Features**
   - Date range selection
   - Team filtering
   - Drill-down capabilities
   - Export functionality

## Code Changes Required

### 1. Supabase Function Updates

File: `supabase/functions/generate-embeddings/index.ts`
- Add metrics collection at start/end of processing
- Track content types processed
- Record API usage statistics
- Classify and record errors

### 2. Process Receipt Function Updates

File: `supabase/functions/process-receipt/index.ts`
- Add timing metrics to `triggerPostProcessing`
- Record upload context (single vs batch)
- Track retry attempts and outcomes

### 3. Frontend Dashboard Components

New files to create:
- `src/components/dashboard/EmbeddingMetricsDashboard.tsx`
- `src/components/dashboard/SuccessRateChart.tsx`
- `src/components/dashboard/ErrorBreakdownChart.tsx`
- `src/components/dashboard/PerformanceMetrics.tsx`
- `src/hooks/useEmbeddingMetrics.ts`

## Testing Strategy

### Unit Tests
- Test metrics collection functions
- Validate aggregation calculations
- Test error classification logic

### Integration Tests
- End-to-end embedding workflow with metrics
- Dashboard data accuracy validation
- Performance impact measurement

### Load Tests
- High-volume embedding processing
- Dashboard performance under load
- Database query optimization validation

## Rollback Plan

1. **Database Rollback**
   - Drop new tables if issues occur
   - Revert function changes
   - Remove indexes

2. **Code Rollback**
   - Feature flags to disable metrics collection
   - Revert to previous function versions
   - Remove dashboard routes

3. **Monitoring**
   - Track performance impact
   - Monitor error rates
   - Validate data accuracy

## Performance Impact Analysis

### Expected Impact
- **Database**: +5-10% storage for metrics tables
- **API**: +2-5ms per embedding generation for metrics collection
- **Dashboard**: New queries, cached for performance

### Mitigation Strategies
- Efficient indexing strategy
- Asynchronous metrics collection
- Aggressive caching for dashboard queries
- Automated cleanup of old metrics data

## Timeline Estimate

- **Week 1**: Database schema and core infrastructure
- **Week 2**: Metrics collection integration and backend APIs
- **Week 3**: Frontend dashboard development
- **Week 4**: Testing, optimization, and deployment preparation

**Total Duration**: 4 weeks
**Team Size**: 2-3 developers
**Dependencies**: Database access, frontend framework familiarity
