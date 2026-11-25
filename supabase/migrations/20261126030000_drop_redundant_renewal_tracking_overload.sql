-- The restore migration recreated the canonical 7-argument
-- update_subscription_renewal_tracking on a hosted database that already
-- carried an out-of-band 8-argument varchar overload. No migration in this
-- repository declares that overload, and nothing calls it.
--
-- With both present, any named call that supplies the six shared arguments
-- matches either candidate, so PostgreSQL raises
--   42725: function public.update_subscription_renewal_tracking(...) is not unique
-- PostgREST cannot disambiguate it either, which took out the renewal-tracking
-- write in billing-auto-renewal. Remove the undeclared overload so the six
-- shared argument names resolve to exactly one function again.
BEGIN;

DO $$
DECLARE
  v_canonical BOOLEAN;
  v_legacy BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_subscription_renewal_tracking'
      AND p.pronargs = 7
      AND p.proargtypes[0] = 'uuid'::regtype
      AND p.proargtypes[1] = 'text'::regtype
      AND p.proargtypes[2] = 'timestamptz'::regtype
      AND p.proargtypes[3] = 'timestamptz'::regtype
      AND p.proargtypes[4] = 'public.subscription_tier'::regtype
      AND p.proargtypes[5] = 'text'::regtype
      AND p.proargtypes[6] = 'text'::regtype
      AND p.proargnames = ARRAY[
        'p_user_id', 'p_stripe_subscription_id', 'p_current_period_start',
        'p_current_period_end', 'p_current_tier', 'p_current_price_id', 'p_status'
      ]::text[]
      AND p.pronargdefaults = 1
  ) INTO v_canonical;

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_subscription_renewal_tracking'
      AND p.pronargs = 8
      AND p.proargtypes[0] = 'uuid'::regtype
      AND p.proargtypes[1] = 'varchar'::regtype
      AND p.proargtypes[2] = 'timestamptz'::regtype
      AND p.proargtypes[3] = 'timestamptz'::regtype
      AND p.proargtypes[4] = 'varchar'::regtype
      AND p.proargtypes[5] = 'varchar'::regtype
      AND p.proargtypes[6] = 'numeric'::regtype
      AND p.proargtypes[7] = 'varchar'::regtype
      AND p.proargnames = ARRAY[
        'p_user_id', 'p_stripe_subscription_id', 'p_current_period_start',
        'p_current_period_end', 'p_current_tier', 'p_current_price_id',
        'p_renewal_amount', 'p_currency'
      ]::text[]
  ) INTO v_legacy;

  -- Fail closed: dropping the only callable form would break renewal tracking
  -- outright, so refuse rather than guess if the canonical function is absent.
  IF v_legacy AND NOT v_canonical THEN
    RAISE EXCEPTION 'Cannot remove the redundant renewal-tracking overload: the canonical 7-argument update_subscription_renewal_tracking is missing';
  END IF;

  IF v_legacy THEN
    DROP FUNCTION public.update_subscription_renewal_tracking(
      uuid, varchar, timestamptz, timestamptz, varchar, varchar, numeric, varchar
    );
  END IF;
END $$;

COMMIT;
