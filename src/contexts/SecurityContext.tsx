import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { securityManager, SecurityCheckResult, SecurityConfig, RateLimitConfig } from '@/lib/security/SecurityManager';
import { useToast } from '@/hooks/use-toast';

interface SecurityContextType {
  // Security checks
  checkPermission: (permission: string, operationContext?: Record<string, any>) => Promise<SecurityCheckResult>;
  checkRateLimit: (operationType: string, requestCount?: number) => Promise<SecurityCheckResult>;
  
  // Secure operations
  inviteTeamMemberSecure: (email: string, role: string, customMessage?: string) => Promise<any>;
  executeBulkOperationSecure: (operationType: string, operationData: Record<string, any>) => Promise<any>;
  
  // Security configuration
  securityConfig: SecurityConfig | null;
  rateLimitConfig: RateLimitConfig | null;
  updateSecurityConfig: (config: Partial<SecurityConfig>) => Promise<void>;
  
  // Security dashboard
  securityDashboard: any;
  refreshSecurityDashboard: () => Promise<void>;
  
  // State
  loading: boolean;
  error: string | null;
  
  // Utilities
  clearAuthFailures: (failureType?: string) => Promise<void>;
  isOperationAllowed: (permission: string) => boolean;
  getRateLimitStatus: (operationType: string) => { allowed: boolean; remaining: number; resetTime?: Date };
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

interface SecurityProviderProps {
  children: ReactNode;
}

export function SecurityProvider({ children }: SecurityProviderProps) {
  const { currentTeam } = useTeam();
  const { toast } = useToast();
  
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig | null>(null);
  const [rateLimitConfig, setRateLimitConfig] = useState<RateLimitConfig | null>(null);
  const [securityDashboard, setSecurityDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cache for permission checks and rate limits
  const [permissionCache, setPermissionCache] = useState<Map<string, { result: SecurityCheckResult; expires: number }>>(new Map());
  const [rateLimitCache, setRateLimitCache] = useState<Map<string, { result: SecurityCheckResult; expires: number }>>(new Map());

  // Load security configuration when team changes
  useEffect(() => {
    if (currentTeam?.id) {
      loadSecurityConfiguration();
    } else {
      // Clear state when no team selected
      setSecurityConfig(null);
      setRateLimitConfig(null);
      setSecurityDashboard(null);
      setPermissionCache(new Map());
      setRateLimitCache(new Map());
    }
  }, [currentTeam?.id]);

  const loadSecurityConfiguration = async () => {
    if (!currentTeam?.id) return;

    try {
      setLoading(true);
      setError(null);

      const [secConfig, rateLimitConf, dashboard] = await Promise.all([
        securityManager.getSecurityConfig(currentTeam.id),
        securityManager.getRateLimitConfig(currentTeam.id),
        securityManager.getSecurityDashboard(currentTeam.id).catch(() => null) // Dashboard might fail if no permissions
      ]);

      setSecurityConfig(secConfig);
      setRateLimitConfig(rateLimitConf);
      setSecurityDashboard(dashboard);
    } catch (err: any) {
      console.error('Failed to load security configuration:', err);
      setError(err.message || 'Failed to load security configuration');
    } finally {
      setLoading(false);
    }
  };

  const checkPermission = async (
    permission: string, 
    operationContext: Record<string, any> = {}
  ): Promise<SecurityCheckResult> => {
    if (!currentTeam?.id) {
      return {
        allowed: false,
        error: 'No team selected',
        errorCode: 'NO_TEAM'
      };
    }

    // Check cache first
    const cacheKey = `${currentTeam.id}_${permission}_${JSON.stringify(operationContext)}`;
    const cached = permissionCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.result;
    }

    try {
      const result = await securityManager.checkPermission(currentTeam.id, permission, operationContext);
      
      // Cache successful results for 5 minutes
      if (result.allowed) {
        const newCache = new Map(permissionCache);
        newCache.set(cacheKey, {
          result,
          expires: Date.now() + 5 * 60 * 1000
        });
        setPermissionCache(newCache);
      }

      return result;
    } catch (err: any) {
      console.error('Permission check failed:', err);
      return {
        allowed: false,
        error: err.message || 'Permission check failed',
        errorCode: 'PERMISSION_CHECK_ERROR'
      };
    }
  };

  const checkRateLimit = async (
    operationType: string, 
    requestCount: number = 1
  ): Promise<SecurityCheckResult> => {
    if (!currentTeam?.id) {
      return {
        allowed: false,
        error: 'No team selected',
        errorCode: 'NO_TEAM'
      };
    }

    // Check cache first (shorter cache time for rate limits)
    const cacheKey = `${currentTeam.id}_${operationType}`;
    const cached = rateLimitCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.result;
    }

    try {
      const result = await securityManager.checkRateLimit(currentTeam.id, operationType, requestCount);
      
      // Cache rate limit results for 1 minute
      const newCache = new Map(rateLimitCache);
      newCache.set(cacheKey, {
        result,
        expires: Date.now() + 60 * 1000
      });
      setRateLimitCache(newCache);

      return result;
    } catch (err: any) {
      console.error('Rate limit check failed:', err);
      return {
        allowed: false,
        error: err.message || 'Rate limit check failed',
        errorCode: 'RATE_LIMIT_CHECK_ERROR'
      };
    }
  };

