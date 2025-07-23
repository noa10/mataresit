import { supabase } from '@/lib/supabase';

export interface SecurityCheckResult {
  allowed: boolean;
  error?: string;
  errorCode?: string;
  rateLimitInfo?: {
    currentCount: number;
    maxRequests: number;
    remainingRequests: number;
    windowStart: string;
    windowEnd: string;
    blockedUntil?: string;
  };
  securityInfo?: {
    userRole: string;
    teamId: string;
    permission: string;
  };
}

export interface RateLimitConfig {
  inviteMembers: { maxPerHour: number; maxPerDay: number };
  bulkOperations: { maxPerHour: number; maxPerDay: number };
  roleUpdates: { maxPerHour: number; maxPerDay: number };
  memberRemovals: { maxPerHour: number; maxPerDay: number };
}

export interface SecurityConfig {
  require2FAForAdmin: boolean;
  sessionTimeoutMinutes: number;
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  requireApprovalForBulkOps: boolean;
  auditAllActions: boolean;
}

export class SecurityManager {
  private static instance: SecurityManager;
  private securityCache = new Map<string, { data: any; expires: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  /**
   * Enhanced permission check with security logging
   */
  async checkPermission(
    teamId: string,
    permission: string,
    operationContext: Record<string, any> = {}
  ): Promise<SecurityCheckResult> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return {
          allowed: false,
          error: 'User not authenticated',
          errorCode: 'NOT_AUTHENTICATED'
        };
      }

      const { data, error } = await supabase.rpc('check_team_permission_enhanced', {
        p_team_id: teamId,
        p_user_id: user.user.id,
        p_required_permission: permission,
        p_operation_context: operationContext
      });

      if (error) {
        throw error;
      }

