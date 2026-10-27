import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearchChat } from '@/hooks/useSearchChat';
import { listSearchChats } from '@/lib/search-chat/history';
import type { UnifiedSearchResponse, UnifiedSearchResult } from '@/types/unified-search';

const mocks = vi.hoisted(() => ({
  unifiedSearch: vi.fn(),
  language: 'en' as 'en' | 'ms',
  userId: 'test-user',
}));

vi.mock('@/lib/ai-search', () => ({
  unifiedSearch: mocks.unifiedSearch,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: mocks.userId } }),
}));

vi.mock('@/lib/search-chat/summary', () => ({
  buildFallbackSummary: () => 'fallback summary',
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: mocks.language }),
  useDashboardTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'workspace.search.chat.suggestions.0': 'Show me this month’s receipts',
        'workspace.search.chat.suggestions.1': 'Find receipts over RM200',
        'workspace.search.chat.suggestions.2': 'What did I spend on groceries?',
        'workspace.search.chat.error': 'I couldn’t complete that search.',
        'workspace.search.chat.loadMoreFailed': 'Couldn’t load more results.',
      };
      return translations[key] ?? key;
    },
  }),
}));

const result = (id: string): UnifiedSearchResult => ({
  id,
  sourceType: 'receipt',
  sourceId: id,
  contentType: 'receipt',
  title: 'Kedai Kopi',
  description: 'Coffee',
  similarity: 0.8,
  metadata: { total: 12.5, currency: 'MYR', date: '2026-10-01' },
  accessLevel: 'user',
  createdAt: '2026-10-01T08:00:00.000Z',
});

const response = (overrides: Partial<UnifiedSearchResponse> = {}): UnifiedSearchResponse => ({
  success: true,
  results: [result('receipt-1')],
  totalResults: 1,
  pagination: { hasMore: false, totalPages: 1 },
  searchMetadata: {
    sourcesSearched: ['receipt'],
    searchDuration: 120,
    subscriptionLimitsApplied: false,
    fallbacksUsed: [],
  },
  enhancedResponse: {
    content: 'I found one coffee receipt.',
    uiComponents: [],
    followUpSuggestions: ['Show me last month'],
    confidence: 0.9,
    responseType: 'success',
  },
  ...overrides,
});

