-- ============================================================================
-- MEMBER COLLABORATION TOOLS - ROW LEVEL SECURITY POLICIES
-- ============================================================================
-- This migration adds comprehensive RLS policies for the collaboration system
-- ensuring secure access control based on team membership and permissions.

-- ============================================================================
-- 1. ENABLE RLS ON ALL COLLABORATION TABLES
-- ============================================================================

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_access_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. MESSAGES TABLE POLICIES
-- ============================================================================

-- Users can view messages in conversations they participate in
CREATE POLICY "Users can view messages in their conversations" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (
        c.participants @> jsonb_build_array(auth.uid()::text)
        OR messages.sender_id = auth.uid()
        OR messages.recipient_id = auth.uid()
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = messages.team_id
      AND tm.user_id = auth.uid()
      AND tm.removal_scheduled_at IS NULL
    )
  );

-- Users can send messages to conversations they participate in
CREATE POLICY "Users can send messages to their conversations" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND c.participants @> jsonb_build_array(auth.uid()::text)
    )
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = messages.team_id
      AND tm.user_id = auth.uid()
      AND tm.removal_scheduled_at IS NULL
    )
  );

-- Users can edit their own messages
CREATE POLICY "Users can edit their own messages" ON public.messages
  FOR UPDATE USING (
    sender_id = auth.uid()
    AND deleted_at IS NULL
  );

-- Users can soft delete their own messages
CREATE POLICY "Users can delete their own messages" ON public.messages
  FOR UPDATE USING (
    sender_id = auth.uid()
  );

-- ============================================================================
-- 3. CONVERSATIONS TABLE POLICIES
-- ============================================================================

-- Users can view conversations they participate in
CREATE POLICY "Users can view their conversations" ON public.conversations
  FOR SELECT USING (
    participants @> jsonb_build_array(auth.uid()::text)
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = conversations.team_id
      AND tm.user_id = auth.uid()
      AND tm.removal_scheduled_at IS NULL
    )
  );

-- Users can create conversations in teams they belong to
CREATE POLICY "Users can create conversations in their teams" ON public.conversations
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND participants @> jsonb_build_array(auth.uid()::text)
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = conversations.team_id
      AND tm.user_id = auth.uid()
      AND tm.removal_scheduled_at IS NULL
    )
  );

-- Users can update conversations they created or are managers of
CREATE POLICY "Users can update their conversations" ON public.conversations
  FOR UPDATE USING (
    (created_by = auth.uid() OR participants @> jsonb_build_array(auth.uid()::text))
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = conversations.team_id
      AND tm.user_id = auth.uid()
      AND tm.removal_scheduled_at IS NULL
    )
  );

-- ============================================================================
-- 4. PROJECTS TABLE POLICIES
-- ============================================================================

-- Team members can view projects in their teams
CREATE POLICY "Team members can view team projects" ON public.projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = projects.team_id
      AND tm.user_id = auth.uid()
      AND tm.removal_scheduled_at IS NULL
    )
  );

-- Team members with appropriate permissions can create projects
CREATE POLICY "Team members can create projects" ON public.projects
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = projects.team_id
      AND tm.user_id = auth.uid()
      AND tm.removal_scheduled_at IS NULL
      AND (tm.role IN ('owner', 'admin') OR tm.permissions->>'manage_projects' = 'true')
    )
  );

-- Project creators, managers, and team admins can update projects
CREATE POLICY "Authorized users can update projects" ON public.projects
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = projects.team_id
      AND tm.user_id = auth.uid()
      AND tm.removal_scheduled_at IS NULL
      AND (
        tm.role IN ('owner', 'admin')
        OR projects.created_by = auth.uid()
        OR projects.project_manager_id = auth.uid()
        OR tm.permissions->>'manage_projects' = 'true'
      )
    )
  );

-- Only team owners and admins can delete projects
CREATE POLICY "Team admins can delete projects" ON public.projects
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = projects.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
      AND tm.removal_scheduled_at IS NULL
    )
  );

-- ============================================================================
-- 5. PROJECT TASKS TABLE POLICIES
-- ============================================================================

-- Team members can view tasks in projects they have access to
CREATE POLICY "Team members can view project tasks" ON public.project_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = project_tasks.team_id
      AND tm.user_id = auth.uid()
      AND tm.removal_scheduled_at IS NULL
    )
  );

