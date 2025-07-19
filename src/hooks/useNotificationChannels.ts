/**
 * Notification Channels Hook
 * React hook for managing notification channels
 * Task 3: Create Multiple Notification Channel System - Frontend Integration
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationChannelService } from '@/services/notificationChannelService';
import { 
  NotificationChannel, 
  NotificationChannelType,
  ChannelConfiguration
} from '@/types/alerting';
import { toast } from 'sonner';

interface ChannelTestResult {
  success: boolean;
  message: string;
  responseTime?: number;
  details?: any;
}

interface ChannelValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface ChannelUsageStats {
  totalNotifications: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  successRate: number;
  averageDeliveryTime: number;
  dailyStats: Array<{
    date: string;
    total: number;
    successful: number;
    failed: number;
  }>;
}

interface UseNotificationChannelsOptions {
  teamId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseNotificationChannelsReturn {
  // Data
  channels: NotificationChannel[];
  isLoading: boolean;
  error: string | null;
  
  // Channel management
  createChannel: (channel: Omit<NotificationChannel, 'id' | 'created_at' | 'updated_at'>) => Promise<NotificationChannel>;
  updateChannel: (id: string, updates: Partial<NotificationChannel>) => Promise<NotificationChannel>;
  deleteChannel: (id: string) => Promise<void>;
  duplicateChannel: (id: string, newName: string) => Promise<NotificationChannel>;
  toggleChannel: (id: string, enabled: boolean) => Promise<NotificationChannel>;
  
  // Channel testing and validation
  testChannel: (id: string) => Promise<ChannelTestResult>;
  testChannelConfiguration: (channel: NotificationChannel) => Promise<ChannelTestResult>;
  validateChannelConfiguration: (channelType: NotificationChannelType, configuration: ChannelConfiguration) => ChannelValidationResult;
  
  // Channel filtering and querying
  getChannelsByType: (channelType: NotificationChannelType) => NotificationChannel[];
  getEnabledChannels: () => NotificationChannel[];
  getChannelUsageStats: (channelId: string, days?: number) => Promise<ChannelUsageStats>;
  
  // Utility functions
  refreshChannels: () => Promise<void>;
  getChannel: (id: string) => NotificationChannel | undefined;
  
  // State management
  selectedChannel: NotificationChannel | null;
  setSelectedChannel: (channel: NotificationChannel | null) => void;
  
  // Settings
  autoRefresh: boolean;
  setAutoRefresh: (enabled: boolean) => void;
  lastRefresh: Date | null;
}

export function useNotificationChannels(options: UseNotificationChannelsOptions = {}): UseNotificationChannelsReturn {
  const {
    teamId,
    autoRefresh: initialAutoRefresh = false,
    refreshInterval = 60000 // 1 minute
  } = options;

  // State
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<NotificationChannel | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(initialAutoRefresh);
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

  // Refresh channels data
  const refreshChannels = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const channelsData = await notificationChannelService.getChannels(teamId);
      
      safeSetState(() => {
        setChannels(channelsData);
        setLastRefresh(new Date());
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch channels';
      safeSetState(() => setError(errorMessage));
      console.error('Error refreshing channels:', err);
    } finally {
      safeSetState(() => setIsLoading(false));
    }
  }, [teamId, safeSetState]);

  // Create a new channel
  const createChannel = useCallback(async (
    channel: Omit<NotificationChannel, 'id' | 'created_at' | 'updated_at'>
  ): Promise<NotificationChannel> => {
    try {
      setError(null);
      const newChannel = await notificationChannelService.createChannel(channel);
      
      safeSetState(() => {
        setChannels(prev => [newChannel, ...prev]);
      });
      
      toast.success(`Channel "${newChannel.name}" created successfully`);
      return newChannel;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create channel';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [safeSetState]);

  // Update an existing channel
  const updateChannel = useCallback(async (
    id: string, 
    updates: Partial<NotificationChannel>
  ): Promise<NotificationChannel> => {
    try {
      setError(null);
      const updatedChannel = await notificationChannelService.updateChannel(id, updates);
      
      safeSetState(() => {
        setChannels(prev => prev.map(channel => 
          channel.id === id ? updatedChannel : channel
        ));
        
        // Update selected channel if it's the one being updated
        if (selectedChannel?.id === id) {
          setSelectedChannel(updatedChannel);
        }
      });
      
      toast.success(`Channel "${updatedChannel.name}" updated successfully`);
      return updatedChannel;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update channel';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [selectedChannel, safeSetState]);

  // Delete a channel
  const deleteChannel = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      const channelToDelete = channels.find(c => c.id === id);
      
      await notificationChannelService.deleteChannel(id);
      
      safeSetState(() => {
        setChannels(prev => prev.filter(channel => channel.id !== id));
        
        // Clear selected channel if it's the one being deleted
        if (selectedChannel?.id === id) {
          setSelectedChannel(null);
        }
      });
      
      toast.success(`Channel "${channelToDelete?.name || 'Unknown'}" deleted successfully`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete channel';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [channels, selectedChannel, safeSetState]);

  // Duplicate a channel
  const duplicateChannel = useCallback(async (id: string, newName: string): Promise<NotificationChannel> => {
    try {
      setError(null);
      const duplicatedChannel = await notificationChannelService.duplicateChannel(id, newName);
      
      safeSetState(() => {
        setChannels(prev => [duplicatedChannel, ...prev]);
      });
      
      toast.success(`Channel duplicated as "${duplicatedChannel.name}"`);
      return duplicatedChannel;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to duplicate channel';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [safeSetState]);

  // Toggle channel enabled/disabled
  const toggleChannel = useCallback(async (id: string, enabled: boolean): Promise<NotificationChannel> => {
    try {
      setError(null);
      const updatedChannel = await notificationChannelService.toggleChannel(id, enabled);
      
      safeSetState(() => {
        setChannels(prev => prev.map(channel => 
          channel.id === id ? updatedChannel : channel
        ));
        
        if (selectedChannel?.id === id) {
          setSelectedChannel(updatedChannel);
        }
      });
      
      const action = enabled ? 'enabled' : 'disabled';
      toast.success(`Channel "${updatedChannel.name}" ${action}`);
      return updatedChannel;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle channel';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [selectedChannel, safeSetState]);

  // Test a channel
  const testChannel = useCallback(async (id: string): Promise<ChannelTestResult> => {
    try {
      setError(null);
      const result = await notificationChannelService.testChannel(id);
      
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      
      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Channel test failed';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  // Test channel configuration
  const testChannelConfiguration = useCallback(async (channel: NotificationChannel): Promise<ChannelTestResult> => {
    try {
      setError(null);
      const result = await notificationChannelService.testChannelConfiguration(channel);
      
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      
      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Channel configuration test failed';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  // Validate channel configuration
  const validateChannelConfiguration = useCallback((
    channelType: NotificationChannelType, 
    configuration: ChannelConfiguration
  ): ChannelValidationResult => {
    return notificationChannelService.validateChannelConfiguration(channelType, configuration);
  }, []);

  // Get channels by type
  const getChannelsByType = useCallback((channelType: NotificationChannelType): NotificationChannel[] => {
    return channels.filter(channel => channel.channel_type === channelType);
  }, [channels]);

  // Get enabled channels
  const getEnabledChannels = useCallback((): NotificationChannel[] => {
    return channels.filter(channel => channel.enabled);
  }, [channels]);

  // Get channel usage statistics
  const getChannelUsageStats = useCallback(async (channelId: string, days: number = 30): Promise<ChannelUsageStats> => {
    try {
      setError(null);
      return await notificationChannelService.getChannelUsageStats(channelId, days);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch channel usage stats';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Get specific channel
  const getChannel = useCallback((id: string): NotificationChannel | undefined => {
    return channels.find(channel => channel.id === id);
  }, [channels]);

  // Set up auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(refreshChannels, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, refreshChannels]);

  // Initial data load
  useEffect(() => {
    refreshChannels();
  }, [refreshChannels]);

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
    // Data
    channels,
    isLoading,
    error,
    
    // Channel management
    createChannel,
    updateChannel,
    deleteChannel,
    duplicateChannel,
    toggleChannel,
    
    // Channel testing and validation
    testChannel,
    testChannelConfiguration,
    validateChannelConfiguration,
    
    // Channel filtering and querying
    getChannelsByType,
    getEnabledChannels,
    getChannelUsageStats,
    
    // Utility functions
    refreshChannels,
    getChannel,
    
    // State management
    selectedChannel,
    setSelectedChannel,
    
    // Settings
    autoRefresh,
    setAutoRefresh,
    lastRefresh
  };
}
