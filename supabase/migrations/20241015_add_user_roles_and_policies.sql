-- Define the app_role enum type
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create the user_roles table to store role assignments
CREATE TABLE public.user_roles (
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, role)
);

-- Add comment for documentation
COMMENT ON TABLE public.user_roles IS 'Stores user role assignments for RBAC';

-- Enable RLS on the table
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create helper function to check if a user has a specific role
-- This needs to be defined BEFORE the policies that use it
CREATE OR REPLACE FUNCTION public.has_role(
  _user_id UUID          DEFAULT auth.uid(),
  _role    public.app_role DEFAULT 'user'::public.app_role
) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- NOW we can create policies that use the has_role function
-- RLS Policy: Users can read only their own roles
CREATE POLICY "Users can read their own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Admins can read all roles
CREATE POLICY "Admins can read all roles"
  ON public.user_roles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- RLS Policy: Admins can assign roles
CREATE POLICY "Admins can assign roles"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- RLS Policy: Admins can update roles
CREATE POLICY "Admins can update roles"
  ON public.user_roles
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- RLS Policy: Admins can delete roles
CREATE POLICY "Admins can delete roles"
  ON public.user_roles
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Function to get all users for admin view
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  last_sign_in_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  roles JSONB
) LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT 
    au.id, 
    au.email, 
    p.first_name,
    p.last_name,
    au.confirmed_at,
    au.last_sign_in_at,
    au.created_at,
    COALESCE(
      (SELECT json_agg(ur.role)
       FROM public.user_roles ur
       WHERE ur.user_id = au.id), 
      '[]'::json
    ) as roles
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.id
  WHERE public.has_role(auth.uid(), 'admin'::public.app_role) -- Only admins can access
  ORDER BY au.created_at DESC;
$$;

-- Function to set a user's role
CREATE OR REPLACE FUNCTION public.set_user_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only admins can change roles
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN FALSE;
  END IF;
  
  -- Check if the user already has this role
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) THEN
    RETURN TRUE;
  END IF;
  
  -- Remove other roles first (assuming a user can have only one role)
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  
  -- Add the new role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role);
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'http_header'
  ) THEN
    CREATE TYPE public.http_header AS (
      field varchar,
      value varchar
    );
  END IF;
END;
$$; 