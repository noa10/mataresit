import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe2, MapPinned, Shield, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ledger/EmptyState";
import { MonogramTile } from "@/components/ledger/MonogramTile";
import { Panel } from "@/components/ledger/Panel";
import { StatusChip } from "@/components/ledger/StatusChip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGamification } from "@/contexts/GamificationContext";
import { useNavigationTranslation } from "@/contexts/LanguageContext";
import { gamificationQueryKeys } from "@/services/gamificationService";
import type { LeaderboardEntry, LeaderboardMetric } from "@/types/gamification";
import { cn } from "@/lib/utils";

const METRIC_ORDER: LeaderboardMetric[] = ["weekly_xp", "monthly_receipts", "deductible_total"];
const LEADERBOARD_LIMIT = 100;
const MALAYSIA_COUNTRY_CODE = "MY";
const LOCALE_BY_LANGUAGE = {
  en: "en-MY",
  ms: "ms-MY",
} as const;

const getLocale = (language: string) =>
  LOCALE_BY_LANGUAGE[language as keyof typeof LOCALE_BY_LANGUAGE] ?? LOCALE_BY_LANGUAGE.en;

const formatMetricValue = (
  metric: LeaderboardMetric,
  value: number,
  locale: string,
  t: (key: string, options?: Record<string, string | number>) => string
) => {
  if (metric === "deductible_total") {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "MYR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);

  if (metric === "weekly_xp") {
    return t("gamification.leaderboard.units.weeklyXp", { count: formatted });
  }

  return t("gamification.leaderboard.units.monthlyReceipts", { count: formatted });
};

const initialsFor = (name: string) => {
  const cleaned = name.replace(/[^A-Za-z0-9 ]/g, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "AN";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-[120px] animate-pulse rounded-[10px] border border-ledger-line bg-ledger-surface-2" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-[150px] animate-pulse rounded-[10px] border border-ledger-line bg-ledger-surface-2"
          />
        ))}
      </div>
      <div className="h-[320px] animate-pulse rounded-[10px] border border-ledger-line bg-ledger-surface-2" />
    </div>
  );
}

