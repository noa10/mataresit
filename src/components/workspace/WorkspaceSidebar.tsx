import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  ClipboardCheck,
  FileText,
  LayoutGrid,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Target,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigationTranslation } from "@/contexts/LanguageContext";
import { useTeam } from "@/contexts/TeamContext";
import { useWorkspaceReceiptCounts } from "@/hooks/useDashboardSummary";
import { getAvatarUrl, getUserInitials } from "@/services/avatarService";
import { claimService } from "@/services/claimService";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  end?: boolean;
}

function SidebarLink({ to, label, icon: Icon, count, end }: NavItem) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          cn(
            "flex min-h-[42px] items-center gap-2.5 rounded-[7px] px-2.5 text-[0.9rem] font-medium transition-colors",
            isActive
              ? "bg-white/[0.11] text-white"
              : "text-[#B9C4BC] hover:bg-white/[0.07] hover:text-white"
          )
        }
      >
        <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {typeof count === "number" && count > 0 && (
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 font-data text-[0.6rem] tabular-nums text-[#E7EFE9]">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </NavLink>
    </li>
  );
}

function SidebarGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 first:mt-0">
      <p className="mb-2 px-2.5 font-data text-[0.58rem] uppercase tracking-[0.16em] text-[#7E8C84]">
        {label}
      </p>
      <ul className="space-y-[3px]">{children}</ul>
    </div>
  );
}

/** Fixed workspace navigation, matching the ledger mock at >=980px. */
export function WorkspaceSidebar() {
  const { user, isAdmin } = useAuth();
  const { currentTeam } = useTeam();
  const { t } = useNavigationTranslation();
  const { data: counts } = useWorkspaceReceiptCounts();
  const { data: claimStats } = useQuery({
    queryKey: ["claim-stats", currentTeam?.id ?? null],
    queryFn: () => claimService.getTeamClaimStats(currentTeam!.id),
    enabled: Boolean(currentTeam?.id),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const isAdminUser = Boolean(isAdmin || user?.email === "k.anwarbakar@gmail.com");
  const avatarUrl = user ? getAvatarUrl(user) : null;
  const userInitials = user ? getUserInitials(user) : "";
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "";
  const workspaceName = currentTeam?.name || t("sidebar.personalWorkspace");

  return (
    <aside
      aria-label={t("sidebar.navigation")}
      className="sticky top-0 hidden h-screen w-[252px] flex-col gap-6 overflow-hidden border-r border-black/20 bg-ledger-panel px-3.5 pb-4 pt-[18px] text-ledger-on-panel min-[980px]:flex"
    >
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2.5 rounded-md px-1.5 py-1 text-ledger-on-panel"
        >
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] bg-white/[0.12] font-display text-[1.05rem] leading-none">
            M
          </span>
          <span className="font-display text-[1.1rem] leading-none">Mataresit</span>
        </Link>
      </div>

      <nav aria-label={t("sidebar.navigation")} className="min-h-0 flex-1 overflow-y-auto pb-2">
        <div className="space-y-0">
          <SidebarGroup label={t("sidebar.groups.workspace")}>
            <SidebarLink
              to="/dashboard"
              label={t("mainMenu.overview")}
              icon={LayoutGrid}
              end
            />
            <SidebarLink
              to="/receipts"
              label={t("mainMenu.receipts")}
              icon={ReceiptText}
              count={counts?.all}
            />
            <SidebarLink
              to="/review"
              label={t("mainMenu.review")}
              icon={ClipboardCheck}
              count={counts?.review}
            />
          </SidebarGroup>

          <SidebarGroup label={t("sidebar.groups.tools")}>
            <SidebarLink to="/search" label={t("mainMenu.aiSearch")} icon={Search} />
            <SidebarLink to="/analysis" label={t("mainMenu.analysis")} icon={BarChart3} />
            <SidebarLink
              to="/claims"
              label={t("mainMenu.claims")}
              icon={FileText}
              count={claimStats?.pending_claims}
            />
            <SidebarLink to="/teams" label={t("mainMenu.teams")} icon={Users} />
          </SidebarGroup>

          <SidebarGroup label={t("sidebar.groups.rewards")}>
            <SidebarLink to="/leaderboard" label={t("mainMenu.leaderboard")} icon={Trophy} />
            <SidebarLink to="/missions" label={t("mainMenu.missions")} icon={Target} />
          </SidebarGroup>

          <SidebarGroup label={t("sidebar.groups.account")}>
            <SidebarLink to="/settings" label={t("mainMenu.settings")} icon={Settings} />
            <SidebarLink to="/profile" label={t("mainMenu.profile")} icon={User} />
            {isAdminUser && (
              <SidebarLink to="/admin" label={t("mainMenu.admin")} icon={ShieldCheck} />
            )}
          </SidebarGroup>
        </div>
      </nav>

      <div className="mt-auto grid flex-shrink-0 gap-2.5">
        <div className="flex items-center gap-2.5 border-t border-white/[0.14] px-2.5 pt-3">
          <Avatar className="h-[34px] w-[34px]">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback className="bg-ledger-accent-soft font-data text-[0.68rem] font-medium text-ledger-panel">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate text-[0.82rem] font-semibold leading-tight text-ledger-on-panel">
              {displayName}
            </span>
            <span className="block truncate text-[0.69rem] leading-tight text-ledger-on-panel-muted">
              {workspaceName}
            </span>
          </span>
        </div>
        <Link
          to="/"
          className="inline-flex min-h-[38px] items-center gap-2 rounded-[7px] px-2.5 text-[0.82rem] text-[#B9C4BC] transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("sidebar.backToSite")}
        </Link>
      </div>
    </aside>
  );
}
