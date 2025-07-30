import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { UserTeam, Team, TeamMember, TeamMemberRole } from '@/types/team';
import { teamService } from '@/services/teamService';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { clearReceiptCaches } from '@/services/receiptService';

// =============================================
// TYPES
// =============================================

interface TeamState {
  // Current team context
  currentTeam: Team | null;
  currentTeamRole: TeamMemberRole | null;
  
  // User's teams
  userTeams: UserTeam[];
  
  // Current team data
  teamMembers: TeamMember[];
  
  // Loading states
  loading: {
    teams: boolean;
    currentTeam: boolean;
    members: boolean;
  };
  
  // Error states
  error: string | null;
}

type TeamAction =
  | { type: 'SET_LOADING'; payload: { key: keyof TeamState['loading']; value: boolean } }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_USER_TEAMS'; payload: UserTeam[] }
  | { type: 'SET_CURRENT_TEAM'; payload: { team: Team | null; role: TeamMemberRole | null } }
  | { type: 'SET_TEAM_MEMBERS'; payload: TeamMember[] }
  | { type: 'ADD_TEAM'; payload: UserTeam }
  | { type: 'UPDATE_TEAM'; payload: Partial<Team> & { id: string } }
  | { type: 'REMOVE_TEAM'; payload: string }
  | { type: 'ADD_TEAM_MEMBER'; payload: TeamMember }
  | { type: 'UPDATE_TEAM_MEMBER'; payload: Partial<TeamMember> & { id: string } }
  | { type: 'REMOVE_TEAM_MEMBER'; payload: string };

interface TeamContextType extends TeamState {
  // Team management
  loadUserTeams: () => Promise<void>;
  switchTeam: (teamId: string | null) => Promise<void>;
  createTeam: (name: string, description?: string) => Promise<string>;
  updateTeam: (teamId: string, updates: Partial<Team>) => Promise<void>;
  deleteTeam: (teamId: string) => Promise<void>;
  
  // Member management
  loadTeamMembers: (teamId: string) => Promise<void>;
  inviteTeamMember: (teamId: string, email: string, role: TeamMemberRole) => Promise<void>;
  removeTeamMember: (teamId: string, userId: string) => Promise<void>;
  updateTeamMemberRole: (teamId: string, userId: string, role: TeamMemberRole) => Promise<void>;
  
  // Utility
  hasPermission: (permission: string) => boolean;
  refreshCurrentTeam: () => Promise<void>;
}

// =============================================
// REDUCER
// =============================================

const initialState: TeamState = {
  currentTeam: null,
  currentTeamRole: null,
  userTeams: [],
  teamMembers: [],
  loading: {
    teams: false,
    currentTeam: false,
    members: false,
  },
  error: null,
};

function teamReducer(state: TeamState, action: TeamAction): TeamState {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        loading: {
          ...state.loading,
          [action.payload.key]: action.payload.value,
        },
      };
      
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };
      
    case 'SET_USER_TEAMS':
      return {
        ...state,
        userTeams: action.payload,
      };
      
    case 'SET_CURRENT_TEAM':
      return {
        ...state,
        currentTeam: action.payload.team,
        currentTeamRole: action.payload.role,
      };
      
    case 'SET_TEAM_MEMBERS':
      return {
        ...state,
        teamMembers: action.payload,
      };
      
    case 'ADD_TEAM':
      return {
        ...state,
        userTeams: [action.payload, ...state.userTeams],
      };
      
    case 'UPDATE_TEAM':
      return {
        ...state,
        userTeams: state.userTeams.map(team =>
          team.id === action.payload.id ? { ...team, ...action.payload } : team
        ),
        currentTeam: state.currentTeam?.id === action.payload.id
          ? { ...state.currentTeam, ...action.payload }
          : state.currentTeam,
      };
      
    case 'REMOVE_TEAM':
      return {
        ...state,
        userTeams: state.userTeams.filter(team => team.id !== action.payload),
        currentTeam: state.currentTeam?.id === action.payload ? null : state.currentTeam,
        currentTeamRole: state.currentTeam?.id === action.payload ? null : state.currentTeamRole,
      };
      
    case 'ADD_TEAM_MEMBER':
      return {
        ...state,
        teamMembers: [...state.teamMembers, action.payload],
      };
      
    case 'UPDATE_TEAM_MEMBER':
      return {
        ...state,
        teamMembers: state.teamMembers.map(member =>
          member.id === action.payload.id ? { ...member, ...action.payload } : member
        ),
      };
      
    case 'REMOVE_TEAM_MEMBER':
      return {
        ...state,
        teamMembers: state.teamMembers.filter(member => member.id !== action.payload),
      };
      
    default:
      return state;
  }
}

