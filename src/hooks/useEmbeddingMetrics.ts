/**
 * Hook for Embedding Metrics Management
 * Provides real-time data fetching and state management for embedding performance metrics
 * Phase 1: Embedding Success Rate Monitoring Dashboard
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { embeddingMetricsService } from '@/services/embeddingMetricsService';
import { embeddingMetricsRealtimeService } from '@/services/embeddingMetricsRealtimeService';
import {
  EmbeddingHealthStatus,
  EmbeddingMetricsSummary,
  EmbeddingHourlyStats,
  EmbeddingDailyStats,
  EmbeddingCostBreakdown,
  EmbeddingQualityMetrics,
  EmbeddingMetricsFilters,
  EmbeddingAggregationResult
} from '@/types/embedding-metrics';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { toast } from 'sonner';

// Global state to track the active hook instance
let activeHookId: string | null = null;

interface UseEmbeddingMetricsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableRealTime?: boolean;
  teamId?: string;
  healthCheckInterval?: number;
}

interface UseEmbeddingMetricsReturn {
  // Data
  healthStatus: EmbeddingHealthStatus | null;
  summary: EmbeddingMetricsSummary | null;
  hourlyStats: EmbeddingHourlyStats[];
  dailyStats: EmbeddingDailyStats[];
  costBreakdown: EmbeddingCostBreakdown | null;
  qualityMetrics: EmbeddingQualityMetrics | null;

  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;

  // Error states
  error: string | null;

  // Real-time status
  isRealTimeConnected: boolean;
  realTimeStatus: 'connected' | 'disconnected' | 'error' | 'connecting';
  lastUpdateTime: Date | null;

  // Actions
  refreshData: () => Promise<void>;
  triggerAggregation: (type?: 'hourly' | 'daily' | 'cleanup' | 'all') => Promise<EmbeddingAggregationResult>;
  updateFilters: (filters: EmbeddingMetricsFilters) => void;

  // Settings
  autoRefresh: boolean;
  setAutoRefresh: (enabled: boolean) => void;
  refreshInterval: number;
  setRefreshInterval: (interval: number) => void;
  enableRealTime: boolean;
  setEnableRealTime: (enabled: boolean) => void;
}

export function useEmbeddingMetrics(options: UseEmbeddingMetricsOptions = {}): UseEmbeddingMetricsReturn {
  const {
    autoRefresh: initialAutoRefresh = false, // Disabled by default to prevent issues
    refreshInterval: initialRefreshInterval = 30000, // 30 seconds
    enableRealTime: initialEnableRealTime = false, // Disabled by default until tables exist
    teamId,
    healthCheckInterval = 30000
  } = options;

  const hookId = useRef(Math.random().toString(36).substr(2, 9));

  // Register this hook as the active instance
  useEffect(() => {
    activeHookId = hookId.current;
    console.log(`🔧 useEmbeddingMetrics initialized [${hookId.current}] - now ACTIVE`);

    return () => {
      // Only clear if this was the active instance
      if (activeHookId === hookId.current) {
        activeHookId = null;
        console.log(`🧹 Active hook instance [${hookId.current}] unmounted`);
      }
    };
  }, []);

  console.log(`🔧 useEmbeddingMetrics [${hookId.current}] with options:`, options);

  // State
  const [healthStatus, setHealthStatus] = useState<EmbeddingHealthStatus | null>(null);
  const [summary, setSummary] = useState<EmbeddingMetricsSummary | null>(null);
  const [hourlyStats, setHourlyStats] = useState<EmbeddingHourlyStats[]>([]);
  const [dailyStats, setDailyStats] = useState<EmbeddingDailyStats[]>([]);
  const [costBreakdown, setCostBreakdown] = useState<EmbeddingCostBreakdown | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<EmbeddingQualityMetrics | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debug loading state changes
  useEffect(() => {
    console.log('📊 Loading state changed:', { isLoading, isRefreshing, error });
  }, [isLoading, isRefreshing, error]);
  
  const [autoRefresh, setAutoRefresh] = useState(initialAutoRefresh);
  const [refreshInterval, setRefreshInterval] = useState(initialRefreshInterval);
  const [enableRealTime, setEnableRealTime] = useState(false); // Disabled by default to prevent connection issues

  // Memoize the initial filters to prevent infinite re-renders
  const initialFilters = useMemo<EmbeddingMetricsFilters>(() => ({
    dateRange: {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
      end: new Date().toISOString()
    },
    teamId
  }), [teamId]);

  const [filters, setFilters] = useState<EmbeddingMetricsFilters>(initialFilters);

  // Real-time state
  const [isRealTimeConnected, setIsRealTimeConnected] = useState(false);
  const [realTimeStatus, setRealTimeStatus] = useState<'connected' | 'disconnected' | 'error' | 'connecting'>('disconnected');
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  // Refs
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const realtimeSubscriptionRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      // Cleanup real-time subscription
      if (realtimeSubscriptionRef.current) {
        embeddingMetricsRealtimeService.unsubscribe(realtimeSubscriptionRef.current);
      }
    };
  }, []);

  // Safe state update helper
  const safeSetState = useCallback((setter: () => void) => {
    if (mountedRef.current) {
      setter();
    }
  }, []);

  // Fetch health status
  const fetchHealthStatus = useCallback(async () => {
    try {
      const health = await embeddingMetricsService.getHealthStatus();
      safeSetState(() => setHealthStatus(health));
    } catch (err) {
      console.error('Error fetching health status:', err);
      // Don't set global error for individual fetch failures
      // The Promise.allSettled will handle this
      throw err;
    }
  }, [safeSetState]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      const summaryData = await embeddingMetricsService.getMetricsSummary(filters);
      safeSetState(() => setSummary(summaryData));
    } catch (err) {
      console.error('Error fetching summary:', err);
      // Don't set global error for individual fetch failures
      throw err;
    }
  }, [filters.dateRange.start, filters.dateRange.end, filters.teamId, filters.uploadContext, filters.status, filters.modelUsed, safeSetState]);

  // Fetch hourly stats
  const fetchHourlyStats = useCallback(async () => {
    try {
      const stats = await embeddingMetricsService.getHourlyStats(
        filters.dateRange.start,
        filters.dateRange.end
      );
      safeSetState(() => setHourlyStats(stats));
    } catch (err) {
      console.error('Error fetching hourly stats:', err);
      // Don't set global error for individual fetch failures
      throw err;
    }
  }, [filters.dateRange.start, filters.dateRange.end, safeSetState]);

  // Fetch daily stats
  const fetchDailyStats = useCallback(async () => {
    try {
      const stats = await embeddingMetricsService.getDailyStats(
        filters.dateRange.start,
        filters.dateRange.end
      );
      safeSetState(() => setDailyStats(stats));
    } catch (err) {
      console.error('Error fetching daily stats:', err);
      // Don't set global error for individual fetch failures
      throw err;
    }
  }, [filters.dateRange.start, filters.dateRange.end, safeSetState]);

  // Fetch cost breakdown
  const fetchCostBreakdown = useCallback(async () => {
    try {
      const cost = await embeddingMetricsService.getCostBreakdown(
        filters.dateRange.start,
        filters.dateRange.end
      );
      safeSetState(() => setCostBreakdown(cost));
    } catch (err) {
      console.error('Error fetching cost breakdown:', err);
      // Don't set global error for individual fetch failures
      throw err;
    }
  }, [filters.dateRange.start, filters.dateRange.end, safeSetState]);

  // Fetch quality metrics
  const fetchQualityMetrics = useCallback(async () => {
    try {
      const quality = await embeddingMetricsService.getQualityMetrics(
        filters.dateRange.start,
        filters.dateRange.end
      );
      safeSetState(() => setQualityMetrics(quality));
    } catch (err) {
      console.error('Error fetching quality metrics:', err);
      // Don't set global error for individual fetch failures
      throw err;
    }
  }, [filters.dateRange.start, filters.dateRange.end, safeSetState]);

  // Set up real-time subscription
  const setupRealTimeSubscription = useCallback(async () => {
    if (!enableRealTime) return;

    try {
      setRealTimeStatus('connecting');

      const subscriptionId = await embeddingMetricsRealtimeService.subscribeToMetrics(
        {
          enablePerformanceMetrics: true,
          enableHourlyStats: true,
          enableDailyStats: true,
          enableHealthMonitoring: true,
          teamId: filters.teamId,
          healthCheckInterval
        },
        {
          onPerformanceMetricsChange: (payload: RealtimePostgresChangesPayload<any>) => {
            console.log('📊 Real-time performance metrics update:', payload);
            setLastUpdateTime(new Date());
            // Use a debounced approach to avoid rapid successive calls
            setTimeout(() => {
              if (mountedRef.current) {
                fetchSummary().catch(console.error);
              }
            }, 500);
          },
          onHourlyStatsChange: (payload: RealtimePostgresChangesPayload<any>) => {
            console.log('📈 Real-time hourly stats update:', payload);
            setLastUpdateTime(new Date());
            setTimeout(() => {
              if (mountedRef.current) {
                fetchHourlyStats().catch(console.error);
              }
            }, 500);
          },
          onDailyStatsChange: (payload: RealtimePostgresChangesPayload<any>) => {
            console.log('📅 Real-time daily stats update:', payload);
            setLastUpdateTime(new Date());
            setTimeout(() => {
              if (mountedRef.current) {
                fetchDailyStats().catch(console.error);
              }
            }, 500);
          },
          onHealthStatusChange: (status: EmbeddingHealthStatus) => {
            console.log('🏥 Real-time health status update:', status);
            safeSetState(() => setHealthStatus(status));
            setLastUpdateTime(new Date());
          },
          onConnectionStatusChange: (status, error) => {
            console.log('🔗 Real-time connection status:', status, error);
            safeSetState(() => {
              setRealTimeStatus(status);
              setIsRealTimeConnected(status === 'connected');
            });

            if (status === 'error' && error) {
              toast.error(`Real-time connection error: ${error.message}`);
            } else if (status === 'connected') {
              toast.success('Real-time monitoring connected');
            } else if (status === 'disconnected') {
              toast.warning('Real-time monitoring disconnected');
            }
          }
        }
      );

      realtimeSubscriptionRef.current = subscriptionId;
      console.log('✅ Real-time subscription established:', subscriptionId);

    } catch (error) {
      console.error('Error setting up real-time subscription:', error);
      safeSetState(() => {
        setRealTimeStatus('error');
        setIsRealTimeConnected(false);
      });
      toast.error('Failed to establish real-time connection');
    }
  }, [
    enableRealTime,
    filters.teamId,
    healthCheckInterval,
    fetchSummary,
    fetchHourlyStats,
    fetchDailyStats,
    safeSetState
  ]);

  // Cleanup real-time subscription
  const cleanupRealTimeSubscription = useCallback(async () => {
    if (realtimeSubscriptionRef.current) {
      try {
        await embeddingMetricsRealtimeService.unsubscribe(realtimeSubscriptionRef.current);
        realtimeSubscriptionRef.current = null;
        safeSetState(() => {
          setRealTimeStatus('disconnected');
          setIsRealTimeConnected(false);
        });
        console.log('✅ Real-time subscription cleaned up');
      } catch (error) {
        console.error('Error cleaning up real-time subscription:', error);
      }
    }
  }, [safeSetState]);



  // Refresh all data
  const refreshData = useCallback(async () => {
    safeSetState(() => {
      setError(null);
      setIsRefreshing(true);
    });

    try {
      await Promise.all([
        fetchHealthStatus(),
        fetchSummary(),
        fetchHourlyStats(),
        fetchDailyStats(),
        fetchCostBreakdown(),
        fetchQualityMetrics()
      ]);
    } catch (err) {
      console.error('Error refreshing data:', err);
      safeSetState(() => setError(`Failed to refresh data: ${err instanceof Error ? err.message : 'Unknown error'}`));
    } finally {
      safeSetState(() => {
        setIsLoading(false);
        setIsRefreshing(false);
      });
    }
  }, [
    fetchHealthStatus,
    fetchSummary,
    fetchHourlyStats,
    fetchDailyStats,
    fetchCostBreakdown,
    fetchQualityMetrics,
    safeSetState
  ]);

  // Trigger aggregation
  const triggerAggregation = useCallback(async (type: 'hourly' | 'daily' | 'cleanup' | 'all' = 'all'): Promise<EmbeddingAggregationResult> => {
    try {
      const result = await embeddingMetricsService.triggerAggregation(type);
      
      if (result.success) {
        toast.success(`${type} aggregation completed successfully`);
        // Refresh data after successful aggregation
        setTimeout(() => refreshData(), 2000);
      } else {
        toast.error(`${type} aggregation failed`);
      }
      
      return result;
    } catch (err) {
      const errorMessage = `Failed to trigger ${type} aggregation: ${err instanceof Error ? err.message : 'Unknown error'}`;
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }
  }, [refreshData]);

  // Update filters
  const updateFilters = useCallback((newFilters: EmbeddingMetricsFilters) => {
    setFilters(newFilters);
  }, []);

  // Set up auto-refresh - use a stable callback to avoid circular dependency
  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(async () => {
        if (!mountedRef.current) return;

        console.log('🔄 Auto-refresh triggered...');
        safeSetState(() => {
          setError(null);
          setIsRefreshing(true);
        });

        const results = await Promise.allSettled([
          fetchHealthStatus(),
          fetchSummary(),
          fetchHourlyStats(),
          fetchDailyStats(),
          fetchCostBreakdown(),
          fetchQualityMetrics()
        ]);

        // Check for any failures but don't block the refresh completion
        const failures = results.filter(result => result.status === 'rejected');
        if (failures.length > 0) {
          console.warn('Some auto-refresh data fetching failed:', failures);
        }

        console.log('✅ Auto-refresh completed');
        safeSetState(() => {
          setIsRefreshing(false);
          // Ensure loading state is false after auto-refresh
          setIsLoading(false);
        });
      }, refreshInterval);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [
    autoRefresh,
    refreshInterval,
    fetchHealthStatus,
    fetchSummary,
    fetchHourlyStats,
    fetchDailyStats,
    fetchCostBreakdown,
    fetchQualityMetrics,
    safeSetState
  ]);

  // Manage real-time subscription
  useEffect(() => {
    if (enableRealTime) {
      setupRealTimeSubscription();
    } else {
      cleanupRealTimeSubscription();
    }

    return () => {
      cleanupRealTimeSubscription();
    };
  }, [enableRealTime, setupRealTimeSubscription, cleanupRealTimeSubscription]);

  // Initial data load - use a separate effect to avoid circular dependency
  useEffect(() => {
    const loadInitialData = async () => {
      console.log(`🔄 Starting initial data load [${hookId.current}]...`);
      safeSetState(() => {
        setError(null);
        setIsLoading(true);
      });

      // Add timeout to prevent infinite loading - more aggressive timeout
      const timeoutId = setTimeout(() => {
        console.warn(`⚠️ Data loading timeout - forcing loading state to false [${hookId.current}]`);
        // Force loading state to false regardless of mount status
        setIsLoading(false);
        setError('Data loading timed out. Some features may not be available.');
      }, 5000); // 5 second timeout

      try {
        const results = await Promise.allSettled([
          fetchHealthStatus(),
          fetchSummary(),
          fetchHourlyStats(),
          fetchDailyStats(),
          fetchCostBreakdown(),
          fetchQualityMetrics()
        ]);

        clearTimeout(timeoutId);

        // Check for any failures
        const failures = results.filter(result => result.status === 'rejected');
        if (failures.length > 0) {
          console.warn('Some data fetching failed:', failures);
          const errorMessages = failures.map((failure, index) => {
            const functionNames = ['healthStatus', 'summary', 'hourlyStats', 'dailyStats', 'costBreakdown', 'qualityMetrics'];
            return `${functionNames[index]}: ${failure.reason}`;
          });
          safeSetState(() => setError(`Partial data load failed: ${errorMessages.join(', ')}`));
        }

        console.log(`✅ Initial data load completed [${hookId.current}]`);
        console.log(`🔍 Component mounted status [${hookId.current}]:`, mountedRef.current);
        console.log(`🔍 Active hook ID:`, activeHookId, `Current hook ID:`, hookId.current);

        // Only update state if this is the active hook instance AND component is mounted
        if (mountedRef.current && activeHookId === hookId.current) {
          console.log(`📊 Setting loading state to FALSE [${hookId.current}] - ACTIVE INSTANCE`);
          setIsLoading(false);
        } else if (!mountedRef.current) {
          console.log(`⚠️ Component unmounted, skipping state update [${hookId.current}]`);
          // FALLBACK: Force loading state to false after a delay to prevent infinite loading
          setTimeout(() => {
            console.log(`🔧 FALLBACK: Forcing loading state to FALSE [${hookId.current}]`);
            setIsLoading(false);
          }, 1000);
        } else {
          console.log(`⚠️ Not active instance, skipping state update [${hookId.current}]`);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.error('❌ Critical error during initial data load:', err);
        safeSetState(() => {
          setIsLoading(false);
          setError(`Critical error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        });
      }
    };

    loadInitialData();
  }, [
    // Only include essential filter dependencies to prevent infinite re-renders
    filters.dateRange.start,
    filters.dateRange.end,
    filters.teamId
  ]);

  return {
    // Data
    healthStatus,
    summary,
    hourlyStats,
    dailyStats,
    costBreakdown,
    qualityMetrics,

    // Loading states
    isLoading,
    isRefreshing,

    // Error states
    error,

    // Real-time status
    isRealTimeConnected,
    realTimeStatus,
    lastUpdateTime,

    // Actions
    refreshData,
    triggerAggregation,
    updateFilters,

    // Settings
    autoRefresh,
    setAutoRefresh,
    refreshInterval,
    setRefreshInterval,
    enableRealTime,
    setEnableRealTime
  };
}
