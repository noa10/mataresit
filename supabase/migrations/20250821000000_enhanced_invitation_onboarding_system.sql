-- Enhanced Invitation Onboarding System Migration
-- Phase 1: Database Schema Enhancements for Comprehensive Team Invitation Workflow
-- Created: 2025-08-21
-- Description: Adds support for pre-authentication state persistence, onboarding tracking, and enhanced user flows

-- ============================================================================
-- 1. INVITATION STATE PERSISTENCE SYSTEM
-- ============================================================================

-- Create invitation states table for tracking invitation context during authentication
CREATE TABLE IF NOT EXISTS public.invitation_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_token VARCHAR(255) NOT NULL UNIQUE,
  invitation_id UUID NOT NULL REFERENCES public.team_invitations(id) ON DELETE CASCADE,
  
  -- User context
  target_email VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Set when user authenticates
  
  -- State tracking
  state VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'authenticating', 'authenticated', 'accepted', 'expired', 'cancelled')),
  authentication_method VARCHAR(50), -- 'google_oauth', 'email_password', etc.
  
  -- Flow context
  user_type VARCHAR(50) NOT NULL CHECK (user_type IN ('unregistered', 'logged_out', 'logged_in', 'cross_team')),
  redirect_after_auth VARCHAR(500), -- Where to redirect after successful authentication
  
  -- Session data
  session_data JSONB DEFAULT '{}', -- Store temporary data during auth flow
  browser_fingerprint TEXT, -- For security validation
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  authenticated_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. ONBOARDING PROGRESS TRACKING SYSTEM
-- ============================================================================

-- Create onboarding progress table for tracking user setup completion
CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Onboarding type and context
  onboarding_type VARCHAR(50) NOT NULL DEFAULT 'team_invitation' CHECK (onboarding_type IN ('team_invitation', 'self_signup', 'admin_created')),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE, -- Team context for invitation-based onboarding
  invitation_id UUID REFERENCES public.team_invitations(id) ON DELETE SET NULL,
  
  -- Progress tracking
  current_step VARCHAR(100) NOT NULL DEFAULT 'profile_setup',
  completed_steps JSONB NOT NULL DEFAULT '[]', -- Array of completed step names
  total_steps INTEGER NOT NULL DEFAULT 5,
  completion_percentage INTEGER NOT NULL DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  
  -- Step-specific data
  profile_completed BOOLEAN NOT NULL DEFAULT false,
  team_introduction_viewed BOOLEAN NOT NULL DEFAULT false,
  first_receipt_uploaded BOOLEAN NOT NULL DEFAULT false,
  dashboard_tour_completed BOOLEAN NOT NULL DEFAULT false,
  preferences_configured BOOLEAN NOT NULL DEFAULT false,
  
  -- Onboarding metadata
  onboarding_data JSONB DEFAULT '{}', -- Store step-specific data and preferences
  skip_reasons JSONB DEFAULT '{}', -- Track why steps were skipped
  
  -- Completion tracking
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, onboarding_type, team_id)
);

-- ============================================================================
-- 3. TEAM ONBOARDING CONFIGURATION SYSTEM
-- ============================================================================

-- Create team onboarding configuration table for customizable team-specific onboarding
CREATE TABLE IF NOT EXISTS public.team_onboarding_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE UNIQUE,
  
  -- Onboarding flow configuration
  enabled BOOLEAN NOT NULL DEFAULT true,
  welcome_message TEXT,
  introduction_video_url TEXT,
  custom_steps JSONB DEFAULT '[]', -- Array of custom onboarding steps
  
  -- Step configuration
  require_profile_completion BOOLEAN NOT NULL DEFAULT true,
  require_team_introduction BOOLEAN NOT NULL DEFAULT true,
  require_first_upload BOOLEAN NOT NULL DEFAULT false,
  require_dashboard_tour BOOLEAN NOT NULL DEFAULT true,
  require_preferences_setup BOOLEAN NOT NULL DEFAULT false,
  
  -- Customization options
  brand_colors JSONB DEFAULT '{}', -- Team-specific color scheme
  custom_resources JSONB DEFAULT '[]', -- Links to team-specific resources
  mentor_assignments JSONB DEFAULT '{}', -- Assign mentors to new members
  
  -- Notification settings
  notify_admins_on_join BOOLEAN NOT NULL DEFAULT true,
  notify_team_on_completion BOOLEAN NOT NULL DEFAULT false,
  
  -- Metadata
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. ENHANCED INVITATION TRACKING
-- ============================================================================

