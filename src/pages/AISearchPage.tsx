import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseISO } from "date-fns";
import { ArrowUpRight, Loader2, Search as SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MonogramTile } from "@/components/ledger/MonogramTile";
import { Panel } from "@/components/ledger/Panel";
import { ReceiptDetailSheet } from "@/components/receipts/ReceiptDetailSheet";
import { useDashboardTranslation, useLanguage } from "@/contexts/LanguageContext";
import { unifiedSearch } from "@/lib/ai-search";
import type { UnifiedSearchResult } from "@/types/unified-search";
import { formatCurrencySafe } from "@/utils/currency";

function Highlight({ text, query }: { text: string; query: string }) {
  const parts = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [text];
    try {
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return text.split(new RegExp(`(${escaped})`, "ig"));
    } catch {
      return [text];
    }
  }, [text, query]);

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.trim().toLowerCase() && part ? (
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
  return new Intl.DateTimeFormat(language === "ms" ? "ms-MY" : "en-MY", {
    day: "numeric",
    month: "short",
  }).format(parsed);
};

const resultKindKey = (sourceType: UnifiedSearchResult["sourceType"]): string => {
  switch (sourceType) {
    case "receipt":
      return "receipt";
    case "claim":
      return "claim";
    case "team_member":
      return "member";
    case "custom_category":
      return "category";
    case "business_directory":
      return "business";
    default:
      return "result";
  }
};

