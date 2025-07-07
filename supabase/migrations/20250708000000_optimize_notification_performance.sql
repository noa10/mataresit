-- Optimize notification archive and delete performance
-- Migration: 20250708000000_optimize_notification_performance.sql

-- Add missing indexes for better archive and delete performance
CREATE INDEX IF NOT EXISTS idx_notifications_archived_at
ON public.notifications(archived_at)
WHERE archived_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id_archived
ON public.notifications(recipient_id, id)
WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_operations
ON public.notifications(recipient_id, id, archived_at);

-- Optimize the archive_notification function for better performance
CREATE OR REPLACE FUNCTION public.archive_notification(_notification_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  _affected_rows INTEGER;
BEGIN
  -- Use more efficient UPDATE with explicit recipient check
  UPDATE public.notifications 
  SET archived_at = NOW()
  WHERE id = _notification_id 
    AND recipient_id = auth.uid()
    AND archived_at IS NULL; -- Only update if not already archived
  
  GET DIAGNOSTICS _affected_rows = ROW_COUNT;
  
  -- Return true if a row was updated, false otherwise
  RETURN _affected_rows > 0;
END;
$function$;

-- Create optimized bulk archive function for future use
CREATE OR REPLACE FUNCTION public.bulk_archive_notifications(_notification_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  _affected_rows INTEGER;
BEGIN
  UPDATE public.notifications 
  SET archived_at = NOW()
  WHERE id = ANY(_notification_ids)
    AND recipient_id = auth.uid()
    AND archived_at IS NULL;
  
  GET DIAGNOSTICS _affected_rows = ROW_COUNT;
  
  RETURN _affected_rows;
END;
$function$;

-- Create optimized bulk delete function for future use
CREATE OR REPLACE FUNCTION public.bulk_delete_notifications(_notification_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  _affected_rows INTEGER;
BEGIN
  DELETE FROM public.notifications 
  WHERE id = ANY(_notification_ids)
    AND recipient_id = auth.uid();
  
  GET DIAGNOSTICS _affected_rows = ROW_COUNT;
  
  RETURN _affected_rows;
END;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.archive_notification(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_archive_notifications(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_delete_notifications(uuid[]) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION public.archive_notification(uuid) IS 'Optimized function to archive a single notification with performance improvements';
COMMENT ON FUNCTION public.bulk_archive_notifications(uuid[]) IS 'Bulk archive multiple notifications in a single operation';
COMMENT ON FUNCTION public.bulk_delete_notifications(uuid[]) IS 'Bulk delete multiple notifications in a single operation';
