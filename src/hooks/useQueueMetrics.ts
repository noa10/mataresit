/**
 * Queue Metrics Hook
 * Provides real-time queue metrics and performance data
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface QueueMetrics {
  total_pending: number;
  total_processing: number;
  total_completed: number;
  total_failed: number;
  total_rate_limited: number;
  avg_processing_time_ms: number;
  active_workers: number;
  oldest_pending_age_hours: number;
}

export interface QueueWorker {
  worker_id: string;
  status: 'active' | 'idle' | 'stopped' | 'error';
  last_heartbeat: string;
  tasks_processed: number;
  total_processing_time_ms: number;
  error_count: number;
  rate_limit_count: number;
  current_task_id?: string;
}

export interface QueueConfig {
  [key: string]: any;
}

export interface QueuePerformanceData {
  throughput_per_hour: number;
  success_rate: number;
  avg_queue_wait_time_ms: number;
  worker_efficiency: number;
  queue_health_score: number;
}

interface UseQueueMetricsReturn {
  // Data
  queueMetrics: QueueMetrics | null;
  workers: QueueWorker[];
  config: QueueConfig;
  performanceData: QueuePerformanceData | null;
  
  // Status
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdateTime: Date | null;
  
  // Actions
  refreshData: () => Promise<void>;
  updateConfig: (key: string, value: any) => Promise<void>;
  startWorker: () => Promise<boolean>;
  stopWorker: () => Promise<boolean>;
  getWorkerStatus: () => Promise<any>;
  
  // Maintenance
  requeFailedItems: (maxItems?: number) => Promise<number>;
  cleanupOldItems: () => Promise<number>;
  resetRateLimitedItems: () => Promise<number>;
}

export function useQueueMetrics(autoRefresh = true, refreshInterval = 30000): UseQueueMetricsReturn {
  const [queueMetrics, setQueueMetrics] = useState<QueueMetrics | null>(null);
  const [workers, setWorkers] = useState<QueueWorker[]>([]);
  const [config, setConfig] = useState<QueueConfig>({});
  const [performanceData, setPerformanceData] = useState<QueuePerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadQueueMetrics = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_queue_statistics');
      if (error) throw error;
      
      if (data && data.length > 0) {
        setQueueMetrics(data[0]);
        return data[0];
      }
      return null;
    } catch (err) {
      console.error('Error loading queue metrics:', err);
      throw err;
    }
  }, []);

  const loadWorkers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('embedding_queue_workers')
        .select('*')
        .order('last_heartbeat', { ascending: false });
      
      if (error) throw error;
      setWorkers(data || []);
      return data || [];
    } catch (err) {
      console.error('Error loading workers:', err);
      throw err;
    }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('embedding_queue_config')
        .select('config_key, config_value');
      
      if (error) throw error;
      
      const configObj: QueueConfig = {};
      data?.forEach(item => {
        configObj[item.config_key] = item.config_value;
      });
      setConfig(configObj);
      return configObj;
    } catch (err) {
      console.error('Error loading config:', err);
      throw err;
    }
  }, []);

  const calculatePerformanceData = useCallback((metrics: QueueMetrics, workerData: QueueWorker[]) => {
    const totalProcessed = metrics.total_completed + metrics.total_failed;
    const successRate = totalProcessed > 0 ? (metrics.total_completed / totalProcessed) * 100 : 0;
    
    // Estimate throughput (items per hour)
    const throughputPerHour = metrics.avg_processing_time_ms > 0 
      ? Math.round((3600000 / metrics.avg_processing_time_ms) * metrics.active_workers)
      : 0;
    
    // Calculate worker efficiency
    const workerEfficiency = metrics.total_processing > 0 && metrics.active_workers > 0
      ? Math.min(100, (metrics.total_processing / metrics.active_workers) * 100)
      : 0;
    
    // Calculate queue health score (0-100)
    let healthScore = 100;
    
    // Deduct points for issues
    if (metrics.active_workers === 0) healthScore -= 50;
    if (metrics.oldest_pending_age_hours > 1) healthScore -= 20;
    if (successRate < 90) healthScore -= 15;
    if (metrics.total_pending > 100) healthScore -= 10;
    if (metrics.total_rate_limited > 10) healthScore -= 5;
    
    healthScore = Math.max(0, healthScore);
    
    return {
      throughput_per_hour: throughputPerHour,
      success_rate: successRate,
      avg_queue_wait_time_ms: metrics.oldest_pending_age_hours * 3600000,
      worker_efficiency: workerEfficiency,
      queue_health_score: healthScore
    };
  }, []);

  const refreshData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      
      const [metricsData, workersData, configData] = await Promise.all([
        loadQueueMetrics(),
        loadWorkers(),
        loadConfig()
      ]);
      
      if (metricsData) {
        const perfData = calculatePerformanceData(metricsData, workersData);
        setPerformanceData(perfData);
      }
      
      setLastUpdateTime(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load queue data';
      setError(errorMessage);
      console.error('Error refreshing queue data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [loadQueueMetrics, loadWorkers, loadConfig, calculatePerformanceData]);

  const updateConfig = useCallback(async (key: string, value: any) => {
    try {
      const { error } = await supabase.rpc('update_queue_config', {
        config_key_param: key,
        config_value_param: value,
        updated_by_param: null
      });
      
      if (error) throw error;
      
      // Refresh config after update
      await loadConfig();
    } catch (err) {
      console.error('Error updating config:', err);
      throw err;
    }
  }, [loadConfig]);

  const startWorker = useCallback(async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/embedding-queue-worker?action=start`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          }
        }
      );
      
      const data = await response.json();
      return data.success;
    } catch (err) {
      console.error('Error starting worker:', err);
      return false;
    }
  }, []);

  const stopWorker = useCallback(async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/embedding-queue-worker?action=stop`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          }
        }
      );
      
      const data = await response.json();
      return data.success;
    } catch (err) {
      console.error('Error stopping worker:', err);
      return false;
    }
  }, []);

  const getWorkerStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/embedding-queue-worker?action=status`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          }
        }
      );
      
      return await response.json();
    } catch (err) {
      console.error('Error getting worker status:', err);
      return null;
    }
  }, []);

  const requeFailedItems = useCallback(async (maxItems = 100) => {
    try {
      const { data, error } = await supabase.rpc('requeue_failed_items', { max_items: maxItems });
      if (error) throw error;
      
      // Refresh metrics after requeue
      await refreshData();
      return data || 0;
    } catch (err) {
      console.error('Error requeuing failed items:', err);
      throw err;
    }
  }, [refreshData]);

  const cleanupOldItems = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('cleanup_old_queue_items');
      if (error) throw error;
      
      // Refresh metrics after cleanup
      await refreshData();
      return data || 0;
    } catch (err) {
      console.error('Error cleaning up old items:', err);
      throw err;
    }
  }, [refreshData]);

  const resetRateLimitedItems = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('reset_rate_limited_items');
      if (error) throw error;
      
      // Refresh metrics after reset
      await refreshData();
      return data || 0;
    } catch (err) {
      console.error('Error resetting rate limited items:', err);
      throw err;
    }
  }, [refreshData]);

  // Initial load and auto-refresh setup
  useEffect(() => {
    refreshData();
    
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(refreshData, refreshInterval);
    }
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [refreshData, autoRefresh, refreshInterval]);

  return {
    queueMetrics,
    workers,
    config,
    performanceData,
    isLoading,
    isRefreshing,
    error,
    lastUpdateTime,
    refreshData,
    updateConfig,
    startWorker,
    stopWorker,
    getWorkerStatus,
    requeFailedItems,
    cleanupOldItems,
    resetRateLimitedItems
  };
}
