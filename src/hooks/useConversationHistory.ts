import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ConversationMetadata,
  getAllConversations,
  deleteConversation as deleteConversationFromStorage,
  saveConversation,
  StoredConversation
} from '../lib/conversation-history';

// Custom event types for conversation updates
export const CONVERSATION_EVENTS = {
  CONVERSATION_SAVED: 'conversation:saved',
  CONVERSATION_DELETED: 'conversation:deleted',
  CONVERSATION_UPDATED: 'conversation:updated',
  CONVERSATIONS_CHANGED: 'conversations:changed'
} as const;

// Event detail interfaces
interface ConversationEventDetail {
  conversationId: string;
  conversation?: StoredConversation;
}

interface ConversationsChangedDetail {
  type: 'save' | 'delete' | 'update';
  conversationId: string;
}

// Custom event dispatcher
class ConversationEventDispatcher {
  private static instance: ConversationEventDispatcher;
  
  static getInstance(): ConversationEventDispatcher {
    if (!ConversationEventDispatcher.instance) {
      ConversationEventDispatcher.instance = new ConversationEventDispatcher();
    }
    return ConversationEventDispatcher.instance;
  }

  dispatchConversationSaved(conversationId: string, conversation: StoredConversation) {
    const event = new CustomEvent(CONVERSATION_EVENTS.CONVERSATION_SAVED, {
      detail: { conversationId, conversation }
    });
    window.dispatchEvent(event);
    
    // Also dispatch general change event
    this.dispatchConversationsChanged('save', conversationId);
  }

  dispatchConversationDeleted(conversationId: string) {
    const event = new CustomEvent(CONVERSATION_EVENTS.CONVERSATION_DELETED, {
      detail: { conversationId }
    });
    window.dispatchEvent(event);
    
    // Also dispatch general change event
    this.dispatchConversationsChanged('delete', conversationId);
  }

  dispatchConversationUpdated(conversationId: string, conversation: StoredConversation) {
    const event = new CustomEvent(CONVERSATION_EVENTS.CONVERSATION_UPDATED, {
      detail: { conversationId, conversation }
    });
    window.dispatchEvent(event);
    
    // Also dispatch general change event
    this.dispatchConversationsChanged('update', conversationId);
  }

  private dispatchConversationsChanged(type: 'save' | 'delete' | 'update', conversationId: string) {
    const event = new CustomEvent(CONVERSATION_EVENTS.CONVERSATIONS_CHANGED, {
      detail: { type, conversationId }
    });
    window.dispatchEvent(event);
  }
}

// Enhanced conversation management functions with event dispatching
export function saveConversationWithEvents(conversation: StoredConversation): void {
  saveConversation(conversation);
  ConversationEventDispatcher.getInstance().dispatchConversationSaved(
    conversation.metadata.id,
    conversation
  );
}

export function deleteConversationWithEvents(conversationId: string): void {
  deleteConversationFromStorage(conversationId);
  ConversationEventDispatcher.getInstance().dispatchConversationDeleted(conversationId);
}

