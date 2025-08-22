/**
 * Enhanced Invitation Onboarding Service
 * Phase 1: Core service for managing invitation states and onboarding progress
 * 
 * This service provides comprehensive functionality for:
 * - Pre-authentication invitation state management
 * - User type detection and flow routing
 * - Onboarding progress tracking
 * - Team-specific onboarding configuration
 */

import { supabase } from '@/lib/supabase';
import {
  ServiceResponse,
  InvitationState,
  OnboardingProgress,
  TeamOnboardingConfig,
  CreateInvitationStateRequest,
  UpdateInvitationStateRequest,
  InitializeOnboardingRequest,
  UpdateOnboardingStepRequest,
  InvitationValidationResult,
  InvitationStateWithContext,
  OnboardingStatus,
  InvitationAnalytics,
  UserType,
  AuthenticationMethod,
  OnboardingStep
} from '@/types/team';

export class EnhancedInvitationOnboardingService {
  
  // ============================================================================
  // INVITATION STATE MANAGEMENT
  // ============================================================================

  /**
   * Create invitation state for pre-authentication tracking
   */
  async createInvitationState(
    request: CreateInvitationStateRequest
  ): Promise<ServiceResponse<{ state_id: string; expires_at: string }>> {
    try {
      const { data, error } = await supabase.rpc('create_invitation_state', {
        p_invitation_token: request.invitation_token,
        p_target_email: request.target_email,
        p_user_type: request.user_type,
        p_redirect_after_auth: request.redirect_after_auth || null,
        p_session_data: request.session_data || {},
        p_browser_fingerprint: request.browser_fingerprint || null,
        p_ip_address: request.ip_address || null,
        p_user_agent: request.user_agent || null
      });

      if (error) throw error;

      if (!data.success) {
        return {
          success: false,
          error: data.error,
          error_code: data.error_code
        };
      }

      return {
        success: true,
        data: {
          state_id: data.state_id,
          expires_at: data.expires_at
        }
      };
    } catch (error: any) {
      console.error('Error creating invitation state:', error);
      return {
        success: false,
        error: error.message || 'Failed to create invitation state',
        error_code: 'CREATE_STATE_FAILED'
      };
    }
  }

  /**
   * Update invitation state after user authentication
   */
  async updateInvitationStateAuthenticated(
    request: UpdateInvitationStateRequest
  ): Promise<ServiceResponse<{
    state_id: string;
    user_type: UserType;
    redirect_after_auth?: string;
    session_data: Record<string, any>;
  }>> {
    try {
      const { data, error } = await supabase.rpc('update_invitation_state_authenticated', {
        p_invitation_token: request.invitation_token,
        p_user_id: request.user_id,
        p_authentication_method: request.authentication_method
      });

      if (error) throw error;

      if (!data.success) {
        return {
          success: false,
          error: data.error,
          error_code: data.error_code
        };
      }

      return {
        success: true,
        data: {
          state_id: data.state_id,
          user_type: data.user_type,
          redirect_after_auth: data.redirect_after_auth,
          session_data: data.session_data
        }
      };
    } catch (error: any) {
      console.error('Error updating invitation state:', error);
      return {
        success: false,
        error: error.message || 'Failed to update invitation state',
        error_code: 'UPDATE_STATE_FAILED'
      };
    }
  }

  /**
   * Get invitation state with full context
   */
  async getInvitationStateWithContext(
    invitationToken: string
  ): Promise<ServiceResponse<InvitationStateWithContext['data']>> {
    try {
      const { data, error } = await supabase.rpc('get_invitation_state_with_context', {
        p_invitation_token: invitationToken
      });

      if (error) throw error;

      if (!data.success) {
        return {
          success: false,
          error: data.error,
          error_code: data.error_code
        };
      }

      return {
        success: true,
        data: data.data
      };
    } catch (error: any) {
      console.error('Error getting invitation state with context:', error);
      return {
        success: false,
        error: error.message || 'Failed to get invitation state',
        error_code: 'GET_STATE_FAILED'
      };
    }
  }

  /**
   * Validate invitation token and detect user type
   */
  async validateInvitationAndDetectUserType(
    invitationToken: string,
    userEmail?: string
  ): Promise<ServiceResponse<InvitationValidationResult>> {
    try {
      const { data, error } = await supabase.rpc('validate_invitation_and_detect_user_type', {
        p_invitation_token: invitationToken,
        p_user_email: userEmail || null
      });

      if (error) throw error;

      if (!data.success) {
        return {
          success: false,
          error: data.error,
          error_code: data.error_code
        };
      }

      return {
        success: true,
        data: {
          success: true,
          invitation: data.invitation,
          user_analysis: data.user_analysis
        }
      };
    } catch (error: any) {
      console.error('Error validating invitation:', error);
      return {
        success: false,
        error: error.message || 'Failed to validate invitation',
        error_code: 'VALIDATION_FAILED'
      };
    }
  }

