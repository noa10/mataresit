-- Phase 2: Create Embedding Queue System
-- Migration: 20250719000000_create_embedding_queue_system.sql

-- ============================================================================
-- EMBEDDING QUEUE TABLE
-- ============================================================================

-- Create the main embedding processing queue table
CREATE TABLE IF NOT EXISTS public.embedding_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL, -- 'receipts', 'claims', 'team_members', 'custom_categories', 'malaysian_business_directory'
  source_id UUID NOT NULL,
  operation TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  priority TEXT NOT NULL DEFAULT 'medium', -- 'high', 'medium', 'low'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- INDEXES FOR EFFICIENT QUEUE PROCESSING
-- ============================================================================

-- Primary index for queue processing (status + priority + creation order)
CREATE INDEX IF NOT EXISTS idx_embedding_queue_status_priority
ON public.embedding_queue (status, priority, created_at);

-- Index for source lookups (prevent duplicate queue entries)
CREATE INDEX IF NOT EXISTS idx_embedding_queue_source
ON public.embedding_queue (source_type, source_id);

-- Index for retry logic
CREATE INDEX IF NOT EXISTS idx_embedding_queue_retry
ON public.embedding_queue (retry_count, max_retries)
WHERE status = 'failed';

-- Index for cleanup operations
CREATE INDEX IF NOT EXISTS idx_embedding_queue_processed
ON public.embedding_queue (processed_at)
WHERE status IN ('completed', 'failed');

-- ============================================================================
-- EMBEDDING METRICS TABLE
-- ============================================================================

-- Create metrics table for tracking embedding processing performance
CREATE TABLE IF NOT EXISTS public.embedding_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID REFERENCES public.embedding_queue(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  operation TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  processing_time_ms INTEGER,
  tokens_used INTEGER,
  error_type TEXT,
  error_message TEXT,
  api_model TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for metrics analysis
CREATE INDEX IF NOT EXISTS idx_embedding_metrics_analysis
ON public.embedding_metrics (source_type, created_at, success);

-- Index for performance tracking
CREATE INDEX IF NOT EXISTS idx_embedding_metrics_performance
ON public.embedding_metrics (processing_time_ms, tokens_used, created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE public.embedding_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embedding_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies (admin access only for queue management)
CREATE POLICY embedding_queue_admin_access ON public.embedding_queue
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY embedding_metrics_admin_access ON public.embedding_metrics
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- ============================================================================
-- QUEUE TRIGGER FUNCTION
-- ============================================================================

-- Function to automatically queue embeddings when source records change
CREATE OR REPLACE FUNCTION trigger_embedding_generation()
RETURNS TRIGGER AS $$
DECLARE
  priority_level TEXT := 'medium';
BEGIN
  -- Determine priority based on operation and table
  IF TG_OP = 'INSERT' THEN
    priority_level := 'high';
  ELSIF TG_OP = 'UPDATE' THEN
    priority_level := 'medium';
  ELSIF TG_OP = 'DELETE' THEN
    priority_level := 'low';
  END IF;

  -- Insert into embedding queue for async processing
  INSERT INTO public.embedding_queue (
    source_type,
    source_id,
    operation,
    priority,
    metadata
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    priority_level,
    jsonb_build_object(
      'table_name', TG_TABLE_NAME,
      'operation', TG_OP,
      'timestamp', NOW()
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- BASIC QUEUE MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to get pending queue items (basic version, will be enhanced in next migration)
CREATE OR REPLACE FUNCTION get_pending_queue_items(
  limit_count INTEGER DEFAULT 50,
  priority_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_id UUID,
  operation TEXT,
  priority TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id,
    q.source_type,
    q.source_id,
    q.operation,
    q.priority,
    q.metadata,
    q.created_at
  FROM public.embedding_queue q
  WHERE q.status = 'pending'
    AND q.retry_count < q.max_retries
    AND (priority_filter IS NULL OR q.priority = priority_filter)
  ORDER BY 
    CASE q.priority
      WHEN 'high' THEN 1
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 3
      ELSE 4
    END,
    q.created_at ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update queue item status
CREATE OR REPLACE FUNCTION update_queue_item_status(
  item_id UUID,
  new_status TEXT,
  error_msg TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.embedding_queue
  SET 
    status = new_status,
    error_message = COALESCE(error_msg, error_message),
    updated_at = NOW(),
    processed_at = CASE WHEN new_status IN ('completed', 'failed') THEN NOW() ELSE processed_at END,
    retry_count = CASE WHEN new_status = 'failed' THEN retry_count + 1 ELSE retry_count END
  WHERE id = item_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant necessary permissions for authenticated users and service role
GRANT SELECT, INSERT, UPDATE ON public.embedding_queue TO authenticated;
GRANT SELECT, INSERT ON public.embedding_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_embedding_generation TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_queue_items TO authenticated;
GRANT EXECUTE ON FUNCTION update_queue_item_status TO authenticated;

-- Grant full access to service role for background processing
GRANT ALL ON public.embedding_queue TO service_role;
GRANT ALL ON public.embedding_metrics TO service_role;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.embedding_queue IS 'Queue for managing asynchronous embedding generation tasks';
COMMENT ON TABLE public.embedding_metrics IS 'Metrics and performance tracking for embedding processing';
COMMENT ON FUNCTION trigger_embedding_generation IS 'Trigger function to automatically queue embedding generation when source records change';
COMMENT ON FUNCTION get_pending_queue_items IS 'Retrieves pending queue items for processing, ordered by priority';
COMMENT ON FUNCTION update_queue_item_status IS 'Updates the status of a queue item with optional error message';
