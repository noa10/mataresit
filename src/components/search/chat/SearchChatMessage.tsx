import { AlertCircle, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatMarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { useDashboardTranslation } from '@/contexts/LanguageContext';
import { SearchChatResults } from '@/components/search/chat/SearchChatResults';
import type { SearchChatMessage as SearchChatMessageType } from '@/types/search-chat';
import type { UnifiedSearchResult } from '@/types/unified-search';

interface SearchChatMessageProps {
  message: SearchChatMessageType;
  isLoadingMore?: boolean;
  isBusy?: boolean;
  onOpenResult: (result: UnifiedSearchResult) => void;
  onShowMore: (messageId: string) => void;
  onFollowUp: (query: string) => void;
  onRetry: (messageId: string) => void;
}

export function SearchChatMessage({
  message,
  isLoadingMore = false,
  isBusy = false,
  onOpenResult,
  onShowMore,
  onFollowUp,
  onRetry,
}: SearchChatMessageProps) {
  const { t } = useDashboardTranslation();

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[10px] bg-ledger-ink px-4 py-2.5 text-sm leading-relaxed text-ledger-paper">
          {message.content}
        </div>
      </div>
    );
  }

  const isError = message.status === 'error';

  return (
    <div className="flex gap-3">
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ledger-accent-soft text-ledger-accent"
        aria-hidden="true"
      >
        <Sparkles className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1">
        {message.status === 'loading' ? (
          <div className="flex h-8 items-center gap-1.5" role="status">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-ledger-muted"
                style={{ animationDelay: `${index * 120}ms` }}
              />
            ))}
            <span className="ml-1 text-xs text-ledger-muted">
              {t('workspace.search.chat.typing')}
            </span>
          </div>
        ) : (
          <>
            <div className="text-sm text-ledger-ink-2">
              {isError ? (
                <div className="flex items-start gap-2">
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                  <div>
                    <p>{message.content}</p>
                    <Button
                      type="button"
                      variant="accent-outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => onRetry(message.id)}
                    >
                      <RotateCcw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                      {t('workspace.search.chat.retry')}
                    </Button>
                  </div>
                </div>
              ) : (
                <ChatMarkdownRenderer content={message.content} />
              )}
            </div>

            {!isError && message.results && message.results.length > 0 && (
              <SearchChatResults
                results={message.results}
                query={message.query || ''}
                totalResults={message.totalResults}
                hasMore={message.hasMore}
                isLoadingMore={isLoadingMore}
                isBusy={isBusy}
                onShowMore={() => onShowMore(message.id)}
                onOpenResult={onOpenResult}
              />
            )}

            {!isError &&
              message.followUpSuggestions &&
              message.followUpSuggestions.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 font-data text-[0.625rem] uppercase tracking-[0.1em] text-ledger-muted">
                    {t('workspace.search.chat.followUps')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {message.followUpSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => onFollowUp(suggestion)}
                        disabled={isBusy}
                        className="rounded-full border border-ledger-line bg-ledger-surface px-3 py-1.5 text-xs text-ledger-ink-2 transition-colors hover:border-ledger-line-strong hover:bg-ledger-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent/30 disabled:pointer-events-none disabled:opacity-50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
          </>
        )}
      </div>
    </div>
  );
}
