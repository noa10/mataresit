-- Update pricing structure to match new comprehensive pricing
-- This migration updates the subscription_limits table with the new pricing structure

-- Update Free tier limits (25 -> 50 receipts)
UPDATE public.subscription_limits 
SET 
  monthly_receipts = 50,
  updated_at = NOW()
WHERE tier = 'free';

-- Update Pro tier limits (200 -> 500 receipts)
UPDATE public.subscription_limits 
SET 
  monthly_receipts = 500,
  updated_at = NOW()
WHERE tier = 'pro';

-- Max tier remains unlimited (-1)
UPDATE public.subscription_limits 
SET 
  updated_at = NOW()
WHERE tier = 'max';

-- Ensure all tiers have the correct limits if they don't exist
INSERT INTO public.subscription_limits (tier, monthly_receipts, storage_limit_mb, retention_days, batch_upload_limit) 
VALUES 
  ('free', 50, 1024, 7, 1),
  ('pro', 500, 10240, 90, 5),
  ('max', -1, -1, 365, 20)
ON CONFLICT (tier) DO UPDATE SET
  monthly_receipts = EXCLUDED.monthly_receipts,
  storage_limit_mb = EXCLUDED.storage_limit_mb,
  retention_days = EXCLUDED.retention_days,
  batch_upload_limit = EXCLUDED.batch_upload_limit,
  updated_at = NOW();

-- Add comment to track this pricing update
COMMENT ON TABLE public.subscription_limits IS 'Updated pricing structure: Free (50 receipts), Pro (500 receipts), Max (unlimited) - Updated 2025-01-28';
