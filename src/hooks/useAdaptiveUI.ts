// React Hook for Adaptive UI System
// Phase 5: Personalization & Memory System - Task 4

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePersonalizationContext } from '@/contexts/PersonalizationContext';
import AdaptiveUIEngine, {
  AdaptiveUIState,
  UIComponentConfig,
  FeatureAdaptation,
  AdaptiveLayoutConfig
} from '@/lib/adaptiveUIEngine';

interface UseAdaptiveUIOptions {
  autoAdapt?: boolean;
  adaptationInterval?: number;
  enableLearning?: boolean;
}

interface AdaptiveUIHookState {
  uiState: AdaptiveUIState;
  loading: boolean;
  error: string | null;
  adaptationConfidence: number;
}

export function useAdaptiveUI(options: UseAdaptiveUIOptions = {}) {
  const {
    autoAdapt = true,
    adaptationInterval = 300000, // 5 minutes
    enableLearning = true
  } = options;

  const { user } = useAuth();
  const { profile, trackUIAction } = usePersonalizationContext();
  
  const [state, setState] = useState<AdaptiveUIHookState>({
    uiState: AdaptiveUIEngine.getInstance().getUIState(),
    loading: false,
    error: null,
    adaptationConfidence: 0.5
  });

  const adaptiveEngine = useMemo(() => AdaptiveUIEngine.getInstance(), []);

  /**
   * Adapt UI based on current user profile
   */
  const adaptUI = useCallback(async () => {
    if (!user || !profile) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const adaptedState = adaptiveEngine.adaptUI(profile);
      
      setState(prev => ({
        ...prev,
        uiState: adaptedState,
        adaptationConfidence: adaptedState.adaptationConfidence,
        loading: false
      }));

      // Track UI adaptation event
      if (enableLearning) {
        await trackUIAction('ui_adaptation', 'adaptive-ui-system', true);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to adapt UI';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
    }
  }, [user, profile, adaptiveEngine, enableLearning, trackUIAction]);

  /**
   * Get component configuration
   */
  const getComponentConfig = useCallback((componentId: string): UIComponentConfig | null => {
    return adaptiveEngine.getComponentConfig(componentId);
  }, [adaptiveEngine]);

  /**
   * Get feature adaptation
   */
  const getFeatureAdaptation = useCallback((featureId: string): FeatureAdaptation | null => {
    return adaptiveEngine.getFeatureAdaptation(featureId);
  }, [adaptiveEngine]);

  /**
   * Check if component should be visible
   */
  const isComponentVisible = useCallback((componentId: string): boolean => {
    const config = getComponentConfig(componentId);
    return config?.visibility === 'visible';
  }, [getComponentConfig]);

  /**
   * Get component priority
   */
  const getComponentPriority = useCallback((componentId: string): number => {
    const config = getComponentConfig(componentId);
    return config?.priority || 5;
  }, [getComponentConfig]);

  /**
   * Get component style
   */
  const getComponentStyle = useCallback((componentId: string): string => {
    const config = getComponentConfig(componentId);
    return config?.style || 'spacious';
  }, [getComponentConfig]);

  /**
   * Check if feature should be prominently displayed
   */
  const isFeaturePrimary = useCallback((featureId: string): boolean => {
    const adaptation = getFeatureAdaptation(featureId);
    return adaptation?.preferredAccess === 'primary';
  }, [getFeatureAdaptation]);

  /**
   * Get feature usage frequency
   */
  const getFeatureUsageFrequency = useCallback((featureId: string): number => {
    const adaptation = getFeatureAdaptation(featureId);
    return adaptation?.usageFrequency || 0;
  }, [getFeatureAdaptation]);

  /**
   * Update component configuration
   */
  const updateComponentConfig = useCallback((
    componentId: string,
    config: Partial<UIComponentConfig>
  ) => {
    adaptiveEngine.updateComponentConfig(componentId, config);
    setState(prev => ({
      ...prev,
      uiState: adaptiveEngine.getUIState()
    }));

    // Track component customization
    if (enableLearning) {
      trackUIAction('component_customization', componentId, true);
    }
  }, [adaptiveEngine, enableLearning, trackUIAction]);

  /**
   * Track component interaction
   */
  const trackComponentInteraction = useCallback(async (
    componentId: string,
    interactionType: string,
    success: boolean = true
  ) => {
    if (!enableLearning) return;

    try {
      await trackUIAction(`${componentId}_${interactionType}`, componentId, success);
    } catch (error) {
      console.warn('Failed to track component interaction:', error);
    }
  }, [enableLearning, trackUIAction]);

  /**
   * Get adaptive CSS classes for component
   */
  const getAdaptiveClasses = useCallback((componentId: string): string => {
    const config = getComponentConfig(componentId);
    if (!config) return '';

    const classes: string[] = [];

    // Visibility classes
    if (config.visibility === 'hidden') {
      classes.push('hidden');
    } else if (config.visibility === 'collapsed') {
      classes.push('collapsed');
    } else if (config.visibility === 'minimized') {
      classes.push('minimized');
    }

    // Size classes
    switch (config.size) {
      case 'small':
        classes.push('adaptive-size-sm');
        break;
      case 'large':
        classes.push('adaptive-size-lg');
        break;
      case 'medium':
      default:
        classes.push('adaptive-size-md');
        break;
    }

    // Style classes
    switch (config.style) {
      case 'compact':
        classes.push('adaptive-style-compact');
        break;
      case 'minimal':
        classes.push('adaptive-style-minimal');
        break;
      case 'detailed':
        classes.push('adaptive-style-detailed');
        break;
      case 'spacious':
      default:
        classes.push('adaptive-style-spacious');
        break;
    }

    // Priority classes
    if (config.priority >= 8) {
      classes.push('adaptive-priority-high');
    } else if (config.priority >= 5) {
      classes.push('adaptive-priority-medium');
    } else {
      classes.push('adaptive-priority-low');
    }

    return classes.join(' ');
  }, [getComponentConfig]);

  /**
   * Get layout configuration
   */
  const getLayoutConfig = useCallback((): AdaptiveLayoutConfig => {
    return adaptiveEngine.getLayoutConfig();
  }, [adaptiveEngine]);

  /**
   * Check if layout should be compact
   */
  const isCompactLayout = useCallback((): boolean => {
    const config = getLayoutConfig();
    return config.layoutType === 'compact' || config.contentDensity === 'high';
  }, [getLayoutConfig]);

  /**
   * Get sidebar position
   */
  const getSidebarPosition = useCallback((): 'left' | 'right' | 'hidden' | 'auto' => {
    const config = getLayoutConfig();
    return config.sidebarPosition;
  }, [getLayoutConfig]);

  /**
   * Get navigation style
   */
  const getNavigationStyle = useCallback((): 'full' | 'icons' | 'minimal' | 'contextual' => {
    const config = getLayoutConfig();
    return config.navigationStyle;
  }, [getLayoutConfig]);

  /**
   * Get sorted components by priority
   */
  const getSortedComponents = useCallback((componentIds: string[]): string[] => {
    return componentIds.sort((a, b) => {
      const priorityA = getComponentPriority(a);
      const priorityB = getComponentPriority(b);
      return priorityB - priorityA; // Higher priority first
    });
  }, [getComponentPriority]);

  /**
   * Get adaptive breakpoints
   */
  const getBreakpoints = useCallback(() => {
    const config = getLayoutConfig();
    return config.responsiveBreakpoints;
  }, [getLayoutConfig]);

  // Auto-adapt UI when profile changes
  useEffect(() => {
    if (autoAdapt && profile) {
      adaptUI();
    }
  }, [autoAdapt, profile, adaptUI]);

  // Set up periodic adaptation
  useEffect(() => {
    if (!autoAdapt || adaptationInterval <= 0) return;

    const interval = setInterval(() => {
      if (profile) {
        adaptUI();
      }
    }, adaptationInterval);

    return () => clearInterval(interval);
  }, [autoAdapt, adaptationInterval, profile, adaptUI]);

  return {
    // State
    uiState: state.uiState,
    loading: state.loading,
    error: state.error,
    adaptationConfidence: state.adaptationConfidence,

    // Actions
    adaptUI,
    updateComponentConfig,
    trackComponentInteraction,

    // Component queries
    getComponentConfig,
    isComponentVisible,
    getComponentPriority,
    getComponentStyle,
    getAdaptiveClasses,
    getSortedComponents,

    // Feature queries
    getFeatureAdaptation,
    isFeaturePrimary,
    getFeatureUsageFrequency,

    // Layout queries
    getLayoutConfig,
    isCompactLayout,
    getSidebarPosition,
    getNavigationStyle,
    getBreakpoints,

    // Computed properties
    hasAdaptations: state.adaptationConfidence > 0.5,
    isHighConfidence: state.adaptationConfidence > 0.7,
    adaptationLevel: state.adaptationConfidence > 0.7 ? 'high' : 
                    state.adaptationConfidence > 0.5 ? 'medium' : 'low'
  };
}