-- Add new columns to team_invitations for enhanced onboarding support
ALTER TABLE public.team_invitations 
ADD COLUMN IF NOT EXISTS onboarding_required BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS user_type_detected VARCHAR(50), -- Track detected user type
ADD COLUMN IF NOT EXISTS authentication_method VARCHAR(50), -- Track how user authenticated
ADD COLUMN IF NOT EXISTS acceptance_ip_address INET, -- Track IP for security
ADD COLUMN IF NOT EXISTS acceptance_user_agent TEXT; -- Track user agent for security

-- ============================================================================
-- 5. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Invitation states indexes
CREATE INDEX IF NOT EXISTS idx_invitation_states_token ON public.invitation_states(invitation_token);
CREATE INDEX IF NOT EXISTS idx_invitation_states_email ON public.invitation_states(target_email);
CREATE INDEX IF NOT EXISTS idx_invitation_states_user_id ON public.invitation_states(user_id);
CREATE INDEX IF NOT EXISTS idx_invitation_states_state ON public.invitation_states(state);
CREATE INDEX IF NOT EXISTS idx_invitation_states_expires_at ON public.invitation_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_invitation_states_created_at ON public.invitation_states(created_at DESC);

-- Onboarding progress indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user_id ON public.onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_team_id ON public.onboarding_progress(team_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_type ON public.onboarding_progress(onboarding_type);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_completed ON public.onboarding_progress(is_completed);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_step ON public.onboarding_progress(current_step);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_activity ON public.onboarding_progress(last_activity_at DESC);

-- Team onboarding config indexes
CREATE INDEX IF NOT EXISTS idx_team_onboarding_configs_team_id ON public.team_onboarding_configs(team_id);
CREATE INDEX IF NOT EXISTS idx_team_onboarding_configs_enabled ON public.team_onboarding_configs(enabled);

-- Enhanced invitation indexes
CREATE INDEX IF NOT EXISTS idx_team_invitations_onboarding_required ON public.team_invitations(onboarding_required);
CREATE INDEX IF NOT EXISTS idx_team_invitations_onboarding_completed ON public.team_invitations(onboarding_completed);
CREATE INDEX IF NOT EXISTS idx_team_invitations_user_type ON public.team_invitations(user_type_detected);

-- ============================================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.invitation_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_onboarding_configs ENABLE ROW LEVEL SECURITY;

-- Invitation states policies
CREATE POLICY "Users can view their own invitation states" ON public.invitation_states
  FOR SELECT USING (
    target_email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
    user_id = auth.uid()
  );

CREATE POLICY "System can manage invitation states" ON public.invitation_states
  FOR ALL USING (true); -- Will be restricted by service role

-- Onboarding progress policies
CREATE POLICY "Users can view their own onboarding progress" ON public.onboarding_progress
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own onboarding progress" ON public.onboarding_progress
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Team admins can view team member onboarding progress" ON public.onboarding_progress
  FOR SELECT USING (
    team_id IS NOT NULL AND 
    EXISTS (
      SELECT 1 FROM public.team_members tm 
      WHERE tm.team_id = onboarding_progress.team_id 
      AND tm.user_id = auth.uid() 
      AND tm.role IN ('admin', 'owner')
    )
  );

-- Team onboarding config policies
CREATE POLICY "Team admins can manage onboarding configs" ON public.team_onboarding_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm 
      WHERE tm.team_id = team_onboarding_configs.team_id 
      AND tm.user_id = auth.uid() 
      AND tm.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Team members can view onboarding configs" ON public.team_onboarding_configs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm 
      WHERE tm.team_id = team_onboarding_configs.team_id 
      AND tm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 7. TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Update timestamps trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER update_invitation_states_updated_at
  BEFORE UPDATE ON public.invitation_states
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_onboarding_progress_updated_at
  BEFORE UPDATE ON public.onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_onboarding_configs_updated_at
  BEFORE UPDATE ON public.team_onboarding_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.invitation_states IS 'Tracks invitation context and state during authentication flow for seamless user experience';
COMMENT ON TABLE public.onboarding_progress IS 'Tracks user onboarding progress and completion status for team invitations and self-signups';
COMMENT ON TABLE public.team_onboarding_configs IS 'Team-specific onboarding configuration and customization settings';

COMMENT ON COLUMN public.invitation_states.user_type IS 'Detected user type: unregistered, logged_out, logged_in, cross_team';
COMMENT ON COLUMN public.invitation_states.session_data IS 'Temporary data stored during authentication flow';
COMMENT ON COLUMN public.onboarding_progress.completed_steps IS 'Array of completed onboarding step names';
COMMENT ON COLUMN public.team_onboarding_configs.custom_steps IS 'Array of team-specific custom onboarding steps';

-- ============================================================================
-- 9. CORE FUNCTIONS FOR INVITATION STATE MANAGEMENT
-- ============================================================================

-- Function to create invitation state for pre-authentication tracking
CREATE OR REPLACE FUNCTION public.create_invitation_state(
  p_invitation_token VARCHAR(255),
  p_target_email VARCHAR(255),
  p_user_type VARCHAR(50),
  p_redirect_after_auth VARCHAR(500) DEFAULT NULL,
  p_session_data JSONB DEFAULT '{}',
  p_browser_fingerprint TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_invitation_id UUID;
  v_state_id UUID;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Validate invitation token exists and is valid
  SELECT id INTO v_invitation_id
  FROM public.team_invitations
  WHERE token = p_invitation_token
    AND status = 'pending'
    AND expires_at > NOW();

  IF v_invitation_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired invitation token',
      'error_code', 'INVALID_TOKEN'
    );
  END IF;

  -- Set expiration (2 hours from now)
  v_expires_at := NOW() + INTERVAL '2 hours';

  -- Create or update invitation state
  INSERT INTO public.invitation_states (
    invitation_token,
    invitation_id,
    target_email,
    user_type,
    redirect_after_auth,
    session_data,
    browser_fingerprint,
    ip_address,
    user_agent,
    expires_at
  ) VALUES (
    p_invitation_token,
    v_invitation_id,
    p_target_email,
    p_user_type,
    p_redirect_after_auth,
    p_session_data,
    p_browser_fingerprint,
    p_ip_address,
    p_user_agent,
    v_expires_at
  )
  ON CONFLICT (invitation_token) DO UPDATE SET
    user_type = EXCLUDED.user_type,
    redirect_after_auth = EXCLUDED.redirect_after_auth,
    session_data = EXCLUDED.session_data,
    browser_fingerprint = EXCLUDED.browser_fingerprint,
    ip_address = EXCLUDED.ip_address,
    user_agent = EXCLUDED.user_agent,
    expires_at = EXCLUDED.expires_at,
    updated_at = NOW()
  RETURNING id INTO v_state_id;

  RETURN jsonb_build_object(
    'success', true,
    'state_id', v_state_id,
    'expires_at', v_expires_at,
    'message', 'Invitation state created successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update invitation state after authentication
CREATE OR REPLACE FUNCTION public.update_invitation_state_authenticated(
  p_invitation_token VARCHAR(255),
  p_user_id UUID,
  p_authentication_method VARCHAR(50)
) RETURNS JSONB AS $$
DECLARE
  v_state_record RECORD;
BEGIN
  -- Get and update the invitation state
  UPDATE public.invitation_states
  SET
    user_id = p_user_id,
    state = 'authenticated',
    authentication_method = p_authentication_method,
    authenticated_at = NOW(),
    updated_at = NOW()
  WHERE invitation_token = p_invitation_token
    AND state IN ('pending', 'authenticating')
    AND expires_at > NOW()
  RETURNING * INTO v_state_record;

  IF v_state_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invitation state not found or expired',
      'error_code', 'STATE_NOT_FOUND'
    );
  END IF;

  -- Update the original invitation with user type detection
  UPDATE public.team_invitations
  SET
    user_type_detected = v_state_record.user_type,
    authentication_method = p_authentication_method,
    updated_at = NOW()
  WHERE id = v_state_record.invitation_id;

  RETURN jsonb_build_object(
    'success', true,
    'state_id', v_state_record.id,
    'user_type', v_state_record.user_type,
    'redirect_after_auth', v_state_record.redirect_after_auth,
    'session_data', v_state_record.session_data,
    'message', 'Invitation state updated after authentication'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to initialize onboarding progress
CREATE OR REPLACE FUNCTION public.initialize_onboarding_progress(
  p_user_id UUID,
  p_onboarding_type VARCHAR(50),
  p_team_id UUID DEFAULT NULL,
  p_invitation_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_progress_id UUID;
  v_team_config RECORD;
  v_total_steps INTEGER := 5;
  v_onboarding_data JSONB := '{}';
BEGIN
  -- Get team onboarding configuration if team context exists
  IF p_team_id IS NOT NULL THEN
    SELECT * INTO v_team_config
    FROM public.team_onboarding_configs
    WHERE team_id = p_team_id AND enabled = true;

    -- Calculate total steps based on team configuration
    IF v_team_config.id IS NOT NULL THEN
      v_total_steps := 0;
      IF v_team_config.require_profile_completion THEN v_total_steps := v_total_steps + 1; END IF;
      IF v_team_config.require_team_introduction THEN v_total_steps := v_total_steps + 1; END IF;
      IF v_team_config.require_first_upload THEN v_total_steps := v_total_steps + 1; END IF;
      IF v_team_config.require_dashboard_tour THEN v_total_steps := v_total_steps + 1; END IF;
      IF v_team_config.require_preferences_setup THEN v_total_steps := v_total_steps + 1; END IF;

      -- Add custom steps
      IF v_team_config.custom_steps IS NOT NULL THEN
        v_total_steps := v_total_steps + jsonb_array_length(v_team_config.custom_steps);
      END IF;

      -- Store team configuration in onboarding data
      v_onboarding_data := jsonb_build_object(
        'team_config', row_to_json(v_team_config),
        'custom_steps', COALESCE(v_team_config.custom_steps, '[]'::jsonb)
      );
    END IF;
  END IF;

  -- Create onboarding progress record
  INSERT INTO public.onboarding_progress (
    user_id,
    onboarding_type,
    team_id,
    invitation_id,
    total_steps,
    onboarding_data
  ) VALUES (
    p_user_id,
    p_onboarding_type,
    p_team_id,
    p_invitation_id,
    v_total_steps,
    v_onboarding_data
  )
  ON CONFLICT (user_id, onboarding_type, team_id) DO UPDATE SET
    invitation_id = EXCLUDED.invitation_id,
    total_steps = EXCLUDED.total_steps,
    onboarding_data = EXCLUDED.onboarding_data,
    last_activity_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_progress_id;

  RETURN jsonb_build_object(
    'success', true,
    'progress_id', v_progress_id,
    'total_steps', v_total_steps,
    'onboarding_data', v_onboarding_data,
    'message', 'Onboarding progress initialized successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MIGRATION COMPLETION LOG
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Enhanced Invitation Onboarding System Phase 1 migration completed successfully';
  RAISE NOTICE 'New tables: invitation_states, onboarding_progress, team_onboarding_configs';
  RAISE NOTICE 'Enhanced table: team_invitations (added onboarding tracking columns)';
  RAISE NOTICE 'Core functions: create_invitation_state, update_invitation_state_authenticated, initialize_onboarding_progress';
  RAISE NOTICE 'Added comprehensive indexes and RLS policies for security and performance';
  RAISE NOTICE 'Ready for Phase 2: Enhanced Authentication Flow implementation';
END $$;
