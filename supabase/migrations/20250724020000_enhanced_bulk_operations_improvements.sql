-- ============================================================================
-- ENHANCED BULK OPERATIONS IMPROVEMENTS
-- ============================================================================
-- This migration enhances existing bulk operations with better transaction safety,
-- progress tracking, and error handling for the Enhanced Member Management system.
--
-- Enhancements included:
-- - Improved transaction safety with savepoints and rollback handling
-- - Real-time progress tracking with detailed status updates
-- - Enhanced error handling with retry mechanisms and detailed error reporting
-- - Better audit trails and comprehensive logging
-- - Performance optimizations for large bulk operations
-- - Integration with scheduled operations system
-- ============================================================================

-- ============================================================================
-- 1. ENHANCED BULK OPERATIONS TABLE IMPROVEMENTS
-- ============================================================================

-- Add new columns to existing bulk operations table for enhanced tracking
ALTER TABLE public.team_bulk_operations
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
ADD COLUMN IF NOT EXISTS estimated_duration_seconds INTEGER,
ADD COLUMN IF NOT EXISTS actual_duration_seconds INTEGER,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS progress_details JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS performance_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS transaction_log JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS scheduled_operation_id UUID REFERENCES public.scheduled_operations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS batch_size INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS concurrent_workers INTEGER DEFAULT 1;

-- Add new indexes for enhanced querying
CREATE INDEX IF NOT EXISTS idx_bulk_operations_priority ON public.team_bulk_operations(priority DESC, started_at ASC);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_retry_count ON public.team_bulk_operations(retry_count);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_scheduled ON public.team_bulk_operations(scheduled_operation_id);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_performance ON public.team_bulk_operations(actual_duration_seconds) WHERE actual_duration_seconds IS NOT NULL;

-- ============================================================================
-- 2. BULK OPERATION PROGRESS TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bulk_operation_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_operation_id UUID NOT NULL REFERENCES public.team_bulk_operations(id) ON DELETE CASCADE,
  
  -- Progress details
  step_name VARCHAR(100) NOT NULL,
  step_description TEXT,
  step_order INTEGER NOT NULL,
  
  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Progress metrics
  items_processed INTEGER DEFAULT 0,
  items_total INTEGER DEFAULT 0,
  progress_percentage NUMERIC(5,2) DEFAULT 0,
  
  -- Error handling
  error_message TEXT,
  error_details JSONB,
  retry_count INTEGER DEFAULT 0,
  
  -- Performance metrics
  processing_time_ms INTEGER,
  memory_usage_mb NUMERIC(10,2),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for progress tracking
CREATE INDEX IF NOT EXISTS idx_bulk_progress_operation_id ON public.bulk_operation_progress(bulk_operation_id);
CREATE INDEX IF NOT EXISTS idx_bulk_progress_status ON public.bulk_operation_progress(status);
CREATE INDEX IF NOT EXISTS idx_bulk_progress_step_order ON public.bulk_operation_progress(bulk_operation_id, step_order);

-- ============================================================================
-- 3. ENHANCED HELPER FUNCTIONS
-- ============================================================================

