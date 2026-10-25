import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SEARCH_CHAT_STORAGE_KEY,
  deleteSearchChat,
  getSearchChat,
  listSearchChats,
  saveSearchChat,
  toSearchChatMessages,
} from '@/lib/search-chat/history';
import type { SearchChatMessage } from '@/types/search-chat';
import type { UnifiedSearchResult } from '@/types/unified-search';

const receiptResult = (id = 'receipt-1'): UnifiedSearchResult => ({
  id,
  sourceType: 'receipt',
  sourceId: id,
  contentType: 'receipt',
  title: 'Kedai Kopi',
  description: 'Coffee',
  similarity: 0.8,
  accessLevel: 'user',
  createdAt: '2026-10-01T08:00:00.000Z',
  metadata: {
    total: 12.5,
    currency: 'MYR',
    date: '2026-10-01',
    merchant: 'Kedai Kopi',
    raw_text: 'should not be stored',
  },
});

const user = (content: string): SearchChatMessage => ({
  id: 'user-1',
  role: 'user',
  content,
  createdAt: new Date('2026-10-01T08:00:00.000Z'),
  status: 'complete',
});

const assistant = (content: string): SearchChatMessage => ({
  id: 'assistant-1',
  role: 'assistant',
  content,
  createdAt: new Date('2026-10-01T08:01:00.000Z'),
  status: 'complete',
  query: 'coffee',
  results: [receiptResult()],
  totalResults: 1,
  offset: 1,
  hasMore: false,
  followUpSuggestions: ['Show me last month'],
});

describe('search chat history', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('saves, lists and restores a conversation', () => {
    saveSearchChat({
      id: 'chat_1',
      messages: [user('coffee this month'), assistant('I found one receipt.')],
    });

    const summaries = listSearchChats();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      id: 'chat_1',
      title: 'coffee this month',
      messageCount: 2,
    });

    const stored = getSearchChat('chat_1');
    expect(stored?.messages).toHaveLength(2);
    expect(stored?.messages[1].results?.[0].metadata.total).toBe(12.5);
    expect(stored?.messages[1].results?.[0].metadata.raw_text).toBeUndefined();

    const restored = toSearchChatMessages(stored!);
    expect(restored[1].createdAt).toBeInstanceOf(Date);
    expect(restored[1].results?.[0].title).toBe('Kedai Kopi');
    expect(restored[1].followUpSuggestions).toEqual(['Show me last month']);
  });

  it('does not persist loading placeholders or conversations without a user message', () => {
    saveSearchChat({
      id: 'chat_2',
      messages: [
        user('parking'),
        {
          id: 'assistant-loading',
          role: 'assistant',
          content: '',
          createdAt: new Date(),
          status: 'loading',
        },
      ],
    });

    expect(getSearchChat('chat_2')?.messages).toHaveLength(1);

    saveSearchChat({
      id: 'chat_3',
      messages: [assistant('orphan answer')],
    });
    expect(getSearchChat('chat_3')).toBeNull();
  });

  it('updates the existing conversation and keeps its title', () => {
    saveSearchChat({ id: 'chat_1', messages: [user('coffee')] });
    const createdAt = getSearchChat('chat_1')?.createdAt;

    saveSearchChat({
      id: 'chat_1',
      messages: [user('coffee'), assistant('I found one receipt.')],
    });

    expect(listSearchChats()).toHaveLength(1);
    expect(getSearchChat('chat_1')?.title).toBe('coffee');
    expect(getSearchChat('chat_1')?.createdAt).toBe(createdAt);
  });

  it('deletes a conversation', () => {
    saveSearchChat({ id: 'chat_1', messages: [user('coffee'), assistant('Found.')] });
    deleteSearchChat('chat_1');
    expect(listSearchChats()).toEqual([]);
    expect(localStorage.getItem(SEARCH_CHAT_STORAGE_KEY)).toBe('[]');
  });

  it('imports legacy conversations once', () => {
    localStorage.setItem(
      'paperless_chat_conversations',
      JSON.stringify([
        {
          metadata: {
            id: 'conv_1',
            title: 'Legacy coffee',
            timestamp: '2026-09-01T08:00:00.000Z',
          },
          messages: [
            { id: 'm1', type: 'user', content: 'old coffee', timestamp: '2026-09-01T08:00:00.000Z' },
            { id: 'm2', type: 'ai', content: 'I found it.', timestamp: '2026-09-01T08:01:00.000Z' },
          ],
        },
      ])
    );

    const summaries = listSearchChats();
    expect(summaries[0]).toMatchObject({
      id: 'legacy_conv_1',
      title: 'Legacy coffee',
      messageCount: 2,
    });

    const stored = getSearchChat('legacy_conv_1');
    expect(stored?.messages[0]).toMatchObject({ role: 'user', content: 'old coffee' });

    // Once migrated, removing the legacy key must not lose the imported chat.
    localStorage.removeItem('paperless_chat_conversations');
    expect(listSearchChats()[0].id).toBe('legacy_conv_1');
  });
});
