-- Fix notification trigger to respect filtering preferences
-- This migration updates the handle_receipt_status_notification function to filter out
-- receipt_processing_started notifications (noise reduction)

CREATE OR REPLACE FUNCTION handle_receipt_status_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
        -- FILTER OUT: Skip receipt_processing_started notifications (noise reduction)
        -- This matches the filtering logic in the EdgeNotificationHelper
        RAISE LOG 'Skipping receipt_processing_started notification for receipt % (filtered out for noise reduction)', NEW.id;
        RETURN NEW;
        
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
    
    -- Set action URL (using singular /receipt/ format as per user preference)
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
$$;

-- Add a comment explaining the filtering logic
COMMENT ON FUNCTION handle_receipt_status_notification() IS 
'Database trigger function that creates notifications when receipt processing status changes. 
Filters out receipt_processing_started notifications to reduce noise, matching the client-side filtering logic.';
