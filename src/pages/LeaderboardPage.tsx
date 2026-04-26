import { useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Globe2, MapPinned, Receipt, Shield, Sparkles, Trophy, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { useNavigationTranslation } from "@/contexts/LanguageContext";
import { useGamification } from "@/contexts/GamificationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { gamificationQueryKeys } from "@/services/gamificationService";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry, LeaderboardMetric } from "@/types/gamification";

const METRIC_ORDER: LeaderboardMetric[] = ["weekly_xp", "monthly_receipts", "deductible_total"];
const LEADERBOARD_LIMIT = 100;
const MALAYSIA_COUNTRY_CODE = "MY";
const LEADERBOARD_LOCALE_BY_LANGUAGE = {
  en: "en-MY",
  ms: "ms-MY",
} as const;

const formatMetricValue = (
  metric: LeaderboardMetric,
  value: number,
  locale: string,
  t: (key: string, options?: Record<string, string | number>) => string,
) => {
  if (metric === "deductible_total") {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "MYR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);

  if (metric === "weekly_xp") {
    return t("gamification.leaderboard.units.weeklyXp", { count: formatted });
  }

  return t("gamification.leaderboard.units.monthlyReceipts", { count: formatted });
};

const metricIconMap: Record<LeaderboardMetric, typeof Sparkles> = {
  weekly_xp: Sparkles,
  monthly_receipts: Receipt,
  deductible_total: Wallet,
};

function LeaderboardLoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl lg:w-64" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

export default function LeaderboardPage() {
  const { t, language } = useNavigationTranslation();
  const { snapshot, isLoading: isSnapshotLoading, getLeaderboard } = useGamification();
  const [selectedMetric, setSelectedMetric] = useState<LeaderboardMetric>("weekly_xp");
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const leaderboardLocale = LEADERBOARD_LOCALE_BY_LANGUAGE[language] ?? LEADERBOARD_LOCALE_BY_LANGUAGE.en;

  const leaderboardQuery = useQuery({
    queryKey: gamificationQueryKeys.leaderboard(selectedMetric, countryCode),
    queryFn: () => getLeaderboard(selectedMetric, { countryCode, limit: LEADERBOARD_LIMIT }),
    enabled: !isSnapshotLoading,
  });

  const metricMeta = useMemo(() => Object.fromEntries(METRIC_ORDER.map((metric) => [metric, {
    label: t(`gamification.leaderboard.metrics.${metric}.label`),
    description: t(`gamification.leaderboard.metrics.${metric}.description`),
  }])), [t]);

  const metricIcon = metricIconMap[selectedMetric];
  const sortedEntries = useMemo(
    () => [...(leaderboardQuery.data ?? [])].sort((left, right) => left.rank - right.rank),
    [leaderboardQuery.data],
  );
  const topTableEntries = sortedEntries.filter((entry) => entry.rank <= LEADERBOARD_LIMIT);
  const currentUserEntry = sortedEntries.find((entry) => entry.isCurrentUser) ?? null;
  const podiumEntries = topTableEntries.slice(0, 3);
  const leaderboardOptIn = snapshot?.profile.leaderboardOptIn ?? false;

  const renderMetricValue = (entry: LeaderboardEntry) => formatMetricValue(entry.metric, entry.value, leaderboardLocale, t);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <main className="container max-w-6xl px-4 py-8">
        <Button asChild variant="ghost" className="mb-6 gap-2">
          <Link to="/dashboard"><ChevronLeft className="h-4 w-4" />{t("gamification.backToDashboard")}</Link>
        </Button>
        <div className="space-y-6">
          <Card>
            <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle className="flex items-center gap-2 text-2xl"><Trophy className="h-5 w-5 text-primary" />{t("mainMenu.leaderboard")}</CardTitle>
                  <Badge variant="secondary" className="gap-1"><Shield className="h-3.5 w-3.5" />{t("gamification.leaderboard.privacyBadge")}</Badge>
                </div>
                <CardDescription className="max-w-3xl text-sm md:text-base">
                  {t("gamification.leaderboardDescription")}
                </CardDescription>
              </div>
              <Button asChild variant="outline" className="gap-2">
                <Link to="/profile?tab=rewards"><Shield className="h-4 w-4" />{t("gamification.leaderboard.settingsCta")}</Link>
              </Button>
            </CardHeader>
          </Card>

          {isSnapshotLoading ? (
            <LeaderboardLoadingState />
          ) : !leaderboardOptIn ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("gamification.leaderboard.privacyGateTitle")}</CardTitle>
                <CardDescription>{t("gamification.leaderboard.privacyGateDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-muted-foreground">{t("gamification.leaderboard.privacyGateStatus")}</p>
                <Button asChild>
                  <Link to="/profile?tab=rewards">{t("gamification.leaderboard.privacyGateAction")}</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-3">
                    <Tabs value={selectedMetric} onValueChange={(value) => setSelectedMetric(value as LeaderboardMetric)}>
                      <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
                        {METRIC_ORDER.map((metric) => {
                          const Icon = metricIconMap[metric];
                          return (
                            <TabsTrigger key={metric} value={metric} className="gap-2 rounded-full border px-4 py-2 data-[state=active]:border-primary data-[state=active]:text-primary">
                              <Icon className="h-4 w-4" />
                              {metricMeta[metric].label}
                            </TabsTrigger>
                          );
                        })}
                      </TabsList>
                    </Tabs>
                    <p className="text-sm text-muted-foreground">{metricMeta[selectedMetric].description}</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border bg-background p-1">
                    <Button type="button" variant={countryCode === null ? "default" : "ghost"} size="sm" className="gap-2 rounded-full" onClick={() => setCountryCode(null)}>
                      <Globe2 className="h-4 w-4" />
                      {t("gamification.leaderboard.scopeGlobal")}
                    </Button>
                    <Button type="button" variant={countryCode === MALAYSIA_COUNTRY_CODE ? "default" : "ghost"} size="sm" className="gap-2 rounded-full" onClick={() => setCountryCode(MALAYSIA_COUNTRY_CODE)}>
                      <MapPinned className="h-4 w-4" />
                      {t("gamification.leaderboard.scopeMalaysia")}
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              {leaderboardQuery.isLoading ? (
                <LeaderboardLoadingState />
              ) : topTableEntries.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("gamification.leaderboard.emptyTitle")}</CardTitle>
                    <CardDescription>{t("gamification.leaderboard.emptyDescription")}</CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t("gamification.leaderboard.currentUserTitle")}</CardTitle>
                        <CardDescription>{metricMeta[selectedMetric].description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {currentUserEntry ? (
                          <>
                            <div>
                              <p className="text-3xl font-semibold tracking-tight">{t("gamification.leaderboard.currentUserRank", { rank: currentUserEntry.rank })}</p>
                              <p className="mt-2 text-sm text-muted-foreground">{renderMetricValue(currentUserEntry)}</p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {currentUserEntry.rank <= 10
                                ? t("gamification.leaderboard.currentUserTopTen")
                                : t("gamification.leaderboard.currentUserGap", {
                                    amount: formatMetricValue(selectedMetric, currentUserEntry.gapToTopTen ?? 0, leaderboardLocale, t),
                                  })}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">{t("gamification.leaderboard.currentUserUnranked")}</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>{t("gamification.leaderboard.topThreeTitle")}</CardTitle>
                        <CardDescription>{t("gamification.leaderboard.topThreeDescription")}</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-3 md:grid-cols-3">
                        {podiumEntries.map((entry) => {
                          const Icon = metricIcon;
                          return (
                            <div key={`${entry.userId}-${entry.rank}`} className={cn("rounded-xl border bg-muted/30 p-4", entry.isCurrentUser && "border-primary bg-primary/5")}>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">#{entry.rank}</p>
                                  <p className="mt-2 font-semibold text-foreground">{entry.displayName}</p>
                                </div>
                                <Icon className="h-4 w-4 text-primary" />
                              </div>
                              <p className="mt-3 text-sm text-muted-foreground">{renderMetricValue(entry)}</p>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>{t("gamification.leaderboard.tableTitle")}</CardTitle>
                      <CardDescription>{t("gamification.leaderboard.tableDescription")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-20">{t("gamification.leaderboard.rankHeader")}</TableHead>
                            <TableHead>{t("gamification.leaderboard.memberHeader")}</TableHead>
                            <TableHead className="text-right">{t("gamification.leaderboard.metricHeader")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {topTableEntries.map((entry) => (
                            <TableRow key={`${entry.userId}-${entry.rank}`} className={cn(entry.isCurrentUser && "bg-primary/5 hover:bg-primary/10")}>
                              <TableCell className="font-medium">#{entry.rank}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span>{entry.displayName}</span>
                                  {entry.isCurrentUser && <Badge variant="default">{t("gamification.leaderboard.badgeYou")}</Badge>}
                                  {!entry.isCurrentUser && entry.isAnonymous && <Badge variant="outline">{t("gamification.leaderboard.badgeAnonymous")}</Badge>}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium">{renderMetricValue(entry)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}