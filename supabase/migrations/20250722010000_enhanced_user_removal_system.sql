-- ============================================================================
-- ENHANCED USER REMOVAL SYSTEM
-- Migration: 20250722010000_enhanced_user_removal_system.sql
-- Description: Comprehensive user removal system with proper data cleanup,
--              access revocation, and edge case handling
-- ============================================================================

-- ============================================================================
-- 1. ENHANCED REMOVE TEAM MEMBER FUNCTION
-- ============================================================================

-- Drop existing function to replace with enhanced version
DROP FUNCTION IF EXISTS public.remove_team_member(uuid, uuid);

-- Create comprehensive team member removal function
CREATE OR REPLACE FUNCTION public.remove_team_member_enhanced(
  _team_id UUID,
  _user_id UUID,
  _reason TEXT DEFAULT NULL,
  _transfer_data BOOLEAN DEFAULT false,
  _transfer_to_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  _member_role public.team_member_role;
  _team_owner_id UUID;
  _admin_count INTEGER;
  _total_members INTEGER;
  _removal_summary JSONB;
  _cleanup_results JSONB := '{}';
  _current_user_id UUID := auth.uid();
  _current_user_role public.team_member_role;
BEGIN
  -- Get current user's role in the team
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _current_user_id;

  -- Get the member's role and team info
  SELECT tm.role, t.owner_id INTO _member_role, _team_owner_id
  FROM public.team_members tm
  JOIN public.teams t ON tm.team_id = t.id
  WHERE tm.team_id = _team_id AND tm.user_id = _user_id;

  -- Validation checks
  IF _member_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User is not a team member',
      'error_code', 'NOT_MEMBER'
    );
  END IF;

  -- Cannot remove the team owner
  IF _member_role = 'owner' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot remove team owner. Transfer ownership first.',
      'error_code', 'CANNOT_REMOVE_OWNER'
    );
  END IF;

  -- Permission checks
  IF NOT (_current_user_role IN ('owner', 'admin') OR _user_id = _current_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient permissions to remove team member',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  -- Check if removing last admin (excluding owner)
  SELECT COUNT(*) INTO _admin_count
  FROM public.team_members
  WHERE team_id = _team_id AND role = 'admin' AND user_id != _user_id;

  SELECT COUNT(*) INTO _total_members
  FROM public.team_members
  WHERE team_id = _team_id;

  -- Prevent removing last admin if there are other members
  IF _member_role = 'admin' AND _admin_count = 0 AND _total_members > 2 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot remove the last admin. Promote another member to admin first.',
      'error_code', 'LAST_ADMIN'
    );
  END IF;

  -- Start comprehensive cleanup process
  BEGIN
    -- 1. Handle data transfer if requested
    IF _transfer_data AND _transfer_to_user_id IS NOT NULL THEN
      -- Verify transfer target is a team member
      IF NOT EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE team_id = _team_id AND user_id = _transfer_to_user_id
      ) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Transfer target must be a team member',
          'error_code', 'INVALID_TRANSFER_TARGET'
        );
      END IF;

      -- Transfer receipts ownership
      UPDATE public.receipts 
      SET user_id = _transfer_to_user_id,
          metadata = COALESCE(metadata, '{}') || jsonb_build_object(
            'transferred_from', _user_id,
            'transferred_at', NOW(),
            'transferred_by', _current_user_id
          )
      WHERE user_id = _user_id AND team_id = _team_id;

      -- Transfer claims ownership
      UPDATE public.claims
      SET claimant_id = _transfer_to_user_id,
          metadata = COALESCE(metadata, '{}') || jsonb_build_object(
            'transferred_from', _user_id,
            'transferred_at', NOW(),
            'transferred_by', _current_user_id
          )
      WHERE claimant_id = _user_id AND team_id = _team_id;

      _cleanup_results := _cleanup_results || jsonb_build_object(
        'data_transferred', true,
        'transfer_target', _transfer_to_user_id
      );
    ELSE
      -- 2. Clean up user's team-specific data
      
      -- Delete user's receipts in this team
      DELETE FROM public.receipts 
      WHERE user_id = _user_id AND team_id = _team_id;

      -- Delete user's claims in this team
      DELETE FROM public.claims
      WHERE claimant_id = _user_id AND team_id = _team_id;

      -- Delete user's API keys for this team
      DELETE FROM public.api_keys
      WHERE user_id = _user_id AND team_id = _team_id;

      -- Clean up conversation data related to this team
      DELETE FROM public.conversation_messages
      WHERE user_id = _user_id 
        AND metadata->>'team_id' = _team_id::text;

      -- Clean up user interactions for this team
      DELETE FROM public.user_interactions
      WHERE user_id = _user_id 
        AND interaction_context->>'team_id' = _team_id::text;

      -- Clean up theme preferences (if team-specific)
      DELETE FROM public.theme_preferences
      WHERE user_id = _user_id 
        AND metadata->>'team_id' = _team_id::text;

      _cleanup_results := _cleanup_results || jsonb_build_object(
        'data_deleted', true,
        'receipts_deleted', true,
        'claims_deleted', true,
        'api_keys_deleted', true
      );
    END IF;

    -- 3. Clean up team-specific user data
    
    -- Cancel any pending invitations sent by this user
    UPDATE public.team_invitations
    SET status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = _current_user_id,
        cancellation_reason = 'Member removed from team'
    WHERE invited_by = _user_id AND team_id = _team_id AND status = 'pending';

    -- Clean up rate limiting data
    DELETE FROM public.team_invitation_rate_limits
    WHERE team_id = _team_id AND user_id = _user_id;

    -- Clean up bulk operations performed by this user
    UPDATE public.team_bulk_operations
    SET operation_status = 'cancelled',
        error_summary = 'Operation cancelled due to member removal',
        completed_at = NOW()
    WHERE team_id = _team_id 
      AND performed_by = _user_id 
      AND operation_status IN ('pending', 'in_progress');

    -- Clean up alert assignments
    DELETE FROM public.alert_assignments
    WHERE assigned_to = _user_id 
      AND alert_id IN (
        SELECT id FROM public.alerts WHERE team_id = _team_id
      );

    -- Clean up on-call schedule entries
    DELETE FROM public.on_call_schedule_entries
    WHERE user_id = _user_id
      AND schedule_id IN (
        SELECT id FROM public.on_call_schedules WHERE team_id = _team_id
      );

    -- 4. Remove the team member record
    DELETE FROM public.team_members
    WHERE team_id = _team_id AND user_id = _user_id;

    -- 5. Log the removal action
    PERFORM public.log_team_audit_event(
      _team_id,
      'member_removed'::team_audit_action,
      COALESCE(_reason, 'Team member removed'),
      _user_id,
      jsonb_build_object('role', _member_role),
      '{}',
      jsonb_build_object(
        'removal_reason', _reason,
        'data_transferred', _transfer_data,
        'transfer_target', _transfer_to_user_id,
        'cleanup_results', _cleanup_results
      )
    );

    -- Build success response
    _removal_summary := jsonb_build_object(
      'success', true,
      'removed_user_id', _user_id,
      'removed_role', _member_role,
      'removal_reason', _reason,
      'data_transferred', _transfer_data,
      'transfer_target', _transfer_to_user_id,
      'cleanup_performed', _cleanup_results,
      'removed_at', NOW()
    );

    RETURN _removal_summary;

  EXCEPTION WHEN OTHERS THEN
    -- Log the error and return failure
    PERFORM public.log_team_audit_event(
      _team_id,
      'member_removed'::team_audit_action,
      'Failed to remove team member: ' || SQLERRM,
      _user_id,
      jsonb_build_object('role', _member_role),
      '{}',
      jsonb_build_object(
        'error', SQLERRM,
        'error_detail', SQLSTATE,
        'removal_reason', _reason
      )
    );

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to remove team member: ' || SQLERRM,
      'error_code', 'REMOVAL_FAILED',
      'error_detail', SQLSTATE
    );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. TEAM OWNERSHIP TRANSFER FUNCTION
