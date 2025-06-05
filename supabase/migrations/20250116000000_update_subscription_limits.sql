-- Update subscription limits to reflect new pricing structure
-- This migration updates the existing subscription_limits table with new values

-- Update Free tier limits
UPDATE public.subscription_limits 
SET 
  storage_limit_mb = 1024,  -- 1GB storage
  updated_at = NOW()
WHERE tier = 'free';

-- Update Pro tier limits  
UPDATE public.subscription_limits 
SET 
  storage_limit_mb = 10240, -- 10GB storage
  updated_at = NOW()
WHERE tier = 'pro';

-- Update Max tier limits
UPDATE public.subscription_limits 
SET 
  storage_limit_mb = -1,    -- Unlimited storage
  updated_at = NOW()
WHERE tier = 'max';

-- Add new columns for enhanced features if they don't exist
DO $$ 
BEGIN
  -- Add version_control_enabled column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscription_limits' 
                 AND column_name = 'version_control_enabled') THEN
    ALTER TABLE public.subscription_limits 
    ADD COLUMN version_control_enabled BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add integrations_level column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscription_limits' 
                 AND column_name = 'integrations_level') THEN
    ALTER TABLE public.subscription_limits 
    ADD COLUMN integrations_level TEXT DEFAULT 'none';
  END IF;

  -- Add custom_branding_enabled column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscription_limits' 
                 AND column_name = 'custom_branding_enabled') THEN
    ALTER TABLE public.subscription_limits 
    ADD COLUMN custom_branding_enabled BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add max_users column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscription_limits' 
                 AND column_name = 'max_users') THEN
    ALTER TABLE public.subscription_limits 
    ADD COLUMN max_users INTEGER DEFAULT 1;
  END IF;

  -- Add support_level column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscription_limits' 
                 AND column_name = 'support_level') THEN
    ALTER TABLE public.subscription_limits 
    ADD COLUMN support_level TEXT DEFAULT 'basic';
  END IF;

  -- Add api_access_enabled column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscription_limits' 
                 AND column_name = 'api_access_enabled') THEN
    ALTER TABLE public.subscription_limits 
    ADD COLUMN api_access_enabled BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Update feature flags for each tier
-- Free tier features
UPDATE public.subscription_limits 
SET 
  version_control_enabled = FALSE,
  integrations_level = 'none',
  custom_branding_enabled = FALSE,
  max_users = 1,
  support_level = 'basic',
  api_access_enabled = FALSE,
  updated_at = NOW()
WHERE tier = 'free';

-- Pro tier features
UPDATE public.subscription_limits 
SET 
  version_control_enabled = TRUE,
  integrations_level = 'basic',
  custom_branding_enabled = TRUE,
  max_users = 5,
  support_level = 'standard',
  api_access_enabled = FALSE,
  updated_at = NOW()
WHERE tier = 'pro';

-- Max tier features
UPDATE public.subscription_limits 
SET 
  version_control_enabled = TRUE,
  integrations_level = 'advanced',
  custom_branding_enabled = TRUE,
  max_users = -1, -- unlimited
  support_level = 'priority',
  api_access_enabled = TRUE,
  updated_at = NOW()
WHERE tier = 'max';

-- Add comments for new columns
COMMENT ON COLUMN public.subscription_limits.version_control_enabled IS 'Whether version control features are enabled for this tier';
COMMENT ON COLUMN public.subscription_limits.integrations_level IS 'Level of integrations available: none, basic, advanced';
COMMENT ON COLUMN public.subscription_limits.custom_branding_enabled IS 'Whether custom branding is available for this tier';
COMMENT ON COLUMN public.subscription_limits.max_users IS 'Maximum number of users allowed (-1 for unlimited)';
COMMENT ON COLUMN public.subscription_limits.support_level IS 'Level of support: basic, standard, priority';
COMMENT ON COLUMN public.subscription_limits.api_access_enabled IS 'Whether API access is enabled for this tier';
