/**
 * Embedding Metrics Real-time Service
 * Enhanced real-time data fetching with Supabase subscriptions
 * Phase 1: Embedding Success Rate Monitoring Dashboard - Task 2
 */

import { supabase } from '@/lib/supabase';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import {
  EmbeddingPerformanceMetric,
  EmbeddingHourlyStats,
  EmbeddingDailyStats,
  EmbeddingHealthStatus
} from '@/types/embedding-metrics';

type MetricsChangeHandler = (payload: RealtimePostgresChangesPayload<any>) => void;
type HealthStatusChangeHandler = (status: EmbeddingHealthStatus) => void;
type ConnectionStatusHandler = (status: 'connected' | 'disconnected' | 'error', error?: Error) => void;

interface SubscriptionConfig {
  enablePerformanceMetrics?: boolean;
  enableHourlyStats?: boolean;
  enableDailyStats?: boolean;
  enableHealthMonitoring?: boolean;
  teamId?: string;
  healthCheckInterval?: number; // milliseconds
}

class EmbeddingMetricsRealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();
  private subscriptions: Map<string, any> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private connectionStatusHandlers: Set<ConnectionStatusHandler> = new Set();
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  /**
   * Subscribe to real-time embedding metrics updates
   */
  async subscribeToMetrics(
    config: SubscriptionConfig,
    handlers: {
      onPerformanceMetricsChange?: MetricsChangeHandler;
      onHourlyStatsChange?: MetricsChangeHandler;
      onDailyStatsChange?: MetricsChangeHandler;
      onHealthStatusChange?: HealthStatusChangeHandler;
      onConnectionStatusChange?: ConnectionStatusHandler;
    }
  ): Promise<string> {
    const subscriptionId = `metrics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Store connection status handler
      if (handlers.onConnectionStatusChange) {
        this.connectionStatusHandlers.add(handlers.onConnectionStatusChange);
      }

      // Subscribe to performance metrics changes
      if (config.enablePerformanceMetrics && handlers.onPerformanceMetricsChange) {
        await this.subscribeToPerformanceMetrics(
          subscriptionId,
          handlers.onPerformanceMetricsChange,
          config.teamId
        );
      }

      // Subscribe to hourly stats changes
      if (config.enableHourlyStats && handlers.onHourlyStatsChange) {
        await this.subscribeToHourlyStats(
          subscriptionId,
          handlers.onHourlyStatsChange,
          config.teamId
        );
      }

      // Subscribe to daily stats changes
      if (config.enableDailyStats && handlers.onDailyStatsChange) {
        await this.subscribeToDailyStats(
          subscriptionId,
          handlers.onDailyStatsChange,
          config.teamId
        );
      }

      // Set up health monitoring
      if (config.enableHealthMonitoring && handlers.onHealthStatusChange) {
        this.startHealthMonitoring(
          subscriptionId,
          handlers.onHealthStatusChange,
          config.healthCheckInterval || 30000
        );
      }

      this.subscriptions.set(subscriptionId, {
        config,
        handlers,
        createdAt: new Date()
      });

      console.log(`✅ Embedding metrics real-time subscription created: ${subscriptionId}`);
      return subscriptionId;

    } catch (error) {
      console.error('Error setting up real-time subscription:', error);
      this.notifyConnectionStatus('error', error as Error);
      throw error;
    }
  }

  /**
   * Subscribe to performance metrics table changes
   */
  private async subscribeToPerformanceMetrics(
    subscriptionId: string,
    handler: MetricsChangeHandler,
    teamId?: string
  ): Promise<void> {
    const channelName = `performance_metrics_${subscriptionId}`;
    
    let channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'embedding_performance_metrics',
          ...(teamId && { filter: `team_id=eq.${teamId}` })
        },
        (payload) => {
          console.log('📊 Performance metrics change:', payload);
          handler(payload);
        }
      );

    // Add connection status monitoring
    channel = this.addConnectionMonitoring(channel, channelName);

    const { error } = await channel.subscribe();

    if (error) {
      console.warn('Error subscribing to performance metrics (table may not exist):', error);
      // Don't throw error for missing tables, just log warning
      return;
    }

    this.channels.set(channelName, channel);
  }

  /**
   * Subscribe to hourly stats table changes
   */
  private async subscribeToHourlyStats(
    subscriptionId: string,
    handler: MetricsChangeHandler,
    teamId?: string
  ): Promise<void> {
    const channelName = `hourly_stats_${subscriptionId}`;
    
    let channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'embedding_hourly_stats',
          ...(teamId && { filter: `team_id=eq.${teamId}` })
        },
        (payload) => {
          console.log('📈 Hourly stats change:', payload);
          handler(payload);
        }
      );

    channel = this.addConnectionMonitoring(channel, channelName);

    const { error } = await channel.subscribe();

    if (error) {
      console.warn('Error subscribing to hourly stats (table may not exist):', error);
      // Don't throw error for missing tables, just log warning
      return;
    }

    this.channels.set(channelName, channel);
  }

  /**
   * Subscribe to daily stats table changes
   */
  private async subscribeToDailyStats(
    subscriptionId: string,
    handler: MetricsChangeHandler,
    teamId?: string
  ): Promise<void> {
    const channelName = `daily_stats_${subscriptionId}`;
    
    let channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'embedding_daily_stats',
          ...(teamId && { filter: `team_id=eq.${teamId}` })
        },
        (payload) => {
          console.log('📅 Daily stats change:', payload);
          handler(payload);
        }
      );

    channel = this.addConnectionMonitoring(channel, channelName);

    const { error } = await channel.subscribe();

    if (error) {
      console.warn('Error subscribing to daily stats (table may not exist):', error);
      // Don't throw error for missing tables, just log warning
      return;
    }

    this.channels.set(channelName, channel);
  }

  /**
   * Add connection monitoring to a channel
   */
  private addConnectionMonitoring(channel: RealtimeChannel, channelName: string): RealtimeChannel {
    return channel
      .on('system', { event: 'connected' }, () => {
        console.log(`🔗 Channel ${channelName} connected`);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyConnectionStatus('connected');
      })
      .on('system', { event: 'disconnected' }, () => {
        console.log(`🔌 Channel ${channelName} disconnected`);
        this.isConnected = false;
        this.notifyConnectionStatus('disconnected');
        this.handleReconnection();
      })
      .on('system', { event: 'error' }, (error) => {
        console.error(`❌ Channel ${channelName} error:`, error);
        this.notifyConnectionStatus('error', error);
      });
  }

  /**
   * Start health monitoring with periodic checks
   */
  private startHealthMonitoring(
    subscriptionId: string,
    handler: HealthStatusChangeHandler,
    interval: number
  ): void {
    // Clear existing interval if any
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Perform initial health check
    this.performHealthCheck(handler);

    // Set up periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck(handler);
    }, interval);

    console.log(`🏥 Health monitoring started for ${subscriptionId} (interval: ${interval}ms)`);
  }

  /**
   * Perform health check and notify handler
   */
  private async performHealthCheck(handler: HealthStatusChangeHandler): Promise<void> {
    try {
      const { data, error } = await supabase.rpc('check_embedding_aggregation_health');
      
      if (error) {
        console.error('Health check failed:', error);
        return;
      }

      handler(data);
    } catch (error) {
      console.error('Error performing health check:', error);
    }
  }

  /**
   * Handle reconnection logic with exponential backoff
   */
  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      // Attempt to reconnect all channels
      this.channels.forEach(async (channel, channelName) => {
        try {
          await channel.subscribe();
          console.log(`✅ Reconnected channel: ${channelName}`);
        } catch (error) {
          console.error(`❌ Failed to reconnect channel ${channelName}:`, error);
        }
      });
    }, delay);
  }

  /**
   * Notify connection status handlers
   */
  private notifyConnectionStatus(status: 'connected' | 'disconnected' | 'error', error?: Error): void {
    this.connectionStatusHandlers.forEach(handler => {
      try {
        handler(status, error);
      } catch (err) {
        console.error('Error in connection status handler:', err);
      }
    });
  }

  /**
   * Unsubscribe from real-time updates
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        console.warn(`Subscription ${subscriptionId} not found`);
        return;
      }

      // Remove channels associated with this subscription
      const channelsToRemove: string[] = [];
      this.channels.forEach((channel, channelName) => {
        if (channelName.includes(subscriptionId)) {
          channelsToRemove.push(channelName);
        }
      });

      // Unsubscribe from channels
      for (const channelName of channelsToRemove) {
        const channel = this.channels.get(channelName);
        if (channel) {
          await supabase.removeChannel(channel);
          this.channels.delete(channelName);
          console.log(`🔌 Unsubscribed from channel: ${channelName}`);
        }
      }

      // Remove connection status handler
      if (subscription.handlers.onConnectionStatusChange) {
        this.connectionStatusHandlers.delete(subscription.handlers.onConnectionStatusChange);
      }

      // Clear health monitoring if this was the last subscription
      if (this.subscriptions.size === 1 && this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
        console.log('🏥 Health monitoring stopped');
      }

      this.subscriptions.delete(subscriptionId);
      console.log(`✅ Unsubscribed from embedding metrics: ${subscriptionId}`);

    } catch (error) {
      console.error('Error unsubscribing:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from all real-time updates
   */
  async unsubscribeAll(): Promise<void> {
    try {
      // Clear health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Unsubscribe from all channels
      for (const [channelName, channel] of this.channels) {
        await supabase.removeChannel(channel);
        console.log(`🔌 Unsubscribed from channel: ${channelName}`);
      }

      // Clear all data
      this.channels.clear();
      this.subscriptions.clear();
      this.connectionStatusHandlers.clear();
      this.isConnected = false;
      this.reconnectAttempts = 0;

      console.log('✅ Unsubscribed from all embedding metrics real-time updates');

    } catch (error) {
      console.error('Error unsubscribing from all:', error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    isConnected: boolean;
    activeChannels: number;
    activeSubscriptions: number;
    reconnectAttempts: number;
  } {
    return {
      isConnected: this.isConnected,
      activeChannels: this.channels.size,
      activeSubscriptions: this.subscriptions.size,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Get subscription details
   */
  getSubscriptionDetails(subscriptionId: string): any {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * List all active subscriptions
   */
  listActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }
}

// Export singleton instance
export const embeddingMetricsRealtimeService = new EmbeddingMetricsRealtimeService();
