-- Phase 2: Core Queue Management Functions
-- Migration: 20250719000002_implement_queue_management_functions.sql

-- ============================================================================
-- CORE QUEUE MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to get next batch of items for processing with priority weighting
CREATE OR REPLACE FUNCTION get_next_embedding_batch(
  worker_id_param TEXT,
  batch_size_param INTEGER DEFAULT 5
) RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_id UUID,
  operation TEXT,
  priority TEXT,
  metadata JSONB,
  estimated_tokens INTEGER
) AS $$
DECLARE
  priority_weights JSONB;
  current_time TIMESTAMPTZ := NOW();
BEGIN
  -- Get priority weights from config
  SELECT config_value INTO priority_weights 
  FROM public.embedding_queue_config 
  WHERE config_key = 'priority_weights';
  
  -- Default weights if not configured
  IF priority_weights IS NULL THEN
    priority_weights := '{"high": 3, "medium": 2, "low": 1}'::JSONB;
  END IF;
  
  -- Update worker heartbeat
  INSERT INTO public.embedding_queue_workers (worker_id, status, last_heartbeat)
  VALUES (worker_id_param, 'active', current_time)
  ON CONFLICT (worker_id) DO UPDATE SET
    status = 'active',
    last_heartbeat = current_time;
  
  -- Get next batch with priority weighting and age factor
  RETURN QUERY
  WITH prioritized_queue AS (
    SELECT 
      q.id,
      q.source_type,
      q.source_id,
      q.operation,
      q.priority,
      q.metadata,
      q.estimated_tokens,
      -- Calculate priority score
      CASE q.priority
        WHEN 'high' THEN (priority_weights->>'high')::INTEGER
        WHEN 'medium' THEN (priority_weights->>'medium')::INTEGER
        WHEN 'low' THEN (priority_weights->>'low')::INTEGER
        ELSE 1
      END as priority_score,
      -- Add age factor (older items get higher priority)
      EXTRACT(EPOCH FROM (current_time - q.created_at)) / 3600 as age_hours
    FROM public.embedding_queue q
    WHERE q.status = 'pending'
      AND (q.rate_limit_delay_ms = 0 OR 
           q.updated_at + (q.rate_limit_delay_ms || ' milliseconds')::INTERVAL < current_time)
    ORDER BY 
      priority_score DESC,
      age_hours DESC,
      q.created_at ASC
    LIMIT batch_size_param
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.embedding_queue 
  SET 
    status = 'processing',
    worker_id = worker_id_param,
    processing_started_at = current_time,
    updated_at = current_time
  FROM prioritized_queue
  WHERE public.embedding_queue.id = prioritized_queue.id
  RETURNING 
    public.embedding_queue.id,
    public.embedding_queue.source_type,
    public.embedding_queue.source_id,
    public.embedding_queue.operation,
    public.embedding_queue.priority,
    public.embedding_queue.metadata,
    public.embedding_queue.estimated_tokens;
END;
$$ LANGUAGE plpgsql;

-- Function to complete queue item processing
CREATE OR REPLACE FUNCTION complete_embedding_queue_item(
  item_id UUID,
  worker_id_param TEXT,
  success BOOLEAN,
  actual_tokens_param INTEGER DEFAULT NULL,
  error_message_param TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  current_time TIMESTAMPTZ := NOW();
  processing_time_ms BIGINT;
  max_retries_config INTEGER;
BEGIN
  -- Get max retries from config
  SELECT (config_value::TEXT)::INTEGER INTO max_retries_config
  FROM public.embedding_queue_config
  WHERE config_key = 'max_retries';
  
  max_retries_config := COALESCE(max_retries_config, 3);
  
  -- Calculate processing time
  SELECT EXTRACT(EPOCH FROM (current_time - processing_started_at)) * 1000
  INTO processing_time_ms
  FROM public.embedding_queue
  WHERE id = item_id;
  
  IF success THEN
    -- Mark as completed
    UPDATE public.embedding_queue
    SET 
      status = 'completed',
      processing_completed_at = current_time,
      actual_tokens = actual_tokens_param,
      updated_at = current_time
    WHERE id = item_id AND worker_id = worker_id_param;
    
    -- Update worker stats
    UPDATE public.embedding_queue_workers
    SET 
      tasks_processed = tasks_processed + 1,
      total_processing_time_ms = total_processing_time_ms + COALESCE(processing_time_ms, 0),
      current_task_id = NULL,
      updated_at = current_time
    WHERE worker_id = worker_id_param;
    
    -- Insert success metrics
    INSERT INTO public.embedding_metrics (
      queue_id, source_type, source_id, operation, success,
      processing_time_ms, tokens_used, api_model
    )
    SELECT 
      item_id, source_type, source_id, operation, true,
      processing_time_ms, actual_tokens_param, 'gemini-1.5-flash'
    FROM public.embedding_queue
    WHERE id = item_id;
    
  ELSE
    -- Handle failure with retry logic
    UPDATE public.embedding_queue
    SET 
      status = CASE 
        WHEN retry_count + 1 >= max_retries_config THEN 'failed'
        ELSE 'pending'
      END,
      retry_count = retry_count + 1,
      error_message = error_message_param,
      worker_id = NULL,
      processing_started_at = NULL,
      updated_at = current_time
    WHERE id = item_id AND worker_id = worker_id_param;
    
    -- Update worker error count
    UPDATE public.embedding_queue_workers
    SET 
      error_count = error_count + 1,
      current_task_id = NULL,
      updated_at = current_time
    WHERE worker_id = worker_id_param;
    
    -- Insert failure metrics
    INSERT INTO public.embedding_metrics (
      queue_id, source_type, source_id, operation, success,
      processing_time_ms, error_type, error_message, api_model
    )
    SELECT 
      item_id, source_type, source_id, operation, false,
      processing_time_ms, 'processing_error', error_message_param, 'gemini-1.5-flash'
    FROM public.embedding_queue
    WHERE id = item_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to handle rate limiting
CREATE OR REPLACE FUNCTION handle_rate_limit(
  item_id UUID,
  worker_id_param TEXT,
  delay_ms INTEGER
) RETURNS VOID AS $$
DECLARE
  current_time TIMESTAMPTZ := NOW();
BEGIN
  -- Mark item as rate limited with delay
  UPDATE public.embedding_queue
  SET 
    status = 'rate_limited',
    rate_limit_delay_ms = delay_ms,
    worker_id = NULL,
    processing_started_at = NULL,
    updated_at = current_time
  WHERE id = item_id AND worker_id = worker_id_param;
  
  -- Update worker rate limit count
  UPDATE public.embedding_queue_workers
  SET 
    rate_limit_count = rate_limit_count + 1,
    current_task_id = NULL,
    updated_at = current_time
  WHERE worker_id = worker_id_param;
  
  -- Insert rate limit metrics
  INSERT INTO public.embedding_metrics (
    queue_id, source_type, source_id, operation, success,
    error_type, error_message, api_model
  )
  SELECT 
    item_id, source_type, source_id, operation, false,
    'rate_limit', 'API rate limit exceeded, delayed for ' || delay_ms || 'ms', 'gemini-1.5-flash'
  FROM public.embedding_queue
  WHERE id = item_id;
END;
$$ LANGUAGE plpgsql;

-- Function to reset rate limited items back to pending after delay
CREATE OR REPLACE FUNCTION reset_rate_limited_items()
RETURNS INTEGER AS $$
DECLARE
  current_time TIMESTAMPTZ := NOW();
  reset_count INTEGER;
BEGIN
  -- Reset rate limited items back to pending after delay
  UPDATE public.embedding_queue
  SET 
    status = 'pending',
    rate_limit_delay_ms = 0,
    updated_at = current_time
  WHERE status = 'rate_limited'
    AND updated_at + (rate_limit_delay_ms || ' milliseconds')::INTERVAL < current_time;
  
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- QUEUE MONITORING AND MAINTENANCE FUNCTIONS
-- ============================================================================

-- Function to get queue statistics
CREATE OR REPLACE FUNCTION get_queue_statistics()
RETURNS TABLE (
  total_pending INTEGER,
  total_processing INTEGER,
  total_completed INTEGER,
  total_failed INTEGER,
  total_rate_limited INTEGER,
  avg_processing_time_ms NUMERIC,
  active_workers INTEGER,
  oldest_pending_age_hours NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending')::INTEGER as total_pending,
    COUNT(*) FILTER (WHERE status = 'processing')::INTEGER as total_processing,
    COUNT(*) FILTER (WHERE status = 'completed')::INTEGER as total_completed,
    COUNT(*) FILTER (WHERE status = 'failed')::INTEGER as total_failed,
    COUNT(*) FILTER (WHERE status = 'rate_limited')::INTEGER as total_rate_limited,
    AVG(EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at)) * 1000) as avg_processing_time_ms,
    (SELECT COUNT(*) FROM public.embedding_queue_workers WHERE status = 'active')::INTEGER as active_workers,
    MAX(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600) FILTER (WHERE status = 'pending') as oldest_pending_age_hours
  FROM public.embedding_queue;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old completed/failed items
CREATE OR REPLACE FUNCTION cleanup_old_queue_items()
RETURNS INTEGER AS $$
DECLARE
  cleanup_hours INTEGER;
  deleted_count INTEGER;
BEGIN
  -- Get cleanup interval from config
  SELECT (config_value::TEXT)::INTEGER INTO cleanup_hours
  FROM public.embedding_queue_config
  WHERE config_key = 'queue_cleanup_interval_hours';

  cleanup_hours := COALESCE(cleanup_hours, 24);

  -- Delete old completed/failed items
  DELETE FROM public.embedding_queue
  WHERE status IN ('completed', 'failed')
    AND processing_completed_at < NOW() - (cleanup_hours || ' hours')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cancel queue items by source
CREATE OR REPLACE FUNCTION cancel_queue_items_by_source(
  source_type_param TEXT,
  source_id_param UUID
)
RETURNS INTEGER AS $$
DECLARE
  cancelled_count INTEGER;
BEGIN
  UPDATE public.embedding_queue
  SET
    status = 'cancelled',
    updated_at = NOW()
  WHERE source_type = source_type_param
    AND source_id = source_id_param
    AND status IN ('pending', 'rate_limited');

  GET DIAGNOSTICS cancelled_count = ROW_COUNT;
  RETURN cancelled_count;
END;
$$ LANGUAGE plpgsql;

-- Function to requeue failed items
CREATE OR REPLACE FUNCTION requeue_failed_items(
  max_items INTEGER DEFAULT 100
)
RETURNS INTEGER AS $$
DECLARE
  requeued_count INTEGER;
BEGIN
  UPDATE public.embedding_queue
  SET
    status = 'pending',
    retry_count = 0,
    error_message = NULL,
    worker_id = NULL,
    processing_started_at = NULL,
    updated_at = NOW()
  WHERE status = 'failed'
    AND id IN (
      SELECT id FROM public.embedding_queue
      WHERE status = 'failed'
      ORDER BY updated_at DESC
      LIMIT max_items
    );

  GET DIAGNOSTICS requeued_count = ROW_COUNT;
  RETURN requeued_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions for all new functions
GRANT EXECUTE ON FUNCTION get_next_embedding_batch TO authenticated;
GRANT EXECUTE ON FUNCTION complete_embedding_queue_item TO authenticated;
GRANT EXECUTE ON FUNCTION handle_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION reset_rate_limited_items TO service_role;
GRANT EXECUTE ON FUNCTION get_queue_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_queue_items TO service_role;
GRANT EXECUTE ON FUNCTION cancel_queue_items_by_source TO authenticated;
GRANT EXECUTE ON FUNCTION requeue_failed_items TO service_role;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION get_next_embedding_batch IS 'Gets the next batch of queue items for a worker to process, with priority weighting and age factor';
COMMENT ON FUNCTION complete_embedding_queue_item IS 'Marks a queue item as completed or failed, updates worker stats and metrics';
COMMENT ON FUNCTION handle_rate_limit IS 'Handles API rate limiting by marking items for delayed retry';
COMMENT ON FUNCTION reset_rate_limited_items IS 'Resets rate-limited items back to pending status after delay period';
COMMENT ON FUNCTION get_queue_statistics IS 'Provides comprehensive statistics about the queue status and performance';
COMMENT ON FUNCTION cleanup_old_queue_items IS 'Removes old completed/failed items to keep the queue table manageable';
COMMENT ON FUNCTION cancel_queue_items_by_source IS 'Cancels pending queue items for a specific source (e.g., when source is deleted)';
COMMENT ON FUNCTION requeue_failed_items IS 'Requeues failed items for retry (useful for recovering from system issues)';
