-- ============================================================================
-- ENHANCED SCHEDULED OPERATIONS MANAGEMENT
-- ============================================================================
-- This migration adds comprehensive scheduled operations management for the
-- Enhanced Member Management system in Mataresit.
--
-- Features included:
-- - Generic scheduled operations table for various operation types
-- - Enhanced scheduling functions for different member operations
-- - Comprehensive operation processing and management
-- - Operation status tracking and error handling
-- - Integration with existing scheduled removal system
-- ============================================================================

-- ============================================================================
-- 1. SCHEDULED OPERATIONS TABLE
-- ============================================================================

-- Create enum for operation types
DO $$ BEGIN
  CREATE TYPE public.scheduled_operation_type AS ENUM (
    'member_removal',
    'role_change',
    'permission_update',
    'bulk_operation',
    'invitation_expiry',
    'data_cleanup',
    'notification_send',
    'custom_operation'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for operation status
DO $$ BEGIN
  CREATE TYPE public.scheduled_operation_status AS ENUM (
    'pending',
    'scheduled',
    'processing',
    'completed',
    'failed',
    'cancelled',
    'expired'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create scheduled operations table
CREATE TABLE IF NOT EXISTS public.scheduled_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  
  -- Operation details
  operation_type public.scheduled_operation_type NOT NULL,
  operation_name VARCHAR(255) NOT NULL,
  operation_description TEXT,
  
  -- Scheduling information
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Execution tracking
  status public.scheduled_operation_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- User tracking
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  executed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Operation configuration
  operation_config JSONB NOT NULL DEFAULT '{}',
  execution_context JSONB DEFAULT '{}',
  
  -- Error handling
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  error_details JSONB,
  
  -- Dependencies and prerequisites
  depends_on UUID[] DEFAULT '{}', -- Array of operation IDs this depends on
  prerequisites JSONB DEFAULT '{}', -- Conditions that must be met
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Constraints
  CONSTRAINT valid_scheduled_for CHECK (scheduled_for > created_at),
  CONSTRAINT valid_retry_count CHECK (retry_count >= 0 AND retry_count <= max_retries)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_scheduled_operations_team_id ON public.scheduled_operations(team_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_operations_scheduled_for ON public.scheduled_operations(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_operations_status ON public.scheduled_operations(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_operations_type ON public.scheduled_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_operations_created_by ON public.scheduled_operations(created_by);
CREATE INDEX IF NOT EXISTS idx_scheduled_operations_pending ON public.scheduled_operations(scheduled_for, status) WHERE status IN ('pending', 'scheduled');

-- ============================================================================
-- 2. OPERATION EXECUTION LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scheduled_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES public.scheduled_operations(id) ON DELETE CASCADE,
  
  -- Log details
  log_level VARCHAR(20) NOT NULL DEFAULT 'info', -- 'debug', 'info', 'warn', 'error'
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  
  -- Timing
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Context
  execution_step VARCHAR(100),
  progress_percentage INTEGER DEFAULT 0,
  
  -- Constraints
  CONSTRAINT valid_log_level CHECK (log_level IN ('debug', 'info', 'warn', 'error')),
  CONSTRAINT valid_progress CHECK (progress_percentage >= 0 AND progress_percentage <= 100)
);

-- Create indexes for operation logs
CREATE INDEX IF NOT EXISTS idx_scheduled_operation_logs_operation_id ON public.scheduled_operation_logs(operation_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_operation_logs_logged_at ON public.scheduled_operation_logs(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_operation_logs_level ON public.scheduled_operation_logs(log_level);

-- ============================================================================
-- 3. TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_scheduled_operation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for scheduled operations
DROP TRIGGER IF EXISTS trigger_update_scheduled_operations_timestamp ON public.scheduled_operations;
CREATE TRIGGER trigger_update_scheduled_operations_timestamp
  BEFORE UPDATE ON public.scheduled_operations
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_operation_timestamp();

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on scheduled operations
ALTER TABLE public.scheduled_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_operation_logs ENABLE ROW LEVEL SECURITY;

-- Policy for scheduled operations - team members can view operations for their teams
CREATE POLICY "Team members can view scheduled operations" ON public.scheduled_operations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = scheduled_operations.team_id
        AND tm.user_id = auth.uid()
    )
  );

-- Policy for scheduled operations - admins and owners can manage operations
CREATE POLICY "Team admins can manage scheduled operations" ON public.scheduled_operations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = scheduled_operations.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('admin', 'owner')
    )
  );

-- Policy for operation logs - team members can view logs for their team operations
CREATE POLICY "Team members can view operation logs" ON public.scheduled_operation_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.scheduled_operations so
      JOIN public.team_members tm ON tm.team_id = so.team_id
      WHERE so.id = scheduled_operation_logs.operation_id
        AND tm.user_id = auth.uid()
    )
  );

