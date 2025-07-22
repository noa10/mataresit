-- Rollback Script for Phase 1: Embedding Metrics Tables
-- Migration: 20250717000001_create_embedding_metrics_tables.sql
-- This script safely removes Phase 1 monitoring infrastructure

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

-- Create rollback log table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.migration_rollback_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_name TEXT NOT NULL,
    rollback_started_at TIMESTAMPTZ NOT NULL,
    rollback_completed_at TIMESTAMPTZ,
    rollback_reason TEXT,
    rollback_initiated_by TEXT,
    rollback_status TEXT DEFAULT 'in_progress',
    backup_completed_at TIMESTAMPTZ,
    records_backed_up INTEGER DEFAULT 0,
    rollback_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create rollback log entry
INSERT INTO public.migration_rollback_log (
    migration_name,
    rollback_started_at,
    rollback_reason,
    rollback_initiated_by
) VALUES (
    '20250717000001_create_embedding_metrics_tables',
    NOW(),
    'Phase 1 rollback requested',
    current_user
);

-- ============================================================================
-- BACKUP EXISTING DATA
-- ============================================================================

-- Create backup tables for data preservation
CREATE TABLE IF NOT EXISTS public.embedding_performance_metrics_backup AS 
SELECT * FROM public.embedding_performance_metrics WHERE 1=0;

CREATE TABLE IF NOT EXISTS public.embedding_hourly_stats_backup AS 
SELECT * FROM public.embedding_hourly_stats WHERE 1=0;

CREATE TABLE IF NOT EXISTS public.embedding_daily_stats_backup AS 
SELECT * FROM public.embedding_daily_stats WHERE 1=0;

-- Backup existing data
INSERT INTO public.embedding_performance_metrics_backup 
SELECT * FROM public.embedding_performance_metrics;

INSERT INTO public.embedding_hourly_stats_backup 
SELECT * FROM public.embedding_hourly_stats;

INSERT INTO public.embedding_daily_stats_backup 
SELECT * FROM public.embedding_daily_stats;

-- Log backup completion
UPDATE public.migration_rollback_log 
SET backup_completed_at = NOW(),
    records_backed_up = (
        SELECT COUNT(*) FROM public.embedding_performance_metrics
    ) + (
        SELECT COUNT(*) FROM public.embedding_hourly_stats
    ) + (
        SELECT COUNT(*) FROM public.embedding_daily_stats
    )
WHERE migration_name = '20250717000001_create_embedding_metrics_tables'
AND rollback_completed_at IS NULL;

-- ============================================================================
-- REMOVE PHASE 1 FUNCTIONS
-- ============================================================================

-- Drop metrics collection functions
DROP FUNCTION IF EXISTS public.record_embedding_performance(
    p_receipt_id UUID,
    p_user_id UUID,
    p_team_id UUID,
    p_upload_context TEXT,
    p_model_used TEXT,
    p_embedding_start_time TIMESTAMPTZ,
    p_embedding_end_time TIMESTAMPTZ,
    p_total_duration_ms INTEGER,
    p_api_call_duration_ms INTEGER,
    p_processing_duration_ms INTEGER,
    p_success BOOLEAN,
    p_error_type TEXT,
    p_error_message TEXT,
    p_tokens_used INTEGER,
    p_api_cost_usd NUMERIC,
    p_content_types TEXT[],
    p_synthetic_content_detected BOOLEAN,
    p_content_quality_score NUMERIC,
    p_retry_count INTEGER
);

DROP FUNCTION IF EXISTS public.get_embedding_success_rate(
    p_team_id UUID,
    p_hours_back INTEGER,
    p_upload_context TEXT
);

DROP FUNCTION IF EXISTS public.get_embedding_performance_stats(
    p_team_id UUID,
    p_hours_back INTEGER
);

DROP FUNCTION IF EXISTS public.update_hourly_embedding_stats();

DROP FUNCTION IF EXISTS public.update_daily_embedding_stats();

-- Drop aggregation functions
DROP FUNCTION IF EXISTS public.aggregate_hourly_embedding_metrics(
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ
);

DROP FUNCTION IF EXISTS public.aggregate_daily_embedding_metrics(
    p_start_date DATE,
    p_end_date DATE
);

-- ============================================================================
-- REMOVE PHASE 1 TRIGGERS
-- ============================================================================

-- Drop triggers for metrics tables
DROP TRIGGER IF EXISTS trigger_update_embedding_performance_metrics_updated_at 
ON public.embedding_performance_metrics;

DROP TRIGGER IF EXISTS trigger_update_embedding_hourly_stats_updated_at 
ON public.embedding_hourly_stats;

