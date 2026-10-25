import { describe, expect, it } from 'vitest';
import { buildFallbackSummary } from '@/lib/search-chat/summary';
import type { UnifiedSearchResult } from '@/types/unified-search';

const translate = (key: string, options?: Record<string, unknown>): string => {
  const values = options ?? {};
  switch (key) {
    case 'workspace.search.chat.fallback.found':
      return `I found ${values.count} receipts matching “${values.query}”.`;
    case 'workspace.search.chat.fallback.none':
      return `I couldn’t find any receipts matching “${values.query}”.`;
    case 'workspace.search.chat.fallback.shownTotal':
      return `The results shown total ${values.amount}.`;
    case 'workspace.search.chat.fallback.span':
      return `They span ${values.start} to ${values.end}.`;
    case 'workspace.search.chat.fallback.merchants':
      return `Most frequent: ${values.merchants}.`;
    default:
      return key;
  }
};

const receipt = (overrides: Partial<UnifiedSearchResult> = {}): UnifiedSearchResult => ({
  id: 'receipt-1',
  sourceType: 'receipt',
  sourceId: 'receipt-1',
  contentType: 'receipt',
  title: 'Kedai Kopi',
  description: 'Coffee',
  similarity: 0.8,
  metadata: {
    total: 12.5,
    currency: 'MYR',
    merchant: 'Kedai Kopi',
    date: '2026-10-01',
  },
  accessLevel: 'user',
  createdAt: '2026-10-01T08:00:00.000Z',
  ...overrides,
});

describe('buildFallbackSummary', () => {
  it('summarises receipts with a total, date span and merchants', () => {
    const summary = buildFallbackSummary({
      query: 'coffee',
      results: [
        receipt(),
        receipt({
          id: 'receipt-2',
          sourceId: 'receipt-2',
          title: 'Kopi Tanah',
          metadata: {
            total: 7.5,
            currency: 'MYR',
            merchant: 'Kopi Tanah',
            date: '2026-10-05',
          },
          createdAt: '2026-10-05T08:00:00.000Z',
        }),
      ],
      totalResults: 2,
      language: 'en',
      t: translate,
    });

    expect(summary).toContain('I found 2 receipts matching “coffee”.');
    expect(summary).toContain('The results shown total');
    expect(summary).toContain('They span 1 Oct 2026 to 5 Oct 2026.');
    expect(summary).toContain('Most frequent: Kedai Kopi, Kopi Tanah.');
  });

  it('does not claim a total for a partially loaded result set', () => {
    const summary = buildFallbackSummary({
      query: 'coffee',
      results: [receipt()],
      totalResults: 40,
      language: 'en',
      t: translate,
    });

    expect(summary).toContain('I found 40 receipts matching “coffee”.');
    expect(summary).not.toContain('The results shown total');
  });

  it('describes an empty result set', () => {
    const summary = buildFallbackSummary({
      query: 'parking',
      results: [],
      totalResults: 0,
      language: 'en',
      t: translate,
    });

    expect(summary).toBe('I couldn’t find any receipts matching “parking”.');
  });
});
