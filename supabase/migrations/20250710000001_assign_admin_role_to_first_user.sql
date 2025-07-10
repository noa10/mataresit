-- Assign admin role to the first user (likely the developer)
-- This ensures there's at least one admin user who can access admin pages

-- Insert admin role for the first user (by creation date)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE id = (
  SELECT id 
  FROM auth.users 
  ORDER BY created_at ASC 
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.users.id AND role = 'admin'
);

-- Also create a function to easily assign admin role to any user by email
CREATE OR REPLACE FUNCTION public.assign_admin_role_by_email(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Find the user by email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email;

  -- Check if user exists
  IF target_user_id IS NULL THEN
    RAISE NOTICE 'User with email % not found', user_email;
    RETURN FALSE;
  END IF;

  -- Check if user already has admin role
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = target_user_id AND role = 'admin'
  ) THEN
    RAISE NOTICE 'User % already has admin role', user_email;
    RETURN TRUE;
  END IF;

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin');

  RAISE NOTICE 'Admin role assigned to user %', user_email;
  RETURN TRUE;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error assigning admin role to %: %', user_email, SQLERRM;
    RETURN FALSE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.assign_admin_role_by_email TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.assign_admin_role_by_email IS 'Assigns admin role to a user by email address. Can be used by existing admins or during initial setup.';

-- Show current admin users
SELECT 
  au.email,
  au.created_at,
  ur.role
FROM auth.users au
JOIN public.user_roles ur ON au.id = ur.user_id
WHERE ur.role = 'admin'
ORDER BY au.created_at;