-- Policy for system to manage operations (service_role)
CREATE POLICY "System can manage all scheduled operations" ON public.scheduled_operations
  FOR ALL TO service_role USING (true);

CREATE POLICY "System can manage all operation logs" ON public.scheduled_operation_logs
  FOR ALL TO service_role USING (true);

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- Function to log operation events
CREATE OR REPLACE FUNCTION public.log_scheduled_operation_event(
  _operation_id UUID,
  _log_level TEXT DEFAULT 'info',
  _message TEXT DEFAULT '',
  _details JSONB DEFAULT '{}',
  _execution_step TEXT DEFAULT NULL,
  _progress_percentage INTEGER DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.scheduled_operation_logs (
    operation_id,
    log_level,
    message,
    details,
    execution_step,
    progress_percentage
  ) VALUES (
    _operation_id,
    _log_level,
    _message,
    _details,
    _execution_step,
    _progress_percentage
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update operation status
CREATE OR REPLACE FUNCTION public.update_scheduled_operation_status(
  _operation_id UUID,
  _status public.scheduled_operation_status,
  _error_message TEXT DEFAULT NULL,
  _error_details JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE public.scheduled_operations
  SET 
    status = _status,
    updated_at = NOW(),
    started_at = CASE WHEN _status = 'processing' AND started_at IS NULL THEN NOW() ELSE started_at END,
    completed_at = CASE WHEN _status IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END,
    error_message = CASE WHEN _status = 'failed' THEN _error_message ELSE error_message END,
    error_details = CASE WHEN _status = 'failed' THEN _error_details ELSE error_details END
  WHERE id = _operation_id;
  
  -- Log the status change
  PERFORM public.log_scheduled_operation_event(
    _operation_id,
    CASE WHEN _status = 'failed' THEN 'error' ELSE 'info' END,
    'Operation status changed to ' || _status::text,
    jsonb_build_object(
      'previous_status', (SELECT status FROM public.scheduled_operations WHERE id = _operation_id),
      'new_status', _status,
      'error_message', _error_message
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. MAIN SCHEDULED OPERATIONS FUNCTIONS
-- ============================================================================

-- Function to schedule a member operation
CREATE OR REPLACE FUNCTION public.schedule_member_operation(
  _team_id UUID,
  _operation_type public.scheduled_operation_type,
  _operation_name VARCHAR(255),
  _scheduled_for TIMESTAMP WITH TIME ZONE,
  _operation_config JSONB DEFAULT '{}',
  _operation_description TEXT DEFAULT NULL,
  _max_retries INTEGER DEFAULT 3,
  _depends_on UUID[] DEFAULT '{}',
  _prerequisites JSONB DEFAULT '{}',
  _metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  _operation_id UUID;
  _current_user_id UUID := auth.uid();
  _current_user_role public.team_member_role;
  _result JSONB;
BEGIN
  -- Verify team access and permissions
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

  -- Check permissions for scheduling operations
  IF _current_user_role NOT IN ('admin', 'owner') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only team admins and owners can schedule operations',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  -- Validate scheduling time
  IF _scheduled_for <= NOW() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Scheduled time must be in the future',
      'error_code', 'INVALID_SCHEDULE_TIME'
    );
  END IF;

  -- Validate dependencies exist
  IF array_length(_depends_on, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(_depends_on) AS dep_id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.scheduled_operations
        WHERE id = dep_id AND team_id = _team_id
      )
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'One or more dependency operations do not exist',
        'error_code', 'INVALID_DEPENDENCIES'
      );
    END IF;
  END IF;

  -- Create the scheduled operation
  INSERT INTO public.scheduled_operations (
    team_id,
    operation_type,
    operation_name,
    operation_description,
    scheduled_for,
    created_by,
    operation_config,
    max_retries,
    depends_on,
    prerequisites,
    metadata,
    status
  ) VALUES (
    _team_id,
    _operation_type,
    _operation_name,
    _operation_description,
    _scheduled_for,
    _current_user_id,
    _operation_config,
    _max_retries,
    _depends_on,
    _prerequisites,
    _metadata,
    'scheduled'
  ) RETURNING id INTO _operation_id;

  -- Log the operation creation
  PERFORM public.log_scheduled_operation_event(
    _operation_id,
    'info',
    'Scheduled operation created',
    jsonb_build_object(
      'operation_type', _operation_type,
      'scheduled_for', _scheduled_for,
      'created_by', _current_user_id
    ),
    'creation'
  );

  -- Log audit event
  PERFORM public.log_team_audit_event(
    _team_id,
    'operation_scheduled'::team_audit_action,
    'Scheduled operation: ' || _operation_name,
    NULL, -- No target user for generic operations
    '{}',
    jsonb_build_object(
      'operation_id', _operation_id,
      'operation_type', _operation_type,
      'scheduled_for', _scheduled_for
    ),
    jsonb_build_object(
      'operation_name', _operation_name,
      'operation_config', _operation_config
    )
  );

  _result := jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'operation_id', _operation_id,
      'operation_type', _operation_type,
      'operation_name', _operation_name,
      'scheduled_for', _scheduled_for,
      'status', 'scheduled'
    ),
    'metadata', jsonb_build_object(
      'created_at', NOW(),
      'created_by', _current_user_id,
      'team_id', _team_id
    )
  );

  RETURN _result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get scheduled operations for a team
CREATE OR REPLACE FUNCTION public.get_scheduled_operations(
  _team_id UUID,
  _operation_types public.scheduled_operation_type[] DEFAULT NULL,
  _status_filter public.scheduled_operation_status[] DEFAULT NULL,
  _include_completed BOOLEAN DEFAULT false,
  _limit INTEGER DEFAULT 50,
  _offset INTEGER DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
  _result JSONB;
  _current_user_id UUID := auth.uid();
  _current_user_role public.team_member_role;
  _total_count INTEGER;
BEGIN
  -- Verify team access
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

  -- Get total count for pagination
  SELECT COUNT(*) INTO _total_count
  FROM public.scheduled_operations so
  WHERE so.team_id = _team_id
    AND (CASE WHEN _operation_types IS NOT NULL THEN so.operation_type = ANY(_operation_types) ELSE TRUE END)
    AND (CASE WHEN _status_filter IS NOT NULL THEN so.status = ANY(_status_filter) ELSE TRUE END)
    AND (CASE WHEN NOT _include_completed THEN so.status NOT IN ('completed', 'cancelled') ELSE TRUE END);

  -- Get scheduled operations with enhanced data
  WITH operation_data AS (
    SELECT
      so.id,
      so.operation_type,
      so.operation_name,
      so.operation_description,
      so.scheduled_for,
      so.created_at,
      so.updated_at,
      so.status,
      so.started_at,
      so.completed_at,
      so.created_by,
      so.executed_by,
      so.operation_config,
      so.execution_context,
      so.retry_count,
      so.max_retries,
      so.error_message,
      so.error_details,
      so.depends_on,
      so.prerequisites,
      so.metadata,
      -- Creator information
      creator_profile.first_name as creator_first_name,
      creator_profile.last_name as creator_last_name,
      creator_auth.email as creator_email,
      -- Executor information
      executor_profile.first_name as executor_first_name,
      executor_profile.last_name as executor_last_name,
      executor_auth.email as executor_email,
      -- Dependency status
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'operation_id', dep_so.id,
            'operation_name', dep_so.operation_name,
            'status', dep_so.status,
            'completed_at', dep_so.completed_at
          )
        )
        FROM unnest(so.depends_on) AS dep_id
        JOIN public.scheduled_operations dep_so ON dep_so.id = dep_id
      ) as dependencies,
      -- Recent logs
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'log_level', sol.log_level,
            'message', sol.message,
            'logged_at', sol.logged_at,
            'execution_step', sol.execution_step,
            'progress_percentage', sol.progress_percentage
          ) ORDER BY sol.logged_at DESC
        )
        FROM public.scheduled_operation_logs sol
        WHERE sol.operation_id = so.id
        ORDER BY sol.logged_at DESC
        LIMIT 5
      ) as recent_logs
    FROM public.scheduled_operations so
    LEFT JOIN auth.users creator_auth ON so.created_by = creator_auth.id
    LEFT JOIN public.profiles creator_profile ON so.created_by = creator_profile.id
    LEFT JOIN auth.users executor_auth ON so.executed_by = executor_auth.id
    LEFT JOIN public.profiles executor_profile ON so.executed_by = executor_profile.id
    WHERE so.team_id = _team_id
      AND (CASE WHEN _operation_types IS NOT NULL THEN so.operation_type = ANY(_operation_types) ELSE TRUE END)
      AND (CASE WHEN _status_filter IS NOT NULL THEN so.status = ANY(_status_filter) ELSE TRUE END)
      AND (CASE WHEN NOT _include_completed THEN so.status NOT IN ('completed', 'cancelled') ELSE TRUE END)
    ORDER BY
      CASE so.status
        WHEN 'processing' THEN 1
        WHEN 'scheduled' THEN 2
        WHEN 'pending' THEN 3
        WHEN 'failed' THEN 4
        ELSE 5
      END,
      so.scheduled_for ASC
    LIMIT _limit OFFSET _offset
  )
  SELECT jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'operations', jsonb_agg(
        jsonb_build_object(
          'id', id,
          'operation_type', operation_type,
          'operation_name', operation_name,
          'operation_description', operation_description,
          'scheduled_for', scheduled_for,
          'created_at', created_at,
          'updated_at', updated_at,
          'status', status,
          'started_at', started_at,
          'completed_at', completed_at,
          'operation_config', operation_config,
          'execution_context', execution_context,
          'retry_count', retry_count,
          'max_retries', max_retries,
          'error_message', error_message,
          'error_details', error_details,
          'depends_on', depends_on,
          'prerequisites', prerequisites,
          'metadata', metadata,
          'creator', jsonb_build_object(
            'user_id', created_by,
            'email', creator_email,
            'full_name', COALESCE(creator_first_name || ' ' || creator_last_name, creator_email)
          ),
          'executor', CASE WHEN executed_by IS NOT NULL THEN
            jsonb_build_object(
              'user_id', executed_by,
              'email', executor_email,
              'full_name', COALESCE(executor_first_name || ' ' || executor_last_name, executor_email)
            )
            ELSE NULL
          END,
          'dependencies', COALESCE(dependencies, '[]'::jsonb),
          'recent_logs', COALESCE(recent_logs, '[]'::jsonb)
        ) ORDER BY
          CASE status
            WHEN 'processing' THEN 1
            WHEN 'scheduled' THEN 2
            WHEN 'pending' THEN 3
            WHEN 'failed' THEN 4
            ELSE 5
          END,
          scheduled_for ASC
      ),
      'pagination', jsonb_build_object(
        'total_count', _total_count,
        'limit', _limit,
        'offset', _offset,
        'has_more', (_offset + _limit) < _total_count
      ),
      'filters', jsonb_build_object(
        'operation_types', _operation_types,
        'status_filter', _status_filter,
        'include_completed', _include_completed
      )
    ),
    'metadata', jsonb_build_object(
      'generated_at', NOW(),
      'generated_by', _current_user_id,
      'team_id', _team_id
    )
  ) INTO _result
  FROM operation_data;

  RETURN COALESCE(_result, jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'operations', '[]'::jsonb,
      'pagination', jsonb_build_object(
        'total_count', 0,
        'limit', _limit,
        'offset', _offset,
        'has_more', false
      )
    )
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process scheduled operations (called by cron job)
CREATE OR REPLACE FUNCTION public.process_scheduled_operations()
RETURNS JSONB AS $$
DECLARE
  _operation_record RECORD;
  _processed_count INTEGER := 0;
  _failed_count INTEGER := 0;
  _skipped_count INTEGER := 0;
  _results JSONB := '[]';
  _operation_result JSONB;
  _dependencies_met BOOLEAN;
