-- Team Management Functions

-- Function to create a new team
CREATE OR REPLACE FUNCTION public.create_team(
  _name VARCHAR(255),
  _description TEXT DEFAULT NULL,
  _slug VARCHAR(100) DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _team_id UUID;
  _generated_slug VARCHAR(100);
BEGIN
  -- Generate slug if not provided
  IF _slug IS NULL THEN
    _generated_slug := lower(regexp_replace(_name, '[^a-zA-Z0-9]+', '-', 'g'));
    _generated_slug := trim(both '-' from _generated_slug);
    
    -- Ensure slug is unique
    WHILE EXISTS (SELECT 1 FROM public.teams WHERE slug = _generated_slug) LOOP
      _generated_slug := _generated_slug || '-' || floor(random() * 1000)::text;
    END LOOP;
  ELSE
    _generated_slug := _slug;
  END IF;

  -- Create the team
  INSERT INTO public.teams (name, description, slug, owner_id)
  VALUES (_name, _description, _generated_slug, auth.uid())
  RETURNING id INTO _team_id;

  -- Add the creator as the owner in team_members
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (_team_id, auth.uid(), 'owner');

  RETURN _team_id;
END;
$$;

-- Function to invite a user to a team
CREATE OR REPLACE FUNCTION public.invite_team_member(
  _team_id UUID,
  _email VARCHAR(255),
  _role public.team_member_role DEFAULT 'member'
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _invitation_id UUID;
  _token VARCHAR(255);
BEGIN
  -- Check if user has permission to invite
  IF NOT public.is_team_member(_team_id, auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to invite team members';
  END IF;

  -- Check if user is already a team member
  IF EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN auth.users u ON tm.user_id = u.id
    WHERE tm.team_id = _team_id AND u.email = _email
  ) THEN
    RAISE EXCEPTION 'User is already a team member';
  END IF;

  -- Check if there's already a pending invitation
  IF EXISTS (
    SELECT 1 FROM public.team_invitations
    WHERE team_id = _team_id AND email = _email AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Invitation already sent to this email';
  END IF;

  -- Generate unique token
  _token := encode(gen_random_bytes(32), 'hex');

  -- Create invitation
  INSERT INTO public.team_invitations (
    team_id, email, role, invited_by, token, expires_at
  ) VALUES (
    _team_id, _email, _role, auth.uid(), NOW() + INTERVAL '7 days'
  ) RETURNING id INTO _invitation_id;

  RETURN _invitation_id;
END;
$$;

-- Function to accept a team invitation
CREATE OR REPLACE FUNCTION public.accept_team_invitation(
  _token VARCHAR(255)
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _invitation RECORD;
  _user_email VARCHAR(255);
BEGIN
  -- Get current user's email
  SELECT email INTO _user_email FROM auth.users WHERE id = auth.uid();
  
  IF _user_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Get invitation details
  SELECT * INTO _invitation
  FROM public.team_invitations
  WHERE token = _token AND status = 'pending' AND expires_at > NOW();

  IF _invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  -- Check if invitation is for the current user
  IF _invitation.email != _user_email THEN
    RAISE EXCEPTION 'Invitation is not for the current user';
  END IF;

  -- Check if user is already a team member
  IF EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _invitation.team_id AND user_id = auth.uid()
  ) THEN
    -- Update invitation status and return success
    UPDATE public.team_invitations
    SET status = 'accepted', accepted_at = NOW()
    WHERE id = _invitation.id;
    
    RETURN TRUE;
  END IF;

  -- Add user to team
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (_invitation.team_id, auth.uid(), _invitation.role);

  -- Update invitation status
  UPDATE public.team_invitations
  SET status = 'accepted', accepted_at = NOW()
  WHERE id = _invitation.id;

  RETURN TRUE;
END;
$$;

-- Function to remove a team member
CREATE OR REPLACE FUNCTION public.remove_team_member(
  _team_id UUID,
  _user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _member_role public.team_member_role;
BEGIN
  -- Get the member's role
  SELECT role INTO _member_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _user_id;

  IF _member_role IS NULL THEN
    RAISE EXCEPTION 'User is not a team member';
  END IF;

  -- Cannot remove the owner
  IF _member_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot remove team owner';
  END IF;

  -- Check permissions: admin can remove anyone, users can remove themselves
  IF NOT (public.is_team_member(_team_id, auth.uid(), 'admin') OR _user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Insufficient permissions to remove team member';
  END IF;

  -- Remove the member
  DELETE FROM public.team_members
  WHERE team_id = _team_id AND user_id = _user_id;

  RETURN TRUE;
END;
$$;

-- Function to update team member role
CREATE OR REPLACE FUNCTION public.update_team_member_role(
  _team_id UUID,
  _user_id UUID,
  _new_role public.team_member_role
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _current_role public.team_member_role;
BEGIN
  -- Check if user has admin permissions
  IF NOT public.is_team_member(_team_id, auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to update member role';
  END IF;

  -- Get current role
  SELECT role INTO _current_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _user_id;

  IF _current_role IS NULL THEN
    RAISE EXCEPTION 'User is not a team member';
  END IF;

  -- Cannot change owner role
  IF _current_role = 'owner' OR _new_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot change owner role';
  END IF;

  -- Update the role
  UPDATE public.team_members
  SET role = _new_role, updated_at = NOW()
  WHERE team_id = _team_id AND user_id = _user_id;

  RETURN TRUE;
END;
$$;

-- Function to get user's teams
CREATE OR REPLACE FUNCTION public.get_user_teams(
  _user_id UUID DEFAULT auth.uid()
) RETURNS TABLE (
  id UUID,
  name VARCHAR(255),
  description TEXT,
  slug VARCHAR(100),
  status public.team_status,
  owner_id UUID,
  user_role public.team_member_role,
  member_count BIGINT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT 
    t.id,
    t.name,
    t.description,
    t.slug,
    t.status,
    t.owner_id,
    tm.role as user_role,
    (SELECT COUNT(*) FROM public.team_members WHERE team_id = t.id) as member_count,
    t.created_at
  FROM public.teams t
  JOIN public.team_members tm ON t.id = tm.team_id
  WHERE tm.user_id = _user_id
  ORDER BY t.created_at DESC;
$$;

-- Function to get team members
CREATE OR REPLACE FUNCTION public.get_team_members(
  _team_id UUID
) RETURNS TABLE (
  id UUID,
  user_id UUID,
  email VARCHAR(255),
  first_name TEXT,
  last_name TEXT,
  role public.team_member_role,
  joined_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT 
    tm.id,
    tm.user_id,
    au.email,
    p.first_name,
    p.last_name,
    tm.role,
    tm.joined_at
  FROM public.team_members tm
  JOIN auth.users au ON tm.user_id = au.id
  LEFT JOIN public.profiles p ON au.id = p.id
  WHERE tm.team_id = _team_id
  AND public.is_team_member(_team_id, auth.uid(), 'viewer')
  ORDER BY 
    CASE tm.role
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'member' THEN 3
      WHEN 'viewer' THEN 4
    END,
    tm.joined_at ASC;
$$;
