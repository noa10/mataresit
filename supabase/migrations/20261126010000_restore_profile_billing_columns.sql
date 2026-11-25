-- Restore fields originally introduced in 20250722000000 that may be missing
-- on older hosted schemas. The existing profile billing guard references all
-- six fields and continues to protect them; no grants or policies change.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto_renewal_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_renewal_frequency VARCHAR(20) DEFAULT 'monthly'
    CHECK (auto_renewal_frequency IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS billing_email_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS billing_address JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_method_brand TEXT,
  ADD COLUMN IF NOT EXISTS payment_method_last_four TEXT;
