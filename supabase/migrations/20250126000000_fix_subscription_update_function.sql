-- Fix the subscription update function to include better logging and error handling
CREATE OR REPLACE FUNCTION public.update_subscription_from_stripe(
  _stripe_customer_id TEXT,
  _stripe_subscription_id TEXT,
  _tier public.subscription_tier,
  _status public.subscription_status,
  _current_period_start TIMESTAMP WITH TIME ZONE,
  _current_period_end TIMESTAMP WITH TIME ZONE,
  _trial_end TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _affected_rows INTEGER;
BEGIN
  -- Log the function call
  RAISE LOG 'update_subscription_from_stripe called with: customer_id=%, subscription_id=%, tier=%, status=%', 
    _stripe_customer_id, _stripe_subscription_id, _tier, _status;

  UPDATE public.profiles
  SET
    subscription_tier = _tier,
    subscription_status = _status,
    stripe_subscription_id = _stripe_subscription_id,
    subscription_start_date = _current_period_start,
    subscription_end_date = _current_period_end,
    trial_end_date = _trial_end,
    updated_at = NOW()
  WHERE stripe_customer_id = _stripe_customer_id;

  GET DIAGNOSTICS _affected_rows = ROW_COUNT;
  
  -- Log the result
  RAISE LOG 'update_subscription_from_stripe updated % rows for customer_id=%', _affected_rows, _stripe_customer_id;
  
  -- If no rows were affected, it means the customer doesn't exist
  IF _affected_rows = 0 THEN
    RAISE WARNING 'No profile found for stripe_customer_id: %', _stripe_customer_id;
  END IF;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.update_subscription_from_stripe TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION public.update_subscription_from_stripe IS 'Updates user subscription from Stripe webhook data with enhanced logging';
