-- Rollback Script for Phase 3: Batch Upload Optimization
-- Migration: 20250720000003_batch_upload_optimization.sql
-- This script safely removes Phase 3 batch upload optimization features

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
    '20250720000003_batch_upload_optimization',
    NOW(),
    'Phase 3 rollback requested',
    current_user
);

-- ============================================================================
-- BACKUP EXISTING DATA (if any)
-- ============================================================================

-- Create backup tables for data preservation
CREATE TABLE IF NOT EXISTS public.batch_upload_sessions_backup AS 
SELECT * FROM public.batch_upload_sessions WHERE 1=0;

CREATE TABLE IF NOT EXISTS public.batch_upload_files_backup AS 
SELECT * FROM public.batch_upload_files WHERE 1=0;

-- Backup existing data
INSERT INTO public.batch_upload_sessions_backup 
SELECT * FROM public.batch_upload_sessions;

INSERT INTO public.batch_upload_files_backup 
SELECT * FROM public.batch_upload_files;

-- Log backup completion
UPDATE public.migration_rollback_log 
SET backup_completed_at = NOW(),
    records_backed_up = (
        SELECT COUNT(*) FROM public.batch_upload_sessions
    ) + (
        SELECT COUNT(*) FROM public.batch_upload_files
    )
WHERE migration_name = '20250720000003_batch_upload_optimization'
AND rollback_completed_at IS NULL;

-- ============================================================================
-- REMOVE PHASE 3 FUNCTIONS
-- ============================================================================

-- Drop batch processing functions
DROP FUNCTION IF EXISTS public.create_batch_upload_session(
    p_user_id UUID,
    p_team_id UUID,
    p_session_name TEXT,
    p_total_files INTEGER,
    p_processing_strategy TEXT,
    p_max_concurrent INTEGER
);

DROP FUNCTION IF EXISTS public.add_file_to_batch_session(
    p_batch_session_id UUID,
    p_receipt_id UUID,
    p_original_filename TEXT,
    p_file_size_bytes INTEGER,
    p_file_type TEXT,
    p_upload_order INTEGER
);

DROP FUNCTION IF EXISTS public.update_batch_session_progress(
    p_batch_session_id UUID,
    p_files_completed INTEGER,
    p_files_failed INTEGER,
    p_files_pending INTEGER
);

DROP FUNCTION IF EXISTS public.get_batch_session_status(p_batch_session_id UUID);

DROP FUNCTION IF EXISTS public.complete_batch_upload_session(p_batch_session_id UUID);

DROP FUNCTION IF EXISTS public.get_user_batch_sessions(
    p_user_id UUID,
    p_team_id UUID,
    p_limit INTEGER,
    p_offset INTEGER
);

-- Drop API quota tracking functions
DROP FUNCTION IF EXISTS public.track_api_quota_usage(
    p_team_id UUID,
    p_api_provider TEXT,
    p_tokens_used INTEGER,
    p_requests_made INTEGER,
    p_cost_usd NUMERIC
);

DROP FUNCTION IF EXISTS public.get_current_api_quota_usage(
    p_team_id UUID,
    p_api_provider TEXT,
    p_time_window INTERVAL
);

DROP FUNCTION IF EXISTS public.check_api_quota_limits(
    p_team_id UUID,
    p_api_provider TEXT,
    p_requested_tokens INTEGER
);

-- ============================================================================
-- REMOVE PHASE 3 TRIGGERS
-- ============================================================================

-- Drop triggers for batch upload sessions
DROP TRIGGER IF EXISTS trigger_update_batch_upload_sessions_updated_at 
ON public.batch_upload_sessions;

DROP TRIGGER IF EXISTS trigger_update_batch_upload_files_updated_at 
ON public.batch_upload_files;

DROP TRIGGER IF EXISTS trigger_update_api_quota_tracking_updated_at 
ON public.api_quota_tracking;