-- Function to log bulk operation progress
CREATE OR REPLACE FUNCTION public.log_bulk_operation_progress(
  _bulk_operation_id UUID,
  _step_name VARCHAR(100),
  _step_description TEXT DEFAULT NULL,
  _step_order INTEGER DEFAULT 1,
  _status VARCHAR(20) DEFAULT 'in_progress',
  _items_processed INTEGER DEFAULT 0,
  _items_total INTEGER DEFAULT 0,
  _error_message TEXT DEFAULT NULL,
  _error_details JSONB DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  _progress_id UUID;
  _progress_percentage NUMERIC(5,2);
BEGIN
  -- Calculate progress percentage
  IF _items_total > 0 THEN
    _progress_percentage := ROUND((_items_processed::NUMERIC / _items_total::NUMERIC) * 100, 2);
  ELSE
    _progress_percentage := 0;
  END IF;

  -- Insert or update progress record
  INSERT INTO public.bulk_operation_progress (
    bulk_operation_id,
    step_name,
    step_description,
    step_order,
    status,
    started_at,
    completed_at,
    items_processed,
    items_total,
    progress_percentage,
    error_message,
    error_details,
    metadata
  ) VALUES (
    _bulk_operation_id,
    _step_name,
    _step_description,
    _step_order,
    _status,
    CASE WHEN _status = 'in_progress' THEN NOW() ELSE NULL END,
    CASE WHEN _status IN ('completed', 'failed', 'skipped') THEN NOW() ELSE NULL END,
    _items_processed,
    _items_total,
    _progress_percentage,
    _error_message,
    _error_details,
    _metadata
  )
  ON CONFLICT (bulk_operation_id, step_name) 
  DO UPDATE SET
    step_description = EXCLUDED.step_description,
    status = EXCLUDED.status,
    started_at = CASE WHEN EXCLUDED.status = 'in_progress' AND bulk_operation_progress.started_at IS NULL THEN NOW() ELSE bulk_operation_progress.started_at END,
    completed_at = CASE WHEN EXCLUDED.status IN ('completed', 'failed', 'skipped') THEN NOW() ELSE bulk_operation_progress.completed_at END,
    items_processed = EXCLUDED.items_processed,
    items_total = EXCLUDED.items_total,
    progress_percentage = EXCLUDED.progress_percentage,
    error_message = EXCLUDED.error_message,
    error_details = EXCLUDED.error_details,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING id INTO _progress_id;

  -- Update main bulk operation progress
  UPDATE public.team_bulk_operations
  SET 
    processed_items = (
      SELECT COALESCE(SUM(items_processed), 0)
      FROM public.bulk_operation_progress
      WHERE bulk_operation_id = _bulk_operation_id
    ),
    progress_details = jsonb_build_object(
      'current_step', _step_name,
      'step_progress', _progress_percentage,
      'overall_progress', (
        SELECT ROUND(AVG(progress_percentage), 2)
        FROM public.bulk_operation_progress
        WHERE bulk_operation_id = _bulk_operation_id
      )
    ),
    last_error_at = CASE WHEN _status = 'failed' THEN NOW() ELSE last_error_at END
  WHERE id = _bulk_operation_id;

  RETURN _progress_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update bulk operation status with enhanced tracking
CREATE OR REPLACE FUNCTION public.update_bulk_operation_status(
  _bulk_operation_id UUID,
  _status VARCHAR(50),
  _error_summary TEXT DEFAULT NULL,
  _performance_metrics JSONB DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  _start_time TIMESTAMP WITH TIME ZONE;
  _duration_seconds INTEGER;
BEGIN
  -- Get start time for duration calculation
  SELECT started_at INTO _start_time
  FROM public.team_bulk_operations
  WHERE id = _bulk_operation_id;

  -- Calculate duration if completing
  IF _status IN ('completed', 'failed', 'cancelled') AND _start_time IS NOT NULL THEN
    _duration_seconds := EXTRACT(EPOCH FROM (NOW() - _start_time))::INTEGER;
  END IF;

  -- Update bulk operation
  UPDATE public.team_bulk_operations
  SET 
    operation_status = _status,
    completed_at = CASE WHEN _status IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END,
    error_summary = COALESCE(_error_summary, error_summary),
    actual_duration_seconds = COALESCE(_duration_seconds, actual_duration_seconds),
    performance_metrics = COALESCE(_performance_metrics, performance_metrics),
    transaction_log = transaction_log || jsonb_build_array(
      jsonb_build_object(
        'timestamp', NOW(),
        'action', 'status_change',
        'old_status', (SELECT operation_status FROM public.team_bulk_operations WHERE id = _bulk_operation_id),
        'new_status', _status,
        'error_summary', _error_summary
      )
    )
  WHERE id = _bulk_operation_id;

  -- Log final progress step if completing
  IF _status IN ('completed', 'failed', 'cancelled') THEN
    PERFORM public.log_bulk_operation_progress(
      _bulk_operation_id,
      'operation_' || _status,
      'Bulk operation ' || _status,
      999,
      CASE WHEN _status = 'completed' THEN 'completed' ELSE 'failed' END,
      (SELECT processed_items FROM public.team_bulk_operations WHERE id = _bulk_operation_id),
      (SELECT total_items FROM public.team_bulk_operations WHERE id = _bulk_operation_id),
      _error_summary,
      CASE WHEN _error_summary IS NOT NULL THEN jsonb_build_object('error_summary', _error_summary) ELSE NULL END
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create bulk operation with enhanced configuration
CREATE OR REPLACE FUNCTION public.create_bulk_operation_enhanced(
  _team_id UUID,
  _operation_type VARCHAR(50),
  _target_data JSONB,
  _operation_params JSONB DEFAULT '{}',
  _priority INTEGER DEFAULT 5,
  _batch_size INTEGER DEFAULT 10,
  _concurrent_workers INTEGER DEFAULT 1,
  _max_retries INTEGER DEFAULT 3,
  _estimated_duration_seconds INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  _bulk_operation_id UUID;
  _current_user_id UUID := auth.uid();
  _total_items INTEGER;
BEGIN
  -- Calculate total items
  _total_items := jsonb_array_length(_target_data);

  -- Create bulk operation record
  INSERT INTO public.team_bulk_operations (
    team_id,
    operation_type,
    operation_status,
    performed_by,
    target_data,
    operation_params,
    total_items,
    priority,
    batch_size,
    concurrent_workers,
    max_retries,
    estimated_duration_seconds
  ) VALUES (
    _team_id,
    _operation_type,
    'pending',
    _current_user_id,
    _target_data,
    _operation_params,
    _total_items,
    _priority,
    _batch_size,
    _concurrent_workers,
    _max_retries,
    _estimated_duration_seconds
  ) RETURNING id INTO _bulk_operation_id;

  -- Log initial progress
  PERFORM public.log_bulk_operation_progress(
    _bulk_operation_id,
    'initialization',
    'Bulk operation initialized',
    1,
    'completed',
    0,
    _total_items,
    NULL,
    NULL,
    jsonb_build_object(
      'operation_type', _operation_type,
      'total_items', _total_items,
      'batch_size', _batch_size,
      'concurrent_workers', _concurrent_workers
    )
  );

  RETURN _bulk_operation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. ENHANCED BULK MEMBER REMOVAL FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.bulk_remove_team_members_enhanced(
  _team_id UUID,
  _user_ids UUID[],
  _reason TEXT DEFAULT NULL,
  _transfer_data BOOLEAN DEFAULT false,
  _transfer_to_user_id UUID DEFAULT NULL,
  _batch_size INTEGER DEFAULT 5,
  _priority INTEGER DEFAULT 5
) RETURNS JSONB AS $$
DECLARE
  _current_user_id UUID := auth.uid();
  _current_user_role public.team_member_role;
  _bulk_operation_id UUID;
  _user_id UUID;
  _removal_result JSONB;
  _results JSONB := '[]';
  _success_count INTEGER := 0;
  _failed_count INTEGER := 0;
  _processed_count INTEGER := 0;
  _total_count INTEGER;
  _batch_start INTEGER := 1;
  _batch_end INTEGER;
  _savepoint_name TEXT;
BEGIN
  -- Verify permissions
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _current_user_id;

  IF _current_user_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied to team',
      'error_code', 'TEAM_ACCESS_DENIED'
    );
  END IF;

  IF _current_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only team owners and admins can remove members',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  _total_count := array_length(_user_ids, 1);

  -- Create enhanced bulk operation
  _bulk_operation_id := public.create_bulk_operation_enhanced(
    _team_id,
    'bulk_remove',
    to_jsonb(_user_ids),
    jsonb_build_object(
      'reason', _reason,
      'transfer_data', _transfer_data,
      'transfer_to_user_id', _transfer_to_user_id
    ),
    _priority,
    _batch_size,
    1, -- Single worker for member removal to avoid conflicts
    3, -- Max retries
    _total_count * 2 -- Estimated 2 seconds per removal
  );

  -- Update status to in_progress
  PERFORM public.update_bulk_operation_status(_bulk_operation_id, 'in_progress');

  -- Log validation step
  PERFORM public.log_bulk_operation_progress(
    _bulk_operation_id,
    'validation',
    'Validating member removal permissions and data',
    2,
    'in_progress',
    0,
    _total_count
  );

  -- Validate transfer user if specified
  IF _transfer_data AND _transfer_to_user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = _team_id AND user_id = _transfer_to_user_id
    ) THEN
      PERFORM public.update_bulk_operation_status(
        _bulk_operation_id,
        'failed',
        'Transfer target user is not a team member'
      );

      RETURN jsonb_build_object(
        'success', false,
        'error', 'Transfer target user is not a team member',
        'error_code', 'INVALID_TRANSFER_TARGET',
        'bulk_operation_id', _bulk_operation_id
      );
    END IF;
  END IF;

  -- Complete validation step
  PERFORM public.log_bulk_operation_progress(
    _bulk_operation_id,
    'validation',
    'Validation completed successfully',
    2,
    'completed',
    _total_count,
    _total_count
  );

  -- Process removals in batches
  WHILE _batch_start <= _total_count LOOP
    _batch_end := LEAST(_batch_start + _batch_size - 1, _total_count);
    _savepoint_name := 'batch_' || _batch_start;

    -- Log batch processing step
    PERFORM public.log_bulk_operation_progress(
      _bulk_operation_id,
      'processing_batch_' || _batch_start,
      'Processing batch ' || _batch_start || ' to ' || _batch_end,
      3,
      'in_progress',
      _processed_count,
      _total_count
    );

    -- Create savepoint for batch transaction safety
    EXECUTE 'SAVEPOINT ' || _savepoint_name;

    BEGIN
      -- Process each user in the current batch
      FOR i IN _batch_start.._batch_end LOOP
        _user_id := _user_ids[i];

        BEGIN
          -- Attempt member removal
          SELECT public.remove_team_member_enhanced(
            _team_id,
            _user_id,
            _reason,
            _transfer_data,
            _transfer_to_user_id
          ) INTO _removal_result;

          IF _removal_result->>'success' = 'true' THEN
            _success_count := _success_count + 1;
            _results := _results || jsonb_build_object(
              'user_id', _user_id,
              'status', 'success',
              'result', _removal_result
            );
          ELSE
            _failed_count := _failed_count + 1;
            _results := _results || jsonb_build_object(
              'user_id', _user_id,
              'status', 'failed',
              'error', _removal_result->>'error',
              'error_code', _removal_result->>'error_code'
            );
          END IF;

        EXCEPTION WHEN OTHERS THEN
          _failed_count := _failed_count + 1;
          _results := _results || jsonb_build_object(
            'user_id', _user_id,
            'status', 'failed',
            'error', SQLERRM,
            'error_code', SQLSTATE
          );
        END;

        _processed_count := _processed_count + 1;

        -- Update progress within batch
        IF _processed_count % 2 = 0 OR _processed_count = _total_count THEN
          PERFORM public.log_bulk_operation_progress(
            _bulk_operation_id,
            'processing_batch_' || _batch_start,
            'Processing batch ' || _batch_start || ' to ' || _batch_end,
            3,
            'in_progress',
            _processed_count,
            _total_count
          );
        END IF;
      END LOOP;

      -- Complete batch processing step
      PERFORM public.log_bulk_operation_progress(
        _bulk_operation_id,
        'processing_batch_' || _batch_start,
        'Batch ' || _batch_start || ' to ' || _batch_end || ' completed',
        3,
        'completed',
        _processed_count,
        _total_count
      );

      -- Release savepoint on successful batch
      EXECUTE 'RELEASE SAVEPOINT ' || _savepoint_name;

    EXCEPTION WHEN OTHERS THEN
      -- Rollback to savepoint on batch failure
      EXECUTE 'ROLLBACK TO SAVEPOINT ' || _savepoint_name;

      -- Log batch failure
      PERFORM public.log_bulk_operation_progress(
        _bulk_operation_id,
        'processing_batch_' || _batch_start,
        'Batch ' || _batch_start || ' to ' || _batch_end || ' failed: ' || SQLERRM,
        3,
        'failed',
        _processed_count,
        _total_count,
        SQLERRM,
        jsonb_build_object('error_code', SQLSTATE, 'batch_start', _batch_start, 'batch_end', _batch_end)
      );

      -- Mark all users in failed batch as failed
      FOR i IN _batch_start.._batch_end LOOP
        _failed_count := _failed_count + 1;
        _results := _results || jsonb_build_object(
          'user_id', _user_ids[i],
          'status', 'failed',
          'error', 'Batch processing failed: ' || SQLERRM,
          'error_code', SQLSTATE
        );
      END LOOP;

      _processed_count := _batch_end;
    END;

    _batch_start := _batch_end + 1;
  END LOOP;

  -- Update final bulk operation status
  UPDATE public.team_bulk_operations
  SET operation_status = 'completed',
      processed_items = _processed_count,
      successful_items = _success_count,
      failed_items = _failed_count,
      results = _results,
      completed_at = NOW(),
      performance_metrics = jsonb_build_object(
        'success_rate', ROUND((_success_count::NUMERIC / _total_count::NUMERIC) * 100, 2),
        'avg_processing_time_per_item',
          CASE WHEN _processed_count > 0 THEN
            ROUND(EXTRACT(EPOCH FROM (NOW() - started_at))::NUMERIC / _processed_count, 2)
          ELSE 0 END
      )
  WHERE id = _bulk_operation_id;

  -- Log completion
  PERFORM public.log_bulk_operation_progress(
    _bulk_operation_id,
    'completion',
    'Bulk member removal completed',
    4,
    'completed',
    _processed_count,
    _total_count,
    NULL,
    NULL,
    jsonb_build_object(
      'success_count', _success_count,
      'failed_count', _failed_count,
      'success_rate', ROUND((_success_count::NUMERIC / _total_count::NUMERIC) * 100, 2)
    )
  );

  -- Log audit event
  PERFORM public.log_team_audit_event(
    _team_id,
    'bulk_member_removal'::team_audit_action,
    'Bulk member removal completed: ' || _success_count || ' successful, ' || _failed_count || ' failed',
    NULL,
    '{}',
    jsonb_build_object(
      'total_removals', _total_count,
      'successful', _success_count,
      'failed', _failed_count
    ),
    jsonb_build_object(
      'bulk_operation_id', _bulk_operation_id,
      'reason', _reason,
      'transfer_data', _transfer_data
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'bulk_operation_id', _bulk_operation_id,
    'summary', jsonb_build_object(
      'total_items', _total_count,
      'successful_items', _success_count,
      'failed_items', _failed_count,
      'success_rate', ROUND((_success_count::NUMERIC / _total_count::NUMERIC) * 100, 2)
    ),
    'results', _results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. ENHANCED BULK ROLE UPDATE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.bulk_update_member_roles_enhanced(
  _team_id UUID,
  _role_updates JSONB, -- Array of {user_id, new_role, reason}
  _global_reason TEXT DEFAULT NULL,
  _batch_size INTEGER DEFAULT 10,
  _priority INTEGER DEFAULT 5
) RETURNS JSONB AS $$
DECLARE
  _current_user_id UUID := auth.uid();
  _current_user_role public.team_member_role;
  _bulk_operation_id UUID;
  _update_data JSONB;
  _update_result JSONB;
  _results JSONB := '[]';
  _success_count INTEGER := 0;
  _failed_count INTEGER := 0;
  _processed_count INTEGER := 0;
  _total_count INTEGER;
  _batch_start INTEGER := 1;
  _batch_end INTEGER;
  _savepoint_name TEXT;
  _member_record RECORD;
  _target_user_id UUID;
  _new_role public.team_member_role;
  _update_reason TEXT;
BEGIN
  -- Verify permissions
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _current_user_id;

  IF _current_user_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied to team',
      'error_code', 'TEAM_ACCESS_DENIED'
    );
  END IF;

  IF _current_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only team owners and admins can update member roles',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  _total_count := jsonb_array_length(_role_updates);

  -- Create enhanced bulk operation
  _bulk_operation_id := public.create_bulk_operation_enhanced(
    _team_id,
    'bulk_role_update',
    _role_updates,
    jsonb_build_object('global_reason', _global_reason),
    _priority,
    _batch_size,
    1, -- Single worker for role updates to avoid conflicts
    3, -- Max retries
    _total_count * 1 -- Estimated 1 second per role update
  );

  -- Update status to in_progress
  PERFORM public.update_bulk_operation_status(_bulk_operation_id, 'in_progress');

  -- Log validation step
  PERFORM public.log_bulk_operation_progress(
    _bulk_operation_id,
    'validation',
    'Validating role update permissions and data',
    2,
    'in_progress',
    0,
    _total_count
  );

  -- Validate all role updates first
  FOR i IN 0..(_total_count - 1) LOOP
    _update_data := _role_updates->i;
    _target_user_id := (_update_data->>'user_id')::UUID;
    _new_role := (_update_data->>'new_role')::public.team_member_role;

    -- Check if target user exists in team
    SELECT tm.*, au.email, p.first_name, p.last_name INTO _member_record
    FROM public.team_members tm
    JOIN auth.users au ON tm.user_id = au.id
    LEFT JOIN public.profiles p ON au.id = p.id
    WHERE tm.team_id = _team_id AND tm.user_id = _target_user_id;

    IF _member_record.id IS NULL THEN
      PERFORM public.update_bulk_operation_status(
        _bulk_operation_id,
        'failed',
        'User ' || _target_user_id || ' is not a team member'
      );

      RETURN jsonb_build_object(
        'success', false,
        'error', 'User ' || _target_user_id || ' is not a team member',
        'error_code', 'USER_NOT_FOUND',
        'bulk_operation_id', _bulk_operation_id
      );
    END IF;

    -- Validate role change permissions
    IF _current_user_role = 'admin' AND _member_record.role = 'owner' THEN
      PERFORM public.update_bulk_operation_status(
        _bulk_operation_id,
        'failed',
        'Admins cannot change owner roles'
      );

      RETURN jsonb_build_object(
        'success', false,
        'error', 'Admins cannot change owner roles',
        'error_code', 'INSUFFICIENT_PERMISSIONS',
        'bulk_operation_id', _bulk_operation_id
      );
    END IF;

    IF _current_user_role = 'admin' AND _new_role = 'owner' THEN
      PERFORM public.update_bulk_operation_status(
        _bulk_operation_id,
        'failed',
        'Admins cannot promote members to owner'
      );

      RETURN jsonb_build_object(
        'success', false,
        'error', 'Admins cannot promote members to owner',
        'error_code', 'INSUFFICIENT_PERMISSIONS',
        'bulk_operation_id', _bulk_operation_id
      );
    END IF;
  END LOOP;

  -- Complete validation step
  PERFORM public.log_bulk_operation_progress(
    _bulk_operation_id,
    'validation',
    'Validation completed successfully',
    2,
    'completed',
    _total_count,
    _total_count
  );

  -- Process role updates in batches
  WHILE _batch_start <= _total_count LOOP
    _batch_end := LEAST(_batch_start + _batch_size - 1, _total_count);
    _savepoint_name := 'role_batch_' || _batch_start;

    -- Log batch processing step
    PERFORM public.log_bulk_operation_progress(
      _bulk_operation_id,
      'processing_batch_' || _batch_start,
      'Processing role update batch ' || _batch_start || ' to ' || _batch_end,
      3,
      'in_progress',
      _processed_count,
      _total_count
    );

    -- Create savepoint for batch transaction safety
    EXECUTE 'SAVEPOINT ' || _savepoint_name;

    BEGIN
      -- Process each role update in the current batch
      FOR i IN (_batch_start - 1)..(_batch_end - 1) LOOP
        _update_data := _role_updates->i;
        _target_user_id := (_update_data->>'user_id')::UUID;
        _new_role := (_update_data->>'new_role')::public.team_member_role;
        _update_reason := COALESCE(_update_data->>'reason', _global_reason);

        BEGIN
          -- Get current member info
          SELECT tm.*, au.email, p.first_name, p.last_name INTO _member_record
          FROM public.team_members tm
          JOIN auth.users au ON tm.user_id = au.id
          LEFT JOIN public.profiles p ON au.id = p.id
          WHERE tm.team_id = _team_id AND tm.user_id = _target_user_id;

          -- Update the role
          UPDATE public.team_members
          SET role = _new_role,
              updated_at = NOW()
          WHERE team_id = _team_id AND user_id = _target_user_id;

          -- Log individual role change
          PERFORM public.log_team_audit_event(
            _team_id,
            'member_role_updated'::team_audit_action,
            'Member role updated from ' || _member_record.role || ' to ' || _new_role,
            _target_user_id,
            jsonb_build_object('role', _member_record.role),
            jsonb_build_object('role', _new_role),
            jsonb_build_object(
              'reason', _update_reason,
              'bulk_operation_id', _bulk_operation_id,
              'updated_by', _current_user_id
            )
          );

          _success_count := _success_count + 1;
          _results := _results || jsonb_build_object(
            'user_id', _target_user_id,
            'email', _member_record.email,
            'full_name', COALESCE(_member_record.first_name || ' ' || _member_record.last_name, _member_record.email),
            'old_role', _member_record.role,
            'new_role', _new_role,
            'status', 'success',
            'reason', _update_reason
          );

        EXCEPTION WHEN OTHERS THEN
          _failed_count := _failed_count + 1;
          _results := _results || jsonb_build_object(
            'user_id', _target_user_id,
            'status', 'failed',
            'error', SQLERRM,
            'error_code', SQLSTATE
          );
        END;

        _processed_count := _processed_count + 1;

        -- Update progress within batch
        IF _processed_count % 5 = 0 OR _processed_count = _total_count THEN
          PERFORM public.log_bulk_operation_progress(
            _bulk_operation_id,
            'processing_batch_' || _batch_start,
            'Processing role update batch ' || _batch_start || ' to ' || _batch_end,
            3,
            'in_progress',
            _processed_count,
            _total_count
          );
        END IF;
      END LOOP;

      -- Complete batch processing step
      PERFORM public.log_bulk_operation_progress(
        _bulk_operation_id,
        'processing_batch_' || _batch_start,
        'Role update batch ' || _batch_start || ' to ' || _batch_end || ' completed',
        3,
        'completed',
        _processed_count,
        _total_count
      );

      -- Release savepoint on successful batch
      EXECUTE 'RELEASE SAVEPOINT ' || _savepoint_name;

    EXCEPTION WHEN OTHERS THEN
      -- Rollback to savepoint on batch failure
      EXECUTE 'ROLLBACK TO SAVEPOINT ' || _savepoint_name;

      -- Log batch failure
      PERFORM public.log_bulk_operation_progress(
        _bulk_operation_id,
        'processing_batch_' || _batch_start,
        'Role update batch ' || _batch_start || ' to ' || _batch_end || ' failed: ' || SQLERRM,
        3,
        'failed',
        _processed_count,
        _total_count,
        SQLERRM,
        jsonb_build_object('error_code', SQLSTATE, 'batch_start', _batch_start, 'batch_end', _batch_end)
      );

      -- Mark all updates in failed batch as failed
      FOR i IN (_batch_start - 1)..(_batch_end - 1) LOOP
        _update_data := _role_updates->i;
        _failed_count := _failed_count + 1;
        _results := _results || jsonb_build_object(
          'user_id', (_update_data->>'user_id')::UUID,
          'status', 'failed',
          'error', 'Batch processing failed: ' || SQLERRM,
          'error_code', SQLSTATE
        );
      END LOOP;

      _processed_count := _batch_end;
    END;

    _batch_start := _batch_end + 1;
  END LOOP;

  -- Update final bulk operation status
  UPDATE public.team_bulk_operations
  SET operation_status = 'completed',
      processed_items = _processed_count,
      successful_items = _success_count,
      failed_items = _failed_count,
      results = _results,
      completed_at = NOW(),
      performance_metrics = jsonb_build_object(
        'success_rate', ROUND((_success_count::NUMERIC / _total_count::NUMERIC) * 100, 2),
        'avg_processing_time_per_item',
          CASE WHEN _processed_count > 0 THEN
            ROUND(EXTRACT(EPOCH FROM (NOW() - started_at))::NUMERIC / _processed_count, 2)
          ELSE 0 END
      )
  WHERE id = _bulk_operation_id;

  -- Log completion
  PERFORM public.log_bulk_operation_progress(
    _bulk_operation_id,
    'completion',
    'Bulk role update completed',
    4,
    'completed',
    _processed_count,
    _total_count,
    NULL,
    NULL,
    jsonb_build_object(
      'success_count', _success_count,
      'failed_count', _failed_count,
      'success_rate', ROUND((_success_count::NUMERIC / _total_count::NUMERIC) * 100, 2)
    )
  );

  -- Log audit event
  PERFORM public.log_team_audit_event(
    _team_id,
    'bulk_role_update'::team_audit_action,
    'Bulk role update completed: ' || _success_count || ' successful, ' || _failed_count || ' failed',
    NULL,
    '{}',
    jsonb_build_object(
      'total_updates', _total_count,
      'successful', _success_count,
      'failed', _failed_count
    ),
    jsonb_build_object(
      'bulk_operation_id', _bulk_operation_id,
      'global_reason', _global_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'bulk_operation_id', _bulk_operation_id,
    'summary', jsonb_build_object(
      'total_items', _total_count,
      'successful_items', _success_count,
      'failed_items', _failed_count,
      'success_rate', ROUND((_success_count::NUMERIC / _total_count::NUMERIC) * 100, 2)
    ),
    'results', _results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. ENHANCED BULK INVITE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.bulk_invite_team_members_enhanced(
  _team_id UUID,
  _invitations JSONB, -- Array of {email, role, custom_message, permissions}
  _default_role public.team_member_role DEFAULT 'member',
  _expires_in_days INTEGER DEFAULT 7,
  _send_emails BOOLEAN DEFAULT true,
  _batch_size INTEGER DEFAULT 5,
  _priority INTEGER DEFAULT 5
) RETURNS JSONB AS $$
DECLARE
  _current_user_id UUID := auth.uid();
  _current_user_role public.team_member_role;
  _bulk_operation_id UUID;
  _invitation_data JSONB;
  _invitation_result JSONB;
  _results JSONB := '[]';
  _success_count INTEGER := 0;
  _failed_count INTEGER := 0;
  _processed_count INTEGER := 0;
  _total_count INTEGER;
  _batch_start INTEGER := 1;
  _batch_end INTEGER;
  _savepoint_name TEXT;
  _email TEXT;
  _role public.team_member_role;
  _custom_message TEXT;
  _permissions JSONB;
  _rate_limit_check JSONB;
BEGIN
  -- Verify permissions
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _current_user_id;

  IF _current_user_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied to team',
      'error_code', 'TEAM_ACCESS_DENIED'
    );
  END IF;

  IF _current_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only team owners and admins can invite members',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  _total_count := jsonb_array_length(_invitations);

  -- Check rate limits
  SELECT public.check_invitation_rate_limit(_team_id, _current_user_id, _total_count) INTO _rate_limit_check;

  IF _rate_limit_check->>'success' = 'false' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', _rate_limit_check->>'error',
      'error_code', _rate_limit_check->>'error_code'
    );
  END IF;

  -- Create enhanced bulk operation
  _bulk_operation_id := public.create_bulk_operation_enhanced(
    _team_id,
    'bulk_invite',
    _invitations,
    jsonb_build_object(
      'default_role', _default_role,
      'expires_in_days', _expires_in_days,
      'send_emails', _send_emails
    ),
    _priority,
    _batch_size,
    1, -- Single worker for invitations to avoid rate limit issues
    3, -- Max retries
    _total_count * 3 -- Estimated 3 seconds per invitation (including email sending)
  );

  -- Update status to in_progress
  PERFORM public.update_bulk_operation_status(_bulk_operation_id, 'in_progress');

  -- Log validation step
  PERFORM public.log_bulk_operation_progress(
    _bulk_operation_id,
    'validation',
    'Validating invitation data and checking duplicates',
    2,
    'in_progress',
    0,
    _total_count
  );

  -- Validate all invitations first
  FOR i IN 0..(_total_count - 1) LOOP
    _invitation_data := _invitations->i;
    _email := _invitation_data->>'email';

    -- Check for valid email format (basic check)
    IF _email IS NULL OR _email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      PERFORM public.update_bulk_operation_status(
        _bulk_operation_id,
        'failed',
        'Invalid email format: ' || COALESCE(_email, 'null')
      );

      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid email format: ' || COALESCE(_email, 'null'),
        'error_code', 'INVALID_EMAIL_FORMAT',
        'bulk_operation_id', _bulk_operation_id
      );
    END IF;

    -- Check if user is already a team member
    IF EXISTS (
      SELECT 1 FROM public.team_members tm
      JOIN auth.users au ON tm.user_id = au.id
      WHERE tm.team_id = _team_id AND au.email = _email
    ) THEN
      PERFORM public.update_bulk_operation_status(
        _bulk_operation_id,
        'failed',
        'User ' || _email || ' is already a team member'
      );

      RETURN jsonb_build_object(
        'success', false,
        'error', 'User ' || _email || ' is already a team member',
        'error_code', 'USER_ALREADY_MEMBER',
        'bulk_operation_id', _bulk_operation_id
      );
    END IF;

    -- Check for pending invitations
    IF EXISTS (
      SELECT 1 FROM public.team_invitations
      WHERE team_id = _team_id AND email = _email AND status = 'pending'
    ) THEN
      PERFORM public.update_bulk_operation_status(
        _bulk_operation_id,
        'failed',
        'Pending invitation already exists for ' || _email
      );

      RETURN jsonb_build_object(
        'success', false,
        'error', 'Pending invitation already exists for ' || _email,
        'error_code', 'INVITATION_ALREADY_EXISTS',
        'bulk_operation_id', _bulk_operation_id
      );
    END IF;
  END LOOP;

  -- Complete validation step
  PERFORM public.log_bulk_operation_progress(
    _bulk_operation_id,
    'validation',
    'Validation completed successfully',
    2,
    'completed',
    _total_count,
    _total_count
  );

  -- Process invitations in batches
  WHILE _batch_start <= _total_count LOOP
    _batch_end := LEAST(_batch_start + _batch_size - 1, _total_count);
    _savepoint_name := 'invite_batch_' || _batch_start;

    -- Log batch processing step
    PERFORM public.log_bulk_operation_progress(
      _bulk_operation_id,
      'processing_batch_' || _batch_start,
      'Processing invitation batch ' || _batch_start || ' to ' || _batch_end,
      3,
      'in_progress',
      _processed_count,
      _total_count
    );

    -- Create savepoint for batch transaction safety
    EXECUTE 'SAVEPOINT ' || _savepoint_name;

    BEGIN
      -- Process each invitation in the current batch
      FOR i IN (_batch_start - 1)..(_batch_end - 1) LOOP
        _invitation_data := _invitations->i;
        _email := _invitation_data->>'email';
        _role := COALESCE((_invitation_data->>'role')::public.team_member_role, _default_role);
        _custom_message := _invitation_data->>'custom_message';
        _permissions := COALESCE(_invitation_data->'permissions', '{}');

        BEGIN
          -- Send enhanced invitation
          SELECT public.invite_team_member_enhanced(
            _team_id,
            _email,
            _role,
            _custom_message,
            _permissions,
            _expires_in_days,
            _send_emails
          ) INTO _invitation_result;

          IF _invitation_result->>'success' = 'true' THEN
            _success_count := _success_count + 1;
            _results := _results || jsonb_build_object(
              'email', _email,
              'role', _role,
              'status', 'success',
              'invitation_id', _invitation_result->>'invitation_id',
              'expires_at', _invitation_result->>'expires_at'
            );
          ELSE
            _failed_count := _failed_count + 1;
            _results := _results || jsonb_build_object(
              'email', _email,
              'role', _role,
              'status', 'failed',
              'error', _invitation_result->>'error',
              'error_code', _invitation_result->>'error_code'
            );
          END IF;

        EXCEPTION WHEN OTHERS THEN
          _failed_count := _failed_count + 1;
          _results := _results || jsonb_build_object(
            'email', _email,
            'role', _role,
            'status', 'failed',
            'error', SQLERRM,
            'error_code', SQLSTATE
          );
        END;

        _processed_count := _processed_count + 1;

        -- Update progress within batch
        IF _processed_count % 2 = 0 OR _processed_count = _total_count THEN
          PERFORM public.log_bulk_operation_progress(
            _bulk_operation_id,
            'processing_batch_' || _batch_start,
            'Processing invitation batch ' || _batch_start || ' to ' || _batch_end,
            3,
            'in_progress',
            _processed_count,
            _total_count
          );
        END IF;
      END LOOP;

      -- Complete batch processing step
      PERFORM public.log_bulk_operation_progress(
        _bulk_operation_id,
        'processing_batch_' || _batch_start,
        'Invitation batch ' || _batch_start || ' to ' || _batch_end || ' completed',
        3,
        'completed',
        _processed_count,
        _total_count
      );

      -- Release savepoint on successful batch
      EXECUTE 'RELEASE SAVEPOINT ' || _savepoint_name;

    EXCEPTION WHEN OTHERS THEN
      -- Rollback to savepoint on batch failure
      EXECUTE 'ROLLBACK TO SAVEPOINT ' || _savepoint_name;

      -- Log batch failure
      PERFORM public.log_bulk_operation_progress(
        _bulk_operation_id,
        'processing_batch_' || _batch_start,
        'Invitation batch ' || _batch_start || ' to ' || _batch_end || ' failed: ' || SQLERRM,
        3,
        'failed',
        _processed_count,
        _total_count,
        SQLERRM,
        jsonb_build_object('error_code', SQLSTATE, 'batch_start', _batch_start, 'batch_end', _batch_end)
      );

      -- Mark all invitations in failed batch as failed
      FOR i IN (_batch_start - 1)..(_batch_end - 1) LOOP
        _invitation_data := _invitations->i;
        _failed_count := _failed_count + 1;
        _results := _results || jsonb_build_object(
          'email', _invitation_data->>'email',
          'role', COALESCE((_invitation_data->>'role')::public.team_member_role, _default_role),
          'status', 'failed',
          'error', 'Batch processing failed: ' || SQLERRM,
          'error_code', SQLSTATE
        );
      END LOOP;

      _processed_count := _batch_end;
    END;

    _batch_start := _batch_end + 1;
  END LOOP;

  -- Update final bulk operation status
  UPDATE public.team_bulk_operations
  SET operation_status = 'completed',
      processed_items = _processed_count,
      successful_items = _success_count,
      failed_items = _failed_count,
      results = _results,
      completed_at = NOW(),
      performance_metrics = jsonb_build_object(
        'success_rate', ROUND((_success_count::NUMERIC / _total_count::NUMERIC) * 100, 2),
        'avg_processing_time_per_item',
          CASE WHEN _processed_count > 0 THEN
            ROUND(EXTRACT(EPOCH FROM (NOW() - started_at))::NUMERIC / _processed_count, 2)
          ELSE 0 END
      )
  WHERE id = _bulk_operation_id;

  -- Log completion
  PERFORM public.log_bulk_operation_progress(
    _bulk_operation_id,
    'completion',
    'Bulk invitation completed',
    4,
    'completed',
    _processed_count,
    _total_count,
    NULL,
    NULL,
    jsonb_build_object(
      'success_count', _success_count,
      'failed_count', _failed_count,
      'success_rate', ROUND((_success_count::NUMERIC / _total_count::NUMERIC) * 100, 2)
    )
  );

  -- Log audit event
  PERFORM public.log_team_audit_event(
    _team_id,
    'bulk_invitation'::team_audit_action,
    'Bulk invitation completed: ' || _success_count || ' successful, ' || _failed_count || ' failed',
    NULL,
    '{}',
    jsonb_build_object(
      'total_invitations', _total_count,
      'successful', _success_count,
      'failed', _failed_count
    ),
    jsonb_build_object(
      'bulk_operation_id', _bulk_operation_id,
      'default_role', _default_role,
      'expires_in_days', _expires_in_days
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'bulk_operation_id', _bulk_operation_id,
    'summary', jsonb_build_object(
      'total_items', _total_count,
      'successful_items', _success_count,
      'failed_items', _failed_count,
      'success_rate', ROUND((_success_count::NUMERIC / _total_count::NUMERIC) * 100, 2)
    ),
    'results', _results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. FUNCTION COMMENTS AND PERMISSIONS
-- ============================================================================

COMMENT ON FUNCTION public.log_bulk_operation_progress IS 'Log detailed progress for bulk operations with step tracking and metrics';
COMMENT ON FUNCTION public.update_bulk_operation_status IS 'Update bulk operation status with enhanced tracking and performance metrics';
COMMENT ON FUNCTION public.create_bulk_operation_enhanced IS 'Create bulk operation with enhanced configuration and progress tracking';
COMMENT ON FUNCTION public.bulk_remove_team_members_enhanced IS 'Enhanced bulk member removal with transaction safety and detailed progress tracking';
COMMENT ON FUNCTION public.bulk_update_member_roles_enhanced IS 'Enhanced bulk role update with batch processing and comprehensive validation';
COMMENT ON FUNCTION public.bulk_invite_team_members_enhanced IS 'Enhanced bulk invitation with rate limiting, validation, and progress tracking';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.log_bulk_operation_progress TO service_role;
GRANT EXECUTE ON FUNCTION public.update_bulk_operation_status TO service_role;
GRANT EXECUTE ON FUNCTION public.create_bulk_operation_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_remove_team_members_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_update_member_roles_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_invite_team_members_enhanced TO authenticated;

-- Enable RLS on new table
ALTER TABLE public.bulk_operation_progress ENABLE ROW LEVEL SECURITY;

-- Policy for bulk operation progress - team members can view progress for their team operations
CREATE POLICY "Team members can view bulk operation progress" ON public.bulk_operation_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_bulk_operations tbo
      JOIN public.team_members tm ON tm.team_id = tbo.team_id
      WHERE tbo.id = bulk_operation_progress.bulk_operation_id
        AND tm.user_id = auth.uid()
    )
  );

-- Policy for system to manage progress (service_role)
CREATE POLICY "System can manage bulk operation progress" ON public.bulk_operation_progress
  FOR ALL TO service_role USING (true);
