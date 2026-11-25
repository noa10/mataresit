-- Disposable SQL regression database only. Reproduces the hosted-only
-- 8-argument overload of update_subscription_renewal_tracking, proves the
-- duplicate makes ordinary named calls ambiguous, then verifies the real
-- forward migration removes it without disturbing the canonical function.
\set ON_ERROR_STOP on
\if :{?renewal_overload_migration}
\else
  \set renewal_overload_migration ../migrations/20261126030000_drop_redundant_renewal_tracking_overload.sql
\endif

DO $$
BEGIN
  IF to_regclass('public.pr234_verify_marker') IS NULL THEN
    RAISE EXCEPTION 'refusing to run without the disposable regression database marker';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_subscription_renewal_tracking'
      AND p.pronargs = 7
      AND p.proargtypes[4] = 'public.subscription_tier'::regtype
  ) THEN
    RAISE EXCEPTION 'refusing to run without the canonical 7-argument renewal-tracking function';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_subscription_renewal_tracking'
      AND p.pronargs = 8
  ) THEN
    RAISE EXCEPTION 'refusing to replace an existing 8-argument renewal-tracking function';
  END IF;
END $$;

-- Hosted carries this overload without any migration declaring it. The body is
-- irrelevant: the defect is the signature, not the implementation.
CREATE FUNCTION public.update_subscription_renewal_tracking(
  p_user_id UUID,
  p_stripe_subscription_id VARCHAR,
  p_current_period_start TIMESTAMP WITH TIME ZONE,
  p_current_period_end TIMESTAMP WITH TIME ZONE,
  p_current_tier VARCHAR,
  p_current_price_id VARCHAR,
  p_renewal_amount NUMERIC DEFAULT NULL,
  p_currency VARCHAR DEFAULT 'MYR'
) RETURNS UUID LANGUAGE sql AS $$ SELECT NULL::UUID $$;

-- The exact call shape billing-auto-renewal makes: six named arguments, which
-- fit both candidates because each leaves its trailing parameters defaulted.
DO $$
BEGIN
  BEGIN
    PERFORM public.update_subscription_renewal_tracking(
      p_user_id => '25100000-0000-4000-8000-0000000000aa',
      p_stripe_subscription_id => 'sub_overload_probe',
      p_current_period_start => '2026-01-01T00:00:00Z',
      p_current_period_end => '2026-02-01T00:00:00Z',
      p_current_tier => 'pro',
      p_current_price_id => 'price_overload_probe'
    );
    RAISE EXCEPTION 'fixture did not reproduce the ambiguity: the duplicated overload resolved';
  EXCEPTION
    WHEN ambiguous_function THEN NULL;
  END;
END $$;

-- Replay safety: an environment that never had the overload must also accept it.
\ir :renewal_overload_migration
\ir :renewal_overload_migration

DO $$
DECLARE
  v_seen INTEGER;
  v_legacy BOOLEAN;
BEGIN
  SELECT count(*) INTO v_seen
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'update_subscription_renewal_tracking';

  IF v_seen <> 1 THEN
    RAISE EXCEPTION 'expected exactly one renewal-tracking function after the migration, found %', v_seen;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_subscription_renewal_tracking'
      AND p.pronargs = 8
  ) INTO v_legacy;

  IF v_legacy THEN
    RAISE EXCEPTION 'the undeclared 8-argument overload survived the migration';
  END IF;

  IF NOT has_function_privilege(
    'service_role',
    'public.update_subscription_renewal_tracking(uuid,text,timestamptz,timestamptz,public.subscription_tier,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'the canonical renewal-tracking function lost its service-role grant';
  END IF;
END $$;

-- The same six named arguments must now resolve and execute.
INSERT INTO auth.users (id, email)
VALUES ('25100000-0000-4000-8000-0000000000aa', 'renewal-overload@example.test')
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  v_tracking_id UUID;
BEGIN
  v_tracking_id := public.update_subscription_renewal_tracking(
    p_user_id => '25100000-0000-4000-8000-0000000000aa',
    p_stripe_subscription_id => 'sub_overload_probe',
    p_current_period_start => '2026-01-01T00:00:00Z',
    p_current_period_end => '2026-02-01T00:00:00Z',
    p_current_tier => 'pro',
    p_current_price_id => 'price_overload_probe'
  );

  IF v_tracking_id IS NULL THEN
    RAISE EXCEPTION 'the canonical renewal-tracking function returned no tracking id';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.subscription_renewal_tracking WHERE id = v_tracking_id
  ) THEN
    RAISE EXCEPTION 'the canonical renewal-tracking function did not write a tracking row';
  END IF;

  DELETE FROM public.subscription_renewal_tracking WHERE id = v_tracking_id;
END $$;

DELETE FROM auth.users WHERE id = '25100000-0000-4000-8000-0000000000aa';
