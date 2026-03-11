import { Award, Copy, Medal, Share2, Shield, Sparkles, Target, Trophy, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { useGamification } from "@/contexts/GamificationContext";
import { useProfileTranslation } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { shareAchievementCard, type ShareCardPayload } from "@/lib/shareCards";
import { buildReferralLink } from "@/services/gamificationService";
import { SCANNER_THEME_IDS, type GamificationPreferencesUpdate, type ScannerThemeId } from "@/types/gamification";
import { cn } from "@/lib/utils";
import { formatCurrencySafe } from "@/utils/currency";

const badgeIcons = {
  first_scan: Sparkles,
  tax_saver_10: Award,
  tax_warrior_7: Shield,
  receipt_marathon_30: Target,
  scanner_pro_100: Medal,
  malaysia_tax_hero_5000: Trophy,
  level_5: Sparkles,
  level_10: Trophy,
  mission_master: Target,
  recruiter: Users,
} as const;

const themeAccents: Record<ScannerThemeId, string> = {
  default: "from-slate-400 to-slate-600",
  ocean: "from-cyan-400 to-blue-600",
  forest: "from-emerald-400 to-green-700",
  sunset: "from-amber-400 to-rose-500",
};

const formatBadgeFallback = (code: string | null) =>
  code
    ?.split("_")
    .map((segment) => (segment.length > 0 ? `${segment.charAt(0).toUpperCase()}${segment.slice(1)}` : segment))
    .join(" ") ?? "Badge";

export function ProfileRewardsPanel() {
  const { t } = useProfileTranslation();
  const { toast } = useToast();
  const { snapshot, isLoading, updatePreferences } = useGamification();
  const profile = snapshot?.profile;
  const referralSummary = snapshot?.referralSummary;
  const latestBadge = snapshot?.badges.find((badge) => Boolean(badge.unlockedAt));

  const updateSnapshot = async (patch: GamificationPreferencesUpdate) => {
    await updatePreferences(patch);
  };

  const copyReferralLink = async () => {
    const referralLink = referralSummary?.referralLink ?? buildReferralLink(referralSummary?.referralCode ?? null);
    if (!referralLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(referralLink);
      toast({ title: t("rewards.referrals.copySuccess") });
    } catch (error) {
      toast({ title: t("rewards.referrals.copyFailed"), variant: "destructive" });
      console.error("Failed to copy referral link", error);
    }
  };

  const shareCardConfigs: Array<ShareCardPayload & { id: "level" | "streak" | "badge" | "deductible"; disabled?: boolean }> = [
    {
      accentFrom: "#8b5cf6",
      accentTo: "#1d4ed8",
      disabled: false,
      fileName: `mataresit-level-${profile?.currentLevel ?? 1}.svg`,
      footer: t("rewards.shareCards.footer"),
      id: "level",
      shareText: t("rewards.shareCards.level.shareText", { level: profile?.currentLevel ?? 1 }),
      subtitle: t("rewards.shareCards.level.subtitle"),
      title: t("rewards.shareCards.level.title", { level: profile?.currentLevel ?? 1 }),
      value: `${profile?.totalXp?.toLocaleString() ?? 0} XP`,
    },
    {
      accentFrom: "#f97316",
      accentTo: "#7c2d12",
      disabled: false,
      fileName: `mataresit-streak-${profile?.scanStreakDays ?? 0}.svg`,
      footer: t("rewards.shareCards.footer"),
      id: "streak",
      shareText: t("rewards.shareCards.streak.shareText", { days: profile?.scanStreakDays ?? 0 }),
      subtitle: t("rewards.shareCards.streak.subtitle"),
      title: t("rewards.shareCards.streak.title", { days: profile?.scanStreakDays ?? 0 }),
      value: t("rewards.shareCards.streak.value", { days: profile?.scanStreakDays ?? 0 }),
    },
    {
      accentFrom: "#14b8a6",
      accentTo: "#0f766e",
      disabled: !latestBadge,
      fileName: `mataresit-badge-${latestBadge?.code ?? "badge"}.svg`,
      footer: t("rewards.shareCards.footer"),
      id: "badge",
      shareText: t("rewards.shareCards.badge.shareText", { badge: latestBadge?.definition?.name ?? formatBadgeFallback(latestBadge?.code ?? null) }),
      subtitle: t("rewards.shareCards.badge.subtitle"),
      title: t("rewards.shareCards.badge.title"),
      value: latestBadge?.definition?.name ?? formatBadgeFallback(latestBadge?.code ?? null),
    },
    {
      accentFrom: "#22c55e",
      accentTo: "#14532d",
      disabled: false,
      fileName: "mataresit-deductible-total.svg",
      footer: t("rewards.shareCards.footer"),
      id: "deductible",
      shareText: t("rewards.shareCards.deductible.shareText", { total: formatCurrencySafe(profile?.deductibleTotalAmount ?? 0, "MYR") }),
      subtitle: t("rewards.shareCards.deductible.subtitle"),
      title: t("rewards.shareCards.deductible.title"),
      value: formatCurrencySafe(profile?.deductibleTotalAmount ?? 0, "MYR"),
    },
  ];

  const handleShareCard = async (cardId: (typeof shareCardConfigs)[number]["id"]) => {
    const config = shareCardConfigs.find((entry) => entry.id === cardId);
    if (!config || config.disabled) return;

    try {
      const result = await shareAchievementCard(config);
      toast({
        title: result === "shared" ? t("rewards.shareCards.shareSuccess") : t("rewards.shareCards.downloadFallback"),
      });
    } catch (error) {
      toast({ title: t("rewards.shareCards.shareFailed"), variant: "destructive" });
      console.error("Failed to share reward card", error);
    }
  };

  const equippedBadges = snapshot?.badges.filter((badge) => badge.equipped) ?? [];
  const earnedBadges = snapshot?.badges ?? [];

  return (
    <div className="space-y-6" data-testid="profile-rewards-panel">
      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t("rewards.title")}
            </CardTitle>
            <CardDescription>{t("rewards.description")}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link to="/leaderboard">{t("rewards.actions.leaderboard")}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/missions">{t("rewards.actions.missions")}</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">{t("rewards.overview.totalXp")}</p>
            <p className="mt-2 text-3xl font-semibold">{profile?.totalXp?.toLocaleString() ?? "—"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("rewards.overview.level", { level: profile?.currentLevel ?? 1 })}</p>
          </div>
          <div className="rounded-xl border p-4 md:col-span-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("rewards.overview.progress")}</span>
              <span>
                {profile?.xpIntoLevel ?? 0}/{profile?.xpForNextLevel ?? 500}
              </span>
            </div>
            <Progress value={isLoading ? 10 : profile?.progressPercent ?? 0} className="mt-3 h-2.5" />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xl font-semibold">{profile?.loginStreakDays ?? 0}</p>
                <p className="text-sm text-muted-foreground">{t("rewards.overview.loginStreak")}</p>
              </div>
              <div>
                <p className="text-xl font-semibold">{profile?.scanStreakDays ?? 0}</p>
                <p className="text-sm text-muted-foreground">{t("rewards.overview.scanStreak")}</p>
              </div>
              <div>
                <p className="text-xl font-semibold">
                  {profile?.dailyGoalCompletedToday ? t("rewards.overview.completed") : t("rewards.overview.ready")}
                </p>
                <p className="text-sm text-muted-foreground">{t("rewards.overview.dailyGoal")}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("rewards.badges.title")}</CardTitle>
          <CardDescription>{t("rewards.badges.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="mb-3 text-sm font-medium">{t("rewards.badges.equipped")}</p>
            {equippedBadges.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {equippedBadges.map((badge) => {
                  const Icon = badgeIcons[badge.code as keyof typeof badgeIcons] ?? Award;
                  return (
                    <div key={badge.id} className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <Icon className="mb-3 h-5 w-5 text-primary" />
                      <p className="font-medium">{badge.definition?.name ?? formatBadgeFallback(badge.code)}</p>
                      <p className="text-sm text-muted-foreground">{badge.definition?.description ?? formatBadgeFallback(badge.code)}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{t("rewards.badges.noneEquipped")}</p>
            )}
          </div>

          <Separator />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {earnedBadges.map((badge) => {
              const Icon = badgeIcons[badge.code as keyof typeof badgeIcons] ?? Award;
              return (
                <div
                  key={badge.id}
                  className={cn(
                    "rounded-xl border p-4 transition-colors",
                    "border-primary/20 bg-primary/5",
                  )}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <Icon className="h-5 w-5 text-primary" />
                    <Badge variant="default">{t("rewards.badges.unlocked")}</Badge>
                  </div>
                  <p className="font-medium">{badge.definition?.name ?? formatBadgeFallback(badge.code)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{badge.definition?.description ?? formatBadgeFallback(badge.code)}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("rewards.themes.title")}</CardTitle>
          <CardDescription>{t("rewards.themes.description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {SCANNER_THEME_IDS.map((themeId) => {
            const isUnlocked = profile?.unlockedScannerThemes.includes(themeId) ?? themeId === "default";
            const isSelected = profile?.selectedScannerTheme === themeId;

            return (
              <button
                key={themeId}
                type="button"
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  isSelected ? "border-primary ring-2 ring-primary/20" : "border-border/70",
                  !isUnlocked && "cursor-not-allowed opacity-60",
                )}
                disabled={!isUnlocked}
                onClick={() => updateSnapshot({ selectedScannerTheme: themeId })}
              >
                <div className={cn("mb-3 h-10 rounded-lg bg-gradient-to-r", themeAccents[themeId])} />
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{t(`rewards.themes.options.${themeId}.title`)}</p>
                  <Badge variant={isSelected ? "default" : "outline"}>
                    {isSelected
                      ? t("rewards.themes.selected")
                      : isUnlocked
                        ? t("rewards.themes.unlocked")
                        : t("rewards.themes.locked")}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{t(`rewards.themes.options.${themeId}.description`)}</p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("rewards.privacy.title")}</CardTitle>
            <CardDescription>{t("rewards.privacy.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{t("rewards.privacy.leaderboardOptIn")}</p>
                <p className="text-sm text-muted-foreground">{t("rewards.privacy.leaderboardOptInHint")}</p>
              </div>
              <Switch
                checked={profile?.leaderboardOptIn ?? false}
                onCheckedChange={(checked) => updateSnapshot({ leaderboardOptIn: checked })}
              />
            </div>
            <Separator />
            <div className="space-y-3">
              <p className="font-medium">{t("rewards.privacy.displayMode")}</p>
              <div className="flex flex-wrap gap-2">
                {(["anonymous", "name"] as const).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={profile?.leaderboardDisplayMode === mode ? "default" : "outline"}
                    disabled={!(profile?.leaderboardOptIn ?? false)}
                    onClick={() => updateSnapshot({ leaderboardDisplayMode: mode })}
                  >
                    {mode === "name" ? t("rewards.privacy.displayModes.public") : t("rewards.privacy.displayModes.anonymous")}
                  </Button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{t("rewards.privacy.displayModeHint")}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("rewards.referrals.title")}</CardTitle>
            <CardDescription>{t("rewards.referrals.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">{t("rewards.referrals.code")}</p>
                <p className="mt-2 text-2xl font-semibold tracking-wide">{referralSummary?.referralCode ?? "—"}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">{t("rewards.referrals.successfulReferrals")}</p>
                <p className="mt-2 text-2xl font-semibold">{referralSummary?.successfulReferrals ?? 0}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">{t("rewards.referrals.pendingReferrals")}</p>
                <p className="mt-2 text-2xl font-semibold">{referralSummary?.pendingReferrals ?? 0}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">{t("rewards.referrals.redeemedReferrals")}</p>
                <p className="mt-2 text-2xl font-semibold">{referralSummary?.redeemedReferrals ?? 0}</p>
              </div>
            </div>
            <Button type="button" variant="outline" className="gap-2" onClick={copyReferralLink}>
              <Copy className="h-4 w-4" />
              {t("rewards.referrals.copyLink")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("rewards.shareCards.title")}</CardTitle>
          <CardDescription>{t("rewards.shareCards.description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {shareCardConfigs.map((card) => (
            <Button
              key={card.id}
              type="button"
              variant="outline"
              className="h-auto justify-start gap-3 px-4 py-4 text-left"
              disabled={card.disabled}
              onClick={() => void handleShareCard(card.id)}
            >
              <Share2 className="h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="font-medium">{t(`rewards.shareCards.${card.id}.button`)}</p>
                <p className="text-sm text-muted-foreground">{card.value}</p>
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}