-- ============================================================================
-- REMOVE PHASE 3 INDEXES
-- ============================================================================

-- Drop batch upload session indexes
DROP INDEX IF EXISTS public.idx_batch_upload_sessions_user_team;
DROP INDEX IF EXISTS public.idx_batch_upload_sessions_status_created;
DROP INDEX IF EXISTS public.idx_batch_upload_sessions_team_recent;

-- Drop batch upload files indexes
DROP INDEX IF EXISTS public.idx_batch_upload_files_session_order;
DROP INDEX IF EXISTS public.idx_batch_upload_files_receipt_id;
DROP INDEX IF EXISTS public.idx_batch_upload_files_status_processing;

-- Drop API quota tracking indexes
DROP INDEX IF EXISTS public.idx_api_quota_tracking_team_provider_time;
DROP INDEX IF EXISTS public.idx_api_quota_tracking_provider_recent;
DROP INDEX IF EXISTS public.idx_api_quota_tracking_team_recent;

-- ============================================================================
-- REMOVE PHASE 3 TABLES
-- ============================================================================

-- Remove foreign key constraints first
ALTER TABLE IF EXISTS public.batch_upload_files 
DROP CONSTRAINT IF EXISTS batch_upload_files_batch_session_id_fkey;

ALTER TABLE IF EXISTS public.batch_upload_files 
DROP CONSTRAINT IF EXISTS batch_upload_files_receipt_id_fkey;

ALTER TABLE IF EXISTS public.batch_upload_sessions 
DROP CONSTRAINT IF EXISTS batch_upload_sessions_user_id_fkey;

ALTER TABLE IF EXISTS public.batch_upload_sessions 
DROP CONSTRAINT IF EXISTS batch_upload_sessions_team_id_fkey;

ALTER TABLE IF EXISTS public.api_quota_tracking 
DROP CONSTRAINT IF EXISTS api_quota_tracking_team_id_fkey;

-- Drop tables in correct order (child tables first)
DROP TABLE IF EXISTS public.batch_upload_files;
DROP TABLE IF EXISTS public.batch_upload_sessions;
DROP TABLE IF EXISTS public.api_quota_tracking;

-- ============================================================================
-- REMOVE PHASE 3 RLS POLICIES
-- ============================================================================

-- Note: RLS policies are automatically dropped with the tables

-- ============================================================================
-- REMOVE PHASE 3 COLUMNS FROM EXISTING TABLES
-- ============================================================================

-- Remove batch-related columns from receipts table (if added)
ALTER TABLE public.receipts DROP COLUMN IF EXISTS batch_processing_metadata;
ALTER TABLE public.receipts DROP COLUMN IF EXISTS batch_optimization_flags;

-- Remove batch-related columns from embedding_queue table (if added in Phase 3)
ALTER TABLE public.embedding_queue DROP COLUMN IF EXISTS batch_optimization_priority;
ALTER TABLE public.embedding_queue DROP COLUMN IF EXISTS api_quota_reserved;

-- ============================================================================
-- CLEANUP AND VALIDATION
-- ============================================================================

-- Verify tables are removed
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('batch_upload_sessions', 'batch_upload_files', 'api_quota_tracking');
    
    IF table_count > 0 THEN
        RAISE EXCEPTION 'Phase 3 tables still exist after rollback';
    END IF;
END $$;

-- Update rollback log
UPDATE public.migration_rollback_log 
SET rollback_completed_at = NOW(),
    rollback_status = 'completed',
    rollback_notes = 'Phase 3 batch upload optimization features successfully removed'
WHERE migration_name = '20250720000003_batch_upload_optimization'
AND rollback_completed_at IS NULL;

-- ============================================================================
-- ROLLBACK COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Phase 3 rollback completed successfully';
    RAISE NOTICE 'Batch upload optimization features have been removed';
    RAISE NOTICE 'Data has been backed up to *_backup tables';
    RAISE NOTICE 'System is now at Phase 2 state';
END $$;
