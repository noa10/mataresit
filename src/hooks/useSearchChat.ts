import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useDashboardTranslation, useLanguage } from '@/contexts/LanguageContext';
import { unifiedSearch } from '@/lib/ai-search';
import {
  createSearchChatId,
  getSearchChat,
  saveSearchChat,
  toSearchChatMessages,
} from '@/lib/search-chat/history';
import { buildFallbackSummary } from '@/lib/search-chat/summary';
import type { SearchChatMessage } from '@/types/search-chat';
import type { UnifiedSearchParams } from '@/types/unified-search';

const PAGE_SIZE = 20;

const createMessageId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const createMessage = (
  role: SearchChatMessage['role'],
  content: string,
  extra: Partial<SearchChatMessage> = {}
): SearchChatMessage => ({
  id: createMessageId(),
  role,
  content,
  createdAt: new Date(),
  status: 'complete',
  ...extra,
});

/**
 * Owns the AI search chat thread: submits queries to the unified-search Edge
 * Function, keeps the message list, and handles retry + pagination.
 */
export function useSearchChat() {
  const { t } = useDashboardTranslation();
  const { language } = useLanguage();

  const [messages, setMessages] = useState<SearchChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMoreId, setLoadingMoreId] = useState<string | null>(null);

  const messagesRef = useRef<SearchChatMessage[]>([]);
  const requestIdRef = useRef(0);
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef<string | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!conversationId) return;
    saveSearchChat({ id: conversationId, messages });
  }, [conversationId, messages]);

  const buildParams = useCallback(
    (
      query: string,
      offset: number,
      useEnhancedPrompting: boolean
    ): UnifiedSearchParams => ({
      query,
      sources: ['receipts'],
      limit: PAGE_SIZE,
      offset,
      similarityThreshold: 0.2,
      includeMetadata: true,
      aggregationMode: 'relevance',
      filters: { language },
      responseLanguage: language,
      useEnhancedPrompting,
      bypassCache: true,
    }),
    [language]
  );

  const localSuggestions = useCallback(
    () => [
      t('workspace.search.chat.suggestions.0'),
      t('workspace.search.chat.suggestions.1'),
      t('workspace.search.chat.suggestions.2'),
    ],
    [t]
  );

  const submit = useCallback(
    async (rawQuery: string, appendUserMessage: boolean) => {
      const query = rawQuery.trim();
      if (!query || loadingRef.current) return;

      const activeConversationId = conversationId ?? createSearchChatId();
      if (!conversationId) {
        setConversationId(activeConversationId);
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      loadingRef.current = true;
      setIsLoading(true);

      const conversationHistory = messagesRef.current
        .filter((message) => message.status === 'complete' && message.content.trim())
        .slice(-6)
        .map(
          (message) =>
            `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content.trim()}`
        );

      const userMessage = appendUserMessage ? createMessage('user', query) : null;
      const assistantId = createMessageId();

      setMessages((previous) => [
        ...(userMessage ? [...previous, userMessage] : previous),
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          createdAt: new Date(),
          status: 'loading',
          query,
        },
      ]);

      try {
        const response = await unifiedSearch({
          ...buildParams(query, 0, true),
          conversationHistory,
        });

        if (requestId !== requestIdRef.current) return;
        if (!response.success) {
          throw new Error(response.error || 'Search failed');
        }

        const results = response.results ?? [];
        const totalResults = Math.max(response.totalResults ?? 0, results.length);
        const narrative = response.enhancedResponse?.content?.trim();
        const usedGenericFallback =
          response.searchMetadata?.responseGeneration?.modelUsed === 'fallback';
        const hasAiNarrative = Boolean(narrative) && !usedGenericFallback;

        const content =
          hasAiNarrative && narrative
            ? narrative
            : buildFallbackSummary({
                query,
                results,
                totalResults,
                language,
                t,
              });

        const serverSuggestions = (response.enhancedResponse?.followUpSuggestions || [])
          .filter((suggestion) => Boolean(suggestion?.trim()))
          .slice(0, 3);
        const followUpSuggestions =
          hasAiNarrative && language !== 'ms' && serverSuggestions.length > 0
            ? serverSuggestions
            : localSuggestions();

        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content,
                  status: 'complete',
                  results,
                  totalResults,
                  offset: results.length,
                  hasMore: response.pagination?.hasMore ?? false,
                  followUpSuggestions,
                }
              : message
          )
        );
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error('AI search chat request failed', error);
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: t('workspace.search.chat.error'),
                  status: 'error',
                }
              : message
          )
        );
      } finally {
        if (requestId === requestIdRef.current) {
          loadingRef.current = false;
          setIsLoading(false);
        }
      }
    },
    [buildParams, conversationId, language, localSuggestions, t]
  );

  const sendMessage = useCallback(
    async (query: string) => {
      await submit(query, true);
    },
    [submit]
  );

  const retryMessage = useCallback(
    (messageId: string) => {
      const message = messagesRef.current.find((item) => item.id === messageId);
      if (!message?.query) return;

      setMessages((previous) => previous.filter((item) => item.id !== messageId));
      void submit(message.query, false);
    },
    [submit]
  );

  const loadMore = useCallback(
    async (messageId: string) => {
      if (loadingRef.current || loadingMoreRef.current) return;

      const message = messagesRef.current.find((item) => item.id === messageId);
      if (!message?.query || !message.hasMore) return;

      loadingMoreRef.current = messageId;
      setLoadingMoreId(messageId);
      const offset = message.offset ?? message.results?.length ?? 0;

      try {
        const response = await unifiedSearch(buildParams(message.query, offset, false));
        if (!response.success) {
          throw new Error(response.error || 'Search failed');
        }

        const incoming = response.results ?? [];
        setMessages((previous) =>
          previous.map((item) => {
            if (item.id !== messageId) return item;

            const existing = item.results ?? [];
            const seen = new Set(
              existing.map((result) => `${result.sourceType}-${result.id}`)
            );
            const uniqueIncoming = incoming.filter((result) => {
              const key = `${result.sourceType}-${result.id}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });

            return {
              ...item,
              results: [...existing, ...uniqueIncoming],
              totalResults: Math.max(
                response.totalResults ?? 0,
                existing.length + uniqueIncoming.length,
                item.totalResults ?? 0
              ),
              offset: offset + incoming.length,
              hasMore: response.pagination?.hasMore ?? false,
            };
          })
        );
      } catch (error) {
        console.error('Failed to load more search results', error);
        toast.error(t('workspace.search.chat.loadMoreFailed'));
      } finally {
        loadingMoreRef.current = null;
        setLoadingMoreId(null);
      }
    },
    [buildParams, t]
  );

  const newChat = useCallback(() => {
    requestIdRef.current += 1;
    loadingRef.current = false;
    loadingMoreRef.current = null;
    setIsLoading(false);
    setLoadingMoreId(null);
    setConversationId(null);
    setMessages([]);
  }, []);

  const loadConversation = useCallback((id: string): boolean => {
    const stored = getSearchChat(id);
    if (!stored) return false;

    requestIdRef.current += 1;
    loadingRef.current = false;
    loadingMoreRef.current = null;
    setIsLoading(false);
    setLoadingMoreId(null);
    setConversationId(id);
    setMessages(toSearchChatMessages(stored));
    return true;
  }, []);

  return {
    messages,
    conversationId,
    isLoading,
    loadingMoreId,
    sendMessage,
    retryMessage,
    loadMore,
    newChat,
    loadConversation,
  };
}
