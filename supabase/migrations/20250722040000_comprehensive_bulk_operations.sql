-- ============================================================================
-- COMPREHENSIVE BULK OPERATIONS SYSTEM
-- Migration: 20250722040000_comprehensive_bulk_operations.sql
-- Description: Complete bulk operations system with role updates, permission updates,
--              enhanced transaction handling, scheduling, and comprehensive monitoring
-- ============================================================================

-- ============================================================================
-- 1. BULK ROLE UPDATE OPERATIONS
-- ============================================================================

-- Function for bulk role updates
CREATE OR REPLACE FUNCTION public.bulk_update_member_roles(
  p_team_id UUID,
  p_role_updates JSONB, -- Array of {user_id, new_role, reason}
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_user_role team_member_role;
  update_data JSONB;
  update_result JSONB;
  results JSONB := '[]';
  success_count INTEGER := 0;
  failed_count INTEGER := 0;
  bulk_operation_id UUID;
  total_updates INTEGER;
  member_record RECORD;
BEGIN
  -- Get current user's role
  SELECT role INTO current_user_role
  FROM public.team_members
  WHERE team_id = p_team_id AND user_id = current_user_id;

  -- Permission checks
  IF current_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only team owners and admins can perform bulk role updates',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  -- Validate updates array
  IF jsonb_typeof(p_role_updates) != 'array' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Role updates must be an array',
      'error_code', 'INVALID_INPUT'
    );
  END IF;

  total_updates := jsonb_array_length(p_role_updates);

  -- Create bulk operation record
  INSERT INTO public.team_bulk_operations (
    team_id,
    operation_type,
    operation_status,
    performed_by,
    target_data,
    operation_params,
    total_items
  ) VALUES (
    p_team_id,
    'bulk_role_update',
    'in_progress',
    current_user_id,
    p_role_updates,
    jsonb_build_object('reason', p_reason),
    total_updates
  ) RETURNING id INTO bulk_operation_id;

  -- Process each role update
  FOR update_data IN SELECT * FROM jsonb_array_elements(p_role_updates)
  LOOP
    BEGIN
      -- Get current member info
      SELECT tm.*, p.first_name, p.last_name, au.email
      INTO member_record
      FROM public.team_members tm
      JOIN auth.users au ON tm.user_id = au.id
      LEFT JOIN public.profiles p ON au.id = p.id
      WHERE tm.team_id = p_team_id 
        AND tm.user_id = (update_data->>'user_id')::UUID;

      IF member_record.user_id IS NULL THEN
        failed_count := failed_count + 1;
        results := results || jsonb_build_object(
          'user_id', update_data->>'user_id',
          'result', jsonb_build_object(
            'success', false,
            'error', 'User is not a team member',
            'error_code', 'NOT_MEMBER'
          )
        );
        CONTINUE;
      END IF;

      -- Validate role change permissions
      IF (update_data->>'new_role')::team_member_role = 'owner' THEN
        failed_count := failed_count + 1;
        results := results || jsonb_build_object(
          'user_id', update_data->>'user_id',
          'result', jsonb_build_object(
            'success', false,
            'error', 'Cannot assign owner role through bulk update',
            'error_code', 'INVALID_ROLE'
          )
        );
        CONTINUE;
      END IF;

      -- Only owners can assign admin role
      IF (update_data->>'new_role')::team_member_role = 'admin' AND current_user_role != 'owner' THEN
        failed_count := failed_count + 1;
        results := results || jsonb_build_object(
          'user_id', update_data->>'user_id',
          'result', jsonb_build_object(
            'success', false,
            'error', 'Only team owners can assign admin role',
            'error_code', 'INSUFFICIENT_PERMISSIONS_FOR_ROLE'
          )
        );
        CONTINUE;
      END IF;

      -- Skip if role is already the same
      IF member_record.role = (update_data->>'new_role')::team_member_role THEN
        results := results || jsonb_build_object(
          'user_id', update_data->>'user_id',
          'result', jsonb_build_object(
            'success', true,
            'message', 'Role already set to ' || (update_data->>'new_role'),
            'skipped', true
          )
        );
        success_count := success_count + 1;
        CONTINUE;
      END IF;

      -- Update the role
      UPDATE public.team_members
      SET 
        role = (update_data->>'new_role')::team_member_role,
        updated_at = NOW()
      WHERE team_id = p_team_id AND user_id = (update_data->>'user_id')::UUID;

      -- Log the role change
      PERFORM public.log_team_audit_event_enhanced(
        p_team_id,
        'member_role_changed'::team_audit_action,
        'Bulk role update: ' || member_record.role || ' → ' || (update_data->>'new_role'),
        (update_data->>'user_id')::UUID,
        jsonb_build_object('role', member_record.role),
        jsonb_build_object('role', (update_data->>'new_role')::team_member_role),
        jsonb_build_object(
          'bulk_operation_id', bulk_operation_id,
          'update_reason', COALESCE(update_data->>'reason', p_reason),
          'changed_by', current_user_id
        )
      );

      success_count := success_count + 1;
      results := results || jsonb_build_object(
        'user_id', update_data->>'user_id',
        'result', jsonb_build_object(
          'success', true,
          'old_role', member_record.role,
          'new_role', (update_data->>'new_role')::team_member_role,
          'user_name', COALESCE(member_record.first_name || ' ' || member_record.last_name, member_record.email)
        )
      );

    EXCEPTION WHEN OTHERS THEN
      failed_count := failed_count + 1;
      results := results || jsonb_build_object(
        'user_id', update_data->>'user_id',
        'result', jsonb_build_object(
          'success', false,
          'error', SQLERRM,
          'error_code', 'UPDATE_FAILED'
        )
      );
    END;
  END LOOP;

  -- Update bulk operation record
  UPDATE public.team_bulk_operations
  SET operation_status = 'completed',
      processed_items = success_count + failed_count,
      successful_items = success_count,
      failed_items = failed_count,
      results = results,
      completed_at = NOW()
  WHERE id = bulk_operation_id;

  -- Log bulk operation
  PERFORM public.log_team_audit_event_enhanced(
    p_team_id,
    'bulk_role_updated'::team_audit_action,
    'Bulk role update completed: ' || success_count || ' successful, ' || failed_count || ' failed',
    NULL,
    '{}',
    jsonb_build_object(
      'total_updates', total_updates,
      'successful', success_count,
      'failed', failed_count
    ),
    jsonb_build_object(
      'bulk_operation_id', bulk_operation_id,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'bulk_operation_id', bulk_operation_id,
    'total_updates', total_updates,
    'successful_updates', success_count,
    'failed_updates', failed_count,
    'results', results,
    'completed_at', NOW()
  );

EXCEPTION WHEN OTHERS THEN
  -- Update bulk operation as failed
  UPDATE public.team_bulk_operations
  SET operation_status = 'failed',
      error_summary = SQLERRM,
      completed_at = NOW()
  WHERE id = bulk_operation_id;

  RETURN jsonb_build_object(
    'success', false,
    'error', 'Bulk role update failed: ' || SQLERRM,
    'error_code', 'BULK_UPDATE_FAILED',
    'bulk_operation_id', bulk_operation_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. BULK PERMISSION UPDATE OPERATIONS
-- ============================================================================

-- Function for bulk permission updates
CREATE OR REPLACE FUNCTION public.bulk_update_member_permissions(
  p_team_id UUID,
  p_permission_updates JSONB, -- Array of {user_id, permissions, merge_mode}
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_user_role team_member_role;
  update_data JSONB;
  results JSONB := '[]';
  success_count INTEGER := 0;
  failed_count INTEGER := 0;
  bulk_operation_id UUID;
  total_updates INTEGER;
  member_record RECORD;
  new_permissions JSONB;
  old_permissions JSONB;
BEGIN
  -- Get current user's role
  SELECT role INTO current_user_role
  FROM public.team_members
  WHERE team_id = p_team_id AND user_id = current_user_id;

  -- Permission checks
  IF current_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only team owners and admins can perform bulk permission updates',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  -- Validate updates array
  IF jsonb_typeof(p_permission_updates) != 'array' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Permission updates must be an array',
      'error_code', 'INVALID_INPUT'
    );
  END IF;

  total_updates := jsonb_array_length(p_permission_updates);

  -- Create bulk operation record
  INSERT INTO public.team_bulk_operations (
    team_id,
    operation_type,
    operation_status,
    performed_by,
    target_data,
    operation_params,
    total_items
  ) VALUES (
    p_team_id,
    'bulk_permission_update',
    'in_progress',
    current_user_id,
    p_permission_updates,
    jsonb_build_object('reason', p_reason),
    total_updates
  ) RETURNING id INTO bulk_operation_id;

  -- Process each permission update
  FOR update_data IN SELECT * FROM jsonb_array_elements(p_permission_updates)
  LOOP
    BEGIN
      -- Get current member info
      SELECT tm.*, p.first_name, p.last_name, au.email
      INTO member_record
      FROM public.team_members tm
      JOIN auth.users au ON tm.user_id = au.id
      LEFT JOIN public.profiles p ON au.id = p.id
      WHERE tm.team_id = p_team_id
        AND tm.user_id = (update_data->>'user_id')::UUID;

      IF member_record.user_id IS NULL THEN
        failed_count := failed_count + 1;
        results := results || jsonb_build_object(
          'user_id', update_data->>'user_id',
          'result', jsonb_build_object(
            'success', false,
            'error', 'User is not a team member',
            'error_code', 'NOT_MEMBER'
          )
        );
        CONTINUE;
      END IF;

      -- Store old permissions
      old_permissions := COALESCE(member_record.permissions, '{}');

      -- Calculate new permissions based on merge mode
      IF COALESCE(update_data->>'merge_mode', 'replace') = 'merge' THEN
        -- Merge with existing permissions
        new_permissions := old_permissions || (update_data->'permissions');
      ELSE
        -- Replace permissions entirely
        new_permissions := update_data->'permissions';
      END IF;

      -- Skip if permissions are already the same
      IF old_permissions = new_permissions THEN
        results := results || jsonb_build_object(
          'user_id', update_data->>'user_id',
          'result', jsonb_build_object(
            'success', true,
            'message', 'Permissions already up to date',
            'skipped', true
          )
        );
        success_count := success_count + 1;
        CONTINUE;
      END IF;

      -- Update the permissions
      UPDATE public.team_members
      SET
        permissions = new_permissions,
        updated_at = NOW()
      WHERE team_id = p_team_id AND user_id = (update_data->>'user_id')::UUID;

      -- Log the permission change
      PERFORM public.log_team_audit_event_enhanced(
        p_team_id,
        'member_permissions_updated'::team_audit_action,
        'Bulk permission update for ' || COALESCE(member_record.first_name || ' ' || member_record.last_name, member_record.email),
        (update_data->>'user_id')::UUID,
        jsonb_build_object('permissions', old_permissions),
        jsonb_build_object('permissions', new_permissions),
        jsonb_build_object(
          'bulk_operation_id', bulk_operation_id,
          'update_reason', COALESCE(update_data->>'reason', p_reason),
          'merge_mode', COALESCE(update_data->>'merge_mode', 'replace'),
          'changed_by', current_user_id
        )
      );

      success_count := success_count + 1;
      results := results || jsonb_build_object(
        'user_id', update_data->>'user_id',
        'result', jsonb_build_object(
          'success', true,
          'old_permissions', old_permissions,
          'new_permissions', new_permissions,
          'merge_mode', COALESCE(update_data->>'merge_mode', 'replace'),
          'user_name', COALESCE(member_record.first_name || ' ' || member_record.last_name, member_record.email)
        )
      );

    EXCEPTION WHEN OTHERS THEN
      failed_count := failed_count + 1;
      results := results || jsonb_build_object(
        'user_id', update_data->>'user_id',
        'result', jsonb_build_object(
          'success', false,
          'error', SQLERRM,
          'error_code', 'UPDATE_FAILED'
        )
      );
    END;
  END LOOP;

  -- Update bulk operation record
  UPDATE public.team_bulk_operations
  SET operation_status = 'completed',
      processed_items = success_count + failed_count,
      successful_items = success_count,
      failed_items = failed_count,
      results = results,
      completed_at = NOW()
  WHERE id = bulk_operation_id;

  -- Log bulk operation
  PERFORM public.log_team_audit_event_enhanced(
    p_team_id,
    'bulk_permission_updated'::team_audit_action,
    'Bulk permission update completed: ' || success_count || ' successful, ' || failed_count || ' failed',
    NULL,
    '{}',
    jsonb_build_object(
      'total_updates', total_updates,
      'successful', success_count,
      'failed', failed_count
    ),
    jsonb_build_object(
      'bulk_operation_id', bulk_operation_id,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'bulk_operation_id', bulk_operation_id,
    'total_updates', total_updates,
    'successful_updates', success_count,
    'failed_updates', failed_count,
    'results', results,
    'completed_at', NOW()
  );

EXCEPTION WHEN OTHERS THEN
  -- Update bulk operation as failed
  UPDATE public.team_bulk_operations
  SET operation_status = 'failed',
      error_summary = SQLERRM,
      completed_at = NOW()
  WHERE id = bulk_operation_id;

  RETURN jsonb_build_object(
    'success', false,
    'error', 'Bulk permission update failed: ' || SQLERRM,
    'error_code', 'BULK_UPDATE_FAILED',
    'bulk_operation_id', bulk_operation_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. BULK OPERATION MANAGEMENT AND MONITORING
-- ============================================================================

-- Function to get bulk operations with filtering
CREATE OR REPLACE FUNCTION public.get_bulk_operations(
  p_team_id UUID,
  p_operation_types TEXT[] DEFAULT NULL,
  p_statuses TEXT[] DEFAULT NULL,
  p_performed_by UUID DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
  id UUID,
  team_id UUID,
  operation_type VARCHAR(50),
  operation_status VARCHAR(50),
  performed_by UUID,
  performer_name TEXT,
  performer_email VARCHAR(255),
  total_items INTEGER,
  processed_items INTEGER,
  successful_items INTEGER,
  failed_items INTEGER,
  progress_percentage NUMERIC,
  results JSONB,
  error_summary TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER
) AS $$
BEGIN
  -- Check permissions
  IF NOT public.is_team_member(p_team_id, auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to view bulk operations';
  END IF;

  RETURN QUERY
  SELECT
    tbo.id,
    tbo.team_id,
    tbo.operation_type,
    tbo.operation_status,
    tbo.performed_by,
    COALESCE(p.first_name || ' ' || p.last_name, au.email) as performer_name,
    au.email as performer_email,
    tbo.total_items,
    tbo.processed_items,
    tbo.successful_items,
    tbo.failed_items,
    CASE
      WHEN tbo.total_items > 0 THEN
        ROUND((tbo.processed_items::NUMERIC / tbo.total_items::NUMERIC) * 100, 2)
      ELSE 0
    END as progress_percentage,
    tbo.results,
    tbo.error_summary,
    tbo.started_at,
    tbo.completed_at,
    CASE
      WHEN tbo.completed_at IS NOT NULL THEN
        EXTRACT(EPOCH FROM (tbo.completed_at - tbo.started_at))::INTEGER
      ELSE
        EXTRACT(EPOCH FROM (NOW() - tbo.started_at))::INTEGER
    END as duration_seconds
  FROM public.team_bulk_operations tbo
  JOIN auth.users au ON tbo.performed_by = au.id
  LEFT JOIN public.profiles p ON au.id = p.id
  WHERE tbo.team_id = p_team_id
    AND (p_operation_types IS NULL OR tbo.operation_type = ANY(p_operation_types))
    AND (p_statuses IS NULL OR tbo.operation_status = ANY(p_statuses))
    AND (p_performed_by IS NULL OR tbo.performed_by = p_performed_by)
    AND (p_start_date IS NULL OR tbo.started_at >= p_start_date)
    AND (p_end_date IS NULL OR tbo.started_at <= p_end_date)
  ORDER BY tbo.started_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get bulk operation statistics
CREATE OR REPLACE FUNCTION public.get_bulk_operation_stats(
  p_team_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
  stats JSONB;
BEGIN
  -- Check permissions
  IF NOT public.is_team_member(p_team_id, auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('error', 'Insufficient permissions to view bulk operation statistics');
  END IF;

  WITH operation_stats AS (
    SELECT
      operation_type,
      operation_status,
      COUNT(*) as operation_count,
      AVG(total_items) as avg_items_per_operation,
      AVG(successful_items) as avg_successful_items,
      AVG(failed_items) as avg_failed_items,
      AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds,
      SUM(total_items) as total_items_processed,
      SUM(successful_items) as total_successful_items,
      SUM(failed_items) as total_failed_items
    FROM public.team_bulk_operations
    WHERE team_id = p_team_id
      AND started_at >= p_start_date
      AND started_at <= p_end_date
    GROUP BY operation_type, operation_status
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date,
      'days', EXTRACT(DAY FROM p_end_date - p_start_date)
    ),
    'summary', jsonb_build_object(
      'total_operations', COALESCE(SUM(operation_count), 0),
      'total_items_processed', COALESCE(SUM(total_items_processed), 0),
      'total_successful_items', COALESCE(SUM(total_successful_items), 0),
      'total_failed_items', COALESCE(SUM(total_failed_items), 0),
      'overall_success_rate', CASE
        WHEN SUM(total_items_processed) > 0 THEN
          ROUND((SUM(total_successful_items)::NUMERIC / SUM(total_items_processed)::NUMERIC) * 100, 2)
        ELSE 0
      END,
      'avg_operation_duration', ROUND(AVG(avg_duration_seconds), 2)
    ),
    'by_operation_type', (
      SELECT jsonb_object_agg(
        operation_type,
        jsonb_build_object(
          'total_operations', SUM(operation_count),
          'total_items', SUM(total_items_processed),
          'success_rate', CASE
            WHEN SUM(total_items_processed) > 0 THEN
              ROUND((SUM(total_successful_items)::NUMERIC / SUM(total_items_processed)::NUMERIC) * 100, 2)
            ELSE 0
          END,
          'avg_duration', ROUND(AVG(avg_duration_seconds), 2)
        )
      )
      FROM operation_stats
      GROUP BY operation_type
    ),
    'by_status', (
      SELECT jsonb_object_agg(
        operation_status,
        jsonb_build_object(
          'count', SUM(operation_count),
          'percentage', ROUND((SUM(operation_count)::NUMERIC / (SELECT SUM(operation_count) FROM operation_stats)::NUMERIC) * 100, 2)
        )
      )
      FROM operation_stats
      GROUP BY operation_status
    )
  ) INTO stats
  FROM operation_stats;

  RETURN COALESCE(stats, jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date,
      'days', EXTRACT(DAY FROM p_end_date - p_start_date)
    ),
    'summary', jsonb_build_object(
      'total_operations', 0,
      'total_items_processed', 0,
      'total_successful_items', 0,
      'total_failed_items', 0,
      'overall_success_rate', 0,
      'avg_operation_duration', 0
    ),
    'by_operation_type', '{}',
    'by_status', '{}'
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cancel a bulk operation
CREATE OR REPLACE FUNCTION public.cancel_bulk_operation(
  p_operation_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  operation_record RECORD;
  current_user_id UUID := auth.uid();
  current_user_role team_member_role;
BEGIN
  -- Get operation details
  SELECT * INTO operation_record
  FROM public.team_bulk_operations
  WHERE id = p_operation_id;

  IF operation_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Bulk operation not found',
      'error_code', 'OPERATION_NOT_FOUND'
    );
  END IF;

  -- Get current user's role
  SELECT role INTO current_user_role
  FROM public.team_members
  WHERE team_id = operation_record.team_id AND user_id = current_user_id;

  -- Permission checks (admin/owner or the person who started the operation)
  IF current_user_role NOT IN ('owner', 'admin') AND operation_record.performed_by != current_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient permissions to cancel this operation',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  -- Check if operation can be cancelled
  IF operation_record.operation_status NOT IN ('pending', 'in_progress') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Can only cancel pending or in-progress operations',
      'error_code', 'INVALID_OPERATION_STATUS',
      'current_status', operation_record.operation_status
    );
  END IF;

  -- Cancel the operation
  UPDATE public.team_bulk_operations
  SET
    operation_status = 'cancelled',
    error_summary = COALESCE(p_reason, 'Operation cancelled by user'),
    completed_at = NOW()
  WHERE id = p_operation_id;

  -- Log the cancellation
  PERFORM public.log_team_audit_event_enhanced(
    operation_record.team_id,
    'bulk_operation_cancelled'::team_audit_action,
    'Bulk operation cancelled: ' || operation_record.operation_type,
    NULL,
    jsonb_build_object('status', operation_record.operation_status),
    jsonb_build_object('status', 'cancelled'),
    jsonb_build_object(
      'operation_id', p_operation_id,
      'cancelled_by', current_user_id,
      'cancellation_reason', p_reason,
      'original_performer', operation_record.performed_by
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'operation_id', p_operation_id,
    'cancelled_by', current_user_id,
    'cancellation_reason', p_reason,
    'cancelled_at', NOW()
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Failed to cancel operation: ' || SQLERRM,
    'error_code', 'CANCEL_FAILED',
    'error_detail', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. BULK OPERATION RETRY AND RECOVERY
-- ============================================================================

-- Function to retry failed bulk operation items
CREATE OR REPLACE FUNCTION public.retry_bulk_operation_failures(
  p_operation_id UUID,
  p_retry_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  operation_record RECORD;
  current_user_id UUID := auth.uid();
  current_user_role team_member_role;
  failed_items JSONB;
  retry_result JSONB;
  new_operation_id UUID;
BEGIN
  -- Get operation details
  SELECT * INTO operation_record
  FROM public.team_bulk_operations
  WHERE id = p_operation_id;

  IF operation_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Bulk operation not found',
      'error_code', 'OPERATION_NOT_FOUND'
    );
  END IF;

  -- Get current user's role
  SELECT role INTO current_user_role
  FROM public.team_members
  WHERE team_id = operation_record.team_id AND user_id = current_user_id;

  -- Permission checks
  IF current_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient permissions to retry bulk operations',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  -- Check if operation is completed and has failures
  IF operation_record.operation_status != 'completed' OR operation_record.failed_items = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Can only retry completed operations with failures',
      'error_code', 'INVALID_OPERATION_STATUS',
      'current_status', operation_record.operation_status,
      'failed_items', operation_record.failed_items
    );
  END IF;

  -- Extract failed items from results
  SELECT jsonb_agg(
    CASE operation_record.operation_type
      WHEN 'bulk_invite' THEN
        jsonb_build_object(
          'email', item->>'email',
          'role', item->>'role',
          'custom_message', item->>'custom_message',
          'permissions', item->'permissions'
        )
      WHEN 'bulk_remove' THEN
        jsonb_build_object('user_id', item->>'user_id')
      WHEN 'bulk_role_update' THEN
        jsonb_build_object(
          'user_id', item->>'user_id',
          'new_role', item->>'new_role',
          'reason', item->>'reason'
        )
      WHEN 'bulk_permission_update' THEN
        jsonb_build_object(
          'user_id', item->>'user_id',
          'permissions', item->'permissions',
          'merge_mode', item->>'merge_mode'
        )
    END
  ) INTO failed_items
  FROM jsonb_array_elements(operation_record.results) AS item
  WHERE (item->'result'->>'success')::boolean = false;

  -- Retry the failed items based on operation type
  CASE operation_record.operation_type
    WHEN 'bulk_invite' THEN
      SELECT public.bulk_invite_team_members(
        operation_record.team_id,
        failed_items,
        (operation_record.operation_params->>'default_role')::team_member_role,
        (operation_record.operation_params->>'expires_in_days')::INTEGER,
        (operation_record.operation_params->>'send_emails')::BOOLEAN
      ) INTO retry_result;

    WHEN 'bulk_remove' THEN
      SELECT public.bulk_remove_team_members(
        operation_record.team_id,
        ARRAY(SELECT jsonb_array_elements_text(jsonb_agg(item->>'user_id')) FROM jsonb_array_elements(failed_items) AS item),
        operation_record.operation_params->>'reason',
        (operation_record.operation_params->>'transfer_data')::BOOLEAN,
        (operation_record.operation_params->>'transfer_to_user_id')::UUID
      ) INTO retry_result;

    WHEN 'bulk_role_update' THEN
      SELECT public.bulk_update_member_roles(
        operation_record.team_id,
        failed_items,
        operation_record.operation_params->>'reason'
      ) INTO retry_result;

    WHEN 'bulk_permission_update' THEN
      SELECT public.bulk_update_member_permissions(
        operation_record.team_id,
        failed_items,
        operation_record.operation_params->>'reason'
      ) INTO retry_result;

    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Unsupported operation type for retry',
        'error_code', 'UNSUPPORTED_OPERATION_TYPE'
      );
  END CASE;

  -- Get the new operation ID from retry result
  new_operation_id := (retry_result->>'bulk_operation_id')::UUID;

  -- Update the new operation to indicate it's a retry
  UPDATE public.team_bulk_operations
  SET operation_params = operation_params || jsonb_build_object(
    'is_retry', true,
    'original_operation_id', p_operation_id,
    'retry_reason', p_retry_reason
  )
  WHERE id = new_operation_id;

  -- Log the retry
  PERFORM public.log_team_audit_event_enhanced(
    operation_record.team_id,
    'bulk_operation_retried'::team_audit_action,
    'Bulk operation retry initiated for ' || operation_record.failed_items || ' failed items',
    NULL,
    '{}',
    jsonb_build_object(
      'original_operation_id', p_operation_id,
      'new_operation_id', new_operation_id,
      'failed_items_count', operation_record.failed_items
    ),
    jsonb_build_object(
      'retry_reason', p_retry_reason,
      'retried_by', current_user_id,
      'operation_type', operation_record.operation_type
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'original_operation_id', p_operation_id,
    'new_operation_id', new_operation_id,
    'failed_items_retried', operation_record.failed_items,
    'retry_result', retry_result
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Failed to retry operation: ' || SQLERRM,
    'error_code', 'RETRY_FAILED',
    'error_detail', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. BULK OPERATION CLEANUP AND MAINTENANCE
-- ============================================================================

-- Function to cleanup old bulk operations
CREATE OR REPLACE FUNCTION public.cleanup_old_bulk_operations(
  p_retention_days INTEGER DEFAULT 90,
  p_team_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  cutoff_date TIMESTAMP WITH TIME ZONE;
  deleted_count INTEGER := 0;
  teams_affected INTEGER := 0;
BEGIN
  -- Calculate cutoff date
  cutoff_date := NOW() - INTERVAL '1 day' * p_retention_days;

  -- Delete old bulk operations
  IF p_team_id IS NOT NULL THEN
    -- Cleanup for specific team
    DELETE FROM public.team_bulk_operations
    WHERE team_id = p_team_id
      AND started_at < cutoff_date
      AND operation_status IN ('completed', 'failed', 'cancelled');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    teams_affected := CASE WHEN deleted_count > 0 THEN 1 ELSE 0 END;
  ELSE
    -- Cleanup for all teams
    WITH deleted_summary AS (
      DELETE FROM public.team_bulk_operations
      WHERE started_at < cutoff_date
        AND operation_status IN ('completed', 'failed', 'cancelled')
      RETURNING team_id
    )
    SELECT COUNT(*), COUNT(DISTINCT team_id)
    INTO deleted_count, teams_affected
    FROM deleted_summary;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_operations', deleted_count,
    'teams_affected', teams_affected,
    'cutoff_date', cutoff_date,
    'retention_days', p_retention_days,
    'team_specific', p_team_id IS NOT NULL
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'error_detail', SQLSTATE,
    'deleted_operations', deleted_count,
    'teams_affected', teams_affected
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on bulk operation functions
GRANT EXECUTE ON FUNCTION public.bulk_update_member_roles TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_update_member_permissions TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bulk_operations TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bulk_operation_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_bulk_operation TO authenticated;
GRANT EXECUTE ON FUNCTION public.retry_bulk_operation_failures TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_bulk_operations TO service_role;

-- ============================================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.bulk_update_member_roles IS 'Bulk update team member roles with comprehensive validation and audit logging';
COMMENT ON FUNCTION public.bulk_update_member_permissions IS 'Bulk update team member permissions with merge/replace modes';
COMMENT ON FUNCTION public.get_bulk_operations IS 'Retrieve bulk operations with filtering, pagination, and progress tracking';
COMMENT ON FUNCTION public.get_bulk_operation_stats IS 'Generate comprehensive statistics for bulk operations';
COMMENT ON FUNCTION public.cancel_bulk_operation IS 'Cancel pending or in-progress bulk operations';
COMMENT ON FUNCTION public.retry_bulk_operation_failures IS 'Retry failed items from completed bulk operations';
COMMENT ON FUNCTION public.cleanup_old_bulk_operations IS 'Cleanup old bulk operation records based on retention policy';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Comprehensive Bulk Operations System migration completed successfully';
  RAISE NOTICE 'New functions: bulk_update_member_roles, bulk_update_member_permissions';
  RAISE NOTICE 'Management functions: get_bulk_operations, get_bulk_operation_stats, cancel_bulk_operation';
  RAISE NOTICE 'Recovery functions: retry_bulk_operation_failures';
  RAISE NOTICE 'Maintenance functions: cleanup_old_bulk_operations';
  RAISE NOTICE 'Complete bulk operations system with transaction safety and comprehensive error handling';
END $$;