// =============================================
// CONTEXT
// =============================================

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(teamReducer, initialState);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load user teams on mount
  useEffect(() => {
    if (user) {
      loadUserTeams();
    }
  }, [user]);

  // TEAM COLLABORATION FIX: Clear receipt caches when team context changes
  useEffect(() => {
    console.log("🔄 Team context changed, clearing receipt caches for fresh data");
    clearReceiptCaches(queryClient);
  }, [state.currentTeam?.id, queryClient]);

  // =============================================
  // TEAM MANAGEMENT
  // =============================================

  const loadUserTeams = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: { key: 'teams', value: true } });
      dispatch({ type: 'SET_ERROR', payload: null });
      
      const teams = await teamService.getUserTeams();
      dispatch({ type: 'SET_USER_TEAMS', payload: teams });
      
      // Check if there's a stored current team
      const storedTeamId = localStorage.getItem('currentTeamId');
      if (storedTeamId && teams.some(team => team.id === storedTeamId)) {
        await switchTeam(storedTeamId);
      } else if (!state.currentTeam && teams.length > 0) {
        // If no current team is selected and user has teams, select the first one
        await switchTeam(teams[0].id);
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      toast({
        title: 'Error',
        description: 'Failed to load teams',
        variant: 'destructive',
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'teams', value: false } });
    }
  };

  const switchTeam = async (teamId: string | null) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: { key: 'currentTeam', value: true } });
      dispatch({ type: 'SET_ERROR', payload: null });
      
      if (!teamId) {
        dispatch({ type: 'SET_CURRENT_TEAM', payload: { team: null, role: null } });
        dispatch({ type: 'SET_TEAM_MEMBERS', payload: [] });
        return;
      }
      
      const [team, role] = await Promise.all([
        teamService.getTeam(teamId),
        teamService.checkTeamMembership(teamId),
      ]);
      
      if (!team || !role) {
        throw new Error('Team not found or access denied');
      }
      
      dispatch({ type: 'SET_CURRENT_TEAM', payload: { team, role } });
      
      // Load team members
      await loadTeamMembers(teamId);
      
      // Store current team in localStorage
      localStorage.setItem('currentTeamId', teamId);
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      toast({
        title: 'Error',
        description: 'Failed to switch team',
        variant: 'destructive',
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'currentTeam', value: false } });
    }
  };

  const createTeam = async (name: string, description?: string): Promise<string> => {
    try {
      const teamId = await teamService.createTeam({ name, description });
      
      // Reload user teams to include the new team
      await loadUserTeams();
      
      toast({
        title: 'Success',
        description: 'Team created successfully',
      });
      
      return teamId;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create team',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateTeam = async (teamId: string, updates: Partial<Team>) => {
    try {
      await teamService.updateTeam(teamId, updates);
      dispatch({ type: 'UPDATE_TEAM', payload: { id: teamId, ...updates } });
      
      toast({
        title: 'Success',
        description: 'Team updated successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update team',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteTeam = async (teamId: string) => {
    try {
      await teamService.deleteTeam(teamId);
      dispatch({ type: 'REMOVE_TEAM', payload: teamId });
      
      toast({
        title: 'Success',
        description: 'Team deleted successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete team',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // =============================================
  // MEMBER MANAGEMENT
  // =============================================

  const loadTeamMembers = async (teamId: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: { key: 'members', value: true } });
      const members = await teamService.getTeamMembers(teamId);
      dispatch({ type: 'SET_TEAM_MEMBERS', payload: members });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load team members',
        variant: 'destructive',
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'members', value: false } });
    }
  };

  const inviteTeamMember = async (teamId: string, email: string, role: TeamMemberRole) => {
    try {
      await teamService.inviteTeamMember({ team_id: teamId, email, role });
      
      toast({
        title: 'Success',
        description: 'Invitation sent successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invitation',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const removeTeamMember = async (teamId: string, userId: string) => {
    try {
      await teamService.removeTeamMember(teamId, userId);
      dispatch({ type: 'REMOVE_TEAM_MEMBER', payload: userId });
      
      toast({
        title: 'Success',
        description: 'Team member removed successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove team member',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateTeamMemberRole = async (teamId: string, userId: string, role: TeamMemberRole) => {
    try {
      await teamService.updateTeamMemberRole({ team_id: teamId, user_id: userId, role });
      dispatch({ type: 'UPDATE_TEAM_MEMBER', payload: { id: userId, role } });
      
      toast({
        title: 'Success',
        description: 'Team member role updated successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update team member role',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // =============================================
  // UTILITY METHODS
  // =============================================

  const hasPermission = (permission: string): boolean => {
    if (!state.currentTeamRole) return false;

    // Permission check based on team roles and claim requirements
    switch (permission) {
      case 'manage_team':
        return ['owner', 'admin'].includes(state.currentTeamRole);
      case 'invite_members':
        return ['owner', 'admin'].includes(state.currentTeamRole);
      case 'manage_receipts':
        return ['owner', 'admin', 'member'].includes(state.currentTeamRole);
      case 'view_receipts':
        return ['owner', 'admin', 'member', 'viewer'].includes(state.currentTeamRole);

      // Member management permissions
      case 'view_members':
        return ['owner', 'admin', 'member', 'viewer'].includes(state.currentTeamRole);
      case 'manage_members':
        return ['owner', 'admin'].includes(state.currentTeamRole);
      case 'remove_members':
        return ['owner', 'admin'].includes(state.currentTeamRole);
      case 'update_member_roles':
        return ['owner', 'admin'].includes(state.currentTeamRole);

      // Audit and security permissions
      case 'view_audit_logs':
        return ['owner', 'admin'].includes(state.currentTeamRole);

      // Claim permissions
      case 'create_claims':
        return ['owner', 'admin', 'member'].includes(state.currentTeamRole);
      case 'view_claims':
        return ['owner', 'admin', 'member', 'viewer'].includes(state.currentTeamRole);
      case 'edit_claims':
        return ['owner', 'admin', 'member'].includes(state.currentTeamRole);
      case 'submit_claims':
        return ['owner', 'admin', 'member'].includes(state.currentTeamRole);
      case 'approve_claims':
        return ['owner', 'admin'].includes(state.currentTeamRole);
      case 'review_claims':
        return ['owner', 'admin'].includes(state.currentTeamRole);
      case 'delete_claims':
        return ['owner'].includes(state.currentTeamRole);

      default:
        return false;
    }
  };

  const refreshCurrentTeam = async () => {
    if (state.currentTeam) {
      await switchTeam(state.currentTeam.id);
    }
  };

  const contextValue: TeamContextType = {
    ...state,
    loadUserTeams,
    switchTeam,
    createTeam,
    updateTeam,
    deleteTeam,
    loadTeamMembers,
    inviteTeamMember,
    removeTeamMember,
    updateTeamMemberRole,
    hasPermission,
    refreshCurrentTeam,
  };

  return (
    <TeamContext.Provider value={contextValue}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
}
