/**
 * Alert Engine Hook
 * React hook for managing the real-time alert trigger engine
 * Task 2: Implement Real-time Alert Trigger Engine - Frontend Integration
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { alertEngineManager } from '@/services/alertEngineManager';
import { alertingService } from '@/services/alertingService';
import { Alert, AlertStatistics, AlertFilters } from '@/types/alerting';
import { toast } from 'sonner';

interface AlertEngineStatus {
  isRunning: boolean;
  startTime: Date | null;
  uptime: number;
  components: {
    metricsCollector: {
      isRunning: boolean;
      lastCollection: Date;
      totalSnapshots: number;
      errors: number;
    };
    alertEngine: {
      isRunning: boolean;
      lastEvaluation: Date;
      rulesEvaluated: number;
      alertsTriggered: number;
      errors: number;
    };
  };
  lastHealthCheck: Date | null;
  overallHealth: 'healthy' | 'degraded' | 'critical';
}

interface RecentActivity {
  totalAlerts: number;
  alertsBySeverity: Record<string, number>;
  alertsByStatus: Record<string, number>;
  topTriggeredRules: Array<{ ruleName: string; count: number }>;
}

interface UseAlertEngineOptions {
  autoStart?: boolean;
  refreshInterval?: number;
  enableRealTimeUpdates?: boolean;
  teamId?: string;
}

interface UseAlertEngineReturn {
  // Engine status
  status: AlertEngineStatus | null;
  isLoading: boolean;
  error: string | null;
  
  // Engine controls
  startEngine: () => Promise<void>;
  stopEngine: () => Promise<void>;
  restartEngine: () => Promise<void>;
  forceEvaluation: () => Promise<void>;
  
  // Alert data
  alerts: Alert[];
  alertStatistics: AlertStatistics | null;
  recentActivity: RecentActivity | null;
  
  // Alert management
  refreshAlerts: () => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  resolveAlert: (alertId: string) => Promise<void>;
  suppressAlert: (alertId: string, suppressUntil: Date) => Promise<void>;
  
  // Filters
  filters: AlertFilters;
  setFilters: (filters: AlertFilters) => void;
  
  // Settings
  autoRefresh: boolean;
  setAutoRefresh: (enabled: boolean) => void;
  refreshInterval: number;
  setRefreshInterval: (interval: number) => void;
  
  // Status indicators
  isEngineHealthy: boolean;
  lastRefresh: Date | null;
}

export function useAlertEngine(options: UseAlertEngineOptions = {}): UseAlertEngineReturn {
  const {
    autoStart = false,
    refreshInterval: initialRefreshInterval = 30000, // 30 seconds
    enableRealTimeUpdates = true,
    teamId
  } = options;

  // State
  const [status, setStatus] = useState<AlertEngineStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertStatistics, setAlertStatistics] = useState<AlertStatistics | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity | null>(null);
  const [filters, setFilters] = useState<AlertFilters>({ team_id: teamId });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(initialRefreshInterval);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Refs
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Safe state setter that checks if component is still mounted
  const safeSetState = useCallback((updateFn: () => void) => {
    if (isMountedRef.current) {
      updateFn();
    }
  }, []);

  // Start the alert engine
  const startEngine = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await alertEngineManager.start();
      toast.success('Alert engine started successfully');
      
      // Refresh status after starting
      await refreshStatus();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start alert engine';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Stop the alert engine
  const stopEngine = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await alertEngineManager.stop();
      toast.success('Alert engine stopped');
      
      // Refresh status after stopping
      await refreshStatus();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop alert engine';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Restart the alert engine
  const restartEngine = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await alertEngineManager.restart();
      toast.success('Alert engine restarted');
      
      // Refresh status after restarting
      await refreshStatus();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to restart alert engine';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Force evaluation of all alert rules
  const forceEvaluation = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await alertEngineManager.forceEvaluation();
      toast.success('Alert evaluation completed');
      
      // Refresh data after evaluation
      await Promise.all([refreshStatus(), refreshAlerts()]);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to force evaluation';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh engine status
  const refreshStatus = useCallback(async () => {
    try {
      const engineStatus = await alertEngineManager.getStatus();
      safeSetState(() => {
        setStatus(engineStatus);
        setLastRefresh(new Date());
      });
    } catch (err) {
      console.error('Error refreshing engine status:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh status';
      safeSetState(() => setError(errorMessage));
    }
  }, [safeSetState]);

  // Refresh alerts data
  const refreshAlerts = useCallback(async () => {
    try {
      const [alertsData, statsData, activityData] = await Promise.all([
        alertingService.getAlerts(filters),
        alertingService.getAlertStatistics(teamId),
        alertEngineManager.getRecentActivity(24)
      ]);

      safeSetState(() => {
        setAlerts(alertsData);
        setAlertStatistics(statsData);
        setRecentActivity(activityData);
        setLastRefresh(new Date());
      });

    } catch (err) {
      console.error('Error refreshing alerts:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh alerts';
      safeSetState(() => setError(errorMessage));
    }
  }, [filters, teamId, safeSetState]);

  // Acknowledge an alert
  const acknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      await alertingService.acknowledgeAlert(alertId);
      toast.success('Alert acknowledged');
      await refreshAlerts();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to acknowledge alert';
      toast.error(errorMessage);
    }
  }, [refreshAlerts]);

  // Resolve an alert
  const resolveAlert = useCallback(async (alertId: string) => {
    try {
      await alertingService.resolveAlert(alertId);
      toast.success('Alert resolved');
      await refreshAlerts();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resolve alert';
      toast.error(errorMessage);
    }
  }, [refreshAlerts]);

  // Suppress an alert
  const suppressAlert = useCallback(async (alertId: string, suppressUntil: Date) => {
    try {
      await alertingService.suppressAlert(alertId, suppressUntil);
      toast.success('Alert suppressed');
      await refreshAlerts();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to suppress alert';
      toast.error(errorMessage);
    }
  }, [refreshAlerts]);

  // Set up auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        refreshStatus();
        refreshAlerts();
      }, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, refreshStatus, refreshAlerts]);

  // Initial data load
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([refreshStatus(), refreshAlerts()]);
        
        // Auto-start engine if requested
        if (autoStart && status && !status.isRunning) {
          await startEngine();
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []); // Only run on mount

  // Update filters when teamId changes
  useEffect(() => {
    setFilters(prev => ({ ...prev, team_id: teamId }));
  }, [teamId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // Derived state
  const isEngineHealthy = status?.overallHealth === 'healthy' && status?.isRunning;

  return {
    // Engine status
    status,
    isLoading,
    error,
    
    // Engine controls
    startEngine,
    stopEngine,
    restartEngine,
    forceEvaluation,
    
    // Alert data
    alerts,
    alertStatistics,
    recentActivity,
    
    // Alert management
    refreshAlerts,
    acknowledgeAlert,
    resolveAlert,
    suppressAlert,
    
    // Filters
    filters,
    setFilters,
    
    // Settings
    autoRefresh,
    setAutoRefresh,
    refreshInterval,
    setRefreshInterval,
    
    // Status indicators
    isEngineHealthy,
    lastRefresh
  };
}
