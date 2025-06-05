-- Fix missing INSERT policy for profiles table
-- This allows users to create their own profile records if the trigger fails

-- Create INSERT policy for profiles table
CREATE POLICY "Users can insert their own profile"
ON "public"."profiles"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Also ensure the trigger exists and is properly configured
-- Recreate the handle_new_user function to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Insert profile with default subscription values
  INSERT INTO public.profiles (
    id, 
    first_name, 
    last_name,
    email,
    subscription_tier,
    subscription_status,
    receipts_used_this_month,
    monthly_reset_date
  )
  VALUES (
    new.id, 
    '', 
    '',
    new.email,
    'free',
    'active',
    0,
    DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  
  RETURN new;
END;
$function$;

-- Ensure the trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions for the trigger to work
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON TABLE public.profiles TO supabase_auth_admin;
