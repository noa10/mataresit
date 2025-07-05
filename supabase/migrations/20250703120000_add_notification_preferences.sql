-- Add notification preferences and push subscription support
-- Migration: 20250703120000_add_notification_preferences.sql

-- First, add the new notification types to the existing enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'receipt_processing_started';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'receipt_processing_completed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'receipt_processing_failed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'receipt_ready_for_review';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'receipt_batch_completed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'receipt_batch_failed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'receipt_shared';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'receipt_comment_added';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'receipt_edited_by_team_member';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'receipt_approved_by_team';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'receipt_flagged_for_review';

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Email notification preferences
  email_enabled BOOLEAN DEFAULT true,
  email_receipt_processing_completed BOOLEAN DEFAULT true,
  email_receipt_processing_failed BOOLEAN DEFAULT true,
  email_receipt_ready_for_review BOOLEAN DEFAULT false,
  email_receipt_batch_completed BOOLEAN DEFAULT true,
  email_team_invitations BOOLEAN DEFAULT true,
  email_team_activity BOOLEAN DEFAULT false,
  email_billing_updates BOOLEAN DEFAULT true,
  email_security_alerts BOOLEAN DEFAULT true,
  email_weekly_reports BOOLEAN DEFAULT false,
  
  -- Push notification preferences
  push_enabled BOOLEAN DEFAULT true,
  push_receipt_processing_completed BOOLEAN DEFAULT true,
  push_receipt_processing_failed BOOLEAN DEFAULT true,
  push_receipt_ready_for_review BOOLEAN DEFAULT true,
  push_receipt_batch_completed BOOLEAN DEFAULT true,
  push_team_invitations BOOLEAN DEFAULT true,
  push_team_activity BOOLEAN DEFAULT true,
  push_receipt_comments BOOLEAN DEFAULT true,
  push_receipt_shared BOOLEAN DEFAULT true,
  
  -- Browser notification preferences
  browser_permission_granted BOOLEAN DEFAULT false,
  browser_permission_requested_at TIMESTAMP WITH TIME ZONE,
  
  -- Notification timing preferences
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME, -- HH:MM format
  quiet_hours_end TIME, -- HH:MM format
  timezone TEXT DEFAULT 'Asia/Kuala_Lumpur',
  
  -- Digest preferences
  daily_digest_enabled BOOLEAN DEFAULT false,
  weekly_digest_enabled BOOLEAN DEFAULT false,
  digest_time TIME DEFAULT '09:00', -- HH:MM format
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one preference record per user
  UNIQUE(user_id)
);

