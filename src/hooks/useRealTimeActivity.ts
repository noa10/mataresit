import { useState, useEffect, useRef, useCallback } from 'react';
import { realTimeActivityService, ActivityEvent, ActivitySubscriptionOptions } from '@/services/realTimeActivityService';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';

/**
 * Hook for managing real-time activity subscriptions
 * 
 * Provides easy-to-use interface for subscribing to team activities,
 * member changes, and system events with automatic cleanup and error handling.
 */

export interface UseRealTimeActivityOptions extends Omit<ActivitySubscriptionOptions, 'teamId' | 'userId'> {
  teamId?: string;
  userId?: string;
  enabled?: boolean;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export interface RealTimeActivityState {
  events: ActivityEvent[];
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
  stats: {
    eventsReceived: number;
    eventsFiltered: number;
    lastEventTime: Date | null;
    averageLatency: number;
  };
}

export function useRealTimeActivity(options: UseRealTimeActivityOptions = {}) {
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  
  // Use provided teamId or current team
  const teamId = options.teamId || currentTeam?.id;
  const userId = options.userId || user?.id;
  const enabled = options.enabled !== false;

  const [state, setState] = useState<RealTimeActivityState>({
    events: [],
    isConnected: false,
    isLoading: false,
    error: null,
    stats: {
      eventsReceived: 0,
      eventsFiltered: 0,
      lastEventTime: null,
      averageLatency: 0
    }
  });

  const subscriptionIdRef = useRef<string | null>(null);
  const eventsRef = useRef<ActivityEvent[]>([]);
  const maxEventsRef = useRef(100); // Maximum events to keep in memory

  // Generate unique subscription ID
  const generateSubscriptionId = useCallback(() => {
    return `activity-${teamId}-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, [teamId, userId]);

  // Handle new activity events
  const handleActivityEvent = useCallback((event: ActivityEvent) => {
    eventsRef.current = [event, ...eventsRef.current].slice(0, maxEventsRef.current);
    
    setState(prev => ({
      ...prev,
      events: [...eventsRef.current],
      stats: {
        ...prev.stats,
        eventsReceived: prev.stats.eventsReceived + 1,
        lastEventTime: new Date(event.timestamp)
      }
    }));
  }, []);

  // Subscribe to real-time activities
  const subscribe = useCallback(async () => {
    if (!teamId || !enabled) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const subscriptionId = generateSubscriptionId();
      subscriptionIdRef.current = subscriptionId;

      const subscriptionOptions: ActivitySubscriptionOptions = {
        teamId,
        userId,
        activityTypes: options.activityTypes,
        priority: options.priority,
        batchUpdates: options.batchUpdates,
        maxUpdatesPerSecond: options.maxUpdatesPerSecond || 10
      };

      await realTimeActivityService.subscribeToTeamActivities(
        subscriptionId,
        subscriptionOptions,
        handleActivityEvent
      );

      setState(prev => ({
        ...prev,
        isConnected: true,
        isLoading: false
      }));

      options.onConnect?.();
    } catch (error) {
      const err = error as Error;
      setState(prev => ({
        ...prev,
        isConnected: false,
        isLoading: false,
        error: err
      }));

      options.onError?.(err);
    }
  }, [teamId, userId, enabled, options, generateSubscriptionId, handleActivityEvent]);

  // Unsubscribe from real-time activities
  const unsubscribe = useCallback(async () => {
    if (!subscriptionIdRef.current) return;

    try {
      await realTimeActivityService.unsubscribeFromTeamActivities(subscriptionIdRef.current);
      subscriptionIdRef.current = null;
      
      setState(prev => ({
        ...prev,
        isConnected: false
      }));

      options.onDisconnect?.();
    } catch (error) {
      console.error('Error unsubscribing from real-time activities:', error);
    }
  }, [options]);

  // Reconnect to real-time activities
  const reconnect = useCallback(async () => {
    await unsubscribe();
    await subscribe();
  }, [unsubscribe, subscribe]);

  // Clear events
  const clearEvents = useCallback(() => {
    eventsRef.current = [];
    setState(prev => ({
      ...prev,
      events: [],
      stats: {
        eventsReceived: 0,
        eventsFiltered: 0,
        lastEventTime: null,
        averageLatency: 0
      }
    }));
  }, []);

  // Update statistics
  const updateStats = useCallback(() => {
    const serviceStats = realTimeActivityService.getStats();
    setState(prev => ({
      ...prev,
      stats: {
        eventsReceived: serviceStats.eventsReceived,
        eventsFiltered: serviceStats.eventsFiltered,
        lastEventTime: serviceStats.lastEventTime,
        averageLatency: serviceStats.averageLatency
      }
    }));
  }, []);

  // Filter events by type
  const getEventsByType = useCallback((type: ActivityEvent['type']) => {
    return state.events.filter(event => event.type === type);
  }, [state.events]);

  // Filter events by action
  const getEventsByAction = useCallback((action: string) => {
    return state.events.filter(event => event.action === action);
  }, [state.events]);

  // Filter events by priority
  const getEventsByPriority = useCallback((priority: ActivityEvent['priority']) => {
    return state.events.filter(event => event.priority === priority);
  }, [state.events]);

  // Get recent events (last N events)
  const getRecentEvents = useCallback((count: number = 10) => {
    return state.events.slice(0, count);
  }, [state.events]);

  // Get events in time range
  const getEventsInTimeRange = useCallback((startTime: Date, endTime: Date) => {
    return state.events.filter(event => {
      const eventTime = new Date(event.timestamp);
      return eventTime >= startTime && eventTime <= endTime;
    });
  }, [state.events]);

  // Set maximum events to keep in memory
  const setMaxEvents = useCallback((maxEvents: number) => {
    maxEventsRef.current = maxEvents;
    if (eventsRef.current.length > maxEvents) {
      eventsRef.current = eventsRef.current.slice(0, maxEvents);
      setState(prev => ({
        ...prev,
        events: [...eventsRef.current]
      }));
    }
  }, []);

  // Subscribe on mount and when dependencies change
  useEffect(() => {
    if (enabled && teamId) {
      subscribe();
    }

    return () => {
      unsubscribe();
    };
  }, [enabled, teamId, subscribe, unsubscribe]);

  // Update stats periodically
  useEffect(() => {
    if (!state.isConnected) return;

    const interval = setInterval(updateStats, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [state.isConnected, updateStats]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscriptionIdRef.current) {
        realTimeActivityService.unsubscribeFromTeamActivities(subscriptionIdRef.current);
      }
    };
  }, []);

  return {
    // State
    events: state.events,
    isConnected: state.isConnected,
    isLoading: state.isLoading,
    error: state.error,
    stats: state.stats,

    // Actions
    subscribe,
    unsubscribe,
    reconnect,
    clearEvents,
    setMaxEvents,

    // Filters and utilities
    getEventsByType,
    getEventsByAction,
    getEventsByPriority,
    getRecentEvents,
    getEventsInTimeRange,

    // Computed values
    hasEvents: state.events.length > 0,
    latestEvent: state.events[0] || null,
    eventCount: state.events.length,
    highPriorityEvents: state.events.filter(e => e.priority === 'high'),
    unreadEvents: state.events.filter(e => !e.data.read),
  };
}

/**
 * Hook for team-specific real-time activities
 */
export function useTeamRealTimeActivity(
  teamId: string,
  options: Omit<UseRealTimeActivityOptions, 'teamId'> = {}
) {
  return useRealTimeActivity({ ...options, teamId });
}

/**
 * Hook for user-specific real-time activities
 */
export function useUserRealTimeActivity(
  userId: string,
  options: Omit<UseRealTimeActivityOptions, 'userId'> = {}
) {
  return useRealTimeActivity({ ...options, userId });
}

/**
 * Hook for filtered real-time activities
 */
export function useFilteredRealTimeActivity(
  teamId: string,
  activityTypes: string[],
  options: Omit<UseRealTimeActivityOptions, 'teamId' | 'activityTypes'> = {}
) {
  return useRealTimeActivity({ ...options, teamId, activityTypes });
}
