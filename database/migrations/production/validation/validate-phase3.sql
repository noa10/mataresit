-- Validation Script for Phase 3: Batch Upload Optimization
-- Migration: 20250720000003_batch_upload_optimization.sql
-- This script validates that Phase 3 batch upload optimization is properly deployed

-- ============================================================================
-- VALIDATION SETUP
-- ============================================================================

-- Create validation results table
CREATE TEMP TABLE validation_results (
    check_name TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('PASS', 'FAIL', 'WARNING')),
    details TEXT,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helper function to record validation results
CREATE OR REPLACE FUNCTION record_validation_result(
    p_check_name TEXT,
    p_status TEXT,
    p_details TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO validation_results (check_name, status, details)
    VALUES (p_check_name, p_status, p_details)
    ON CONFLICT (check_name) 
    DO UPDATE SET 
        status = EXCLUDED.status,
        details = EXCLUDED.details,
        checked_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLE EXISTENCE VALIDATION
-- ============================================================================

-- Check if batch_upload_sessions table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'batch_upload_sessions'
    ) THEN
        PERFORM record_validation_result(
            'batch_upload_sessions_table_exists',
            'PASS',
            'Batch upload sessions table exists'
        );
    ELSE
        PERFORM record_validation_result(
            'batch_upload_sessions_table_exists',
            'FAIL',
            'Batch upload sessions table does not exist'
        );
    END IF;
END $$;

-- Check if batch_upload_files table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'batch_upload_files'
    ) THEN
        PERFORM record_validation_result(
            'batch_upload_files_table_exists',
            'PASS',
            'Batch upload files table exists'
        );
    ELSE
        PERFORM record_validation_result(
            'batch_upload_files_table_exists',
            'FAIL',
            'Batch upload files table does not exist'
        );
    END IF;
END $$;

-- Check if api_quota_tracking table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'api_quota_tracking'
    ) THEN
        PERFORM record_validation_result(
            'api_quota_tracking_table_exists',
            'PASS',
            'API quota tracking table exists'
        );
    ELSE
        PERFORM record_validation_result(
            'api_quota_tracking_table_exists',
            'FAIL',
            'API quota tracking table does not exist'
        );
    END IF;
END $$;

-- ============================================================================
-- COLUMN VALIDATION
-- ============================================================================

-- Validate batch_upload_sessions columns
DO $$
DECLARE
    expected_columns TEXT[] := ARRAY[
        'id', 'user_id', 'team_id', 'session_name', 'total_files',
        'files_completed', 'files_failed', 'files_pending', 'max_concurrent',
        'rate_limit_config', 'processing_strategy', 'status', 'started_at',
        'completed_at', 'estimated_duration_ms', 'actual_duration_ms',
        'total_cost_usd', 'optimization_flags', 'created_at', 'updated_at'
    ];
    missing_columns TEXT[] := '{}';
    col TEXT;
BEGIN
    FOREACH col IN ARRAY expected_columns
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'batch_upload_sessions'
            AND column_name = col
        ) THEN
            missing_columns := array_append(missing_columns, col);
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) IS NULL THEN
        PERFORM record_validation_result(
            'batch_upload_sessions_columns',
            'PASS',
            'All required columns present'
        );
    ELSE
        PERFORM record_validation_result(
            'batch_upload_sessions_columns',
            'FAIL',
            'Missing columns: ' || array_to_string(missing_columns, ', ')
        );
    END IF;
END $$;

-- Validate batch_upload_files columns
DO $$
DECLARE
    expected_columns TEXT[] := ARRAY[
        'id', 'batch_session_id', 'receipt_id', 'original_filename',
        'file_size_bytes', 'file_type', 'upload_order', 'status',
        'processing_started_at', 'processing_completed_at', 'processing_duration_ms',
        'error_message', 'retry_count', 'optimization_applied', 'created_at', 'updated_at'
    ];
    missing_columns TEXT[] := '{}';
    col TEXT;
BEGIN
    FOREACH col IN ARRAY expected_columns
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'batch_upload_files'
            AND column_name = col
        ) THEN
            missing_columns := array_append(missing_columns, col);
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) IS NULL THEN
        PERFORM record_validation_result(
            'batch_upload_files_columns',
            'PASS',
            'All required columns present'
        );
    ELSE
        PERFORM record_validation_result(
            'batch_upload_files_columns',
            'FAIL',
            'Missing columns: ' || array_to_string(missing_columns, ', ')
        );
    END IF;
END $$;

-- ============================================================================
-- INDEX VALIDATION
-- ============================================================================