describe('useSearchChat', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.unifiedSearch.mockReset();
    mocks.language = 'en';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends an enhanced conversational search and stores the answer', async () => {
    mocks.unifiedSearch.mockResolvedValue(response());

    const { result: hook } = renderHook(() => useSearchChat());

    await act(async () => {
      await hook.current.sendMessage('  coffee this month  ');
    });

    expect(mocks.unifiedSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'coffee this month',
        sources: ['receipts'],
        useEnhancedPrompting: true,
        bypassCache: true,
        responseLanguage: 'en',
        filters: { language: 'en' },
      })
    );

    expect(hook.current.messages).toHaveLength(2);
    expect(hook.current.messages[0]).toMatchObject({
      role: 'user',
      content: 'coffee this month',
    });
    expect(hook.current.messages[1]).toMatchObject({
      role: 'assistant',
      status: 'complete',
      content: 'I found one coffee receipt.',
      totalResults: 1,
      hasMore: false,
    });
    expect(hook.current.messages[1].results).toHaveLength(1);
    expect(hook.current.messages[1].followUpSuggestions).toEqual(['Show me last month']);

    const summaries = listSearchChats(mocks.userId);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      id: hook.current.conversationId,
      title: 'coffee this month',
      messageCount: 2,
    });
  });

  it('falls back to a deterministic summary when the narrative is missing', async () => {
    mocks.unifiedSearch.mockResolvedValue(
      response({ enhancedResponse: undefined })
    );

    const { result: hook } = renderHook(() => useSearchChat());

    await act(async () => {
      await hook.current.sendMessage('coffee');
    });

    expect(hook.current.messages[1].content).toBe('fallback summary');
  });

  it('ignores the generic Edge Function fallback narrative', async () => {
    const base = response();
    mocks.unifiedSearch.mockResolvedValue({
      ...base,
      searchMetadata: {
        ...base.searchMetadata,
        responseGeneration: { modelUsed: 'fallback' },
      },
    });

    const { result: hook } = renderHook(() => useSearchChat());

    await act(async () => {
      await hook.current.sendMessage('coffee');
    });

    expect(hook.current.messages[1].content).toBe('fallback summary');
    expect(hook.current.messages[1].followUpSuggestions).toEqual([
      'Show me this month’s receipts',
      'Find receipts over RM200',
      'What did I spend on groceries?',
    ]);
  });

  it('marks the assistant message as failed and retries without duplicating the user turn', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.unifiedSearch.mockResolvedValueOnce(
      response({ success: false, error: 'Search failed', results: [], totalResults: 0 })
    );

    const { result: hook } = renderHook(() => useSearchChat());

    await act(async () => {
      await hook.current.sendMessage('coffee');
    });

    expect(hook.current.messages).toHaveLength(2);
    expect(hook.current.messages[1]).toMatchObject({
      role: 'assistant',
      status: 'error',
      content: 'I couldn’t complete that search.',
    });

    mocks.unifiedSearch.mockResolvedValueOnce(response());

    act(() => {
      hook.current.retryMessage(hook.current.messages[1].id);
    });

    await waitFor(() => {
      expect(hook.current.messages).toHaveLength(2);
      expect(hook.current.messages[1]).toMatchObject({
        role: 'assistant',
        status: 'complete',
        content: 'I found one coffee receipt.',
      });
    });
  });

  it('loads the next page of results into the same message', async () => {
    mocks.unifiedSearch
      .mockResolvedValueOnce(
        response({
          totalResults: 2,
          pagination: { hasMore: true, totalPages: 2 },
        })
      )
      .mockResolvedValueOnce(
        response({
          results: [result('receipt-2')],
          totalResults: 2,
          pagination: { hasMore: false, totalPages: 1 },
        })
      );

    const { result: hook } = renderHook(() => useSearchChat());

    await act(async () => {
      await hook.current.sendMessage('coffee');
    });

    const assistantId = hook.current.messages[1].id;

    await act(async () => {
      await hook.current.loadMore(assistantId);
    });

    expect(mocks.unifiedSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: 'coffee',
        offset: 1,
        useEnhancedPrompting: false,
        bypassCache: true,
      })
    );
    expect(hook.current.messages[1].results).toHaveLength(2);
    expect(hook.current.messages[1]).toMatchObject({
      totalResults: 2,
      hasMore: false,
      offset: 2,
    });
  });

  it('clears the thread on new chat but keeps it in recent chats', async () => {
    mocks.unifiedSearch.mockResolvedValue(response());

    const { result: hook } = renderHook(() => useSearchChat());

    await act(async () => {
      await hook.current.sendMessage('coffee');
    });

    const conversationId = hook.current.conversationId;

    act(() => {
      hook.current.newChat();
    });

    expect(hook.current.messages).toEqual([]);
    expect(hook.current.conversationId).toBeNull();
    expect(hook.current.isLoading).toBe(false);
    expect(listSearchChats(mocks.userId)[0]?.id).toBe(conversationId);
  });

  it('loads a stored conversation', async () => {
    mocks.unifiedSearch.mockResolvedValue(response());

    const { result: hook } = renderHook(() => useSearchChat());

    await act(async () => {
      await hook.current.sendMessage('coffee');
    });

    const conversationId = hook.current.conversationId!;

    act(() => {
      hook.current.newChat();
      hook.current.loadConversation(conversationId);
    });

    expect(hook.current.conversationId).toBe(conversationId);
    expect(hook.current.messages).toHaveLength(2);
    expect(hook.current.messages[0]).toMatchObject({
      role: 'user',
      content: 'coffee',
    });
    expect(hook.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'I found one coffee receipt.',
    });
  });
});
