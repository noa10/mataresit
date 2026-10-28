import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock3,
  Receipt,
  ScanLine,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ledger/EmptyState";
import { StatusChip } from "@/components/ledger/StatusChip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGamification } from "@/contexts/GamificationContext";
import { useNavigationTranslation } from "@/contexts/LanguageContext";
import { gamificationQueryKeys } from "@/services/gamificationService";
import type { MissionObjectiveType, MissionProgress, MissionType } from "@/types/gamification";
import { cn } from "@/lib/utils";

const MISSION_TYPE_ORDER: MissionType[] = ["one_time", "weekly", "community"];
const LOCALE_BY_LANGUAGE = {
  en: "en-MY",
  ms: "ms-MY",
} as const;

const getLocale = (language: string) =>
  LOCALE_BY_LANGUAGE[language as keyof typeof LOCALE_BY_LANGUAGE] ?? "en-MY";

const formatCount = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);

const formatCurrency = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatObjectiveValue = (
  mission: MissionProgress["mission"],
  value: number,
  locale: string,
  t: (key: string, options?: Record<string, unknown>) => string
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

const formatMissionWindow = (
  mission: MissionProgress["mission"],
  fallback: string,
  locale: string
) => {
  if (!mission?.startsAt && !mission?.endsAt) return fallback;

  const formatter = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const start = mission.startsAt ? formatter.format(new Date(mission.startsAt)) : null;
  const end = mission.endsAt ? formatter.format(new Date(mission.endsAt)) : null;

  if (start && end) return `${start} – ${end}`;
  return start ?? end ?? fallback;
};

const OBJECTIVE_ICONS: Partial<Record<MissionObjectiveType, typeof Target>> = {
  receipts_scanned: ScanLine,
  deductible_receipts: Receipt,
  deductible_total_amount: Receipt,
  scan_streak_days: Clock3,
  xp_earned: Sparkles,
};

function MissionCard({
  missionProgress,
  language,
  t,
}: {
  missionProgress: MissionProgress;
  language: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const mission = missionProgress.mission;
  const isCommunity = mission?.missionType === "community";
  const locale = getLocale(language);
  const displayCurrent = isCommunity
    ? missionProgress.communityCurrentValue ?? missionProgress.currentValue
    : missionProgress.currentValue;
  const displayTarget = isCommunity
    ? missionProgress.communityTargetValue ?? missionProgress.targetValue
    : missionProgress.targetValue;
  const progressValue =
    displayTarget > 0 ? Math.min(100, Math.round((displayCurrent / displayTarget) * 100)) : 0;
  const isComplete = Boolean(
    missionProgress.claimedAt ??
      missionProgress.completedAt ??
      (isCommunity && missionProgress.communityCompletedAt)
  );
  const statusKey = isComplete ? "complete" : isCommunity ? "community" : "inProgress";
  const Icon =
    OBJECTIVE_ICONS[mission?.objectiveType as MissionObjectiveType] ?? Target;

  return (
    <article className="grid gap-3 rounded-[10px] border border-ledger-line bg-ledger-surface p-[18px]">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-ledger-accent-soft text-ledger-accent"
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-[0.9375rem] font-semibold leading-snug text-ledger-ink">
              {mission?.title ?? t("gamification.missions.emptyTitle")}
            </h3>
            <StatusChip
              tone={isComplete ? "reviewed" : isCommunity ? "neutral" : "processing"}
              label={t(`gamification.missions.status.${statusKey}`)}
            />
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ledger-muted">
            {mission?.description ?? t("gamification.missions.emptyDescription")}
          </p>
        </div>
      </div>

      <div>
        <div className="h-[7px] overflow-hidden rounded-full bg-ledger-surface-2">
          <span
            className={cn("block h-full rounded-full bg-ledger-accent")}
            style={{ width: `${progressValue}%`, minWidth: progressValue > 0 ? undefined : 2 }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="font-data text-[0.625rem] text-ledger-muted">
            {formatObjectiveValue(mission, displayCurrent, locale, t)} /{" "}
            {formatObjectiveValue(mission, displayTarget, locale, t)}
          </p>
          <span className="rounded-full bg-ledger-accent-soft px-2.5 py-1 font-data text-[0.6875rem] text-ledger-accent">
            +{mission?.rewardXp ?? 0} XP
          </span>
        </div>
      </div>

      <div className="border-t border-dashed border-ledger-line pt-3">
        <p className="font-data text-[0.5625rem] uppercase tracking-[0.14em] text-ledger-muted">
          {t("gamification.missions.windowLabel")}
        </p>
        <p className="mt-1 font-data text-[0.625rem] text-ledger-ink-2">
          {formatMissionWindow(mission, t("gamification.missions.windowLifetime"), locale)}
        </p>
      </div>

      {isCommunity ? (
        <div className="rounded-[8px] border border-dashed border-ledger-line bg-ledger-surface-2/60 px-3 py-2.5">
          <p className="flex items-center gap-2 text-sm font-medium text-ledger-ink">
            <Users className="h-4 w-4 text-ledger-accent" aria-hidden="true" />
            {t("gamification.missions.communityContributionTitle")}
          </p>
          <p className="mt-1 text-sm text-ledger-muted">
            {t("gamification.missions.communityContributionBody")}:{" "}
            {formatObjectiveValue(mission, missionProgress.currentValue, locale, t)}
          </p>
        </div>
      ) : null}
    </article>
  );
}

function MissionsSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className="h-[190px] animate-pulse rounded-[10px] border border-ledger-line bg-ledger-surface-2"
        />
      ))}
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
    [missionsQuery.data, snapshot?.activeMissions]
  );

  const summary = useMemo(() => {
    const completed = missions.filter((mission) =>
      Boolean(mission.claimedAt ?? mission.completedAt ?? mission.communityCompletedAt)
    ).length;
    const availableXp = missions
      .filter((mission) => !mission.claimedAt)
      .reduce((total, mission) => total + (mission.mission?.rewardXp ?? 0), 0);
    return { total: missions.length, completed, availableXp };
  }, [missions]);

  const groupedMissions = useMemo(
    () =>
      Object.fromEntries(
        MISSION_TYPE_ORDER.map((type) => [
          type,
          missions.filter((mission) => mission.mission?.missionType === type),
        ])
      ) as Record<MissionType, MissionProgress[]>,
    [missions]
  );

  const scanStreak = snapshot?.profile.scanStreakDays ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-14 pt-8 md:px-7">
      <header className="flex flex-wrap items-end justify-between gap-[18px]">
        <div className="min-w-0">
          <p className="font-data text-[0.625rem] uppercase tracking-[0.16em] text-ledger-muted">
            {t("gamification.missions.eyebrow")}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(2rem,3.2vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-ledger-ink">
            {t("gamification.missions.title")}
          </h1>
          <p className="mt-2 max-w-[58ch] text-[0.9375rem] leading-relaxed text-ledger-muted">
            {t("gamification.missionsDescription")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="accent-outline" size="app" asChild>
            <Link to="/leaderboard">{t("gamification.missions.leaderboard")}</Link>
          </Button>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-[10px] border border-ledger-line bg-ledger-surface px-4 py-3.5">
          <p className="font-data text-[1.1rem] font-medium text-ledger-ink">{summary.total}</p>
          <p className="mt-0.5 font-data text-[0.5625rem] uppercase tracking-[0.14em] text-ledger-muted">
            {t("gamification.missions.summary.active")}
          </p>
        </div>
        <div className="rounded-[10px] border border-ledger-line bg-ledger-surface px-4 py-3.5">
          <p className="font-data text-[1.1rem] font-medium text-ledger-ink">{summary.completed}</p>
          <p className="mt-0.5 font-data text-[0.5625rem] uppercase tracking-[0.14em] text-ledger-muted">
            {t("gamification.missions.summary.completed")}
          </p>
        </div>
        <div className="rounded-[10px] border border-ledger-accent bg-ledger-accent-soft px-4 py-3.5">
          <p className="font-data text-[1.1rem] font-medium text-ledger-accent">
            +{summary.availableXp} XP
          </p>
          <p className="mt-0.5 font-data text-[0.5625rem] uppercase tracking-[0.14em] text-ledger-accent">
            {t("gamification.missions.summary.rewards")}
          </p>
        </div>
        <div className="rounded-[10px] border border-ledger-line bg-ledger-surface px-4 py-3.5">
          <p className="font-data text-[1.1rem] font-medium text-ledger-ink">
            {t("gamification.missions.scanStreakValue", { count: formatCount(scanStreak, getLocale(language)) })}
          </p>
          <p className="mt-0.5 font-data text-[0.5625rem] uppercase tracking-[0.14em] text-ledger-muted">
            {t("gamification.missions.scanStreak")}
          </p>
        </div>
      </div>

      {isSnapshotLoading || missionsQuery.isLoading ? (
        <div className="mt-6">
          <MissionsSkeleton />
        </div>
      ) : (
        <Tabs
          value={selectedType}
          onValueChange={(value) => setSelectedType(value as MissionType)}
          className="mt-6"
        >
          <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
            {MISSION_TYPE_ORDER.map((type) => (
              <TabsTrigger
                key={type}
                value={type}
                className="rounded-full border border-ledger-line-strong bg-transparent px-3.5 py-2 font-data text-[0.6875rem] tracking-[0.06em] text-ledger-ink-2 shadow-none data-[state=active]:border-ledger-ink data-[state=active]:bg-ledger-ink data-[state=active]:text-ledger-paper"
              >
                {t(`gamification.missions.tabs.${type}`)}
              </TabsTrigger>
            ))}
          </TabsList>

          {MISSION_TYPE_ORDER.map((type) => (
            <TabsContent key={type} value={type} className="mt-4">
              {groupedMissions[type].length === 0 ? (
                <EmptyState
                  icon={<Target className="h-7 w-7" />}
                  title={t("gamification.missions.emptyTitle")}
                  description={t("gamification.missions.emptyDescription")}
                />
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {groupedMissions[type].map((missionProgress) => (
                    <MissionCard
                      key={missionProgress.id}
                      missionProgress={missionProgress}
                      language={language}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
