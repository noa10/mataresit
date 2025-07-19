/**
 * Health Monitoring Hook
 * React hook for managing system health monitoring and alerts
 * Phase 1: Embedding Success Rate Monitoring Dashboard - Task 4
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  embeddingHealthService, 
  SystemHealthStatus, 
  AggregationStatus, 
  PerformanceMetrics,
  HealthCheckResult
} from '@/services/embeddingHealthService';
import { SystemAlert } from '@/components/admin/SystemAlertsPanel';
import { toast } from 'sonner';

interface UseHealthMonitoringOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableAlerts?: boolean;
  alertThresholds?: {
    healthScore?: number;
    responseTime?: number;
    errorRate?: number;
  };
}

interface UseHealthMonitoringReturn {
  // Health data
  healthStatus: SystemHealthStatus | null;
  aggregationStatus: AggregationStatus | null;
  performanceMetrics: PerformanceMetrics | null;
  
  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  
  // Error states
  error: string | null;
  
  // Alerts
  alerts: SystemAlert[];
  unacknowledgedAlerts: number;
  criticalAlerts: number;
  
  // Actions
  refreshHealth: () => Promise<void>;
  acknowledgeAlert: (alertId: string) => void;
  resolveAlert: (alertId: string) => void;
  dismissAlert: (alertId: string) => void;
  clearResolvedAlerts: () => void;
  
  // Settings
  autoRefresh: boolean;
  setAutoRefresh: (enabled: boolean) => void;
  refreshInterval: number;
  setRefreshInterval: (interval: number) => void;
  enableAlerts: boolean;
  setEnableAlerts: (enabled: boolean) => void;
  
  // Status
  lastRefresh: Date | null;
  isHealthy: boolean;
}

export function useHealthMonitoring(options: UseHealthMonitoringOptions = {}): UseHealthMonitoringReturn {
  const {
    autoRefresh: initialAutoRefresh = true,
    refreshInterval: initialRefreshInterval = 30000, // 30 seconds
    enableAlerts: initialEnableAlerts = true,
    alertThresholds = {
      healthScore: 70,
      responseTime: 5000,
      errorRate: 10
    }
  } = options;

  // State
  const [healthStatus, setHealthStatus] = useState<SystemHealthStatus | null>(null);
  const [aggregationStatus, setAggregationStatus] = useState<AggregationStatus | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Settings
  const [autoRefresh, setAutoRefresh] = useState(initialAutoRefresh);
  const [refreshInterval, setRefreshInterval] = useState(initialRefreshInterval);
  const [enableAlerts, setEnableAlerts] = useState(initialEnableAlerts);

  // Refs
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const alertIdCounter = useRef(0);

  // Safe state update helper
  const safeSetState = useCallback((setter: () => void) => {
    if (mountedRef.current) {
      setter();
    }
  }, []);

  // Generate alert ID
  const generateAlertId = useCallback(() => {
    return `alert_${Date.now()}_${++alertIdCounter.current}`;
  }, []);

  // Convert health check result to alert
  const healthCheckToAlert = useCallback((component: HealthCheckResult): SystemAlert | null => {
    if (component.status === 'healthy') return null;

    const alertType = component.status === 'critical' ? 'critical' : 
                     component.status === 'warning' ? 'warning' : 'info';

    return {
      id: generateAlertId(),
      type: alertType,
      title: `${component.component.replace('_', ' ').toUpperCase()} Issue`,
      message: component.message,
      component: component.component,
      timestamp: component.timestamp,
      acknowledged: false,
      resolved: false,
      details: component.details
    };
  }, [generateAlertId]);

  // Process health status and generate alerts
  const processHealthStatus = useCallback((health: SystemHealthStatus) => {
    if (!enableAlerts) return;

    const newAlerts: SystemAlert[] = [];

    // Check overall health score
    if (health.healthScore < alertThresholds.healthScore!) {
      newAlerts.push({
        id: generateAlertId(),
        type: health.healthScore < 50 ? 'critical' : 'warning',
        title: 'Low Health Score',
        message: `System health score is ${health.healthScore}/100`,
        component: 'system',
        timestamp: new Date().toISOString(),
        acknowledged: false,
        resolved: false,
        details: { healthScore: health.healthScore, threshold: alertThresholds.healthScore }
      });
    }

    // Process component alerts
    health.components.forEach(component => {
      const alert = healthCheckToAlert(component);
      if (alert) {
        newAlerts.push(alert);
      }
    });

    // Add new alerts (avoid duplicates)
    safeSetState(() => {
      setAlerts(prev => {
        const existingAlertKeys = new Set(
          prev.map(alert => `${alert.component}_${alert.type}_${alert.title}`)
        );
        
        const uniqueNewAlerts = newAlerts.filter(alert => 
          !existingAlertKeys.has(`${alert.component}_${alert.type}_${alert.title}`)
        );

        if (uniqueNewAlerts.length > 0) {
          // Show toast for critical alerts
          uniqueNewAlerts.forEach(alert => {
            if (alert.type === 'critical') {
              toast.error(`Critical: ${alert.title}`, {
                description: alert.message,
                duration: 10000
              });
            } else if (alert.type === 'warning') {
              toast.warning(`Warning: ${alert.title}`, {
                description: alert.message,
                duration: 5000
              });
            }
          });
        }

        return [...prev, ...uniqueNewAlerts];
      });
    });
  }, [enableAlerts, alertThresholds, healthCheckToAlert, generateAlertId, safeSetState]);

  // Refresh health data
  const refreshHealth = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setError(null);

      const [health, aggregation, performance] = await Promise.all([
        embeddingHealthService.performHealthCheck(),
        embeddingHealthService.getAggregationStatus(),
        embeddingHealthService.getPerformanceMetrics()
      ]);

      safeSetState(() => {
        setHealthStatus(health);
        setAggregationStatus(aggregation);
        setPerformanceMetrics(performance);
        setLastRefresh(new Date());
      });

      // Process alerts
      processHealthStatus(health);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Health monitoring error:', err);
      
      safeSetState(() => {
        setError(errorMessage);
      });

      if (enableAlerts) {
        toast.error('Health Check Failed', {
          description: errorMessage,
          duration: 5000
        });
      }
    } finally {
      safeSetState(() => {
        setIsLoading(false);
        setIsRefreshing(false);
      });
    }
  }, [safeSetState, processHealthStatus, enableAlerts]);

  // Alert management functions
  const acknowledgeAlert = useCallback((alertId: string) => {
    safeSetState(() => {
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      ));
    });
  }, [safeSetState]);

  const resolveAlert = useCallback((alertId: string) => {
    safeSetState(() => {
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, resolved: true, acknowledged: true } : alert
      ));
    });
  }, [safeSetState]);

  const dismissAlert = useCallback((alertId: string) => {
    safeSetState(() => {
      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    });
  }, [safeSetState]);

  const clearResolvedAlerts = useCallback(() => {
    safeSetState(() => {
      setAlerts(prev => prev.filter(alert => !alert.resolved));
    });
  }, [safeSetState]);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(refreshHealth, refreshInterval);
    } else if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, refreshHealth]);

  // Initial load
  useEffect(() => {
    refreshHealth();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // Calculate derived values
  const unacknowledgedAlerts = alerts.filter(alert => !alert.acknowledged && !alert.resolved).length;
  const criticalAlerts = alerts.filter(alert => alert.type === 'critical' && !alert.resolved).length;
  const isHealthy = healthStatus ? 
    healthStatus.overallStatus === 'healthy' && criticalAlerts === 0 : 
    false;

  return {
    // Health data
    healthStatus,
    aggregationStatus,
    performanceMetrics,
    
    // Loading states
    isLoading,
    isRefreshing,
    
    // Error states
    error,
    
    // Alerts
    alerts,
    unacknowledgedAlerts,
    criticalAlerts,
    
    // Actions
    refreshHealth,
    acknowledgeAlert,
    resolveAlert,
    dismissAlert,
    clearResolvedAlerts,
    
    // Settings
    autoRefresh,
    setAutoRefresh,
    refreshInterval,
    setRefreshInterval,
    enableAlerts,
    setEnableAlerts,
    
    // Status
    lastRefresh,
    isHealthy
  };
}
