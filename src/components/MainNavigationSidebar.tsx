import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigationTranslation } from "@/contexts/LanguageContext";
import { useSidebarAccessibility } from "@/hooks/useSidebarAccessibility";
import { useWorkspaceReceiptCounts } from "@/hooks/useDashboardSummary";
import { getAvatarUrl, getUserInitials } from "@/services/avatarService";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  ArrowLeft,
  BarChart3,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Code,
  Crown,
  DollarSign,
  FileText,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface MainNavigationSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

interface SidebarLinkProps {
  to: string;
  icon: LucideIcon;
  label: string;
  isOpen: boolean;
  count?: number;
  attention?: boolean;
  end?: boolean;
}

function SidebarLink({
  to,
  icon: Icon,
  label,
  isOpen,
  count = 0,
  attention = false,
  end = false,
}: SidebarLinkProps) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        title={!isOpen ? label : undefined}
        className={({ isActive }) =>
          cn(
            "flex min-h-[42px] items-center gap-2.5 rounded-[7px] px-2.5 text-[0.9rem] font-medium transition-colors",
            isActive
              ? "bg-white/[0.11] text-white"
              : "text-[#B9C4BC] hover:bg-white/[0.07] hover:text-white",
            !isOpen && "justify-center px-0"
          )
        }
      >
        <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        {isOpen && <span className="min-w-0 flex-1 truncate">{label}</span>}
        {isOpen && count > 0 && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 font-data text-[0.6rem] tabular-nums",
              attention ? "bg-[#F0C27A]/15 text-[#F0C27A]" : "bg-white/10 text-[#D7DED9]"
            )}
          >
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
  isOpen,
}: {
  label: string;
  children: React.ReactNode;
  isOpen: boolean;
}) {
  return (
    <div className="mt-5 first:mt-0">
      {isOpen && (
        <p className="mb-2 px-2.5 font-data text-[0.58rem] uppercase tracking-[0.16em] text-[#6F7D75]">
          {label}
        </p>
      )}
      <ul className="space-y-[3px]">{children}</ul>
    </div>
  );
}

