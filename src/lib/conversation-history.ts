import { ChatMessage } from '../components/chat/ChatMessage';
import { UnifiedSearchParams, UnifiedSearchResponse } from '@/types/search';

export interface SearchResultCache {
  searchParams: UnifiedSearchParams;
  results: UnifiedSearchResponse;
  cachedAt: number;
  isValid: boolean;
}

export interface ConversationMetadata {
  id: string;
  title: string;
  timestamp: Date;
  messageCount: number;
  lastMessage?: string;
  firstUserMessage?: string;
  // Enhanced metadata for search result caching
  hasSearchResults?: boolean;
  lastSearchQuery?: string;
  searchResultsCache?: SearchResultCache;
  searchStatus?: 'idle' | 'processing' | 'completed' | 'cached' | 'error';
}

export interface StoredConversation {
  metadata: ConversationMetadata;
  messages: ChatMessage[];
}

const STORAGE_KEY = 'paperless_chat_conversations';
const MAX_CONVERSATIONS = 50; // Limit to prevent storage bloat

/**
 * Generate a unique conversation ID
 */
export function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a conversation title from the first user message
 */
export function generateConversationTitle(firstUserMessage: string): string {
  // Clean up the message and truncate if needed
  const cleaned = firstUserMessage.trim();
  if (cleaned.length <= 40) {
    return cleaned;
  }
  
  // Try to break at word boundary
  const truncated = cleaned.substring(0, 37);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > 20) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

/**
 * Get all conversations from localStorage
 */
export function getAllConversations(): ConversationMetadata[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const conversations: StoredConversation[] = JSON.parse(stored);
    return conversations
      .map(conv => ({
        ...conv.metadata,
        timestamp: new Date(conv.metadata.timestamp)
      }))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  } catch (error) {
    console.error('Error loading conversations:', error);
    return [];
  }
}

/**
 * Get a specific conversation by ID
 */
export function getConversation(id: string): StoredConversation | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const conversations: StoredConversation[] = JSON.parse(stored);
    const conversation = conversations.find(conv => conv.metadata.id === id);
    
    if (conversation) {
      // Convert timestamp strings back to Date objects
      conversation.metadata.timestamp = new Date(conversation.metadata.timestamp);
      conversation.messages = conversation.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    }
    
    return conversation || null;
  } catch (error) {
    console.error('Error loading conversation:', error);
    return null;
  }
}

/**
 * Save or update a conversation
 */
export function saveConversation(conversation: StoredConversation): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    let conversations: StoredConversation[] = stored ? JSON.parse(stored) : [];

    // Remove existing conversation with same ID
    conversations = conversations.filter(conv => conv.metadata.id !== conversation.metadata.id);

    // Add the updated conversation
    conversations.unshift(conversation);

    // Limit the number of stored conversations
    if (conversations.length > MAX_CONVERSATIONS) {
      conversations = conversations.slice(0, MAX_CONVERSATIONS);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.error('Error saving conversation:', error);
  }
}

/**
 * Update conversation search result cache
 */
export function updateConversationSearchCache(
  conversationId: string,
  searchParams: UnifiedSearchParams,
  results: UnifiedSearchResponse,
  status: 'processing' | 'completed' | 'cached' | 'error' = 'completed'
): void {
  try {
    const conversation = getConversation(conversationId);
    if (!conversation) {
      console.warn(`Conversation ${conversationId} not found for search cache update`);
      return;
    }

    // Update metadata with search cache information
    conversation.metadata.hasSearchResults = true;
    conversation.metadata.lastSearchQuery = searchParams.query;
    conversation.metadata.searchStatus = status;
    conversation.metadata.searchResultsCache = {
      searchParams,
      results,
      cachedAt: Date.now(),
      isValid: true
    };

    // Save the updated conversation
    saveConversation(conversation);

    console.log(`💾 Updated search cache for conversation ${conversationId} with status: ${status}`);
  } catch (error) {
    console.error('Error updating conversation search cache:', error);
  }
}

/**
 * Get cached search results for a conversation
 */
export function getConversationSearchCache(conversationId: string): SearchResultCache | null {
  try {
    const conversation = getConversation(conversationId);
    if (!conversation?.metadata.searchResultsCache) {
      return null;
    }

    const cache = conversation.metadata.searchResultsCache;

    // Check if cache is still valid (24 hours)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const isExpired = Date.now() - cache.cachedAt > maxAge;

    if (isExpired || !cache.isValid) {
      // Invalidate expired cache
      invalidateConversationSearchCache(conversationId);
      return null;
    }

    return cache;
  } catch (error) {
    console.error('Error getting conversation search cache:', error);
    return null;
  }
}

