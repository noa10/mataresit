import { ChatMessage } from '../components/chat/ChatMessage';

export interface ConversationMetadata {
  id: string;
  title: string;
  timestamp: Date;
  messageCount: number;
  lastMessage?: string;
  firstUserMessage?: string;
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
 * Group conversations by time periods
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
