// Conversation Memory Service
// Phase 5: Personalization & Memory System - Task 2

import { supabase } from '@/lib/supabase';
import {
  ConversationMemoryService,
  ConversationMessage,
  ConversationContext,
  ConversationMemory,
  ContextWindow,
  CompressedContext,
  MemorySearchResult,
  ContextType,
  MemoryType
} from '@/types/personalization';

class ConversationMemoryServiceImpl implements ConversationMemoryService {
  /**
   * Save a conversation message
   */
  async saveMessage(
    conversationId: string,
    messageId: string,
    messageType: 'user' | 'ai' | 'system',
    content: string,
    metadata: Record<string, any> = {},
    parentMessageId?: string
  ): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('save_conversation_message', {
        p_conversation_id: conversationId,
        p_message_id: messageId,
        p_message_type: messageType,
        p_content: content,
        p_metadata: metadata,
        p_parent_message_id: parentMessageId
      });

      if (error) {
        console.error('Error saving conversation message:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Failed to save conversation message:', error);
      throw error;
    }
  }

  /**
   * Get conversation messages with pagination
   */
  async getMessages(
    conversationId: string,
    limit: number = 50,
    offset: number = 0,
    includeMetadata: boolean = true
  ): Promise<ConversationMessage[]> {
    try {
      const { data, error } = await supabase.rpc('get_conversation_messages', {
        p_conversation_id: conversationId,
        p_limit: limit,
        p_offset: offset,
        p_include_metadata: includeMetadata
      });

      if (error) {
        console.error('Error getting conversation messages:', error);
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get conversation messages:', error);
      throw error;
    }
  }

  /**
   * Save conversation context
   */
  async saveContext(
    conversationId: string,
    contextType: ContextType,
    contextData: Record<string, any>,
    relevanceScore: number = 1.0,
    expiresAt?: Date
  ): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('save_conversation_context', {
        p_conversation_id: conversationId,
        p_context_type: contextType,
        p_context_data: contextData,
        p_relevance_score: relevanceScore,
        p_expires_at: expiresAt?.toISOString()
      });

      if (error) {
        console.error('Error saving conversation context:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Failed to save conversation context:', error);
      throw error;
    }
  }

  /**
   * Get conversation context
   */
  async getContext(
    conversationId: string,
    contextType?: ContextType,
    minRelevance: number = 0.3
  ): Promise<ConversationContext[]> {
    try {
      const { data, error } = await supabase.rpc('get_conversation_context', {
        p_conversation_id: conversationId,
        p_context_type: contextType,
        p_min_relevance: minRelevance
      });

      if (error) {
        console.error('Error getting conversation context:', error);
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get conversation context:', error);
      throw error;
    }
  }

  /**
   * Save conversation memory
   */
  async saveMemory(
    memoryType: MemoryType,
    memoryKey: string,
    memoryData: Record<string, any>,
    confidenceScore: number = 0.5,
    sourceConversationId?: string
  ): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('save_conversation_memory', {
        p_memory_type: memoryType,
        p_memory_key: memoryKey,
        p_memory_data: memoryData,
        p_confidence_score: confidenceScore,
        p_source_conversation_id: sourceConversationId
      });

      if (error) {
        console.error('Error saving conversation memory:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Failed to save conversation memory:', error);
      throw error;
    }
  }

  /**
   * Get conversation memory
   */
  async getMemory(
    memoryType?: MemoryType,
    memoryKey?: string,
    minConfidence: number = 0.3,
    limit: number = 50
  ): Promise<ConversationMemory[]> {
    try {
      const { data, error } = await supabase.rpc('get_conversation_memory', {
        p_memory_type: memoryType,
        p_memory_key: memoryKey,
        p_min_confidence: minConfidence,
        p_limit: limit
      });

      if (error) {
        console.error('Error getting conversation memory:', error);
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get conversation memory:', error);
      throw error;
    }
  }

  /**
   * Compress conversation context when token limit is exceeded
   */
  async compressContext(
    conversationId: string,
    maxTokens: number = 2000
  ): Promise<CompressedContext> {
    try {
      const { data, error } = await supabase.rpc('compress_conversation_context', {
        p_conversation_id: conversationId,
        p_max_tokens: maxTokens
      });

      if (error) {
        console.error('Error compressing conversation context:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Failed to compress conversation context:', error);
      throw error;
    }
  }

  /**
   * Get complete conversation context window for AI processing
   */
  async getContextWindow(
    conversationId: string,
    maxTokens: number = 4000,
    includeMemory: boolean = true
  ): Promise<ContextWindow> {
    try {
      const { data, error } = await supabase.rpc('get_conversation_context_window', {
        p_conversation_id: conversationId,
        p_max_tokens: maxTokens,
        p_include_memory: includeMemory
      });

      if (error) {
        console.error('Error getting conversation context window:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Failed to get conversation context window:', error);
      throw error;
    }
  }

  /**
   * Search conversation memory
   */
  async searchMemory(
    query: string,
    memoryTypes?: MemoryType[],
    minConfidence: number = 0.3,
    limit: number = 20
  ): Promise<MemorySearchResult[]> {
    try {
      const { data, error } = await supabase.rpc('search_conversation_memory', {
        p_query: query,
        p_memory_types: memoryTypes,
        p_min_confidence: minConfidence,
        p_limit: limit
      });

      if (error) {
        console.error('Error searching conversation memory:', error);
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to search conversation memory:', error);
      throw error;
    }
  }

  /**
   * Clean up expired context and old conversation data
   */
  async cleanupData(): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('cleanup_conversation_data');

      if (error) {
        console.error('Error cleaning up conversation data:', error);
        throw new Error(error.message);
      }

      return data || 0;
    } catch (error) {
      console.error('Failed to cleanup conversation data:', error);
      throw error;
    }
  }

  /**
   * Auto-save conversation summary
   */
  async autoSaveSummary(
    conversationId: string,
    messages: ConversationMessage[]
  ): Promise<void> {
    if (messages.length < 3) return; // Need at least a few messages to summarize

    try {
      // Extract key information from messages
      const userMessages = messages.filter(m => m.message_type === 'user');
      const aiMessages = messages.filter(m => m.message_type === 'ai');
      
      const summary = {
        message_count: messages.length,
        user_message_count: userMessages.length,
        ai_message_count: aiMessages.length,
        first_user_message: userMessages[0]?.content?.substring(0, 100),
        last_user_message: userMessages[userMessages.length - 1]?.content?.substring(0, 100),
        conversation_length: messages[messages.length - 1]?.timestamp,
        topics_discussed: this.extractTopics(messages),
        user_intents: this.extractUserIntents(userMessages)
      };

      await this.saveContext(conversationId, 'summary', summary, 0.8);
    } catch (error) {
      console.warn('Failed to auto-save conversation summary:', error);
    }
  }

  /**
   * Extract topics from conversation messages
   */
  private extractTopics(messages: ConversationMessage[]): string[] {
    const topics: string[] = [];
    const topicKeywords = [
      'receipt', 'expense', 'budget', 'spending', 'merchant', 'category',
      'analysis', 'report', 'search', 'upload', 'claim', 'team', 'invoice'
    ];

    messages.forEach(message => {
      const content = message.content.toLowerCase();
      topicKeywords.forEach(keyword => {
        if (content.includes(keyword) && !topics.includes(keyword)) {
          topics.push(keyword);
        }
      });
    });

    return topics.slice(0, 10); // Limit to top 10 topics
  }

  /**
   * Extract user intents from user messages
   */
  private extractUserIntents(userMessages: ConversationMessage[]): string[] {
    const intents: string[] = [];
    
    userMessages.forEach(message => {
      const content = message.content.toLowerCase();
      
      if (content.includes('?')) {
        intents.push('asking_question');
      }
      if (content.includes('help') || content.includes('how')) {
        intents.push('seeking_help');
      }
      if (content.includes('show') || content.includes('find') || content.includes('search')) {
        intents.push('requesting_information');
      }
      if (content.includes('create') || content.includes('add') || content.includes('upload')) {
        intents.push('creating_content');
      }
      if (content.includes('analyze') || content.includes('report') || content.includes('summary')) {
        intents.push('requesting_analysis');
      }
    });

    return [...new Set(intents)]; // Remove duplicates
  }
}

// Export singleton instance
export const conversationMemoryService = new ConversationMemoryServiceImpl();
export default conversationMemoryService;
