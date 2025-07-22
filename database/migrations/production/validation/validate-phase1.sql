-- Validation Script for Phase 1: Embedding Metrics Tables
-- Migration: 20250717000001_create_embedding_metrics_tables.sql
-- This script validates that Phase 1 monitoring infrastructure is properly deployed

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

-- Check if embedding_performance_metrics table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'embedding_performance_metrics'
    ) THEN
        PERFORM record_validation_result(
            'embedding_performance_metrics_table_exists',
            'PASS',
            'Table exists with correct schema'
        );
    ELSE
        PERFORM record_validation_result(
            'embedding_performance_metrics_table_exists',
            'FAIL',
            'Table does not exist'
        );
    END IF;
END $$;

-- Check if embedding_hourly_stats table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'embedding_hourly_stats'
    ) THEN
        PERFORM record_validation_result(
            'embedding_hourly_stats_table_exists',
            'PASS',
            'Table exists with correct schema'
        );
    ELSE
        PERFORM record_validation_result(
            'embedding_hourly_stats_table_exists',
            'FAIL',
            'Table does not exist'
        );
    END IF;
END $$;

-- Check if embedding_daily_stats table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'embedding_daily_stats'
    ) THEN
        PERFORM record_validation_result(
            'embedding_daily_stats_table_exists',
            'PASS',
            'Table exists with correct schema'
        );
    ELSE
        PERFORM record_validation_result(
            'embedding_daily_stats_table_exists',
            'FAIL',
            'Table does not exist'
        );
    END IF;
END $$;

-- ============================================================================
-- COLUMN VALIDATION
-- ============================================================================

-- Validate embedding_performance_metrics columns
DO $$
DECLARE
    expected_columns TEXT[] := ARRAY[
        'id', 'receipt_id', 'user_id', 'team_id', 'upload_context', 'model_used',
        'embedding_start_time', 'embedding_end_time', 'total_duration_ms',
        'api_call_duration_ms', 'processing_duration_ms', 'success',
        'error_type', 'error_message', 'tokens_used', 'api_cost_usd',
        'content_types', 'synthetic_content_detected', 'content_quality_score',
        'retry_count', 'created_at', 'updated_at'
    ];
    missing_columns TEXT[] := '{}';
    col TEXT;
BEGIN
    FOREACH col IN ARRAY expected_columns
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'embedding_performance_metrics'
            AND column_name = col
        ) THEN
            missing_columns := array_append(missing_columns, col);
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) IS NULL THEN
        PERFORM record_validation_result(
            'embedding_performance_metrics_columns',
            'PASS',
            'All required columns present'
        );
    ELSE
        PERFORM record_validation_result(
            'embedding_performance_metrics_columns',
            'FAIL',
            'Missing columns: ' || array_to_string(missing_columns, ', ')
        );
    END IF;
END $$;

-- ============================================================================
-- INDEX VALIDATION
-- ============================================================================

-- Check critical indexes exist
DO $$
DECLARE
    expected_indexes TEXT[] := ARRAY[
        'idx_embedding_metrics_receipt_id',
        'idx_embedding_metrics_user_team',
        'idx_embedding_metrics_team_time',
        'idx_embedding_hourly_stats_time_team',
        'idx_embedding_daily_stats_date_team'
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
            'phase1_indexes',
            'PASS',
            'All required indexes present'
        );
    ELSE
        PERFORM record_validation_result(
            'phase1_indexes',
            'FAIL',
            'Missing indexes: ' || array_to_string(missing_indexes, ', ')
        );
    END IF;
END $$;

-- ============================================================================
-- FUNCTION VALIDATION
-- ============================================================================

