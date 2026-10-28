import { useEffect, useRef } from 'react';
import { SearchChatMessage } from '@/components/search/chat/SearchChatMessage';
import { SearchChatWelcome } from '@/components/search/chat/SearchChatWelcome';
import type { SearchChatMessage as SearchChatMessageType } from '@/types/search-chat';
import type { UnifiedSearchResult } from '@/types/unified-search';

interface SearchChatThreadProps {
  messages: SearchChatMessageType[];
  isLoading: boolean;
  loadingMoreId: string | null;
  prompts: string[];
  onSelectPrompt: (prompt: string) => void;
  onOpenResult: (result: UnifiedSearchResult) => void;
  onShowMore: (messageId: string) => void;
  onFollowUp: (query: string) => void;
  onRetry: (messageId: string) => void;
}

export function SearchChatThread({
  messages,
  isLoading,
  loadingMoreId,
  prompts,
  onSelectPrompt,
  onOpenResult,
  onShowMore,
  onFollowUp,
  onRetry,
}: SearchChatThreadProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 160;

    if (nearBottom || messages.length <= 2) {
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      } else {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  return (
    <div
      ref={containerRef}
      className="max-h-[58vh] min-h-[320px] flex-1 overflow-y-auto px-[18px] py-5"
    >
      {messages.length === 0 ? (
        <SearchChatWelcome prompts={prompts} onSelectPrompt={onSelectPrompt} />
      ) : (
        <div className="space-y-5" role="log" aria-live="polite" aria-busy={isLoading}>
          {messages.map((message) => (
            <SearchChatMessage
              key={message.id}
              message={message}
              isLoadingMore={loadingMoreId === message.id}
              isBusy={isLoading}
              onOpenResult={onOpenResult}
              onShowMore={onShowMore}
              onFollowUp={onFollowUp}
              onRetry={onRetry}
            />
          ))}
        </div>
      )}
    </div>
  );
}
