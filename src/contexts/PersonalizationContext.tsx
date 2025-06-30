// Personalization Context Provider
// Phase 5: Personalization & Memory System - Task 1

import React, { createContext, useContext, ReactNode } from 'react';
import { usePersonalization } from '@/hooks/usePersonalization';
import {
  PersonalizationProfile,
  PreferenceCategory,
  InteractionType,
  AdaptiveResponseConfig,
  UIAdaptationConfig,
  PersonalizationResult
} from '@/types/personalization';

interface PersonalizationContextType {
  // State
  profile: PersonalizationProfile | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  
  // Actions
  loadProfile: () => Promise<void>;
  setPreference: (
    category: PreferenceCategory,
    key: string,
    value: Record<string, any>,
    confidence?: number
  ) => Promise<PersonalizationResult<string>>;
  getPreference: <T>(
    category: PreferenceCategory,
    key: string,
    defaultValue: T
  ) => T;
  updatePatterns: () => Promise<PersonalizationResult<number>>;
  
  // Tracking
  trackInteraction: (
    type: InteractionType,
    context: Record<string, any>,
    metadata?: Record<string, any>
  ) => Promise<void>;
  trackChatMessage: (
    message: string,
    conversationId?: string,
    responseTime?: number
  ) => Promise<void>;
  trackSearchQuery: (
    query: string,
    queryType: 'semantic' | 'keyword' | 'filter',
    resultsCount: number
  ) => Promise<void>;
  trackUIAction: (
    actionType: string,
    component: string,
    success?: boolean
  ) => Promise<void>;
  
  // Adaptive configurations
  getAdaptiveResponseConfig: () => AdaptiveResponseConfig;
  getUIAdaptationConfig: () => UIAdaptationConfig;
  
  // Computed properties
  isProfileComplete: boolean;
  hasPreferences: boolean;
  hasPatterns: boolean;
}

const PersonalizationContext = createContext<PersonalizationContextType | undefined>(undefined);

interface PersonalizationProviderProps {
  children: ReactNode;
  autoTrack?: boolean;
  updateInterval?: number;
  minConfidence?: number;
}

export function PersonalizationProvider({
  children,
  autoTrack = true,
  updateInterval = 300000, // 5 minutes
  minConfidence = 0.3
}: PersonalizationProviderProps) {
  const personalization = usePersonalization({
    autoTrack,
    updateInterval,
    minConfidence
  });

  return (
    <PersonalizationContext.Provider value={personalization}>
      {children}
    </PersonalizationContext.Provider>
  );
}

export function usePersonalizationContext() {
  const context = useContext(PersonalizationContext);
  if (context === undefined) {
    throw new Error('usePersonalizationContext must be used within a PersonalizationProvider');
  }
  return context;
}

// Higher-order component for automatic interaction tracking
export function withPersonalizationTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return function PersonalizationTrackedComponent(props: P) {
    const { trackUIAction } = usePersonalizationContext();

    React.useEffect(() => {
      // Track component mount
      trackUIAction('component_mount', componentName);
      
      return () => {
        // Track component unmount
        trackUIAction('component_unmount', componentName);
      };
    }, [trackUIAction]);

    return <Component {...props} />;
  };
}

// Hook for adaptive UI components
export function useAdaptiveUI() {
  const { getUIAdaptationConfig, trackUIAction } = usePersonalizationContext();
  
  const config = getUIAdaptationConfig();
  
  const trackComponentInteraction = React.useCallback((
    component: string,
    action: string,
    success: boolean = true
  ) => {
    trackUIAction(`${component}_${action}`, component, success);
  }, [trackUIAction]);

  return {
    config,
    trackComponentInteraction,
    isFeatureVisible: (feature: string) => config.feature_visibility[feature] !== false,
    getLayoutPreference: () => config.layout,
    adaptationConfidence: config.adaptation_confidence
  };
}

// Hook for adaptive responses
export function useAdaptiveResponse() {
  const { getAdaptiveResponseConfig, trackChatMessage } = usePersonalizationContext();
  
  const config = getAdaptiveResponseConfig();
  
  const adaptResponse = React.useCallback((
    baseResponse: string,
    context?: Record<string, any>
  ): string => {
    let adaptedResponse = baseResponse;
    
    // Adapt based on communication style
    switch (config.communication_style.style) {
      case 'technical':
        // Add more technical details
        if (config.include_examples && !adaptedResponse.includes('```')) {
          adaptedResponse += '\n\nTechnical implementation details available upon request.';
        }
        break;
      case 'concise':
        // Shorten response
        if (config.response_length.length === 'brief') {
          const sentences = adaptedResponse.split('. ');
          adaptedResponse = sentences.slice(0, Math.max(1, Math.floor(sentences.length / 2))).join('. ');
        }
        break;
      case 'detailed':
        // Add more context
        if (config.include_context) {
          adaptedResponse += '\n\nWould you like me to explain any part in more detail?';
        }
        break;
    }
    
    // Adapt based on technical level
    if (config.technical_detail.level === 'basic' && config.include_examples) {
      adaptedResponse += '\n\nLet me know if you need any clarification!';
    }
    
    return adaptedResponse;
  }, [config]);

  const trackMessageWithPersonalization = React.useCallback((
    message: string,
    conversationId?: string,
    responseTime?: number
  ) => {
    trackChatMessage(message, conversationId, responseTime);
  }, [trackChatMessage]);

  return {
    config,
    adaptResponse,
    trackMessage: trackMessageWithPersonalization,
    personalizationConfidence: config.personalization_confidence
  };
}

// Hook for preference management
export function usePreferenceManager() {
  const { 
    setPreference, 
    getPreference, 
    profile, 
    updatePatterns,
    trackInteraction 
  } = usePersonalizationContext();

  const setUserPreference = React.useCallback(async (
    category: PreferenceCategory,
    key: string,
    value: Record<string, any>,
    confidence: number = 1.0
  ) => {
    const result = await setPreference(category, key, value, confidence);
    
    if (result.success) {
      // Track preference change
      await trackInteraction('preference_change', {
        category,
        key,
        value,
        confidence,
        source: 'explicit_setting'
      });
    }
    
    return result;
  }, [setPreference, trackInteraction]);

  const getUserPreference = React.useCallback(<T,>(
    category: PreferenceCategory,
    key: string,
    defaultValue: T
  ): T => {
    return getPreference(category, key, defaultValue);
  }, [getPreference]);

  const getPreferenceWithConfidence = React.useCallback((
    category: PreferenceCategory,
    key: string
  ) => {
    if (!profile?.preferences[category]?.[key]) {
      return null;
    }
    
    return profile.preferences[category][key];
  }, [profile]);

  const triggerPatternUpdate = React.useCallback(async () => {
    const result = await updatePatterns();
    
    if (result.success) {
      await trackInteraction('preference_change', {
        action: 'pattern_update_triggered',
        patterns_updated: result.data
      });
    }
    
    return result;
  }, [updatePatterns, trackInteraction]);

  return {
    setPreference: setUserPreference,
    getPreference: getUserPreference,
    getPreferenceWithConfidence,
    updatePatterns: triggerPatternUpdate,
    hasPreferences: profile && Object.keys(profile.preferences).length > 0,
    preferencesCount: profile ? Object.keys(profile.preferences).length : 0
  };
}

export default PersonalizationContext;
