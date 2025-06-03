
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
  WHERE auth.has_role(auth.uid(), 'admin'::public.app_role) -- Only admins can access
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
