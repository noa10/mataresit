-- Create subscription tiers enum
CREATE TYPE public.subscription_tier AS ENUM ('free', 'pro', 'max');

-- Create subscription status enum
CREATE TYPE public.subscription_status AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid');

-- Add subscription fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_tier public.subscription_tier DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_status public.subscription_status DEFAULT 'active',
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS receipts_used_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_reset_date TIMESTAMP WITH TIME ZONE DEFAULT DATE_TRUNC('month', NOW()) + INTERVAL '1 month';

-- Create subscription_limits table for tier-based limits
CREATE TABLE public.subscription_limits (
  tier public.subscription_tier PRIMARY KEY,
  monthly_receipts INTEGER NOT NULL,
  storage_limit_mb INTEGER NOT NULL,
  retention_days INTEGER NOT NULL,
  batch_upload_limit INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default limits for each tier
INSERT INTO public.subscription_limits (tier, monthly_receipts, storage_limit_mb, retention_days, batch_upload_limit) VALUES
('free', 25, 1024, 7, 1),     -- 1GB storage for free tier
('pro', 200, 10240, 90, 5),   -- 10GB storage for pro tier
('max', -1, -1, 365, 20);     -- Unlimited storage for max tier

-- Create payment_history table
CREATE TABLE public.payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  amount INTEGER NOT NULL, -- Amount in cents
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL,
  tier public.subscription_tier NOT NULL,
  billing_period_start TIMESTAMP WITH TIME ZONE,
  billing_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE public.subscription_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_profiles_subscription_tier ON public.profiles (subscription_tier);
CREATE INDEX idx_profiles_stripe_customer_id ON public.profiles (stripe_customer_id);
CREATE INDEX idx_payment_history_user_id ON public.payment_history (user_id);
CREATE INDEX idx_payment_history_stripe_subscription_id ON public.payment_history (stripe_subscription_id);

-- Create RLS policies for subscription_limits (read-only for all authenticated users)
CREATE POLICY "Anyone can read subscription limits" ON public.subscription_limits
FOR SELECT TO authenticated USING (true);

-- Create RLS policies for payment_history
CREATE POLICY "Users can view their own payment history" ON public.payment_history
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert payment history" ON public.payment_history
FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service role can update payment history" ON public.payment_history
FOR UPDATE TO service_role USING (true);

-- Create function to check subscription limits
CREATE OR REPLACE FUNCTION public.check_subscription_limit(
  _user_id UUID DEFAULT auth.uid(),
  _limit_type TEXT DEFAULT 'monthly_receipts'
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  user_tier public.subscription_tier;
  user_receipts_count INTEGER;
  tier_limit INTEGER;
BEGIN
  -- Get user's subscription tier
  SELECT subscription_tier INTO user_tier
  FROM public.profiles
  WHERE id = _user_id;

  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;

  -- Get the limit for this tier
  SELECT monthly_receipts INTO tier_limit
  FROM public.subscription_limits
  WHERE tier = user_tier;

  -- If unlimited (-1), return true
  IF tier_limit = -1 THEN
    RETURN true;
  END IF;

  -- Count user's receipts this month
  SELECT COUNT(*) INTO user_receipts_count
  FROM public.receipts
  WHERE user_id = _user_id
    AND created_at >= DATE_TRUNC('month', NOW());

  RETURN user_receipts_count < tier_limit;
END;
$$;

-- Create function to reset monthly usage
CREATE OR REPLACE FUNCTION public.reset_monthly_usage()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
  SET
    receipts_used_this_month = 0,
    monthly_reset_date = DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  WHERE monthly_reset_date <= NOW();
END;
$$;

-- Create function to update subscription from Stripe webhook
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
GRANT EXECUTE ON FUNCTION public.check_subscription_limit TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_monthly_usage TO service_role;
GRANT EXECUTE ON FUNCTION public.update_subscription_from_stripe TO service_role;

-- Add comments for documentation
COMMENT ON TABLE public.subscription_limits IS 'Defines limits for each subscription tier';
COMMENT ON TABLE public.payment_history IS 'Stores payment transaction history';
COMMENT ON FUNCTION public.check_subscription_limit IS 'Checks if user has exceeded their subscription limits';
COMMENT ON FUNCTION public.update_subscription_from_stripe IS 'Updates user subscription from Stripe webhook data';
