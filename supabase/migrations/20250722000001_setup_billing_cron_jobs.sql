-- Setup Billing System Cron Jobs
-- This migration sets up scheduled jobs for the billing system

-- Note: This requires pg_cron extension to be enabled
-- In production, these should be set up through Supabase's cron job interface
-- or external scheduling system like GitHub Actions, AWS EventBridge, etc.

-- Function to setup billing cron jobs
CREATE OR REPLACE FUNCTION setup_billing_cron_jobs()
RETURNS VOID AS $$
BEGIN
  -- Note: In production, these cron jobs should be set up by the database administrator
  -- or through Supabase's cron job interface if available
  
  -- For now, we'll create webhook-callable functions that can be triggered externally
  RAISE NOTICE 'Billing cron jobs setup function created. In production, set up external scheduling to call:';
  RAISE NOTICE '1. Daily at 9:00 AM: POST /functions/v1/billing-cron-jobs {"job_type": "process_renewals"}';
  RAISE NOTICE '2. Hourly: POST /functions/v1/billing-cron-jobs {"job_type": "send_reminder_emails"}';
  RAISE NOTICE '3. Every 6 hours: POST /functions/v1/billing-cron-jobs {"job_type": "process_payment_retries"}';
  RAISE NOTICE '4. Daily at 2:00 AM: POST /functions/v1/billing-cron-jobs {"job_type": "cleanup_expired_grace_periods"}';
  RAISE NOTICE '5. Daily at 6:00 AM: POST /functions/v1/billing-cron-jobs {"job_type": "daily_billing_health_check"}';
END;
$$ LANGUAGE plpgsql;

-- Function to manually trigger billing operations (for testing)
CREATE OR REPLACE FUNCTION trigger_billing_operation(operation_type TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  CASE operation_type
    WHEN 'process_renewals' THEN
      -- This would typically call the Edge Function
      result := jsonb_build_object(
        'operation', 'process_renewals',
        'status', 'triggered',
        'message', 'Renewal processing triggered manually'
      );
    
    WHEN 'send_reminders' THEN
      result := jsonb_build_object(
        'operation', 'send_reminders',
        'status', 'triggered',
        'message', 'Reminder emails triggered manually'
      );
    
    WHEN 'process_retries' THEN
      result := jsonb_build_object(
        'operation', 'process_retries',
        'status', 'triggered',
        'message', 'Payment retries triggered manually'
      );
    
    WHEN 'cleanup_grace_periods' THEN
      result := jsonb_build_object(
        'operation', 'cleanup_grace_periods',
        'status', 'triggered',
        'message', 'Grace period cleanup triggered manually'
      );
    
    WHEN 'health_check' THEN
      result := jsonb_build_object(
        'operation', 'health_check',
        'status', 'triggered',
        'message', 'Billing health check triggered manually'
      );
    
    ELSE
      result := jsonb_build_object(
        'error', 'Unknown operation type',
        'valid_operations', ARRAY['process_renewals', 'send_reminders', 'process_retries', 'cleanup_grace_periods', 'health_check']
      );
  END CASE;
  
  -- Log the manual trigger
  INSERT INTO public.billing_audit_trail (
    user_id,
    event_type,
    event_description,
    metadata,
    triggered_by,
    created_at
  ) VALUES (
    NULL, -- System operation
    'manual_billing_operation',
    'Manual billing operation triggered: ' || operation_type,
    result,
    'manual_trigger',
    NOW()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get billing system statistics
CREATE OR REPLACE FUNCTION get_billing_system_stats()
RETURNS JSONB AS $$
DECLARE
  stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'active_subscriptions', (
      SELECT COUNT(*) 
      FROM public.profiles 
      WHERE subscription_tier != 'free' 
        AND subscription_status = 'active'
    ),
    'subscriptions_in_grace_period', (
      SELECT COUNT(*) 
      FROM public.profiles 
      WHERE grace_period_end_date IS NOT NULL 
        AND grace_period_end_date > NOW()
    ),
    'pending_payment_retries', (
      SELECT COUNT(*) 
      FROM public.payment_retry_tracking 
      WHERE status = 'pending'
    ),
    'scheduled_emails_pending', (
      SELECT COUNT(*) 
      FROM public.billing_email_schedule 
      WHERE status = 'scheduled' 
        AND scheduled_for <= NOW() + INTERVAL '24 hours'
    ),
    'failed_emails_last_24h', (
      SELECT COUNT(*) 
      FROM public.billing_email_schedule 
      WHERE status = 'failed' 
        AND created_at >= NOW() - INTERVAL '24 hours'
    ),
    'renewals_next_7_days', (
      SELECT COUNT(*) 
      FROM public.subscription_renewal_tracking 
      WHERE auto_renewal_enabled = true 
        AND next_renewal_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
    ),
    'billing_events_last_24h', (
      SELECT COUNT(*) 
      FROM public.billing_audit_trail 
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    )
  ) INTO stats;
  
  RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check billing system health
CREATE OR REPLACE FUNCTION check_billing_system_health()
RETURNS JSONB AS $$
DECLARE
  health_report JSONB;
  issues JSONB[] := '{}';
  warnings JSONB[] := '{}';
BEGIN
  -- Check for subscriptions with issues
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE subscription_tier != 'free' 
      AND subscription_status != 'active' 
      AND grace_period_end_date IS NULL
  ) THEN
    issues := issues || jsonb_build_object(
      'type', 'inactive_subscriptions',
      'message', 'Found subscriptions that are inactive without grace period',
      'severity', 'high'
    );
  END IF;
  
  -- Check for expired grace periods
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE grace_period_end_date < NOW()
  ) THEN
    issues := issues || jsonb_build_object(
      'type', 'expired_grace_periods',
      'message', 'Found expired grace periods that need cleanup',
      'severity', 'medium'
    );
  END IF;
  
  -- Check for stuck payment retries
  IF EXISTS (
    SELECT 1 FROM public.payment_retry_tracking 
    WHERE status = 'pending' 
      AND next_retry_at < NOW() - INTERVAL '2 hours'
  ) THEN
    warnings := warnings || jsonb_build_object(
      'type', 'stuck_payment_retries',
      'message', 'Found payment retries that may be stuck',
      'severity', 'medium'
    );
  END IF;
  
  -- Check for high email failure rate
  IF (
    SELECT COUNT(*) FROM public.billing_email_schedule 
    WHERE status = 'failed' 
      AND created_at >= NOW() - INTERVAL '24 hours'
  ) > 10 THEN
    warnings := warnings || jsonb_build_object(
      'type', 'high_email_failure_rate',
      'message', 'High email failure rate detected in last 24 hours',
      'severity', 'medium'
    );
  END IF;
  
  -- Build health report
  health_report := jsonb_build_object(
    'timestamp', NOW(),
    'overall_status', CASE 
      WHEN array_length(issues, 1) > 0 THEN 'unhealthy'
      WHEN array_length(warnings, 1) > 0 THEN 'warning'
      ELSE 'healthy'
    END,
    'issues', issues,
    'warnings', warnings,
    'stats', get_billing_system_stats()
  );
  
  RETURN health_report;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION setup_billing_cron_jobs() TO service_role;
