import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminTranslation } from "@/contexts/LanguageContext";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  BookOpen,
  FileText,
  Home,
  LogOut,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "react-router-dom";

interface AdminLayoutProps {
  children: ReactNode;
}

interface AdminNavigationItem {
  path: string;
  label: string;
  icon: LucideIcon;
  description: string;
  exact?: boolean;
}

const ADMIN_NAVIGATION_ID = "admin-navigation";
const ADMIN_MAIN_CONTENT_ID = "admin-main-content";

function isActiveNavItem(pathname: string, item: AdminNavigationItem) {
  if (item.exact) {
    return pathname === item.path;
  }

  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

function focusAdminMainContent() {
  const mainContent = document.getElementById(ADMIN_MAIN_CONTENT_ID);

  if (mainContent instanceof HTMLElement) {
    mainContent.focus();
  }
}

function AdminNavigationOpenTrigger({ className }: { className?: string }) {
  const { openMobile } = useSidebar();

  return (
    <SidebarTrigger
      className={cn(className, openMobile && "pointer-events-none invisible")}
      aria-controls={ADMIN_NAVIGATION_ID}
      aria-expanded={openMobile}
      aria-haspopup="dialog"
      aria-label="Open admin navigation menu"
    />
  );
}

function AdminNavigationCloseTrigger({ className }: { className?: string }) {
  return (
    <SidebarTrigger
      className={className}
      aria-controls={ADMIN_NAVIGATION_ID}
      aria-expanded="true"
      aria-label="Close admin navigation menu"
    />
  );
}

function AdminNavigationSheetMetadata({ title }: { title: string }) {
  const { isMobile } = useSidebar();

  if (!isMobile) {
    return null;
  }

  return (
    <>
      <SheetTitle className="sr-only">{`${title} navigation menu`}</SheetTitle>
      <SheetDescription className="sr-only">
        Browse admin sections, review account context, or exit the admin area.
      </SheetDescription>
    </>
  );
}

function AdminNavigationMenu({
  navigationItems,
  pathname,
}: {
  navigationItems: AdminNavigationItem[];
  pathname: string;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const navigationLabelId = useId();
  const navigationDescriptionId = useId();

  const handleNavigation = () => {
    if (isMobile) {
      setOpenMobile(false);
      window.setTimeout(() => {
        focusAdminMainContent();
      }, 0);
    }
  };

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupLabel
        id={navigationLabelId}
        className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80"
      >
        Admin navigation
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <nav
          id={ADMIN_NAVIGATION_ID}
          aria-describedby={navigationDescriptionId}
          aria-labelledby={navigationLabelId}
          className="px-2"
        >
          <p id={navigationDescriptionId} className="sr-only">
            Browse admin sections and account actions.
          </p>
          <SidebarMenu className="gap-1.5">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActiveNavItem(pathname, item);

              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    size="lg"
                    tooltip={item.label}
                    className={cn(
                      "h-11 rounded-xl px-3 text-sm transition-all",
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/15 hover:bg-primary/10 hover:text-primary"
                        : "text-muted-foreground hover:bg-sidebar-accent/80 hover:text-foreground"
                    )}
                  >
                    <Link
                      to={item.path}
                      aria-current={isActive ? "page" : undefined}
                      onClick={handleNavigation}
                    >
                      <Icon aria-hidden="true" className={cn("size-4", isActive && "text-primary")} />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </nav>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function AdminLayoutContent({ children }: AdminLayoutProps) {
  const { signOut, user } = useAuth();
  const { t } = useAdminTranslation();
  const location = useLocation();
  const { isMobile } = useSidebar();

  const navigationItems: AdminNavigationItem[] = [
    {
      path: "/admin",
      label: t("navigation.dashboard"),
      icon: Home,
      description: "Overview of admin tools and system status.",
      exact: true,
    },
    {
      path: "/admin/users",
      label: t("navigation.users"),
      icon: Users,
      description: "Manage user access, roles, and accounts.",
    },
    {
      path: "/admin/receipts",
      label: t("navigation.receipts"),
      icon: FileText,
      description: "Review receipt records and operational data.",
    },
    {
      path: "/admin/blog",
      label: t("navigation.blog"),
      icon: BookOpen,
      description: "Publish and maintain blog content.",
    },
    {
      path: "/admin/analytics",
      label: t("navigation.analytics"),
      icon: BarChart3,
      description: "Monitor analytics and reporting metrics.",
    },
    {
      path: "/admin/embedding-metrics",
      label: "Embedding Metrics",
      icon: Activity,
      description: "Inspect embedding performance and health.",
    },
    {
      path: "/admin/settings",
      label: t("navigation.settings"),
      icon: Settings,
      description: "Configure admin-facing settings and controls.",
    },
  ];

  const activeNavigationItem =
    navigationItems.find((item) => isActiveNavItem(location.pathname, item)) ?? navigationItems[0];

  const handleSkipToContent = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    focusAdminMainContent();
  };

  return (
    <>
      <a
        href={`#${ADMIN_MAIN_CONTENT_ID}`}
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground shadow-md ring-1 ring-border focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={handleSkipToContent}
      >
        Skip to admin content
      </a>
      {(() => {
        const sidebarPanel = (
          <>
            <SidebarHeader className="gap-4 px-4 py-5">
              <AdminNavigationSheetMetadata title={t("title")} />
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                    <Shield aria-hidden="true" className="size-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Admin console
                    </p>
                    <div className="space-y-1">
                      <h1 className="truncate text-base font-semibold leading-none">{t("title")}</h1>
                      <p className="text-sm text-muted-foreground">
                        Manage users, content, and operational visibility.
                      </p>
                    </div>
                  </div>
                </div>
                <AdminNavigationCloseTrigger className="md:hidden" />
              </div>
            </SidebarHeader>
            <SidebarSeparator />
            <SidebarContent className="px-3 py-4">
              <AdminNavigationMenu
                navigationItems={navigationItems}
                pathname={location.pathname}
              />
            </SidebarContent>
            <SidebarSeparator />
            <SidebarFooter className="gap-4 px-3 py-4">
              {user && (
                <div className="rounded-xl border border-sidebar-border/70 bg-sidebar-accent/30 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {t("actions.signedInAs")}
                  </p>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">{user.email}</p>
                </div>
              )}
              <div className="grid gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => void signOut()}
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                  {t("actions.signOut")}
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2" asChild>
                  <Link to="/dashboard">
                    <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                    {t("actions.exitAdmin")}
                  </Link>
                </Button>
              </div>
            </SidebarFooter>
          </>
        );

        if (isMobile) {
          return <Sidebar>{sidebarPanel}</Sidebar>;
        }

        return (
          <aside
            aria-label="Admin sidebar"
            className="hidden h-svh w-64 shrink-0 border-r border-sidebar-border/70 bg-sidebar/95 text-sidebar-foreground md:flex"
          >
            <div className="flex h-full w-full flex-col">{sidebarPanel}</div>
          </aside>
        );
      })()}

      <main
        id={ADMIN_MAIN_CONTENT_ID}
        aria-label="Admin content"
        tabIndex={-1}
        className="flex min-h-svh min-w-0 flex-1 flex-col overflow-hidden bg-background focus:outline-none"
      >
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
          <AdminNavigationOpenTrigger className="-ml-1 md:hidden" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Admin area
            </p>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold md:text-base">
                {activeNavigationItem.label}
              </h2>
              <p className="hidden truncate text-sm text-muted-foreground sm:block">
                {activeNavigationItem.description}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="hidden gap-2 sm:inline-flex" asChild>
            <Link to="/dashboard">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              {t("actions.exitAdmin")}
            </Link>
          </Button>
        </header>

        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto flex min-w-0 w-full max-w-7xl flex-col px-4 py-4 md:px-6 md:py-6 xl:px-8">
            {children}
          </div>
        </div>
      </main>
    </>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <SidebarProvider defaultOpen className="min-h-svh bg-background md:h-screen md:overflow-hidden">
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </SidebarProvider>
  );
}