-- Check Phase 3 specific indexes
DO $$
DECLARE
    expected_indexes TEXT[] := ARRAY[
        'idx_batch_upload_sessions_user_team',
        'idx_batch_upload_sessions_status_created',
        'idx_batch_upload_sessions_team_recent',
        'idx_batch_upload_files_session_order',
        'idx_batch_upload_files_receipt_id',
        'idx_batch_upload_files_status_processing',
        'idx_api_quota_tracking_team_provider_time',
        'idx_api_quota_tracking_provider_recent',
        'idx_api_quota_tracking_team_recent'
    ];
    missing_indexes TEXT[] := '{}';
    idx TEXT;
BEGIN
    FOREACH idx IN ARRAY expected_indexes
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public'
            AND indexname = idx
        ) THEN
            missing_indexes := array_append(missing_indexes, idx);
        END IF;
    END LOOP;
    
    IF array_length(missing_indexes, 1) IS NULL THEN
        PERFORM record_validation_result(
            'phase3_indexes',
            'PASS',
            'All Phase 3 indexes present'
        );
    ELSE
        PERFORM record_validation_result(
            'phase3_indexes',
            'FAIL',
            'Missing indexes: ' || array_to_string(missing_indexes, ', ')
        );
    END IF;
END $$;

-- ============================================================================
-- FUNCTION VALIDATION
-- ============================================================================

-- Check batch session management functions
DO $$
DECLARE
    expected_functions TEXT[] := ARRAY[
        'create_batch_upload_session',
        'add_file_to_batch_session',
        'update_batch_session_progress',
        'get_batch_session_status',
        'complete_batch_upload_session',
        'get_user_batch_sessions'
    ];
    missing_functions TEXT[] := '{}';
    func TEXT;
BEGIN
    FOREACH func IN ARRAY expected_functions
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.routines
            WHERE routine_schema = 'public'
            AND routine_name = func
        ) THEN
            missing_functions := array_append(missing_functions, func);
        END IF;
    END LOOP;
    
    IF array_length(missing_functions, 1) IS NULL THEN
        PERFORM record_validation_result(
            'phase3_batch_functions',
            'PASS',
            'All batch management functions present'
        );
    ELSE
        PERFORM record_validation_result(
            'phase3_batch_functions',
            'FAIL',
            'Missing functions: ' || array_to_string(missing_functions, ', ')
        );
    END IF;
END $$;

-- Check API quota tracking functions
DO $$
DECLARE
    quota_functions TEXT[] := ARRAY[
        'track_api_quota_usage',
        'get_current_api_quota_usage',
        'check_api_quota_limits'
    ];
    missing_functions TEXT[] := '{}';
    func TEXT;
BEGIN
    FOREACH func IN ARRAY quota_functions
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.routines
            WHERE routine_schema = 'public'
            AND routine_name = func
        ) THEN
            missing_functions := array_append(missing_functions, func);
        END IF;
    END LOOP;
    
    IF array_length(missing_functions, 1) IS NULL THEN
        PERFORM record_validation_result(
            'phase3_quota_functions',
            'PASS',
            'All API quota functions present'
        );
    ELSE
        PERFORM record_validation_result(
            'phase3_quota_functions',
            'FAIL',
            'Missing functions: ' || array_to_string(missing_functions, ', ')
        );
    END IF;
END $$;

-- ============================================================================
-- CONSTRAINT VALIDATION
-- ============================================================================

-- Check foreign key constraints
DO $$
DECLARE
    constraint_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public'
    AND tc.table_name IN ('batch_upload_sessions', 'batch_upload_files', 'api_quota_tracking')
    AND tc.constraint_type = 'FOREIGN KEY';
    
    IF constraint_count >= 5 THEN
        PERFORM record_validation_result(
            'phase3_foreign_keys',
            'PASS',
            'Foreign key constraints properly configured'
        );
    ELSE
        PERFORM record_validation_result(
            'phase3_foreign_keys',
            'FAIL',
            'Missing foreign key constraints'
        );
    END IF;
END $$;

-- Check status constraints
DO $$
DECLARE
    session_constraint TEXT;
    files_constraint TEXT;
BEGIN
    SELECT pg_get_constraintdef(oid) INTO session_constraint
    FROM pg_constraint
    WHERE conname LIKE '%batch_upload_sessions_status_check%'
    AND conrelid = 'public.batch_upload_sessions'::regclass;
    
    SELECT pg_get_constraintdef(oid) INTO files_constraint
    FROM pg_constraint
    WHERE conname LIKE '%batch_upload_files_status_check%'
    AND conrelid = 'public.batch_upload_files'::regclass;
    
    IF session_constraint IS NOT NULL AND files_constraint IS NOT NULL THEN
        PERFORM record_validation_result(
            'phase3_status_constraints',
            'PASS',
            'Status constraints properly configured'
        );
    ELSE
        PERFORM record_validation_result(
            'phase3_status_constraints',
            'FAIL',
            'Status constraints missing or misconfigured'
        );
    END IF;
END $$;