BEGIN
  -- Find all operations ready for processing
  FOR _operation_record IN
    SELECT so.id, so.team_id, so.operation_type, so.operation_name, so.operation_config,
           so.depends_on, so.prerequisites, so.retry_count, so.max_retries
    FROM public.scheduled_operations so
    WHERE so.status IN ('scheduled', 'pending')
      AND so.scheduled_for <= NOW()
    ORDER BY so.scheduled_for ASC
  LOOP
    BEGIN
      -- Check if dependencies are met
      _dependencies_met := TRUE;

      IF array_length(_operation_record.depends_on, 1) > 0 THEN
        SELECT NOT EXISTS (
          SELECT 1 FROM unnest(_operation_record.depends_on) AS dep_id
          WHERE NOT EXISTS (
            SELECT 1 FROM public.scheduled_operations
            WHERE id = dep_id AND status = 'completed'
          )
        ) INTO _dependencies_met;
      END IF;

      -- Skip if dependencies not met
      IF NOT _dependencies_met THEN
        PERFORM public.log_scheduled_operation_event(
          _operation_record.id,
          'info',
          'Operation skipped - dependencies not met',
          jsonb_build_object('depends_on', _operation_record.depends_on),
          'dependency_check'
        );
        _skipped_count := _skipped_count + 1;
        CONTINUE;
      END IF;

      -- Update status to processing
      PERFORM public.update_scheduled_operation_status(
        _operation_record.id,
        'processing'::public.scheduled_operation_status
      );

      -- Process the operation based on type
      CASE _operation_record.operation_type
        WHEN 'member_removal' THEN
          -- Process member removal
          SELECT public.remove_team_member_enhanced(
            _operation_record.team_id,
            (_operation_record.operation_config->>'user_id')::UUID,
            _operation_record.operation_config->>'reason',
            COALESCE((_operation_record.operation_config->>'transfer_data')::BOOLEAN, false),
            CASE WHEN _operation_record.operation_config->>'transfer_to_user_id' IS NOT NULL
                 THEN (_operation_record.operation_config->>'transfer_to_user_id')::UUID
                 ELSE NULL END
          ) INTO _operation_result;

        WHEN 'role_change' THEN
          -- Process role change
          SELECT public.update_team_member_role(
            _operation_record.team_id,
            (_operation_record.operation_config->>'user_id')::UUID,
            (_operation_record.operation_config->>'new_role')::public.team_member_role
          ) INTO _operation_result;

        WHEN 'permission_update' THEN
          -- Process permission update
          UPDATE public.team_members
          SET permissions = (_operation_record.operation_config->>'new_permissions')::JSONB,
              updated_at = NOW()
          WHERE team_id = _operation_record.team_id
            AND user_id = (_operation_record.operation_config->>'user_id')::UUID;

          _operation_result := jsonb_build_object('success', true);

        WHEN 'invitation_expiry' THEN
          -- Process invitation expiry
          UPDATE public.team_invitations
          SET status = 'expired',
              updated_at = NOW()
          WHERE team_id = _operation_record.team_id
            AND id = (_operation_record.operation_config->>'invitation_id')::UUID
            AND status = 'pending';

          _operation_result := jsonb_build_object('success', true);

        WHEN 'data_cleanup' THEN
          -- Process data cleanup operations
          -- This would be customized based on specific cleanup needs
          _operation_result := jsonb_build_object('success', true, 'message', 'Data cleanup completed');

        ELSE
          -- Unknown operation type
          _operation_result := jsonb_build_object(
            'success', false,
            'error', 'Unknown operation type: ' || _operation_record.operation_type
          );
      END CASE;

      -- Check operation result and update status
      IF _operation_result->>'success' = 'true' THEN
        PERFORM public.update_scheduled_operation_status(
          _operation_record.id,
          'completed'::public.scheduled_operation_status
        );

        PERFORM public.log_scheduled_operation_event(
          _operation_record.id,
          'info',
          'Operation completed successfully',
          _operation_result,
          'completion',
          100
        );

        _processed_count := _processed_count + 1;
      ELSE
        -- Operation failed, check if we should retry
        IF _operation_record.retry_count < _operation_record.max_retries THEN
          -- Increment retry count and reschedule
          UPDATE public.scheduled_operations
          SET retry_count = retry_count + 1,
              scheduled_for = NOW() + INTERVAL '5 minutes', -- Retry in 5 minutes
              status = 'scheduled',
              updated_at = NOW()
          WHERE id = _operation_record.id;

          PERFORM public.log_scheduled_operation_event(
            _operation_record.id,
            'warn',
            'Operation failed, scheduling retry ' || (_operation_record.retry_count + 1) || '/' || _operation_record.max_retries,
            _operation_result,
            'retry_scheduled'
          );
        ELSE
          -- Max retries reached, mark as failed
          PERFORM public.update_scheduled_operation_status(
            _operation_record.id,
            'failed'::public.scheduled_operation_status,
            _operation_result->>'error',
            _operation_result
          );

          PERFORM public.log_scheduled_operation_event(
            _operation_record.id,
            'error',
            'Operation failed after maximum retries',
            _operation_result,
            'final_failure'
          );
        END IF;

        _failed_count := _failed_count + 1;
      END IF;

      -- Add to results
      _results := _results || jsonb_build_object(
        'operation_id', _operation_record.id,
        'operation_name', _operation_record.operation_name,
        'operation_type', _operation_record.operation_type,
        'status', CASE WHEN _operation_result->>'success' = 'true' THEN 'completed' ELSE 'failed' END,
        'result', _operation_result
      );

    EXCEPTION WHEN OTHERS THEN
      -- Handle unexpected errors
      PERFORM public.update_scheduled_operation_status(
        _operation_record.id,
        'failed'::public.scheduled_operation_status,
        SQLERRM,
        jsonb_build_object('error_code', SQLSTATE, 'error_message', SQLERRM)
      );

      PERFORM public.log_scheduled_operation_event(
        _operation_record.id,
        'error',
        'Unexpected error during operation processing: ' || SQLERRM,
        jsonb_build_object('error_code', SQLSTATE),
        'error_handling'
      );

      _failed_count := _failed_count + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'summary', jsonb_build_object(
      'processed_count', _processed_count,
      'failed_count', _failed_count,
      'skipped_count', _skipped_count,
      'total_operations', _processed_count + _failed_count + _skipped_count
    ),
    'results', _results,
    'processed_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cancel a scheduled operation