// Hook for managing conversation history with real-time updates
export function useConversationHistory() {
  const [conversations, setConversations] = useState<ConversationMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start with true for initial load
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Use ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Load conversations from storage
  const loadConversations = useCallback(() => {
    if (!isMountedRef.current) {
      return;
    }

    try {
      // Only set loading to true if not already initialized (for initial load)
      if (!isInitialized) {
        setIsLoading(true);
      }
      setError(null);

      // Synchronous operation, no need for delay
      const allConversations = getAllConversations();

      if (isMountedRef.current) {
        setConversations(allConversations);
        setIsInitialized(true);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
      if (isMountedRef.current) {
        setError('Failed to load conversations');
        setIsLoading(false);
      }
    }
  }, [isInitialized]); // Include isInitialized to control loading state

  // Optimized update function that only updates if data actually changed
  const updateConversationsIfChanged = useCallback((newConversations: ConversationMetadata[]) => {
    setConversations(prevConversations => {
      // Check if conversations actually changed to prevent unnecessary re-renders
      if (prevConversations.length !== newConversations.length) {
        return newConversations;
      }
      
      // Deep comparison for metadata changes
      const hasChanges = prevConversations.some((prev, index) => {
        const current = newConversations[index];
        return !current || 
               prev.id !== current.id ||
               prev.title !== current.title ||
               prev.messageCount !== current.messageCount ||
               prev.lastMessage !== current.lastMessage ||
               prev.timestamp.getTime() !== current.timestamp.getTime();
      });
      
      return hasChanges ? newConversations : prevConversations;
    });
  }, []);

  // Handle conversation events with debouncing
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null;

    const debouncedLoadConversations = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        loadConversations();
      }, 150); // Debounce to prevent excessive reloads
    };

    const handleConversationSaved = (event: CustomEvent<ConversationEventDetail>) => {
      debouncedLoadConversations();
    };

    const handleConversationDeleted = (event: CustomEvent<ConversationEventDetail>) => {
      debouncedLoadConversations();
    };

    const handleConversationUpdated = (event: CustomEvent<ConversationEventDetail>) => {
      debouncedLoadConversations();
    };

    const handleConversationsChanged = (event: CustomEvent<ConversationsChangedDetail>) => {
      debouncedLoadConversations();
    };

    // Add event listeners
    window.addEventListener(CONVERSATION_EVENTS.CONVERSATION_SAVED, handleConversationSaved as EventListener);
    window.addEventListener(CONVERSATION_EVENTS.CONVERSATION_DELETED, handleConversationDeleted as EventListener);
    window.addEventListener(CONVERSATION_EVENTS.CONVERSATION_UPDATED, handleConversationUpdated as EventListener);
    window.addEventListener(CONVERSATION_EVENTS.CONVERSATIONS_CHANGED, handleConversationsChanged as EventListener);

    return () => {
      // Clear debounce timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Cleanup event listeners
      window.removeEventListener(CONVERSATION_EVENTS.CONVERSATION_SAVED, handleConversationSaved as EventListener);
      window.removeEventListener(CONVERSATION_EVENTS.CONVERSATION_DELETED, handleConversationDeleted as EventListener);
      window.removeEventListener(CONVERSATION_EVENTS.CONVERSATION_UPDATED, handleConversationUpdated as EventListener);
      window.removeEventListener(CONVERSATION_EVENTS.CONVERSATIONS_CHANGED, handleConversationsChanged as EventListener);
    };
  }, [loadConversations]);

  // Initial load - run once on mount
  useEffect(() => {
    // Ensure component is marked as mounted
    isMountedRef.current = true;
    loadConversations();

    // Cleanup function to mark component as unmounted
    return () => {
      isMountedRef.current = false;
    };
  }, []); // Empty dependency array for initial load only

  // Listen for storage changes from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'paperless_chat_conversations') {
        loadConversations();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadConversations]);

  // Delete conversation with events
  const deleteConversation = useCallback((conversationId: string) => {
    deleteConversationWithEvents(conversationId);
  }, []);

  // Refresh conversations manually
  const refreshConversations = useCallback(() => {
    loadConversations();
  }, [loadConversations]);

  return {
    conversations,
    isLoading,
    error,
    isInitialized,
    deleteConversation,
    refreshConversations,
    loadConversations
  };
}

// Hook for components that need to trigger conversation updates
export function useConversationUpdater() {
  const dispatcher = ConversationEventDispatcher.getInstance();

  const saveConversation = useCallback((conversation: StoredConversation) => {
    saveConversationWithEvents(conversation);
  }, []);

  const deleteConversation = useCallback((conversationId: string) => {
    deleteConversationWithEvents(conversationId);
  }, []);

  const updateConversation = useCallback((conversation: StoredConversation) => {
    saveConversationWithEvents(conversation);
    dispatcher.dispatchConversationUpdated(conversation.metadata.id, conversation);
  }, [dispatcher]);

  return {
    saveConversation,
    deleteConversation,
    updateConversation
  };
}