-- Project members can create tasks
CREATE POLICY "Project members can create tasks" ON public.project_tasks
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_tasks.project_id
      AND pm.user_id = auth.uid()
      AND pm.left_at IS NULL
    )
  );

-- Task assignees and project managers can update tasks
CREATE POLICY "Authorized users can update tasks" ON public.project_tasks
  FOR UPDATE USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_tasks.project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('manager', 'lead')
      AND pm.left_at IS NULL
    )
  );

-- ============================================================================
-- 6. PROJECT MEMBERS TABLE POLICIES
-- ============================================================================

-- Project members can view other project members
CREATE POLICY "Project members can view team" ON public.project_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
      AND pm.user_id = auth.uid()
      AND pm.left_at IS NULL
    )
  );

-- Project managers can add members
CREATE POLICY "Project managers can add members" ON public.project_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.project_members pm ON p.id = pm.project_id
      WHERE p.id = project_members.project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('manager', 'lead')
      AND pm.left_at IS NULL
    )
  );

-- ============================================================================
-- 7. DISCUSSION THREADS TABLE POLICIES
-- ============================================================================

-- Team members can view discussion threads
CREATE POLICY "Team members can view discussions" ON public.discussion_threads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = discussion_threads.team_id
      AND tm.user_id = auth.uid()
      AND tm.removal_scheduled_at IS NULL
    )
  );

-- Team members can create discussion threads
CREATE POLICY "Team members can create discussions" ON public.discussion_threads
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = discussion_threads.team_id
      AND tm.user_id = auth.uid()
      AND tm.removal_scheduled_at IS NULL
    )
  );

-- Thread creators and team admins can update threads
CREATE POLICY "Authorized users can update discussions" ON public.discussion_threads
  FOR UPDATE USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = discussion_threads.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
      AND tm.removal_scheduled_at IS NULL
    )
  );

-- ============================================================================
-- 8. DISCUSSION MESSAGES TABLE POLICIES
-- ============================================================================

-- Team members can view discussion messages
CREATE POLICY "Team members can view discussion messages" ON public.discussion_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.discussion_threads dt
      JOIN public.team_members tm ON dt.team_id = tm.team_id
      WHERE dt.id = discussion_messages.thread_id
      AND tm.user_id = auth.uid()
      AND tm.removal_scheduled_at IS NULL
    )
  );

-- Team members can post discussion messages
CREATE POLICY "Team members can post discussion messages" ON public.discussion_messages
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.discussion_threads dt
      JOIN public.team_members tm ON dt.team_id = tm.team_id
      WHERE dt.id = discussion_messages.thread_id
      AND tm.user_id = auth.uid()
      AND tm.removal_scheduled_at IS NULL
      AND dt.is_locked = FALSE
    )
  );

-- Users can edit their own messages
CREATE POLICY "Users can edit their discussion messages" ON public.discussion_messages
  FOR UPDATE USING (
    author_id = auth.uid()
    AND deleted_at IS NULL
  );

-- ============================================================================
-- 9. SHARED FILES TABLE POLICIES
-- ============================================================================

-- Team members can view shared files
CREATE POLICY "Team members can view shared files" ON public.shared_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = shared_files.team_id
      AND tm.user_id = auth.uid()
      AND tm.removal_scheduled_at IS NULL
    )
    AND (
      is_public = TRUE
      OR uploaded_by = auth.uid()
      OR shared_with @> jsonb_build_array(auth.uid()::text)
    )
  );

-- Team members can upload files
CREATE POLICY "Team members can upload files" ON public.shared_files
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = shared_files.team_id
      AND tm.user_id = auth.uid()
      AND tm.removal_scheduled_at IS NULL
    )
  );

-- File uploaders can update their files
CREATE POLICY "File uploaders can update files" ON public.shared_files
  FOR UPDATE USING (
    uploaded_by = auth.uid()
  );

-- ============================================================================
-- 10. FILE ACCESS LOGS TABLE POLICIES
-- ============================================================================

-- Users can view their own file access logs
CREATE POLICY "Users can view their file access logs" ON public.file_access_logs
  FOR SELECT USING (
    user_id = auth.uid()
  );

-- System can insert file access logs
CREATE POLICY "System can log file access" ON public.file_access_logs
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );
