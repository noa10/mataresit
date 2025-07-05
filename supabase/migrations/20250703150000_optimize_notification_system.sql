-- Optimize notification system performance
-- Migration: 20250703150000_optimize_notification_system.sql

-- Add additional indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON public.notifications(recipient_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_type_created ON public.notifications(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_team_created ON public.notifications(team_id, created_at DESC) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_priority_created ON public.notifications(priority, created_at DESC);

-- Add indexes for email deliveries
CREATE INDEX IF NOT EXISTS idx_email_deliveries_status_created ON public.email_deliveries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_deliveries_recipient_created ON public.email_deliveries(recipient_email, created_at DESC);

-- Add indexes for push subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active ON public.push_subscriptions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_created ON public.push_subscriptions(created_at DESC);

-- Add indexes for notification preferences
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON public.notification_preferences(user_id);

-- Optimize notification cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS INTEGER AS $function$
DECLARE
  _deleted_count INTEGER;
BEGIN
  -- Delete read notifications older than 30 days
  DELETE FROM public.notifications 
  WHERE read = true 
    AND created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS _deleted_count = ROW_COUNT;
  
  -- Delete old email delivery records (keep for 90 days)
  DELETE FROM public.email_deliveries 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Delete inactive push subscriptions older than 90 days
  DELETE FROM public.push_subscriptions 
  WHERE is_active = false 
    AND updated_at < NOW() - INTERVAL '90 days';
  
  RAISE LOG 'Cleaned up % old notifications', _deleted_count;
  
  RETURN _deleted_count;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get notification statistics
CREATE OR REPLACE FUNCTION public.get_notification_statistics(
  _time_period INTERVAL DEFAULT INTERVAL '24 hours'
)
RETURNS TABLE (
  total_notifications BIGINT,
  unread_notifications BIGINT,
  notifications_by_type JSONB,
  email_deliveries BIGINT,
  email_success_rate NUMERIC,
  push_subscriptions BIGINT,
  active_push_subscriptions BIGINT
) AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    -- Total notifications in period
    (SELECT COUNT(*) FROM public.notifications WHERE created_at >= NOW() - _time_period)::BIGINT,
    
    -- Unread notifications
    (SELECT COUNT(*) FROM public.notifications WHERE read = false)::BIGINT,
    
    -- Notifications by type
    (SELECT COALESCE(jsonb_object_agg(type, count), '{}'::jsonb)
     FROM (
       SELECT type, COUNT(*) as count
       FROM public.notifications 
       WHERE created_at >= NOW() - _time_period
       GROUP BY type
     ) t),
    
    -- Email deliveries in period
    (SELECT COUNT(*) FROM public.email_deliveries WHERE created_at >= NOW() - _time_period)::BIGINT,
    
    -- Email success rate
    (SELECT 
       CASE 
         WHEN COUNT(*) = 0 THEN 0
         ELSE ROUND((COUNT(*) FILTER (WHERE status = 'sent')::NUMERIC / COUNT(*)) * 100, 2)
       END
     FROM public.email_deliveries 
     WHERE created_at >= NOW() - _time_period),
    
    -- Total push subscriptions
    (SELECT COUNT(*) FROM public.push_subscriptions)::BIGINT,
    
    -- Active push subscriptions
    (SELECT COUNT(*) FROM public.push_subscriptions WHERE is_active = true)::BIGINT;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to optimize notification delivery
CREATE OR REPLACE FUNCTION public.optimize_notification_delivery()
RETURNS TABLE (
  optimization_type TEXT,
  before_count BIGINT,
  after_count BIGINT,
  improvement TEXT
) AS $function$
DECLARE
  _before_unread BIGINT;
  _after_unread BIGINT;
  _before_subscriptions BIGINT;
  _after_subscriptions BIGINT;
BEGIN
  -- Get current counts
  SELECT COUNT(*) INTO _before_unread FROM public.notifications WHERE read = false;
  SELECT COUNT(*) INTO _before_subscriptions FROM public.push_subscriptions WHERE is_active = false;
  
  -- Mark old unread notifications as read (older than 7 days)
  UPDATE public.notifications 
  SET read = true, read_at = NOW()
  WHERE read = false 
    AND created_at < NOW() - INTERVAL '7 days';
  
  -- Deactivate push subscriptions that haven't been used in 30 days
  UPDATE public.push_subscriptions 
  SET is_active = false, updated_at = NOW()
  WHERE is_active = true 
    AND last_used_at < NOW() - INTERVAL '30 days';
  
  -- Get after counts
  SELECT COUNT(*) INTO _after_unread FROM public.notifications WHERE read = false;
  SELECT COUNT(*) INTO _after_subscriptions FROM public.push_subscriptions WHERE is_active = false;
  
  -- Return optimization results
  RETURN QUERY VALUES 
    ('Auto-read old notifications', _before_unread, _after_unread, 
     CASE WHEN _before_unread > _after_unread 
          THEN 'Marked ' || (_before_unread - _after_unread) || ' old notifications as read'
          ELSE 'No old notifications to mark as read' END),
    ('Deactivate unused subscriptions', _before_subscriptions, _after_subscriptions,
     CASE WHEN _after_subscriptions > _before_subscriptions
          THEN 'Deactivated ' || (_after_subscriptions - _before_subscriptions) || ' unused subscriptions'
          ELSE 'No unused subscriptions to deactivate' END);
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to validate notification system health
CREATE OR REPLACE FUNCTION public.validate_notification_system_health()
RETURNS TABLE (
  component TEXT,
  status TEXT,
  details TEXT,
  recommendation TEXT
) AS $function$
DECLARE
  _unread_count BIGINT;
  _old_unread_count BIGINT;
  _email_failure_rate NUMERIC;
  _inactive_subscriptions BIGINT;
  _recent_notifications BIGINT;
BEGIN
  -- Check unread notification count
  SELECT COUNT(*) INTO _unread_count FROM public.notifications WHERE read = false;
  SELECT COUNT(*) INTO _old_unread_count FROM public.notifications 
  WHERE read = false AND created_at < NOW() - INTERVAL '24 hours';
  
  -- Check email failure rate (last 24 hours)
  SELECT 
    CASE 
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND((COUNT(*) FILTER (WHERE status != 'sent')::NUMERIC / COUNT(*)) * 100, 2)
    END INTO _email_failure_rate
  FROM public.email_deliveries 
  WHERE created_at >= NOW() - INTERVAL '24 hours';
  
  -- Check inactive push subscriptions
  SELECT COUNT(*) INTO _inactive_subscriptions 
  FROM public.push_subscriptions 
  WHERE is_active = false AND updated_at >= NOW() - INTERVAL '7 days';
  
  -- Check recent notification volume
  SELECT COUNT(*) INTO _recent_notifications 
  FROM public.notifications 
  WHERE created_at >= NOW() - INTERVAL '1 hour';
  
  -- Return health check results
  RETURN QUERY VALUES 
    ('Unread Notifications', 
     CASE WHEN _unread_count < 1000 THEN 'HEALTHY' 
          WHEN _unread_count < 5000 THEN 'WARNING' 
          ELSE 'CRITICAL' END,
     _unread_count || ' unread notifications (' || _old_unread_count || ' older than 24h)',
     CASE WHEN _unread_count >= 5000 THEN 'Consider running cleanup_old_notifications()'
          WHEN _old_unread_count > 100 THEN 'Consider auto-marking old notifications as read'
          ELSE 'No action needed' END),
          
    ('Email Delivery', 
     CASE WHEN _email_failure_rate < 5 THEN 'HEALTHY' 
          WHEN _email_failure_rate < 15 THEN 'WARNING' 
          ELSE 'CRITICAL' END,
     _email_failure_rate || '% failure rate in last 24 hours',
     CASE WHEN _email_failure_rate >= 15 THEN 'Check Resend API status and email templates'
          WHEN _email_failure_rate >= 5 THEN 'Monitor email delivery closely'
          ELSE 'Email delivery is performing well' END),
          
    ('Push Subscriptions', 
     CASE WHEN _inactive_subscriptions < 100 THEN 'HEALTHY' 
          WHEN _inactive_subscriptions < 500 THEN 'WARNING' 
          ELSE 'CRITICAL' END,
     _inactive_subscriptions || ' subscriptions became inactive in last 7 days',
     CASE WHEN _inactive_subscriptions >= 500 THEN 'Investigate push notification delivery issues'
          WHEN _inactive_subscriptions >= 100 THEN 'Monitor push subscription health'
          ELSE 'Push subscriptions are stable' END),
          
    ('Notification Volume', 
     CASE WHEN _recent_notifications < 1000 THEN 'HEALTHY' 
          WHEN _recent_notifications < 5000 THEN 'WARNING' 
          ELSE 'CRITICAL' END,
     _recent_notifications || ' notifications created in last hour',
     CASE WHEN _recent_notifications >= 5000 THEN 'High notification volume - check for notification spam'
          WHEN _recent_notifications >= 1000 THEN 'Monitor notification creation patterns'
          ELSE 'Notification volume is normal' END);
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user notification summary
CREATE OR REPLACE FUNCTION public.get_user_notification_summary(_user_id UUID)
RETURNS TABLE (
  total_notifications BIGINT,
  unread_notifications BIGINT,
  notifications_today BIGINT,
  email_notifications_enabled BOOLEAN,
  push_notifications_enabled BOOLEAN,
  last_notification_at TIMESTAMP WITH TIME ZONE,
  most_common_type TEXT
) AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    -- Total notifications for user
    (SELECT COUNT(*) FROM public.notifications WHERE recipient_id = _user_id)::BIGINT,
    
    -- Unread notifications
    (SELECT COUNT(*) FROM public.notifications WHERE recipient_id = _user_id AND read = false)::BIGINT,
    
    -- Notifications today
    (SELECT COUNT(*) FROM public.notifications 
     WHERE recipient_id = _user_id AND created_at >= CURRENT_DATE)::BIGINT,
    
    -- Email notifications enabled
    COALESCE((SELECT email_enabled FROM public.get_user_notification_preferences(_user_id) LIMIT 1), true),
    
    -- Push notifications enabled
    COALESCE((SELECT push_enabled FROM public.get_user_notification_preferences(_user_id) LIMIT 1), true),
    
    -- Last notification timestamp
    (SELECT MAX(created_at) FROM public.notifications WHERE recipient_id = _user_id),
    
    -- Most common notification type
    (SELECT type FROM public.notifications 
     WHERE recipient_id = _user_id 
     GROUP BY type 
     ORDER BY COUNT(*) DESC 
     LIMIT 1);
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notification_statistics(INTERVAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.optimize_notification_delivery() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_notification_system_health() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_notification_summary(UUID) TO authenticated;

-- Create a scheduled job to run cleanup (if pg_cron is available)
-- This would typically be set up separately in production
-- SELECT cron.schedule('cleanup-notifications', '0 2 * * *', 'SELECT public.cleanup_old_notifications();');

-- Add comments for documentation
COMMENT ON FUNCTION public.cleanup_old_notifications() IS 'Cleans up old read notifications and inactive subscriptions';
COMMENT ON FUNCTION public.get_notification_statistics(INTERVAL) IS 'Returns comprehensive notification system statistics';
COMMENT ON FUNCTION public.optimize_notification_delivery() IS 'Optimizes notification delivery by cleaning up old data';
COMMENT ON FUNCTION public.validate_notification_system_health() IS 'Validates the health of the notification system';
COMMENT ON FUNCTION public.get_user_notification_summary(UUID) IS 'Returns notification summary for a specific user';