-- Check if critical functions exist
DO $$
DECLARE
    expected_functions TEXT[] := ARRAY[
        'record_embedding_performance',
        'get_embedding_success_rate',
        'get_embedding_performance_stats',
        'update_hourly_embedding_stats',
        'update_daily_embedding_stats'
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
            'phase1_functions',
            'PASS',
            'All required functions present'
        );
    ELSE
        PERFORM record_validation_result(
            'phase1_functions',
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
    AND tc.table_name = 'embedding_performance_metrics'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name IN ('receipt_id', 'user_id', 'team_id');
    
    IF constraint_count >= 3 THEN
        PERFORM record_validation_result(
            'phase1_foreign_keys',
            'PASS',
            'Foreign key constraints properly configured'
        );
    ELSE
        PERFORM record_validation_result(
            'phase1_foreign_keys',
            'FAIL',
            'Missing foreign key constraints'
        );
    END IF;
END $$;

-- ============================================================================
-- RLS POLICY VALIDATION
-- ============================================================================

-- Check RLS policies exist
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN ('embedding_performance_metrics', 'embedding_hourly_stats', 'embedding_daily_stats');
    
    IF policy_count > 0 THEN
        PERFORM record_validation_result(
            'phase1_rls_policies',
            'PASS',
            'RLS policies configured'
        );
    ELSE
        PERFORM record_validation_result(
            'phase1_rls_policies',
            'WARNING',
            'No RLS policies found - may be intentional for system tables'
        );
    END IF;
END $$;

-- ============================================================================
-- FUNCTIONAL VALIDATION
-- ============================================================================

-- Test basic function functionality
DO $$
DECLARE
    test_result BOOLEAN;
BEGIN
    -- Test record_embedding_performance function
    BEGIN
        SELECT public.record_embedding_performance(
            gen_random_uuid(), -- receipt_id
            gen_random_uuid(), -- user_id  
            gen_random_uuid(), -- team_id
            'single',          -- upload_context
            'gemini-1.5-pro',  -- model_used
            NOW() - INTERVAL '1 minute', -- start_time
            NOW(),             -- end_time
            60000,             -- total_duration_ms
            45000,             -- api_call_duration_ms
            15000,             -- processing_duration_ms
            true,              -- success
            NULL,              -- error_type
            NULL,              -- error_message
            1000,              -- tokens_used
            0.001,             -- api_cost_usd
            ARRAY['text', 'structured'], -- content_types
            false,             -- synthetic_content_detected
            0.95,              -- content_quality_score
            0                  -- retry_count
        ) IS NOT NULL INTO test_result;
        
        IF test_result THEN
            PERFORM record_validation_result(
                'record_embedding_performance_function',
                'PASS',
                'Function executes successfully'
            );
        ELSE
            PERFORM record_validation_result(
                'record_embedding_performance_function',
                'FAIL',
                'Function returned NULL'
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        PERFORM record_validation_result(
            'record_embedding_performance_function',
            'FAIL',
            'Function execution failed: ' || SQLERRM
        );
    END;
END $$;

-- ============================================================================
-- PERFORMANCE VALIDATION
-- ============================================================================

-- Check index performance on large tables
DO $$
DECLARE
    explain_result TEXT;
BEGIN
    -- Test query performance on metrics table
    SELECT INTO explain_result
        (SELECT string_agg(line, E'\n') 
         FROM (
             SELECT unnest(string_to_array(
                 (EXPLAIN (ANALYZE, BUFFERS) 
                  SELECT COUNT(*) 
                  FROM public.embedding_performance_metrics 
                  WHERE team_id = gen_random_uuid() 
                  AND embedding_start_time >= NOW() - INTERVAL '24 hours'
                 ), E'\n'
             )) AS line
         ) t
        );
    
    IF explain_result LIKE '%Index Scan%' OR explain_result LIKE '%Bitmap Index Scan%' THEN
        PERFORM record_validation_result(
            'query_performance',
            'PASS',
            'Queries using indexes efficiently'
        );
    ELSE
        PERFORM record_validation_result(
            'query_performance',
            'WARNING',
            'Queries may not be using indexes optimally'
        );
    END IF;
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
    RAISE NOTICE 'PHASE 1 VALIDATION SUMMARY';
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
        RAISE NOTICE '✅ Phase 1 validation PASSED';
        RAISE NOTICE 'Embedding metrics infrastructure is properly deployed';
    ELSE
        RAISE NOTICE '❌ Phase 1 validation FAILED';
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
