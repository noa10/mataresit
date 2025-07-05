-- Add receipt notification triggers
-- Migration: 20250703130000_add_receipt_notification_triggers.sql

-- Function to handle receipt status change notifications
CREATE OR REPLACE FUNCTION public.handle_receipt_status_notification()
RETURNS TRIGGER AS $function$
DECLARE
  _notification_type notification_type;
  _title TEXT;
  _message TEXT;
  _priority notification_priority;
  _action_url TEXT;
BEGIN
  -- Only process if processing_status has changed
  IF OLD.processing_status IS DISTINCT FROM NEW.processing_status THEN
    
    -- Determine notification type and content based on new status
    CASE NEW.processing_status
      WHEN 'processing' THEN
        _notification_type := 'receipt_processing_started';
        _title := 'Receipt Processing Started';
        _message := CASE 
          WHEN NEW.merchant IS NOT NULL AND NEW.merchant != '' 
          THEN 'Processing receipt from ' || NEW.merchant || '...'
          ELSE 'Your receipt is being processed...'
        END;
        _priority := 'medium';
        
      WHEN 'complete' THEN
        _notification_type := 'receipt_processing_completed';
        _title := 'Receipt Processing Completed';
        _message := CASE 
          WHEN NEW.merchant IS NOT NULL AND NEW.merchant != '' AND NEW.total IS NOT NULL
          THEN 'Receipt from ' || NEW.merchant || ' (' || COALESCE(NEW.currency, 'MYR') || ' ' || NEW.total || ') processed successfully'
          WHEN NEW.merchant IS NOT NULL AND NEW.merchant != ''
          THEN 'Receipt from ' || NEW.merchant || ' has been processed successfully'
          ELSE 'Your receipt has been processed successfully'
        END;
        _priority := 'medium';
        
      WHEN 'failed' THEN
        _notification_type := 'receipt_processing_failed';
        _title := 'Receipt Processing Failed';
        _message := CASE 
          WHEN NEW.processing_error IS NOT NULL AND NEW.processing_error != ''
          THEN 'Receipt processing failed: ' || NEW.processing_error
          ELSE 'Receipt processing failed. Please try again.'
        END;
        _priority := 'high';
        
      ELSE
        -- No notification for other statuses (uploading, uploaded, etc.)
        RETURN NEW;
    END CASE;
    
    -- Set action URL
    _action_url := '/receipt/' || NEW.id;
    
    -- Create the notification
    INSERT INTO public.notifications (
      recipient_id,
      type,
      title,
      message,
      priority,
      action_url,
      related_entity_type,
      related_entity_id,
      metadata,
      team_id,
      created_at
    ) VALUES (
      NEW.user_id,
      _notification_type,
      _title,
      _message,
      _priority,
      _action_url,
      'receipt',
      NEW.id,
      jsonb_build_object(
        'merchant', NEW.merchant,
        'total', NEW.total,
        'currency', NEW.currency,
        'processing_error', NEW.processing_error,
        'processing_status', NEW.processing_status
      ),
      NEW.team_id,
      NOW()
    );
    
    -- Log the notification creation
    RAISE LOG 'Created notification for receipt % status change: % -> %', 
      NEW.id, OLD.processing_status, NEW.processing_status;
      
  END IF;
  
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for receipt status changes
DROP TRIGGER IF EXISTS receipt_status_notification_trigger ON public.receipts;
CREATE TRIGGER receipt_status_notification_trigger
  AFTER UPDATE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_receipt_status_notification();

-- Function to check if user should receive notification based on preferences
CREATE OR REPLACE FUNCTION public.should_send_receipt_notification(
  _user_id UUID,
  _notification_type notification_type,
  _delivery_method TEXT -- 'email' or 'push'
)
RETURNS BOOLEAN AS $function$
DECLARE
  _preferences RECORD;
  _preference_key TEXT;
  _enabled BOOLEAN;
BEGIN
  -- Get user notification preferences
  SELECT * INTO _preferences
  FROM public.get_user_notification_preferences(_user_id)
  LIMIT 1;
  
  -- Check if the delivery method is enabled
  IF _delivery_method = 'email' AND NOT COALESCE(_preferences.email_enabled, true) THEN
    RETURN false;
  END IF;
  
  IF _delivery_method = 'push' AND NOT COALESCE(_preferences.push_enabled, true) THEN
    RETURN false;
  END IF;
  
  -- Check specific notification type preference
  _preference_key := _delivery_method || '_' || _notification_type::TEXT;
  
  -- Use dynamic SQL to check the preference
  EXECUTE format('SELECT COALESCE($1.%I, true)', _preference_key) 
  INTO _enabled 
  USING _preferences;
  
  RETURN COALESCE(_enabled, true);
  