export function MainNavigationSidebar({
  isOpen,
  onToggle,
  className,
}: MainNavigationSidebarProps) {
  const { user, isAdmin } = useAuth();
  const { t: translateNav } = useNavigationTranslation();
  const nav = (key: string) => translateNav(key) as string;
  const { data: counts } = useWorkspaceReceiptCounts();
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  const isAdminUser = Boolean(isAdmin || user?.email === "k.anwarbakar@gmail.com");
  const avatarUrl = user ? getAvatarUrl(user) : null;
  const userInitials = user ? getUserInitials(user) : "";

  const { sidebarProps } = useSidebarAccessibility({
    sidebarId: "main-navigation-sidebar",
    autoFocus: true,
    trapFocus: true,
    announceStateChanges: true,
  });

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!isDesktop) {
    return null;
  }

  return (
    <aside
      id="main-navigation-sidebar"
      aria-label="Main navigation"
      {...sidebarProps}
      className={cn(
        "relative flex h-full flex-shrink-0 flex-col bg-ledger-panel text-ledger-on-panel transition-[width] duration-300 ease-in-out",
        isOpen ? "w-[252px]" : "w-16",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-5">
        {isOpen ? (
          <NavLink to="/dashboard" className="flex min-w-0 items-center gap-2.5 px-1">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] bg-white/10 font-display text-lg leading-none text-white">
              M
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[0.95rem] font-semibold tracking-tight text-white">
                Mataresit
              </span>
              <span className="block font-data text-[0.52rem] uppercase tracking-[0.18em] text-ledger-on-panel-muted">
                Receipt ledger
              </span>
            </span>
          </NavLink>
        ) : (
          <NavLink
            to="/dashboard"
            title="Mataresit"
            className="mx-auto flex h-8 w-8 items-center justify-center rounded-[7px] bg-white/10 font-display text-lg leading-none text-white"
          >
            M
          </NavLink>
        )}
        {isOpen && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={nav("sidebar.collapse")}
            className="rounded-[6px] p-1.5 text-[#8C9A93] transition-colors hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {!isOpen && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={nav("sidebar.expand")}
          className="mx-auto mt-3 rounded-[6px] p-1.5 text-[#8C9A93] transition-colors hover:bg-white/10 hover:text-white"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-5">
        <SidebarGroup label={nav("sidebar.groups.workspace")} isOpen={isOpen}>
          <SidebarLink
            to="/dashboard"
            end
            icon={LayoutDashboard}
            label={nav("mainMenu.overview")}
            isOpen={isOpen}
          />
          <SidebarLink
            to="/receipts"
            icon={ReceiptText}
            label={nav("mainMenu.receipts")}
            isOpen={isOpen}
            count={counts?.all ?? 0}
          />
          <SidebarLink
            to="/review"
            icon={ClipboardCheck}
            label={nav("mainMenu.review")}
            isOpen={isOpen}
            count={counts?.review ?? 0}
            attention
          />
        </SidebarGroup>

        <SidebarGroup label={nav("sidebar.groups.tools")} isOpen={isOpen}>
          <SidebarLink
            to="/search"
            icon={BrainCircuit}
            label={nav("mainMenu.search")}
            isOpen={isOpen}
          />
          <SidebarLink
            to="/analysis"
            icon={BarChart3}
            label={nav("mainMenu.analysis")}
            isOpen={isOpen}
          />
          <SidebarLink
            to="/teams"
            icon={Users}
            label={nav("mainMenu.teams")}
            isOpen={isOpen}
          />
          <SidebarLink
            to="/claims"
            icon={FileText}
            label={nav("mainMenu.claims")}
            isOpen={isOpen}
          />
          <SidebarLink
            to="/pricing"
            icon={DollarSign}
            label={nav("mainMenu.pricing")}
            isOpen={isOpen}
          />
          <SidebarLink
            to="/api-reference"
            icon={Code}
            label={nav("mainMenu.apiReference")}
            isOpen={isOpen}
          />
        </SidebarGroup>

        <SidebarGroup label={nav("sidebar.groups.rewards")} isOpen={isOpen}>
          <SidebarLink
            to="/leaderboard"
            icon={Trophy}
            label={nav("mainMenu.leaderboard")}
            isOpen={isOpen}
          />
          <SidebarLink
            to="/missions"
            icon={Target}
            label={nav("mainMenu.missions")}
            isOpen={isOpen}
          />
        </SidebarGroup>

        <SidebarGroup label={nav("sidebar.groups.account")} isOpen={isOpen}>
          <SidebarLink
            to="/settings"
            icon={Settings}
            label={nav("mainMenu.settings")}
            isOpen={isOpen}
          />
          {isAdminUser && (
            <SidebarLink
              to="/admin"
              icon={Crown}
              label={nav("mainMenu.admin")}
              isOpen={isOpen}
            />
          )}
        </SidebarGroup>
      </nav>

      <div className="border-t border-white/10 p-3">
        {isOpen && user && (
          <div className="mb-2 flex items-center gap-2.5 px-1">
            <Avatar className="h-8 w-8">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
              <AvatarFallback className="bg-white/10 text-[0.7rem] font-semibold text-white">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-[0.8rem] font-medium text-white">
                {user.user_metadata?.full_name || user.email?.split("@")[0]}
              </p>
              <p className="truncate font-data text-[0.6rem] text-ledger-on-panel-muted">
                {user.email}
              </p>
            </div>
          </div>
        )}
        <NavLink
          to="/"
          title={!isOpen ? nav("sidebar.backToSite") : undefined}
          className={cn(
            "flex items-center gap-2 rounded-[6px] px-2 py-2 text-[0.78rem] text-[#8C9A93] transition-colors hover:bg-white/[0.07] hover:text-white",
            !isOpen && "justify-center px-0"
          )}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {isOpen && <span>{nav("sidebar.backToSite")}</span>}
        </NavLink>
      </div>
    </aside>
  );
}
