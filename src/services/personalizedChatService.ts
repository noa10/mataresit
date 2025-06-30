// Personalized Chat Service
// Phase 5: Personalization & Memory System - Task 3

import { SearchResult } from '@/lib/ai-search';
import { PersonalizedResponseGenerator, PersonalizedResponseContext, PersonalizedResponse } from '@/lib/personalizedResponseGenerator';
import { preferenceLearningService } from './preferenceLearningService';
import { conversationMemoryService } from './conversationMemoryService';
import {
  PersonalizationProfile,
  AdaptiveResponseConfig,
  ConversationMemory,
  ContextWindow
} from '@/types/personalization';

export interface ChatRequest {
  query: string;
  conversationId?: string;
  sessionId?: string;
  searchResults?: SearchResult;
  includePersonalization?: boolean;
  responseStyle?: 'auto' | 'technical' | 'casual' | 'detailed' | 'concise';
}

export interface ChatResponse {
  content: string;
  personalized: boolean;
  style: string;
  confidence: number;
  personalizationApplied: string[];
  suggestedFollowUps?: string[];
  memoryReferences?: string[];
  processingTime: number;
  metadata: {
    userProfileUsed: boolean;
    memoryReferencesCount: number;
    contextWindowTokens: number;
    personalizationConfidence: number;
  };
}

export class PersonalizedChatService {
  /**
   * Generate a personalized chat response
   */
  static async generateResponse(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    const {
      query,
      conversationId,
      sessionId,
      searchResults,
      includePersonalization = true,
      responseStyle = 'auto'
    } = request;

    try {
      // Track the chat interaction
      await preferenceLearningService.trackChatMessage(
        query,
        conversationId,
        Date.now() - startTime
      );

      let personalizedResponse: PersonalizedResponse;

      if (includePersonalization) {
        // Gather personalization context
        const context = await this.gatherPersonalizationContext(
          query,
          conversationId,
          searchResults,
          responseStyle
        );

        // Generate personalized response
        personalizedResponse = PersonalizedResponseGenerator.generateResponse(context);
      } else {
        // Generate basic response without personalization
        personalizedResponse = this.generateBasicResponse(query, searchResults);
      }

      // Save response context for future learning
      if (conversationId) {
        await this.saveResponseContext(conversationId, query, personalizedResponse);
      }

      const processingTime = Date.now() - startTime;

      return {
        content: personalizedResponse.content,
        personalized: includePersonalization,
        style: personalizedResponse.style,
        confidence: personalizedResponse.confidence,
        personalizationApplied: personalizedResponse.personalizationApplied,
        suggestedFollowUps: personalizedResponse.suggestedFollowUps,
        memoryReferences: personalizedResponse.memoryReferences,
        processingTime,
        metadata: {
          userProfileUsed: includePersonalization,
          memoryReferencesCount: personalizedResponse.memoryReferences?.length || 0,
          contextWindowTokens: 0, // Will be updated with actual context window data
          personalizationConfidence: personalizedResponse.confidence
        }
      };
    } catch (error) {
      console.error('Error generating personalized response:', error);
      
      // Fallback to basic response
      const fallbackResponse = this.generateBasicResponse(query, searchResults);
      const processingTime = Date.now() - startTime;

      return {
        content: fallbackResponse.content,
        personalized: false,
        style: fallbackResponse.style,
        confidence: 0.5,
        personalizationApplied: [],
        processingTime,
        metadata: {
          userProfileUsed: false,
          memoryReferencesCount: 0,
          contextWindowTokens: 0,
          personalizationConfidence: 0.5
        }
      };
    }
  }

