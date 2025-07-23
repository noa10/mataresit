-- ============================================================================
-- COMPREHENSIVE TEAM MANAGEMENT AUDIT SYSTEM
-- Migration: 20250722030000_comprehensive_audit_system.sql
-- Description: Enhanced audit system with reporting, analytics, retention policies,
--              and comprehensive audit trail management
-- ============================================================================

-- ============================================================================
-- 1. ENHANCED AUDIT LOGGING FUNCTIONS
-- ============================================================================

-- Enhanced audit logging function with IP and user agent capture
CREATE OR REPLACE FUNCTION public.log_team_audit_event_enhanced(
  p_team_id UUID,
  p_action team_audit_action,
  p_action_description TEXT DEFAULT NULL,
  p_target_user_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT '{}',
  p_new_values JSONB DEFAULT '{}',
  p_metadata JSONB DEFAULT '{}',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  audit_id UUID;
  performer_email VARCHAR(255);
  performer_name TEXT;
  target_email VARCHAR(255);
  target_name TEXT;
  current_user_id UUID := auth.uid();
BEGIN
  -- Handle system actions (when no authenticated user)
  IF current_user_id IS NULL THEN
    current_user_id := '00000000-0000-0000-0000-000000000000'::UUID;
    performer_email := 'system@mataresit.com';
    performer_name := 'System';
  ELSE
    -- Get performer information
    SELECT email INTO performer_email FROM auth.users WHERE id = current_user_id;
    SELECT COALESCE(first_name || ' ' || last_name, email) INTO performer_name 
    FROM public.profiles WHERE id = current_user_id;
  END IF;

  -- Get target user information if provided
  IF p_target_user_id IS NOT NULL THEN
    SELECT email INTO target_email FROM auth.users WHERE id = p_target_user_id;
    SELECT COALESCE(first_name || ' ' || last_name, email) INTO target_name 
    FROM public.profiles WHERE id = p_target_user_id;
  END IF;

  -- Insert audit log with enhanced context
  INSERT INTO public.team_audit_logs (
    team_id,
    action,
    action_description,
    performed_by,
    performed_by_email,
    performed_by_name,
    target_user_id,
    target_user_email,
    target_user_name,
    old_values,
    new_values,
    metadata,
    ip_address,
    user_agent,
    session_id
  ) VALUES (
    p_team_id,
    p_action,
    p_action_description,
    current_user_id,
    performer_email,
    performer_name,
    p_target_user_id,
    target_email,
    target_name,
    p_old_values,
    p_new_values,
    p_metadata,
    p_ip_address,
    p_user_agent,
    p_session_id
  ) RETURNING id INTO audit_id;

  RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Batch audit logging function for bulk operations
CREATE OR REPLACE FUNCTION public.log_bulk_audit_events(
  p_events JSONB -- Array of audit event objects
) RETURNS JSONB AS $$
DECLARE
  event_data JSONB;
  audit_ids UUID[] := '{}';
  audit_id UUID;
  success_count INTEGER := 0;
  failed_count INTEGER := 0;
  results JSONB := '[]';
BEGIN
  -- Process each audit event
  FOR event_data IN SELECT * FROM jsonb_array_elements(p_events)
  LOOP
    BEGIN
      SELECT public.log_team_audit_event_enhanced(
        (event_data->>'team_id')::UUID,
        (event_data->>'action')::team_audit_action,
        event_data->>'action_description',
        CASE WHEN event_data->>'target_user_id' != '' THEN (event_data->>'target_user_id')::UUID ELSE NULL END,
        COALESCE(event_data->'old_values', '{}'),
        COALESCE(event_data->'new_values', '{}'),
        COALESCE(event_data->'metadata', '{}'),
        CASE WHEN event_data->>'ip_address' != '' THEN (event_data->>'ip_address')::INET ELSE NULL END,
        event_data->>'user_agent',
        event_data->>'session_id'
      ) INTO audit_id;

      audit_ids := audit_ids || audit_id;
      success_count := success_count + 1;
      
      results := results || jsonb_build_object(
        'success', true,
        'audit_id', audit_id,
        'team_id', event_data->>'team_id',
        'action', event_data->>'action'
      );

    EXCEPTION WHEN OTHERS THEN
      failed_count := failed_count + 1;
      results := results || jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'team_id', event_data->>'team_id',
        'action', event_data->>'action'
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_events', jsonb_array_length(p_events),
    'successful_logs', success_count,
    'failed_logs', failed_count,
    'audit_ids', audit_ids,
    'results', results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. AUDIT REPORTING AND ANALYTICS FUNCTIONS
-- ============================================================================

-- Function to get audit logs with filtering and pagination
CREATE OR REPLACE FUNCTION public.get_team_audit_logs(
  p_team_id UUID,
  p_actions team_audit_action[] DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_target_user_id UUID DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
  id UUID,
  team_id UUID,
  action team_audit_action,
  action_description TEXT,
  performed_by UUID,
  performed_by_email VARCHAR(255),
  performed_by_name TEXT,
  target_user_id UUID,
  target_user_email VARCHAR(255),
  target_user_name TEXT,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- Check if user has permission to view audit logs
  IF NOT public.is_team_member(p_team_id, auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to view audit logs';
  END IF;

  RETURN QUERY
  SELECT 
    tal.id,
    tal.team_id,
    tal.action,
    tal.action_description,
    tal.performed_by,
    tal.performed_by_email,
    tal.performed_by_name,
    tal.target_user_id,
    tal.target_user_email,
    tal.target_user_name,
    tal.old_values,
    tal.new_values,
    tal.metadata,
    tal.ip_address,
    tal.user_agent,
    tal.session_id,
    tal.created_at
  FROM public.team_audit_logs tal
  WHERE tal.team_id = p_team_id
    AND (p_actions IS NULL OR tal.action = ANY(p_actions))
    AND (p_user_id IS NULL OR tal.performed_by = p_user_id)
    AND (p_target_user_id IS NULL OR tal.target_user_id = p_target_user_id)
    AND (p_start_date IS NULL OR tal.created_at >= p_start_date)
    AND (p_end_date IS NULL OR tal.created_at <= p_end_date)
  ORDER BY tal.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get audit statistics and analytics
CREATE OR REPLACE FUNCTION public.get_audit_analytics(
  p_team_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
  analytics JSONB;
BEGIN
  -- Check if user has permission to view analytics
  IF NOT public.is_team_member(p_team_id, auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('error', 'Insufficient permissions to view audit analytics');
  END IF;

  WITH audit_stats AS (
    SELECT 
      COUNT(*) as total_events,
      COUNT(DISTINCT performed_by) as unique_actors,
      COUNT(DISTINCT target_user_id) as unique_targets,
      COUNT(DISTINCT DATE(created_at)) as active_days,
      action,
      performed_by,
      performed_by_name,
      DATE(created_at) as event_date,
      EXTRACT(HOUR FROM created_at) as event_hour
    FROM public.team_audit_logs
    WHERE team_id = p_team_id
      AND created_at >= p_start_date
      AND created_at <= p_end_date
    GROUP BY action, performed_by, performed_by_name, DATE(created_at), EXTRACT(HOUR FROM created_at)
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date,
      'days', EXTRACT(DAY FROM p_end_date - p_start_date)
    ),
    'summary', jsonb_build_object(
      'total_events', COALESCE(SUM(total_events), 0),
      'unique_actors', COUNT(DISTINCT performed_by),
      'unique_targets', COUNT(DISTINCT CASE WHEN target_user_id IS NOT NULL THEN target_user_id END),
      'active_days', COUNT(DISTINCT event_date),
      'average_events_per_day', ROUND(COALESCE(SUM(total_events), 0)::NUMERIC / GREATEST(COUNT(DISTINCT event_date), 1), 2)
    ),
    'actions_breakdown', (
      SELECT jsonb_object_agg(action::text, action_count)
      FROM (
        SELECT action, SUM(total_events) as action_count
        FROM audit_stats
        GROUP BY action
        ORDER BY action_count DESC
      ) action_summary
    ),
    'top_actors', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', performed_by,
          'name', performed_by_name,
          'event_count', actor_events
        )
      )
      FROM (
        SELECT performed_by, performed_by_name, SUM(total_events) as actor_events
        FROM audit_stats
        GROUP BY performed_by, performed_by_name
        ORDER BY actor_events DESC
        LIMIT 10
      ) top_actors_summary
    ),
    'hourly_distribution', (
      SELECT jsonb_object_agg(event_hour::text, hour_count)
      FROM (
        SELECT event_hour, SUM(total_events) as hour_count
        FROM audit_stats
        GROUP BY event_hour
        ORDER BY event_hour
      ) hourly_summary
    ),
    'daily_activity', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', event_date,
          'event_count', day_events
        )
        ORDER BY event_date
      )
      FROM (
        SELECT event_date, SUM(total_events) as day_events
        FROM audit_stats
        GROUP BY event_date
        ORDER BY event_date
      ) daily_summary
    )
  ) INTO analytics
  FROM audit_stats;

  RETURN COALESCE(analytics, jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date,
      'days', EXTRACT(DAY FROM p_end_date - p_start_date)
    ),
    'summary', jsonb_build_object(
      'total_events', 0,
      'unique_actors', 0,
      'unique_targets', 0,
      'active_days', 0,
      'average_events_per_day', 0
    ),
    'actions_breakdown', '{}',
    'top_actors', '[]',
    'hourly_distribution', '{}',
    'daily_activity', '[]'
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. AUDIT RETENTION AND CLEANUP FUNCTIONS
-- ============================================================================

