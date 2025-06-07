-- Add Stripe price IDs to subscription_limits table for database-driven configuration
-- This provides an alternative to hardcoded price IDs in serverless functions
-- Note: This migration assumes subscription schema already exists

-- Check if subscription_limits table exists before proceeding
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_limits' AND table_schema = 'public') THEN
        -- Add columns for Stripe price IDs
        ALTER TABLE public.subscription_limits
        ADD COLUMN IF NOT EXISTS stripe_monthly_price_id TEXT,
        ADD COLUMN IF NOT EXISTS stripe_annual_price_id TEXT;
    ELSE
        RAISE NOTICE 'subscription_limits table does not exist - skipping Stripe price ID columns';
    END IF;
END $$;

-- Update with current price IDs (these should match your actual Stripe price IDs)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_limits' AND table_schema = 'public') THEN
        UPDATE public.subscription_limits
        SET
          stripe_monthly_price_id = 'price_1RSiggPHa6JfBjtMFGNcoKnZ',
          stripe_annual_price_id = 'price_1RSiiHPHa6JfBjtMOIItG7RA',
          updated_at = NOW()
        WHERE tier = 'pro';

        UPDATE public.subscription_limits
        SET
          stripe_monthly_price_id = 'price_1RSiixPHa6JfBjtMXI9INFRf',
          stripe_annual_price_id = 'price_1RSik1PHa6JfBjtMbYhspNSR',
          updated_at = NOW()
        WHERE tier = 'max';

        -- Free tier doesn't have price IDs (it's free)
        UPDATE public.subscription_limits
        SET
          stripe_monthly_price_id = NULL,
          stripe_annual_price_id = NULL,
          updated_at = NOW()
        WHERE tier = 'free';
    ELSE
        RAISE NOTICE 'subscription_limits table does not exist - skipping price ID updates';
    END IF;
END $$;

-- Create function to get price ID from database
DO $outer$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_limits' AND table_schema = 'public') THEN
        CREATE OR REPLACE FUNCTION public.get_stripe_price_id(
          _tier public.subscription_tier,
          _billing_interval TEXT DEFAULT 'monthly'
        ) RETURNS TEXT
        LANGUAGE plpgsql SECURITY DEFINER STABLE AS $inner$
        DECLARE
          price_id TEXT;
        BEGIN
          -- Validate billing interval
          IF _billing_interval NOT IN ('monthly', 'annual') THEN
            RAISE EXCEPTION 'Invalid billing interval. Must be monthly or annual.';
          END IF;

          -- Get price ID from database
          IF _billing_interval = 'monthly' THEN
            SELECT stripe_monthly_price_id INTO price_id
            FROM public.subscription_limits
            WHERE tier = _tier;
          ELSE
            SELECT stripe_annual_price_id INTO price_id
            FROM public.subscription_limits
            WHERE tier = _tier;
          END IF;

          RETURN price_id;
        END;
        $inner$;
    ELSE
        RAISE NOTICE 'subscription_limits table does not exist - skipping get_stripe_price_id function';
    END IF;
END $outer$;

-- Create function to map price ID to tier (database version)
DO $outer2$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_limits' AND table_schema = 'public') THEN
        CREATE OR REPLACE FUNCTION public.get_tier_from_price_id(
          _price_id TEXT
        ) RETURNS public.subscription_tier
        LANGUAGE plpgsql SECURITY DEFINER STABLE AS $inner2$
        DECLARE
          tier_result public.subscription_tier;
        BEGIN
          -- Look up tier by price ID
          SELECT tier INTO tier_result
          FROM public.subscription_limits
          WHERE stripe_monthly_price_id = _price_id
             OR stripe_annual_price_id = _price_id;

          -- Default to free if not found
          RETURN COALESCE(tier_result, 'free');
        END;
        $inner2$;

        -- Grant permissions
        GRANT EXECUTE ON FUNCTION public.get_stripe_price_id TO authenticated;
        GRANT EXECUTE ON FUNCTION public.get_tier_from_price_id TO authenticated;
    ELSE
        RAISE NOTICE 'subscription_limits table does not exist - skipping get_tier_from_price_id function';
    END IF;
END $outer2$;

-- Add comments
COMMENT ON COLUMN public.subscription_limits.stripe_monthly_price_id IS 'Stripe price ID for monthly billing';
COMMENT ON COLUMN public.subscription_limits.stripe_annual_price_id IS 'Stripe price ID for annual billing';
COMMENT ON FUNCTION public.get_stripe_price_id IS 'Get Stripe price ID for a tier and billing interval';
COMMENT ON FUNCTION public.get_tier_from_price_id IS 'Map Stripe price ID to subscription tier';
