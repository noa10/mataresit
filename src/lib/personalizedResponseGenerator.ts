// Personalized Response Generation Engine
// Phase 5: Personalization & Memory System - Task 3

import { SearchResult } from './ai-search';
import { ExtractedKeywords, extractKeywords, detectUserIntent } from './chat-response-generator';
import {
  PersonalizationProfile,
  AdaptiveResponseConfig,
  ConversationMemory,
  ContextWindow
} from '@/types/personalization';

export interface PersonalizedResponseContext {
  originalQuery: string;
  searchResults?: SearchResult;
  userProfile?: PersonalizationProfile;
  conversationMemory?: ConversationMemory[];
  contextWindow?: ContextWindow;
  responseConfig?: AdaptiveResponseConfig;
  sessionContext?: Record<string, any>;
}

export interface PersonalizedResponse {
  content: string;
  style: 'technical' | 'casual' | 'detailed' | 'concise' | 'balanced';
  confidence: number;
  personalizationApplied: string[];
  suggestedFollowUps?: string[];
  memoryReferences?: string[];
}

export class PersonalizedResponseGenerator {
  /**
   * Generate a personalized response based on user profile and context
   */
  static generateResponse(context: PersonalizedResponseContext): PersonalizedResponse {
    const {
      originalQuery,
      searchResults,
      userProfile,
      conversationMemory,
      contextWindow,
      responseConfig,
      sessionContext
    } = context;

    // Extract keywords and detect intent
    const keywords = extractKeywords(originalQuery);
    const intentCheck = detectUserIntent(originalQuery);

    // Determine base response style from user preferences
    const baseStyle = this.determineResponseStyle(responseConfig, userProfile);
    
    // Generate base response content
    let baseContent = '';
    const personalizationApplied: string[] = [];

    // Handle special intents first
    if (intentCheck.intent !== 'search' && intentCheck.response) {
      baseContent = this.personalizeIntentResponse(
        intentCheck.response,
        intentCheck.intent,
        userProfile,
        conversationMemory
      );
      personalizationApplied.push('intent_personalization');
    } else if (!searchResults?.results || searchResults.results.length === 0) {
      baseContent = this.generatePersonalizedNotFound(keywords, userProfile, conversationMemory);
      personalizationApplied.push('not_found_personalization');
    } else {
      baseContent = this.generatePersonalizedSuccess(searchResults, keywords, userProfile, conversationMemory);
      personalizationApplied.push('success_personalization');
    }

    // Apply style adaptations
    const styledContent = this.applyStyleAdaptations(
      baseContent,
      baseStyle,
      responseConfig,
      userProfile
    );
    if (styledContent !== baseContent) {
      personalizationApplied.push('style_adaptation');
    }

    // Add contextual enhancements
    const enhancedContent = this.addContextualEnhancements(
      styledContent,
      conversationMemory,
      contextWindow,
      userProfile
    );
    if (enhancedContent !== styledContent) {
      personalizationApplied.push('contextual_enhancement');
    }

    // Generate follow-up suggestions
    const followUps = this.generatePersonalizedFollowUps(
      keywords,
      searchResults,
      userProfile,
      conversationMemory
    );

    // Extract memory references
    const memoryReferences = this.extractMemoryReferences(conversationMemory, originalQuery);

    // Calculate confidence based on personalization data availability
    const confidence = this.calculatePersonalizationConfidence(
      userProfile,
      conversationMemory,
      responseConfig
    );

    return {
      content: enhancedContent,
      style: baseStyle,
      confidence,
      personalizationApplied,
      suggestedFollowUps: followUps,
      memoryReferences
    };
  }

  /**
   * Determine response style based on user preferences and patterns
   */
  private static determineResponseStyle(
    responseConfig?: AdaptiveResponseConfig,
    userProfile?: PersonalizationProfile
  ): 'technical' | 'casual' | 'detailed' | 'concise' | 'balanced' {
    // Use adaptive response config if available
    if (responseConfig?.communication_style?.style) {
      const style = responseConfig.communication_style.style;
      if (['technical', 'detailed', 'concise'].includes(style)) {
        return style as any;
      }
    }

    // Fall back to user profile preferences
    if (userProfile?.preferences?.communication_style?.preferred_style) {
      const prefStyle = userProfile.preferences.communication_style.preferred_style.value?.style;
      if (prefStyle && ['technical', 'detailed', 'concise'].includes(prefStyle)) {
        return prefStyle;
      }
    }

    // Check behavioral patterns
    if (userProfile?.behavioral_patterns?.communication_style?.data) {
      const pattern = userProfile.behavioral_patterns.communication_style.data;
      if (pattern.communication_style) {
        return pattern.communication_style === 'balanced' ? 'casual' : pattern.communication_style;
      }
    }

    return 'balanced';
  }