-- Function to archive old audit logs
CREATE OR REPLACE FUNCTION public.archive_old_audit_logs(
  p_retention_days INTEGER DEFAULT 365,
  p_archive_table_suffix TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  cutoff_date TIMESTAMP WITH TIME ZONE;
  archive_table_name TEXT;
  archived_count INTEGER := 0;
  teams_processed INTEGER := 0;
  team_record RECORD;
BEGIN
  -- Calculate cutoff date
  cutoff_date := NOW() - INTERVAL '1 day' * p_retention_days;

  -- Generate archive table name
  IF p_archive_table_suffix IS NULL THEN
    archive_table_name := 'team_audit_logs_archive_' || TO_CHAR(NOW(), 'YYYY_MM');
  ELSE
    archive_table_name := 'team_audit_logs_archive_' || p_archive_table_suffix;
  END IF;

  -- Create archive table if it doesn't exist
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS public.%I (
      LIKE public.team_audit_logs INCLUDING ALL
    )', archive_table_name);

  -- Process each team separately for better performance
  FOR team_record IN
    SELECT DISTINCT team_id
    FROM public.team_audit_logs
    WHERE created_at < cutoff_date
  LOOP
    -- Move old records to archive table
    EXECUTE format('
      INSERT INTO public.%I
      SELECT * FROM public.team_audit_logs
      WHERE team_id = $1 AND created_at < $2
    ', archive_table_name)
    USING team_record.team_id, cutoff_date;

    -- Delete archived records from main table
    DELETE FROM public.team_audit_logs
    WHERE team_id = team_record.team_id AND created_at < cutoff_date;

    GET DIAGNOSTICS archived_count = archived_count + ROW_COUNT;
    teams_processed := teams_processed + 1;

    -- Log archival for each team
    PERFORM public.log_team_audit_event_enhanced(
      team_record.team_id,
      'team_settings_updated'::team_audit_action,
      'Audit logs archived: ' || archived_count || ' records moved to ' || archive_table_name,
      NULL,
      '{}',
      jsonb_build_object('archived_records', archived_count),
      jsonb_build_object(
        'archive_table', archive_table_name,
        'cutoff_date', cutoff_date,
        'retention_days', p_retention_days,
        'operation_type', 'audit_archival'
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'archived_records', archived_count,
    'teams_processed', teams_processed,
    'archive_table', archive_table_name,
    'cutoff_date', cutoff_date,
    'retention_days', p_retention_days
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'error_detail', SQLSTATE,
    'archived_records', archived_count,
    'teams_processed', teams_processed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup audit logs (hard delete)
CREATE OR REPLACE FUNCTION public.cleanup_audit_logs(
  p_retention_days INTEGER DEFAULT 1095, -- 3 years default
  p_team_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  cutoff_date TIMESTAMP WITH TIME ZONE;
  deleted_count INTEGER := 0;
  teams_affected INTEGER := 0;
BEGIN
  -- Calculate cutoff date
  cutoff_date := NOW() - INTERVAL '1 day' * p_retention_days;

  -- Delete old audit logs
  IF p_team_id IS NOT NULL THEN
    -- Cleanup for specific team
    DELETE FROM public.team_audit_logs
    WHERE team_id = p_team_id AND created_at < cutoff_date;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    teams_affected := CASE WHEN deleted_count > 0 THEN 1 ELSE 0 END;

    -- Log cleanup for the specific team
    IF deleted_count > 0 THEN
      PERFORM public.log_team_audit_event_enhanced(
        p_team_id,
        'team_settings_updated'::team_audit_action,
        'Audit logs cleanup: ' || deleted_count || ' old records deleted',
        NULL,
        '{}',
        jsonb_build_object('deleted_records', deleted_count),
        jsonb_build_object(
          'cutoff_date', cutoff_date,
          'retention_days', p_retention_days,
          'operation_type', 'audit_cleanup'
        )
      );
    END IF;
  ELSE
    -- Cleanup for all teams
    WITH deleted_summary AS (
      DELETE FROM public.team_audit_logs
      WHERE created_at < cutoff_date
      RETURNING team_id
    )
    SELECT COUNT(*), COUNT(DISTINCT team_id)
    INTO deleted_count, teams_affected
    FROM deleted_summary;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_records', deleted_count,
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
    'deleted_records', deleted_count,
    'teams_affected', teams_affected
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. AUDIT SEARCH AND INVESTIGATION FUNCTIONS
-- ============================================================================

-- Advanced audit search function
CREATE OR REPLACE FUNCTION public.search_audit_logs(
  p_team_id UUID,
  p_search_params JSONB
) RETURNS TABLE (
  id UUID,
  team_id UUID,
  action team_audit_action,
  action_description TEXT,
  performed_by UUID,
  performed_by_name TEXT,
  target_user_id UUID,
  target_user_name TEXT,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  relevance_score NUMERIC
) AS $$
DECLARE
  search_text TEXT;
  limit_clause INTEGER;
BEGIN
  -- Check permissions
  IF NOT public.is_team_member(p_team_id, auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to search audit logs';
  END IF;

  -- Extract search parameters
  search_text := COALESCE(p_search_params->>'text_search', '');
  limit_clause := COALESCE((p_search_params->>'limit')::INTEGER, 100);

  RETURN QUERY
  SELECT
    tal.id,
    tal.team_id,
    tal.action,
    tal.action_description,
    tal.performed_by,
    tal.performed_by_name,
    tal.target_user_id,
    tal.target_user_name,
    tal.old_values,
    tal.new_values,
    tal.metadata,
    tal.created_at,
    CASE
      WHEN search_text = '' THEN 1.0
      WHEN tal.action_description ILIKE '%' || search_text || '%' THEN 1.0
      WHEN tal.performed_by_name ILIKE '%' || search_text || '%' THEN 0.9
      WHEN tal.target_user_name ILIKE '%' || search_text || '%' THEN 0.9
      WHEN tal.metadata::text ILIKE '%' || search_text || '%' THEN 0.8
      ELSE 0.5
    END as relevance_score
  FROM public.team_audit_logs tal
  WHERE tal.team_id = p_team_id
    AND (
      p_search_params->>'start_date' IS NULL OR
      tal.created_at >= (p_search_params->>'start_date')::TIMESTAMP WITH TIME ZONE
    )
    AND (
      p_search_params->>'end_date' IS NULL OR
      tal.created_at <= (p_search_params->>'end_date')::TIMESTAMP WITH TIME ZONE
    )
    AND (
      p_search_params->'actions' IS NULL OR
      tal.action::text = ANY(SELECT jsonb_array_elements_text(p_search_params->'actions'))
    )
    AND (
      p_search_params->>'user_id' IS NULL OR
      tal.performed_by = (p_search_params->>'user_id')::UUID OR
      tal.target_user_id = (p_search_params->>'user_id')::UUID
    )
    AND (
      search_text = '' OR
      tal.action_description ILIKE '%' || search_text || '%' OR
      tal.performed_by_name ILIKE '%' || search_text || '%' OR
      tal.target_user_name ILIKE '%' || search_text || '%' OR
      tal.metadata::text ILIKE '%' || search_text || '%'
    )
  ORDER BY relevance_score DESC, tal.created_at DESC
  LIMIT limit_clause;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get audit trail for a specific user
CREATE OR REPLACE FUNCTION public.get_user_audit_trail(
  p_team_id UUID,
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  id UUID,
  action team_audit_action,
  action_description TEXT,
  performed_by_name TEXT,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  is_actor BOOLEAN
) AS $$
BEGIN
  -- Check permissions
  IF NOT public.is_team_member(p_team_id, auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to view user audit trail';
  END IF;

  RETURN QUERY
  SELECT
    tal.id,
    tal.action,
    tal.action_description,
    tal.performed_by_name,
    tal.old_values,
    tal.new_values,
    tal.metadata,
    tal.created_at,
    (tal.performed_by = p_user_id) as is_actor
  FROM public.team_audit_logs tal
  WHERE tal.team_id = p_team_id
    AND (tal.performed_by = p_user_id OR tal.target_user_id = p_user_id)
  ORDER BY tal.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. AUDIT EXPORT AND COMPLIANCE FUNCTIONS
-- ============================================================================

-- Function to export audit logs for compliance
CREATE OR REPLACE FUNCTION public.export_audit_logs_for_compliance(
  p_team_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_format TEXT DEFAULT 'json'
) RETURNS JSONB AS $$
DECLARE
  export_data JSONB;
  record_count INTEGER;
BEGIN
  -- Check permissions (only owners can export for compliance)
  IF NOT public.is_team_member(p_team_id, auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Only team owners can export audit logs for compliance';
  END IF;

  -- Get audit logs for the specified period
  WITH audit_export AS (
    SELECT
      tal.id,
      tal.action,
      tal.action_description,
      tal.performed_by,
      tal.performed_by_email,
      tal.performed_by_name,
      tal.target_user_id,
      tal.target_user_email,
      tal.target_user_name,
      tal.old_values,
      tal.new_values,
      tal.metadata,
      tal.ip_address,
      tal.user_agent,
      tal.session_id,
      tal.created_at
    FROM public.team_audit_logs tal
    WHERE tal.team_id = p_team_id
      AND tal.created_at >= p_start_date
      AND tal.created_at <= p_end_date
    ORDER BY tal.created_at ASC
  )
  SELECT
    jsonb_build_object(
      'export_metadata', jsonb_build_object(
        'team_id', p_team_id,
        'export_date', NOW(),
        'exported_by', auth.uid(),
        'period_start', p_start_date,
        'period_end', p_end_date,
        'format', p_format,
        'record_count', COUNT(*)
      ),
      'audit_records', jsonb_agg(
        jsonb_build_object(
          'id', id,
          'action', action,
          'description', action_description,
          'actor', jsonb_build_object(
            'id', performed_by,
            'email', performed_by_email,
            'name', performed_by_name
          ),
          'target', CASE
            WHEN target_user_id IS NOT NULL THEN
              jsonb_build_object(
                'id', target_user_id,
                'email', target_user_email,
                'name', target_user_name
              )
            ELSE NULL
          END,
          'changes', jsonb_build_object(
            'old_values', old_values,
            'new_values', new_values
          ),
          'context', jsonb_build_object(
            'ip_address', ip_address,
            'user_agent', user_agent,
            'session_id', session_id,
            'metadata', metadata
          ),
          'timestamp', created_at
        )
        ORDER BY created_at
      )
    ),
    COUNT(*)
  INTO export_data, record_count
  FROM audit_export;

  -- Log the export action
  PERFORM public.log_team_audit_event_enhanced(
    p_team_id,
    'team_settings_updated'::team_audit_action,
    'Audit logs exported for compliance: ' || record_count || ' records',
    NULL,
    '{}',
    jsonb_build_object('exported_records', record_count),
    jsonb_build_object(
      'export_period_start', p_start_date,
      'export_period_end', p_end_date,
      'export_format', p_format,
      'operation_type', 'compliance_export'
    )
  );

  RETURN COALESCE(export_data, jsonb_build_object(
    'export_metadata', jsonb_build_object(
      'team_id', p_team_id,
      'export_date', NOW(),
      'exported_by', auth.uid(),
      'period_start', p_start_date,
      'period_end', p_end_date,
      'format', p_format,
      'record_count', 0
    ),
    'audit_records', '[]'
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. AUDIT TRIGGERS AND AUTOMATION
-- ============================================================================

-- Function to automatically log team member changes
CREATE OR REPLACE FUNCTION public.auto_log_team_member_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log member addition
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_team_audit_event_enhanced(
      NEW.team_id,
      'member_added'::team_audit_action,
      'Team member added with role: ' || NEW.role,
      NEW.user_id,
      '{}',
      jsonb_build_object('role', NEW.role, 'permissions', NEW.permissions),
      jsonb_build_object(
        'trigger_source', 'auto_team_member_changes',
        'added_by', NEW.added_by,
        'invitation_accepted_at', NEW.invitation_accepted_at
      )
    );
    RETURN NEW;
  END IF;

  -- Log member updates
  IF TG_OP = 'UPDATE' THEN
    -- Log role changes
    IF OLD.role != NEW.role THEN
      PERFORM public.log_team_audit_event_enhanced(
        NEW.team_id,
        'member_role_changed'::team_audit_action,
        'Member role changed from ' || OLD.role || ' to ' || NEW.role,
        NEW.user_id,
        jsonb_build_object('role', OLD.role),
        jsonb_build_object('role', NEW.role),
        jsonb_build_object(
          'trigger_source', 'auto_team_member_changes',
          'changed_by', auth.uid()
        )
      );
    END IF;

    -- Log permission changes
    IF OLD.permissions != NEW.permissions THEN
      PERFORM public.log_team_audit_event_enhanced(
        NEW.team_id,
        'member_permissions_updated'::team_audit_action,
        'Member permissions updated',
        NEW.user_id,
        jsonb_build_object('permissions', OLD.permissions),
        jsonb_build_object('permissions', NEW.permissions),
        jsonb_build_object(
          'trigger_source', 'auto_team_member_changes',
          'changed_by', auth.uid()
        )
      );
    END IF;

    RETURN NEW;
  END IF;

  -- Log member removal
  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_team_audit_event_enhanced(
      OLD.team_id,
      'member_removed'::team_audit_action,
      'Team member removed with role: ' || OLD.role,
      OLD.user_id,
      jsonb_build_object('role', OLD.role, 'permissions', OLD.permissions),
      '{}',
      jsonb_build_object(
        'trigger_source', 'auto_team_member_changes',
        'removed_by', auth.uid(),
        'last_active_at', OLD.last_active_at
      )
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic team member change logging
DROP TRIGGER IF EXISTS trigger_auto_log_team_member_changes ON public.team_members;
CREATE TRIGGER trigger_auto_log_team_member_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_log_team_member_changes();

-- Function to automatically log team changes
CREATE OR REPLACE FUNCTION public.auto_log_team_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log team creation
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_team_audit_event_enhanced(
      NEW.id,
      'team_created'::team_audit_action,
      'Team created: ' || NEW.name,
      NULL,
      '{}',
      jsonb_build_object('name', NEW.name, 'description', NEW.description),
      jsonb_build_object(
        'trigger_source', 'auto_team_changes',
        'owner_id', NEW.owner_id,
        'slug', NEW.slug
      )
    );
    RETURN NEW;
  END IF;

  -- Log team updates
  IF TG_OP = 'UPDATE' THEN
    -- Log name changes
    IF OLD.name != NEW.name THEN
      PERFORM public.log_team_audit_event_enhanced(
        NEW.id,
        'team_updated'::team_audit_action,
        'Team name changed from "' || OLD.name || '" to "' || NEW.name || '"',
        NULL,
        jsonb_build_object('name', OLD.name),
        jsonb_build_object('name', NEW.name),
        jsonb_build_object(
          'trigger_source', 'auto_team_changes',
          'changed_by', auth.uid()
        )
      );
    END IF;

    -- Log description changes
    IF COALESCE(OLD.description, '') != COALESCE(NEW.description, '') THEN
      PERFORM public.log_team_audit_event_enhanced(
        NEW.id,
        'team_updated'::team_audit_action,
        'Team description updated',
        NULL,
        jsonb_build_object('description', OLD.description),
        jsonb_build_object('description', NEW.description),
        jsonb_build_object(
          'trigger_source', 'auto_team_changes',
          'changed_by', auth.uid()
        )
      );
    END IF;

    -- Log settings changes
    IF OLD.settings != NEW.settings THEN
      PERFORM public.log_team_audit_event_enhanced(
        NEW.id,
        'team_settings_updated'::team_audit_action,
        'Team settings updated',
        NULL,
        jsonb_build_object('settings', OLD.settings),
        jsonb_build_object('settings', NEW.settings),
        jsonb_build_object(
          'trigger_source', 'auto_team_changes',
          'changed_by', auth.uid()
        )
      );
    END IF;

    -- Log owner changes
    IF OLD.owner_id != NEW.owner_id THEN
      PERFORM public.log_team_audit_event_enhanced(
        NEW.id,
        'owner_transferred'::team_audit_action,
        'Team ownership transferred',
        NEW.owner_id,
        jsonb_build_object('owner_id', OLD.owner_id),
        jsonb_build_object('owner_id', NEW.owner_id),
        jsonb_build_object(
          'trigger_source', 'auto_team_changes',
          'transferred_by', auth.uid(),
          'previous_owner', OLD.owner_id
        )
      );
    END IF;

    RETURN NEW;
  END IF;

  -- Log team deletion
  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_team_audit_event_enhanced(
      OLD.id,
      'team_deleted'::team_audit_action,
      'Team deleted: ' || OLD.name,
      NULL,
      jsonb_build_object('name', OLD.name, 'description', OLD.description),
      '{}',
      jsonb_build_object(
        'trigger_source', 'auto_team_changes',
        'deleted_by', auth.uid(),
        'owner_id', OLD.owner_id
      )
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic team change logging
DROP TRIGGER IF EXISTS trigger_auto_log_team_changes ON public.teams;
CREATE TRIGGER trigger_auto_log_team_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_log_team_changes();

-- ============================================================================
-- 7. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on audit functions
GRANT EXECUTE ON FUNCTION public.log_team_audit_event_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_bulk_audit_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_audit_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_old_audit_logs TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_audit_logs TO service_role;
GRANT EXECUTE ON FUNCTION public.search_audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_audit_trail TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_audit_logs_for_compliance TO authenticated;

-- Grant execute permissions on trigger functions
GRANT EXECUTE ON FUNCTION public.auto_log_team_member_changes TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_log_team_changes TO authenticated;

-- ============================================================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Additional indexes for audit search and analytics
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_action_created ON public.team_audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_performed_by_created ON public.team_audit_logs(performed_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_target_user_created ON public.team_audit_logs(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_metadata_gin ON public.team_audit_logs USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_description_text ON public.team_audit_logs USING GIN(to_tsvector('english', action_description));

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_team_action_date ON public.team_audit_logs(team_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_team_user_date ON public.team_audit_logs(team_id, performed_by, created_at DESC);

-- ============================================================================
-- 9. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.log_team_audit_event_enhanced IS 'Enhanced audit logging with IP address, user agent, and session tracking';
COMMENT ON FUNCTION public.log_bulk_audit_events IS 'Batch audit logging for bulk operations with transaction safety';
COMMENT ON FUNCTION public.get_team_audit_logs IS 'Retrieve audit logs with comprehensive filtering and pagination';
COMMENT ON FUNCTION public.get_audit_analytics IS 'Generate detailed audit analytics and statistics for teams';
COMMENT ON FUNCTION public.archive_old_audit_logs IS 'Archive old audit logs to separate tables for long-term retention';
COMMENT ON FUNCTION public.cleanup_audit_logs IS 'Hard delete old audit logs based on retention policies';
COMMENT ON FUNCTION public.search_audit_logs IS 'Advanced search functionality for audit logs with relevance scoring';
COMMENT ON FUNCTION public.get_user_audit_trail IS 'Get complete audit trail for a specific user';
COMMENT ON FUNCTION public.export_audit_logs_for_compliance IS 'Export audit logs in compliance-ready format';
COMMENT ON FUNCTION public.auto_log_team_member_changes IS 'Automatic trigger function for logging team member changes';
COMMENT ON FUNCTION public.auto_log_team_changes IS 'Automatic trigger function for logging team changes';

-- ============================================================================
-- 10. AUDIT SYSTEM CONFIGURATION
-- ============================================================================

-- Create audit system configuration table
CREATE TABLE IF NOT EXISTS public.audit_system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,

  -- Retention settings
  retention_days INTEGER DEFAULT 1095, -- 3 years
  archive_after_days INTEGER DEFAULT 365, -- 1 year

  -- Logging settings
  log_ip_addresses BOOLEAN DEFAULT true,
  log_user_agents BOOLEAN DEFAULT true,
  log_session_ids BOOLEAN DEFAULT true,

  -- Export settings
  allow_compliance_export BOOLEAN DEFAULT true,
  export_format TEXT DEFAULT 'json',

  -- Notification settings
  notify_on_sensitive_actions BOOLEAN DEFAULT true,
  sensitive_actions team_audit_action[] DEFAULT ARRAY[
    'owner_transferred',
    'member_removed',
    'team_deleted'
  ],

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Constraints
  UNIQUE(team_id),
  CONSTRAINT audit_config_valid_retention CHECK (retention_days > 0),
  CONSTRAINT audit_config_valid_archive CHECK (archive_after_days > 0 AND archive_after_days < retention_days)
);

-- Enable RLS on audit config
ALTER TABLE public.audit_system_config ENABLE ROW LEVEL SECURITY;

-- RLS policy for audit config
CREATE POLICY "Team owners can manage audit config" ON public.audit_system_config
  FOR ALL USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Function to get or create audit config
CREATE OR REPLACE FUNCTION public.get_audit_config(p_team_id UUID)
RETURNS public.audit_system_config AS $$
DECLARE
  config public.audit_system_config;
BEGIN
  -- Check permissions
  IF NOT public.is_team_member(p_team_id, auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Only team owners can access audit configuration';
  END IF;

  -- Get existing config or create default
  SELECT * INTO config FROM public.audit_system_config WHERE team_id = p_team_id;

  IF config.id IS NULL THEN
    INSERT INTO public.audit_system_config (team_id, updated_by)
    VALUES (p_team_id, auth.uid())
    RETURNING * INTO config;
  END IF;

  RETURN config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_audit_config TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Comprehensive Team Management Audit System migration completed successfully';
  RAISE NOTICE 'Enhanced functions: log_team_audit_event_enhanced, log_bulk_audit_events';
  RAISE NOTICE 'Reporting functions: get_team_audit_logs, get_audit_analytics, search_audit_logs';
  RAISE NOTICE 'Maintenance functions: archive_old_audit_logs, cleanup_audit_logs';
  RAISE NOTICE 'Compliance functions: export_audit_logs_for_compliance, get_user_audit_trail';
  RAISE NOTICE 'Automatic triggers: team_members and teams change logging';
  RAISE NOTICE 'Configuration: audit_system_config table with team-specific settings';
END $$;
