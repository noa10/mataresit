-- Phase 2: Enhance Embedding Queue System with Advanced Features
-- Migration: 20250719000001_enhance_embedding_queue_phase2.sql

-- ============================================================================
-- ENHANCE EXISTING EMBEDDING_QUEUE TABLE
-- ============================================================================

-- Add Phase 2 specific columns to the embedding_queue table
ALTER TABLE public.embedding_queue ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE public.embedding_queue ADD COLUMN IF NOT EXISTS worker_id TEXT;
ALTER TABLE public.embedding_queue ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;
ALTER TABLE public.embedding_queue ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ;
ALTER TABLE public.embedding_queue ADD COLUMN IF NOT EXISTS estimated_tokens INTEGER;
ALTER TABLE public.embedding_queue ADD COLUMN IF NOT EXISTS actual_tokens INTEGER;
ALTER TABLE public.embedding_queue ADD COLUMN IF NOT EXISTS rate_limit_delay_ms INTEGER DEFAULT 0;

-- Add new status values for Phase 2 (rate_limited, cancelled)
ALTER TABLE public.embedding_queue DROP CONSTRAINT IF EXISTS embedding_queue_status_check;
ALTER TABLE public.embedding_queue ADD CONSTRAINT embedding_queue_status_check 
CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'rate_limited', 'cancelled'));

-- ============================================================================
-- ENHANCED INDEXES FOR PHASE 2 FEATURES
-- ============================================================================

-- Enhanced index for priority-based queue processing with age factor
CREATE INDEX IF NOT EXISTS idx_embedding_queue_priority_status 
ON public.embedding_queue(priority, status, created_at);

-- Index for worker-specific processing tracking
CREATE INDEX IF NOT EXISTS idx_embedding_queue_worker_processing 
ON public.embedding_queue(worker_id, processing_started_at) 
WHERE status = 'processing';

-- Index for batch processing
CREATE INDEX IF NOT EXISTS idx_embedding_queue_batch_id 
ON public.embedding_queue(batch_id) 
WHERE batch_id IS NOT NULL;

-- Index for rate limiting management
CREATE INDEX IF NOT EXISTS idx_embedding_queue_rate_limited 
ON public.embedding_queue(status, rate_limit_delay_ms) 
WHERE status = 'rate_limited';

-- Index for performance analysis
CREATE INDEX IF NOT EXISTS idx_embedding_queue_performance 
ON public.embedding_queue(processing_started_at, processing_completed_at, actual_tokens)
WHERE status = 'completed';

-- Index for cleanup operations (completed/failed items older than X days)
CREATE INDEX IF NOT EXISTS idx_embedding_queue_cleanup 
ON public.embedding_queue(status, processing_completed_at)
WHERE status IN ('completed', 'failed');

-- ============================================================================
-- QUEUE WORKER MANAGEMENT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.embedding_queue_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'idle', 'stopped', 'error')),
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  current_task_id UUID REFERENCES public.embedding_queue(id),
  tasks_processed INTEGER DEFAULT 0,
  total_processing_time_ms BIGINT DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  rate_limit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Worker management indexes
CREATE INDEX IF NOT EXISTS idx_embedding_workers_status 
ON public.embedding_queue_workers(status, last_heartbeat);

CREATE INDEX IF NOT EXISTS idx_embedding_workers_active 
ON public.embedding_queue_workers(worker_id) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_embedding_workers_performance
ON public.embedding_queue_workers(tasks_processed, total_processing_time_ms, error_count);

-- ============================================================================
-- QUEUE CONFIGURATION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.embedding_queue_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuration index
CREATE INDEX IF NOT EXISTS idx_embedding_queue_config_key 
ON public.embedding_queue_config(config_key);

-- Insert default configuration values
INSERT INTO public.embedding_queue_config (config_key, config_value, description) VALUES
('max_concurrent_workers', '3', 'Maximum number of concurrent embedding workers'),
('batch_size', '5', 'Number of items to process in each batch'),
('rate_limit_delay_ms', '1000', 'Delay between API calls to avoid rate limiting'),
('max_retries', '3', 'Maximum retry attempts for failed items'),
('worker_heartbeat_interval_ms', '30000', 'Worker heartbeat interval'),
('queue_cleanup_interval_hours', '24', 'Interval for cleaning up old completed items'),
('priority_weights', '{"high": 3, "medium": 2, "low": 1}', 'Priority weights for queue processing'),
('api_quota_per_minute', '60', 'API calls allowed per minute'),
('token_quota_per_minute', '100000', 'Tokens allowed per minute'),
('queue_enabled', 'true', 'Enable/disable queue-based processing'),
('worker_timeout_minutes', '10', 'Worker timeout for stuck tasks'),
('batch_timeout_minutes', '30', 'Batch processing timeout')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================================================
-- ROW LEVEL SECURITY FOR NEW TABLES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.embedding_queue_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embedding_queue_config ENABLE ROW LEVEL SECURITY;

