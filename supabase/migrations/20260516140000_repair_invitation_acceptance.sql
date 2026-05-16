-- Repair drift from 20250821000000_enhanced_invitation_onboarding_system.
-- Migration is recorded as applied but the ALTER TABLE team_invitations
-- block never landed in prod. process_post_auth_invitation writes these
-- three columns and throws 42703 without them.
ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS authentication_method VARCHAR(50),
  ADD COLUMN IF NOT EXISTS acceptance_ip_address INET,
  ADD COLUMN IF NOT EXISTS acceptance_user_agent TEXT;

-- Patch process_post_auth_invitation: the original function returned
-- '/teams/' || team_slug as the redirect, but the SPA has no
-- '/teams/:slug' route — only '/teams' — so accepted invitees hit a
-- 404 right after joining. Keep all the original behavior; only the
-- redirect_url branch changes.
CREATE OR REPLACE FUNCTION public.process_post_auth_invitation(
  p_invitation_token VARCHAR(255),
  p_user_id UUID,
  p_authentication_method VARCHAR(50),
  p_browser_fingerprint TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation RECORD;
  v_existing_member RECORD;
  v_onboarding_required BOOLEAN := true;
  v_redirect_url TEXT;
BEGIN
  SELECT ti.*, t.name AS team_name, t.slug AS team_slug
  INTO v_invitation
  FROM public.team_invitations ti
  JOIN public.teams t ON t.id = ti.team_id
  WHERE ti.token = p_invitation_token
    AND ti.status = 'pending'
    AND ti.expires_at > NOW();

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invitation not found or expired',
      'error_code', 'INVITATION_NOT_FOUND'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id AND email = v_invitation.email
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User email does not match invitation',
      'error_code', 'EMAIL_MISMATCH'
    );
  END IF;

  SELECT * INTO v_existing_member
  FROM public.team_members
  WHERE team_id = v_invitation.team_id AND user_id = p_user_id;

  IF v_existing_member IS NULL THEN
    INSERT INTO public.team_members (
      team_id, user_id, role, permissions, invitation_accepted_at, added_by
    ) VALUES (
      v_invitation.team_id, p_user_id, v_invitation.role,
      v_invitation.permissions, NOW(), v_invitation.invited_by
    );
  ELSE
    v_onboarding_required := false;
  END IF;

  UPDATE public.team_invitations
  SET
    status = 'accepted',
    accepted_at = NOW(),
    authentication_method = p_authentication_method,
    acceptance_ip_address = (
      SELECT ip_address FROM public.invitation_states
      WHERE invitation_token = p_invitation_token
    ),
    acceptance_user_agent = (
      SELECT user_agent FROM public.invitation_states
      WHERE invitation_token = p_invitation_token
    )
  WHERE id = v_invitation.id;

  UPDATE public.invitation_states
  SET
    state = 'accepted',
    user_id = p_user_id,
    authentication_method = p_authentication_method,
    authenticated_at = NOW()
  WHERE invitation_token = p_invitation_token;

  SELECT redirect_after_auth INTO v_redirect_url
  FROM public.invitation_states
  WHERE invitation_token = p_invitation_token;

  INSERT INTO public.team_audit_logs (
    team_id, action, action_description, performed_by, target_user_id,
    metadata, ip_address, user_agent
  ) VALUES (
    v_invitation.team_id,
    'invitation_accepted',
    'Team invitation accepted via ' || p_authentication_method,
    p_user_id, p_user_id,
    jsonb_build_object(
      'invitation_id', v_invitation.id,
      'authentication_method', p_authentication_method,
      'browser_fingerprint', p_browser_fingerprint,
      'was_existing_member', v_existing_member IS NOT NULL
    ),
    (SELECT ip_address FROM public.invitation_states WHERE invitation_token = p_invitation_token),
    (SELECT user_agent FROM public.invitation_states WHERE invitation_token = p_invitation_token)
  );

  RETURN jsonb_build_object(
    'success', true,
    'result', jsonb_build_object(
      'invitation_accepted', true,
      'team_id', v_invitation.team_id,
      'team_name', v_invitation.team_name,
      'user_role', v_invitation.role,
      'onboarding_required', v_onboarding_required,
      -- Land on /teams (which exists) instead of /teams/{slug} (which doesn't).
      -- Caller can switch into the freshly-joined team from the workspace switcher.
      'redirect_url', COALESCE(v_redirect_url, '/teams')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_post_auth_invitation TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_post_auth_invitation TO service_role;