  const inviteTeamMemberSecure = async (
    email: string, 
    role: string, 
    customMessage?: string
  ): Promise<any> => {
    if (!currentTeam?.id) {
      throw new Error('No team selected');
    }

    try {
      const result = await securityManager.inviteTeamMemberSecure(
        currentTeam.id, 
        email, 
        role, 
        customMessage
      );

      // Clear rate limit cache to get fresh data
      const newCache = new Map(rateLimitCache);
      newCache.delete(`${currentTeam.id}_invite_members`);
      setRateLimitCache(newCache);

      // Show success message
      toast({
        title: 'Invitation Sent',
        description: `Invitation sent to ${email}`,
      });

      return result;
    } catch (err: any) {
      // Handle specific security errors
      if (err.message.includes('rate limit')) {
        toast({
          title: 'Rate Limit Exceeded',
          description: 'You have sent too many invitations. Please try again later.',
          variant: 'destructive',
        });
      } else if (err.message.includes('permission')) {
        toast({
          title: 'Permission Denied',
          description: 'You do not have permission to invite members.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Invitation Failed',
          description: err.message || 'Failed to send invitation',
          variant: 'destructive',
        });
      }
      throw err;
    }
  };

  const executeBulkOperationSecure = async (
    operationType: string, 
    operationData: Record<string, any>
  ): Promise<any> => {
    if (!currentTeam?.id) {
      throw new Error('No team selected');
    }

    try {
      const result = await securityManager.executeBulkOperationSecure(
        currentTeam.id, 
        operationType, 
        operationData
      );

      // Clear relevant caches
      const newRateLimitCache = new Map(rateLimitCache);
      newRateLimitCache.delete(`${currentTeam.id}_bulk_operations`);
      setRateLimitCache(newRateLimitCache);

      // Show success message
      toast({
        title: 'Bulk Operation Started',
        description: `${operationType.replace('_', ' ')} operation has been initiated`,
      });

      return result;
    } catch (err: any) {
      // Handle specific security errors
      if (err.message.includes('rate limit')) {
        toast({
          title: 'Rate Limit Exceeded',
          description: 'You have performed too many bulk operations. Please try again later.',
          variant: 'destructive',
        });
      } else if (err.message.includes('permission')) {
        toast({
          title: 'Permission Denied',
          description: 'You do not have permission to perform bulk operations.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Operation Failed',
          description: err.message || 'Failed to execute bulk operation',
          variant: 'destructive',
        });
      }
      throw err;
    }
  };

  const updateSecurityConfig = async (config: Partial<SecurityConfig>): Promise<void> => {
    if (!currentTeam?.id) {
      throw new Error('No team selected');
    }

    try {
      await securityManager.updateSecurityConfig(currentTeam.id, config);
      
      // Refresh configuration
      const updatedConfig = await securityManager.getSecurityConfig(currentTeam.id);
      setSecurityConfig(updatedConfig);

      toast({
        title: 'Security Settings Updated',
        description: 'Team security configuration has been updated successfully',
      });
    } catch (err: any) {
      toast({
        title: 'Update Failed',
        description: err.message || 'Failed to update security configuration',
        variant: 'destructive',
      });
      throw err;
    }
  };

  const refreshSecurityDashboard = async (): Promise<void> => {
    if (!currentTeam?.id) return;

    try {
      const dashboard = await securityManager.getSecurityDashboard(currentTeam.id);
      setSecurityDashboard(dashboard);
    } catch (err: any) {
      console.error('Failed to refresh security dashboard:', err);
      // Don't show error toast for dashboard refresh failures
    }
  };

  const clearAuthFailures = async (failureType?: string): Promise<void> => {
    if (!currentTeam?.id) return;

    try {
      await securityManager.clearAuthFailures(currentTeam.id, failureType);
      
      // Clear permission cache to get fresh data
      setPermissionCache(new Map());
    } catch (err: any) {
      console.error('Failed to clear auth failures:', err);
    }
  };

  const isOperationAllowed = (permission: string): boolean => {
    // Quick check based on cached permission results
    const cacheKey = `${currentTeam?.id}_${permission}_{}`;
    const cached = permissionCache.get(cacheKey);
    return cached?.result.allowed || false;
  };

  const getRateLimitStatus = (operationType: string): { allowed: boolean; remaining: number; resetTime?: Date } => {
    const cacheKey = `${currentTeam?.id}_${operationType}`;
    const cached = rateLimitCache.get(cacheKey);
    
    if (cached?.result.rateLimitInfo) {
      const info = cached.result.rateLimitInfo;
      return {
        allowed: cached.result.allowed,
        remaining: info.remainingRequests,
        resetTime: info.windowEnd ? new Date(info.windowEnd) : undefined
      };
    }

    return { allowed: true, remaining: 100 }; // Default optimistic values
  };

  const value: SecurityContextType = {
    checkPermission,
    checkRateLimit,
    inviteTeamMemberSecure,
    executeBulkOperationSecure,
    securityConfig,
    rateLimitConfig,
    updateSecurityConfig,
    securityDashboard,
    refreshSecurityDashboard,
    loading,
    error,
    clearAuthFailures,
    isOperationAllowed,
    getRateLimitStatus,
  };

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (context === undefined) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
}
