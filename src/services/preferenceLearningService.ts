// User Preference Learning Service
// Phase 5: Personalization & Memory System - Task 1

import { supabase } from '@/lib/supabase';
import {
  PreferenceLearningService,
  InteractionType,
  PreferenceCategory,
  LearningSource,
  UserPreference,
  PersonalizationProfile,
  PersonalizationResult,
  PersonalizationError
} from '@/types/personalization';

class PreferenceLearningServiceImpl implements PreferenceLearningService {
  private sessionId: string;

  constructor() {
    // Generate session ID for grouping interactions
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Track a user interaction for behavioral analysis
   */
  async trackInteraction(
    type: InteractionType,
    context: Record<string, any>,
    metadata: Record<string, any> = {},
    sessionId?: string
  ): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('track_user_interaction', {
        p_interaction_type: type,
        p_interaction_context: context,
        p_interaction_metadata: metadata,
        p_session_id: sessionId || this.sessionId
      });

      if (error) {
        console.error('Error tracking interaction:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Failed to track interaction:', error);
      throw error;
    }
  }

  /**
   * Get user preferences with optional filtering
   */
  async getUserPreferences(
    category?: PreferenceCategory,
    minConfidence: number = 0.3
  ): Promise<UserPreference[]> {
    try {
      const { data, error } = await supabase.rpc('get_user_preferences', {
        p_category: category,
        p_min_confidence: minConfidence
      });

      if (error) {
        console.error('Error getting user preferences:', error);
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      throw error;
    }
  }

  /**
   * Set or update a user preference
   */
  async setUserPreference(
    category: PreferenceCategory,
    key: string,
    value: Record<string, any>,
    confidence: number = 1.0,
    source: LearningSource = 'explicit_setting'
  ): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('set_user_preference', {
        p_category: category,
        p_key: key,
        p_value: value,
        p_confidence: confidence,
        p_source: source
      });

      if (error) {
        console.error('Error setting user preference:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Failed to set user preference:', error);
      throw error;
    }
  }

  /**
   * Update behavioral patterns from user interactions
   */
  async updateBehavioralPatterns(userId?: string): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const targetUserId = userId || user?.id;

      if (!targetUserId) {
        throw new Error('No user ID available');
      }

      const { data, error } = await supabase.rpc('update_user_behavioral_patterns', {
        p_user_id: targetUserId
      });

      if (error) {
        console.error('Error updating behavioral patterns:', error);
        throw new Error(error.message);
      }

      return data || 0;
    } catch (error) {
      console.error('Failed to update behavioral patterns:', error);
      throw error;
    }
  }

  /**
   * Get complete personalization profile
   */
  async getPersonalizationProfile(): Promise<PersonalizationProfile> {
    try {
      const { data, error } = await supabase.rpc('get_user_personalization_profile');

      if (error) {
        console.error('Error getting personalization profile:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Failed to get personalization profile:', error);
      throw error;
    }
  }

  /**
   * Generate preferences from behavioral patterns
   */
  async generatePreferencesFromPatterns(userId?: string): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const targetUserId = userId || user?.id;

      if (!targetUserId) {
        throw new Error('No user ID available');
      }

      const { data, error } = await supabase.rpc('generate_preferences_from_patterns', {
        p_user_id: targetUserId
      });

      if (error) {
        console.error('Error generating preferences from patterns:', error);
        throw new Error(error.message);
      }

      return data || 0;
    } catch (error) {
      console.error('Failed to generate preferences from patterns:', error);
      throw error;
    }
  }

  /**
   * Track chat message interaction
   */
  async trackChatMessage(
    message: string,
    conversationId?: string,
    responseTime?: number
  ): Promise<void> {
    const context = {
      message,
      message_length: message.length,
      contains_question: message.includes('?'),
      technical_terms: this.extractTechnicalTerms(message),
      response_time: responseTime,
      conversation_id: conversationId
    };

    await this.trackInteraction('chat_message', context);
  }

  /**
   * Track search query interaction
   */
  async trackSearchQuery(
    query: string,
    queryType: 'semantic' | 'keyword' | 'filter',
    resultsCount: number,
    selectedResult?: string
  ): Promise<void> {
    const context = {
      query,
      query_type: queryType,
      results_count: resultsCount,
      selected_result: selectedResult
    };

    await this.trackInteraction('search_query', context);
  }

  /**
   * Track UI action interaction
   */
  async trackUIAction(
    actionType: string,
    component: string,
    page: string,
    success: boolean,
    duration?: number
  ): Promise<void> {
    const context = {
      action_type: actionType,
      component,
      page,
      duration,
      success
    };

    await this.trackInteraction('ui_action', context);
  }

  /**
   * Track feature usage interaction
   */
  async trackFeatureUsage(
    featureName: string,
    usageDuration: number,
    success: boolean,
    errorEncountered?: string
  ): Promise<void> {
    const context = {
      feature_name: featureName,
      usage_duration: usageDuration,
      success,
      error_encountered: errorEncountered
    };

    await this.trackInteraction('feature_usage', context);
  }

  /**
   * Track feedback interaction
   */
  async trackFeedback(
    feedbackType: 'positive' | 'negative',
    messageId: string,
    conversationId?: string,
    comment?: string
  ): Promise<void> {
    const context = {
      feedback_type: feedbackType,
      message_id: messageId,
      conversation_id: conversationId,
      comment
    };

    await this.trackInteraction('feedback_given', context);
  }

  /**
   * Get preference with fallback to default
   */
  async getPreferenceWithDefault<T>(
    category: PreferenceCategory,
    key: string,
    defaultValue: T,
    minConfidence: number = 0.5
  ): Promise<T> {
    try {
      const preferences = await this.getUserPreferences(category, minConfidence);
      const preference = preferences.find(p => p.preference_key === key);
      
      if (preference && preference.confidence_score >= minConfidence) {
        return preference.preference_value as T;
      }
      
      return defaultValue;
    } catch (error) {
      console.warn(`Failed to get preference ${category}.${key}, using default:`, error);
      return defaultValue;
    }
  }

  /**
   * Extract technical terms from text
   */
  private extractTechnicalTerms(text: string): string[] {
    const technicalTerms = [
      'api', 'database', 'function', 'query', 'sql', 'json', 'rest', 'graphql',
      'authentication', 'authorization', 'token', 'jwt', 'oauth', 'supabase',
      'react', 'typescript', 'javascript', 'component', 'hook', 'state',
      'migration', 'schema', 'table', 'column', 'index', 'rls', 'policy'
    ];

    const lowerText = text.toLowerCase();
    return technicalTerms.filter(term => lowerText.includes(term));
  }

  /**
   * Initialize user session
   */
  initializeSession(): void {
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Track session start
    this.trackInteraction('session_activity', {
      action: 'session_start',
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
      screen_resolution: `${screen.width}x${screen.height}`
    });
  }

  /**
   * End user session
   */
  endSession(): void {
    // Track session end
    this.trackInteraction('session_activity', {
      action: 'session_end',
      timestamp: new Date().toISOString(),
      session_duration: Date.now() - parseInt(this.sessionId.split('_')[1])
    });
  }
}

// Export singleton instance
export const preferenceLearningService = new PreferenceLearningServiceImpl();
export default preferenceLearningService;
