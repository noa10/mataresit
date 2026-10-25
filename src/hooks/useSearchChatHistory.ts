import { useCallback, useEffect, useState } from 'react';
import {
  SEARCH_CHAT_HISTORY_EVENT,
  SEARCH_CHAT_STORAGE_KEY,
  deleteSearchChat,
  listSearchChats,
  type SearchChatSummary,
} from '@/lib/search-chat/history';

/**
 * Keeps the recent-chat list in sync with localStorage and any other tab.
 */
export function useSearchChatHistory() {
  const [conversations, setConversations] = useState<SearchChatSummary[]>(() =>
    listSearchChats()
  );

  const refresh = useCallback(() => {
    setConversations(listSearchChats());
  }, []);

  useEffect(() => {
    const handleLocalChange = () => refresh();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SEARCH_CHAT_STORAGE_KEY) refresh();
    };

    window.addEventListener(SEARCH_CHAT_HISTORY_EVENT, handleLocalChange);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(SEARCH_CHAT_HISTORY_EVENT, handleLocalChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, [refresh]);

  const deleteConversation = useCallback((id: string) => {
    deleteSearchChat(id);
  }, []);

  return {
    conversations,
    refresh,
    deleteConversation,
  };
}
