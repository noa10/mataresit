import { useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Clock3, Sparkles, Target, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigationTranslation } from "@/contexts/LanguageContext";
import { useGamification } from "@/contexts/GamificationContext";
import { cn } from "@/lib/utils";
import { gamificationQueryKeys } from "@/services/gamificationService";
import type { MissionProgress, MissionType } from "@/types/gamification";

const MISSION_TYPE_ORDER: MissionType[] = ["one_time", "weekly", "community"];
const LOCALE_BY_LANGUAGE = {
  en: "en-MY",
  ms: "ms-MY",
} as const;

const getLocale = (language: string) => LOCALE_BY_LANGUAGE[language as keyof typeof LOCALE_BY_LANGUAGE] ?? "en-MY";

const formatCount = (value: number, locale: string) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
const formatCurrency = (value: number, locale: string) => new Intl.NumberFormat(locale, {
  style: "currency",
  currency: "MYR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format(value);

const formatObjectiveValue = (
  mission: MissionProgress["mission"],
  value: number,
  locale: string,
  t: (key: string, options?: Record<string, unknown>) => string,
) => {
  const formattedValue = formatCount(value, locale);

  if (!mission) return formattedValue;
  if (mission.objectiveType === "deductible_total_amount") return formatCurrency(value, locale);
  if (mission.objectiveType === "xp_earned") return `${formattedValue} XP`;
  if (mission.objectiveType === "scan_streak_days") {
    return t("gamification.missions.units.scanStreakDays", { count: formattedValue });
  }

  return formattedValue;
};

const formatMissionWindow = (mission: MissionProgress["mission"], fallback: string, locale: string) => {
  if (!mission?.startsAt && !mission?.endsAt) return fallback;

  const formatter = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const start = mission.startsAt ? formatter.format(new Date(mission.startsAt)) : null;
  const end = mission.endsAt ? formatter.format(new Date(mission.endsAt)) : null;

  if (start && end) return `${start} – ${end}`;
  return start ?? end ?? fallback;
};

function MissionCard({ missionProgress, language, t }: {
  missionProgress: MissionProgress;
  language: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const mission = missionProgress.mission;
  const isCommunity = mission?.missionType === "community";
  const locale = getLocale(language);
  const displayCurrent = isCommunity ? missionProgress.communityCurrentValue ?? missionProgress.currentValue : missionProgress.currentValue;
  const displayTarget = isCommunity ? missionProgress.communityTargetValue ?? missionProgress.targetValue : missionProgress.targetValue;
  const progressValue = displayTarget > 0 ? Math.min(100, Math.round((displayCurrent / displayTarget) * 100)) : 0;
  const isComplete = Boolean(missionProgress.claimedAt ?? missionProgress.completedAt ?? (isCommunity && missionProgress.communityCompletedAt));
  const statusKey = isComplete ? "complete" : isCommunity ? "community" : "inProgress";

  return (
    <Card className={cn("h-full", isComplete && "border-primary/40 bg-primary/5")}>
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{t(`gamification.missions.tabs.${mission?.missionType ?? "one_time"}`)}</Badge>
              <Badge variant={isComplete ? "default" : "secondary"}>{t(`gamification.missions.status.${statusKey}`)}</Badge>
            </div>
            <CardTitle className="text-xl">{mission?.title ?? t("gamification.missions.emptyTitle")}</CardTitle>
            <CardDescription>{mission?.description ?? t("gamification.missions.emptyDescription")}</CardDescription>
          </div>
          <Badge variant="secondary" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" />+{mission?.rewardXp ?? 0} XP</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t(isCommunity ? "gamification.missions.communityProgress" : "gamification.missions.personalProgress")}</span>
            <span className="font-medium text-foreground">
              {formatObjectiveValue(mission, displayCurrent, locale, t)} / {formatObjectiveValue(mission, displayTarget, locale, t)}
            </span>
          </div>
          <Progress value={progressValue} aria-label={mission?.title ?? "Mission progress"} />
        </div>

        <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          <div className="rounded-lg border bg-background/80 p-3">
            <p className="font-medium text-foreground">{t("gamification.missions.windowLabel")}</p>
            <p className="mt-1">{formatMissionWindow(mission, t("gamification.missions.windowLifetime"), locale)}</p>
          </div>
          <div className="rounded-lg border bg-background/80 p-3">
            <p className="font-medium text-foreground">{t("gamification.missions.rewardLabel")}</p>
            <p className="mt-1">+{mission?.rewardXp ?? 0} XP</p>
          </div>
        </div>

        {isCommunity ? (
          <div className="rounded-lg border border-dashed bg-background/80 p-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 font-medium text-foreground"><Users className="h-4 w-4 text-primary" />{t("gamification.missions.communityContributionTitle")}</div>
            <p className="mt-2">
              {t("gamification.missions.communityContributionBody")}: {formatObjectiveValue(mission, missionProgress.currentValue, locale, t)}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MissionsLoadingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export default function MissionsPage() {
  const { language, t } = useNavigationTranslation();
  const { snapshot, isLoading: isSnapshotLoading, getMissions } = useGamification();
  const [selectedType, setSelectedType] = useState<MissionType>("one_time");

  const missionsQuery = useQuery({
    queryKey: gamificationQueryKeys.missions(snapshot?.profile.userId ?? "anonymous"),
    queryFn: () => getMissions(),
    initialData: snapshot?.activeMissions,
    enabled: !isSnapshotLoading,
  });

  const missions = useMemo(
    () => missionsQuery.data ?? snapshot?.activeMissions ?? [],
    [missionsQuery.data, snapshot?.activeMissions],
  );
  const summary = useMemo(() => {
    const completed = missions.filter((mission) => Boolean(mission.claimedAt ?? mission.completedAt ?? mission.communityCompletedAt)).length;
    const rewardXp = missions.reduce((total, mission) => total + (mission.mission?.rewardXp ?? 0), 0);
    return { total: missions.length, completed, rewardXp };
  }, [missions]);
  const groupedMissions = useMemo(
    () => Object.fromEntries(MISSION_TYPE_ORDER.map((type) => [type, missions.filter((mission) => mission.mission?.missionType === type)])) as Record<MissionType, MissionProgress[]>,
    [missions],
  );

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
                  <CardTitle className="flex items-center gap-2 text-2xl"><Target className="h-5 w-5 text-primary" />{t("mainMenu.missions")}</CardTitle>
                  <Badge variant="secondary" className="gap-1"><Clock3 className="h-3.5 w-3.5" />{t("gamification.missions.liveBadge")}</Badge>
                </div>
                <CardDescription className="max-w-3xl text-sm md:text-base">{t("gamification.missionsDescription")}</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>{t("gamification.missions.summary.active")}</CardDescription>
                <CardTitle className="text-3xl">{summary.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>{t("gamification.missions.summary.completed")}</CardDescription>
                <CardTitle className="text-3xl">{summary.completed}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>{t("gamification.missions.summary.rewards")}</CardDescription>
                <CardTitle className="text-3xl">+{summary.rewardXp} XP</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {isSnapshotLoading || missionsQuery.isLoading ? (
            <MissionsLoadingState />
          ) : (
            <Tabs value={selectedType} onValueChange={(value) => setSelectedType(value as MissionType)}>
              <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
                {MISSION_TYPE_ORDER.map((type) => (
                  <TabsTrigger key={type} value={type} className="rounded-full border px-4 py-2 data-[state=active]:border-primary data-[state=active]:text-primary">
                    {t(`gamification.missions.tabs.${type}`)}
                  </TabsTrigger>
                ))}
              </TabsList>

              {MISSION_TYPE_ORDER.map((type) => (
                <TabsContent key={type} value={type} className="space-y-4">
                  {groupedMissions[type].length === 0 ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>{t("gamification.missions.emptyTitle")}</CardTitle>
                        <CardDescription>{t("gamification.missions.emptyDescription")}</CardDescription>
                      </CardHeader>
                    </Card>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      {groupedMissions[type].map((missionProgress) => (
                        <MissionCard key={missionProgress.id} missionProgress={missionProgress} language={language} t={t} />
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </main>
    </div>
  );
}