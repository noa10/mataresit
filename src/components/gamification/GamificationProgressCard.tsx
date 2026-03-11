import { AppWindow, Award, Flame, Sparkles, Target, Trophy } from "lucide-react";
import { Link } from "react-router-dom";

import { useGamification } from "@/contexts/GamificationContext";
import { useDashboardTranslation } from "@/contexts/LanguageContext";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function GamificationProgressCard() {
  const { t } = useDashboardTranslation();
  const { snapshot, isLoading } = useGamification();
  const { dismissInstallPrompt, isInstallPromptAvailable, promptToInstall } = useInstallPrompt();
  const profile = snapshot?.profile;
  const unlockedBadgeCount = snapshot?.badges.filter((badge) => Boolean(badge.unlockedAt)).length ?? 0;
  const shouldShowInstallPrompt = (profile?.totalReceiptsScanned ?? 0) > 0 && isInstallPromptAvailable;

  return (
    <Card data-testid="dashboard-gamification-card" className="mb-8 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("rewards.title")}
          </CardTitle>
          <CardDescription>{t("rewards.description")}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link to="/leaderboard">{t("rewards.actions.leaderboard")}</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/missions">{t("rewards.actions.missions")}</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1.3fr,1fr]">
        <div className="rounded-xl border border-border/60 bg-background/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{t("rewards.xpLabel")}</p>
              <div className="mt-2 flex items-end gap-3">
                <span className="text-3xl font-semibold">{profile?.totalXp?.toLocaleString() ?? "—"}</span>
                <Badge variant="secondary">{t("rewards.levelBadge", { level: profile?.currentLevel ?? 1 })}</Badge>
              </div>
            </div>
            <Badge variant={profile?.dailyGoalCompletedToday ? "default" : "outline"}>
              {profile?.dailyGoalCompletedToday ? t("rewards.dailyGoalComplete") : t("rewards.dailyGoalReady")}
            </Badge>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("rewards.progressLabel")}</span>
              <span>
                {profile?.xpIntoLevel ?? 0}/{profile?.xpForNextLevel ?? 500}
              </span>
            </div>
            <Progress value={isLoading ? 10 : profile?.progressPercent ?? 0} className="h-2.5" />
            <p className="text-xs text-muted-foreground">{t("rewards.progressHint")}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-background/80 p-4">
            <Flame className="mb-3 h-4 w-4 text-orange-500" />
            <p className="text-2xl font-semibold">{profile?.loginStreakDays ?? 0}</p>
            <p className="text-sm text-muted-foreground">{t("rewards.loginStreak")}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/80 p-4">
            <Award className="mb-3 h-4 w-4 text-blue-500" />
            <p className="text-2xl font-semibold">{profile?.scanStreakDays ?? 0}</p>
            <p className="text-sm text-muted-foreground">{t("rewards.scanStreak")}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/80 p-4">
            <Target className="mb-3 h-4 w-4 text-emerald-500" />
            <p className="text-2xl font-semibold">{unlockedBadgeCount}</p>
            <p className="text-sm text-muted-foreground">{t("rewards.badgesUnlocked")}</p>
          </div>
        </div>
      </CardContent>
      {shouldShowInstallPrompt ? (
        <div className="border-t border-border/50 px-6 py-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4" data-testid="dashboard-install-cta">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <AppWindow className="h-4 w-4 text-primary" />
                  {t("rewards.install.title")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{t("rewards.install.description")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void promptToInstall()}>{t("rewards.install.installCta")}</Button>
                <Button size="sm" variant="ghost" onClick={dismissInstallPrompt}>{t("rewards.install.dismissCta")}</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="border-t border-border/50 px-6 py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Trophy className="h-3.5 w-3.5" />
          {t("rewards.footer")}
        </span>
      </div>
    </Card>
  );
}