  /**
   * Gather all personalization context for response generation
   */
  private static async gatherPersonalizationContext(
    query: string,
    conversationId?: string,
    searchResults?: SearchResult,
    responseStyle?: string
  ): Promise<PersonalizedResponseContext> {
    const context: PersonalizedResponseContext = {
      originalQuery: query,
      searchResults
    };

    try {
      // Get user personalization profile
      const userProfile = await preferenceLearningService.getPersonalizationProfile();
      context.userProfile = userProfile;

      // Get adaptive response configuration
      const responseConfig = await this.getAdaptiveResponseConfig(userProfile, responseStyle);
      context.responseConfig = responseConfig;

      // Get conversation memory
      const conversationMemory = await conversationMemoryService.getMemory(
        undefined, // Get all memory types
        undefined, // Get all memory keys
        0.3, // Minimum confidence
        20 // Limit to 20 most relevant memories
      );
      context.conversationMemory = conversationMemory;

      // Get conversation context window if conversation ID is provided
      if (conversationId) {
        const contextWindow = await conversationMemoryService.getContextWindow(
          conversationId,
          4000, // Max tokens
          true // Include memory
        );
        context.contextWindow = contextWindow;
      }

      // Search for relevant memories based on query
      const relevantMemories = await conversationMemoryService.searchMemory(
        query,
        undefined, // All memory types
        0.4, // Higher confidence for query-specific memories
        10 // Limit to 10 most relevant
      );

      // Merge with existing conversation memory
      if (relevantMemories.length > 0) {
        const existingMemoryIds = new Set(context.conversationMemory?.map(m => m.id) || []);
        const newMemories = relevantMemories
          .filter(rm => !existingMemoryIds.has(rm.id))
          .map(rm => ({
            id: rm.id,
            user_id: '', // Will be filled by the service
            memory_type: rm.memory_type,
            memory_key: rm.memory_key,
            memory_data: rm.memory_data,
            confidence_score: rm.confidence_score,
            source_conversations: [],
            last_accessed: rm.last_accessed,
            access_count: 1,
            created_at: '',
            updated_at: ''
          }));

        context.conversationMemory = [...(context.conversationMemory || []), ...newMemories];
      }

    } catch (error) {
      console.warn('Error gathering personalization context:', error);
    }

    return context;
  }

  /**
   * Get adaptive response configuration
   */
  private static async getAdaptiveResponseConfig(
    userProfile?: PersonalizationProfile,
    responseStyle?: string
  ): Promise<AdaptiveResponseConfig> {
    // Default configuration
    let config: AdaptiveResponseConfig = {
      communication_style: { style: 'balanced' },
      response_length: { length: 'moderate' },
      technical_detail: { level: 'intermediate' },
      include_examples: true,
      include_context: true,
      personalization_confidence: 0.5
    };

    // Override with user preferences if available
    if (userProfile?.preferences) {
      const prefs = userProfile.preferences;

      if (prefs.communication_style?.preferred_style?.value?.style) {
        config.communication_style.style = prefs.communication_style.preferred_style.value.style;
      }

      if (prefs.response_length?.preferred_length?.value?.length) {
        config.response_length.length = prefs.response_length.preferred_length.value.length;
      }

      if (prefs.technical_detail_level?.preferred_level?.value?.level) {
        config.technical_detail.level = prefs.technical_detail_level.preferred_level.value.level;
      }

      // Calculate personalization confidence based on preference completeness
      const prefCount = Object.keys(prefs).length;
      config.personalization_confidence = Math.min(1.0, 0.5 + (prefCount * 0.1));
    }

    // Override with explicit response style if provided
    if (responseStyle && responseStyle !== 'auto') {
      config.communication_style.style = responseStyle as any;
    }

    return config;
  }

  /**
   * Save response context for future learning
   */
  private static async saveResponseContext(
    conversationId: string,
    query: string,
    response: PersonalizedResponse
  ): Promise<void> {
    try {
      // Save conversation context about the response
      await conversationMemoryService.saveContext(
        conversationId,
        'user_intent',
        {
          query,
          response_style: response.style,
          personalization_applied: response.personalizationApplied,
          confidence: response.confidence,
          timestamp: new Date().toISOString()
        },
        0.8 // High relevance for response context
      );

      // Update user memory with interaction patterns
      if (response.personalizationApplied.length > 0) {
        await conversationMemoryService.saveMemory(
          'interaction_patterns',
          `response_style_${response.style}`,
          {
            style: response.style,
            query_type: this.classifyQueryType(query),
            personalization_features: response.personalizationApplied,
            timestamp: new Date().toISOString()
          },
          0.7,
          conversationId
        );
      }

    } catch (error) {
      console.warn('Error saving response context:', error);
    }
  }