-- RLS policies for worker management (admin access only)
CREATE POLICY embedding_workers_admin_access ON public.embedding_queue_workers
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- RLS policies for configuration (admin access only)
CREATE POLICY embedding_config_admin_access ON public.embedding_queue_config
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- ============================================================================
-- ENHANCED QUEUE MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to get queue configuration value
CREATE OR REPLACE FUNCTION get_queue_config(config_key_param TEXT)
RETURNS JSONB AS $$
DECLARE
  config_value JSONB;
BEGIN
  SELECT config_value INTO config_value
  FROM public.embedding_queue_config
  WHERE config_key = config_key_param;
  
  RETURN COALESCE(config_value, 'null'::JSONB);
END;
$$ LANGUAGE plpgsql;

-- Function to update queue configuration
CREATE OR REPLACE FUNCTION update_queue_config(
  config_key_param TEXT,
  config_value_param JSONB,
  updated_by_param UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.embedding_queue_config (config_key, config_value, updated_by, updated_at)
  VALUES (config_key_param, config_value_param, updated_by_param, NOW())
  ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    updated_by = EXCLUDED.updated_by,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to register/update worker heartbeat
CREATE OR REPLACE FUNCTION update_worker_heartbeat(
  worker_id_param TEXT,
  worker_status TEXT DEFAULT 'active'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.embedding_queue_workers (worker_id, status, last_heartbeat, updated_at)
  VALUES (worker_id_param, worker_status, NOW(), NOW())
  ON CONFLICT (worker_id) DO UPDATE SET
    status = EXCLUDED.status,
    last_heartbeat = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup stale workers
CREATE OR REPLACE FUNCTION cleanup_stale_workers()
RETURNS INTEGER AS $$
DECLARE
  timeout_minutes INTEGER;
  cleaned_count INTEGER;
BEGIN
  -- Get worker timeout from config
  SELECT (config_value::TEXT)::INTEGER INTO timeout_minutes
  FROM public.embedding_queue_config
  WHERE config_key = 'worker_timeout_minutes';
  
  timeout_minutes := COALESCE(timeout_minutes, 10);
  
  -- Mark stale workers as stopped and reset their tasks
  UPDATE public.embedding_queue_workers
  SET status = 'stopped', updated_at = NOW()
  WHERE status IN ('active', 'idle')
    AND last_heartbeat < NOW() - (timeout_minutes || ' minutes')::INTERVAL;
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  -- Reset tasks assigned to stale workers
  UPDATE public.embedding_queue
  SET 
    status = 'pending',
    worker_id = NULL,
    processing_started_at = NULL,
    updated_at = NOW()
  WHERE status = 'processing'
    AND worker_id NOT IN (
      SELECT worker_id FROM public.embedding_queue_workers 
      WHERE status = 'active'
    );
  
  RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANT PERMISSIONS FOR NEW TABLES AND FUNCTIONS
-- ============================================================================

-- Grant permissions for new tables
GRANT SELECT, INSERT, UPDATE ON public.embedding_queue_workers TO authenticated;
GRANT SELECT ON public.embedding_queue_config TO authenticated;
GRANT INSERT, UPDATE ON public.embedding_queue_config TO service_role;

-- Grant full access to service role
GRANT ALL ON public.embedding_queue_workers TO service_role;
GRANT ALL ON public.embedding_queue_config TO service_role;

-- Grant execute permissions for new functions
GRANT EXECUTE ON FUNCTION get_queue_config TO authenticated;
GRANT EXECUTE ON FUNCTION update_queue_config TO service_role;
GRANT EXECUTE ON FUNCTION update_worker_heartbeat TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_stale_workers TO service_role;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.embedding_queue_workers IS 'Tracks embedding worker processes, their status, and performance metrics';
COMMENT ON TABLE public.embedding_queue_config IS 'Configuration settings for the embedding queue system';
COMMENT ON FUNCTION get_queue_config IS 'Retrieves a configuration value by key';
COMMENT ON FUNCTION update_queue_config IS 'Updates or inserts a configuration value';
COMMENT ON FUNCTION update_worker_heartbeat IS 'Updates worker heartbeat and status';
COMMENT ON FUNCTION cleanup_stale_workers IS 'Cleans up stale workers and resets their assigned tasks';
