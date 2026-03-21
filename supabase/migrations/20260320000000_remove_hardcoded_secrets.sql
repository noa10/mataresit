-- Remove hardcoded legacy JWT service role key from handle_new_batch_item trigger function.
-- Replaced with new sb_secret_* format key.

CREATE OR REPLACE FUNCTION public.handle_new_batch_item()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  json_body TEXT;
BEGIN
  -- Construct the JSON body payload using the NEW record's ID
  json_body := '{"batch_item_id":"' || NEW.id::text || '"}';

  -- Call the http_request function using PERFORM because we don't need its return value
  -- Ensure positional arguments match the function signature
  PERFORM supabase_functions.http_request(
    url := 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/process-batch-item',
    method := 'POST',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer sb_secret_r5jrHqGhCKQYjDphz6SWQg_-WimbsHX"}',
    body := json_body,
    timeout_milliseconds := 5000
  );

  -- For AFTER triggers, RETURN NULL is conventional for side-effect functions
  RETURN NULL;
END;
$function$;