-- Create push subscriptions table for browser push notifications
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique subscription per user per endpoint
  UNIQUE(user_id, endpoint)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON public.push_subscriptions(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification preferences
CREATE POLICY "Users can manage their own notification preferences" ON public.notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- RLS policies for push subscriptions
CREATE POLICY "Users can manage their own push subscriptions" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Function to get user notification preferences with defaults
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
  push_enabled BOOLEAN,
  push_receipt_processing_completed BOOLEAN,
  push_receipt_processing_failed BOOLEAN,
  push_receipt_ready_for_review BOOLEAN,
  push_receipt_batch_completed BOOLEAN,
  push_team_invitations BOOLEAN,
  push_team_activity BOOLEAN,
  push_receipt_comments BOOLEAN,
  push_receipt_shared BOOLEAN,
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
    COALESCE(np.push_enabled, true) as push_enabled,
    COALESCE(np.push_receipt_processing_completed, true) as push_receipt_processing_completed,
    COALESCE(np.push_receipt_processing_failed, true) as push_receipt_processing_failed,
    COALESCE(np.push_receipt_ready_for_review, true) as push_receipt_ready_for_review,
    COALESCE(np.push_receipt_batch_completed, true) as push_receipt_batch_completed,
    COALESCE(np.push_team_invitations, true) as push_team_invitations,
    COALESCE(np.push_team_activity, true) as push_team_activity,
    COALESCE(np.push_receipt_comments, true) as push_receipt_comments,
    COALESCE(np.push_receipt_shared, true) as push_receipt_shared,
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

-- Function to upsert notification preferences
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
    push_enabled,
    push_receipt_processing_completed,
    push_receipt_processing_failed,
    push_receipt_ready_for_review,
    push_receipt_batch_completed,
    push_team_invitations,
    push_team_activity,
    push_receipt_comments,
    push_receipt_shared,
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
    COALESCE((_preferences->>'push_enabled')::BOOLEAN, true),
    COALESCE((_preferences->>'push_receipt_processing_completed')::BOOLEAN, true),
    COALESCE((_preferences->>'push_receipt_processing_failed')::BOOLEAN, true),
    COALESCE((_preferences->>'push_receipt_ready_for_review')::BOOLEAN, true),
    COALESCE((_preferences->>'push_receipt_batch_completed')::BOOLEAN, true),
    COALESCE((_preferences->>'push_team_invitations')::BOOLEAN, true),
    COALESCE((_preferences->>'push_team_activity')::BOOLEAN, true),
    COALESCE((_preferences->>'push_receipt_comments')::BOOLEAN, true),
    COALESCE((_preferences->>'push_receipt_shared')::BOOLEAN, true),
    COALESCE((_preferences->>'browser_permission_granted')::BOOLEAN, false),
    CASE WHEN _preferences->>'browser_permission_requested_at' IS NOT NULL 
         THEN (_preferences->>'browser_permission_requested_at')::TIMESTAMP WITH TIME ZONE 
         ELSE NULL END,
    COALESCE((_preferences->>'quiet_hours_enabled')::BOOLEAN, false),
    CASE WHEN _preferences->>'quiet_hours_start' IS NOT NULL 
         THEN (_preferences->>'quiet_hours_start')::TIME 
         ELSE NULL END,
    CASE WHEN _preferences->>'quiet_hours_end' IS NOT NULL 
         THEN (_preferences->>'quiet_hours_end')::TIME 
         ELSE NULL END,
    COALESCE(_preferences->>'timezone', 'Asia/Kuala_Lumpur'),
    COALESCE((_preferences->>'daily_digest_enabled')::BOOLEAN, false),
    COALESCE((_preferences->>'weekly_digest_enabled')::BOOLEAN, false),
    CASE WHEN _preferences->>'digest_time' IS NOT NULL 
         THEN (_preferences->>'digest_time')::TIME 
         ELSE '09:00'::TIME END,
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
    push_enabled = EXCLUDED.push_enabled,
    push_receipt_processing_completed = EXCLUDED.push_receipt_processing_completed,
    push_receipt_processing_failed = EXCLUDED.push_receipt_processing_failed,
    push_receipt_ready_for_review = EXCLUDED.push_receipt_ready_for_review,
    push_receipt_batch_completed = EXCLUDED.push_receipt_batch_completed,
    push_team_invitations = EXCLUDED.push_team_invitations,
    push_team_activity = EXCLUDED.push_team_activity,
    push_receipt_comments = EXCLUDED.push_receipt_comments,
    push_receipt_shared = EXCLUDED.push_receipt_shared,
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

-- Function to manage push subscriptions
CREATE OR REPLACE FUNCTION public.upsert_push_subscription(
  _user_id UUID,
  _endpoint TEXT,
  _p256dh_key TEXT,
  _auth_key TEXT,
  _user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  _result_id UUID;
BEGIN
  INSERT INTO public.push_subscriptions (
    user_id,
    endpoint,
    p256dh_key,
    auth_key,
    user_agent,
    is_active,
    last_used_at
  )
  VALUES (
    _user_id,
    _endpoint,
    _p256dh_key,
    _auth_key,
    _user_agent,
    true,
    NOW()
  )
  ON CONFLICT (user_id, endpoint) DO UPDATE SET
    p256dh_key = EXCLUDED.p256dh_key,
    auth_key = EXCLUDED.auth_key,
    user_agent = EXCLUDED.user_agent,
    is_active = true,
    last_used_at = NOW()
  RETURNING id INTO _result_id;
  
  RETURN _result_id;
END;
$function$;

-- Add updated_at trigger for notification_preferences
CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
RETURNS TRIGGER AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql;

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_preferences_updated_at();
