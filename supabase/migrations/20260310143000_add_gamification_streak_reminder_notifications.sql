-- Wave 3 streak reminder notification plumbing
-- Migration: 20260310143000_add_gamification_streak_reminder_notifications.sql

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'gamification_streak_reminder';

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_team_member_removed BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_team_member_removed BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_gamification_streak_reminders BOOLEAN DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_streak_reminder_once_per_local_day_idx
  ON public.notifications (recipient_id, type, ((metadata->>'local_date')))
  WHERE type = 'gamification_streak_reminder';

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
  push_gamification_streak_reminders BOOLEAN,
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
    COALESCE(np.push_gamification_streak_reminders, true) as push_gamification_streak_reminders,
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

CREATE OR REPLACE FUNCTION public.upsert_notification_preferences(
  _user_id UUID,
  _preferences JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  _result_id UUID;
BEGIN
  INSERT INTO public.notification_preferences (
    user_id,
    email_enabled,
    email_receipt_processing_completed,
    email_receipt_processing_failed,
    email_receipt_ready_for_review,
    email_receipt_batch_completed,
    email_team_invitations,
    email_team_activity,
    email_billing_updates,
    email_security_alerts,
    email_weekly_reports,
    email_team_member_removed,
    push_enabled,
    push_receipt_processing_completed,
    push_receipt_processing_failed,
    push_receipt_ready_for_review,
    push_receipt_batch_completed,
    push_team_invitations,
    push_team_activity,
    push_receipt_comments,
    push_receipt_shared,
    push_team_member_removed,
    push_gamification_streak_reminders,
    browser_permission_granted,
    browser_permission_requested_at,
    quiet_hours_enabled,
    quiet_hours_start,
    quiet_hours_end,
    timezone,
    daily_digest_enabled,
    weekly_digest_enabled,
    digest_time,
    updated_at
  )
  VALUES (
    _user_id,
    COALESCE((_preferences->>'email_enabled')::BOOLEAN, true),
    COALESCE((_preferences->>'email_receipt_processing_completed')::BOOLEAN, true),
    COALESCE((_preferences->>'email_receipt_processing_failed')::BOOLEAN, true),
    COALESCE((_preferences->>'email_receipt_ready_for_review')::BOOLEAN, false),
    COALESCE((_preferences->>'email_receipt_batch_completed')::BOOLEAN, true),
    COALESCE((_preferences->>'email_team_invitations')::BOOLEAN, true),
    COALESCE((_preferences->>'email_team_activity')::BOOLEAN, false),
    COALESCE((_preferences->>'email_billing_updates')::BOOLEAN, true),
    COALESCE((_preferences->>'email_security_alerts')::BOOLEAN, true),
    COALESCE((_preferences->>'email_weekly_reports')::BOOLEAN, false),
    COALESCE((_preferences->>'email_team_member_removed')::BOOLEAN, true),
    COALESCE((_preferences->>'push_enabled')::BOOLEAN, true),
    COALESCE((_preferences->>'push_receipt_processing_completed')::BOOLEAN, true),
    COALESCE((_preferences->>'push_receipt_processing_failed')::BOOLEAN, true),
    COALESCE((_preferences->>'push_receipt_ready_for_review')::BOOLEAN, true),
    COALESCE((_preferences->>'push_receipt_batch_completed')::BOOLEAN, true),
    COALESCE((_preferences->>'push_team_invitations')::BOOLEAN, true),
    COALESCE((_preferences->>'push_team_activity')::BOOLEAN, true),
    COALESCE((_preferences->>'push_receipt_comments')::BOOLEAN, true),
    COALESCE((_preferences->>'push_receipt_shared')::BOOLEAN, true),
    COALESCE((_preferences->>'push_team_member_removed')::BOOLEAN, true),
    COALESCE((_preferences->>'push_gamification_streak_reminders')::BOOLEAN, true),
    COALESCE((_preferences->>'browser_permission_granted')::BOOLEAN, false),
    CASE
      WHEN _preferences->>'browser_permission_requested_at' IS NOT NULL
      THEN (_preferences->>'browser_permission_requested_at')::TIMESTAMP WITH TIME ZONE
      ELSE NULL
    END,
    COALESCE((_preferences->>'quiet_hours_enabled')::BOOLEAN, false),
    CASE
      WHEN _preferences->>'quiet_hours_start' IS NOT NULL
      THEN (_preferences->>'quiet_hours_start')::TIME
      ELSE NULL
    END,
    CASE
      WHEN _preferences->>'quiet_hours_end' IS NOT NULL
      THEN (_preferences->>'quiet_hours_end')::TIME
      ELSE NULL
    END,
    COALESCE(_preferences->>'timezone', 'Asia/Kuala_Lumpur'),
    COALESCE((_preferences->>'daily_digest_enabled')::BOOLEAN, false),
    COALESCE((_preferences->>'weekly_digest_enabled')::BOOLEAN, false),
    CASE
      WHEN _preferences->>'digest_time' IS NOT NULL
      THEN (_preferences->>'digest_time')::TIME
      ELSE '09:00'::TIME
    END,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email_enabled = EXCLUDED.email_enabled,
    email_receipt_processing_completed = EXCLUDED.email_receipt_processing_completed,
    email_receipt_processing_failed = EXCLUDED.email_receipt_processing_failed,
    email_receipt_ready_for_review = EXCLUDED.email_receipt_ready_for_review,
    email_receipt_batch_completed = EXCLUDED.email_receipt_batch_completed,
    email_team_invitations = EXCLUDED.email_team_invitations,
    email_team_activity = EXCLUDED.email_team_activity,
    email_billing_updates = EXCLUDED.email_billing_updates,
    email_security_alerts = EXCLUDED.email_security_alerts,
    email_weekly_reports = EXCLUDED.email_weekly_reports,
    email_team_member_removed = EXCLUDED.email_team_member_removed,
    push_enabled = EXCLUDED.push_enabled,
    push_receipt_processing_completed = EXCLUDED.push_receipt_processing_completed,
    push_receipt_processing_failed = EXCLUDED.push_receipt_processing_failed,
    push_receipt_ready_for_review = EXCLUDED.push_receipt_ready_for_review,
    push_receipt_batch_completed = EXCLUDED.push_receipt_batch_completed,
    push_team_invitations = EXCLUDED.push_team_invitations,
    push_team_activity = EXCLUDED.push_team_activity,
    push_receipt_comments = EXCLUDED.push_receipt_comments,
    push_receipt_shared = EXCLUDED.push_receipt_shared,
    push_team_member_removed = EXCLUDED.push_team_member_removed,
    push_gamification_streak_reminders = EXCLUDED.push_gamification_streak_reminders,
    browser_permission_granted = EXCLUDED.browser_permission_granted,
    browser_permission_requested_at = EXCLUDED.browser_permission_requested_at,
    quiet_hours_enabled = EXCLUDED.quiet_hours_enabled,
    quiet_hours_start = EXCLUDED.quiet_hours_start,
    quiet_hours_end = EXCLUDED.quiet_hours_end,
    timezone = EXCLUDED.timezone,
    daily_digest_enabled = EXCLUDED.daily_digest_enabled,
    weekly_digest_enabled = EXCLUDED.weekly_digest_enabled,
    digest_time = EXCLUDED.digest_time,
    updated_at = NOW()
  RETURNING id INTO _result_id;

  RETURN _result_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_user_notification_preferences(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_notification_preferences(UUID, JSONB) TO authenticated;