-- Validation Script for Phase 2: Queue System Enhancements
-- Migration: 20250719000001_enhance_embedding_queue_phase2.sql
-- This script validates that Phase 2 queue enhancements are properly deployed

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
-- TABLE STRUCTURE VALIDATION
-- ============================================================================

-- Check if embedding_queue table has Phase 2 columns
DO $$
DECLARE
    phase2_columns TEXT[] := ARRAY[
        'batch_id', 'worker_id', 'processing_started_at', 'processing_completed_at',
        'estimated_tokens', 'actual_tokens', 'rate_limit_delay_ms'
    ];
    missing_columns TEXT[] := '{}';
    col TEXT;
BEGIN
    FOREACH col IN ARRAY phase2_columns
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'embedding_queue'
            AND column_name = col
        ) THEN
            missing_columns := array_append(missing_columns, col);
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) IS NULL THEN
        PERFORM record_validation_result(
            'embedding_queue_phase2_columns',
            'PASS',
            'All Phase 2 columns present'
        );
    ELSE
        PERFORM record_validation_result(
            'embedding_queue_phase2_columns',
            'FAIL',
            'Missing columns: ' || array_to_string(missing_columns, ', ')
        );
    END IF;
END $$;

-- Check if embedding_queue_workers table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'embedding_queue_workers'
    ) THEN
        PERFORM record_validation_result(
            'embedding_queue_workers_table_exists',
            'PASS',
            'Worker tracking table exists'
        );
    ELSE
        PERFORM record_validation_result(
            'embedding_queue_workers_table_exists',
            'FAIL',
            'Worker tracking table does not exist'
        );
    END IF;
END $$;

-- Check if embedding_queue_config table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'embedding_queue_config'
    ) THEN
        PERFORM record_validation_result(
            'embedding_queue_config_table_exists',
            'PASS',
            'Queue configuration table exists'
        );
    ELSE
        PERFORM record_validation_result(
            'embedding_queue_config_table_exists',
            'FAIL',
            'Queue configuration table does not exist'
        );
    END IF;
END $$;

-- ============================================================================
-- STATUS CONSTRAINT VALIDATION
-- ============================================================================

-- Check if status constraint includes Phase 2 values
DO $$
DECLARE
    constraint_def TEXT;
BEGIN
    SELECT pg_get_constraintdef(oid) INTO constraint_def
    FROM pg_constraint
    WHERE conname = 'embedding_queue_status_check'
    AND conrelid = 'public.embedding_queue'::regclass;
    
    IF constraint_def LIKE '%rate_limited%' AND constraint_def LIKE '%cancelled%' THEN
        PERFORM record_validation_result(
            'embedding_queue_status_constraint',
            'PASS',
            'Status constraint includes Phase 2 values'
        );
    ELSE
        PERFORM record_validation_result(
            'embedding_queue_status_constraint',
            'FAIL',
            'Status constraint missing Phase 2 values: ' || COALESCE(constraint_def, 'constraint not found')
        );
    END IF;
END $$;

-- ============================================================================
-- INDEX VALIDATION
-- ============================================================================

-- Check Phase 2 specific indexes
DO $$
DECLARE
    expected_indexes TEXT[] := ARRAY[
        'idx_embedding_queue_priority_status',
        'idx_embedding_queue_worker_processing',
        'idx_embedding_queue_batch_id',
        'idx_embedding_queue_rate_limited',
        'idx_embedding_queue_performance'
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
            'phase2_indexes',
            'PASS',
            'All Phase 2 indexes present'
        );
    ELSE
        PERFORM record_validation_result(
            'phase2_indexes',
            'FAIL',
            'Missing indexes: ' || array_to_string(missing_indexes, ', ')
        );
    END IF;
END $$;

-- ============================================================================
-- FUNCTION VALIDATION
-- ============================================================================

-- Check Phase 2 queue management functions
DO $$
DECLARE
    expected_functions TEXT[] := ARRAY[
        'get_next_queue_item_with_priority',
        'update_queue_item_status',
        'get_queue_statistics',
        'cleanup_stale_queue_items',
        'requeue_failed_items',
        'get_worker_performance_stats',
        'optimize_queue_priorities'
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
            'phase2_queue_functions',
            'PASS',
            'All Phase 2 queue functions present'
        );
    ELSE
        PERFORM record_validation_result(
            'phase2_queue_functions',
            'FAIL',
            'Missing functions: ' || array_to_string(missing_functions, ', ')
        );
    END IF;
END $$;

-- Check rate limiting functions
DO $$
DECLARE
    rate_limit_functions TEXT[] := ARRAY[
        'check_rate_limits',
        'update_rate_limit_status'
    ];
    missing_functions TEXT[] := '{}';
    func TEXT;