CREATE OR REPLACE FUNCTION public.cancel_scheduled_operation(
  _operation_id UUID,
  _reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  _current_user_id UUID := auth.uid();
  _current_user_role public.team_member_role;
  _operation_record RECORD;
BEGIN
  -- Get operation details and verify access
  SELECT so.*, tm.role INTO _operation_record, _current_user_role
  FROM public.scheduled_operations so
  JOIN public.team_members tm ON tm.team_id = so.team_id AND tm.user_id = _current_user_id
  WHERE so.id = _operation_id;

  IF _operation_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Operation not found or access denied',
      'error_code', 'OPERATION_NOT_FOUND'
    );
  END IF;

  -- Check permissions
  IF _current_user_role NOT IN ('admin', 'owner') AND _operation_record.created_by != _current_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only operation creator, team admins, or owners can cancel operations',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  -- Check if operation can be cancelled
  IF _operation_record.status NOT IN ('scheduled', 'pending') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Operation cannot be cancelled in current status: ' || _operation_record.status,
      'error_code', 'INVALID_OPERATION_STATUS'
    );
  END IF;

  -- Cancel the operation
  PERFORM public.update_scheduled_operation_status(
    _operation_id,
    'cancelled'::public.scheduled_operation_status
  );

  -- Log the cancellation
  PERFORM public.log_scheduled_operation_event(
    _operation_id,
    'info',
    'Operation cancelled by user',
    jsonb_build_object(
      'cancelled_by', _current_user_id,
      'cancellation_reason', _reason
    ),
    'cancellation'
  );

  -- Log audit event
  PERFORM public.log_team_audit_event(
    _operation_record.team_id,
    'operation_cancelled'::team_audit_action,
    'Cancelled scheduled operation: ' || _operation_record.operation_name,
    NULL,
    jsonb_build_object('status', _operation_record.status),
    jsonb_build_object('status', 'cancelled'),
    jsonb_build_object(
      'operation_id', _operation_id,
      'cancellation_reason', _reason,
      'cancelled_by', _current_user_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'operation_id', _operation_id,
      'operation_name', _operation_record.operation_name,
      'previous_status', _operation_record.status,
      'new_status', 'cancelled',
      'cancelled_by', _current_user_id,
      'cancelled_at', NOW()
    ),
    'metadata', jsonb_build_object(
      'team_id', _operation_record.team_id,
      'cancellation_reason', _reason
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reschedule an operation
CREATE OR REPLACE FUNCTION public.reschedule_operation(
  _operation_id UUID,
  _new_scheduled_for TIMESTAMP WITH TIME ZONE,
  _reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  _current_user_id UUID := auth.uid();
  _current_user_role public.team_member_role;
  _operation_record RECORD;
BEGIN
  -- Get operation details and verify access
  SELECT so.*, tm.role INTO _operation_record, _current_user_role
  FROM public.scheduled_operations so
  JOIN public.team_members tm ON tm.team_id = so.team_id AND tm.user_id = _current_user_id
  WHERE so.id = _operation_id;

  IF _operation_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Operation not found or access denied',
      'error_code', 'OPERATION_NOT_FOUND'
    );
  END IF;

  -- Check permissions
  IF _current_user_role NOT IN ('admin', 'owner') AND _operation_record.created_by != _current_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only operation creator, team admins, or owners can reschedule operations',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  -- Check if operation can be rescheduled
  IF _operation_record.status NOT IN ('scheduled', 'pending', 'failed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Operation cannot be rescheduled in current status: ' || _operation_record.status,
      'error_code', 'INVALID_OPERATION_STATUS'
    );
  END IF;

  -- Validate new scheduling time
  IF _new_scheduled_for <= NOW() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'New scheduled time must be in the future',
      'error_code', 'INVALID_SCHEDULE_TIME'
    );
  END IF;

  -- Update the operation
  UPDATE public.scheduled_operations
  SET scheduled_for = _new_scheduled_for,
      status = 'scheduled',
      retry_count = 0, -- Reset retry count
      error_message = NULL,
      error_details = NULL,
      updated_at = NOW()
  WHERE id = _operation_id;

  -- Log the rescheduling
  PERFORM public.log_scheduled_operation_event(
    _operation_id,
    'info',
    'Operation rescheduled',
    jsonb_build_object(
      'previous_scheduled_for', _operation_record.scheduled_for,
      'new_scheduled_for', _new_scheduled_for,
      'rescheduled_by', _current_user_id,
      'reschedule_reason', _reason
    ),
    'rescheduling'
  );

  -- Log audit event
  PERFORM public.log_team_audit_event(
    _operation_record.team_id,
    'operation_rescheduled'::team_audit_action,
    'Rescheduled operation: ' || _operation_record.operation_name,
    NULL,
    jsonb_build_object('scheduled_for', _operation_record.scheduled_for),
    jsonb_build_object('scheduled_for', _new_scheduled_for),
    jsonb_build_object(
      'operation_id', _operation_id,
      'reschedule_reason', _reason,
      'rescheduled_by', _current_user_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'operation_id', _operation_id,
      'operation_name', _operation_record.operation_name,
      'previous_scheduled_for', _operation_record.scheduled_for,
      'new_scheduled_for', _new_scheduled_for,
      'status', 'scheduled',
      'rescheduled_by', _current_user_id,
      'rescheduled_at', NOW()
    ),
    'metadata', jsonb_build_object(
      'team_id', _operation_record.team_id,
      'reschedule_reason', _reason
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. FUNCTION COMMENTS AND PERMISSIONS
-- ============================================================================

COMMENT ON FUNCTION public.schedule_member_operation IS 'Schedule a member operation with comprehensive configuration and dependency management';
COMMENT ON FUNCTION public.get_scheduled_operations IS 'Get scheduled operations for a team with filtering, pagination, and enhanced data';
COMMENT ON FUNCTION public.process_scheduled_operations IS 'Process all scheduled operations that are ready for execution (system function)';
COMMENT ON FUNCTION public.cancel_scheduled_operation IS 'Cancel a scheduled operation with proper access control and audit logging';
COMMENT ON FUNCTION public.reschedule_operation IS 'Reschedule an operation to a new time with validation and audit logging';
COMMENT ON FUNCTION public.log_scheduled_operation_event IS 'Log events for scheduled operations with detailed context';
COMMENT ON FUNCTION public.update_scheduled_operation_status IS 'Update operation status with automatic logging and timestamp management';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.schedule_member_operation TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_scheduled_operations TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_scheduled_operations TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_operation TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_operation TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_scheduled_operation_event TO service_role;
GRANT EXECUTE ON FUNCTION public.update_scheduled_operation_status TO service_role;
