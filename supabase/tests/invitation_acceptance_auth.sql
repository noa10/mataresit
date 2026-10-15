-- Regression test: accepting a team invitation must be bound to the caller's own
-- session.
--
-- Background: process_post_auth_invitation() used to trust its p_user_id argument,
-- validating only that the *claimed* user's email matched the invitation and never
-- comparing it with auth.uid(). Any caller holding a valid pending token and the
-- invitee's uuid could accept on that user's behalf. Fixed in
-- 20261016090000_bind_invitation_acceptance_to_session_user.sql.
--
-- This test asserts the fixed behaviour, so it fails if the binding is ever
-- removed again.
--
-- How to run (needs a scratch PostgreSQL, not the production database):
--
--   supabase db push                     # or apply migrations however you prefer
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/invitation_acceptance_auth.sql
--
-- Everything happens inside one transaction that ends in ROLLBACK, so it creates
-- no lasting state and is safe to re-run. It exits non-zero on the first failed
-- assertion.
--
-- Deliberately does NOT use pgTAP: the repo has no SQL test infrastructure and
-- this file should not be the reason to add one. Plain DO blocks with
-- RAISE EXCEPTION give a non-zero exit and a readable message.

\set ON_ERROR_STOP on

BEGIN;

-- Stubs for the objects the RPC touches, created only if absent, so this can run
-- against a scratch database that has no Supabase auth schema.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;

-- Mirrors Supabase's auth.uid(), including its nullif guard.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_member_role') THEN
    CREATE TYPE team_member_role AS ENUM ('owner', 'admin', 'member', 'viewer');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitation_status') THEN
    CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'cancelled', 'expired');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY, name text, slug text
);

CREATE TABLE IF NOT EXISTS public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid, email varchar(255) NOT NULL,
  role team_member_role NOT NULL DEFAULT 'member',
  invited_by uuid NOT NULL,
  status invitation_status NOT NULL DEFAULT 'pending',
  token varchar(255) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  permissions jsonb DEFAULT '{}',
  authentication_method varchar(50),
  acceptance_ip_address inet,
  acceptance_user_agent text
);

CREATE TABLE IF NOT EXISTS public.team_members (
  team_id uuid, user_id uuid, role team_member_role, permissions jsonb,
  invitation_accepted_at timestamptz, added_by uuid, member_metadata jsonb,
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.invitation_states (
  invitation_token varchar(255) PRIMARY KEY, state text, user_id uuid,
  authentication_method varchar(50), authenticated_at timestamptz,
  redirect_after_auth text, ip_address inet, user_agent text
);

CREATE TABLE IF NOT EXISTS public.team_audit_logs (
  id bigserial PRIMARY KEY, team_id uuid, action text, action_description text,
  performed_by uuid, target_user_id uuid, metadata jsonb, ip_address inet, user_agent text
);

-- Fixtures, in transaction-local scope.
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'victim@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'attacker@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.teams (id, name, slug)
VALUES ('33333333-3333-3333-3333-333333333333', 'Acme', 'acme')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.team_invitations (team_id, email, role, invited_by, token, expires_at)
VALUES ('33333333-3333-3333-3333-333333333333', 'victim@example.com', 'member',
        '22222222-2222-2222-2222-222222222222', 'tok-regression', now() + interval '7 days')
ON CONFLICT (token) DO NOTHING;

DO $test$
DECLARE
  v_result JSONB;
  v_count INT;
  v_status TEXT;
  -- Typed as UUID so the RPC call resolves to the intended signature; a
  -- text-typed argument would not match (varchar, uuid, varchar, text).
  v_actor CONSTANT UUID := '22222222-2222-2222-2222-222222222222';  -- attacker
  v_victim CONSTANT UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
  -- 1. anon must not be able to execute the RPC at all.
  IF has_function_privilege(
       'anon',
       'public.process_post_auth_invitation(character varying,uuid,character varying,text)',
       'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute process_post_auth_invitation; PUBLIC grant was not revoked';
  END IF;

  -- 2. The attack: an attacker's session supplying the victim's user id.
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', v_actor, 'role', 'authenticated')::text, true);
  v_result := public.process_post_auth_invitation(
                'tok-regression', v_victim, 'existing_session', NULL);

  IF COALESCE(v_result ->> 'success', 'true') <> 'false' THEN
    RAISE EXCEPTION 'accepting on behalf of another user succeeded: %', v_result;
  END IF;
  IF v_result ->> 'error_code' IS DISTINCT FROM 'ACTOR_MISMATCH' THEN
    RAISE EXCEPTION 'expected ACTOR_MISMATCH, got %', v_result ->> 'error_code';
  END IF;

  SELECT count(*) INTO v_count FROM public.team_members WHERE user_id = v_victim;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'the victim was added to a team they never accepted (% rows)', v_count;
  END IF;

  SELECT status::text INTO v_status FROM public.team_invitations WHERE token = 'tok-regression';
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'the invitation was consumed by the failed attempt (status %)', v_status;
  END IF;

  -- 3. No session at all must be refused, not raise.
  PERFORM set_config('request.jwt.claims', '', true);
  v_result := public.process_post_auth_invitation(
                'tok-regression', v_victim, 'existing_session', NULL);
  IF v_result ->> 'error_code' IS DISTINCT FROM 'AUTH_REQUIRED' THEN
    RAISE EXCEPTION 'expected AUTH_REQUIRED without a session, got %', v_result;
  END IF;

  -- 4. A non-service role must not slip through the service-role branch.
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  v_result := public.process_post_auth_invitation(
                'tok-regression', v_victim, 'existing_session', NULL);
  IF v_result ->> 'error_code' IS DISTINCT FROM 'AUTH_REQUIRED' THEN
    RAISE EXCEPTION 'role=anon was allowed through, got %', v_result;
  END IF;

  -- 5. Malformed claims must fail closed rather than raise a 500.
  PERFORM set_config('request.jwt.claims', 'not-json', true);
  v_result := public.process_post_auth_invitation(
                'tok-regression', v_victim, 'existing_session', NULL);
  IF v_result ->> 'error_code' IS DISTINCT FROM 'AUTH_REQUIRED' THEN
    RAISE EXCEPTION 'malformed claims did not fail closed, got %', v_result;
  END IF;

  -- 6. The real invitee, with their own session, still succeeds.
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', v_victim, 'role', 'authenticated')::text, true);
  v_result := public.process_post_auth_invitation(
                'tok-regression', v_victim, 'existing_session', NULL);
  IF COALESCE(v_result ->> 'success', 'false') <> 'true' THEN
    RAISE EXCEPTION 'the legitimate invitee could not accept: %', v_result;
  END IF;

  SELECT count(*) INTO v_count FROM public.team_members WHERE user_id = v_victim;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly 1 membership after a legitimate accept, got %', v_count;
  END IF;

  RAISE NOTICE 'invitation acceptance auth binding: all assertions passed';
END
$test$;

ROLLBACK;