DROP TRIGGER IF EXISTS trigger_update_embedding_daily_stats_updated_at 
ON public.embedding_daily_stats;

-- ============================================================================
-- REMOVE PHASE 1 INDEXES
-- ============================================================================

-- Drop performance metrics indexes
DROP INDEX IF EXISTS public.idx_embedding_metrics_receipt_id;
DROP INDEX IF EXISTS public.idx_embedding_metrics_user_team;
DROP INDEX IF EXISTS public.idx_embedding_metrics_team_time;
DROP INDEX IF EXISTS public.idx_embedding_metrics_success_time;
DROP INDEX IF EXISTS public.idx_embedding_metrics_model_context;
DROP INDEX IF EXISTS public.idx_embedding_metrics_error_analysis;

-- Drop hourly stats indexes
DROP INDEX IF EXISTS public.idx_embedding_hourly_stats_time_team;
DROP INDEX IF EXISTS public.idx_embedding_hourly_stats_team_recent;

-- Drop daily stats indexes
DROP INDEX IF EXISTS public.idx_embedding_daily_stats_date_team;
DROP INDEX IF EXISTS public.idx_embedding_daily_stats_team_recent;

-- ============================================================================
-- REMOVE PHASE 1 TABLES
-- ============================================================================

-- Remove foreign key constraints first
ALTER TABLE IF EXISTS public.embedding_performance_metrics 
DROP CONSTRAINT IF EXISTS embedding_performance_metrics_receipt_id_fkey;

ALTER TABLE IF EXISTS public.embedding_performance_metrics 
DROP CONSTRAINT IF EXISTS embedding_performance_metrics_user_id_fkey;

ALTER TABLE IF EXISTS public.embedding_performance_metrics 
DROP CONSTRAINT IF EXISTS embedding_performance_metrics_team_id_fkey;

ALTER TABLE IF EXISTS public.embedding_hourly_stats 
DROP CONSTRAINT IF EXISTS embedding_hourly_stats_team_id_fkey;

ALTER TABLE IF EXISTS public.embedding_daily_stats 
DROP CONSTRAINT IF EXISTS embedding_daily_stats_team_id_fkey;

-- Drop tables in correct order
DROP TABLE IF EXISTS public.embedding_performance_metrics;
DROP TABLE IF EXISTS public.embedding_hourly_stats;
DROP TABLE IF EXISTS public.embedding_daily_stats;

-- ============================================================================
-- REMOVE PHASE 1 RLS POLICIES
-- ============================================================================

-- Note: RLS policies are automatically dropped with the tables

-- ============================================================================
-- REMOVE PHASE 1 VIEWS
-- ============================================================================

-- Drop monitoring views
DROP VIEW IF EXISTS public.embedding_success_rate_by_team;
DROP VIEW IF EXISTS public.embedding_performance_summary;
DROP VIEW IF EXISTS public.embedding_error_analysis;
DROP VIEW IF EXISTS public.embedding_cost_analysis;

-- ============================================================================
-- CLEANUP CRON JOBS (if any)
-- ============================================================================

-- Remove cron jobs for metrics aggregation
-- Note: This would typically be done through pg_cron extension
-- SELECT cron.unschedule('hourly-embedding-metrics-aggregation');
-- SELECT cron.unschedule('daily-embedding-metrics-aggregation');

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
    AND table_name IN ('embedding_performance_metrics', 'embedding_hourly_stats', 'embedding_daily_stats');
    
    IF table_count > 0 THEN
        RAISE EXCEPTION 'Phase 1 tables still exist after rollback';
    END IF;
END $$;

-- Verify functions are removed
DO $$
DECLARE
    function_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name LIKE '%embedding%'
    AND routine_name IN ('record_embedding_performance', 'get_embedding_success_rate', 'update_hourly_embedding_stats');
    
    IF function_count > 0 THEN
        RAISE EXCEPTION 'Phase 1 functions still exist after rollback';
    END IF;
END $$;

-- Update rollback log
UPDATE public.migration_rollback_log 
SET rollback_completed_at = NOW(),
    rollback_status = 'completed',
    rollback_notes = 'Phase 1 embedding metrics infrastructure successfully removed'
WHERE migration_name = '20250717000001_create_embedding_metrics_tables'
AND rollback_completed_at IS NULL;

-- ============================================================================
-- ROLLBACK COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Phase 1 rollback completed successfully';
    RAISE NOTICE 'Embedding metrics infrastructure has been removed';
    RAISE NOTICE 'Data has been backed up to *_backup tables';
    RAISE NOTICE 'System is now in pre-Phase 1 state';
    RAISE NOTICE 'Monitoring capabilities have been disabled';
END $$;