-- ============================================================================
-- FUNCTIONAL VALIDATION
-- ============================================================================

-- Test batch session creation
DO $$
DECLARE
    test_session_id UUID;
    test_user_id UUID := gen_random_uuid();
    test_team_id UUID := gen_random_uuid();
BEGIN
    BEGIN
        SELECT public.create_batch_upload_session(
            test_user_id,
            test_team_id,
            'Test Session',
            5,
            'balanced',
            2
        ) INTO test_session_id;
        
        IF test_session_id IS NOT NULL THEN
            PERFORM record_validation_result(
                'batch_session_creation',
                'PASS',
                'Batch session creation working'
            );
            
            -- Cleanup test session
            DELETE FROM public.batch_upload_sessions WHERE id = test_session_id;
        ELSE
            PERFORM record_validation_result(
                'batch_session_creation',
                'FAIL',
                'Batch session creation returned NULL'
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        PERFORM record_validation_result(
            'batch_session_creation',
            'FAIL',
            'Batch session creation failed: ' || SQLERRM
        );
    END;
END $$;

-- Test API quota tracking
DO $$
DECLARE
    test_team_id UUID := gen_random_uuid();
    quota_result RECORD;
BEGIN
    BEGIN
        -- Track some API usage
        PERFORM public.track_api_quota_usage(
            test_team_id,
            'gemini',
            1000,
            1,
            0.001
        );
        
        -- Check current usage
        SELECT * INTO quota_result
        FROM public.get_current_api_quota_usage(
            test_team_id,
            'gemini',
            INTERVAL '1 hour'
        );
        
        IF quota_result.total_tokens_used = 1000 THEN
            PERFORM record_validation_result(
                'api_quota_tracking',
                'PASS',
                'API quota tracking working correctly'
            );
        ELSE
            PERFORM record_validation_result(
                'api_quota_tracking',
                'FAIL',
                'API quota tracking not working correctly'
            );
        END IF;
        
        -- Cleanup test data
        DELETE FROM public.api_quota_tracking WHERE team_id = test_team_id;
    EXCEPTION WHEN OTHERS THEN
        PERFORM record_validation_result(
            'api_quota_tracking',
            'FAIL',
            'API quota tracking failed: ' || SQLERRM
        );
    END;
END $$;

-- ============================================================================
-- VALIDATION SUMMARY
-- ============================================================================

-- Display validation results
DO $$
DECLARE
    total_checks INTEGER;
    passed_checks INTEGER;
    failed_checks INTEGER;
    warning_checks INTEGER;
    result RECORD;
BEGIN
    SELECT COUNT(*), 
           COUNT(*) FILTER (WHERE status = 'PASS'),
           COUNT(*) FILTER (WHERE status = 'FAIL'),
           COUNT(*) FILTER (WHERE status = 'WARNING')
    INTO total_checks, passed_checks, failed_checks, warning_checks
    FROM validation_results;
    
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'PHASE 3 VALIDATION SUMMARY';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Total Checks: %', total_checks;
    RAISE NOTICE 'Passed: %', passed_checks;
    RAISE NOTICE 'Failed: %', failed_checks;
    RAISE NOTICE 'Warnings: %', warning_checks;
    RAISE NOTICE '';
    
    IF failed_checks > 0 THEN
        RAISE NOTICE 'FAILED CHECKS:';
        FOR result IN 
            SELECT check_name, details 
            FROM validation_results 
            WHERE status = 'FAIL'
            ORDER BY check_name
        LOOP
            RAISE NOTICE '❌ %: %', result.check_name, COALESCE(result.details, 'No details');
        END LOOP;
        RAISE NOTICE '';
    END IF;
    
    IF warning_checks > 0 THEN
        RAISE NOTICE 'WARNINGS:';
        FOR result IN 
            SELECT check_name, details 
            FROM validation_results 
            WHERE status = 'WARNING'
            ORDER BY check_name
        LOOP
            RAISE NOTICE '⚠️  %: %', result.check_name, COALESCE(result.details, 'No details');
        END LOOP;
        RAISE NOTICE '';
    END IF;
    
    IF failed_checks = 0 THEN
        RAISE NOTICE '✅ Phase 3 validation PASSED';
        RAISE NOTICE 'Batch upload optimization is properly deployed';
    ELSE
        RAISE NOTICE '❌ Phase 3 validation FAILED';
        RAISE NOTICE 'Please address the failed checks before proceeding';
    END IF;
    
    RAISE NOTICE '============================================';
END $$;

-- Export validation results
SELECT 
    check_name,
    status,
    details,
    checked_at
FROM validation_results
ORDER BY 
    CASE status 
        WHEN 'FAIL' THEN 1
        WHEN 'WARNING' THEN 2
        WHEN 'PASS' THEN 3
    END,
    check_name;