  // ============================================================================
  // ONBOARDING PROGRESS MANAGEMENT
  // ============================================================================

  /**
   * Initialize onboarding progress for a user
   */
  async initializeOnboardingProgress(
    request: InitializeOnboardingRequest
  ): Promise<ServiceResponse<{
    progress_id: string;
    total_steps: number;
    onboarding_data: Record<string, any>;
  }>> {
    try {
      const { data, error } = await supabase.rpc('initialize_onboarding_progress', {
        p_user_id: request.user_id,
        p_onboarding_type: request.onboarding_type,
        p_team_id: request.team_id || null,
        p_invitation_id: request.invitation_id || null
      });

      if (error) throw error;

      if (!data.success) {
        return {
          success: false,
          error: data.error,
          error_code: data.error_code
        };
      }

      return {
        success: true,
        data: {
          progress_id: data.progress_id,
          total_steps: data.total_steps,
          onboarding_data: data.onboarding_data
        }
      };
    } catch (error: any) {
      console.error('Error initializing onboarding progress:', error);
      return {
        success: false,
        error: error.message || 'Failed to initialize onboarding progress',
        error_code: 'INIT_ONBOARDING_FAILED'
      };
    }
  }

  /**
   * Update onboarding step completion
   */
  async updateOnboardingStep(
    request: UpdateOnboardingStepRequest
  ): Promise<ServiceResponse<{
    progress_id: string;
    step_completed: string;
    completion_percentage: number;
    is_completed: boolean;
    completed_steps: string[];
  }>> {
    try {
      const { data, error } = await supabase.rpc('update_onboarding_step', {
        p_user_id: request.user_id,
        p_step_name: request.step_name,
        p_step_data: request.step_data || {},
        p_team_id: request.team_id || null
      });

      if (error) throw error;

      if (!data.success) {
        return {
          success: false,
          error: data.error,
          error_code: data.error_code
        };
      }

      return {
        success: true,
        data: {
          progress_id: data.progress_id,
          step_completed: data.step_completed,
          completion_percentage: data.completion_percentage,
          is_completed: data.is_completed,
          completed_steps: data.completed_steps
        }
      };
    } catch (error: any) {
      console.error('Error updating onboarding step:', error);
      return {
        success: false,
        error: error.message || 'Failed to update onboarding step',
        error_code: 'UPDATE_STEP_FAILED'
      };
    }
  }

  /**
   * Get user onboarding status
   */
  async getUserOnboardingStatus(
    userId: string,
    teamId?: string
  ): Promise<ServiceResponse<OnboardingStatus>> {
    try {
      const { data, error } = await supabase.rpc('get_user_onboarding_status', {
        p_user_id: userId,
        p_team_id: teamId || null
      });

      if (error) throw error;

      if (!data.success) {
        return {
          success: false,
          error: data.error,
          error_code: data.error_code
        };
      }

      return {
        success: true,
        data: {
          success: true,
          progress: data.progress,
          team_config: data.team_config,
          next_steps: data.next_steps
        }
      };
    } catch (error: any) {
      console.error('Error getting onboarding status:', error);
      return {
        success: false,
        error: error.message || 'Failed to get onboarding status',
        error_code: 'GET_STATUS_FAILED'
      };
    }
  }

  // ============================================================================
  // ANALYTICS AND INSIGHTS
  // ============================================================================

  /**
   * Get invitation system analytics
   */
  async getInvitationAnalytics(
    teamId?: string,
    daysBack: number = 30
  ): Promise<ServiceResponse<InvitationAnalytics>> {
    try {
      const { data, error } = await supabase.rpc('get_invitation_analytics', {
        p_team_id: teamId || null,
        p_days_back: daysBack
      });

      if (error) throw error;

      return {
        success: true,
        data: data
      };
    } catch (error: any) {
      console.error('Error getting invitation analytics:', error);
      return {
        success: false,
        error: error.message || 'Failed to get invitation analytics',
        error_code: 'ANALYTICS_FAILED'
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Cleanup expired invitation states (maintenance function)
   */
  async cleanupExpiredInvitationStates(): Promise<ServiceResponse<{ deleted_count: number }>> {
    try {
      const { data, error } = await supabase.rpc('cleanup_expired_invitation_states');

      if (error) throw error;

      return {
        success: true,
        data: { deleted_count: data }
      };
    } catch (error: any) {
      console.error('Error cleaning up expired invitation states:', error);
      return {
        success: false,
        error: error.message || 'Failed to cleanup expired states',
        error_code: 'CLEANUP_FAILED'
      };
    }
  }
}

// Export singleton instance
export const enhancedInvitationOnboardingService = new EnhancedInvitationOnboardingService();
