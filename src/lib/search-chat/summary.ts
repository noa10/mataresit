import { parseISO } from 'date-fns';
import type { UnifiedSearchResult } from '@/types/unified-search';
import { formatCurrencySafe } from '@/utils/currency';

interface BuildFallbackSummaryArgs {
  query: string;
  results: UnifiedSearchResult[];
  totalResults?: number;
  language: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}

const localeFor = (language: string) => (language === 'ms' ? 'ms-MY' : 'en-MY');

const readableDate = (value: string | undefined): Date | null => {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (date: Date, language: string): string =>
  new Intl.DateTimeFormat(localeFor(language), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);

const resultMerchant = (result: UnifiedSearchResult): string | null => {
  const merchant =
    (result.metadata?.merchant as string | undefined) ||
    (result.metadata?.parent_receipt_merchant as string | undefined) ||
    result.title;
  return merchant?.trim() || null;
};

/**
 * Deterministic, localized summary used when the Edge Function cannot return
 * an AI-written narrative (missing key, timeout, or an older response shape).
 */
export function buildFallbackSummary({
  query,
  results,
  totalResults,
  language,
  t,
}: BuildFallbackSummaryArgs): string {
  if (results.length === 0) {
    return t('workspace.search.chat.fallback.none', { query });
  }

  const count = totalResults && totalResults > results.length ? totalResults : results.length;
  const parts = [t('workspace.search.chat.fallback.found', { count, query })];

  if (!totalResults || totalResults <= results.length) {
    const total = results.reduce((sum, result) => {
      const value = Number(result.metadata?.total ?? result.metadata?.amount ?? NaN);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);

    if (total > 0) {
      parts.push(
        t('workspace.search.chat.fallback.shownTotal', {
          amount: formatCurrencySafe(total, 'MYR', localeFor(language)),
        })
      );
    }
  }

  const dates = results
    .map((result) =>
      readableDate((result.metadata?.date as string | undefined) || result.createdAt)
    )
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length > 0) {
    parts.push(
      t('workspace.search.chat.fallback.span', {
        start: formatDate(dates[0], language),
        end: formatDate(dates[dates.length - 1], language),
      })
    );
  }

  const merchantCounts = new Map<string, number>();
  results.forEach((result) => {
    const merchant = resultMerchant(result);
    if (merchant) {
      merchantCounts.set(merchant, (merchantCounts.get(merchant) || 0) + 1);
    }
  });

  const topMerchants = Array.from(merchantCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([merchant]) => merchant);

  if (topMerchants.length > 0) {
    parts.push(
      t('workspace.search.chat.fallback.merchants', {
        merchants: topMerchants.join(', '),
      })
    );
  }

  return parts.join(' ');
}
