import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Sparkles, Target, Trophy } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import {
  clearPendingReferralCode,
  clearReferralRedemptionAttempt,
  getPendingReferralCode,
  hasAttemptedReferralRedemption,
  markReferralRedemptionAttempt,
} from "@/lib/referralTracking";
import { gamificationQueryKeys, gamificationService, toRewardSummary } from "@/services/gamificationService";
import type {
  GamificationPreferencesUpdate,
  GamificationSnapshot,
  LeaderboardEntry,
  LeaderboardMetric,
  LeaderboardQueryOptions,
  MissionProgress,
  ReferralSummary,
} from "@/types/gamification";

interface GamificationContextValue {
  snapshot: GamificationSnapshot | undefined;
  isLoading: boolean;
  refresh: () => Promise<void>;
  updatePreferences: (updates: GamificationPreferencesUpdate) => Promise<boolean>;
  recordReceiptReview: (receiptId: string) => Promise<boolean>;
  getLeaderboard: (metric: LeaderboardMetric, options?: LeaderboardQueryOptions) => Promise<LeaderboardEntry[]>;
  getMissions: () => Promise<MissionProgress[]>;
  getReferralSummary: () => Promise<ReferralSummary | null>;
  redeemReferralCode: (code: string) => Promise<boolean>;
}

const GamificationContext = createContext<GamificationContextValue | undefined>(undefined);
const DAILY_LOGIN_SESSION_KEY = "gamification:daily-login";

const showRewardToasts = (
  seenRewards: Set<string>,
  eventId: string,
  sourceType: string,
  amount: number,
  badgeNames: string[],
  missionTitles: string[],
  levelUpTo: number | null,
  totalXp: number | null,
) => {
  const markSeen = (id: string) => {
    if (seenRewards.has(id)) return false;
    seenRewards.add(id);
    if (seenRewards.size > 100) {
      const oldest = seenRewards.values().next().value;
      if (oldest) seenRewards.delete(oldest);
    }
    return true;
  };

  if ((sourceType === "receipt_scan" || sourceType === "daily_goal_bonus") && markSeen(`${eventId}:xp`)) {
    toast.success(sourceType === "daily_goal_bonus" ? "Daily goal bonus claimed" : "Receipt scan rewarded", {
      id: `${eventId}:xp`,
      description: `+${amount} XP added to your progression.`,
      icon: <Sparkles className="h-4 w-4 text-primary" />,
    });
  }

  badgeNames.forEach((badgeName, index) => {
    const toastId = `${eventId}:badge:${index}:${badgeName}`;
    if (!markSeen(toastId)) return;
    toast.success("Badge unlocked", {
      id: toastId,
      description: badgeName,
      icon: <Award className="h-4 w-4 text-amber-500" />,
    });
  });

  missionTitles.forEach((missionTitle, index) => {
    const toastId = `${eventId}:mission:${index}:${missionTitle}`;
    if (!markSeen(toastId)) return;
    toast.success("Mission complete", {
      id: toastId,
      description: missionTitle,
      icon: <Target className="h-4 w-4 text-emerald-500" />,
    });
  });

  if (levelUpTo && markSeen(`${eventId}:level:${levelUpTo}`)) {
    toast.success(`Level ${levelUpTo} unlocked`, {
      id: `${eventId}:level:${levelUpTo}`,
      description: totalXp ? `You are now at ${totalXp.toLocaleString()} XP.` : "Keep the streak going.",
      icon: <Trophy className="h-4 w-4 text-yellow-500" />,
    });
  }
};

export function GamificationProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const seenRewards = useRef(new Set<string>());

  const invalidateGamification = useCallback(async () => {
    if (!user?.id) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: gamificationQueryKeys.root }),
      queryClient.invalidateQueries({ queryKey: gamificationQueryKeys.legacySurface(user.id) }),
    ]);
  }, [queryClient, user?.id]);

  const snapshotQuery = useQuery({
    queryKey: gamificationQueryKeys.snapshot(user?.id ?? "anonymous"),
    queryFn: () => gamificationService.getSnapshot(user!.id),
    enabled: Boolean(user?.id),
  });

  useEffect(() => {
    if (!user?.id || !session) return;

    const marker = `${DAILY_LOGIN_SESSION_KEY}:${user.id}:${session.expires_at ?? "active"}`;
    if (typeof window !== "undefined" && window.sessionStorage.getItem(marker)) {
      return;
    }

    void gamificationService.recordDailyLogin().finally(() => {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(marker, "attempted");
      }
    });
  }, [session, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const pendingReferralCode = getPendingReferralCode();
    if (!pendingReferralCode || hasAttemptedReferralRedemption(user.id, pendingReferralCode)) {
      return;
    }

    markReferralRedemptionAttempt(user.id, pendingReferralCode);

    void gamificationService.redeemReferralCode(pendingReferralCode).then(async (success) => {
      if (!success) return;

      clearPendingReferralCode();
      clearReferralRedemptionAttempt(user.id, pendingReferralCode);
      await invalidateGamification();
    });
  }, [invalidateGamification, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    return gamificationService.subscribeToUserRewards(user.id, {
      onXpEvent: (event) => {
        const reward = toRewardSummary(event);
        void invalidateGamification();
        showRewardToasts(seenRewards.current, reward.eventId, reward.sourceType, reward.amount, reward.badgeNames, reward.missionTitles, reward.levelUpTo, reward.totalXp);
      },
      onBadgeChange: (badge) => {
        void invalidateGamification();
        const badgeName = badge.definition?.name ?? badge.code;
        if (badgeName) {
          showRewardToasts(seenRewards.current, badge.id, "badge_unlock", 0, [badgeName], [], null, null);
        }
      },
      onStatsChange: () => {
        void invalidateGamification();
      },
    });
  }, [invalidateGamification, user?.id]);

  const value = useMemo<GamificationContextValue>(() => ({
    snapshot: snapshotQuery.data,
    isLoading: snapshotQuery.isLoading,
    refresh: invalidateGamification,
    updatePreferences: async (updates) => {
      if (!user?.id) return false;
      const success = await gamificationService.updatePreferences(user.id, updates);
      if (success) await invalidateGamification();
      return success;
    },
    recordReceiptReview: async (receiptId) => {
      const success = await gamificationService.recordReceiptReview(receiptId);
      if (success) await invalidateGamification();
      return success;
    },
    getLeaderboard: (metric, options) => gamificationService.getLeaderboard(metric, options),
    getMissions: () => gamificationService.getMissions(),
    getReferralSummary: async () => (user?.id ? gamificationService.getReferralSummary(user.id) : null),
    redeemReferralCode: (code) => gamificationService.redeemReferralCode(code),
  }), [invalidateGamification, snapshotQuery.data, snapshotQuery.isLoading, user?.id]);

  return <GamificationContext.Provider value={value}>{children}</GamificationContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- keep the provider hook colocated with its context for this narrow cleanup pass.
export function useGamification() {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error("useGamification must be used within a GamificationProvider");
  }
  return context;
}