export default function LeaderboardPage() {
  const { t, language } = useNavigationTranslation();
  const { snapshot, isLoading: isSnapshotLoading, getLeaderboard } = useGamification();
  const [selectedMetric, setSelectedMetric] = useState<LeaderboardMetric>("weekly_xp");
  const [countryCode, setCountryCode] = useState<string | null>(null);

  const locale = getLocale(language);
  const optedIn = snapshot?.profile.leaderboardOptIn ?? false;

  const leaderboardQuery = useQuery({
    queryKey: gamificationQueryKeys.leaderboard(selectedMetric, countryCode),
    queryFn: () => getLeaderboard(selectedMetric, { countryCode, limit: LEADERBOARD_LIMIT }),
    // The privacy gate renders when participation is off, so don't issue a
    // ranking request in that state. UI-level rule only: the
    // get_gamification_leaderboard RPC does not require the *caller* to have
    // opted in (it only lists members who did), so direct API callers are
    // unaffected — see the migration if this needs enforcing server-side.
    enabled: !isSnapshotLoading && optedIn,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const metricMeta = useMemo(
    () =>
      Object.fromEntries(
        METRIC_ORDER.map((metric) => [
          metric,
          {
            label: t(`gamification.leaderboard.metrics.${metric}.label`),
            description: t(`gamification.leaderboard.metrics.${metric}.description`),
          },
        ])
      ),
    [t]
  );

  const sortedEntries = useMemo(
    () => [...(leaderboardQuery.data ?? [])].sort((left, right) => left.rank - right.rank),
    [leaderboardQuery.data]
  );
  const tableEntries = sortedEntries.filter((entry) => entry.rank <= LEADERBOARD_LIMIT);
  const currentUserEntry = sortedEntries.find((entry) => entry.isCurrentUser) ?? null;
  const podium = tableEntries.slice(0, 3);
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean) as LeaderboardEntry[];

  const renderValue = (entry: LeaderboardEntry) =>
    formatMetricValue(entry.metric, entry.value, locale, t);

  const weekLabel = (() => {
    const now = new Date();
    const day = now.getDay();
    const distanceToMonday = (day + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMonday);
    const formatted = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(monday);
    return t("gamification.leaderboard.weekOf", { date: formatted });
  })();

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-14 pt-8 md:px-7">
      <header className="flex flex-wrap items-end justify-between gap-[18px]">
        <div className="min-w-0">
          <p className="font-data text-[0.625rem] uppercase tracking-[0.16em] text-ledger-muted">
            {t("gamification.leaderboard.eyebrow")}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(2rem,3.2vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-ledger-ink">
            {t("mainMenu.leaderboard")}
          </h1>
          <p className="mt-2 max-w-[58ch] text-[0.9375rem] leading-relaxed text-ledger-muted">
            {t("gamification.leaderboardDescription")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="accent-outline" size="app" asChild>
            <Link to="/missions">{t("mainMenu.missions")}</Link>
          </Button>
          <Button variant="accent" size="app" asChild>
            <Link to="/profile?tab=rewards">
              <Shield className="mr-2 h-4 w-4" />
              {t("gamification.leaderboard.settingsCta")}
            </Link>
          </Button>
        </div>
      </header>

      {isSnapshotLoading ? (
        <div className="mt-7">
          <LeaderboardSkeleton />
        </div>
      ) : !optedIn ? (
        <div className="mt-7">
          <Panel title={t("gamification.leaderboard.privacyGateTitle")}>
            <div className="flex flex-col gap-5 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="max-w-[64ch] text-sm leading-relaxed text-ledger-muted">
                  {t("gamification.leaderboard.privacyGateDescription")}
                </p>
                <p className="mt-2 text-sm font-medium text-ledger-ink">
                  {t("gamification.leaderboard.privacyGateStatus")}
                </p>
              </div>
              <Button variant="accent" size="app" asChild>
                <Link to="/profile?tab=rewards">{t("gamification.leaderboard.privacyGateAction")}</Link>
              </Button>
            </div>
          </Panel>
        </div>
      ) : (
        <>
          <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
            <Tabs
              value={selectedMetric}
              onValueChange={(value) => setSelectedMetric(value as LeaderboardMetric)}
            >
              <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
                {METRIC_ORDER.map((metric) => (
                  <TabsTrigger
                    key={metric}
                    value={metric}
                    className="rounded-full border border-ledger-line-strong bg-transparent px-3.5 py-2 font-data text-[0.6875rem] tracking-[0.06em] text-ledger-ink-2 shadow-none data-[state=active]:border-ledger-ink data-[state=active]:bg-ledger-ink data-[state=active]:text-ledger-paper"
                  >
                    {metricMeta[metric].label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Leaderboard scope">
              <Button
                type="button"
                size="app"
                variant={countryCode === null ? "accent" : "accent-outline"}
                onClick={() => setCountryCode(null)}
              >
                <Globe2 className="mr-2 h-4 w-4" />
                {t("gamification.leaderboard.scopeGlobal")}
              </Button>
              <Button
                type="button"
                size="app"
                variant={countryCode === MALAYSIA_COUNTRY_CODE ? "accent" : "accent-outline"}
                onClick={() => setCountryCode(MALAYSIA_COUNTRY_CODE)}
              >
                <MapPinned className="mr-2 h-4 w-4" />
                {t("gamification.leaderboard.scopeMalaysia")}
              </Button>
            </div>
          </div>

          <p className="mt-3 text-sm text-ledger-muted">{metricMeta[selectedMetric].description}</p>

          {leaderboardQuery.isLoading ? (
            <div className="mt-4">
              <LeaderboardSkeleton />
            </div>
          ) : leaderboardQuery.isError ? (
            <div className="mt-4">
              <Panel title={t("gamification.leaderboard.tableTitle")}>
                <div className="flex flex-col items-start gap-3 py-4">
                  <p className="text-sm text-ledger-muted">
                    {t("gamification.leaderboard.emptyDescription")}
                  </p>
                  <Button
                    variant="accent-outline"
                    size="app"
                    onClick={() => leaderboardQuery.refetch()}
                  >
                    {t("gamification.leaderboard.retry")}
                  </Button>
                </div>
              </Panel>
            </div>
          ) : tableEntries.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={<Trophy className="h-7 w-7" />}
                title={t("gamification.leaderboard.emptyTitle")}
                description={t("gamification.leaderboard.emptyDescription")}
              />
            </div>
          ) : (
            <>
              <Panel className="mt-4" title={t("gamification.leaderboard.currentUserTitle")} action={weekLabel}>
                <div className="flex flex-wrap items-center gap-6 py-1">
                  {currentUserEntry ? (
                    <>
                      <p className="font-data text-[2rem] font-medium leading-none text-ledger-ink">
                        #{currentUserEntry.rank}
                      </p>
                      <div className="min-w-[200px] flex-1">
                        <div className="h-[7px] overflow-hidden rounded-full bg-ledger-surface-2">
                          <span
                            className="block h-full rounded-full bg-ledger-accent"
                            style={{
                              width: `${
                                currentUserEntry.rank <= 10
                                  ? 100
                                  : Math.min(
                                      100,
                                      (currentUserEntry.value /
                                        Math.max(currentUserEntry.value + (currentUserEntry.gapToTopTen ?? 0), 1)) *
                                        100
                                    )
                              }%`,
                            }}
                          />
                        </div>
                        <p className="mt-2 font-data text-[0.625rem] text-ledger-muted">
                          {renderValue(currentUserEntry)}
                        </p>
                        <p className="mt-1.5 text-sm text-ledger-muted">
                          {currentUserEntry.rank <= 10
                            ? t("gamification.leaderboard.currentUserTopTen")
                            : t("gamification.leaderboard.currentUserGap", {
                                amount: formatMetricValue(
                                  selectedMetric,
                                  currentUserEntry.gapToTopTen ?? 0,
                                  locale,
                                  t
                                ),
                              })}
                        </p>
                        <p className="mt-1 text-sm font-medium text-ledger-ink">
                          {t("gamification.leaderboard.currentUserRank", {
                            rank: currentUserEntry.rank,
                          })}
                        </p>
                      </div>
                      <StatusChip tone="reviewed" label={t("gamification.leaderboard.optedIn")} />
                    </>
                  ) : (
                    <p className="text-sm text-ledger-muted">
                      {t("gamification.leaderboard.currentUserUnranked")}
                    </p>
                  )}
                </div>
              </Panel>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {podiumOrder.map((entry) => {
                  const first = entry.rank === 1;
                  return (
                    <article
                      key={`${entry.userId}-${entry.rank}`}
                      className={cn(
                        "rounded-[10px] border border-ledger-line bg-ledger-surface p-[18px] text-center",
                        first && "border-ledger-accent shadow-sm"
                      )}
                    >
                      <p className="font-data text-[0.625rem] uppercase tracking-[0.14em] text-ledger-muted">
                        #{entry.rank}
                      </p>
                      <div className="mt-2.5 flex justify-center">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex h-11 w-11 items-center justify-center rounded-full font-data text-[0.75rem]",
                            first
                              ? "bg-ledger-accent text-white"
                              : "bg-ledger-panel text-ledger-on-panel"
                          )}
                        >
                          {initialsFor(entry.displayName)}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-sm font-semibold text-ledger-ink">
                        {entry.displayName}
                      </p>
                      <p className="mt-1 font-data text-[1.05rem] font-medium text-ledger-ink">
                        {renderValue(entry)}
                      </p>
                    </article>
                  );
                })}
              </div>

              <Panel
                className="mt-3"
                title={t("gamification.leaderboard.tableTitle")}
                action={
                  <span className="font-data text-[0.625rem] text-ledger-muted">
                    {t("gamification.leaderboard.tableNote")}
                  </span>
                }
                flush
              >
                <div className="border-t border-ledger-line">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-ledger-line bg-ledger-surface-2 hover:bg-ledger-surface-2">
                        <TableHead className="w-[72px] font-data text-[0.58rem] uppercase tracking-[0.16em] text-ledger-muted">
                          {t("gamification.leaderboard.rankHeader")}
                        </TableHead>
                        <TableHead className="font-data text-[0.58rem] uppercase tracking-[0.16em] text-ledger-muted">
                          {t("gamification.leaderboard.memberHeader")}
                        </TableHead>
                        <TableHead className="text-right font-data text-[0.58rem] uppercase tracking-[0.16em] text-ledger-muted">
                          {t("gamification.leaderboard.metricHeader")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableEntries.map((entry) => (
                        <TableRow
                          key={`${entry.userId}-${entry.rank}`}
                          className={cn(
                            "border-ledger-line",
                            entry.isCurrentUser && "bg-ledger-accent-soft/60 hover:bg-ledger-accent-soft"
                          )}
                        >
                          <TableCell className="font-data text-[0.75rem] text-ledger-ink">
                            #{entry.rank}
                          </TableCell>
                          <TableCell>
                            <div className="flex min-w-0 items-center gap-2.5">
                              <MonogramTile name={entry.displayName} className="h-[30px] w-[30px] rounded-full" />
                              <span className="min-w-0">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-sm font-semibold text-ledger-ink">
                                    {entry.displayName}
                                  </span>{" "}
                                  {entry.isCurrentUser ? (
                                    <span className="rounded-full bg-ledger-panel px-2 py-0.5 font-data text-[0.5625rem] uppercase tracking-[0.1em] text-ledger-on-panel">
                                      {t("gamification.leaderboard.badgeYou")}
                                    </span>
                                  ) : entry.isAnonymous ? (
                                    <span className="rounded-full bg-ledger-surface-2 px-2 py-0.5 font-data text-[0.5625rem] uppercase tracking-[0.1em] text-ledger-ink-2">
                                      {t("gamification.leaderboard.badgeAnonymous")}
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-data text-[0.75rem] text-ledger-ink">
                            {renderValue(entry)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="border-t border-ledger-line px-[18px] py-3 font-data text-[0.625rem] text-ledger-muted">
                  {t("gamification.leaderboard.anonymousNote")}
                </p>
              </Panel>
            </>
          )}
        </>
      )}
    </div>
  );
}