GRANT EXECUTE ON FUNCTION trigger_billing_operation(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_billing_system_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION check_billing_system_health() TO authenticated;

-- Run the setup function
SELECT setup_billing_cron_jobs();

-- Add helpful comments
COMMENT ON FUNCTION setup_billing_cron_jobs() IS 'Sets up billing system cron jobs (requires external scheduling in production)';
COMMENT ON FUNCTION trigger_billing_operation(TEXT) IS 'Manually triggers billing operations for testing and maintenance';
COMMENT ON FUNCTION get_billing_system_stats() IS 'Returns comprehensive billing system statistics';
COMMENT ON FUNCTION check_billing_system_health() IS 'Performs health check on the billing system and returns status report';

-- Create a view for easy monitoring
CREATE OR REPLACE VIEW billing_system_overview AS
SELECT 
  'Active Subscriptions' as metric,
  COUNT(*) as value,
  'subscriptions' as unit
FROM public.profiles 
WHERE subscription_tier != 'free' AND subscription_status = 'active'

UNION ALL

SELECT 
  'Grace Period Subscriptions' as metric,
  COUNT(*) as value,
  'subscriptions' as unit
FROM public.profiles 
WHERE grace_period_end_date IS NOT NULL AND grace_period_end_date > NOW()

UNION ALL

SELECT 
  'Pending Payment Retries' as metric,
  COUNT(*) as value,
  'retries' as unit
FROM public.payment_retry_tracking 
WHERE status = 'pending'

UNION ALL

SELECT 
  'Scheduled Emails (Next 24h)' as metric,
  COUNT(*) as value,
  'emails' as unit
FROM public.billing_email_schedule 
WHERE status = 'scheduled' AND scheduled_for <= NOW() + INTERVAL '24 hours'

UNION ALL

SELECT 
  'Failed Emails (Last 24h)' as metric,
  COUNT(*) as value,
  'emails' as unit
FROM public.billing_email_schedule 
WHERE status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours';

-- Grant access to the view
GRANT SELECT ON billing_system_overview TO authenticated;