/**
 * Invalidate search cache for a conversation
 */
export function invalidateConversationSearchCache(conversationId: string): void {
  try {
    const conversation = getConversation(conversationId);
    if (!conversation) return;

    // Clear search cache metadata
    conversation.metadata.hasSearchResults = false;
    conversation.metadata.searchResultsCache = undefined;
    conversation.metadata.searchStatus = 'idle';

    saveConversation(conversation);
    console.log(`🗑️ Invalidated search cache for conversation ${conversationId}`);
  } catch (error) {
    console.error('Error invalidating conversation search cache:', error);
  }
}

/**
 * Check if conversation has valid cached search results
 */
export function hasValidSearchCache(conversationId: string): boolean {
  const cache = getConversationSearchCache(conversationId);
  return cache !== null && cache.isValid;
}

/**
 * Force clear all conversation caches containing a specific query
 */
export function forceInvalidateConversationsByQuery(query: string): void {
  try {
    const queryLower = query.toLowerCase();
    const conversations = getAllConversations();
    let clearedCount = 0;

    conversations.forEach(conversation => {
      // Check if conversation has search results for this query
      const hasQueryInCache = conversation.metadata.lastSearchQuery?.toLowerCase().includes(queryLower);
      const hasQueryInMessages = conversation.messages.some(msg =>
        msg.content.toLowerCase().includes(queryLower)
      );

      if (hasQueryInCache || hasQueryInMessages) {
        invalidateConversationSearchCache(conversation.id);
        clearedCount++;
      }
    });

    console.log(`🗑️ Force invalidated ${clearedCount} conversation caches for query: "${query}"`);
  } catch (error) {
    console.error('Error force invalidating conversation caches:', error);
  }
}

/**
 * Nuclear option: Clear ALL conversation search caches
 */
export function forceInvalidateAllConversationCaches(): void {
  try {
    const conversations = getAllConversations();
    let clearedCount = 0;

    conversations.forEach(conversation => {
      if (conversation.metadata.hasSearchResults) {
        invalidateConversationSearchCache(conversation.id);
        clearedCount++;
      }
    });

    console.log(`💥 Nuclear invalidated ${clearedCount} conversation search caches`);
  } catch (error) {
    console.error('Error nuclear invalidating conversation caches:', error);
  }
}

/**
 * Update conversation search status
 */
export function updateConversationSearchStatus(
  conversationId: string,
  status: 'idle' | 'processing' | 'completed' | 'cached' | 'error'
): void {
  try {
    const conversation = getConversation(conversationId);
    if (!conversation) return;

    conversation.metadata.searchStatus = status;
    saveConversation(conversation);

    console.log(`🔄 Updated search status for conversation ${conversationId}: ${status}`);
  } catch (error) {
    console.error('Error updating conversation search status:', error);
  }
}

/**
 * Delete a conversation
 */
export function deleteConversation(id: string): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    
    let conversations: StoredConversation[] = JSON.parse(stored);
    conversations = conversations.filter(conv => conv.metadata.id !== id);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.error('Error deleting conversation:', error);
  }
}

/**
 * Create conversation metadata from messages
 */
export function createConversationMetadata(
  id: string,
  messages: ChatMessage[]
): ConversationMetadata {
  const userMessages = messages.filter(msg => msg.type === 'user');
  const firstUserMessage = userMessages[0]?.content || '';
  const lastMessage = messages[messages.length - 1]?.content || '';
  
  return {
    id,
    title: generateConversationTitle(firstUserMessage),
    timestamp: new Date(),
    messageCount: messages.length,
    lastMessage: lastMessage.length > 100 ? lastMessage.substring(0, 97) + '...' : lastMessage,
    firstUserMessage
  };
}

/**
 * Format relative time for conversation timestamps
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);
  const diffInDays = diffInHours / 24;
  
  if (diffInHours < 1) {
    return 'Just now';
  } else if (diffInHours < 24) {
    return 'Today';
  } else if (diffInDays < 2) {
    return 'Yesterday';
  } else if (diffInDays < 7) {
    return `${Math.floor(diffInDays)} days ago`;
  } else if (diffInDays < 30) {
    return `${Math.floor(diffInDays / 7)} week${Math.floor(diffInDays / 7) === 1 ? '' : 's'} ago`;
  } else if (diffInDays < 365) {
    return `${Math.floor(diffInDays / 30)} month${Math.floor(diffInDays / 30) === 1 ? '' : 's'} ago`;
  } else {
    return `${Math.floor(diffInDays / 365)} year${Math.floor(diffInDays / 365) === 1 ? '' : 's'} ago`;
  }
}

/**
 * Search conversations by title or content
 */
