import { Link, useLocation } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useAuth } from "@/contexts/AuthContext";
import { useHomepageTranslation } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { MarketingBrand } from "@/components/marketing/MarketingBrand";
import {
  MarketingResourcesDesktop,
  MarketingResourcesMobile,
} from "@/components/marketing/MarketingResources";

const desktopLinkBase =
  "border-b border-transparent py-1.5 text-[0.9375rem] font-medium text-ledger-ink-2 transition-colors hover:border-ledger-ink hover:text-ledger-ink";

const mobileLinkBase =
  "inline-flex min-h-10 items-center whitespace-nowrap rounded-[7px] px-3 text-sm font-medium leading-[1.6] text-ledger-ink-2 hover:bg-ledger-surface-2";

const mobileLinkActive =
  "inline-flex min-h-10 items-center whitespace-nowrap rounded-[7px] bg-ledger-accent-soft px-3 text-sm font-medium leading-[1.6] text-ledger-accent";

const utilityButtonClass =
  "grid h-8 w-8 place-items-center rounded-lg text-ledger-ink-2 transition-colors hover:bg-ledger-surface-2 hover:text-ledger-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent/40 min-[641px]:h-9 min-[641px]:w-9";

function ThemeToggle() {
  const { isDarkMode, toggleMode } = useTheme();
  const { t } = useHomepageTranslation();
  const label = String(t("nav.toggleTheme"));

  return (
    <button
      type="button"
      onClick={() => {
        void toggleMode();
      }}
      aria-label={label}
      title={label}
      aria-pressed={isDarkMode}
      className={utilityButtonClass}
    >
      {isDarkMode ? (
        <Sun aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.7} />
      ) : (
        <Moon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.7} />
      )}
    </button>
  );
}

export function MarketingHeader({ active }: { active?: "features" | "pricing" }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { t } = useHomepageTranslation();

  const copy = (key: string) => String(t(key));
  const isHome = pathname === "/";
  const activePage = active ?? (pathname === "/features" ? "features" : pathname === "/pricing" ? "pricing" : undefined);
  const workspaceTarget = user ? "/dashboard" : "/auth";

  return (
    <header className="sticky top-0 z-40 border-b border-ledger-line bg-ledger-paper">
      <div className="mx-auto flex w-full max-w-[1240px] items-center gap-1.5 px-4 py-2.5 sm:gap-6 sm:px-6 sm:py-3">
        <MarketingBrand />

        <nav
          aria-label={copy("nav.main")}
          className={`ml-3 hidden items-center min-[881px]:flex ${isHome ? "gap-7" : "gap-[26px]"}`}
        >
          <Link
            to="/features"
            aria-current={activePage === "features" ? "page" : undefined}
            className={`${desktopLinkBase} ${activePage === "features" ? "border-ledger-accent text-ledger-ink" : ""}`}
          >
            {copy("nav.features")}
          </Link>
          <Link
            to="/pricing"
            aria-current={activePage === "pricing" ? "page" : undefined}
            className={`${desktopLinkBase} ${activePage === "pricing" ? "border-ledger-accent text-ledger-ink" : ""}`}
          >
            {copy("nav.pricing")}
          </Link>
          <MarketingResourcesDesktop triggerClassName={desktopLinkBase} />
        </nav>

        <div className="ml-auto flex items-center gap-1.5 min-[381px]:gap-2.5">
          <div className="hidden items-center gap-1 min-[881px]:flex">
            <LanguageSelector
              variant="globe-code"
              showFlag={false}
              ariaLabel={copy("nav.language")}
              menuClassName="w-60"
              className="h-9 rounded-lg px-2.5 text-ledger-ink-2 hover:bg-ledger-surface-2 hover:text-ledger-ink"
            />
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-1 min-[881px]:hidden">
            <LanguageSelector
              variant="icon-only"
              showFlag={false}
              ariaLabel={copy("nav.language")}
              menuClassName="w-60"
              className="h-8 w-8 text-ledger-ink-2 hover:bg-ledger-surface-2 hover:text-ledger-ink min-[641px]:h-9 min-[641px]:w-9"
            />
            <ThemeToggle />
          </div>
          {!user && (
            <Link
              to="/auth"
              className="hidden rounded-md px-2.5 py-2 text-[0.9375rem] font-medium text-ledger-ink-2 transition-colors hover:bg-ledger-surface-2 min-[641px]:inline-flex"
            >
              {copy("nav.signIn")}
            </Link>
          )}
          <Button
            asChild
            variant="accent"
            className="h-10 rounded-lg px-2 text-sm font-semibold min-[381px]:px-3.5"
          >
            <Link to={workspaceTarget}>{copy("nav.openWorkspace")}</Link>
          </Button>
        </div>
      </div>

      <nav
        aria-label={copy("nav.pages")}
        className="flex gap-1 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none] min-[881px]:hidden [&::-webkit-scrollbar]:hidden"
      >
        {isHome ? (
          <a href="#top" aria-current="page" className={mobileLinkActive}>
            {copy("nav.home")}
          </a>
        ) : (
          <Link to="/" className={mobileLinkBase}>
            {copy("nav.home")}
          </Link>
        )}
        <Link
          to="/features"
          aria-current={activePage === "features" ? "page" : undefined}
          className={activePage === "features" ? mobileLinkActive : mobileLinkBase}
        >
          {copy("nav.features")}
        </Link>
        <Link
          to="/pricing"
          aria-current={activePage === "pricing" ? "page" : undefined}
          className={activePage === "pricing" ? mobileLinkActive : mobileLinkBase}
        >
          {copy("nav.pricing")}
        </Link>
      </nav>

      <MarketingResourcesMobile />
    </header>
  );
}
