// React Hook for Personalized Chat
// Phase 5: Personalization & Memory System - Task 3

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PersonalizedChatService, ChatRequest, ChatResponse } from '@/services/personalizedChatService';
import { SearchResult } from '@/lib/ai-search';

interface UsePersonalizedChatOptions {
  conversationId?: string;
  enablePersonalization?: boolean;
  defaultResponseStyle?: 'auto' | 'technical' | 'casual' | 'detailed' | 'concise';
  autoLearnFromInteractions?: boolean;
}

interface PersonalizedChatState {
  loading: boolean;
  error: string | null;
  lastResponse: ChatResponse | null;
  personalizationStats: {
    profileCompleteness: string;
    memoryCount: number;
    preferencesCount: number;
    averageConfidence: number;
  } | null;
}

export function usePersonalizedChat(options: UsePersonalizedChatOptions = {}) {
  const {
    conversationId,
    enablePersonalization = true,
    defaultResponseStyle = 'auto',
    autoLearnFromInteractions = true
  } = options;

  const { user } = useAuth();
  const [state, setState] = useState<PersonalizedChatState>({
    loading: false,
    error: null,
    lastResponse: null,
    personalizationStats: null
  });

  const sessionIdRef = useRef<string>();

  // Generate session ID if not exists
  if (!sessionIdRef.current) {
    sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a personalized chat response
   */
  const generateResponse = useCallback(async (
    query: string,
    searchResults?: SearchResult,
    responseStyle?: 'auto' | 'technical' | 'casual' | 'detailed' | 'concise'
  ): Promise<ChatResponse | null> => {
    if (!user) {
      setState(prev => ({
        ...prev,
        error: 'User not authenticated'
      }));
      return null;
    }

    setState(prev => ({
      ...prev,
      loading: true,
      error: null
    }));

    try {
      const request: ChatRequest = {
        query,
        conversationId,
        sessionId: sessionIdRef.current,
        searchResults,
        includePersonalization: enablePersonalization,
        responseStyle: responseStyle || defaultResponseStyle
      };

      const response = await PersonalizedChatService.generateResponse(request);

      setState(prev => ({
        ...prev,
        loading: false,
        lastResponse: response
      }));

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate response';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
      return null;
    }
  }, [user, conversationId, enablePersonalization, defaultResponseStyle]);

  /**
   * Provide feedback on a response
   */
  const provideFeedback = useCallback(async (
    messageId: string,
    feedback: 'positive' | 'negative',
    comment?: string
  ): Promise<boolean> => {
    if (!user || !conversationId) {
      return false;
    }

    try {
      await PersonalizedChatService.learnFromFeedback(
        conversationId,
        messageId,
        feedback,
        comment
      );
      return true;
    } catch (error) {
      console.error('Error providing feedback:', error);
      return false;
    }
  }, [user, conversationId]);

  /**
   * Load personalization statistics
   */
  const loadPersonalizationStats = useCallback(async () => {
    if (!user) return;

    try {
      const stats = await PersonalizedChatService.getPersonalizationStats();
      setState(prev => ({
        ...prev,
        personalizationStats: stats
      }));
    } catch (error) {
      console.warn('Error loading personalization stats:', error);
    }
  }, [user]);

  /**
   * Generate response with automatic learning
   */
  const generateResponseWithLearning = useCallback(async (
    query: string,
    searchResults?: SearchResult,
    responseStyle?: 'auto' | 'technical' | 'casual' | 'detailed' | 'concise'
  ): Promise<ChatResponse | null> => {
    const response = await generateResponse(query, searchResults, responseStyle);
    
    if (response && autoLearnFromInteractions) {
      // Automatically learn from successful interactions
      if (response.confidence > 0.7 && response.personalizationApplied.length > 0) {
        // This was a successful personalized response, learn from it
        setTimeout(() => {
          loadPersonalizationStats();
        }, 1000);
      }
    }

    return response;
  }, [generateResponse, autoLearnFromInteractions, loadPersonalizationStats]);

  /**
   * Test different response styles
   */
  const testResponseStyles = useCallback(async (
    query: string,
    searchResults?: SearchResult
  ): Promise<Record<string, ChatResponse>> => {
    if (!user) return {};

    const styles: Array<'technical' | 'casual' | 'detailed' | 'concise'> = [
      'technical', 'casual', 'detailed', 'concise'
    ];

    const results: Record<string, ChatResponse> = {};

    for (const style of styles) {
      try {
        const response = await generateResponse(query, searchResults, style);
        if (response) {
          results[style] = response;
        }
      } catch (error) {
        console.warn(`Error testing ${style} style:`, error);
      }
    }

    return results;
  }, [user, generateResponse]);

  /**
   * Get response quality metrics
   */
  const getResponseQualityMetrics = useCallback((response: ChatResponse) => {
    const metrics = {
      personalizationScore: response.confidence,
      responseLength: response.content.length,
      personalizationFeaturesUsed: response.personalizationApplied.length,
      memoryReferencesUsed: response.memoryReferences?.length || 0,
      processingTime: response.processingTime,
      hasFollowUps: (response.suggestedFollowUps?.length || 0) > 0,
      qualityRating: calculateQualityRating(response)
    };

    return metrics;
  }, []);

  /**
   * Calculate overall quality rating
   */
  const calculateQualityRating = useCallback((response: ChatResponse): 'excellent' | 'good' | 'fair' | 'poor' => {
    let score = 0;

    // Personalization confidence (40% weight)
    score += response.confidence * 0.4;

    // Personalization features used (30% weight)
    score += Math.min(1, response.personalizationApplied.length / 3) * 0.3;

    // Memory references (20% weight)
    score += Math.min(1, (response.memoryReferences?.length || 0) / 2) * 0.2;

    // Processing efficiency (10% weight)
    const processingScore = response.processingTime < 1000 ? 1 : Math.max(0, 1 - (response.processingTime - 1000) / 2000);
    score += processingScore * 0.1;

    if (score >= 0.8) return 'excellent';
    if (score >= 0.6) return 'good';
    if (score >= 0.4) return 'fair';
    return 'poor';
  }, []);

  /**
   * Get personalization insights
   */
  const getPersonalizationInsights = useCallback(() => {
    if (!state.lastResponse || !state.personalizationStats) {
      return null;
    }

    const response = state.lastResponse;
    const stats = state.personalizationStats;

    return {
      profileMaturity: stats.profileCompleteness,
      memoryUtilization: stats.memoryCount > 0 ? 'active' : 'minimal',
      personalizationEffectiveness: response.confidence > 0.7 ? 'high' : response.confidence > 0.5 ? 'medium' : 'low',
      recommendedImprovements: this.getRecommendedImprovements(response, stats)
    };
  }, [state.lastResponse, state.personalizationStats]);

  /**
   * Get recommended improvements
   */
  const getRecommendedImprovements = useCallback((
    response: ChatResponse,
    stats: { profileCompleteness: string; memoryCount: number; preferencesCount: number }
  ): string[] => {
    const improvements: string[] = [];

    if (stats.profileCompleteness === 'minimal') {
      improvements.push('Complete your user profile for better personalization');
    }

    if (stats.preferencesCount < 3) {
      improvements.push('Set more preferences to improve response quality');
    }

    if (stats.memoryCount < 5) {
      improvements.push('Continue chatting to build conversation memory');
    }

    if (response.confidence < 0.6) {
      improvements.push('Provide feedback on responses to improve accuracy');
    }

    if (response.personalizationApplied.length === 0) {
      improvements.push('Enable personalization features for better responses');
    }

    return improvements;
  }, []);

  return {
    // State
    loading: state.loading,
    error: state.error,
    lastResponse: state.lastResponse,
    personalizationStats: state.personalizationStats,

    // Actions
    generateResponse: generateResponseWithLearning,
    provideFeedback,
    loadPersonalizationStats,
    testResponseStyles,

    // Utilities
    getResponseQualityMetrics,
    getPersonalizationInsights,
    
    // Configuration
    sessionId: sessionIdRef.current,
    isPersonalizationEnabled: enablePersonalization,
    currentResponseStyle: defaultResponseStyle,

    // Computed properties
    hasPersonalizationData: (state.personalizationStats?.preferencesCount || 0) > 0,
    personalizationMaturity: state.personalizationStats?.profileCompleteness || 'minimal',
    averageResponseQuality: state.lastResponse ? calculateQualityRating(state.lastResponse) : 'fair'
  };
}