BEGIN
    FOREACH func IN ARRAY rate_limit_functions
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
            'phase2_rate_limit_functions',
            'PASS',
            'All rate limiting functions present'
        );
    ELSE
        PERFORM record_validation_result(
            'phase2_rate_limit_functions',
            'FAIL',
            'Missing functions: ' || array_to_string(missing_functions, ', ')
        );
    END IF;
END $$;

-- ============================================================================
-- FUNCTIONAL VALIDATION
-- ============================================================================

-- Test queue item retrieval with priority
DO $$
DECLARE
    test_result RECORD;
    test_queue_id UUID;
BEGIN
    -- Insert test queue item
    INSERT INTO public.embedding_queue (
        source_type, source_id, operation, priority, status
    ) VALUES (
        'test', gen_random_uuid(), 'INSERT', 'high', 'pending'
    ) RETURNING id INTO test_queue_id;
    
    -- Test priority-based retrieval
    BEGIN
        SELECT * INTO test_result
        FROM public.get_next_queue_item_with_priority('test-worker', 1);
        
        IF test_result.id = test_queue_id THEN
            PERFORM record_validation_result(
                'priority_queue_retrieval',
                'PASS',
                'Priority-based queue retrieval working'
            );
        ELSE
            PERFORM record_validation_result(
                'priority_queue_retrieval',
                'FAIL',
                'Priority-based queue retrieval not working correctly'
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        PERFORM record_validation_result(
            'priority_queue_retrieval',
            'FAIL',
            'Priority queue function failed: ' || SQLERRM
        );
    END;
    
    -- Cleanup test data
    DELETE FROM public.embedding_queue WHERE id = test_queue_id;
END $$;

-- Test queue statistics function
DO $$
DECLARE
    stats_result RECORD;
BEGIN
    BEGIN
        SELECT * INTO stats_result
        FROM public.get_queue_statistics();
        
        IF stats_result IS NOT NULL THEN
            PERFORM record_validation_result(
                'queue_statistics_function',
                'PASS',
                'Queue statistics function working'
            );
        ELSE
            PERFORM record_validation_result(
                'queue_statistics_function',
                'FAIL',
                'Queue statistics function returned no data'
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        PERFORM record_validation_result(
            'queue_statistics_function',
            'FAIL',
            'Queue statistics function failed: ' || SQLERRM
        );
    END;
END $$;

-- ============================================================================
-- WORKER TRACKING VALIDATION
-- ============================================================================

-- Test worker registration and tracking
DO $$
DECLARE
    test_worker_id TEXT := 'test-worker-' || extract(epoch from now());
    worker_count INTEGER;
BEGIN
    -- Insert test worker
    INSERT INTO public.embedding_queue_workers (
        worker_id, team_id, status, last_heartbeat
    ) VALUES (
        test_worker_id, gen_random_uuid(), 'active', NOW()
    );
    
    -- Check if worker was registered
    SELECT COUNT(*) INTO worker_count
    FROM public.embedding_queue_workers
    WHERE worker_id = test_worker_id;
    
    IF worker_count = 1 THEN
        PERFORM record_validation_result(
            'worker_tracking',
            'PASS',
            'Worker tracking functionality working'
        );
    ELSE
        PERFORM record_validation_result(
            'worker_tracking',
            'FAIL',
            'Worker tracking not working correctly'
        );
    END IF;
    
    -- Cleanup test worker
    DELETE FROM public.embedding_queue_workers WHERE worker_id = test_worker_id;
END $$;

-- ============================================================================
-- PERFORMANCE VALIDATION
-- ============================================================================

-- Test index performance on enhanced queue queries
DO $$
DECLARE
    explain_result TEXT;
BEGIN
    -- Test priority-based query performance
    SELECT INTO explain_result
        (SELECT string_agg(line, E'\n') 
         FROM (
             SELECT unnest(string_to_array(
                 (EXPLAIN (ANALYZE, BUFFERS) 
                  SELECT * FROM public.embedding_queue 
                  WHERE status = 'pending' 
                  ORDER BY priority, created_at 
                  LIMIT 10
                 ), E'\n'
             )) AS line
         ) t
        );
    
    IF explain_result LIKE '%Index Scan%' OR explain_result LIKE '%Bitmap Index Scan%' THEN
        PERFORM record_validation_result(
            'priority_query_performance',
            'PASS',
            'Priority queries using indexes efficiently'
        );
    ELSE
        PERFORM record_validation_result(
            'priority_query_performance',
            'WARNING',
            'Priority queries may not be using indexes optimally'
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
    RAISE NOTICE 'PHASE 2 VALIDATION SUMMARY';
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
        RAISE NOTICE '✅ Phase 2 validation PASSED';
        RAISE NOTICE 'Queue system enhancements are properly deployed';
    ELSE
        RAISE NOTICE '❌ Phase 2 validation FAILED';
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
