// React Hook for Conversation Memory Management
// Phase 5: Personalization & Memory System - Task 2

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { conversationMemoryService } from '@/services/conversationMemoryService';
import {
  ConversationMessage,
  ConversationContext,
  ConversationMemory,
  ContextWindow,
  CompressedContext,
  MemorySearchResult,
  ContextType,
  MemoryType
} from '@/types/personalization';

interface UseConversationMemoryOptions {
  conversationId?: string;
  autoSave?: boolean;
  maxTokens?: number;
  compressionThreshold?: number;
}

interface ConversationMemoryState {
  messages: ConversationMessage[];
  context: ConversationContext[];
  memory: ConversationMemory[];
  contextWindow: ContextWindow | null;
  compressedContext: CompressedContext | null;
  loading: boolean;
  error: string | null;
}

export function useConversationMemory(options: UseConversationMemoryOptions = {}) {
  const {
    conversationId,
    autoSave = true,
    maxTokens = 4000,
    compressionThreshold = 8000
  } = options;

  const { user } = useAuth();
  const [state, setState] = useState<ConversationMemoryState>({
    messages: [],
    context: [],
    memory: [],
    contextWindow: null,
    compressedContext: null,
    loading: false,
    error: null
  });

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSavedMessageCount = useRef(0);

  /**
   * Load conversation messages
   */
  const loadMessages = useCallback(async (
    limit: number = 50,
    offset: number = 0
  ) => {
    if (!conversationId || !user) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const messages = await conversationMemoryService.getMessages(
        conversationId,
        limit,
        offset
      );

      setState(prev => ({
        ...prev,
        messages,
        loading: false
      }));

      return messages;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load messages';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
      throw error;
    }
  }, [conversationId, user]);

  /**
   * Save a new message
   */
  const saveMessage = useCallback(async (
    messageId: string,
    messageType: 'user' | 'ai' | 'system',
    content: string,
    metadata: Record<string, any> = {},
    parentMessageId?: string
  ) => {
    if (!conversationId || !user) return;

    try {
      const savedMessageId = await conversationMemoryService.saveMessage(
        conversationId,
        messageId,
        messageType,
        content,
        metadata,
        parentMessageId
      );

      // Add message to local state
      const newMessage: ConversationMessage = {
        id: savedMessageId,
        conversation_id: conversationId,
        user_id: user.id,
        message_id: messageId,
        message_type: messageType,
        content,
        content_tokens: Math.ceil(content.length / 4), // Rough estimate
        metadata,
        parent_message_id: parentMessageId,
        timestamp: new Date().toISOString(),
        created_date: new Date().toISOString().split('T')[0]
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, newMessage]
      }));

      // Trigger auto-save summary if enabled
      if (autoSave) {
        triggerAutoSave();
      }

      return savedMessageId;
    } catch (error) {
      console.error('Failed to save message:', error);
      throw error;
    }
  }, [conversationId, user, autoSave]);

  /**
   * Load conversation context
   */
  const loadContext = useCallback(async (
    contextType?: ContextType,
    minRelevance: number = 0.3
  ) => {
    if (!conversationId || !user) return;

    try {
      const context = await conversationMemoryService.getContext(
        conversationId,
        contextType,
        minRelevance
      );

      setState(prev => ({
        ...prev,
        context
      }));

      return context;
    } catch (error) {
      console.error('Failed to load context:', error);
      throw error;
    }
  }, [conversationId, user]);

  /**
   * Save conversation context
   */
  const saveContext = useCallback(async (
    contextType: ContextType,
    contextData: Record<string, any>,
    relevanceScore: number = 1.0,
    expiresAt?: Date
  ) => {
    if (!conversationId || !user) return;

    try {
      const contextId = await conversationMemoryService.saveContext(
        conversationId,
        contextType,
        contextData,
        relevanceScore,
        expiresAt
      );

      // Reload context to reflect changes
      await loadContext();

      return contextId;
    } catch (error) {
      console.error('Failed to save context:', error);
      throw error;
    }
  }, [conversationId, user, loadContext]);

  /**
   * Load user memory
   */
  const loadMemory = useCallback(async (
    memoryType?: MemoryType,
    memoryKey?: string,
    minConfidence: number = 0.3,
    limit: number = 50
  ) => {
    if (!user) return;

    try {
      const memory = await conversationMemoryService.getMemory(
        memoryType,
        memoryKey,
        minConfidence,
        limit
      );

      setState(prev => ({
        ...prev,
        memory
      }));

      return memory;
    } catch (error) {
      console.error('Failed to load memory:', error);
      throw error;
    }
  }, [user]);

  /**
   * Save user memory
   */
  const saveMemory = useCallback(async (
    memoryType: MemoryType,
    memoryKey: string,
    memoryData: Record<string, any>,
    confidenceScore: number = 0.5
  ) => {
    if (!user) return;

    try {
      const memoryId = await conversationMemoryService.saveMemory(
        memoryType,
        memoryKey,
        memoryData,
        confidenceScore,
        conversationId
      );

      // Reload memory to reflect changes
      await loadMemory();

      return memoryId;
    } catch (error) {
      console.error('Failed to save memory:', error);
      throw error;
    }
  }, [user, conversationId, loadMemory]);

  /**
   * Get conversation context window
   */
  const getContextWindow = useCallback(async (
    includeMemory: boolean = true
  ) => {
    if (!conversationId || !user) return null;

    try {
      const contextWindow = await conversationMemoryService.getContextWindow(
        conversationId,
        maxTokens,
        includeMemory
      );

      setState(prev => ({
        ...prev,
        contextWindow
      }));

      return contextWindow;
    } catch (error) {
      console.error('Failed to get context window:', error);
      throw error;
    }
  }, [conversationId, user, maxTokens]);

  /**
   * Compress conversation context
   */
  const compressContext = useCallback(async () => {
    if (!conversationId || !user) return null;

    try {
      const compressedContext = await conversationMemoryService.compressContext(
        conversationId,
        compressionThreshold
      );

      setState(prev => ({
        ...prev,
        compressedContext
      }));

      return compressedContext;
    } catch (error) {
      console.error('Failed to compress context:', error);
      throw error;
    }
  }, [conversationId, user, compressionThreshold]);

  /**
   * Search conversation memory
   */
  const searchMemory = useCallback(async (
    query: string,
    memoryTypes?: MemoryType[],
    minConfidence: number = 0.3,
    limit: number = 20
  ): Promise<MemorySearchResult[]> => {
    if (!user) return [];

    try {
      return await conversationMemoryService.searchMemory(
        query,
        memoryTypes,
        minConfidence,
        limit
      );
    } catch (error) {
      console.error('Failed to search memory:', error);
      return [];
    }
  }, [user]);

  /**
   * Trigger auto-save with debouncing
   */
  const triggerAutoSave = useCallback(() => {
    if (!autoSave || !conversationId) return;

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        if (state.messages.length > lastSavedMessageCount.current) {
          await conversationMemoryService.autoSaveSummary(conversationId, state.messages);
          lastSavedMessageCount.current = state.messages.length;
        }
      } catch (error) {
        console.warn('Auto-save failed:', error);
      }
    }, 5000); // 5 second delay
  }, [autoSave, conversationId, state.messages]);

  /**
   * Check if context compression is needed
   */
  const needsCompression = useCallback(() => {
    const totalTokens = state.messages.reduce((sum, msg) => sum + msg.content_tokens, 0);
    return totalTokens > compressionThreshold;
  }, [state.messages, compressionThreshold]);

  /**
   * Auto-compress context if needed
   */
  const autoCompress = useCallback(async () => {
    if (needsCompression() && conversationId) {
      try {
        await compressContext();
      } catch (error) {
        console.warn('Auto-compression failed:', error);
      }
    }
  }, [needsCompression, conversationId, compressContext]);

  // Load initial data when conversation changes
  useEffect(() => {
    if (conversationId && user) {
      loadMessages();
      loadContext();
      loadMemory();
    }
  }, [conversationId, user, loadMessages, loadContext, loadMemory]);

  // Auto-compress when token threshold is exceeded
  useEffect(() => {
    if (autoSave && needsCompression()) {
      autoCompress();
    }
  }, [autoSave, needsCompression, autoCompress]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    messages: state.messages,
    context: state.context,
    memory: state.memory,
    contextWindow: state.contextWindow,
    compressedContext: state.compressedContext,
    loading: state.loading,
    error: state.error,

    // Actions
    loadMessages,
    saveMessage,
    loadContext,
    saveContext,
    loadMemory,
    saveMemory,
    getContextWindow,
    compressContext,
    searchMemory,

    // Utilities
    needsCompression: needsCompression(),
    totalTokens: state.messages.reduce((sum, msg) => sum + msg.content_tokens, 0),
    messageCount: state.messages.length,
    contextCount: state.context.length,
    memoryCount: state.memory.length
  };
}
