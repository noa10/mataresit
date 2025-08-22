/**
 * Enhanced Invitation Flow Service
 * Comprehensive service for managing multi-scenario team invitation workflows
 * 
 * Handles:
 * - User state detection (unregistered/registered/logged-in)
 * - Invitation session management with security
 * - Flow routing and context preservation
 * - Post-authentication invitation processing
 */

import { supabase } from '@/lib/supabase';
import {
  ServiceResponse,
  UserType,
  AuthenticationMethod,
  InvitationValidationResult,
  InvitationStateWithContext,
  TeamInvitation,
} from '@/types/team';

export interface InvitationFlowContext {
  invitation_token: string;
  user_type: UserType;
  invitation_id: string;
  team_id: string;
  target_email: string;
  browser_fingerprint?: string;
  ip_address?: string;
  user_agent?: string;
}

export interface UserStateDetectionResult {
  user_type: UserType;
  user_exists: boolean;
  user_logged_in: boolean;
  email_match: boolean;
  current_user_id?: string;
  current_user_email?: string;
  existing_team_membership?: {
    role: string;
    joined_at: string;
  };
  cross_team_memberships: number;
}

export interface InvitationSessionData {
  session_id: string;
  invitation_token: string;
  user_type: UserType;
  target_email: string;
  redirect_after_auth?: string;
  expires_at: string;
  created_at: string;
}

export class InvitationFlowService {
  private static instance: InvitationFlowService;

  static getInstance(): InvitationFlowService {
    if (!InvitationFlowService.instance) {
      InvitationFlowService.instance = new InvitationFlowService();
    }
    return InvitationFlowService.instance;
  }

  // ============================================================================
  // USER STATE DETECTION
  // ============================================================================