export default function AISearchPage() {
  const { t } = useDashboardTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [duration, setDuration] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  const exampleQueries = [
    t("workspace.search.example1"),
    t("workspace.search.example2"),
    t("workspace.search.example3"),
    t("workspace.search.example4"),
  ];

  const runSearch = async (nextQuery: string) => {
    const trimmed = nextQuery.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setHasSearched(true);
    setSubmittedQuery(trimmed);

    try {
      const response = await unifiedSearch({
        query: trimmed,
        sources: ["receipts"],
        limit: 20,
        offset: 0,
        similarityThreshold: 0.2,
        includeMetadata: true,
        aggregationMode: "relevance",
        filters: { language },
      });

      if (!response.success) {
        throw new Error(response.error || "Search failed");
      }

      setResults(response.results);
      setDuration(response.searchMetadata?.searchDuration ?? null);
    } catch (error) {
      console.error("AI search failed", error);
      toast.error(t("workspace.search.failed"));
      setResults([]);
      setDuration(null);
    } finally {
      setIsLoading(false);
    }
  };

  const openResult = (result: UnifiedSearchResult) => {
    if (result.sourceType === "receipt") {
      const receiptId =
        (result.metadata?.receipt_id as string | undefined) ||
        (result.metadata?.receiptId as string | undefined) ||
        result.sourceId ||
        result.id;
      if (receiptId) {
        setSelectedReceiptId(receiptId);
        return;
      }
    }
    if (result.sourceType === "claim" && result.sourceId) {
      navigate(`/claims/${result.sourceId}`);
    }
  };

  const resultCount = results.length;
  const timingLabel =
    duration !== null
      ? t("workspace.search.timing", { seconds: (duration / 1000).toFixed(2) })
      : null;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-14 pt-8 md:px-7">
      <header>
        <p className="font-data text-[0.625rem] uppercase tracking-[0.16em] text-ledger-muted">
          {t("workspace.search.eyebrow")}
        </p>
        <h1 className="mt-1.5 font-display text-[clamp(2rem,3.2vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-ledger-ink">
          {t("workspace.search.title")}
        </h1>
        <p className="mt-2 max-w-[58ch] text-[0.9375rem] leading-relaxed text-ledger-muted">
          {t("workspace.search.lede")}
        </p>
      </header>

      <form
        className="mt-7 flex flex-col gap-2.5 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch(query);
        }}
      >
        <label className="sr-only" htmlFor="ai-search-input">
          {t("workspace.search.placeholder")}
        </label>
        <input
          id="ai-search-input"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("workspace.search.placeholder")}
          className="h-[54px] min-w-0 flex-1 rounded-[8px] border border-ledger-line-strong bg-ledger-surface px-4 text-[0.9375rem] text-ledger-ink placeholder:text-ledger-muted/80 focus:border-ledger-accent focus:outline-none focus:ring-[3px] focus:ring-ledger-accent/15"
        />
        <Button
          type="submit"
          variant="accent"
          size="app"
          className="h-[54px] rounded-[8px] px-6"
          disabled={isLoading || !query.trim()}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <SearchIcon className="mr-2 h-4 w-4" />
          )}
          {isLoading ? t("workspace.search.searching") : t("workspace.search.submit")}
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2" aria-label={t("workspace.search.examples")}>
        {exampleQueries.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setQuery(example);
              void runSearch(example);
            }}
            className="rounded-full border border-ledger-line bg-ledger-surface px-3 py-1.5 text-xs text-ledger-ink-2 transition-colors hover:border-ledger-line-strong hover:bg-ledger-surface-2"
          >
            {example}
          </button>
        ))}
      </div>

      <Panel
        className="mt-7"
        title={t("workspace.search.results")}
        action={
          hasSearched && !isLoading ? (
            <span className="font-data text-[0.6875rem] tracking-[0.04em] text-ledger-muted">
              {t("workspace.search.matches", { count: resultCount })}
              {timingLabel ? ` · ${timingLabel}` : ""}
            </span>
          ) : null
        }
        flush
      >
        {isLoading ? (
          <div className="grid gap-3 p-[18px]">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-[62px] animate-pulse rounded-[7px] bg-ledger-surface-2"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : !hasSearched ? (
          <div className="grid justify-items-center gap-2 px-6 py-14 text-center">
            <SearchIcon className="h-6 w-6 text-ledger-line-strong" />
            <h3 className="text-base font-semibold text-ledger-ink">
              {t("workspace.search.startTitle")}
            </h3>
            <p className="max-w-[42ch] text-sm text-ledger-muted">
              {t("workspace.search.startLede")}
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="grid justify-items-center gap-2 px-6 py-14 text-center">
            <SearchIcon className="h-6 w-6 text-ledger-line-strong" />
            <h3 className="text-base font-semibold text-ledger-ink">
              {t("workspace.search.emptyTitle")}
            </h3>
            <p className="max-w-[42ch] text-sm text-ledger-muted">
              {t("workspace.search.emptyLede", { query: submittedQuery })}
            </p>
          </div>
        ) : (
          <ul>
            {results.map((result) => {
              const amount = Number(
                result.metadata?.total ?? result.metadata?.amount ?? NaN
              );
              const currency = (result.metadata?.currency as string | undefined) || "MYR";
              const date = formatResultDate(
                (result.metadata?.date as string | undefined) || result.createdAt,
                language
              );
              const snippet =
                (result.metadata?.line_item as string | undefined) ||
                result.description ||
                "";

              return (
                <li key={`${result.sourceType}-${result.id}`}>
                  <button
                    type="button"
                    onClick={() => openResult(result)}
                    className="flex w-full items-center gap-3 border-t border-ledger-line px-[18px] py-3 text-left transition-colors first:border-t-0 hover:bg-ledger-surface-2 focus-visible:bg-ledger-surface-2 focus-visible:outline-none"
                  >
                    <MonogramTile name={result.title} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.875rem] font-semibold text-ledger-ink">
                        {result.title}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-ledger-muted">
                        <Highlight text={snippet} query={submittedQuery} />
                        {date ? ` · ${date}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-right">
                      <span className="min-w-0">
                        {Number.isFinite(amount) && (
                          <span className="block font-data text-[0.8125rem] font-medium tabular-nums text-ledger-ink">
                            {formatCurrencySafe(amount, currency)}
                          </span>
                        )}
                        <span className="mt-0.5 block font-data text-[0.6rem] uppercase tracking-[0.1em] text-ledger-muted">
                          {t(`workspace.search.kinds.${resultKindKey(result.sourceType)}`)}
                        </span>
                      </span>
                      <ArrowUpRight className="hidden h-4 w-4 text-ledger-line-strong sm:block" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <ReceiptDetailSheet
        receiptId={selectedReceiptId}
        onOpenChange={(open) => {
          if (!open) setSelectedReceiptId(null);
        }}
      />
    </div>
  );
}
