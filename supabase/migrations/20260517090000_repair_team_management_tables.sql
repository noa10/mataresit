-- Repair drift from 20250722000001_enhance_team_management_system.
-- Migration is recorded as applied but ALL of its CREATE statements
-- were skipped in prod: enum team_audit_action, tables team_audit_logs,
-- team_invitation_attempts, team_bulk_operations,
-- team_invitation_rate_limits, plus their RLS and indexes.
--
-- process_post_auth_invitation throws 42P01
--   "relation public.team_audit_logs does not exist" because of this.
-- Re-create everything idempotently.

-- 1. Enum
DO $$
BEGIN
  CREATE TYPE team_audit_action AS ENUM (
    'team_created', 'team_updated', 'team_deleted',
    'member_added', 'member_removed', 'member_role_changed',
    'member_permissions_updated',
    'invitation_sent', 'invitation_resent', 'invitation_cancelled',
    'invitation_accepted', 'invitation_declined', 'invitation_expired',
    'bulk_invitation_sent', 'bulk_member_removed', 'bulk_role_updated',
    'owner_transferred', 'team_settings_updated'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- 2. team_audit_logs
CREATE TABLE IF NOT EXISTS public.team_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  action team_audit_action NOT NULL,
  action_description TEXT,
  performed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_email VARCHAR(255),
  performed_by_name TEXT,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_email VARCHAR(255),
  target_user_name TEXT,
  old_values JSONB DEFAULT '{}',
  new_values JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT team_audit_logs_valid_metadata CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT team_audit_logs_valid_old_values CHECK (jsonb_typeof(old_values) = 'object'),
  CONSTRAINT team_audit_logs_valid_new_values CHECK (jsonb_typeof(new_values) = 'object')
);

-- 3. team_invitation_attempts
CREATE TABLE IF NOT EXISTS public.team_invitation_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES public.team_invitations(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  email_provider_id TEXT,
  delivery_status VARCHAR(50) DEFAULT 'pending',
  delivery_error TEXT,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  CONSTRAINT invitation_attempts_valid_attempt CHECK (attempt_number > 0),
  CONSTRAINT invitation_attempts_valid_status CHECK (
    delivery_status IN ('pending', 'delivered', 'failed', 'bounced', 'spam')
  )
);

-- 4. team_bulk_operations
CREATE TABLE IF NOT EXISTS public.team_bulk_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  operation_type VARCHAR(50) NOT NULL,
  operation_status VARCHAR(50) DEFAULT 'pending',
  performed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  target_data JSONB NOT NULL,
  operation_params JSONB DEFAULT '{}',
  total_items INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  successful_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  results JSONB DEFAULT '{}',
  error_summary TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT bulk_ops_valid_operation_type CHECK (
    operation_type IN ('bulk_invite', 'bulk_remove', 'bulk_role_update', 'bulk_permission_update')
  ),
  CONSTRAINT bulk_ops_valid_status CHECK (
    operation_status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')
  ),
  CONSTRAINT bulk_ops_valid_counts CHECK (
    total_items >= 0 AND processed_items >= 0 AND
    successful_items >= 0 AND failed_items >= 0 AND
    processed_items <= total_items AND
    (successful_items + failed_items) <= processed_items
  )
);

-- 5. team_invitation_rate_limits
CREATE TABLE IF NOT EXISTS public.team_invitation_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitations_last_hour INTEGER DEFAULT 0,
  invitations_last_day INTEGER DEFAULT 0,
  invitations_last_week INTEGER DEFAULT 0,
  hour_window_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  day_window_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  week_window_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_invitation_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_action_created ON public.team_audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_performed_by_created ON public.team_audit_logs(performed_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_target_user_created ON public.team_audit_logs(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_metadata_gin ON public.team_audit_logs USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_description_text ON public.team_audit_logs USING GIN(to_tsvector('english', action_description));
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_team_action_date ON public.team_audit_logs(team_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_team_user_date ON public.team_audit_logs(team_id, performed_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitation_attempts_delivery_status ON public.team_invitation_attempts(delivery_status);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_status ON public.team_bulk_operations(operation_status);

-- 7. RLS
ALTER TABLE public.team_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_bulk_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitation_rate_limits ENABLE ROW LEVEL SECURITY;

-- 8. Policies (drop-and-create so this is re-runnable)
DROP POLICY IF EXISTS "Team members can view audit logs for their teams" ON public.team_audit_logs;
CREATE POLICY "Team members can view audit logs for their teams" ON public.team_audit_logs
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member', 'viewer')
    )
  );

DROP POLICY IF EXISTS "Team admins can insert audit logs" ON public.team_audit_logs;
CREATE POLICY "Team admins can insert audit logs" ON public.team_audit_logs
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Team admins can view invitation attempts" ON public.team_invitation_attempts;
CREATE POLICY "Team admins can view invitation attempts" ON public.team_invitation_attempts
  FOR SELECT USING (
    invitation_id IN (
      SELECT id FROM public.team_invitations
      WHERE team_id IN (
        SELECT team_id FROM public.team_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "Team admins can insert invitation attempts" ON public.team_invitation_attempts;
CREATE POLICY "Team admins can insert invitation attempts" ON public.team_invitation_attempts
  FOR INSERT WITH CHECK (
    invitation_id IN (
      SELECT id FROM public.team_invitations
      WHERE team_id IN (
        SELECT team_id FROM public.team_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "Team admins can manage bulk operations" ON public.team_bulk_operations;
CREATE POLICY "Team admins can manage bulk operations" ON public.team_bulk_operations
  FOR ALL USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can view their own rate limits" ON public.team_invitation_rate_limits;
CREATE POLICY "Users can view their own rate limits" ON public.team_invitation_rate_limits
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can manage rate limits" ON public.team_invitation_rate_limits;
CREATE POLICY "System can manage rate limits" ON public.team_invitation_rate_limits
  FOR ALL USING (true);
