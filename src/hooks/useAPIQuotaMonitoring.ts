/**
 * API Quota Usage Monitoring Hook
 * Phase 3: Batch Upload Optimization - Priority 3.2.2
 * 
 * Provides comprehensive API quota usage monitoring with:
 * - Real-time quota usage tracking
 * - Historical usage data collection
 * - Usage prediction and analytics
 * - Integration with QuotaTrackingService
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { QuotaTrackingService } from '@/lib/rate-limiting/QuotaTrackingService';
import type { QuotaUsage } from '@/lib/rate-limiting/QuotaTrackingService';

interface QuotaUsageData {
  requests: {
    used: number;
    limit: number;
    remaining: number;
    resetTime: Date;
    usageRate: number; // requests per minute
  };
  tokens: {
    used: number;
    limit: number;
    remaining: number;
    resetTime: Date;
    usageRate: number; // tokens per minute
  };
  historical?: {
    timestamp: Date;
    requestsUsed: number;
    tokensUsed: number;
  }[];
}

interface QuotaMonitoringConfig {
  apiProvider: string;
  updateInterval?: number; // milliseconds
  enableHistoricalTracking?: boolean;
  historicalDataPoints?: number;
  enablePredictions?: boolean;
  quotaLimits?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

interface QuotaAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  message: string;
  timestamp: Date;
  threshold: number;
  currentValue: number;
}

interface UseAPIQuotaMonitoringReturn {
  // Current data
  quotaData: QuotaUsageData | null;
  alerts: QuotaAlert[];
  
  // State flags
  isMonitoring: boolean;
  isLoading: boolean;
  lastUpdated: Date | null;
  error: string | null;
  
  // Control functions
  startMonitoring: () => void;
  stopMonitoring: () => void;
  refreshData: () => Promise<void>;
  clearAlerts: () => void;
  dismissAlert: (alertId: string) => void;
  
  // Analytics
  getUsageStatistics: () => Promise<any>;
  predictExhaustion: () => { timeToExhaustion: number; confidence: number } | null;
  
  // Configuration
  updateConfig: (config: Partial<QuotaMonitoringConfig>) => void;
}

const DEFAULT_CONFIG: Omit<QuotaMonitoringConfig, 'apiProvider'> = {
  updateInterval: 10000, // 10 seconds
  enableHistoricalTracking: true,
  historicalDataPoints: 50,
  enablePredictions: true,
  quotaLimits: {
    requestsPerMinute: 90,
    tokensPerMinute: 150000
  }
};

export function useAPIQuotaMonitoring(
  initialConfig: QuotaMonitoringConfig
): UseAPIQuotaMonitoringReturn {
  const [config, setConfig] = useState<QuotaMonitoringConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig
  });
  
  const [quotaData, setQuotaData] = useState<QuotaUsageData | null>(null);
  const [alerts, setAlerts] = useState<QuotaAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const quotaService = useRef<QuotaTrackingService>(QuotaTrackingService.getInstance());
  const historicalData = useRef<{ timestamp: Date; requestsUsed: number; tokensUsed: number }[]>([]);
  const previousUsage = useRef<{ requests: number; tokens: number; timestamp: Date } | null>(null);

  // Generate alert ID
  const generateAlertId = () => `quota-alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Check for quota alerts
  const checkQuotaAlerts = useCallback((data: QuotaUsageData) => {
    const newAlerts: QuotaAlert[] = [];
    
    // Check requests usage
    const requestsUsagePercent = (data.requests.used / data.requests.limit) * 100;
    if (requestsUsagePercent >= 90) {
      newAlerts.push({
        id: generateAlertId(),
        type: 'critical',
        message: `Critical: ${requestsUsagePercent.toFixed(1)}% of request quota used`,
        timestamp: new Date(),
        threshold: 90,
        currentValue: requestsUsagePercent
      });
    } else if (requestsUsagePercent >= 75) {
      newAlerts.push({
        id: generateAlertId(),
        type: 'warning',
        message: `Warning: ${requestsUsagePercent.toFixed(1)}% of request quota used`,
        timestamp: new Date(),
        threshold: 75,
        currentValue: requestsUsagePercent
      });
    }
    
    // Check tokens usage
    const tokensUsagePercent = (data.tokens.used / data.tokens.limit) * 100;
    if (tokensUsagePercent >= 90) {
      newAlerts.push({
        id: generateAlertId(),
        type: 'critical',
        message: `Critical: ${tokensUsagePercent.toFixed(1)}% of token quota used`,
        timestamp: new Date(),
        threshold: 90,
        currentValue: tokensUsagePercent
      });
    } else if (tokensUsagePercent >= 75) {
      newAlerts.push({
        id: generateAlertId(),
        type: 'warning',
        message: `Warning: ${tokensUsagePercent.toFixed(1)}% of token quota used`,
        timestamp: new Date(),
        threshold: 75,
        currentValue: tokensUsagePercent
      });
    }

    // Check usage rate alerts
    if (data.requests.usageRate > data.requests.limit * 0.8) {
      newAlerts.push({
        id: generateAlertId(),
        type: 'warning',
        message: `High request rate: ${data.requests.usageRate.toFixed(1)}/min`,
        timestamp: new Date(),
        threshold: data.requests.limit * 0.8,
        currentValue: data.requests.usageRate
      });
    }

    if (newAlerts.length > 0) {
      setAlerts(prev => [...prev, ...newAlerts]);
    }
  }, []);

  // Calculate usage rates
  const calculateUsageRates = useCallback((
    currentUsage: { requests: number; tokens: number },
    timestamp: Date
  ): { requestsRate: number; tokensRate: number } => {
    if (!previousUsage.current) {
      previousUsage.current = { ...currentUsage, timestamp };
      return { requestsRate: 0, tokensRate: 0 };
    }

    const timeDiffMinutes = (timestamp.getTime() - previousUsage.current.timestamp.getTime()) / 60000;
    if (timeDiffMinutes <= 0) {
      return { requestsRate: 0, tokensRate: 0 };
    }

    const requestsRate = (currentUsage.requests - previousUsage.current.requests) / timeDiffMinutes;
    const tokensRate = (currentUsage.tokens - previousUsage.current.tokens) / timeDiffMinutes;

    // Update previous usage for next calculation
    previousUsage.current = { ...currentUsage, timestamp };

    return {
      requestsRate: Math.max(0, requestsRate),
      tokensRate: Math.max(0, tokensRate)
    };
  }, []);

  // Fetch quota data
  const fetchQuotaData = useCallback(async () => {
    try {
      setError(null);
      
      const [requestsUsage, tokensUsage] = await Promise.all([
        quotaService.current.getQuotaUsage(config.apiProvider, 'requests'),
        quotaService.current.getQuotaUsage(config.apiProvider, 'tokens')
      ]);

      const now = new Date();
      
      // Use default values if no usage data exists
      const requestsData = requestsUsage || {
        quotaUsed: 0,
        quotaLimit: config.quotaLimits!.requestsPerMinute,
        quotaRemaining: config.quotaLimits!.requestsPerMinute,
        timeWindow: now,
        isRateLimited: false
      };

      const tokensData = tokensUsage || {
        quotaUsed: 0,
        quotaLimit: config.quotaLimits!.tokensPerMinute,
        quotaRemaining: config.quotaLimits!.tokensPerMinute,
        timeWindow: now,
        isRateLimited: false
      };

      // Calculate usage rates
      const rates = calculateUsageRates(
        { requests: requestsData.quotaUsed, tokens: tokensData.quotaUsed },
        now
      );

      // Calculate reset times (next minute boundary)
      const nextMinute = new Date(Math.ceil(now.getTime() / 60000) * 60000);

      const newQuotaData: QuotaUsageData = {
        requests: {
          used: requestsData.quotaUsed,
          limit: requestsData.quotaLimit,
          remaining: requestsData.quotaRemaining,
          resetTime: nextMinute,
          usageRate: rates.requestsRate
        },
        tokens: {
          used: tokensData.quotaUsed,
          limit: tokensData.quotaLimit,
          remaining: tokensData.quotaRemaining,
          resetTime: nextMinute,
          usageRate: rates.tokensRate
        }
      };

      // Add to historical data if enabled
      if (config.enableHistoricalTracking) {
        historicalData.current.push({
          timestamp: now,
          requestsUsed: requestsData.quotaUsed,
          tokensUsed: tokensData.quotaUsed
        });

        // Limit historical data points
        if (historicalData.current.length > config.historicalDataPoints!) {
          historicalData.current = historicalData.current.slice(-config.historicalDataPoints!);
        }

        newQuotaData.historical = [...historicalData.current];
      }

      setQuotaData(newQuotaData);
      setLastUpdated(now);
      
      // Check for alerts
      checkQuotaAlerts(newQuotaData);

    } catch (err) {
      console.error('Error fetching quota data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch quota data');
    }
  }, [config, calculateUsageRates, checkQuotaAlerts]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;

    setIsMonitoring(true);
    setIsLoading(true);
    
    // Initial fetch
    fetchQuotaData().finally(() => setIsLoading(false));
    
    // Set up periodic updates
    intervalRef.current = setInterval(fetchQuotaData, config.updateInterval);
  }, [isMonitoring, fetchQuotaData, config.updateInterval]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Refresh data manually
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetchQuotaData();
    } finally {
      setIsLoading(false);
    }
  }, [fetchQuotaData]);

  // Clear all alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Dismiss specific alert
  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  // Get usage statistics
  const getUsageStatistics = useCallback(async () => {
    try {
      return await quotaService.current.getQuotaStatistics(config.apiProvider, 24);
    } catch (error) {
      console.error('Error fetching usage statistics:', error);
      return null;
    }
  }, [config.apiProvider]);

  // Predict quota exhaustion
  const predictExhaustion = useCallback((): { timeToExhaustion: number; confidence: number } | null => {
    if (!quotaData || !config.enablePredictions) return null;

    const requestsRate = quotaData.requests.usageRate;
    const tokensRate = quotaData.tokens.usageRate;
    
    if (requestsRate <= 0 && tokensRate <= 0) return null;

    const requestsTimeToExhaustion = requestsRate > 0 ? 
      (quotaData.requests.remaining / requestsRate) * 60000 : Infinity;
    const tokensTimeToExhaustion = tokensRate > 0 ? 
      (quotaData.tokens.remaining / tokensRate) * 60000 : Infinity;
    
    const timeToExhaustion = Math.min(requestsTimeToExhaustion, tokensTimeToExhaustion);
    
    // Calculate confidence based on historical data consistency
    let confidence = 0.5;
    if (historicalData.current.length >= 5) {
      confidence = 0.8;
    }
    if (historicalData.current.length >= 10) {
      confidence = 0.9;
    }

    return {
      timeToExhaustion: isFinite(timeToExhaustion) ? timeToExhaustion : 0,
      confidence
    };
  }, [quotaData, config.enablePredictions]);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<QuotaMonitoringConfig>) => {
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
    // Current data
    quotaData,
    alerts,
    
    // State flags
    isMonitoring,
    isLoading,
    lastUpdated,
    error,
    
    // Control functions
    startMonitoring,
    stopMonitoring,
    refreshData,
    clearAlerts,
    dismissAlert,
    
    // Analytics
    getUsageStatistics,
    predictExhaustion,
    
    // Configuration
    updateConfig
  };
}