export function searchConversations(conversations: ConversationMetadata[], query: string): ConversationMetadata[] {
  if (!query.trim()) return conversations;

  const searchTerm = query.toLowerCase().trim();

  return conversations.filter(conv => {
    return (
      conv.title.toLowerCase().includes(searchTerm) ||
      conv.lastMessage?.toLowerCase().includes(searchTerm) ||
      conv.firstUserMessage?.toLowerCase().includes(searchTerm)
    );
  });
}

/**
 * Filter conversations by time period
 */
export function filterConversationsByTime(conversations: ConversationMetadata[], timeFilter: string): ConversationMetadata[] {
  if (timeFilter === 'all') return conversations;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);

  return conversations.filter(conv => {
    const convTime = conv.timestamp.getTime();

    switch (timeFilter) {
      case 'today':
        return convTime >= startOfToday.getTime();
      case 'yesterday':
        return convTime >= startOfYesterday.getTime() && convTime < startOfToday.getTime();
      case 'week':
        return convTime >= startOfWeek.getTime();
      case 'month':
        return convTime >= startOfMonth.getTime();
      default:
        return true;
    }
  });
}

/**
 * Sort conversations by different criteria
 */
export function sortConversations(conversations: ConversationMetadata[], sortBy: 'recent' | 'oldest' | 'title' | 'messageCount'): ConversationMetadata[] {
  return [...conversations].sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return b.timestamp.getTime() - a.timestamp.getTime();
      case 'oldest':
        return a.timestamp.getTime() - b.timestamp.getTime();
      case 'title':
        return a.title.localeCompare(b.title);
      case 'messageCount':
        return b.messageCount - a.messageCount;
      default:
        return b.timestamp.getTime() - a.timestamp.getTime();
    }
  });
}

/**
 * Get conversation statistics
 */
export function getConversationStats(conversations: ConversationMetadata[]): {
  total: number;
  today: number;
  thisWeek: number;
  totalMessages: number;
} {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);

  const today = conversations.filter(conv => conv.timestamp.getTime() >= startOfToday.getTime()).length;
  const thisWeek = conversations.filter(conv => conv.timestamp.getTime() >= startOfWeek.getTime()).length;
  const totalMessages = conversations.reduce((sum, conv) => sum + conv.messageCount, 0);

  return {
    total: conversations.length,
    today,
    thisWeek,
    totalMessages
  };
}

/**
 * Group conversations by time periods with enhanced grouping
 */
export function groupConversationsByTime(conversations: ConversationMetadata[]): {
  [key: string]: ConversationMetadata[];
} {
  const groups: { [key: string]: ConversationMetadata[] } = {};

  conversations.forEach(conv => {
    const timeGroup = formatRelativeTime(conv.timestamp);
    const groupKey = timeGroup === 'Just now' || timeGroup === 'Today' ? 'Today' :
                    timeGroup === 'Yesterday' ? 'Yesterday' :
                    timeGroup.includes('days ago') ? 'This week' :
                    timeGroup.includes('week') ? 'Earlier' :
                    'Older';

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(conv);
  });

  return groups;
}

/**
 * Export conversations to JSON for backup
 */
export function exportConversations(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return JSON.stringify([]);

    const conversations: StoredConversation[] = JSON.parse(stored);
    return JSON.stringify(conversations, null, 2);
  } catch (error) {
    console.error('Error exporting conversations:', error);
    return JSON.stringify([]);
  }
}

/**
 * Import conversations from JSON backup
 */
export function importConversations(jsonData: string): boolean {
  try {
    const conversations: StoredConversation[] = JSON.parse(jsonData);

    // Validate the data structure
    if (!Array.isArray(conversations)) {
      throw new Error('Invalid data format');
    }

    // Validate each conversation
    conversations.forEach(conv => {
      if (!conv.metadata || !conv.messages || !conv.metadata.id) {
        throw new Error('Invalid conversation structure');
      }
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    return true;
  } catch (error) {
    console.error('Error importing conversations:', error);
    return false;
  }
}
