-- Bind team-invitation acceptance to the caller's own session.
--
-- The problem
-- -----------
-- public.process_post_auth_invitation() took the accepting user as a parameter
-- and validated only that the *claimed* user's email matched the invitation:
--
--     EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id AND email = ...)
--
-- It never compared p_user_id with auth.uid(); the function body contained no
-- auth.uid() call at all. Any caller holding a valid pending token *and* the
-- invitee's uuid could therefore accept on that user's behalf -- adding the
-- victim's account to a team it never consented to, and consuming the
-- invitation so the real invitee's link stops working. A team admin can mint
-- the token themselves, and uuids of other users in the same team or on the
-- leaderboard are readable, so both halves of the precondition are obtainable.
--
-- This was reproduced against PostgreSQL 16 on 2026-10-16 using the previous
-- definition verbatim: with a session whose `sub` was the attacker's id, a call
-- passing the victim's id returned
--   {"success": true, ..., "invitation_accepted": true}
-- and left the victim with a team_members row they never asked for.
--
-- The fixed version was then exercised against the same database: the attack
-- returns ACTOR_MISMATCH and adds nobody, the invitation stays pending, the real
-- invitee accepting with their own session succeeds, anon loses EXECUTE, and an
-- unauthenticated call returns AUTH_REQUIRED. That last case is why the claims
-- are parsed defensively below -- a naive ::jsonb cast on an empty claim raises
-- and would have turned a clean refusal into a 500.
--
-- The older accept_team_invitation_enhanced() gets this right
-- (_current_user_id UUID := auth.uid();), so the newer flow regressed it.
--
-- The fix
-- -------
-- 1. Derive the acting user from auth.uid() and ignore the parameter for
--    identity purposes. p_user_id is kept in the signature so existing clients
--    keep working unchanged, and is now validated rather than trusted: an
--    honest client sends its own id, so a mismatch means the caller is trying to
--    act for someone else.
-- 2. Server-side callers (service_role, reachable only with the project secret
--    key) may still act on an explicitly supplied id, because they have no
--    end-user session. This preserves existing server-to-server behaviour.
-- 3. Revoke EXECUTE from PUBLIC and anon. CREATE OR REPLACE preserves the
--    existing ACL, so the PUBLIC grant created implicitly when the function was
--    first defined would otherwise survive. Only authenticated and service_role
--    need these; the invitation flow always has a session by the time it accepts.
--
-- Behaviour is otherwise unchanged, including the redirect_url fix from
-- 20260516140000 (land on /teams, not /teams/{slug}).