  /**
   * Personalize intent-based responses (help, greeting, etc.)
   */
  private static personalizeIntentResponse(
    baseResponse: string,
    intent: string,
    userProfile?: PersonalizationProfile,
    conversationMemory?: ConversationMemory[]
  ): string {
    let personalizedResponse = baseResponse;

    // Add user-specific context for help responses
    if (intent === 'help' && userProfile) {
      const usagePatterns = userProfile.behavioral_patterns?.usage_frequency?.data;
      if (usagePatterns?.most_used_features) {
        const features = usagePatterns.most_used_features.slice(0, 3);
        personalizedResponse += `\n\nBased on your usage patterns, you might also be interested in:\n${features.map(f => `• ${this.formatFeatureName(f)}`).join('\n')}`;
      }
    }

    // Add personalized greeting based on usage patterns
    if (intent === 'greeting' && userProfile) {
      const timePatterns = userProfile.behavioral_patterns?.time_patterns?.data;
      if (timePatterns?.peak_hours) {
        const currentHour = new Date().getHours();
        const isPeakTime = timePatterns.peak_hours.includes(currentHour);
        if (isPeakTime) {
          personalizedResponse = personalizedResponse.replace(
            'Hello!',
            'Hello! I see you\'re active at your usual time.'
          );
        }
      }
    }

    return personalizedResponse;
  }

  /**
   * Generate personalized "not found" responses
   */
  private static generatePersonalizedNotFound(
    keywords: ExtractedKeywords,
    userProfile?: PersonalizationProfile,
    conversationMemory?: ConversationMemory[]
  ): string {
    const { primaryTerms, queryType } = keywords;
    const mainTerm = primaryTerms.length > 0 ? primaryTerms.join(' ') : keywords.originalQuery;

    let response = `I couldn't find any receipts matching "${mainTerm}".`;

    // Add personalized suggestions based on user's past searches
    const searchMemory = conversationMemory?.filter(m => 
      m.memory_type === 'recurring_topics' || m.memory_type === 'preferences'
    );

    if (searchMemory && searchMemory.length > 0) {
      const commonTopics = searchMemory
        .map(m => m.memory_key)
        .filter(key => key.includes('search') || key.includes('topic'))
        .slice(0, 3);

      if (commonTopics.length > 0) {
        response += ` Based on your search history, you might want to try: ${commonTopics.map(topic => `"${this.formatSearchTopic(topic)}"`).join(', ')}.`;
      }
    }

    // Add style-specific suggestions
    const style = this.determineResponseStyle(undefined, userProfile);
    if (style === 'technical') {
      response += ' You can also try using more specific search terms or check the exact spelling.';
    } else if (style === 'detailed') {
      response += ' Here are some tips to improve your search: try broader terms, check spelling, or search by store name or category.';
    }

    return response;
  }

