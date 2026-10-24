import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigationTranslation } from "@/contexts/LanguageContext";
import { useWorkspaceReceiptCounts } from "@/hooks/useDashboardSummary";
import { cn } from "@/lib/utils";

/**
 * Horizontal workspace switcher shown below the slim header on narrow
 * screens, where the fixed desktop sidebar is hidden.
 */
export function WorkspaceTabs() {
  const { t } = useNavigationTranslation();
  const { isAdmin, user } = useAuth();
  const { data: counts } = useWorkspaceReceiptCounts();
  const isAdminUser = Boolean(isAdmin || user?.email === "k.anwarbakar@gmail.com");
  const navRef = useRef<HTMLElement | null>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  const tabs = [
    { to: "/dashboard", label: t("mainMenu.overview"), end: true },
    { to: "/receipts", label: t("mainMenu.receipts"), count: counts?.all },
    { to: "/review", label: t("mainMenu.review"), count: counts?.review },
    { to: "/search", label: t("mainMenu.aiSearch") },
    { to: "/analysis", label: t("mainMenu.analysis") },
    { to: "/claims", label: t("mainMenu.claims") },
    { to: "/teams", label: t("mainMenu.teams") },
    { to: "/leaderboard", label: t("mainMenu.leaderboard") },
    { to: "/missions", label: t("mainMenu.missions") },
    { to: "/settings", label: t("mainMenu.settings") },
    { to: "/profile", label: t("mainMenu.profile") },
    ...(isAdminUser ? [{ to: "/admin", label: t("mainMenu.admin") }] : []),
  ];

  return (
    <nav
      ref={navRef}
      aria-label={t("sidebar.navigation")}
      className="flex items-center gap-1 overflow-x-auto border-b border-ledger-line bg-ledger-surface px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[980px]:hidden"
    >
      {tabs.map(({ to, label, count, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-[7px] px-3 text-sm font-medium transition-colors",
              isActive
                ? "bg-ledger-accent-soft text-ledger-accent"
                : "text-ledger-muted hover:bg-ledger-surface-2 hover:text-ledger-ink"
            )
          }
        >
          {label}
          {count ? (
            <span className="font-data text-[0.62rem] tabular-nums opacity-70">{count}</span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );
}
