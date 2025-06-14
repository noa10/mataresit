-- Row Level Security Policies for Team Management

-- =============================================
-- TEAMS TABLE POLICIES
-- =============================================

-- Teams: Users can view teams they are members of
CREATE POLICY "Users can view teams they belong to"
ON public.teams FOR SELECT
USING (
  auth.uid() = owner_id OR
  public.is_team_member(id, auth.uid(), 'viewer')
);

-- Teams: Users can create teams (they become the owner)
CREATE POLICY "Users can create teams"
ON public.teams FOR INSERT
WITH CHECK (auth.uid() = owner_id);

-- Teams: Only team owners can update team details
CREATE POLICY "Team owners can update teams"
ON public.teams FOR UPDATE
USING (public.is_team_owner(id, auth.uid()));

-- Teams: Only team owners can delete teams
CREATE POLICY "Team owners can delete teams"
ON public.teams FOR DELETE
USING (public.is_team_owner(id, auth.uid()));

-- =============================================
-- TEAM MEMBERS TABLE POLICIES
-- =============================================

-- Team Members: Users can view members of teams they belong to
CREATE POLICY "Users can view team members of their teams"
ON public.team_members FOR SELECT
USING (public.is_team_member(team_id, auth.uid(), 'viewer'));

-- Team Members: Team admins and owners can add members
CREATE POLICY "Team admins can add members"
ON public.team_members FOR INSERT
WITH CHECK (public.is_team_member(team_id, auth.uid(), 'admin'));

-- Team Members: Team admins and owners can update member roles (except owner role)
CREATE POLICY "Team admins can update member roles"
ON public.team_members FOR UPDATE
USING (
  public.is_team_member(team_id, auth.uid(), 'admin') AND
  role != 'owner' -- Cannot change owner role through this table
);

-- Team Members: Team admins can remove members, members can remove themselves
CREATE POLICY "Team admins can remove members or users can remove themselves"
ON public.team_members FOR DELETE
USING (
  public.is_team_member(team_id, auth.uid(), 'admin') OR
  user_id = auth.uid()
);

-- =============================================
-- TEAM INVITATIONS TABLE POLICIES
-- =============================================

-- Team Invitations: Users can view invitations for teams they can manage
CREATE POLICY "Team admins can view team invitations"
ON public.team_invitations FOR SELECT
USING (public.is_team_member(team_id, auth.uid(), 'admin'));

-- Team Invitations: Team admins can create invitations
CREATE POLICY "Team admins can create invitations"
ON public.team_invitations FOR INSERT
WITH CHECK (
  public.is_team_member(team_id, auth.uid(), 'admin') AND
  invited_by = auth.uid()
);

-- Team Invitations: Team admins can update invitations (e.g., cancel them)
CREATE POLICY "Team admins can update invitations"
ON public.team_invitations FOR UPDATE
USING (public.is_team_member(team_id, auth.uid(), 'admin'));

-- Team Invitations: Team admins can delete invitations
CREATE POLICY "Team admins can delete invitations"
ON public.team_invitations FOR DELETE
USING (public.is_team_member(team_id, auth.uid(), 'admin'));

-- =============================================
-- UPDATE RECEIPTS TABLE POLICIES FOR TEAMS
-- =============================================

-- Update existing receipts policies to include team access
-- First, drop the existing policy for viewing receipts
DROP POLICY IF EXISTS "Users can view their own receipts" ON public.receipts;

-- Create new policy that allows viewing own receipts OR team receipts
CREATE POLICY "Users can view their own receipts or team receipts"
ON public.receipts FOR SELECT
USING (
  auth.uid() = user_id OR
  (team_id IS NOT NULL AND public.is_team_member(team_id, auth.uid(), 'viewer'))
);

-- Update insert policy to allow team context
DROP POLICY IF EXISTS "Users can insert their own receipts" ON public.receipts;

CREATE POLICY "Users can insert their own receipts or team receipts"
ON public.receipts FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  (team_id IS NULL OR public.is_team_member(team_id, auth.uid(), 'member'))
);

-- Update update policy for team context
DROP POLICY IF EXISTS "Users can update their own receipts" ON public.receipts;

CREATE POLICY "Users can update their own receipts or team receipts"
ON public.receipts FOR UPDATE
USING (
  auth.uid() = user_id OR
  (team_id IS NOT NULL AND public.is_team_member(team_id, auth.uid(), 'member'))
);

-- Update delete policy for team context
DROP POLICY IF EXISTS "Users can delete their own receipts" ON public.receipts;

CREATE POLICY "Users can delete their own receipts or team receipts"
ON public.receipts FOR DELETE
USING (
  auth.uid() = user_id OR
  (team_id IS NOT NULL AND public.is_team_member(team_id, auth.uid(), 'admin'))
);

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

-- Grant permissions for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invitations TO authenticated;

-- Grant permissions for service role (for functions)
GRANT ALL ON public.teams TO service_role;
GRANT ALL ON public.team_members TO service_role;
GRANT ALL ON public.team_invitations TO service_role;