  /**
   * Generate personalized success responses
   */
  private static generatePersonalizedSuccess(
    searchResults: SearchResult,
    keywords: ExtractedKeywords,
    userProfile?: PersonalizationProfile,
    conversationMemory?: ConversationMemory[]
  ): string {
    const resultCount = searchResults.results?.length || 0;
    const { primaryTerms } = keywords;
    const searchTerm = primaryTerms.join(' ') || keywords.originalQuery;

    let response = `I found ${resultCount} receipt${resultCount !== 1 ? 's' : ''} matching "${searchTerm}".`;

    // Add personalized insights based on user patterns
    if (userProfile?.behavioral_patterns?.search_patterns?.data) {
      const searchPatterns = userProfile.behavioral_patterns.search_patterns.data;
      if (searchPatterns.frequent_searches?.includes(searchTerm)) {
        response += ' This is one of your frequently searched items.';
      }
    }

    // Add memory-based context
    const relevantMemory = conversationMemory?.find(m => 
      m.memory_key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(m.memory_data).toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (relevantMemory) {
      response += ` I remember you've searched for this before.`;
    }

    return response;
  }

  /**
   * Apply style adaptations based on user preferences
   */
  private static applyStyleAdaptations(
    content: string,
    style: string,
    responseConfig?: AdaptiveResponseConfig,
    userProfile?: PersonalizationProfile
  ): string {
    let adaptedContent = content;

    switch (style) {
      case 'technical':
        // Add technical details and precise language
        adaptedContent = this.makeTechnical(adaptedContent);
        break;
      case 'concise':
        // Shorten and simplify
        adaptedContent = this.makeConcise(adaptedContent);
        break;
      case 'detailed':
        // Add explanations and context
        adaptedContent = this.makeDetailed(adaptedContent, responseConfig);
        break;
      case 'casual':
        // Make more conversational
        adaptedContent = this.makeCasual(adaptedContent);
        break;
    }

    return adaptedContent;
  }

  /**
   * Add contextual enhancements based on conversation memory
   */
  private static addContextualEnhancements(
    content: string,
    conversationMemory?: ConversationMemory[],
    contextWindow?: ContextWindow,
    userProfile?: PersonalizationProfile
  ): string {
    let enhancedContent = content;

    // Add relevant context from memory
    if (conversationMemory && conversationMemory.length > 0) {
      const recentMemory = conversationMemory
        .filter(m => m.confidence_score > 0.7)
        .slice(0, 2);

      if (recentMemory.length > 0) {
        // Add subtle memory references without being intrusive
        const memoryContext = recentMemory
          .map(m => this.formatMemoryContext(m))
          .filter(Boolean)
          .join(' ');

        if (memoryContext) {
          enhancedContent += ` ${memoryContext}`;
        }
      }
    }

    return enhancedContent;
  }

  /**
   * Generate personalized follow-up suggestions
   */
  private static generatePersonalizedFollowUps(
    keywords: ExtractedKeywords,
    searchResults?: SearchResult,
    userProfile?: PersonalizationProfile,
    conversationMemory?: ConversationMemory[]
  ): string[] {
    const followUps: string[] = [];

    // Based on query type
    switch (keywords.queryType) {
      case 'merchant':
        followUps.push('Show me spending trends for this merchant');
        followUps.push('Find similar stores in my receipts');
        break;
      case 'category':
        followUps.push('Analyze my spending in this category');
        followUps.push('Compare this month vs last month');
        break;
      case 'item':
        followUps.push('Find where I buy this item most often');
        followUps.push('Show price trends for this item');
        break;
    }

    // Based on user patterns
    if (userProfile?.behavioral_patterns?.feature_preferences?.data) {
      const preferredFeatures = userProfile.behavioral_patterns.feature_preferences.data.most_used_features;
      if (preferredFeatures?.includes('analysis')) {
        followUps.push('Create a detailed analysis report');
      }
      if (preferredFeatures?.includes('export')) {
        followUps.push('Export these results to PDF');
      }
    }

    return followUps.slice(0, 3); // Limit to 3 suggestions
  }

  /**
   * Extract relevant memory references
   */
  private static extractMemoryReferences(
    conversationMemory?: ConversationMemory[],
    query?: string
  ): string[] {
    if (!conversationMemory || !query) return [];

    const queryLower = query.toLowerCase();
    return conversationMemory
      .filter(m => 
        m.memory_key.toLowerCase().includes(queryLower) ||
        JSON.stringify(m.memory_data).toLowerCase().includes(queryLower)
      )
      .map(m => m.memory_key)
      .slice(0, 3);
  }

  /**
   * Calculate personalization confidence
   */
  private static calculatePersonalizationConfidence(
    userProfile?: PersonalizationProfile,
    conversationMemory?: ConversationMemory[],
    responseConfig?: AdaptiveResponseConfig
  ): number {
    let confidence = 0.5; // Base confidence

    if (userProfile) {
      confidence += 0.2;
      
      if (userProfile.profile_completeness === 'complete') {
        confidence += 0.2;
      } else if (userProfile.profile_completeness === 'partial') {
        confidence += 0.1;
      }
    }

    if (conversationMemory && conversationMemory.length > 0) {
      confidence += Math.min(0.2, conversationMemory.length * 0.05);
    }

    if (responseConfig && responseConfig.personalization_confidence > 0.5) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  // Helper methods for style adaptations
  private static makeTechnical(content: string): string {
    return content
      .replace(/I found/g, 'Query returned')
      .replace(/receipts?/g, 'transaction records')
      .replace(/matching/g, 'that match the specified criteria');
  }

  private static makeConcise(content: string): string {
    return content
      .replace(/I couldn't find any receipts matching/g, 'No results for')
      .replace(/\. Here are some tips.*$/g, '.')
      .replace(/\. Based on.*$/g, '.');
  }

  private static makeDetailed(content: string, responseConfig?: AdaptiveResponseConfig): string {
    if (responseConfig?.include_context) {
      return content + ' Would you like me to provide more details about any of these results?';
    }
    return content;
  }

  private static makeCasual(content: string): string {
    return content
      .replace(/I found/g, 'Found')
      .replace(/I couldn't find/g, 'Couldn\'t find')
      .replace(/You can also try/g, 'You might want to try');
  }

  // Helper formatting methods
  private static formatFeatureName(feature: string): string {
    return feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private static formatSearchTopic(topic: string): string {
    return topic.replace(/search_|topic_/g, '').replace(/_/g, ' ');
  }

  private static formatMemoryContext(memory: ConversationMemory): string {
    if (memory.memory_type === 'preferences' && memory.confidence_score > 0.8) {
      return `(I remember your preference for ${memory.memory_key})`;
    }
    return '';
  }
}
