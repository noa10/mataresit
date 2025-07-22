/**
 * Real-time Rate Limit Monitoring Hook
 * Phase 3: Batch Upload Optimization - Priority 3.2.1
 * 
 * Provides real-time monitoring of rate limiting status with:
 * - Automatic status updates and event tracking
 * - Performance metrics collection
 * - Alert generation for rate limit issues
 * - Integration with rate limiting manager
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { 
  RateLimitStatus, 
  AdaptiveMetrics, 
  RateLimitEvent,
  ProcessingStrategy,
  EnhancedRateLimitStatus
} from '@/lib/rate-limiting';
import { RateLimitingManager } from '@/lib/rate-limiting';

interface RateLimitMonitoringConfig {
  updateInterval?: number; // milliseconds
  enableEventTracking?: boolean;
  maxEventHistory?: number;
  enableAlerts?: boolean;
  alertThresholds?: {
    requestsRemainingWarning: number;
    tokensRemainingWarning: number;
    consecutiveErrorsAlert: number;
    backoffTimeAlert: number; // milliseconds
  };
}

interface RateLimitAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: Date;
  status: RateLimitStatus;
  autoResolve?: boolean;
}

interface UseRateLimitMonitoringReturn {
  // Current status
  status: EnhancedRateLimitStatus | null;
  metrics: AdaptiveMetrics | null;
  events: RateLimitEvent[];
  alerts: RateLimitAlert[];
  
  // State flags
  isMonitoring: boolean;
  isConnected: boolean;
  lastUpdated: Date | null;
  
  // Control functions
  startMonitoring: () => void;
  stopMonitoring: () => void;
  refreshStatus: () => Promise<void>;
  clearEvents: () => void;
  dismissAlert: (alertId: string) => void;
  clearAlerts: () => void;
  
  // Configuration
  updateConfig: (config: Partial<RateLimitMonitoringConfig>) => void;
}

const DEFAULT_CONFIG: RateLimitMonitoringConfig = {
  updateInterval: 5000, // 5 seconds
  enableEventTracking: true,
  maxEventHistory: 50,
  enableAlerts: true,
  alertThresholds: {
    requestsRemainingWarning: 10,
    tokensRemainingWarning: 10000,
    consecutiveErrorsAlert: 3,
    backoffTimeAlert: 30000 // 30 seconds
  }
};

export function useRateLimitMonitoring(
  rateLimitingManager: RateLimitingManager | null,
  initialConfig: Partial<RateLimitMonitoringConfig> = {}
): UseRateLimitMonitoringReturn {
  const [config, setConfig] = useState<RateLimitMonitoringConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig
  });
  
  const [status, setStatus] = useState<EnhancedRateLimitStatus | null>(null);
  const [metrics, setMetrics] = useState<AdaptiveMetrics | null>(null);
  const [events, setEvents] = useState<RateLimitEvent[]>([]);
  const [alerts, setAlerts] = useState<RateLimitAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventListenerRef = useRef<((event: RateLimitEvent) => void) | null>(null);

  // Generate alert ID
  const generateAlertId = () => `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Check for alert conditions
  const checkAlertConditions = useCallback((currentStatus: RateLimitStatus) => {
    if (!config.enableAlerts) return;

    const newAlerts: RateLimitAlert[] = [];
    const thresholds = config.alertThresholds!;

    // Check requests remaining warning
    if (currentStatus.requestsRemaining <= thresholds.requestsRemainingWarning) {
      newAlerts.push({
        id: generateAlertId(),
        type: 'warning',
        message: `Low API requests remaining: ${currentStatus.requestsRemaining}`,
        timestamp: new Date(),
        status: currentStatus,
        autoResolve: true
      });
    }

    // Check tokens remaining warning
    if (currentStatus.tokensRemaining <= thresholds.tokensRemainingWarning) {
      newAlerts.push({
        id: generateAlertId(),
        type: 'warning',
        message: `Low token quota remaining: ${Math.round(currentStatus.tokensRemaining / 1000)}k tokens`,
        timestamp: new Date(),
        status: currentStatus,
        autoResolve: true
      });
    }

    // Check consecutive errors alert
    if (currentStatus.consecutiveErrors >= thresholds.consecutiveErrorsAlert) {
      newAlerts.push({
        id: generateAlertId(),
        type: 'error',
        message: `High error rate detected: ${currentStatus.consecutiveErrors} consecutive errors`,
        timestamp: new Date(),
        status: currentStatus
      });
    }

    // Check backoff time alert
    if (currentStatus.backoffMs >= thresholds.backoffTimeAlert) {
      newAlerts.push({
        id: generateAlertId(),
        type: 'error',
        message: `Extended rate limiting active: ${Math.round(currentStatus.backoffMs / 1000)}s delay`,
        timestamp: new Date(),
        status: currentStatus
      });
    }

    if (newAlerts.length > 0) {
      setAlerts(prev => [...prev, ...newAlerts]);
    }
  }, [config.enableAlerts, config.alertThresholds]);

  // Update status from rate limiting manager
  const updateStatus = useCallback(async () => {
    if (!rateLimitingManager) {
      setIsConnected(false);
      return;
    }

    try {
      const [currentStatus, currentMetrics] = await Promise.all([
        rateLimitingManager.getStatus(),
        rateLimitingManager.getMetrics ? rateLimitingManager.getMetrics() : null
      ]);

      setStatus(currentStatus);
      setMetrics(currentMetrics);
      setIsConnected(true);
      setLastUpdated(new Date());

      // Check for alert conditions
      checkAlertConditions(currentStatus);

      // Auto-resolve alerts if conditions are no longer met
      if (config.enableAlerts) {
        setAlerts(prev => prev.filter(alert => {
          if (!alert.autoResolve) return true;
          
          // Resolve low quota alerts if quota is restored
          if (alert.message.includes('Low API requests') && currentStatus.requestsRemaining > config.alertThresholds!.requestsRemainingWarning) {
            return false;
          }
          if (alert.message.includes('Low token quota') && currentStatus.tokensRemaining > config.alertThresholds!.tokensRemainingWarning) {
            return false;
          }
          
          return true;
        }));
      }

    } catch (error) {
      console.error('Error updating rate limit status:', error);
      setIsConnected(false);
    }
  }, [rateLimitingManager, checkAlertConditions, config.enableAlerts, config.alertThresholds]);

  // Set up event listener for real-time updates
  useEffect(() => {
    if (!rateLimitingManager || !config.enableEventTracking) return;

    const handleEvent = (event: RateLimitEvent) => {
      setEvents(prev => {
        const newEvents = [...prev, event];
        // Limit event history
        if (newEvents.length > config.maxEventHistory!) {
          return newEvents.slice(-config.maxEventHistory!);
        }
        return newEvents;
      });

      // Trigger immediate status update on important events
      if (event.type === 'permission_denied' || event.type === 'error') {
        updateStatus();
      }
    };

    // Add event listener if the manager supports it
    if (rateLimitingManager.addEventListener) {
      rateLimitingManager.addEventListener(handleEvent);
      eventListenerRef.current = handleEvent;
    }

    return () => {
      if (rateLimitingManager.removeEventListener && eventListenerRef.current) {
        rateLimitingManager.removeEventListener(eventListenerRef.current);
      }
    };
  }, [rateLimitingManager, config.enableEventTracking, config.maxEventHistory, updateStatus]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (isMonitoring || !rateLimitingManager) return;

    setIsMonitoring(true);
    
    // Initial update
    updateStatus();
    
    // Set up periodic updates
    intervalRef.current = setInterval(updateStatus, config.updateInterval);
  }, [isMonitoring, rateLimitingManager, updateStatus, config.updateInterval]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Refresh status manually
  const refreshStatus = useCallback(async () => {
    await updateStatus();
  }, [updateStatus]);

  // Clear events
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Dismiss alert
  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  // Clear all alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<RateLimitMonitoringConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    
    // Restart monitoring if interval changed
    if (newConfig.updateInterval && isMonitoring) {
      stopMonitoring();
      setTimeout(startMonitoring, 100);
    }
  }, [isMonitoring, startMonitoring, stopMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  return {
    // Current status
    status,
    metrics,
    events,
    alerts,
    
    // State flags
    isMonitoring,
    isConnected,
    lastUpdated,
    
    // Control functions
    startMonitoring,
    stopMonitoring,
    refreshStatus,
    clearEvents,
    dismissAlert,
    clearAlerts,
    
    // Configuration
    updateConfig
  };
}