  /**
   * Generate basic response without personalization
   */
  private static generateBasicResponse(
    query: string,
    searchResults?: SearchResult
  ): PersonalizedResponse {
    // Use existing chat response generator as fallback
    const { generateIntelligentResponse } = require('@/lib/chat-response-generator');

    const content = searchResults
      ? generateIntelligentResponse(searchResults, query, undefined)
      : `I understand you're asking about "${query}". How can I help you with your receipts?`;

    return {
      content,
      style: 'balanced',
      confidence: 0.5,
      personalizationApplied: []
    };
  }

  /**
   * Classify query type for learning purposes
   */
  private static classifyQueryType(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('help') || lowerQuery.includes('how')) {
      return 'help_request';
    }
    if (lowerQuery.includes('find') || lowerQuery.includes('search')) {
      return 'search_request';
    }
    if (lowerQuery.includes('analyze') || lowerQuery.includes('report')) {
      return 'analysis_request';
    }
    if (lowerQuery.includes('hello') || lowerQuery.includes('hi')) {
      return 'greeting';
    }
    
    return 'general_query';
  }

  /**
   * Learn from user feedback on responses
   */
  static async learnFromFeedback(
    conversationId: string,
    messageId: string,
    feedback: 'positive' | 'negative',
    comment?: string
  ): Promise<void> {
    try {
      // Track feedback interaction
      await preferenceLearningService.trackFeedback(
        feedback,
        messageId,
        conversationId,
        comment
      );

      // Update conversation memory based on feedback
      await conversationMemoryService.saveMemory(
        'learning_progress',
        `feedback_${feedback}_${Date.now()}`,
        {
          message_id: messageId,
          feedback_type: feedback,
          comment,
          timestamp: new Date().toISOString()
        },
        feedback === 'positive' ? 0.8 : 0.6,
        conversationId
      );

    } catch (error) {
      console.error('Error learning from feedback:', error);
    }
  }

  /**
   * Get personalization statistics
   */
  static async getPersonalizationStats(): Promise<{
    profileCompleteness: string;
    memoryCount: number;
    preferencesCount: number;
    averageConfidence: number;
  }> {
    try {
      const profile = await preferenceLearningService.getPersonalizationProfile();
      const memory = await conversationMemoryService.getMemory();

      const preferencesCount = profile ? Object.keys(profile.preferences).length : 0;
      const memoryCount = memory.length;
      
      const avgConfidence = memory.length > 0 
        ? memory.reduce((sum, m) => sum + m.confidence_score, 0) / memory.length
        : 0;

      return {
        profileCompleteness: profile?.profile_completeness || 'minimal',
        memoryCount,
        preferencesCount,
        averageConfidence: avgConfidence
      };
    } catch (error) {
      console.error('Error getting personalization stats:', error);
      return {
        profileCompleteness: 'minimal',
        memoryCount: 0,
        preferencesCount: 0,
        averageConfidence: 0
      };
    }
  }
}

// Create a singleton instance for easy importing
export const personalizedChatService = {
  generatePersonalizedResponse: async (
    query: string,
    searchResults: SearchResult,
    conversationId?: string
  ): Promise<string> => {
    const response = await PersonalizedChatService.generateResponse({
      query,
      searchResults,
      conversationId,
      includePersonalization: true,
      responseStyle: 'auto'
    });
    return response.content;
  },

  generateResponse: PersonalizedChatService.generateResponse.bind(PersonalizedChatService),
  getPersonalizationStats: PersonalizedChatService.getPersonalizationStats.bind(PersonalizedChatService),
  learnFromFeedback: PersonalizedChatService.learnFromFeedback.bind(PersonalizedChatService)
};

export default PersonalizedChatService;
