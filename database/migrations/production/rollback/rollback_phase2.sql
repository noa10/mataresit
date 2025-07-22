-- Rollback Script for Phase 2: Queue System Enhancements
-- Migration: 20250719000001_enhance_embedding_queue_phase2.sql
-- This script safely removes Phase 2 queue enhancements

-- ============================================================================
-- SAFETY CHECKS
-- ============================================================================

-- Check if we're in the correct database
DO $$
BEGIN
    IF current_database() != 'postgres' THEN
        RAISE EXCEPTION 'This rollback script must be run on the postgres database';
    END IF;
END $$;

-- Create rollback log entry
INSERT INTO public.migration_rollback_log (
    migration_name,
    rollback_started_at,
    rollback_reason,
    rollback_initiated_by
) VALUES (
    '20250719000001_enhance_embedding_queue_phase2',
    NOW(),
    'Phase 2 rollback requested',
    current_user
);

-- ============================================================================
-- BACKUP EXISTING DATA
-- ============================================================================

-- Create backup table for queue data
CREATE TABLE IF NOT EXISTS public.embedding_queue_phase2_backup AS 
SELECT * FROM public.embedding_queue WHERE 1=0;

-- Backup current queue data
INSERT INTO public.embedding_queue_phase2_backup 
SELECT * FROM public.embedding_queue;

-- Log backup completion
UPDATE public.migration_rollback_log 
SET backup_completed_at = NOW(),
    records_backed_up = (SELECT COUNT(*) FROM public.embedding_queue)
WHERE migration_name = '20250719000001_enhance_embedding_queue_phase2'
AND rollback_completed_at IS NULL;

-- ============================================================================
-- REMOVE PHASE 2 FUNCTIONS
-- ============================================================================

-- Drop queue management functions
DROP FUNCTION IF EXISTS public.get_next_queue_item_with_priority(
    p_worker_id TEXT,
    p_max_items INTEGER
);

DROP FUNCTION IF EXISTS public.update_queue_item_status(
    p_queue_id UUID,
    p_status TEXT,
    p_worker_id TEXT,
    p_error_message TEXT,
    p_processing_time_ms INTEGER,
    p_actual_tokens INTEGER
);

DROP FUNCTION IF EXISTS public.get_queue_statistics();

DROP FUNCTION IF EXISTS public.cleanup_stale_queue_items(p_timeout_minutes INTEGER);

DROP FUNCTION IF EXISTS public.requeue_failed_items(
    p_max_retry_count INTEGER,
    p_delay_minutes INTEGER
);

DROP FUNCTION IF EXISTS public.get_worker_performance_stats(
    p_worker_id TEXT,
    p_hours_back INTEGER
);

DROP FUNCTION IF EXISTS public.optimize_queue_priorities();

-- Drop rate limiting functions
DROP FUNCTION IF EXISTS public.check_rate_limits(
    p_api_provider TEXT,
    p_requested_tokens INTEGER
);

DROP FUNCTION IF EXISTS public.update_rate_limit_status(
    p_queue_id UUID,
    p_delay_ms INTEGER
);

-- ============================================================================
-- REMOVE PHASE 2 TRIGGERS
-- ============================================================================

-- Drop queue update triggers
DROP TRIGGER IF EXISTS trigger_update_embedding_queue_updated_at 
ON public.embedding_queue;

DROP TRIGGER IF EXISTS trigger_queue_priority_optimization 
ON public.embedding_queue;

-- ============================================================================
-- REMOVE PHASE 2 INDEXES
-- ============================================================================

-- Drop Phase 2 specific indexes
DROP INDEX IF EXISTS public.idx_embedding_queue_priority_status;
DROP INDEX IF EXISTS public.idx_embedding_queue_worker_processing;
DROP INDEX IF EXISTS public.idx_embedding_queue_batch_id;
DROP INDEX IF EXISTS public.idx_embedding_queue_rate_limited;
DROP INDEX IF EXISTS public.idx_embedding_queue_performance;

-- ============================================================================
-- REVERT EMBEDDING_QUEUE TABLE CHANGES
-- ============================================================================

