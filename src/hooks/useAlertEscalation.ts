/**
 * Alert Escalation Hook
 * React hook for managing alert escalation and severity routing
 * Task 4: Build Alert Escalation and Severity Management - Frontend Integration
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { alertEscalationManager } from '@/services/alertEscalationManager';
import { alertSeverityRouter } from '@/services/alertSeverityRouter';
import { supabase } from '@/lib/supabase';
import { AlertSeverity } from '@/types/alerting';
import { toast } from 'sonner';

interface EscalationContext {
  alertId: string;
  alert: any;
  severityConfig: any;
  teamAssignment?: any;
  currentLevel: number;
  maxLevel: number;
  escalationHistory: Array<{
    level: number;
    triggeredAt: Date;
    contacts: string[];
    channels: string[];
    success: boolean;
    reason?: string;
  }>;
  nextEscalationAt?: Date;
  isBusinessHours: boolean;
  isWeekend: boolean;
}

interface SeverityRoutingRule {
  id: string;
  team_id: string;
  severity: AlertSeverity;
  assigned_users: string[];
  assigned_channels: string[];
  initial_delay_minutes: number;
  escalation_interval_minutes: number;
  max_escalation_level: number;
  business_hours_only: boolean;
  weekend_escalation: boolean;
  auto_acknowledge_minutes?: number;
  auto_resolve_minutes?: number;
  conditions: Record<string, any>;
  enabled: boolean;
  priority: number;
}

interface OnCallSchedule {
  id: string;
  team_id: string;
  name: string;
  description?: string;
  schedule_type: string;
  rotation_config: Record<string, any>;
  timezone: string;
  effective_from: string;
  effective_until?: string;
  applicable_severities: AlertSeverity[];
  override_business_hours: boolean;
  enabled: boolean;
}

interface AlertAssignment {
  id: string;
  alert_id: string;
  assigned_to: string;
  assigned_by?: string;
  assignment_reason: string;
  assignment_level: number;
  expected_response_time?: number;
  acknowledged_at?: string;
  response_time_minutes?: number;
  created_at: string;
}

interface UseAlertEscalationOptions {
  teamId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseAlertEscalationReturn {
  // Escalation data
  activeEscalations: Map<string, EscalationContext>;
  escalationStatistics: any;
  isLoading: boolean;
  error: string | null;
  
  // Severity routing
  severityRules: SeverityRoutingRule[];
  createSeverityRule: (rule: Omit<SeverityRoutingRule, 'id'>) => Promise<SeverityRoutingRule>;
  updateSeverityRule: (id: string, updates: Partial<SeverityRoutingRule>) => Promise<SeverityRoutingRule>;
  deleteSeverityRule: (id: string) => Promise<void>;
  
  // On-call schedules
  onCallSchedules: OnCallSchedule[];
  createOnCallSchedule: (schedule: Omit<OnCallSchedule, 'id' | 'created_at' | 'updated_at'>) => Promise<OnCallSchedule>;
  updateOnCallSchedule: (id: string, updates: Partial<OnCallSchedule>) => Promise<OnCallSchedule>;
  deleteOnCallSchedule: (id: string) => Promise<void>;
  
  // Alert assignments
  alertAssignments: AlertAssignment[];
  assignAlert: (alertId: string, userId: string, reason?: string) => Promise<void>;
  acknowledgeAssignment: (assignmentId: string) => Promise<void>;
  getUserAssignments: (userId: string, status?: 'active' | 'acknowledged' | 'all') => Promise<AlertAssignment[]>;
  
  // Escalation management
  cancelEscalation: (alertId: string) => void;
  getEscalationStatus: (alertId: string) => EscalationContext | null;
  
  // Statistics and reporting
  getRoutingStatistics: (hours?: number) => Promise<any>;
  
  // Utility functions
  refreshData: () => Promise<void>;
  lastRefresh: Date | null;
}

export function useAlertEscalation(options: UseAlertEscalationOptions = {}): UseAlertEscalationReturn {
  const {
    teamId,
    autoRefresh = false,
    refreshInterval = 30000 // 30 seconds
  } = options;

  // State
  const [activeEscalations, setActiveEscalations] = useState<Map<string, EscalationContext>>(new Map());
  const [escalationStatistics, setEscalationStatistics] = useState<any>(null);
  const [severityRules, setSeverityRules] = useState<SeverityRoutingRule[]>([]);
  const [onCallSchedules, setOnCallSchedules] = useState<OnCallSchedule[]>([]);
  const [alertAssignments, setAlertAssignments] = useState<AlertAssignment[]>([]);
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

  // Refresh all data
  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [
        escalationsData,
        statisticsData,
        rulesData,
        schedulesData,
        assignmentsData
      ] = await Promise.allSettled([
        Promise.resolve(alertEscalationManager.getActiveEscalations()),
        Promise.resolve(alertEscalationManager.getEscalationStatistics()),
        fetchSeverityRules(),
        fetchOnCallSchedules(),
        fetchAlertAssignments()
      ]);

      safeSetState(() => {
        if (escalationsData.status === 'fulfilled') {
          setActiveEscalations(escalationsData.value);
        }
        
        if (statisticsData.status === 'fulfilled') {
          setEscalationStatistics(statisticsData.value);
        }
        
        if (rulesData.status === 'fulfilled') {
          setSeverityRules(rulesData.value);
        }
        
        if (schedulesData.status === 'fulfilled') {
          setOnCallSchedules(schedulesData.value);
        }
        
        if (assignmentsData.status === 'fulfilled') {
          setAlertAssignments(assignmentsData.value);
        }
        
        setLastRefresh(new Date());
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh escalation data';
      safeSetState(() => setError(errorMessage));
      console.error('Error refreshing escalation data:', err);
    } finally {
      safeSetState(() => setIsLoading(false));
    }
  }, [teamId, safeSetState]);

  // Fetch severity routing rules
  const fetchSeverityRules = useCallback(async (): Promise<SeverityRoutingRule[]> => {
    let query = supabase.from('alert_severity_routing').select('*');
    
    if (teamId) {
      query = query.eq('team_id', teamId);
    }

    const { data, error } = await query.order('priority', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch severity rules: ${error.message}`);
    }

    return data || [];
  }, [teamId]);

  // Fetch on-call schedules
  const fetchOnCallSchedules = useCallback(async (): Promise<OnCallSchedule[]> => {
    let query = supabase.from('on_call_schedules').select('*');
    
    if (teamId) {
      query = query.eq('team_id', teamId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch on-call schedules: ${error.message}`);
    }

    return data || [];
  }, [teamId]);

  // Fetch alert assignments
  const fetchAlertAssignments = useCallback(async (): Promise<AlertAssignment[]> => {
    const { data, error } = await supabase
      .from('alert_assignments')
      .select(`
        *,
        alerts!inner (team_id)
      `)
      .eq(teamId ? 'alerts.team_id' : 'id', teamId || 'dummy')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error && teamId) {
      throw new Error(`Failed to fetch alert assignments: ${error.message}`);
    }

    return data || [];
  }, [teamId]);

  // Create severity routing rule
  const createSeverityRule = useCallback(async (
    rule: Omit<SeverityRoutingRule, 'id'>
  ): Promise<SeverityRoutingRule> => {
    try {
      setError(null);
      const newRule = await alertSeverityRouter.createSeverityRoutingRule(rule);
      
      safeSetState(() => {
        setSeverityRules(prev => [newRule, ...prev]);
      });
      
      toast.success('Severity routing rule created successfully');
      return newRule;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create severity rule';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [safeSetState]);

  // Update severity routing rule
  const updateSeverityRule = useCallback(async (
    id: string, 
    updates: Partial<SeverityRoutingRule>
  ): Promise<SeverityRoutingRule> => {
    try {
      setError(null);
      const updatedRule = await alertSeverityRouter.updateSeverityRoutingRule(id, updates);
      
      safeSetState(() => {
        setSeverityRules(prev => prev.map(rule => 
          rule.id === id ? updatedRule : rule
        ));
      });
      
      toast.success('Severity routing rule updated successfully');
      return updatedRule;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update severity rule';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [safeSetState]);

  // Delete severity routing rule
  const deleteSeverityRule = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      
      const { error } = await supabase
        .from('alert_severity_routing')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete severity rule: ${error.message}`);
      }
      
      safeSetState(() => {
        setSeverityRules(prev => prev.filter(rule => rule.id !== id));
      });
      
      toast.success('Severity routing rule deleted successfully');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete severity rule';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [safeSetState]);

  // Create on-call schedule
  const createOnCallSchedule = useCallback(async (
    schedule: Omit<OnCallSchedule, 'id' | 'created_at' | 'updated_at'>
  ): Promise<OnCallSchedule> => {
    try {
      setError(null);
      
      const { data, error } = await supabase
        .from('on_call_schedules')
        .insert(schedule)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create on-call schedule: ${error.message}`);
      }
      
      safeSetState(() => {
        setOnCallSchedules(prev => [data, ...prev]);
      });
      
      toast.success('On-call schedule created successfully');
      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create on-call schedule';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [safeSetState]);

  // Update on-call schedule
  const updateOnCallSchedule = useCallback(async (
    id: string, 
    updates: Partial<OnCallSchedule>
  ): Promise<OnCallSchedule> => {
    try {
      setError(null);
      
      const { data, error } = await supabase
        .from('on_call_schedules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update on-call schedule: ${error.message}`);
      }
      
      safeSetState(() => {
        setOnCallSchedules(prev => prev.map(schedule => 
          schedule.id === id ? data : schedule
        ));
      });
      
      toast.success('On-call schedule updated successfully');
      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update on-call schedule';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [safeSetState]);

  // Delete on-call schedule
  const deleteOnCallSchedule = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      
      const { error } = await supabase
        .from('on_call_schedules')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete on-call schedule: ${error.message}`);
      }
      
      safeSetState(() => {
        setOnCallSchedules(prev => prev.filter(schedule => schedule.id !== id));
      });
      
      toast.success('On-call schedule deleted successfully');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete on-call schedule';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [safeSetState]);

  // Assign alert to user
  const assignAlert = useCallback(async (
    alertId: string, 
    userId: string, 
    reason: string = 'manual'
  ): Promise<void> => {
    try {
      setError(null);
      
      const { error } = await supabase.rpc('assign_alert_to_user', {
        _alert_id: alertId,
        _assigned_to: userId,
        _assignment_reason: reason
      });

      if (error) {
        throw new Error(`Failed to assign alert: ${error.message}`);
      }
      
      toast.success('Alert assigned successfully');
      await refreshData();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign alert';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [refreshData]);

  // Acknowledge assignment
  const acknowledgeAssignment = useCallback(async (assignmentId: string): Promise<void> => {
    try {
      setError(null);
      
      const { error } = await supabase
        .from('alert_assignments')
        .update({
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', assignmentId);

      if (error) {
        throw new Error(`Failed to acknowledge assignment: ${error.message}`);
      }
      
      toast.success('Assignment acknowledged');
      await refreshData();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to acknowledge assignment';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [refreshData]);

  // Get user assignments
  const getUserAssignments = useCallback(async (
    userId: string, 
    status: 'active' | 'acknowledged' | 'all' = 'active'
  ): Promise<AlertAssignment[]> => {
    try {
      return await alertSeverityRouter.getUserAlertAssignments(userId, status);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user assignments';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Cancel escalation
  const cancelEscalation = useCallback((alertId: string): void => {
    alertEscalationManager.cancelEscalation(alertId);
    safeSetState(() => {
      setActiveEscalations(prev => {
        const newMap = new Map(prev);
        newMap.delete(alertId);
        return newMap;
      });
    });
  }, [safeSetState]);

  // Get escalation status
  const getEscalationStatus = useCallback((alertId: string): EscalationContext | null => {
    return alertEscalationManager.getEscalationStatus(alertId);
  }, []);

  // Get routing statistics
  const getRoutingStatistics = useCallback(async (hours: number = 24): Promise<any> => {
    try {
      return await alertSeverityRouter.getRoutingStatistics(teamId, hours);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch routing statistics';
      setError(errorMessage);
      throw err;
    }
  }, [teamId]);

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
    // Escalation data
    activeEscalations,
    escalationStatistics,
    isLoading,
    error,
    
    // Severity routing
    severityRules,
    createSeverityRule,
    updateSeverityRule,
    deleteSeverityRule,
    
    // On-call schedules
    onCallSchedules,
    createOnCallSchedule,
    updateOnCallSchedule,
    deleteOnCallSchedule,
    
    // Alert assignments
    alertAssignments,
    assignAlert,
    acknowledgeAssignment,
    getUserAssignments,
    
    // Escalation management
    cancelEscalation,
    getEscalationStatus,
    
    // Statistics and reporting
    getRoutingStatistics,
    
    // Utility functions
    refreshData,
    lastRefresh
  };
}