  /**
   * Detect user state and validate invitation
   */
  async detectUserState(
    invitationToken: string,
    browserFingerprint?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ServiceResponse<{
    invitation: TeamInvitation;
    user_state: UserStateDetectionResult;
    session_data?: InvitationSessionData;
  }>> {
    try {
      const { data, error } = await supabase.rpc('detect_user_invitation_state', {
        p_invitation_token: invitationToken,
        p_browser_fingerprint: browserFingerprint || null,
        p_ip_address: ipAddress || null,
        p_user_agent: userAgent || null
      });

      if (error) {
        console.error('Error detecting user state:', error);
        return {
          success: false,
          error: error.message,
          error_code: 'USER_STATE_DETECTION_FAILED'
        };
      }

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
          invitation: data.invitation,
          user_state: data.user_state,
          session_data: data.session_data
        }
      };
    } catch (error: any) {
      console.error('Error in detectUserState:', error);
      return {
        success: false,
        error: error.message || 'Failed to detect user state',
        error_code: 'USER_STATE_DETECTION_FAILED'
      };
    }
  }

  // ============================================================================
  // INVITATION SESSION MANAGEMENT
  // ============================================================================

  /**
   * Create secure invitation session for authentication flow
   */
  async createInvitationSession(
    context: InvitationFlowContext,
    redirectAfterAuth?: string
  ): Promise<ServiceResponse<InvitationSessionData>> {
    try {
      const { data, error } = await supabase.rpc('create_invitation_session', {
        p_invitation_token: context.invitation_token,
        p_user_type: context.user_type,
        p_target_email: context.target_email,
        p_redirect_after_auth: redirectAfterAuth || null,
        p_browser_fingerprint: context.browser_fingerprint || null,
        p_ip_address: context.ip_address || null,
        p_user_agent: context.user_agent || null
      });

      if (error) {
        console.error('Error creating invitation session:', error);
        return {
          success: false,
          error: error.message,
          error_code: 'SESSION_CREATION_FAILED'
        };
      }

      if (!data.success) {
        return {
          success: false,
          error: data.error,
          error_code: data.error_code
        };
      }

      return {
        success: true,
        data: data.session_data
      };
    } catch (error: any) {
      console.error('Error in createInvitationSession:', error);
      return {
        success: false,
        error: error.message || 'Failed to create invitation session',
        error_code: 'SESSION_CREATION_FAILED'
      };
    }
  }

  /**
   * Validate and retrieve invitation session
   */
  async getInvitationSession(
    invitationToken: string,
    browserFingerprint?: string
  ): Promise<ServiceResponse<InvitationSessionData>> {
    try {
      const { data, error } = await supabase.rpc('get_invitation_session', {
        p_invitation_token: invitationToken,
        p_browser_fingerprint: browserFingerprint || null
      });

      if (error) {
        console.error('Error getting invitation session:', error);
        return {
          success: false,
          error: error.message,
          error_code: 'SESSION_RETRIEVAL_FAILED'
        };
      }

      if (!data.success) {
        return {
          success: false,
          error: data.error,
          error_code: data.error_code
        };
      }

      return {
        success: true,
        data: data.session_data
      };
    } catch (error: any) {
      console.error('Error in getInvitationSession:', error);
      return {
        success: false,
        error: error.message || 'Failed to get invitation session',
        error_code: 'SESSION_RETRIEVAL_FAILED'
      };
    }
  }

  // ============================================================================
  // INVITATION PROCESSING
  // ============================================================================

  /**
   * Process invitation acceptance after authentication
   */
  async processPostAuthInvitation(
    invitationToken: string,
    userId: string,
    authenticationMethod: AuthenticationMethod,
    browserFingerprint?: string
  ): Promise<ServiceResponse<{
    invitation_accepted: boolean;
    team_id: string;
    team_name: string;
    user_role: string;
    onboarding_required: boolean;
    redirect_url?: string;
  }>> {
    try {
      const { data, error } = await supabase.rpc('process_post_auth_invitation', {
        p_invitation_token: invitationToken,
        p_user_id: userId,
        p_authentication_method: authenticationMethod,
        p_browser_fingerprint: browserFingerprint || null
      });

      if (error) {
        console.error('Error processing post-auth invitation:', error);
        return {
          success: false,
          error: error.message,
          error_code: 'POST_AUTH_PROCESSING_FAILED'
        };
      }

      if (!data.success) {
        return {
          success: false,
          error: data.error,
          error_code: data.error_code
        };
      }

      return {
        success: true,
        data: data.result
      };
    } catch (error: any) {
      console.error('Error in processPostAuthInvitation:', error);
      return {
        success: false,
        error: error.message || 'Failed to process post-auth invitation',
        error_code: 'POST_AUTH_PROCESSING_FAILED'
      };
    }
  }

  /**
   * Validate invitation for direct acceptance (logged-in users)
   */
  async validateDirectAcceptance(
    invitationToken: string,
    userId: string
  ): Promise<ServiceResponse<{
    can_accept: boolean;
    email_match: boolean;
    already_member: boolean;
    invitation_valid: boolean;
    team_id: string;
    team_name: string;
    role: string;
  }>> {
    try {
      const { data, error } = await supabase.rpc('validate_direct_invitation_acceptance', {
        p_invitation_token: invitationToken,
        p_user_id: userId
      });

      if (error) {
        console.error('Error validating direct acceptance:', error);
        return {
          success: false,
          error: error.message,
          error_code: 'VALIDATION_FAILED'
        };
      }

      return {
        success: true,
        data: data
      };
    } catch (error: any) {
      console.error('Error in validateDirectAcceptance:', error);
      return {
        success: false,
        error: error.message || 'Failed to validate direct acceptance',
        error_code: 'VALIDATION_FAILED'
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Generate browser fingerprint for security
   */
  generateBrowserFingerprint(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx!.textBaseline = 'top';
    ctx!.font = '14px Arial';
    ctx!.fillText('Browser fingerprint', 2, 2);
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL()
    ].join('|');
    
    return btoa(fingerprint).substring(0, 32);
  }

  /**
   * Get client IP address (best effort)
   */
  async getClientIPAddress(): Promise<string | null> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.warn('Could not determine client IP address:', error);
      return null;
    }
  }

  /**
   * Clean up expired invitation sessions
   */
  async cleanupExpiredSessions(): Promise<ServiceResponse<{ cleaned_count: number }>> {
    try {
      const { data, error } = await supabase.rpc('cleanup_expired_invitation_sessions');

      if (error) {
        console.error('Error cleaning up expired sessions:', error);
        return {
          success: false,
          error: error.message,
          error_code: 'CLEANUP_FAILED'
        };
      }

      return {
        success: true,
        data: { cleaned_count: data.cleaned_count }
      };
    } catch (error: any) {
      console.error('Error in cleanupExpiredSessions:', error);
      return {
        success: false,
        error: error.message || 'Failed to cleanup expired sessions',
        error_code: 'CLEANUP_FAILED'
      };
    }
  }
}

export const invitationFlowService = InvitationFlowService.getInstance();