      return {
        allowed: data.allowed,
        error: data.error,
        errorCode: data.error_code,
        securityInfo: {
          userRole: data.user_role,
          teamId: data.team_id,
          permission: data.permission
        }
      };
    } catch (error: any) {
      console.error('Permission check failed:', error);
      return {
        allowed: false,
        error: error.message || 'Permission check failed',
        errorCode: 'PERMISSION_CHECK_FAILED'
      };
    }
  }

  /**
   * Check rate limits for operations
   */
  async checkRateLimit(
    teamId: string,
    operationType: string,
    requestCount: number = 1
  ): Promise<SecurityCheckResult> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return {
          allowed: false,
          error: 'User not authenticated',
          errorCode: 'NOT_AUTHENTICATED'
        };
      }

      const { data, error } = await supabase.rpc('check_rate_limit', {
        p_user_id: user.user.id,
        p_team_id: teamId,
        p_operation_type: operationType,
        p_request_count: requestCount
      });

      if (error) {
        throw error;
      }

      return {
        allowed: data.allowed,
        error: data.error,
        errorCode: data.error_code,
        rateLimitInfo: data.allowed ? {
          currentCount: data.current_count,
          maxRequests: data.max_requests,
          remainingRequests: data.remaining_requests,
          windowStart: data.window_start,
          windowEnd: data.window_end
        } : {
          currentCount: data.current_count,
          maxRequests: data.max_requests,
          remainingRequests: 0,
          windowStart: data.window_start,
          windowEnd: data.window_end,
          blockedUntil: data.blocked_until
        }
      };
    } catch (error: any) {
      console.error('Rate limit check failed:', error);
      return {
        allowed: false,
        error: error.message || 'Rate limit check failed',
        errorCode: 'RATE_LIMIT_CHECK_FAILED'
      };
    }
  }

  /**
   * Secure team member invitation with all security checks
   */
  async inviteTeamMemberSecure(
    teamId: string,
    email: string,
    role: string,
    customMessage?: string
  ): Promise<any> {
    try {
      const ipAddress = await this.getClientIP();
      const userAgent = navigator.userAgent;

      const { data, error } = await supabase.rpc('invite_team_member_secure', {
        p_team_id: teamId,
        p_email: email,
        p_role: role,
        p_custom_message: customMessage || null,
        p_ip_address: ipAddress,
        p_user_agent: userAgent
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error('Secure invitation failed:', error);
      throw new Error(error.message || 'Failed to send invitation');
    }
  }

  /**
   * Secure bulk operation execution with all security checks
   */
  async executeBulkOperationSecure(
    teamId: string,
    operationType: string,
    operationData: Record<string, any>
  ): Promise<any> {
    try {
      const ipAddress = await this.getClientIP();
      const userAgent = navigator.userAgent;

      const { data, error } = await supabase.rpc('execute_bulk_operation_secure', {
        p_team_id: teamId,
        p_operation_type: operationType,
        p_operation_data: operationData,
        p_ip_address: ipAddress,
        p_user_agent: userAgent
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error('Secure bulk operation failed:', error);
      throw new Error(error.message || 'Failed to execute bulk operation');
    }
  }

  /**
   * Get team security dashboard data
   */
  async getSecurityDashboard(teamId: string, days: number = 7): Promise<any> {
    try {
      const cacheKey = `security_dashboard_${teamId}_${days}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return cached;
      }

      const { data, error } = await supabase.rpc('get_team_security_dashboard', {
        p_team_id: teamId,
        p_days: days
      });

      if (error) {
        throw error;
      }

      this.setCachedData(cacheKey, data);
      return data;
    } catch (error: any) {
      console.error('Failed to get security dashboard:', error);
      throw new Error(error.message || 'Failed to load security dashboard');
    }
  }

  /**
   * Get team security configuration
   */
  async getSecurityConfig(teamId: string): Promise<SecurityConfig | null> {
    try {
      const cacheKey = `security_config_${teamId}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return cached;
      }

      const { data, error } = await supabase
        .from('team_security_configs')
        .select('security_settings')
        .eq('team_id', teamId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const config = data?.security_settings || {
        require_2fa_for_admin: false,
        session_timeout_minutes: 480,
        max_failed_attempts: 5,
        lockout_duration_minutes: 30,
        require_approval_for_bulk_ops: true,
        audit_all_actions: true
      };

      const securityConfig: SecurityConfig = {
        require2FAForAdmin: config.require_2fa_for_admin,
        sessionTimeoutMinutes: config.session_timeout_minutes,
        maxFailedAttempts: config.max_failed_attempts,
        lockoutDurationMinutes: config.lockout_duration_minutes,
        requireApprovalForBulkOps: config.require_approval_for_bulk_ops,
        auditAllActions: config.audit_all_actions
      };

      this.setCachedData(cacheKey, securityConfig);
      return securityConfig;
    } catch (error: any) {
      console.error('Failed to get security config:', error);
      return null;
    }
  }

  /**
   * Update team security configuration
   */
  async updateSecurityConfig(teamId: string, config: Partial<SecurityConfig>): Promise<void> {
    try {
      const dbConfig = {
        require_2fa_for_admin: config.require2FAForAdmin,
        session_timeout_minutes: config.sessionTimeoutMinutes,
        max_failed_attempts: config.maxFailedAttempts,
        lockout_duration_minutes: config.lockoutDurationMinutes,
        require_approval_for_bulk_ops: config.requireApprovalForBulkOps,
        audit_all_actions: config.auditAllActions
      };

      const { error } = await supabase
        .from('team_security_configs')
        .upsert({
          team_id: teamId,
          security_settings: dbConfig,
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      // Clear cache
      this.clearCache(`security_config_${teamId}`);
    } catch (error: any) {
      console.error('Failed to update security config:', error);
      throw new Error(error.message || 'Failed to update security configuration');
    }
  }

  /**
   * Get rate limit configuration
   */
  async getRateLimitConfig(teamId: string): Promise<RateLimitConfig | null> {
    try {
      const cacheKey = `rate_limit_config_${teamId}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return cached;
      }

      const { data, error } = await supabase
        .from('team_security_configs')
        .select('rate_limits')
        .eq('team_id', teamId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const rateLimits = data?.rate_limits || {
        invite_members: { max_per_hour: 50, max_per_day: 200 },
        bulk_operations: { max_per_hour: 10, max_per_day: 50 },
        role_updates: { max_per_hour: 100, max_per_day: 500 },
        member_removals: { max_per_hour: 20, max_per_day: 100 }
      };

      const config: RateLimitConfig = {
        inviteMembers: {
          maxPerHour: rateLimits.invite_members.max_per_hour,
          maxPerDay: rateLimits.invite_members.max_per_day
        },
        bulkOperations: {
          maxPerHour: rateLimits.bulk_operations.max_per_hour,
          maxPerDay: rateLimits.bulk_operations.max_per_day
        },
        roleUpdates: {
          maxPerHour: rateLimits.role_updates.max_per_hour,
          maxPerDay: rateLimits.role_updates.max_per_day
        },
        memberRemovals: {
          maxPerHour: rateLimits.member_removals.max_per_hour,
          maxPerDay: rateLimits.member_removals.max_per_day
        }
      };

      this.setCachedData(cacheKey, config);
      return config;
    } catch (error: any) {
      console.error('Failed to get rate limit config:', error);
      return null;
    }
  }

  /**
   * Clear authentication failures after successful operation
   */
  async clearAuthFailures(teamId: string, failureType?: string): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      await supabase.rpc('clear_auth_failures', {
        p_user_id: user.user.id,
        p_team_id: teamId,
        p_failure_type: failureType || null
      });
    } catch (error: any) {
      console.error('Failed to clear auth failures:', error);
    }
  }

  /**
   * Get client IP address (best effort)
   */
  private async getClientIP(): Promise<string | null> {
    try {
      // In a real implementation, you might use a service to get the client IP
      // For now, we'll return null and let the backend handle it
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Cache management
   */
  private getCachedData(key: string): any | null {
    const cached = this.securityCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    this.securityCache.delete(key);
    return null;
  }

  private setCachedData(key: string, data: any): void {
    this.securityCache.set(key, {
      data,
      expires: Date.now() + this.CACHE_TTL
    });
  }

  private clearCache(key?: string): void {
    if (key) {
      this.securityCache.delete(key);
    } else {
      this.securityCache.clear();
    }
  }
}

export const securityManager = SecurityManager.getInstance();