-- ============================================================================

-- Function to transfer team ownership
CREATE OR REPLACE FUNCTION public.transfer_team_ownership(
  _team_id UUID,
  _new_owner_id UUID,
  _reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  _current_owner_id UUID;
  _current_user_id UUID := auth.uid();
  _new_owner_role public.team_member_role;
BEGIN
  -- Get current team owner
  SELECT owner_id INTO _current_owner_id
  FROM public.teams
  WHERE id = _team_id;

  -- Verify current user is the owner
  IF _current_owner_id != _current_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only the team owner can transfer ownership',
      'error_code', 'NOT_OWNER'
    );
  END IF;

  -- Verify new owner is a team member
  SELECT role INTO _new_owner_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _new_owner_id;

  IF _new_owner_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'New owner must be a team member',
      'error_code', 'NOT_MEMBER'
    );
  END IF;

  BEGIN
    -- Update team owner
    UPDATE public.teams
    SET owner_id = _new_owner_id,
        updated_at = NOW()
    WHERE id = _team_id;

    -- Update old owner role to admin
    UPDATE public.team_members
    SET role = 'admin',
        updated_at = NOW()
    WHERE team_id = _team_id AND user_id = _current_owner_id;

    -- Update new owner role to owner
    UPDATE public.team_members
    SET role = 'owner',
        updated_at = NOW()
    WHERE team_id = _team_id AND user_id = _new_owner_id;

    -- Log the ownership transfer
    PERFORM public.log_team_audit_event(
      _team_id,
      'owner_transferred'::team_audit_action,
      COALESCE(_reason, 'Team ownership transferred'),
      _new_owner_id,
      jsonb_build_object('old_owner', _current_owner_id, 'old_role', _new_owner_role),
      jsonb_build_object('new_owner', _new_owner_id, 'new_role', 'owner'),
      jsonb_build_object(
        'transfer_reason', _reason,
        'previous_owner', _current_owner_id
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'previous_owner', _current_owner_id,
      'new_owner', _new_owner_id,
      'transfer_reason', _reason,
      'transferred_at', NOW()
    );

  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to transfer ownership: ' || SQLERRM,
      'error_code', 'TRANSFER_FAILED'
    );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. SCHEDULED REMOVAL FUNCTIONS
