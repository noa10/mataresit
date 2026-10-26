import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  LogOut,
  Moon,
  Plus,
  Settings,
  ShieldCheck,
  Sun,
  Upload,
  User,
  Users,
} from "lucide-react";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { CreateTeamDialog } from "@/components/team/CreateTeamDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useBackgroundUpload } from "@/contexts/BackgroundUploadContext";
import {
  useCommonTranslation,
  useDashboardTranslation,
  useLanguage,
  useNavigationTranslation,
  useTeamTranslation,
} from "@/contexts/LanguageContext";
import { useTeam } from "@/contexts/TeamContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getAvatarUrl, getUserInitials } from "@/services/avatarService";
import { getTeamRoleDisplayName } from "@/types/team";

const monthLabel = (language: string) => {
  const locale = language === "ms" ? "ms-MY" : "en-MY";
  try {
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
      new Date()
    );
  } catch {
    return new Intl.DateTimeFormat("en-MY", { month: "long", year: "numeric" }).format(
      new Date()
    );
  }
};

/**
 * Slim workspace header: the team (and month) on the left, actions on the
 * right. Team switching and account controls live in dropdowns so the bar
 * stays as quiet as the mock.
 */
export function AppHeader() {
  const { user, signOut, isAdmin } = useAuth();
  const { currentTeam, currentTeamRole, userTeams, switchTeam } = useTeam();
  const { isDarkMode, toggleMode } = useTheme();
  const { language, changeLanguage } = useLanguage();
  const { openModal } = useBackgroundUpload();
  const { t: tNav } = useNavigationTranslation();
  const { t: tCommon } = useCommonTranslation();
  const { t: tDash } = useDashboardTranslation();
  const { t: tTeam } = useTeamTranslation();
  const [createTeamOpen, setCreateTeamOpen] = useState(false);

  const avatarUrl = user ? getAvatarUrl(user) : null;
  const userInitials = user ? getUserInitials(user) : "";
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "";
  const workspaceName = currentTeam?.name || tNav("sidebar.personalWorkspace");
  const period = useMemo(() => monthLabel(language), [language]);
  const workspaceMark = (currentTeam?.name || displayName || "M").trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-ledger-line bg-ledger-paper/95 backdrop-blur supports-[backdrop-filter]:bg-ledger-paper/85">
      <div className="flex min-h-16 items-center gap-3 px-4 py-2.5 min-[980px]:px-7">
        <Link
          to="/"
          aria-label={tNav("sidebar.backToSite")}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] text-ledger-muted hover:bg-ledger-surface-2 hover:text-ledger-ink min-[980px]:hidden"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 items-center gap-2.5 rounded-[7px] px-1 py-1 text-left transition-colors hover:bg-ledger-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent"
              aria-label={tNav("selector.switchWorkspace")}
            >
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] border border-ledger-line-strong bg-ledger-surface font-display text-base text-ledger-ink">
                {workspaceMark}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold leading-tight text-ledger-ink">
                  {workspaceName}
                </span>
                <span className="block truncate font-data text-[0.62rem] uppercase leading-tight tracking-[0.1em] text-ledger-muted">
                  {period}
                </span>
              </span>
              <ChevronDown className="ml-0.5 hidden h-3.5 w-3.5 shrink-0 text-ledger-muted sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>{tNav("selector.switchWorkspace")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void switchTeam(null)}
              className="flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {tNav("selector.personalWorkspace")}
              </span>
              {!currentTeam && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
            {userTeams.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{tNav("selector.teams")}</DropdownMenuLabel>
                {userTeams.map((team) => (
                  <DropdownMenuItem
                    key={team.id}
                    onClick={() => void switchTeam(team.id)}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{team.name}</span>
                        <span className="block font-data text-[0.6rem] uppercase tracking-[0.08em] text-ledger-muted">
                          {getTeamRoleDisplayName(team.user_role)}
                        </span>
                      </span>
                    </span>
                    {currentTeam?.id === team.id && <Check className="h-4 w-4 shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setCreateTeamOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {tTeam("actions.createTeam")}
            </DropdownMenuItem>
            {currentTeamRole && (
              <>
                <DropdownMenuSeparator />
                <p className="px-2 py-1.5 font-data text-[0.6rem] uppercase tracking-[0.08em] text-ledger-muted">
                  {tNav("selector.currentRole", {
                    defaultValue: "Signed in as {{role}}",
                    role: getTeamRoleDisplayName(currentTeamRole),
                  })}
                </p>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <NotificationCenter
            teamId={currentTeam?.id}
            className="h-9 w-9 text-ledger-muted hover:text-ledger-ink"
          />
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-9 w-9 text-ledger-muted hover:text-ledger-ink sm:inline-flex"
            onClick={() => void toggleMode()}
            title={isDarkMode ? tCommon("theme.light") : tCommon("theme.dark")}
            aria-label={isDarkMode ? tCommon("theme.light") : tCommon("theme.dark")}
          >
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="accent"
            size="app"
            className="ml-1 h-9 rounded-[7px] px-3.5"
            onClick={openModal}
            aria-label={tDash("workspace.overview.upload")}
          >
            <Upload className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{tDash("workspace.overview.upload")}</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent focus-visible:ring-offset-2"
                aria-label={tNav("userMenu.profile")}
              >
                <Avatar className="h-[34px] w-[34px]">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                  <AvatarFallback className="bg-ledger-accent-soft font-data text-[0.68rem] font-semibold text-ledger-accent">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="truncate">
                <span className="block truncate">{displayName}</span>
                <span className="mt-0.5 block truncate text-xs font-normal text-ledger-muted">
                  {user?.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile">
                  <User className="mr-2 h-4 w-4" />
                  {tNav("userMenu.profile")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  {tNav("userMenu.settings")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/help">
                  <CircleHelp className="mr-2 h-4 w-4" />
                  {tNav("userMenu.help")}
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/admin">
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      {tNav("mainMenu.admin")}
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void toggleMode()}>
                {isDarkMode ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                {isDarkMode ? tCommon("theme.light") : tCommon("theme.dark")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => void changeLanguage(language === "en" ? "ms" : "en")}
              >
                <span className="mr-2 inline-flex h-4 w-4 items-center justify-center font-data text-[0.58rem] uppercase">
                  {language === "en" ? "MS" : "EN"}
                </span>
                {language === "en" ? "Bahasa Melayu" : "English"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void signOut()}>
                <LogOut className="mr-2 h-4 w-4" />
                {tNav("userMenu.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CreateTeamDialog open={createTeamOpen} onOpenChange={setCreateTeamOpen} />
    </header>
  );
}
