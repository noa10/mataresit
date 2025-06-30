// Types for User Preference Learning System
// Phase 5: Personalization & Memory System - Task 1

export type PreferenceCategory = 
  | 'communication_style'
  | 'response_length'
  | 'technical_detail_level'
  | 'ui_layout'
  | 'feature_usage'
  | 'search_behavior'
  | 'content_preferences'
  | 'interaction_patterns';

export type LearningSource = 
  | 'explicit_setting'
  | 'behavioral_analysis'
  | 'feedback_pattern'
  | 'usage_frequency'
  | 'time_analysis'
  | 'interaction_style';

export type InteractionType = 
  | 'chat_message'
  | 'search_query'
  | 'ui_action'
  | 'feature_usage'
  | 'feedback_given'
  | 'preference_change'
  | 'session_activity'
  | 'error_encountered';

export type PatternType = 
  | 'communication_style'
  | 'usage_frequency'
  | 'feature_preferences'
  | 'time_patterns'
  | 'search_patterns'
  | 'response_preferences'
  | 'ui_preferences'
  | 'error_patterns';

export interface UserPreference {
  id: string;
  user_id: string;
  preference_category: PreferenceCategory;
  preference_key: string;
  preference_value: Record<string, any>;
  confidence_score: number;
  learning_source: LearningSource;
  last_updated: string;
  created_at: string;
}

export interface UserInteraction {
  id: string;
  user_id: string;
  interaction_type: InteractionType;
  interaction_context: Record<string, any>;
  interaction_metadata: Record<string, any>;
  session_id?: string;
  timestamp: string;
  created_date: string;
}

export interface BehavioralPattern {
  id: string;
  user_id: string;
  pattern_type: PatternType;
  pattern_data: Record<string, any>;
  confidence_score: number;
  sample_size: number;
  last_computed: string;
  next_computation?: string;
  created_at: string;
}

// Communication Style Patterns
export interface CommunicationStylePattern {
  total_messages: number;
  avg_message_length: number;
  question_ratio: number;
  technical_term_ratio: number;
  communication_style: 'technical' | 'inquisitive' | 'detailed' | 'concise' | 'balanced';
  preferred_response_length: 'detailed' | 'brief' | 'moderate';
  technical_level: 'advanced' | 'intermediate' | 'basic';
}

// Usage Frequency Patterns
export interface UsageFrequencyPattern {
  daily_avg_interactions: number;
  peak_hours: number[];
  most_used_features: string[];
  usage_intensity: 'high' | 'moderate' | 'low' | 'minimal';
}

// Preference Values
export interface CommunicationStylePreference {
  style: 'technical' | 'inquisitive' | 'detailed' | 'concise' | 'balanced';
}

export interface ResponseLengthPreference {
  length: 'detailed' | 'brief' | 'moderate';
}

export interface TechnicalDetailPreference {
  level: 'advanced' | 'intermediate' | 'basic';
}

export interface FeatureUsagePreference {
  features: string[];
}

export interface UILayoutPreference {
  layout: 'compact' | 'spacious' | 'minimal';
  sidebar_position: 'left' | 'right' | 'hidden';
  theme: 'light' | 'dark' | 'auto';
}

// Personalization Profile
export interface PersonalizationProfile {
  user_id: string;
  preferences: {
    [K in PreferenceCategory]?: {
      [key: string]: {
        value: Record<string, any>;
        confidence: number;
        source: LearningSource;
      };
    };
  };
  behavioral_patterns: {
    [K in PatternType]?: {
      data: Record<string, any>;
      confidence: number;
      last_computed: string;
      sample_size: number;
    };
  };
  profile_completeness: 'complete' | 'partial' | 'minimal';
  last_updated: string;
}

// Service Interfaces
export interface PreferenceLearningService {
  trackInteraction(
    type: InteractionType,
    context: Record<string, any>,
    metadata?: Record<string, any>,
    sessionId?: string
  ): Promise<string>;

  getUserPreferences(
    category?: PreferenceCategory,
    minConfidence?: number
  ): Promise<UserPreference[]>;

  setUserPreference(
    category: PreferenceCategory,
    key: string,
    value: Record<string, any>,
    confidence?: number,
    source?: LearningSource
  ): Promise<string>;

  updateBehavioralPatterns(userId?: string): Promise<number>;

  getPersonalizationProfile(): Promise<PersonalizationProfile>;

  generatePreferencesFromPatterns(userId?: string): Promise<number>;
}

// Interaction Context Types
export interface ChatMessageContext {
  message: string;
  message_length: number;
  contains_question: boolean;
  technical_terms: string[];
  response_time?: number;
  conversation_id?: string;
}

export interface SearchQueryContext {
  query: string;
  query_type: 'semantic' | 'keyword' | 'filter';
  results_count: number;
  selected_result?: string;
  refinements?: string[];
}

export interface UIActionContext {
  action_type: string;
  component: string;
  page: string;
  duration?: number;
  success: boolean;
}

export interface FeatureUsageContext {
  feature_name: string;
  usage_duration: number;
  success: boolean;
  error_encountered?: string;
}

