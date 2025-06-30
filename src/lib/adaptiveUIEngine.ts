// Adaptive UI Engine
// Phase 5: Personalization & Memory System - Task 4

import {
  PersonalizationProfile,
  UIAdaptationConfig,
  UserInteraction,
  BehavioralPattern
} from '@/types/personalization';

export interface UIComponentConfig {
  componentId: string;
  componentType: 'layout' | 'navigation' | 'feature' | 'content' | 'interaction';
  visibility: 'visible' | 'hidden' | 'collapsed' | 'minimized';
  priority: number; // 1-10, higher = more prominent
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  size?: 'small' | 'medium' | 'large' | 'auto';
  style?: 'compact' | 'spacious' | 'minimal' | 'detailed';
  interactionLevel?: 'basic' | 'intermediate' | 'advanced';
}

export interface AdaptiveLayoutConfig {
  layoutType: 'compact' | 'spacious' | 'minimal' | 'dashboard';
  sidebarPosition: 'left' | 'right' | 'hidden' | 'auto';
  navigationStyle: 'full' | 'icons' | 'minimal' | 'contextual';
  contentDensity: 'low' | 'medium' | 'high';
  featureDiscovery: 'guided' | 'contextual' | 'minimal' | 'disabled';
  responsiveBreakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
}

export interface FeatureAdaptation {
  featureId: string;
  usageFrequency: number; // 0-1
  lastUsed: Date;
  userProficiency: 'beginner' | 'intermediate' | 'expert';
  preferredAccess: 'primary' | 'secondary' | 'contextual' | 'hidden';
  customizations: Record<string, any>;
}

export interface AdaptiveUIState {
  layoutConfig: AdaptiveLayoutConfig;
  componentConfigs: Map<string, UIComponentConfig>;
  featureAdaptations: Map<string, FeatureAdaptation>;
  userPreferences: Record<string, any>;
  adaptationConfidence: number;
  lastUpdated: Date;
}

export class AdaptiveUIEngine {
  private static instance: AdaptiveUIEngine;
  private uiState: AdaptiveUIState;
  private adaptationRules: Map<string, (profile: PersonalizationProfile) => Partial<AdaptiveUIState>>;

  private constructor() {
    this.uiState = this.getDefaultUIState();
    this.adaptationRules = new Map();
    this.initializeAdaptationRules();
  }

  static getInstance(): AdaptiveUIEngine {
    if (!AdaptiveUIEngine.instance) {
      AdaptiveUIEngine.instance = new AdaptiveUIEngine();
    }
    return AdaptiveUIEngine.instance;
  }

  /**
   * Adapt UI based on user profile and behavioral patterns
   */
  adaptUI(userProfile: PersonalizationProfile): AdaptiveUIState {
    const adaptations: Partial<AdaptiveUIState> = {};

    // Apply layout adaptations based on preferences
    if (userProfile.preferences?.ui_layout) {
      adaptations.layoutConfig = this.adaptLayout(userProfile);
    }

    // Apply component adaptations based on usage patterns
    if (userProfile.behavioral_patterns?.usage_frequency) {
      adaptations.componentConfigs = this.adaptComponents(userProfile);
    }

    // Apply feature adaptations based on feature usage
    if (userProfile.behavioral_patterns?.feature_preferences) {
      adaptations.featureAdaptations = this.adaptFeatures(userProfile);
    }

    // Calculate adaptation confidence
    adaptations.adaptationConfidence = this.calculateAdaptationConfidence(userProfile);
    adaptations.lastUpdated = new Date();

    // Merge adaptations with current state
    this.uiState = { ...this.uiState, ...adaptations };

    return this.uiState;
  }

  /**
   * Adapt layout based on user preferences and patterns
   */
  private adaptLayout(userProfile: PersonalizationProfile): AdaptiveLayoutConfig {
    const currentLayout = this.uiState.layoutConfig;
    const preferences = userProfile.preferences?.ui_layout?.preferred_layout?.value;
    const usagePatterns = userProfile.behavioral_patterns?.usage_frequency?.data;

    let layoutType: AdaptiveLayoutConfig['layoutType'] = currentLayout.layoutType;
    let sidebarPosition: AdaptiveLayoutConfig['sidebarPosition'] = currentLayout.sidebarPosition;
    let navigationStyle: AdaptiveLayoutConfig['navigationStyle'] = currentLayout.navigationStyle;
    let contentDensity: AdaptiveLayoutConfig['contentDensity'] = currentLayout.contentDensity;

    // Adapt based on explicit preferences
    if (preferences?.layout) {
      layoutType = preferences.layout;
    }
    if (preferences?.sidebar_position) {
      sidebarPosition = preferences.sidebar_position;
    }

    // Adapt based on usage intensity
    if (usagePatterns?.usage_intensity) {
      switch (usagePatterns.usage_intensity) {
        case 'high':
          navigationStyle = 'full';
          contentDensity = 'high';
          break;
        case 'moderate':
          navigationStyle = 'icons';
          contentDensity = 'medium';
          break;
        case 'low':
          navigationStyle = 'minimal';
          contentDensity = 'low';
          break;
      }
    }

    // Adapt based on peak usage hours (for feature discovery)
    const featureDiscovery: AdaptiveLayoutConfig['featureDiscovery'] = 
      usagePatterns?.peak_hours?.length > 2 ? 'contextual' : 'guided';

    return {
      layoutType,
      sidebarPosition,
      navigationStyle,
      contentDensity,
      featureDiscovery,
      responsiveBreakpoints: currentLayout.responsiveBreakpoints
    };
  }

