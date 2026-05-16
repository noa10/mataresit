-- Repair drift: 20250722000001 is recorded as applied, but its
-- ALTER TABLE public.team_members block never landed in prod (the
-- team_invitations block in the same migration did — those columns
-- exist). Re-apply just the team_members additions, idempotently.
--
-- Symptom prior to repair: process_post_auth_invitation throws
--   42703 column "invitation_accepted_at" of relation "team_members"
--   does not exist
-- because it tries to write the column when accepting an invite.
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removal_scheduled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS removal_scheduled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS member_metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_team_members_last_active
  ON public.team_members(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_members_added_by
  ON public.team_members(added_by);
CREATE INDEX IF NOT EXISTS idx_team_members_removal_scheduled
  ON public.team_members(removal_scheduled_at);
