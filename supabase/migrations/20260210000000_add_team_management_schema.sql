-- Team Management Schema Migration
-- This migration adds comprehensive team/organization functionality

-- Create team status enum
CREATE TYPE public.team_status AS ENUM ('active', 'suspended', 'archived');

-- Create team member role enum
CREATE TYPE public.team_member_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- Create invitation status enum
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- Create teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  slug VARCHAR(100) UNIQUE NOT NULL,
  status public.team_status DEFAULT 'active' NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  settings JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT teams_name_length CHECK (char_length(name) >= 2 AND char_length(name) <= 255),
  CONSTRAINT teams_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT teams_slug_length CHECK (char_length(slug) >= 2 AND char_length(slug) <= 100)
);

-- Create team members table
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.team_member_role DEFAULT 'member' NOT NULL,
  permissions JSONB DEFAULT '{}' NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Unique constraint to prevent duplicate memberships
  UNIQUE(team_id, user_id)
);

-- Create team invitations table
CREATE TABLE public.team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  email VARCHAR(255) NOT NULL,
  role public.team_member_role DEFAULT 'member' NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status public.invitation_status DEFAULT 'pending' NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT team_invitations_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT team_invitations_expires_future CHECK (expires_at > created_at)
);

-- Add team_id to receipts table for team-based receipt sharing
ALTER TABLE public.receipts 
ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_teams_owner_id ON public.teams(owner_id);
CREATE INDEX idx_teams_slug ON public.teams(slug);
CREATE INDEX idx_teams_status ON public.teams(status);

CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_team_members_role ON public.team_members(role);

CREATE INDEX idx_team_invitations_team_id ON public.team_invitations(team_id);
CREATE INDEX idx_team_invitations_email ON public.team_invitations(email);
CREATE INDEX idx_team_invitations_token ON public.team_invitations(token);
CREATE INDEX idx_team_invitations_status ON public.team_invitations(status);
CREATE INDEX idx_team_invitations_expires_at ON public.team_invitations(expires_at);

CREATE INDEX idx_receipts_team_id ON public.receipts(team_id);

-- Enable RLS on all team tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Add updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_teams_updated_at 
  BEFORE UPDATE ON public.teams 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at 
  BEFORE UPDATE ON public.team_members 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_invitations_updated_at 
  BEFORE UPDATE ON public.team_invitations 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function to check if user is team member with specific role
CREATE OR REPLACE FUNCTION public.is_team_member(
  _team_id UUID,
  _user_id UUID DEFAULT auth.uid(),
  _min_role public.team_member_role DEFAULT 'viewer'
) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = _team_id 
    AND tm.user_id = _user_id
    AND (
      CASE _min_role
        WHEN 'viewer' THEN tm.role IN ('viewer', 'member', 'admin', 'owner')
        WHEN 'member' THEN tm.role IN ('member', 'admin', 'owner')
        WHEN 'admin' THEN tm.role IN ('admin', 'owner')
        WHEN 'owner' THEN tm.role = 'owner'
        ELSE false
      END
    )
  );
$$;

-- Helper function to check if user is team owner
CREATE OR REPLACE FUNCTION public.is_team_owner(
  _team_id UUID,
  _user_id UUID DEFAULT auth.uid()
) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = _team_id AND t.owner_id = _user_id
  );
$$;