  /**
   * Adapt components based on usage patterns
   */
  private adaptComponents(userProfile: PersonalizationProfile): Map<string, UIComponentConfig> {
    const componentConfigs = new Map(this.uiState.componentConfigs);
    const usagePatterns = userProfile.behavioral_patterns?.usage_frequency?.data;
    const communicationStyle = userProfile.behavioral_patterns?.communication_style?.data;

    // Adapt based on most used features
    if (usagePatterns?.most_used_features) {
      usagePatterns.most_used_features.forEach((feature: string, index: number) => {
        const priority = Math.max(1, 10 - index); // Higher priority for more used features
        const componentId = this.mapFeatureToComponent(feature);
        
        if (componentId && componentConfigs.has(componentId)) {
          const config = componentConfigs.get(componentId)!;
          componentConfigs.set(componentId, {
            ...config,
            priority,
            visibility: 'visible',
            position: index < 3 ? 'top' : config.position
          });
        }
      });
    }

    // Adapt based on communication style
    if (communicationStyle?.communication_style) {
      const style = communicationStyle.communication_style;
      componentConfigs.forEach((config, componentId) => {
        if (config.componentType === 'content') {
          componentConfigs.set(componentId, {
            ...config,
            style: style === 'detailed' ? 'detailed' : 
                   style === 'concise' ? 'compact' : 'spacious'
          });
        }
      });
    }

    return componentConfigs;
  }

  /**
   * Adapt features based on usage patterns and proficiency
   */
  private adaptFeatures(userProfile: PersonalizationProfile): Map<string, FeatureAdaptation> {
    const featureAdaptations = new Map(this.uiState.featureAdaptations);
    const featurePatterns = userProfile.behavioral_patterns?.feature_preferences?.data;
    const usagePatterns = userProfile.behavioral_patterns?.usage_frequency?.data;

    // Analyze feature usage and adapt accordingly
    if (featurePatterns?.most_used_features) {
      featurePatterns.most_used_features.forEach((feature: string, index: number) => {
        const usageFrequency = Math.max(0.1, 1 - (index * 0.1)); // Decrease frequency by position
        const userProficiency = this.determineProficiency(feature, usagePatterns);
        const preferredAccess = index < 2 ? 'primary' : index < 5 ? 'secondary' : 'contextual';

        featureAdaptations.set(feature, {
          featureId: feature,
          usageFrequency,
          lastUsed: new Date(),
          userProficiency,
          preferredAccess,
          customizations: {}
        });
      });
    }

    return featureAdaptations;
  }

  /**
   * Calculate adaptation confidence based on available data
   */
  private calculateAdaptationConfidence(userProfile: PersonalizationProfile): number {
    let confidence = 0.3; // Base confidence

    // Increase confidence based on profile completeness
    if (userProfile.profile_completeness === 'complete') {
      confidence += 0.3;
    } else if (userProfile.profile_completeness === 'partial') {
      confidence += 0.2;
    }

    // Increase confidence based on behavioral patterns
    const patternCount = Object.keys(userProfile.behavioral_patterns || {}).length;
    confidence += Math.min(0.3, patternCount * 0.1);

    // Increase confidence based on preferences
    const preferenceCount = Object.keys(userProfile.preferences || {}).length;
    confidence += Math.min(0.2, preferenceCount * 0.05);

    return Math.min(1.0, confidence);
  }

  /**
   * Get component configuration by ID
   */
  getComponentConfig(componentId: string): UIComponentConfig | null {
    return this.uiState.componentConfigs.get(componentId) || null;
  }

  /**
   * Get feature adaptation by ID
   */
  getFeatureAdaptation(featureId: string): FeatureAdaptation | null {
    return this.uiState.featureAdaptations.get(featureId) || null;
  }

  /**
   * Get current layout configuration
   */
  getLayoutConfig(): AdaptiveLayoutConfig {
    return this.uiState.layoutConfig;
  }

