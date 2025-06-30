// React Hook for User Personalization
// Phase 5: Personalization & Memory System - Task 1

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { preferenceLearningService } from '@/services/preferenceLearningService';
import {
  PersonalizationProfile,
  PreferenceCategory,
  InteractionType,
  AdaptiveResponseConfig,
  UIAdaptationConfig,
  PersonalizationResult
} from '@/types/personalization';

interface UsePersonalizationOptions {
  autoTrack?: boolean;
  updateInterval?: number;
  minConfidence?: number;
}

interface PersonalizationState {
  profile: PersonalizationProfile | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function usePersonalization(options: UsePersonalizationOptions = {}) {
  const {
    autoTrack = true,
    updateInterval = 300000, // 5 minutes
    minConfidence = 0.3
  } = options;

  const { user } = useAuth();
  const [state, setState] = useState<PersonalizationState>({
    profile: null,
    loading: false,
    error: null,
    lastUpdated: null
  });

  const updateIntervalRef = useRef<NodeJS.Timeout>();
  const sessionInitialized = useRef(false);

  /**
   * Load personalization profile
   */
  const loadProfile = useCallback(async () => {
    if (!user) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const profile = await preferenceLearningService.getPersonalizationProfile();
      setState(prev => ({
        ...prev,
        profile,
        loading: false,
        lastUpdated: new Date()
      }));
    } catch (error) {
      console.error('Failed to load personalization profile:', error);

      // Check if this is a missing database function error
      const errorMessage = error instanceof Error ? error.message : 'Failed to load profile';
      const isMissingFunction = errorMessage.includes('Could not find the function') ||
                               errorMessage.includes('PGRST202');

      if (isMissingFunction) {
        console.warn('Personalization database functions not available, using fallback profile');
        // Create a minimal fallback profile
        const fallbackProfile = {
          user_id: user?.id || '',
          profile_completeness: 'minimal' as const,
          preferences: {},
          behavioral_patterns: {},
          last_updated: new Date().toISOString(),
          created_at: new Date().toISOString()
        };

        setState(prev => ({
          ...prev,
          profile: fallbackProfile,
          loading: false,
          lastUpdated: new Date(),
          error: null // Clear error since we have a fallback
        }));
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: errorMessage
        }));
      }
    }
  }, [user]);

  /**
   * Track user interaction
   */
  const trackInteraction = useCallback(async (
    type: InteractionType,
    context: Record<string, any>,
    metadata?: Record<string, any>
  ) => {
    if (!user || !autoTrack) return;

    try {
      await preferenceLearningService.trackInteraction(type, context, metadata);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to track interaction';
      const isMissingFunction = errorMessage.includes('Could not find the function') ||
                               errorMessage.includes('PGRST202');

      if (isMissingFunction) {
        // Silently skip tracking when database functions are not available
        return;
      } else {
        console.warn('Failed to track interaction:', error);
      }
    }
  }, [user, autoTrack]);

  /**
   * Set user preference
   */
  const setPreference = useCallback(async (
    category: PreferenceCategory,
    key: string,
    value: Record<string, any>,
    confidence: number = 1.0
  ): Promise<PersonalizationResult<string>> => {
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED', message: 'User not authenticated' };
    }

    try {
      const preferenceId = await preferenceLearningService.setUserPreference(
        category,
        key,
        value,
        confidence,
        'explicit_setting'
      );

      // Reload profile to reflect changes
      await loadProfile();

      return { success: true, data: preferenceId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set preference';
      return { success: false, error: 'UNKNOWN_ERROR', message };
    }
  }, [user, loadProfile]);

  /**
   * Get preference with default fallback
   */
  const getPreference = useCallback(<T>(
    category: PreferenceCategory,
    key: string,
    defaultValue: T
  ): T => {
    if (!state.profile?.preferences[category]?.[key]) {
      return defaultValue;
    }

    const preference = state.profile.preferences[category][key];
    if (preference.confidence < minConfidence) {
      return defaultValue;
    }

    return preference.value as T;
  }, [state.profile, minConfidence]);

  /**
   * Get adaptive response configuration
   */
  const getAdaptiveResponseConfig = useCallback((): AdaptiveResponseConfig => {
    const communicationStyle = getPreference('communication_style', 'preferred_style', { style: 'balanced' });
    const responseLength = getPreference('response_length', 'preferred_length', { length: 'moderate' });
    const technicalDetail = getPreference('technical_detail_level', 'preferred_level', { level: 'intermediate' });

    const avgConfidence = state.profile ? 
      Object.values(state.profile.preferences).reduce((acc, categoryPrefs) => {
        const confidences = Object.values(categoryPrefs).map(p => p.confidence);
        return acc + confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
      }, 0) / Object.keys(state.profile.preferences).length : 0.5;

    return {
      communication_style: communicationStyle,
      response_length: responseLength,
      technical_detail: technicalDetail,
      include_examples: technicalDetail.level !== 'advanced',
      include_context: responseLength.length !== 'brief',
      personalization_confidence: avgConfidence
    };
  }, [getPreference, state.profile]);

  /**
   * Get UI adaptation configuration
   */
  const getUIAdaptationConfig = useCallback((): UIAdaptationConfig => {
    const layout = getPreference('ui_layout', 'preferred_layout', {
      layout: 'spacious',
      sidebar_position: 'left',
      theme: 'auto'
    });

    const featureUsage = getPreference('feature_usage', 'preferred_features', { features: [] });
    
    // Create feature visibility map based on usage patterns
    const featureVisibility: Record<string, boolean> = {};
    if (featureUsage.features && Array.isArray(featureUsage.features)) {
      featureUsage.features.forEach((feature: string) => {
        featureVisibility[feature] = true;
      });
    }

    const avgConfidence = state.profile ? 
      Object.values(state.profile.behavioral_patterns).reduce((acc, pattern) => 
        acc + pattern.confidence, 0) / Object.keys(state.profile.behavioral_patterns).length : 0.5;

    return {
      layout,
      feature_visibility: featureVisibility,
      component_preferences: {},
      adaptation_confidence: avgConfidence
    };
  }, [getPreference, state.profile]);

  /**
   * Update behavioral patterns
   */
  const updatePatterns = useCallback(async (): Promise<PersonalizationResult<number>> => {
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED', message: 'User not authenticated' };
    }

    try {
      const patternsUpdated = await preferenceLearningService.updateBehavioralPatterns();
      
      // Reload profile to reflect changes
      await loadProfile();

      return { success: true, data: patternsUpdated };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update patterns';
      return { success: false, error: 'COMPUTATION_FAILED', message };
    }
  }, [user, loadProfile]);

  /**
   * Track chat message with automatic analysis
   */
  const trackChatMessage = useCallback(async (
    message: string,
    conversationId?: string,
    responseTime?: number
  ) => {
    await trackInteraction('chat_message', {
      message,
      message_length: message.length,
      contains_question: message.includes('?'),
      conversation_id: conversationId,
      response_time: responseTime
    });
  }, [trackInteraction]);

  /**
   * Track search query with automatic analysis
   */
  const trackSearchQuery = useCallback(async (
    query: string,
    queryType: 'semantic' | 'keyword' | 'filter',
    resultsCount: number
  ) => {
    await trackInteraction('search_query', {
      query,
      query_type: queryType,
      results_count: resultsCount
    });
  }, [trackInteraction]);

  /**
   * Track UI action with automatic analysis
   */
  const trackUIAction = useCallback(async (
    actionType: string,
    component: string,
    success: boolean = true
  ) => {
    await trackInteraction('ui_action', {
      action_type: actionType,
      component,
      page: window.location.pathname,
      success
    });
  }, [trackInteraction]);

  // Initialize session and load profile when user changes
  useEffect(() => {
    if (user && !sessionInitialized.current) {
      preferenceLearningService.initializeSession();
      sessionInitialized.current = true;
      loadProfile();
    } else if (!user) {
      sessionInitialized.current = false;
      setState({
        profile: null,
        loading: false,
        error: null,
        lastUpdated: null
      });
    }
  }, [user, loadProfile]);

  // Set up periodic profile updates
  useEffect(() => {
    if (user && updateInterval > 0) {
      updateIntervalRef.current = setInterval(loadProfile, updateInterval);
      
      return () => {
        if (updateIntervalRef.current) {
          clearInterval(updateIntervalRef.current);
        }
      };
    }
  }, [user, updateInterval, loadProfile]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionInitialized.current) {
        preferenceLearningService.endSession();
      }
    };
  }, []);

  return {
    // State
    profile: state.profile,
    loading: state.loading,
    error: state.error,
    lastUpdated: state.lastUpdated,
    
    // Actions
    loadProfile,
    setPreference,
    getPreference,
    updatePatterns,
    
    // Tracking
    trackInteraction,
    trackChatMessage,
    trackSearchQuery,
    trackUIAction,
    
    // Adaptive configurations
    getAdaptiveResponseConfig,
    getUIAdaptationConfig,
    
    // Computed properties
    isProfileComplete: state.profile?.profile_completeness === 'complete',
    hasPreferences: state.profile && Object.keys(state.profile.preferences).length > 0,
    hasPatterns: state.profile && Object.keys(state.profile.behavioral_patterns).length > 0
  };
}
