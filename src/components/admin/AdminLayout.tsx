
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminTranslation } from "@/contexts/LanguageContext";
import { Link, useLocation } from "react-router-dom";
import { BarChart3, FileText, Home, Settings, Shield, Users, Menu, ChevronDown, BookOpen, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  const { t } = useAdminTranslation();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Check if the current route matches the given path
  const isActivePath = (path: string) => {
    return location.pathname === path ||
           (path !== '/admin' && location.pathname.startsWith(path));
  };

  // Navigation items
  const navigationItems = [
    { path: '/admin', label: t('navigation.dashboard'), icon: Home, exact: true },
    { path: '/admin/users', label: t('navigation.users'), icon: Users },
    { path: '/admin/receipts', label: t('navigation.receipts'), icon: FileText },
    { path: '/admin/blog', label: t('navigation.blog'), icon: BookOpen },
    { path: '/admin/analytics', label: t('navigation.analytics'), icon: BarChart3 },
    { path: '/admin/embedding-metrics', label: 'Embedding Metrics', icon: Activity },
    { path: '/admin/settings', label: t('navigation.settings'), icon: Settings },
  ];

  return (
    <div className="h-screen overflow-hidden">
      {/* Mobile Navigation Bar (visible on screens < lg) */}
      <div className="lg:hidden">
        {/* Mobile Top Navigation */}
        <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-semibold">{t('title')}</h1>
          </div>

          {/* Mobile Navigation Dropdown */}
          <DropdownMenu open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Menu className="h-4 w-4" />
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? location.pathname === item.path
                  : isActivePath(item.path);

                return (
                  <DropdownMenuItem key={item.path} asChild>
                    <Link
                      to={item.path}
                      className={cn(
                        "flex items-center gap-2 w-full",
                        isActive ? "bg-secondary/70" : ""
                      )}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuItem asChild>
                <Link to="/dashboard" className="flex items-center gap-2 w-full">
                  <Home className="h-4 w-4" />
                  <span>{t('actions.exitAdmin')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => signOut()} className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>{t('actions.signOut')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Main Content */}
        <main className="overflow-auto bg-background" style={{ height: 'calc(100vh - 73px)' }}>
          <div className="p-4">
            {children}
          </div>
        </main>
      </div>

      {/* Desktop Navigation (visible on screens >= lg) */}
      <div className="hidden lg:block">
        <SidebarProvider defaultOpen={true}>
          <div className="flex h-screen overflow-hidden">
            <Sidebar className="border-r">
              <SidebarHeader className="p-4 border-b">
                <div className="flex items-center gap-2">
                  <Shield className="h-6 w-6 text-primary" />
                  <h1 className="text-xl font-bold">{t('title')}</h1>
                </div>
              </SidebarHeader>
              <SidebarContent>
                <SidebarMenu>
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.exact
                      ? location.pathname === item.path
                      : isActivePath(item.path);

                    return (
                      <SidebarMenuItem key={item.path}>
                        <Link
                          to={item.path}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                            isActive ? "bg-secondary/70" : ""
                          )}
                          title={item.label}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarContent>
              <SidebarFooter className="p-4">
                <div className="flex flex-col gap-2">
                  {user && (
                    <div className="text-sm text-muted-foreground">
                      {t('actions.signedInAs')} {user.email}
                    </div>
                  )}
                  <Button variant="outline" size="sm" onClick={() => signOut()}>
                    {t('actions.signOut')}
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/dashboard">{t('actions.exitAdmin')}</Link>
                  </Button>
                </div>
              </SidebarFooter>
            </Sidebar>
            <main className="flex-1 overflow-auto bg-background">
              <div className="p-6">
                {children}
              </div>
            </main>
          </div>
        </SidebarProvider>
      </div>
    </div>
  );
}