-- Remove Phase 2 columns from embedding_queue table
ALTER TABLE public.embedding_queue DROP COLUMN IF EXISTS batch_id;
ALTER TABLE public.embedding_queue DROP COLUMN IF EXISTS worker_id;
ALTER TABLE public.embedding_queue DROP COLUMN IF EXISTS processing_started_at;
ALTER TABLE public.embedding_queue DROP COLUMN IF EXISTS processing_completed_at;
ALTER TABLE public.embedding_queue DROP COLUMN IF EXISTS estimated_tokens;
ALTER TABLE public.embedding_queue DROP COLUMN IF EXISTS actual_tokens;
ALTER TABLE public.embedding_queue DROP COLUMN IF EXISTS rate_limit_delay_ms;

-- Revert status constraint to Phase 1 values
ALTER TABLE public.embedding_queue DROP CONSTRAINT IF EXISTS embedding_queue_status_check;
ALTER TABLE public.embedding_queue ADD CONSTRAINT embedding_queue_status_check 
CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

-- ============================================================================
-- REMOVE PHASE 2 CONFIGURATION TABLES
-- ============================================================================

-- Remove foreign key constraints first
ALTER TABLE IF EXISTS public.embedding_queue_config 
DROP CONSTRAINT IF EXISTS embedding_queue_config_team_id_fkey;

-- Drop configuration table
DROP TABLE IF EXISTS public.embedding_queue_config;

-- ============================================================================
-- REMOVE PHASE 2 WORKER TABLES
-- ============================================================================

-- Remove foreign key constraints
ALTER TABLE IF EXISTS public.embedding_queue_workers 
DROP CONSTRAINT IF EXISTS embedding_queue_workers_team_id_fkey;

-- Drop worker tracking table
DROP TABLE IF EXISTS public.embedding_queue_workers;

-- ============================================================================
-- RESTORE PHASE 1 INDEXES
-- ============================================================================

-- Recreate original Phase 1 indexes
CREATE INDEX IF NOT EXISTS idx_embedding_queue_status_priority 
ON public.embedding_queue(status, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_embedding_queue_source_type 
ON public.embedding_queue(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_embedding_queue_created_at 
ON public.embedding_queue(created_at);

-- ============================================================================
-- RESTORE PHASE 1 FUNCTIONS
-- ============================================================================

-- Recreate basic queue functions (Phase 1 versions)
CREATE OR REPLACE FUNCTION public.get_next_queue_item()
RETURNS TABLE (
    id UUID,
    source_type TEXT,
    source_id UUID,
    operation TEXT,
    priority TEXT,
    metadata JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.id,
        q.source_type,
        q.source_id,
        q.operation,
        q.priority,
        q.metadata
    FROM public.embedding_queue q
    WHERE q.status = 'pending'
    ORDER BY 
        CASE q.priority 
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
            ELSE 4
        END,
        q.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_queue_status(
    p_queue_id UUID,
    p_status TEXT,
    p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.embedding_queue 
    SET 
        status = p_status,
        error_message = p_error_message,
        updated_at = NOW(),
        processed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE processed_at END
    WHERE id = p_queue_id;
    
    RETURN FOUND;
END;
$$;

-- ============================================================================
-- CLEANUP AND VALIDATION
-- ============================================================================

-- Verify Phase 2 tables are removed
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('embedding_queue_workers', 'embedding_queue_config');
    
    IF table_count > 0 THEN
        RAISE EXCEPTION 'Phase 2 tables still exist after rollback';
    END IF;
END $$;

-- Verify Phase 2 columns are removed
DO $$
DECLARE
    column_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'embedding_queue'
    AND column_name IN ('batch_id', 'worker_id', 'processing_started_at', 'processing_completed_at', 'estimated_tokens', 'actual_tokens', 'rate_limit_delay_ms');
    
    IF column_count > 0 THEN
        RAISE EXCEPTION 'Phase 2 columns still exist after rollback';
    END IF;
END $$;

-- Update rollback log
UPDATE public.migration_rollback_log 
SET rollback_completed_at = NOW(),
    rollback_status = 'completed',
    rollback_notes = 'Phase 2 queue enhancements successfully removed, restored to Phase 1 state'
WHERE migration_name = '20250719000001_enhance_embedding_queue_phase2'
AND rollback_completed_at IS NULL;

-- ============================================================================
-- ROLLBACK COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Phase 2 rollback completed successfully';
    RAISE NOTICE 'Queue system enhancements have been removed';
    RAISE NOTICE 'System restored to Phase 1 basic queue functionality';
    RAISE NOTICE 'Data has been backed up to embedding_queue_phase2_backup table';
END $$;
