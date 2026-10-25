import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Award,
  ChevronRight,
  CreditCard,
  LogOut,
  Medal,
  Pencil,
  Shield,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ledger/EmptyState";
import { Panel } from "@/components/ledger/Panel";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { AccountSettings } from "@/components/profile/AccountSettings";
import { ProfileRewardsPanel } from "@/components/gamification/ProfileRewardsPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useGamification } from "@/contexts/GamificationContext";
import { useDashboardTranslation, useProfileTranslation } from "@/contexts/LanguageContext";
import { useTeam } from "@/contexts/TeamContext";
import { useToast } from "@/hooks/use-toast";
import { getAvatarUrl, getUserInitials } from "@/services/avatarService";
import { getProfile, updateProfile, type ProfileData } from "@/services/profileService";
import { cn } from "@/lib/utils";

const BADGE_ICONS: Record<string, typeof Award> = {
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
};

const formatBadgeFallback = (code: string | null) =>
  code
    ? code
        .split("_")
        .map((segment) => (segment.length > 0 ? `${segment.charAt(0).toUpperCase()}${segment.slice(1)}` : segment))
        .join(" ")
    : "Badge";

const formatNumber = (value: number, language: string) =>
  new Intl.NumberFormat(language === "ms" ? "ms-MY" : "en-MY", { maximumFractionDigits: 0 }).format(value);

