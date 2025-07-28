-- Fix API quota tracking RLS policies to resolve HTTP 406 errors
-- This migration fixes the Row Level Security policies for the api_quota_tracking table
-- to allow authenticated users to read quota data while restricting write access to admins

-- Drop the existing overly restrictive policy
DROP POLICY IF EXISTS api_quota_admin_access ON public.api_quota_tracking;

-- Create separate policies for read and write access
-- Read access: Allow all authenticated users to read quota data
CREATE POLICY api_quota_read_access ON public.api_quota_tracking
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Write access: Only admins can insert, update, or delete quota data
CREATE POLICY api_quota_admin_insert_access ON public.api_quota_tracking
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY api_quota_admin_update_access ON public.api_quota_tracking
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY api_quota_admin_delete_access ON public.api_quota_tracking
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- Add comment explaining the policy change
COMMENT ON TABLE public.api_quota_tracking IS 'API quota usage tracking for rate limiting. Read access for all authenticated users, write access for admins only.';
