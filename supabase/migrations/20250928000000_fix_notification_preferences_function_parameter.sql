-- Fix notification preferences function parameter name mismatch
-- Migration: 20250928000000_fix_notification_preferences_function_parameter.sql
-- 
-- Issue: The get_user_notification_preferences function exists with parameter 'p_user_id'
-- but the code is calling it with '_user_id', causing 404 errors.
-- 
-- Solution: Recreate the function with the correct parameter name to match code expectations.

-- Drop the existing function with incorrect parameter name
DROP FUNCTION IF EXISTS public.get_user_notification_preferences(p_user_id UUID);

-- Recreate the function with correct parameter name and proper implementation
CREATE OR REPLACE FUNCTION public.get_user_notification_preferences(_user_id UUID)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  email_enabled BOOLEAN,
  email_receipt_processing_completed BOOLEAN,
  email_receipt_processing_failed BOOLEAN,
  email_receipt_ready_for_review BOOLEAN,
  email_receipt_batch_completed BOOLEAN,
  email_team_invitations BOOLEAN,
  email_team_activity BOOLEAN,
  email_billing_updates BOOLEAN,
  email_security_alerts BOOLEAN,
  email_weekly_reports BOOLEAN,
  email_team_member_removed BOOLEAN,
  push_enabled BOOLEAN,
  push_receipt_processing_completed BOOLEAN,
  push_receipt_processing_failed BOOLEAN,
  push_receipt_ready_for_review BOOLEAN,
  push_receipt_batch_completed BOOLEAN,
  push_team_invitations BOOLEAN,
  push_team_activity BOOLEAN,
  push_receipt_comments BOOLEAN,
  push_receipt_shared BOOLEAN,
  push_team_member_removed BOOLEAN,
  browser_permission_granted BOOLEAN,
  browser_permission_requested_at TIMESTAMP WITH TIME ZONE,
  quiet_hours_enabled BOOLEAN,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone TEXT,
  daily_digest_enabled BOOLEAN,
  weekly_digest_enabled BOOLEAN,
  digest_time TIME,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    COALESCE(np.id, gen_random_uuid()) as id,
    _user_id as user_id,
    COALESCE(np.email_enabled, true) as email_enabled,
    COALESCE(np.email_receipt_processing_completed, true) as email_receipt_processing_completed,
    COALESCE(np.email_receipt_processing_failed, true) as email_receipt_processing_failed,
    COALESCE(np.email_receipt_ready_for_review, false) as email_receipt_ready_for_review,
    COALESCE(np.email_receipt_batch_completed, true) as email_receipt_batch_completed,
    COALESCE(np.email_team_invitations, true) as email_team_invitations,
    COALESCE(np.email_team_activity, false) as email_team_activity,
    COALESCE(np.email_billing_updates, true) as email_billing_updates,
    COALESCE(np.email_security_alerts, true) as email_security_alerts,
    COALESCE(np.email_weekly_reports, false) as email_weekly_reports,
    COALESCE(np.email_team_member_removed, true) as email_team_member_removed,
    COALESCE(np.push_enabled, true) as push_enabled,
    COALESCE(np.push_receipt_processing_completed, true) as push_receipt_processing_completed,
    COALESCE(np.push_receipt_processing_failed, true) as push_receipt_processing_failed,
    COALESCE(np.push_receipt_ready_for_review, true) as push_receipt_ready_for_review,
    COALESCE(np.push_receipt_batch_completed, true) as push_receipt_batch_completed,
    COALESCE(np.push_team_invitations, true) as push_team_invitations,
    COALESCE(np.push_team_activity, true) as push_team_activity,
    COALESCE(np.push_receipt_comments, true) as push_receipt_comments,
    COALESCE(np.push_receipt_shared, true) as push_receipt_shared,
    COALESCE(np.push_team_member_removed, true) as push_team_member_removed,
    COALESCE(np.browser_permission_granted, false) as browser_permission_granted,
    np.browser_permission_requested_at,
    COALESCE(np.quiet_hours_enabled, false) as quiet_hours_enabled,
    np.quiet_hours_start,
    np.quiet_hours_end,
    COALESCE(np.timezone, 'Asia/Kuala_Lumpur') as timezone,
    COALESCE(np.daily_digest_enabled, false) as daily_digest_enabled,
    COALESCE(np.weekly_digest_enabled, false) as weekly_digest_enabled,
    COALESCE(np.digest_time, '09:00'::TIME) as digest_time,
    COALESCE(np.created_at, NOW()) as created_at,
    COALESCE(np.updated_at, NOW()) as updated_at
  FROM (SELECT _user_id) u
  LEFT JOIN public.notification_preferences np ON np.user_id = _user_id;
$function$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_user_notification_preferences(UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_user_notification_preferences(UUID) IS 
'Returns user notification preferences with defaults. Fixed parameter name to match code expectations.';