-- ============================================================================

-- Function to schedule member removal
CREATE OR REPLACE FUNCTION public.schedule_member_removal(
  _team_id UUID,
  _user_id UUID,
  _removal_date TIMESTAMP WITH TIME ZONE,
  _reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  _current_user_id UUID := auth.uid();
  _current_user_role public.team_member_role;
  _target_role public.team_member_role;
BEGIN
  -- Get current user's role
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _current_user_id;

  -- Get target user's role
  SELECT role INTO _target_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _user_id;

  -- Permission checks
  IF _current_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only team owners and admins can schedule member removal',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  IF _target_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User is not a team member',
      'error_code', 'NOT_MEMBER'
    );
  END IF;

  IF _target_role = 'owner' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot schedule removal of team owner',
      'error_code', 'CANNOT_SCHEDULE_OWNER'
    );
  END IF;

  -- Schedule the removal
  UPDATE public.team_members
  SET removal_scheduled_at = _removal_date,
      removal_scheduled_by = _current_user_id,
      member_metadata = COALESCE(member_metadata, '{}') || jsonb_build_object(
        'removal_reason', _reason,
        'scheduled_at', NOW()
      ),
      updated_at = NOW()
  WHERE team_id = _team_id AND user_id = _user_id;

  -- Log the scheduling
  PERFORM public.log_team_audit_event(
    _team_id,
    'member_removal_scheduled'::team_audit_action,
    'Member removal scheduled for ' || _removal_date::text,
    _user_id,
    '{}',
    jsonb_build_object('scheduled_removal_date', _removal_date),
    jsonb_build_object(
      'removal_reason', _reason,
      'scheduled_by', _current_user_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', _user_id,
    'scheduled_removal_date', _removal_date,
    'reason', _reason,
    'scheduled_by', _current_user_id,
    'scheduled_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cancel scheduled removal
CREATE OR REPLACE FUNCTION public.cancel_scheduled_removal(
  _team_id UUID,
  _user_id UUID,
  _reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  _current_user_id UUID := auth.uid();
  _current_user_role public.team_member_role;
BEGIN
  -- Get current user's role
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _current_user_id;

  -- Permission checks
  IF _current_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only team owners and admins can cancel scheduled removal',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  -- Cancel the scheduled removal
  UPDATE public.team_members
  SET removal_scheduled_at = NULL,
      removal_scheduled_by = NULL,
      member_metadata = COALESCE(member_metadata, '{}') || jsonb_build_object(
        'removal_cancelled_at', NOW(),
        'removal_cancelled_by', _current_user_id,
        'cancellation_reason', _reason
      ),
      updated_at = NOW()
  WHERE team_id = _team_id AND user_id = _user_id;

  -- Log the cancellation
  PERFORM public.log_team_audit_event(
    _team_id,
    'member_removal_cancelled'::team_audit_action,
    'Scheduled member removal cancelled',
    _user_id,
    '{}',
    '{}',
    jsonb_build_object(
      'cancellation_reason', _reason,
      'cancelled_by', _current_user_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', _user_id,
    'cancellation_reason', _reason,
    'cancelled_by', _current_user_id,
    'cancelled_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. PROCESS SCHEDULED REMOVALS FUNCTION
-- ============================================================================

-- Function to process scheduled removals (called by cron job)
CREATE OR REPLACE FUNCTION public.process_scheduled_removals()
RETURNS JSONB AS $$
DECLARE
  _removal_record RECORD;
  _processed_count INTEGER := 0;
  _failed_count INTEGER := 0;
  _results JSONB := '[]';
  _removal_result JSONB;
BEGIN
  -- Find all members scheduled for removal
  FOR _removal_record IN
    SELECT tm.team_id, tm.user_id, tm.removal_scheduled_at, tm.removal_scheduled_by,
           tm.member_metadata->>'removal_reason' as removal_reason
    FROM public.team_members tm
    WHERE tm.removal_scheduled_at IS NOT NULL
      AND tm.removal_scheduled_at <= NOW()
  LOOP
    BEGIN
      -- Process the removal
      SELECT public.remove_team_member_enhanced(
        _removal_record.team_id,
        _removal_record.user_id,
        'Scheduled removal: ' || COALESCE(_removal_record.removal_reason, 'No reason provided'),
        false, -- Don't transfer data for scheduled removals
        NULL
      ) INTO _removal_result;

      IF (_removal_result->>'success')::boolean THEN
        _processed_count := _processed_count + 1;
        _results := _results || jsonb_build_object(
          'team_id', _removal_record.team_id,
          'user_id', _removal_record.user_id,
          'status', 'success',
          'scheduled_at', _removal_record.removal_scheduled_at
        );
      ELSE
        _failed_count := _failed_count + 1;
        _results := _results || jsonb_build_object(
          'team_id', _removal_record.team_id,
          'user_id', _removal_record.user_id,
          'status', 'failed',
          'error', _removal_result->>'error',
          'scheduled_at', _removal_record.removal_scheduled_at
        );
      END IF;

    EXCEPTION WHEN OTHERS THEN
      _failed_count := _failed_count + 1;
      _results := _results || jsonb_build_object(
        'team_id', _removal_record.team_id,
        'user_id', _removal_record.user_id,
        'status', 'failed',
        'error', SQLERRM,
        'scheduled_at', _removal_record.removal_scheduled_at
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'processed_count', _processed_count,
    'failed_count', _failed_count,
    'total_scheduled', _processed_count + _failed_count,
    'results', _results,
    'processed_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. SESSION INVALIDATION FUNCTION
-- ============================================================================

-- Function to invalidate user sessions for a specific team context
CREATE OR REPLACE FUNCTION public.invalidate_user_team_sessions(
  _user_id UUID,
  _team_id UUID
) RETURNS JSONB AS $$
DECLARE
  _session_count INTEGER := 0;
BEGIN
  -- Note: Supabase doesn't provide direct session management via SQL
  -- This function serves as a placeholder for session invalidation logic
  -- In practice, this would be handled by:
  -- 1. Revoking refresh tokens (requires admin API)
  -- 2. Adding user to a "revoked sessions" table that's checked on each request
  -- 3. Using JWT blacklisting mechanisms

  -- For now, we'll log the session invalidation request
  INSERT INTO public.team_audit_logs (
    team_id,
    action,
    action_description,
    performed_by,
    target_user_id,
    metadata
  ) VALUES (
    _team_id,
    'member_sessions_invalidated'::team_audit_action,
    'User sessions invalidated due to team removal',
    '00000000-0000-0000-0000-000000000000'::UUID, -- System user
    _user_id,
    jsonb_build_object(
      'invalidation_reason', 'team_member_removed',
      'invalidated_at', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', _user_id,
    'team_id', _team_id,
    'sessions_invalidated', _session_count,
    'invalidated_at', NOW(),
    'note', 'Session invalidation logged. Actual invalidation requires application-level handling.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. BULK MEMBER REMOVAL FUNCTION
-- ============================================================================

-- Function for bulk member removal
CREATE OR REPLACE FUNCTION public.bulk_remove_team_members(
  _team_id UUID,
  _user_ids UUID[],
  _reason TEXT DEFAULT NULL,
  _transfer_data BOOLEAN DEFAULT false,
  _transfer_to_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  _current_user_id UUID := auth.uid();
  _current_user_role public.team_member_role;
  _user_id UUID;
  _removal_result JSONB;
  _results JSONB := '[]';
  _success_count INTEGER := 0;
  _failed_count INTEGER := 0;
  _bulk_operation_id UUID;
BEGIN
  -- Get current user's role
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _current_user_id;

  -- Permission checks
  IF _current_user_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only team owners and admins can perform bulk removal',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

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
    _team_id,
    'bulk_remove',
    'in_progress',
    _current_user_id,
    to_jsonb(_user_ids),
    jsonb_build_object(
      'reason', _reason,
      'transfer_data', _transfer_data,
      'transfer_to_user_id', _transfer_to_user_id
    ),
    array_length(_user_ids, 1)
  ) RETURNING id INTO _bulk_operation_id;

  -- Process each user removal
  FOREACH _user_id IN ARRAY _user_ids
  LOOP
    BEGIN
      SELECT public.remove_team_member_enhanced(
        _team_id,
        _user_id,
        'Bulk removal: ' || COALESCE(_reason, 'No reason provided'),
        _transfer_data,
        _transfer_to_user_id
      ) INTO _removal_result;

      IF (_removal_result->>'success')::boolean THEN
        _success_count := _success_count + 1;
      ELSE
        _failed_count := _failed_count + 1;
      END IF;

      _results := _results || jsonb_build_object(
        'user_id', _user_id,
        'result', _removal_result
      );

    EXCEPTION WHEN OTHERS THEN
      _failed_count := _failed_count + 1;
      _results := _results || jsonb_build_object(
        'user_id', _user_id,
        'result', jsonb_build_object(
          'success', false,
          'error', SQLERRM,
          'error_code', 'REMOVAL_EXCEPTION'
        )
      );
    END;
  END LOOP;

  -- Update bulk operation record
  UPDATE public.team_bulk_operations
  SET operation_status = 'completed',
      processed_items = _success_count + _failed_count,
      successful_items = _success_count,
      failed_items = _failed_count,
      results = _results,
      completed_at = NOW()
  WHERE id = _bulk_operation_id;

  RETURN jsonb_build_object(
    'success', true,
    'bulk_operation_id', _bulk_operation_id,
    'total_users', array_length(_user_ids, 1),
    'successful_removals', _success_count,
    'failed_removals', _failed_count,
    'results', _results,
    'completed_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. BACKWARD COMPATIBILITY WRAPPER
-- ============================================================================

-- Create backward compatibility wrapper for existing remove_team_member function
CREATE OR REPLACE FUNCTION public.remove_team_member(
  _team_id UUID,
  _user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  _result JSONB;
BEGIN
  -- Call the enhanced function with default parameters
  SELECT public.remove_team_member_enhanced(
    _team_id,
    _user_id,
    'Member removed via legacy function',
    false,
    NULL
  ) INTO _result;

  -- Return boolean for backward compatibility
  RETURN (_result->>'success')::boolean;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION public.remove_team_member_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_team_ownership TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_member_removal TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_removal TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_scheduled_removals TO service_role;
GRANT EXECUTE ON FUNCTION public.invalidate_user_team_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_remove_team_members TO authenticated;

-- ============================================================================
-- 9. TRIGGERS FOR AUTOMATIC CLEANUP
-- ============================================================================

-- Trigger to automatically clean up related data when a user is deleted from auth.users
CREATE OR REPLACE FUNCTION public.cleanup_user_team_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Clean up team memberships
  DELETE FROM public.team_members WHERE user_id = OLD.id;

  -- Clean up pending invitations
  UPDATE public.team_invitations
  SET status = 'cancelled',
      cancelled_at = NOW(),
      cancellation_reason = 'User account deleted'
  WHERE invited_by = OLD.id AND status = 'pending';

  -- Clean up rate limiting data
  DELETE FROM public.team_invitation_rate_limits WHERE user_id = OLD.id;

  -- Clean up bulk operations
  UPDATE public.team_bulk_operations
  SET operation_status = 'cancelled',
      error_summary = 'Operation cancelled due to user deletion',
      completed_at = NOW()
  WHERE performed_by = OLD.id AND operation_status IN ('pending', 'in_progress');

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for user deletion cleanup
DROP TRIGGER IF EXISTS trigger_cleanup_user_team_data ON auth.users;
CREATE TRIGGER trigger_cleanup_user_team_data
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_user_team_data();

-- ============================================================================
-- 10. UTILITY FUNCTIONS
-- ============================================================================

-- Function to get removal candidates (inactive members)
CREATE OR REPLACE FUNCTION public.get_removal_candidates(
  _team_id UUID,
  _inactive_days INTEGER DEFAULT 90
) RETURNS TABLE (
  user_id UUID,
  email VARCHAR(255),
  full_name TEXT,
  role team_member_role,
  last_active_at TIMESTAMP WITH TIME ZONE,
  days_inactive INTEGER,
  joined_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tm.user_id,
    au.email,
    COALESCE(p.first_name || ' ' || p.last_name, au.email) as full_name,
    tm.role,
    tm.last_active_at,
    CASE
      WHEN tm.last_active_at IS NULL THEN
        EXTRACT(DAY FROM NOW() - tm.joined_at)::INTEGER
      ELSE
        EXTRACT(DAY FROM NOW() - tm.last_active_at)::INTEGER
    END as days_inactive,
    tm.joined_at
  FROM public.team_members tm
  JOIN auth.users au ON tm.user_id = au.id
  LEFT JOIN public.profiles p ON au.id = p.id
  WHERE tm.team_id = _team_id
    AND tm.role != 'owner' -- Never suggest removing owner
    AND (
      tm.last_active_at IS NULL AND tm.joined_at <= NOW() - INTERVAL '1 day' * _inactive_days
      OR tm.last_active_at <= NOW() - INTERVAL '1 day' * _inactive_days
    )
    AND public.is_team_member(_team_id, auth.uid(), 'admin') -- Only admins can see candidates
  ORDER BY
    CASE
      WHEN tm.last_active_at IS NULL THEN tm.joined_at
      ELSE tm.last_active_at
    END ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get team member statistics
CREATE OR REPLACE FUNCTION public.get_team_member_stats(_team_id UUID)
RETURNS JSONB AS $$
DECLARE
  _stats JSONB;
BEGIN
  -- Verify user has access to team
  IF NOT public.is_team_member(_team_id, auth.uid(), 'viewer') THEN
    RETURN jsonb_build_object('error', 'Access denied to team');
  END IF;

  SELECT jsonb_build_object(
    'total_members', COUNT(*),
    'active_members', COUNT(*) FILTER (WHERE last_active_at >= NOW() - INTERVAL '30 days'),
    'inactive_members', COUNT(*) FILTER (WHERE last_active_at < NOW() - INTERVAL '30 days' OR last_active_at IS NULL),
    'owners', COUNT(*) FILTER (WHERE role = 'owner'),
    'admins', COUNT(*) FILTER (WHERE role = 'admin'),
    'members', COUNT(*) FILTER (WHERE role = 'member'),
    'viewers', COUNT(*) FILTER (WHERE role = 'viewer'),
    'scheduled_removals', COUNT(*) FILTER (WHERE removal_scheduled_at IS NOT NULL),
    'recent_joins', COUNT(*) FILTER (WHERE joined_at >= NOW() - INTERVAL '7 days')
  ) INTO _stats
  FROM public.team_members
  WHERE team_id = _team_id;

  RETURN _stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions on utility functions
GRANT EXECUTE ON FUNCTION public.get_removal_candidates TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_member_stats TO authenticated;

-- ============================================================================
-- 11. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.remove_team_member_enhanced IS 'Comprehensive team member removal with data cleanup and transfer options';
COMMENT ON FUNCTION public.transfer_team_ownership IS 'Transfer team ownership to another team member';
COMMENT ON FUNCTION public.schedule_member_removal IS 'Schedule a team member for future removal';
COMMENT ON FUNCTION public.cancel_scheduled_removal IS 'Cancel a previously scheduled member removal';
COMMENT ON FUNCTION public.process_scheduled_removals IS 'Process all scheduled member removals (system function)';
COMMENT ON FUNCTION public.bulk_remove_team_members IS 'Remove multiple team members in a single operation';
COMMENT ON FUNCTION public.get_removal_candidates IS 'Get list of inactive members who could be removed';
COMMENT ON FUNCTION public.get_team_member_stats IS 'Get comprehensive statistics about team membership';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Enhanced User Removal System migration completed successfully';
  RAISE NOTICE 'New functions: remove_team_member_enhanced, transfer_team_ownership, schedule_member_removal, bulk_remove_team_members';
  RAISE NOTICE 'Utility functions: get_removal_candidates, get_team_member_stats';
  RAISE NOTICE 'Automatic cleanup triggers installed';
END $$;
