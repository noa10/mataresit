import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  SEARCH_CHAT_HISTORY_EVENT,
  clearSearchChatHistory,
  deleteSearchChat,
  getSearchChatStorageKey,
  listSearchChats,
  type SearchChatSummary,
} from '@/lib/search-chat/history';

/**
 * Keeps the recent-chat list in sync with localStorage and any other tab.
 * History is namespaced per signed-in user; signed-out visitors see nothing.
 */
export function useSearchChatHistory() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [conversations, setConversations] = useState<SearchChatSummary[]>(() =>
    userId ? listSearchChats(userId) : []
  );

  const refresh = useCallback(() => {
    setConversations(userId ? listSearchChats(userId) : []);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;

    const storageKey = getSearchChatStorageKey(userId);
    const handleLocalChange = () => refresh();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) refresh();
    };

    window.addEventListener(SEARCH_CHAT_HISTORY_EVENT, handleLocalChange);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(SEARCH_CHAT_HISTORY_EVENT, handleLocalChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, [refresh, userId]);

  const deleteConversation = useCallback(
    (id: string) => {
      if (!userId) return;
      deleteSearchChat(userId, id);
    },
    [userId]
  );

  const clearHistory = useCallback(() => {
    if (!userId) return;
    clearSearchChatHistory(userId);
  }, [userId]);

  return {
    conversations,
    refresh,
    deleteConversation,
    clearHistory,
  };
}