EXCEPTION
  WHEN OTHERS THEN
    -- Default to true if we can't check preferences
    RAISE LOG 'Error checking notification preferences for user %: %', _user_id, SQLERRM;
    RETURN true;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is in quiet hours
CREATE OR REPLACE FUNCTION public.is_user_in_quiet_hours(_user_id UUID)
RETURNS BOOLEAN AS $function$
DECLARE
  _preferences RECORD;
  _current_time TIME;
  _start_time TIME;
  _end_time TIME;
  _current_minutes INTEGER;
  _start_minutes INTEGER;
  _end_minutes INTEGER;
BEGIN
  -- Get user notification preferences
  SELECT * INTO _preferences
  FROM public.get_user_notification_preferences(_user_id)
  LIMIT 1;
  
  -- Check if quiet hours are enabled
  IF NOT COALESCE(_preferences.quiet_hours_enabled, false) 
     OR _preferences.quiet_hours_start IS NULL 
     OR _preferences.quiet_hours_end IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get current time in user's timezone
  _current_time := (NOW() AT TIME ZONE COALESCE(_preferences.timezone, 'Asia/Kuala_Lumpur'))::TIME;
  _start_time := _preferences.quiet_hours_start;
  _end_time := _preferences.quiet_hours_end;
  
  -- Convert times to minutes for easier comparison
  _current_minutes := EXTRACT(HOUR FROM _current_time) * 60 + EXTRACT(MINUTE FROM _current_time);
  _start_minutes := EXTRACT(HOUR FROM _start_time) * 60 + EXTRACT(MINUTE FROM _start_time);
  _end_minutes := EXTRACT(HOUR FROM _end_time) * 60 + EXTRACT(MINUTE FROM _end_time);
  
  -- Handle overnight quiet hours (e.g., 22:00 to 08:00)
  IF _start_minutes > _end_minutes THEN
    RETURN _current_minutes >= _start_minutes OR _current_minutes <= _end_minutes;
  ELSE
    RETURN _current_minutes >= _start_minutes AND _current_minutes <= _end_minutes;
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Default to false if we can't check quiet hours
    RAISE LOG 'Error checking quiet hours for user %: %', _user_id, SQLERRM;
    RETURN false;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced notification function that respects user preferences
CREATE OR REPLACE FUNCTION public.create_receipt_notification_with_preferences(
  _user_id UUID,
  _notification_type notification_type,
  _title TEXT,
  _message TEXT,
  _receipt_id UUID,
  _metadata JSONB DEFAULT '{}'::JSONB,
  _team_id UUID DEFAULT NULL
)
RETURNS UUID AS $function$
DECLARE
  _notification_id UUID;
  _should_send_email BOOLEAN;
  _should_send_push BOOLEAN;
  _is_quiet_hours BOOLEAN;
BEGIN
  -- Check user preferences
  _should_send_email := public.should_send_receipt_notification(_user_id, _notification_type, 'email');
  _should_send_push := public.should_send_receipt_notification(_user_id, _notification_type, 'push');
  _is_quiet_hours := public.is_user_in_quiet_hours(_user_id);
  
  -- Skip notification if user has disabled all delivery methods
  IF NOT _should_send_email AND NOT _should_send_push THEN
    RAISE LOG 'User % has disabled notifications for type %', _user_id, _notification_type;
    RETURN NULL;
  END IF;
  
  -- Skip push notifications during quiet hours (but allow email)
  IF _is_quiet_hours THEN
    _should_send_push := false;
    RAISE LOG 'User % is in quiet hours, skipping push notification', _user_id;
  END IF;
  
  -- Create the notification
  INSERT INTO public.notifications (
    recipient_id,
    type,
    title,
    message,
    priority,
    action_url,
    related_entity_type,
    related_entity_id,
    metadata,
    team_id,
    created_at
  ) VALUES (
    _user_id,
    _notification_type,
    _title,
    _message,
    CASE WHEN _notification_type::TEXT LIKE '%failed%' THEN 'high'::notification_priority ELSE 'medium'::notification_priority END,
    '/receipts/' || _receipt_id,
    'receipt',
    _receipt_id,
    _metadata || jsonb_build_object(
      'should_send_email', _should_send_email,
      'should_send_push', _should_send_push,
      'is_quiet_hours', _is_quiet_hours
    ),
    _team_id,
    NOW()
  ) RETURNING id INTO _notification_id;
  
  RAISE LOG 'Created notification % for user % (email: %, push: %)', 
    _notification_id, _user_id, _should_send_email, _should_send_push;
  
  RETURN _notification_id;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;