const formatMonthYear = (value: string | null | undefined, language: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(language === "ms" ? "ms-MY" : "en-MY", {
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return null;
  }
};

const linkRowClass =
  "flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ledger-surface-2/70";

const iconTileClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-ledger-surface-2 text-ledger-ink-2";

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useProfileTranslation();
  const { t: td, language } = useDashboardTranslation();
  const { currentTeam } = useTeam();
  const { snapshot } = useGamification();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "" });

  // Rewards & privacy expands in place under the Account panel — the URL
  // param only seeds the initial state so old links keep working.
  const [showRewardsPanel, setShowRewardsPanel] = useState(
    searchParams.get("tab") === "rewards"
  );

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const profileData = await getProfile(user.id);
        setProfile(profileData);
      } catch (error) {
        console.error("Error fetching profile:", error);
        toast({
          title: t("error.loadingProfile"),
          description: t("error.loadingDescription"),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [t, user?.id, toast]);

  const fullName = useMemo(() => {
    if (!profile) return "";
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
    return name || profile.email?.split("@")[0] || "User";
  }, [profile]);

  const avatarUrl = profile ? getAvatarUrl(profile) : null;
  const initials = profile ? getUserInitials(profile) : "U";

  const memberSince = useMemo(
    () => formatMonthYear(profile?.created_at, language),
    [profile?.created_at, language]
  );

  const gamification = snapshot?.profile;
  const level = gamification?.currentLevel ?? 1;
  const totalXp = gamification?.totalXp ?? 0;
  const xpRemaining = Math.max(0, (gamification?.xpForNextLevel ?? 0) - (gamification?.xpIntoLevel ?? 0));
  const streakDays = gamification?.loginStreakDays ?? 0;
  const dailyBonusReady = !gamification?.dailyGoalCompletedToday;

  const badgeList = useMemo(() => {
    const badges = snapshot?.badges ?? [];
    return [...badges].sort((left, right) => {
      if (left.equipped !== right.equipped) return left.equipped ? -1 : 1;
      const leftDate = left.unlockedAt ? new Date(left.unlockedAt).getTime() : 0;
      const rightDate = right.unlockedAt ? new Date(right.unlockedAt).getTime() : 0;
      return rightDate - leftDate;
    });
  }, [snapshot?.badges]);

  const openEdit = () => {
    if (!profile) return;
    setForm({
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      email: profile.email ?? "",
    });
    setIsEditOpen(true);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;

    setIsSaving(true);
    try {
      const result = await updateProfile(profile.id, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
      });

      if (result.success && result.profile) {
        setProfile(result.profile);
        setIsEditOpen(false);
        toast({
          title: t("notifications.updateSuccess"),
          description: t("notifications.updateSuccessDescription"),
        });
      } else {
        toast({
          title: t("notifications.updateFailed"),
          description: result.error || t("notifications.updateFailedDescription"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Profile update error:", error);
      toast({
        title: t("notifications.updateFailed"),
        description: t("notifications.unexpectedError"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpdate = (avatarUrlValue: string | null) => {
    if (!profile) return;
    setProfile({
      ...profile,
      avatar_url: avatarUrlValue,
      avatar_updated_at: new Date().toISOString(),
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
    toast({
      title: t("signOutSuccess.title"),
      description: t("signOutSuccess.description"),
      duration: 3000,
    });
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-5 pb-14 pt-8 md:px-7">
        <div className="h-[86px] max-w-[560px] animate-pulse rounded-[10px] bg-ledger-surface-2" aria-hidden="true" />
        <div className="mt-7 space-y-3" aria-hidden="true">
          <div className="h-[118px] animate-pulse rounded-[10px] border border-ledger-line bg-ledger-surface-2" />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="h-[82px] animate-pulse rounded-[10px] border border-ledger-line bg-ledger-surface-2"
              />
            ))}
          </div>
          <div className="h-[210px] animate-pulse rounded-[10px] border border-ledger-line bg-ledger-surface-2" />
        </div>
      </div>
    );
  }

  if (!profile || !user) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-5 pb-14 pt-8 md:px-7">
        <header>
          <p className="font-data text-[0.625rem] uppercase tracking-[0.16em] text-ledger-muted">
            {td("workspace.profile.eyebrow")}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(2rem,3.2vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-ledger-ink">
            {t("title")}
          </h1>
        </header>
        <div className="mt-7">
          <EmptyState
            title={t("error.unableToLoad")}
            action={
              <Button variant="accent" size="app" onClick={() => window.location.reload()}>
                {t("error.refreshPage")}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-14 pt-8 md:px-7">
      <header className="flex flex-wrap items-end justify-between gap-[18px]">
        <div className="min-w-0">
          <p className="font-data text-[0.625rem] uppercase tracking-[0.16em] text-ledger-muted">
            {td("workspace.profile.eyebrow")}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(2rem,3.2vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-ledger-ink">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-[58ch] text-[0.9375rem] leading-relaxed text-ledger-muted">
            {td("workspace.profile.lede")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="accent-outline" size="app" asChild>
            <Link to="/leaderboard">{td("workspace.profile.leaderboard")}</Link>
          </Button>
          <Button variant="accent-outline" size="app" asChild>
            <Link to="/missions">{td("workspace.profile.missions")}</Link>
          </Button>
        </div>
      </header>

      <Panel className="mt-7">
        <div className="flex flex-wrap items-center gap-[18px]">
          <span
            className="flex h-[62px] w-[62px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-ledger-accent-soft font-data text-[1.05rem] font-medium text-ledger-accent"
            aria-hidden="true"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </span>
          <div className="min-w-[200px] flex-1">
            <p className="text-[1.0625rem] font-semibold leading-snug text-ledger-ink">{fullName}</p>
            <p className="mt-1 font-data text-[0.6875rem] leading-relaxed text-ledger-muted">
              {[
                profile.email,
                currentTeam?.name ?? td("workspace.profile.personalWorkspace"),
                memberSince ? td("workspace.profile.memberSince", { date: memberSince }) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <Button variant="accent-outline" size="app" onClick={openEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            {td("workspace.profile.editProfile")}
          </Button>
        </div>
      </Panel>

      <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-[10px] border border-ledger-line bg-ledger-surface px-4 py-3.5">
          <p className="font-data text-[1.1rem] font-medium text-ledger-ink">
            {formatNumber(totalXp, language)}
          </p>
          <p className="mt-0.5 font-data text-[0.5625rem] uppercase tracking-[0.14em] text-ledger-muted">
            {td("workspace.profile.totalXp")}
          </p>
        </div>
        <div className="rounded-[10px] border border-ledger-line bg-ledger-surface px-4 py-3.5">
          <p className="font-data text-[1.1rem] font-medium text-ledger-ink">
            {td("workspace.profile.level", { level })}
          </p>
          <p className="mt-0.5 font-data text-[0.5625rem] uppercase tracking-[0.14em] text-ledger-muted">
            {td("workspace.profile.toNext", {
              xp: formatNumber(xpRemaining, language),
              next: level + 1,
            })}
          </p>
        </div>
        <div className="rounded-[10px] border border-ledger-line bg-ledger-surface px-4 py-3.5">
          <p className="font-data text-[1.1rem] font-medium text-ledger-ink">
            {td("workspace.profile.days", { count: formatNumber(streakDays, language) })}
          </p>
          <p className="mt-0.5 font-data text-[0.5625rem] uppercase tracking-[0.14em] text-ledger-muted">
            {td("workspace.profile.loginStreak")}
          </p>
        </div>
        <div
          className={cn(
            "rounded-[10px] border border-ledger-line bg-ledger-surface px-4 py-3.5",
            dailyBonusReady && "border-ledger-accent bg-ledger-accent-soft"
          )}
        >
          <p
            className={cn(
              "font-data text-[1.1rem] font-medium text-ledger-ink",
              dailyBonusReady && "text-ledger-accent"
            )}
          >
            {dailyBonusReady ? td("workspace.profile.ready") : td("workspace.profile.claimed")}
          </p>
          <p
            className={cn(
              "mt-0.5 font-data text-[0.5625rem] uppercase tracking-[0.14em] text-ledger-muted",
              dailyBonusReady && "text-ledger-accent"
            )}
          >
            {td("workspace.profile.dailyBonus")}
          </p>
        </div>
      </div>

      <Panel
        className="mt-3"
        title={td("workspace.profile.badges")}
          action={
            <span className="font-data text-[0.625rem] text-ledger-muted">
              {td("workspace.profile.badgesMeta", { count: badgeList.length })}
            </span>
          }
        >
          {badgeList.length === 0 ? (
            <EmptyState
              icon={<Award className="h-7 w-7" />}
              title={td("workspace.profile.noBadges")}
              description={td("workspace.profile.noBadgesLede")}
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
              {badgeList.map((badge) => {
                const unlocked = Boolean(badge.unlockedAt);
                const Icon = BADGE_ICONS[badge.code ?? ""] ?? Award;
                const name = badge.code
                  ? t(`rewards.badges.catalog.${badge.code}.name`, {
                      defaultValue: badge.definition?.name ?? formatBadgeFallback(badge.code),
                    })
                  : formatBadgeFallback(badge.code);
                return (
                  <div
                    key={badge.id}
                    className={cn(
                      "grid justify-items-center gap-2 rounded-[10px] border border-ledger-line bg-ledger-surface p-4 text-center",
                      !unlocked && "opacity-55"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full",
                        unlocked
                          ? "bg-ledger-accent-soft text-ledger-accent"
                          : "bg-ledger-surface-2 text-ledger-muted"
                      )}
                      aria-hidden="true"
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="text-[0.8125rem] font-semibold leading-snug text-ledger-ink">
                      {name}
                    </span>
                    <span className="font-data text-[0.5625rem] uppercase tracking-[0.1em] text-ledger-muted">
                      {unlocked ? td("workspace.profile.unlocked") : td("workspace.profile.locked")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

      <Panel
        className="mt-3"
        title={td("workspace.profile.account")}
        flush
      >
        <div className="divide-y divide-ledger-line border-t border-ledger-line">
          <Link to="/settings?tab=billing" className={linkRowClass}>
            <span className={iconTileClass} aria-hidden="true">
              <CreditCard className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ledger-ink">
                {td("workspace.profile.billing")}
              </span>
              <span className="mt-0.5 block text-xs text-ledger-muted">
                {td("workspace.profile.plan")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-ledger-muted" aria-hidden="true" />
          </Link>

          <Link to="/teams" className={linkRowClass}>
            <span className={iconTileClass} aria-hidden="true">
              <Users className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ledger-ink">
                {td("workspace.profile.teams")}
              </span>
              <span className="mt-0.5 block text-xs text-ledger-muted">
                {currentTeam?.name ?? td("workspace.profile.personalWorkspace")}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-ledger-muted" aria-hidden="true" />
          </Link>

          <button
            type="button"
            onClick={() => setShowRewardsPanel((open) => !open)}
            aria-expanded={showRewardsPanel}
            className={cn(linkRowClass, "w-full")}
          >
            <span className={iconTileClass} aria-hidden="true">
              <Trophy className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ledger-ink">
                {td("workspace.profile.rewardsPrivacy")}
              </span>
              <span className="mt-0.5 block text-xs text-ledger-muted">
                {td("workspace.profile.rewardsPrivacyLede")}
              </span>
            </span>
            <ChevronRight
              className={cn(
                "h-4 w-4 text-ledger-muted transition-transform",
                showRewardsPanel && "rotate-90"
              )}
              aria-hidden="true"
            />
          </button>

          <button type="button" onClick={handleSignOut} className={cn(linkRowClass, "w-full")}>
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-ledger-danger-soft text-ledger-danger"
              aria-hidden="true"
            >
              <LogOut className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ledger-danger">{t("signOut")}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-ledger-muted" aria-hidden="true" />
          </button>
        </div>
      </Panel>

      {/* Rewards & privacy — expands in place, directly under the row that
          toggles it, instead of swapping content at the top of the page. */}
      {showRewardsPanel && (
        <div id="rewards" className="mt-3">
          <ProfileRewardsPanel />
        </div>
      )}

      {/* Account & security — the former /profile/advanced security tab,
          embedded so profile has a single page. */}
      {user && (
        <div className="mt-3">
          <AccountSettings userId={user.id} />
        </div>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{td("workspace.profile.editTitle")}</DialogTitle>
            <DialogDescription>{td("workspace.profile.editDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-5">
            <AvatarUpload profile={profile} onAvatarUpdate={handleAvatarUpdate} size="lg" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-first-name">
                  {t("editor.fields.firstName")}
                </Label>
                <Input
                  id="profile-first-name"
                  value={form.first_name}
                  maxLength={50}
                  placeholder={t("editor.placeholders.firstName")}
                  onChange={(event) => setForm((prev) => ({ ...prev, first_name: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-last-name">
                  {t("editor.fields.lastName")}
                </Label>
                <Input
                  id="profile-last-name"
                  value={form.last_name}
                  maxLength={50}
                  placeholder={t("editor.placeholders.lastName")}
                  onChange={(event) => setForm((prev) => ({ ...prev, last_name: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">{t("editor.fields.email")}</Label>
              <Input
                id="profile-email"
                type="email"
                value={form.email}
                placeholder={t("editor.placeholders.email")}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
              <p className="text-xs text-ledger-muted">{t("editor.descriptions.emailNote")}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                {t("editor.actions.cancel")}
              </Button>
              <Button type="submit" variant="accent" disabled={isSaving}>
                {isSaving ? t("editor.actions.saving") : t("editor.actions.saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
