-- Enhanced subscription enforcement with comprehensive limit checking
-- This migration creates a more robust backend enforcement system
-- Note: This migration assumes subscription schema already exists

-- Check if subscription_tier enum exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier') THEN
        CREATE TYPE public.subscription_tier AS ENUM ('free', 'pro', 'max');
    END IF;
END $$;

-- Check if subscription_status enum exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE public.subscription_status AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid');
    END IF;
END $$;

-- Create enhanced function to check all subscription limits
CREATE OR REPLACE FUNCTION public.can_perform_action(
  _user_id UUID DEFAULT auth.uid(),
  _action TEXT DEFAULT 'upload_receipt',
  _payload JSONB DEFAULT '{}'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  user_tier public.subscription_tier;
  limits RECORD;
  usage RECORD;
  batch_size INT := COALESCE((_payload->>'batch_size')::INT, 1);
  file_size_mb NUMERIC := COALESCE((_payload->>'file_size_mb')::NUMERIC, 0);
  result JSONB := '{"allowed": false, "reason": "Unknown error"}'::JSONB;
  receipts_this_month INT := 0;
  total_storage_mb NUMERIC := 0;
BEGIN
  -- Check if required tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_limits' AND table_schema = 'public') THEN
    -- Return a default response if subscription system isn't set up yet
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', 'Subscription system not configured - allowing action',
      'tier', 'free'
    );
  END IF;

  -- Get user's subscription tier
  SELECT COALESCE(p.subscription_tier, 'free')
  INTO user_tier
  FROM public.profiles p
  WHERE p.id = _user_id;

  -- Default to free if no profile found
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;

  -- Get limits for the tier
  SELECT sl.* INTO limits
  FROM public.subscription_limits sl
  WHERE sl.tier = user_tier;

  -- If no profile exists, use free tier limits
  IF user_tier IS NULL THEN
    SELECT * INTO limits FROM public.subscription_limits WHERE tier = 'free';
    user_tier := 'free';
  END IF;

  -- Get current usage data
  SELECT 
    COALESCE(receipts_used_this_month, 0) as receipts_used,
    COALESCE(storage_used_mb, 0) as storage_used
  INTO usage
  FROM public.profiles 
  WHERE id = _user_id;

  -- If no usage data, initialize to zero
  IF usage IS NULL THEN
    usage := ROW(0, 0);
  END IF;

  -- Get actual receipts count for this month
  SELECT COUNT(*) INTO receipts_this_month
  FROM public.receipts
  WHERE user_id = _user_id
    AND created_at >= date_trunc('month', CURRENT_DATE);

  -- Calculate total storage usage (rough estimate based on receipt count)
  -- In production, you'd want to track actual file sizes
  SELECT COALESCE(COUNT(*) * 0.5, 0) INTO total_storage_mb
  FROM public.receipts
  WHERE user_id = _user_id
    AND image_url IS NOT NULL;

  -- Check different actions
  CASE _action
    WHEN 'upload_receipt' THEN
      -- Check monthly receipt limit
      IF limits.monthly_receipts != -1 AND (receipts_this_month + batch_size) > limits.monthly_receipts THEN
        result := jsonb_build_object(
          'allowed', false,
          'reason', 'Monthly receipt limit exceeded',
          'current_usage', receipts_this_month,
          'limit', limits.monthly_receipts,
          'tier', user_tier
        );
      -- Check storage limit
      ELSIF limits.storage_limit_mb != -1 AND (total_storage_mb + file_size_mb) > limits.storage_limit_mb THEN
        result := jsonb_build_object(
          'allowed', false,
          'reason', 'Storage limit exceeded',
          'current_usage_mb', total_storage_mb,
          'limit_mb', limits.storage_limit_mb,
          'tier', user_tier
        );
      ELSE
        result := jsonb_build_object(
          'allowed', true,
          'reason', 'Action permitted',
          'tier', user_tier
        );
      END IF;

    WHEN 'upload_batch' THEN
      -- Check batch upload limit
      IF limits.batch_upload_limit != -1 AND batch_size > limits.batch_upload_limit THEN
        result := jsonb_build_object(
          'allowed', false,
          'reason', 'Batch upload limit exceeded',
          'batch_size', batch_size,
          'limit', limits.batch_upload_limit,
          'tier', user_tier
        );
      -- Check monthly receipt limit for the entire batch
      ELSIF limits.monthly_receipts != -1 AND (receipts_this_month + batch_size) > limits.monthly_receipts THEN
        result := jsonb_build_object(
          'allowed', false,
          'reason', 'Monthly receipt limit would be exceeded by batch',
          'current_usage', receipts_this_month,
          'batch_size', batch_size,
          'limit', limits.monthly_receipts,
          'tier', user_tier
        );
      -- Check storage limit for the entire batch
      ELSIF limits.storage_limit_mb != -1 AND (total_storage_mb + (batch_size * file_size_mb)) > limits.storage_limit_mb THEN
        result := jsonb_build_object(
          'allowed', false,
          'reason', 'Storage limit would be exceeded by batch',
          'current_usage_mb', total_storage_mb,
          'batch_size_mb', batch_size * file_size_mb,
          'limit_mb', limits.storage_limit_mb,
          'tier', user_tier
        );
      ELSE
        result := jsonb_build_object(
          'allowed', true,
          'reason', 'Batch upload permitted',
          'tier', user_tier
        );
      END IF;

    WHEN 'check_feature' THEN
      -- Check if a specific feature is available for the user's tier
      DECLARE
        feature_name TEXT := _payload->>'feature';
        feature_available BOOLEAN := false;
      BEGIN
        CASE feature_name
          WHEN 'batch_upload' THEN
            feature_available := user_tier != 'free';
          WHEN 'advanced_analytics' THEN
            feature_available := user_tier IN ('pro', 'max');
          WHEN 'api_access' THEN
            feature_available := user_tier = 'max';
          WHEN 'version_control' THEN
            feature_available := COALESCE(limits.version_control_enabled, false);
          WHEN 'custom_branding' THEN
            feature_available := COALESCE(limits.custom_branding_enabled, false);
          ELSE
            feature_available := true; -- Default to available for unknown features
        END CASE;

        result := jsonb_build_object(
          'allowed', feature_available,
          'reason', CASE WHEN feature_available THEN 'Feature available' ELSE 'Feature not available for tier' END,
          'feature', feature_name,
          'tier', user_tier
        );
      END;

    ELSE
      -- Unknown action, default to checking basic upload limits
      IF limits.monthly_receipts != -1 AND receipts_this_month >= limits.monthly_receipts THEN
        result := jsonb_build_object(
          'allowed', false,
          'reason', 'Monthly receipt limit reached',
          'current_usage', receipts_this_month,
          'limit', limits.monthly_receipts,
          'tier', user_tier
        );
      ELSE
        result := jsonb_build_object(
          'allowed', true,
          'reason', 'Action permitted',
          'tier', user_tier
        );
      END IF;
  END CASE;

  -- Add usage information to the result
  result := result || jsonb_build_object(
    'usage', jsonb_build_object(
      'receipts_this_month', receipts_this_month,
      'storage_used_mb', total_storage_mb,
      'monthly_receipts_limit', limits.monthly_receipts,
      'storage_limit_mb', limits.storage_limit_mb,
      'batch_upload_limit', limits.batch_upload_limit
    )
  );

  RETURN result;
END;
$$;

-- Create a simpler boolean function for backward compatibility
CREATE OR REPLACE FUNCTION public.check_subscription_limit_enhanced(
  _user_id UUID DEFAULT auth.uid(),
  _action TEXT DEFAULT 'upload_receipt',
  _payload JSONB DEFAULT '{}'
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  result JSONB;
BEGIN
  result := public.can_perform_action(_user_id, _action, _payload);
  RETURN (result->>'allowed')::BOOLEAN;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.can_perform_action TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_subscription_limit_enhanced TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION public.can_perform_action IS 'Comprehensive subscription limit checking with detailed response';
COMMENT ON FUNCTION public.check_subscription_limit_enhanced IS 'Boolean wrapper for can_perform_action for backward compatibility';
