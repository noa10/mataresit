-- The restore migration is already deployed. Repair both the enum-backed
-- historical schema and the hosted varchar schema without changing its history.
BEGIN;

-- Keep the original enum overload when present: it checks preferences and
-- writes a scheduling audit event. Remove the competing varchar overload so
-- named PostgREST calls have exactly one target. On a varchar schema, retain
-- the deployed insert-only wrapper and its existing permissions.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute a JOIN pg_type t ON t.oid = a.atttypid
    WHERE a.attrelid = 'public.billing_email_schedule'::regclass
      AND a.attname = 'reminder_type' AND NOT a.attisdropped AND t.typtype = 'e'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_attribute a ON a.attrelid = 'public.billing_email_schedule'::regclass
      AND a.attname = 'reminder_type' AND NOT a.attisdropped
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE n.nspname = 'public' AND p.proname = 'schedule_billing_reminder'
      AND p.pronargs = 6 AND t.typtype = 'e'
      AND p.proargtypes[0] = 'uuid'::regtype
      AND p.proargtypes[1] = 'text'::regtype
      AND p.proargtypes[2] = a.atttypid
      AND p.proargtypes[3] = 'timestamptz'::regtype
      AND p.proargtypes[4] = 'jsonb'::regtype
      AND p.proargtypes[5] = 'text'::regtype
      AND p.proargnames = ARRAY[
        'p_user_id', 'p_subscription_id', 'p_reminder_type',
        'p_scheduled_for', 'p_template_data', 'p_language'
      ]::text[]
      AND p.pronargdefaults = 2
      AND pg_get_expr(p.proargdefaults, 0) = '''{}''::jsonb, ''en''::text'
  ) THEN
    RAISE EXCEPTION 'Cannot repair billing reminders: enum schema is missing the canonical schedule_billing_reminder RPC signature, argument names, or defaults';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_attribute a JOIN pg_type t ON t.oid = a.atttypid
    WHERE a.attrelid = 'public.billing_email_schedule'::regclass
      AND a.attname = 'reminder_type' AND NOT a.attisdropped AND t.typtype = 'e'
  ) THEN
    DROP FUNCTION IF EXISTS public.schedule_billing_reminder(uuid, varchar, varchar, timestamptz, jsonb, varchar);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.schedule_multiple_billing_reminders(
  p_reminders JSONB[]
) RETURNS JSONB AS $$
DECLARE
  reminder JSONB;
  reminder_type public.billing_email_schedule.reminder_type%TYPE;
  schedule_id UUID;
  results JSONB[] := '{}';
  success_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  FOREACH reminder IN ARRAY p_reminders
  LOOP
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM public.billing_preferences
        WHERE user_id = (reminder->>'user_id')::UUID
          AND billing_email_enabled = true
      ) THEN
        results := results || jsonb_build_object(
          'user_id', reminder->>'user_id',
          'status', 'skipped',
          'reason', 'billing_emails_disabled'
        );
        CONTINUE;
      END IF;

      reminder_type := reminder->>'reminder_type';
      SELECT public.schedule_billing_reminder(
        (reminder->>'user_id')::UUID,
        reminder->>'subscription_id',
        reminder_type,
        (reminder->>'scheduled_for')::TIMESTAMP WITH TIME ZONE,
        COALESCE(reminder->'template_data', '{}'::JSONB),
        COALESCE(reminder->>'language', 'en')
      ) INTO schedule_id;

      results := results || jsonb_build_object(
        'user_id', reminder->>'user_id',
        'status', 'scheduled',
        'schedule_id', schedule_id
      );
      success_count := success_count + 1;
    EXCEPTION WHEN OTHERS THEN
      results := results || jsonb_build_object(
        'user_id', reminder->>'user_id',
        'status', 'error',
        'error', SQLERRM
      );
      error_count := error_count + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'scheduled', success_count,
    'errors', error_count,
    'results', results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.mark_billing_reminder_sent(
  p_schedule_id UUID,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  reminder_record RECORD;
  failed_status public.billing_email_schedule.status%TYPE := 'failed';
  scheduled_status public.billing_email_schedule.status%TYPE := 'scheduled';
BEGIN
  SELECT * INTO reminder_record
  FROM public.billing_email_schedule
  WHERE id = p_schedule_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF p_success THEN
    UPDATE public.billing_email_schedule
    SET status = 'sent',
        sent_at = now(),
        delivery_attempts = delivery_attempts + 1,
        updated_at = now()
    WHERE id = p_schedule_id;
  ELSE
    UPDATE public.billing_email_schedule
    SET status = CASE
          WHEN delivery_attempts + 1 >= max_delivery_attempts THEN failed_status
          ELSE scheduled_status
        END,
        failed_at = CASE
          WHEN delivery_attempts + 1 >= max_delivery_attempts THEN now()
          ELSE failed_at
        END,
        error_message = p_error_message,
        delivery_attempts = delivery_attempts + 1,
        updated_at = now()
    WHERE id = p_schedule_id;
  END IF;

  PERFORM public.log_billing_event(
    p_user_id => reminder_record.user_id,
    p_event_type => CASE WHEN p_success THEN 'billing_reminder_sent' ELSE 'billing_reminder_failed' END,
    p_event_description => 'Billing reminder email ' || CASE WHEN p_success THEN 'sent successfully' ELSE 'failed to send' END,
    p_stripe_event_id => NULL,
    p_stripe_subscription_id => reminder_record.subscription_id,
    p_stripe_payment_intent_id => NULL,
    p_old_values => '{}',
    p_new_values => jsonb_build_object(
      'schedule_id', p_schedule_id,
      'reminder_type', reminder_record.reminder_type,
      'success', p_success,
      'error_message', p_error_message,
      'delivery_attempts', reminder_record.delivery_attempts + 1
    ),
    p_metadata => '{}',
    p_triggered_by => 'system'
  );

  RETURN true;
END;
$$;

COMMIT;