export interface FeedbackContext {
  feedback_type: 'positive' | 'negative';
  message_id: string;
  conversation_id?: string;
  comment?: string;
}

// Adaptive Response Configuration
export interface AdaptiveResponseConfig {
  communication_style: CommunicationStylePreference;
  response_length: ResponseLengthPreference;
  technical_detail: TechnicalDetailPreference;
  include_examples: boolean;
  include_context: boolean;
  personalization_confidence: number;
}

// UI Adaptation Configuration
export interface UIAdaptationConfig {
  layout: UILayoutPreference;
  feature_visibility: Record<string, boolean>;
  component_preferences: Record<string, any>;
  adaptation_confidence: number;
}

export type PersonalizationError = 
  | 'INSUFFICIENT_DATA'
  | 'INVALID_PREFERENCE'
  | 'COMPUTATION_FAILED'
  | 'UNAUTHORIZED'
  | 'UNKNOWN_ERROR';

export interface PersonalizationResult<T = any> {
  success: boolean;
  data?: T;
  error?: PersonalizationError;
  message?: string;
  confidence?: number;
}

// ============================================================================
// CONVERSATION MEMORY TYPES
// ============================================================================

export type ContextType =
  | 'summary'
  | 'key_topics'
  | 'user_intent'
  | 'conversation_flow'
  | 'important_facts'
  | 'preferences_mentioned'
  | 'action_items'
  | 'context_window';

export type MemoryType =
  | 'user_profile'
  | 'preferences'
  | 'recurring_topics'
  | 'relationship_context'
  | 'historical_patterns'
  | 'important_events'
  | 'learning_progress'
  | 'conversation_style';

export type EmbeddingType =
  | 'conversation_summary'
  | 'key_topics'
  | 'user_intent'
  | 'message_cluster';

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  message_id: string;
  message_type: 'user' | 'ai' | 'system';
  content: string;
  content_tokens: number;
  metadata: Record<string, any>;
  parent_message_id?: string;
  timestamp: string;
  created_date: string;
}

export interface ConversationContext {
  id: string;
  conversation_id: string;
  user_id: string;
  context_type: ContextType;
  context_data: Record<string, any>;
  context_tokens: number;
  relevance_score: number;
  last_updated: string;
  expires_at?: string;
  created_at: string;
}

export interface ConversationMemory {
  id: string;
  user_id: string;
  memory_type: MemoryType;
  memory_key: string;
  memory_data: Record<string, any>;
  confidence_score: number;
  source_conversations: string[];
  last_accessed: string;
  access_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationEmbedding {
  id: string;
  conversation_id: string;
  user_id: string;
  embedding_type: EmbeddingType;
  content_text: string;
  embedding: number[];
  metadata: Record<string, any>;
  created_at: string;
}

// Context Window Types
export interface ContextWindow {
  conversation_id: string;
  messages: ConversationMessage[];
  context: Record<string, any>;
  memory: Record<string, any>;
  total_tokens: number;
  max_tokens: number;
  generated_at: string;
}

export interface CompressedContext {
  needs_compression: boolean;
  original_tokens?: number;
  compressed_tokens?: number;
  compression_ratio?: number;
  summary?: string;
  user_intents?: string[];
  key_topics?: string[];
  important_facts?: string[];
  compressed_at?: string;
  conversation_id: string;
}

// Memory Search Types
export interface MemorySearchResult {
  id: string;
  memory_type: MemoryType;
  memory_key: string;
  memory_data: Record<string, any>;
  confidence_score: number;
  relevance_score: number;
  last_accessed: string;
}

// Service Interfaces
export interface ConversationMemoryService {
  saveMessage(
    conversationId: string,
    messageId: string,
    messageType: 'user' | 'ai' | 'system',
    content: string,
    metadata?: Record<string, any>,
    parentMessageId?: string
  ): Promise<string>;

  getMessages(
    conversationId: string,
    limit?: number,
    offset?: number,
    includeMetadata?: boolean
  ): Promise<ConversationMessage[]>;

  saveContext(
    conversationId: string,
    contextType: ContextType,
    contextData: Record<string, any>,
    relevanceScore?: number,
    expiresAt?: Date
  ): Promise<string>;

  getContext(
    conversationId: string,
    contextType?: ContextType,
    minRelevance?: number
  ): Promise<ConversationContext[]>;

  saveMemory(
    memoryType: MemoryType,
    memoryKey: string,
    memoryData: Record<string, any>,
    confidenceScore?: number,
    sourceConversationId?: string
  ): Promise<string>;

  getMemory(
    memoryType?: MemoryType,
    memoryKey?: string,
    minConfidence?: number,
    limit?: number
  ): Promise<ConversationMemory[]>;

  compressContext(
    conversationId: string,
    maxTokens?: number
  ): Promise<CompressedContext>;

  getContextWindow(
    conversationId: string,
    maxTokens?: number,
    includeMemory?: boolean
  ): Promise<ContextWindow>;

  searchMemory(
    query: string,
    memoryTypes?: MemoryType[],
    minConfidence?: number,
    limit?: number
  ): Promise<MemorySearchResult[]>;

  cleanupData(): Promise<number>;
}
