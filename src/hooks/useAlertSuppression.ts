/**
 * Alert Suppression Hook
 * React hook for managing alert suppression, rate limiting, and maintenance windows
 * Task 6: Implement Alert Suppression and Rate Limiting - Frontend Integration
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { alertSuppressionManager } from '@/services/alertSuppressionManager';
import { alertRateLimiter } from '@/services/alertRateLimiter';
import { maintenanceWindowManager } from '@/services/maintenanceWindowManager';
import { supabase } from '@/lib/supabase';
import { AlertSeverity } from '@/types/alerting';
import { toast } from 'sonner';

interface SuppressionRule {
  id: string;
  name: string;
  description?: string;
  rule_type: 'duplicate' | 'rate_limit' | 'maintenance' | 'grouping' | 'threshold' | 'custom';
  conditions: Record<string, any>;
  suppression_duration_minutes: number;
  max_alerts_per_window: number;
  window_size_minutes: number;
  enabled: boolean;
  priority: number;
  team_id?: string;
  created_at: string;
  updated_at: string;
}

interface MaintenanceWindow {
  id: string;
  name: string;
  description?: string;
  start_time: string;
  end_time: string;
  timezone: string;
  affected_systems: string[];
  affected_severities: AlertSeverity[];
  suppress_all: boolean;
  notify_before_minutes: number;
  notify_after_completion: boolean;
  enabled: boolean;
  recurring: boolean;
  recurrence_config: Record<string, any>;
  team_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface SuppressionStatistics {
  totalSuppressions: number;
  suppressionsByReason: Record<string, number>;
  rateLimitHits: number;
  maintenanceSuppressions: number;
  duplicateSuppressions: number;
  customRuleSuppressions: number;
  averageSuppressionDuration: number;
}

interface RateLimitStatistics {
  totalLimits: number;
  activeLimits: number;
  adaptiveLimits: number;
  recentHits: number;
}

interface MaintenanceStatus {
  isActive: boolean;
  activeWindows: MaintenanceWindow[];
  upcomingWindows: MaintenanceWindow[];
  affectedSystems: string[];
  suppressionLevel: 'none' | 'partial' | 'full';
}

interface UseAlertSuppressionOptions {
  teamId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseAlertSuppressionReturn {
  // Suppression rules
  suppressionRules: SuppressionRule[];
  createSuppressionRule: (rule: Omit<SuppressionRule, 'id' | 'created_at' | 'updated_at'>) => Promise<SuppressionRule>;
  updateSuppressionRule: (id: string, updates: Partial<SuppressionRule>) => Promise<SuppressionRule>;
  deleteSuppressionRule: (id: string) => Promise<void>;
  
  // Maintenance windows
  maintenanceWindows: MaintenanceWindow[];
  maintenanceStatus: MaintenanceStatus;
  createMaintenanceWindow: (window: Omit<MaintenanceWindow, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => Promise<MaintenanceWindow>;
  updateMaintenanceWindow: (id: string, updates: Partial<MaintenanceWindow>) => Promise<MaintenanceWindow>;
  deleteMaintenanceWindow: (id: string) => Promise<void>;
  
  // Statistics
  suppressionStatistics: SuppressionStatistics | null;
  rateLimitStatistics: RateLimitStatistics | null;
  
  // Utility functions
  checkSuppression: (metricName: string, severity: AlertSeverity, teamId?: string) => boolean;
  refreshData: () => Promise<void>;
  
  // State
  isLoading: boolean;
  error: string | null;
  lastRefresh: Date | null;
}

export function useAlertSuppression(options: UseAlertSuppressionOptions = {}): UseAlertSuppressionReturn {
  const {
    teamId,
    autoRefresh = false,
    refreshInterval = 30000 // 30 seconds
  } = options;

  // State
  const [suppressionRules, setSuppressionRules] = useState<SuppressionRule[]>([]);
  const [maintenanceWindows, setMaintenanceWindows] = useState<MaintenanceWindow[]>([]);
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus>({
    isActive: false,
    activeWindows: [],
    upcomingWindows: [],
    affectedSystems: [],
    suppressionLevel: 'none'
  });
  const [suppressionStatistics, setSuppressionStatistics] = useState<SuppressionStatistics | null>(null);
  const [rateLimitStatistics, setRateLimitStatistics] = useState<RateLimitStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Refs
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Safe state setter
  const safeSetState = useCallback((updateFn: () => void) => {
    if (isMountedRef.current) {
      updateFn();
    }
  }, []);

  // Fetch suppression rules
  const fetchSuppressionRules = useCallback(async (): Promise<SuppressionRule[]> => {
    let query = supabase.from('alert_suppression_rules').select('*');
    
    if (teamId) {
      query = query.eq('team_id', teamId);
    }

    const { data, error } = await query.order('priority', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch suppression rules: ${error.message}`);
    }

    return data || [];
  }, [teamId]);

  // Fetch maintenance windows
  const fetchMaintenanceWindows = useCallback(async (): Promise<MaintenanceWindow[]> => {
    const windows = await maintenanceWindowManager.getMaintenanceWindows(teamId);
    return windows;
  }, [teamId]);

  // Fetch statistics
  const fetchStatistics = useCallback(async (): Promise<{
    suppressionStats: SuppressionStatistics;
    rateLimitStats: RateLimitStatistics;
  }> => {
    // Get suppression statistics
    const { data: suppressionLogs } = await supabase
      .from('alert_suppression_log')
      .select('reason, suppressed, created_at, metadata')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const suppressionsByReason: Record<string, number> = {};
    let totalSuppressions = 0;
    let totalDuration = 0;
    let durationCount = 0;

    suppressionLogs?.forEach(log => {
      if (log.suppressed) {
        totalSuppressions++;
        suppressionsByReason[log.reason] = (suppressionsByReason[log.reason] || 0) + 1;
        
        if (log.metadata?.suppressionMinutes) {
          totalDuration += log.metadata.suppressionMinutes;
          durationCount++;
        }
      }
    });

    const suppressionStats: SuppressionStatistics = {
      totalSuppressions,
      suppressionsByReason,
      rateLimitHits: suppressionsByReason['rate_limit_exceeded'] || 0,
      maintenanceSuppressions: suppressionsByReason['maintenance_window'] || 0,
      duplicateSuppressions: suppressionsByReason['duplicate_alert'] || 0,
      customRuleSuppressions: suppressionsByReason['custom_rule_matched'] || 0,
      averageSuppressionDuration: durationCount > 0 ? totalDuration / durationCount : 0
    };

    // Get rate limit statistics
    const rateLimitStats = alertRateLimiter.getRateLimitingStatistics();

    return { suppressionStats, rateLimitStats };
  }, []);

  // Refresh all data
  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [
        rulesData,
        windowsData,
        statusData,
        statisticsData
      ] = await Promise.allSettled([
        fetchSuppressionRules(),
        fetchMaintenanceWindows(),
        Promise.resolve(maintenanceWindowManager.getMaintenanceStatus(teamId)),
        fetchStatistics()
      ]);

      safeSetState(() => {
        if (rulesData.status === 'fulfilled') {
          setSuppressionRules(rulesData.value);
        }
        
        if (windowsData.status === 'fulfilled') {
          setMaintenanceWindows(windowsData.value);
        }
        
        if (statusData.status === 'fulfilled') {
          setMaintenanceStatus(statusData.value);
        }
        
        if (statisticsData.status === 'fulfilled') {
          setSuppressionStatistics(statisticsData.value.suppressionStats);
          setRateLimitStatistics(statisticsData.value.rateLimitStats);
        }
        
        setLastRefresh(new Date());
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh suppression data';
      safeSetState(() => setError(errorMessage));
      console.error('Error refreshing suppression data:', err);
    } finally {
      safeSetState(() => setIsLoading(false));
    }
  }, [teamId, fetchSuppressionRules, fetchMaintenanceWindows, fetchStatistics, safeSetState]);

  // Create suppression rule
  const createSuppressionRule = useCallback(async (
    rule: Omit<SuppressionRule, 'id' | 'created_at' | 'updated_at'>
  ): Promise<SuppressionRule> => {
    try {
      setError(null);
      
      const { data, error } = await supabase
        .from('alert_suppression_rules')
        .insert(rule)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create suppression rule: ${error.message}`);
      }
      
      safeSetState(() => {
        setSuppressionRules(prev => [data, ...prev]);
      });
      
      toast.success('Suppression rule created successfully');
      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create suppression rule';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [safeSetState]);

  // Update suppression rule
  const updateSuppressionRule = useCallback(async (
    id: string, 
    updates: Partial<SuppressionRule>
  ): Promise<SuppressionRule> => {
    try {
      setError(null);
      
      const { data, error } = await supabase
        .from('alert_suppression_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update suppression rule: ${error.message}`);
      }
      
      safeSetState(() => {
        setSuppressionRules(prev => prev.map(rule => 
          rule.id === id ? data : rule
        ));
      });
      
      toast.success('Suppression rule updated successfully');
      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update suppression rule';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [safeSetState]);

  // Delete suppression rule
  const deleteSuppressionRule = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      
      const { error } = await supabase
        .from('alert_suppression_rules')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete suppression rule: ${error.message}`);
      }
      
      safeSetState(() => {
        setSuppressionRules(prev => prev.filter(rule => rule.id !== id));
      });
      
      toast.success('Suppression rule deleted successfully');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete suppression rule';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [safeSetState]);

  // Create maintenance window
  const createMaintenanceWindow = useCallback(async (
    window: Omit<MaintenanceWindow, 'id' | 'created_by' | 'created_at' | 'updated_at'>
  ): Promise<MaintenanceWindow> => {
    try {
      setError(null);
      
      const newWindow = await maintenanceWindowManager.createMaintenanceWindow(window);
      
      safeSetState(() => {
        setMaintenanceWindows(prev => [newWindow, ...prev]);
      });
      
      toast.success('Maintenance window created successfully');
      return newWindow;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create maintenance window';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [safeSetState]);

  // Update maintenance window
  const updateMaintenanceWindow = useCallback(async (
    id: string, 
    updates: Partial<MaintenanceWindow>
  ): Promise<MaintenanceWindow> => {
    try {
      setError(null);
      
      const updatedWindow = await maintenanceWindowManager.updateMaintenanceWindow(id, updates);
      
      safeSetState(() => {
        setMaintenanceWindows(prev => prev.map(window => 
          window.id === id ? updatedWindow : window
        ));
      });
      
      toast.success('Maintenance window updated successfully');
      return updatedWindow;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update maintenance window';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [safeSetState]);

  // Delete maintenance window
  const deleteMaintenanceWindow = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      
      await maintenanceWindowManager.deleteMaintenanceWindow(id);
      
      safeSetState(() => {
        setMaintenanceWindows(prev => prev.filter(window => window.id !== id));
      });
      
      toast.success('Maintenance window deleted successfully');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete maintenance window';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [safeSetState]);

  // Check if alert should be suppressed
  const checkSuppression = useCallback((
    metricName: string, 
    severity: AlertSeverity, 
    teamId?: string
  ): boolean => {
    const maintenanceResult = maintenanceWindowManager.checkMaintenanceSuppression(
      metricName, 
      severity, 
      teamId
    );
    
    return maintenanceResult.shouldSuppress;
  }, []);

  // Set up auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(refreshData, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, refreshData]);

  // Initial data load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  return {
    // Suppression rules
    suppressionRules,
    createSuppressionRule,
    updateSuppressionRule,
    deleteSuppressionRule,
    
    // Maintenance windows
    maintenanceWindows,
    maintenanceStatus,
    createMaintenanceWindow,
    updateMaintenanceWindow,
    deleteMaintenanceWindow,
    
    // Statistics
    suppressionStatistics,
    rateLimitStatistics,
    
    // Utility functions
    checkSuppression,
    refreshData,
    
    // State
    isLoading,
    error,
    lastRefresh
  };
}