CREATE OR REPLACE FUNCTION public.process_post_auth_invitation(
  p_invitation_token VARCHAR(255),
  p_user_id UUID,
  p_authentication_method VARCHAR(50),
  p_browser_fingerprint TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
-- Pin the search path. Every table and function this body references is already
-- schema-qualified, so nothing changes today; pinning it stops a future edit
-- from silently resolving an unqualified name through the caller's search_path,
-- which is the standard escalation route for a SECURITY DEFINER function.
-- pg_catalog is still searched implicitly, so NOW() and friends keep working.
SET search_path = ''
AS $$
DECLARE
  v_actor UUID;
  v_claims JSONB;
  v_invitation RECORD;
  v_existing_member RECORD;
  v_onboarding_required BOOLEAN := true;
  v_redirect_url TEXT;
BEGIN
  -- The acting user comes from the session, never from the argument alone.
  --
  -- Both reads are guarded. auth.uid() parses request.jwt.claims with a bare
  -- ::jsonb cast, so a claim that is empty or malformed makes it raise rather
  -- than return null -- which would surface as a 500 on what should be a clean
  -- refusal. An unreadable session is treated as no session and falls through to
  -- AUTH_REQUIRED below, so this fails closed. The two reads are guarded
  -- separately so a bad claim cannot discard a session that resolved correctly.
  BEGIN
    v_actor := auth.uid();
  EXCEPTION
    WHEN others THEN
      v_actor := NULL;
  END;

  IF v_actor IS NULL THEN
    BEGIN
      v_claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
    EXCEPTION
      WHEN others THEN
        v_claims := NULL;
    END;

    -- Only the service role (server-side, secret key only) has no end-user
    -- session, so only it may act on behalf of an explicitly supplied user id.
    IF COALESCE(v_claims ->> 'role', '') = 'service_role' THEN
      v_actor := p_user_id;
    END IF;
  END IF;

  IF v_actor IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Authentication required',
      'error_code', 'AUTH_REQUIRED'
    );
  END IF;

  -- An honest client passes its own id. Anything else is an attempt to accept
  -- for another user and is refused.
  IF p_user_id IS NOT NULL AND p_user_id <> v_actor THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot accept an invitation on behalf of another user',
      'error_code', 'ACTOR_MISMATCH'
    );
  END IF;

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
    WHERE id = v_actor AND email = v_invitation.email
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User email does not match invitation',
      'error_code', 'EMAIL_MISMATCH'
    );
  END IF;

  SELECT * INTO v_existing_member
  FROM public.team_members
  WHERE team_id = v_invitation.team_id AND user_id = v_actor;

  IF v_existing_member IS NULL THEN
    INSERT INTO public.team_members (
      team_id, user_id, role, permissions, invitation_accepted_at, added_by
    ) VALUES (
      v_invitation.team_id, v_actor, v_invitation.role,
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
    user_id = v_actor,
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
    v_actor, v_actor,
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
      'redirect_url', COALESCE(v_redirect_url, '/teams')
    )
  );
END;
$$;

-- CREATE OR REPLACE keeps the existing ACL, so the implicit PUBLIC grant from the
-- original CREATE must be revoked explicitly. These RPCs always run with a
-- session, so anon has no legitimate use for any of them.
--
-- The function just redefined is revoked unconditionally: if its signature ever
-- drifts, this migration should fail loudly rather than leave it executable.
REVOKE ALL ON FUNCTION public.process_post_auth_invitation(
  character varying, uuid, character varying, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.process_post_auth_invitation(
  character varying, uuid, character varying, text
) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.process_post_auth_invitation(
      character varying, uuid, character varying, text
    ) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.process_post_auth_invitation(
      character varying, uuid, character varying, text
    ) TO service_role;
  END IF;
END $$;

-- Defence in depth for the rest of the invitation surface. These are warned
-- about rather than erroring -- a signature drift in a function this migration
-- does not redefine should not block the primary fix -- but they are logged, not
-- skipped silently, so a missing revoke is visible in the migration output.
DO $$
DECLARE
  fn TEXT;
  fns TEXT[] := ARRAY[
    'public.validate_direct_invitation_acceptance(character varying,uuid)',
    'public.accept_team_invitation(character varying)',
    'public.accept_team_invitation_enhanced(character varying)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    IF to_regprocedure(fn) IS NULL THEN
      RAISE WARNING 'invitation RPC % not found; EXECUTE not revoked', fn;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END $$;

-- NOT addressed here, deliberately, so the scope of this migration is clear:
--
--   * validate_direct_invitation_acceptance still takes p_user_id and does not
--     compare it with auth.uid(). It only reports whether an acceptance is
--     possible (can_accept / email_match / already_member) and mutates nothing,
--     so the impact is limited to probing another user's invitation status by
--     someone who already holds the token. Revoked from anon above. Binding it
--     to auth.uid() the same way is a sensible follow-up.
--   * detect_user_invitation_state must remain callable without a session --
--     that is what lets a signed-out invitee see the invitation -- but it
--     returns the invited email and whether that email has an account, and it
--     writes an audit row on every call. Reducing the unauthenticated payload
--     is a follow-up, since it also changes what the web UI can display.
--   * Invitation tokens are written into team_audit_logs.metadata, which any
--     team member including viewers can select. Storing a hash instead is a
--     follow-up.
