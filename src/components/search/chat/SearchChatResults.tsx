import { useMemo } from 'react';
import { parseISO } from 'date-fns';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MonogramTile } from '@/components/ledger/MonogramTile';
import { useDashboardTranslation, useLanguage } from '@/contexts/LanguageContext';
import { formatCurrencySafe } from '@/utils/currency';
import type { UnifiedSearchResult } from '@/types/unified-search';

interface SearchChatResultsProps {
  results: UnifiedSearchResult[];
  query: string;
  totalResults?: number;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  isBusy?: boolean;
  onShowMore: () => void;
  onOpenResult: (result: UnifiedSearchResult) => void;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const parts = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [text];
    try {
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return text.split(new RegExp(`(${escaped})`, 'ig'));
    } catch {
      return [text];
    }
  }, [text, query]);

  const trimmedQuery = query.trim().toLowerCase();

  return (
    <>
      {parts.map((part, index) =>
        part && part.toLowerCase() === trimmedQuery ? (
          <mark key={index} className="bg-ledger-amber-soft text-ledger-ink">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

const formatResultDate = (value: string | undefined, language: string): string | null => {
  if (!value) return null;
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(language === 'ms' ? 'ms-MY' : 'en-MY', {
    day: 'numeric',
    month: 'short',
  }).format(parsed);
};

const resultKindKey = (sourceType: UnifiedSearchResult['sourceType']): string => {
  switch (sourceType) {
    case 'receipt':
      return 'receipt';
    case 'claim':
      return 'claim';
    case 'team_member':
      return 'member';
    case 'custom_category':
      return 'category';
    case 'business_directory':
      return 'business';
    default:
      return 'result';
  }
};

export function SearchChatResults({
  results,
  query,
  totalResults,
  hasMore = false,
  isLoadingMore = false,
  isBusy = false,
  onShowMore,
  onOpenResult,
}: SearchChatResultsProps) {
  const { t } = useDashboardTranslation();
  const { language } = useLanguage();

  if (results.length === 0) return null;

  const total = totalResults ?? results.length;

  return (
    <div className="mt-3">
      <p className="mb-2 font-data text-[0.6875rem] uppercase tracking-[0.08em] text-ledger-muted">
        {t('workspace.search.chat.loaded', { loaded: results.length, total })}
      </p>

      <ul className="overflow-hidden rounded-[8px] border border-ledger-line bg-ledger-surface">
        {results.map((result) => {
          const amount = Number(result.metadata?.total ?? result.metadata?.amount ?? NaN);
          const currency = (result.metadata?.currency as string | undefined) || 'MYR';
          const date = formatResultDate(
            (result.metadata?.date as string | undefined) || result.createdAt,
            language
          );
          const snippet =
            (result.metadata?.line_item as string | undefined) || result.description || '';

          return (
            <li key={`${result.sourceType}-${result.id}`}>
              <button
                type="button"
                onClick={() => onOpenResult(result)}
                className="flex w-full items-center gap-3 border-t border-ledger-line px-3 py-2.5 text-left transition-colors first:border-t-0 hover:bg-ledger-surface-2 focus-visible:bg-ledger-surface-2 focus-visible:outline-none"
              >
                <MonogramTile name={result.title} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] font-semibold text-ledger-ink">
                    {result.title}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-ledger-muted">
                    <Highlight text={snippet} query={query} />
                    {date ? ` · ${date}` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-right">
                  <span className="min-w-0">
                    {Number.isFinite(amount) && (
                      <span className="block font-data text-[0.75rem] font-medium tabular-nums text-ledger-ink">
                        {formatCurrencySafe(
                          amount,
                          currency,
                          language === 'ms' ? 'ms-MY' : 'en-MY'
                        )}
                      </span>
                    )}
                    <span className="mt-0.5 block font-data text-[0.55rem] uppercase tracking-[0.1em] text-ledger-muted">
                      {t(`workspace.search.kinds.${resultKindKey(result.sourceType)}`)}
                    </span>
                  </span>
                  <ArrowUpRight
                    className="hidden h-3.5 w-3.5 text-ledger-line-strong sm:block"
                    aria-hidden="true"
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <div className="mt-2 flex justify-center">
          <Button
            type="button"
            variant="accent-outline"
            size="sm"
            onClick={onShowMore}
            disabled={isLoadingMore || isBusy}
          >
            {isLoadingMore && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {isLoadingMore
              ? t('workspace.search.chat.loadingMore')
              : t('workspace.search.chat.showMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