  /**
   * Get current UI state
   */
  getUIState(): AdaptiveUIState {
    return { ...this.uiState };
  }

  /**
   * Update component configuration
   */
  updateComponentConfig(componentId: string, config: Partial<UIComponentConfig>): void {
    const currentConfig = this.uiState.componentConfigs.get(componentId);
    if (currentConfig) {
      this.uiState.componentConfigs.set(componentId, { ...currentConfig, ...config });
    }
  }

  /**
   * Register adaptation rule
   */
  registerAdaptationRule(
    ruleId: string, 
    rule: (profile: PersonalizationProfile) => Partial<AdaptiveUIState>
  ): void {
    this.adaptationRules.set(ruleId, rule);
  }

  /**
   * Initialize default adaptation rules
   */
  private initializeAdaptationRules(): void {
    // Rule: Hide advanced features for beginners
    this.registerAdaptationRule('hide_advanced_for_beginners', (profile) => {
      const communicationStyle = profile.behavioral_patterns?.communication_style?.data;
      if (communicationStyle?.technical_level === 'basic') {
        const componentConfigs = new Map(this.uiState.componentConfigs);
        componentConfigs.forEach((config, id) => {
          if (config.interactionLevel === 'advanced') {
            componentConfigs.set(id, { ...config, visibility: 'hidden' });
          }
        });
        return { componentConfigs };
      }
      return {};
    });

    // Rule: Compact layout for mobile-heavy users
    this.registerAdaptationRule('compact_for_mobile', (profile) => {
      // This would be implemented based on device usage patterns
      return {};
    });

    // Rule: Prioritize frequently used features
    this.registerAdaptationRule('prioritize_frequent_features', (profile) => {
      const usagePatterns = profile.behavioral_patterns?.usage_frequency?.data;
      if (usagePatterns?.most_used_features) {
        const componentConfigs = new Map(this.uiState.componentConfigs);
        usagePatterns.most_used_features.forEach((feature: string, index: number) => {
          const componentId = this.mapFeatureToComponent(feature);
          if (componentId && componentConfigs.has(componentId)) {
            const config = componentConfigs.get(componentId)!;
            componentConfigs.set(componentId, {
              ...config,
              priority: Math.max(1, 10 - index)
            });
          }
        });
        return { componentConfigs };
      }
      return {};
    });
  }

  /**
   * Map feature names to component IDs
   */
  private mapFeatureToComponent(feature: string): string | null {
    const featureMap: Record<string, string> = {
      'chat_message': 'chat-interface',
      'search_query': 'search-input',
      'ui_action': 'navigation-menu',
      'feature_usage': 'feature-panel',
      'upload': 'upload-zone',
      'analysis': 'analytics-dashboard',
      'export': 'export-controls',
      'settings': 'settings-panel'
    };

    return featureMap[feature] || null;
  }

  /**
   * Determine user proficiency for a feature
   */
  private determineProficiency(
    feature: string, 
    usagePatterns?: any
  ): 'beginner' | 'intermediate' | 'expert' {
    const dailyAvg = usagePatterns?.daily_avg_interactions || 0;
    
    if (dailyAvg > 20) return 'expert';
    if (dailyAvg > 5) return 'intermediate';
    return 'beginner';
  }

  /**
   * Get default UI state
   */
  private getDefaultUIState(): AdaptiveUIState {
    return {
      layoutConfig: {
        layoutType: 'spacious',
        sidebarPosition: 'left',
        navigationStyle: 'full',
        contentDensity: 'medium',
        featureDiscovery: 'guided',
        responsiveBreakpoints: {
          mobile: 768,
          tablet: 1024,
          desktop: 1280
        }
      },
      componentConfigs: new Map([
        ['navigation-menu', {
          componentId: 'navigation-menu',
          componentType: 'navigation',
          visibility: 'visible',
          priority: 10,
          position: 'left',
          size: 'medium',
          style: 'spacious'
        }],
        ['search-input', {
          componentId: 'search-input',
          componentType: 'feature',
          visibility: 'visible',
          priority: 9,
          position: 'top',
          size: 'large',
          style: 'spacious'
        }],
        ['upload-zone', {
          componentId: 'upload-zone',
          componentType: 'feature',
          visibility: 'visible',
          priority: 8,
          position: 'center',
          size: 'large',
          style: 'spacious'
        }],
        ['chat-interface', {
          componentId: 'chat-interface',
          componentType: 'interaction',
          visibility: 'visible',
          priority: 7,
          position: 'center',
          size: 'large',
          style: 'spacious'
        }]
      ]),
      featureAdaptations: new Map(),
      userPreferences: {},
      adaptationConfidence: 0.5,
      lastUpdated: new Date()
    };
  }
}

export default AdaptiveUIEngine;
