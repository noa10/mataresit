import React from 'react';
import { useAppSidebar } from '@/contexts/AppSidebarContext';
import { Shield, Users, BarChart3, FileText, Settings, BookOpen } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAdminTranslation } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';

/**
 * Admin sidebar content wrapper for the unified sidebar system.
 *
 * IMPORTANT: This is a fallback component. Admin routes (/admin/*) actually use
 * their own AdminLayout with separate SidebarProvider and don't go through the
 * unified AppLayout system. This component exists for completeness and could be
 * used if admin routes were ever integrated into the unified sidebar system.
 *
 * Current admin architecture:
 * - Admin routes use AdminRoute → AdminLayoutPage → AdminLayout
 * - AdminLayout has its own SidebarProvider with Radix UI components
 * - Admin routes bypass AppLayout entirely
 */
export function AdminSidebarContent() {
  const { isSidebarOpen, toggleSidebar, isDesktop } = useAppSidebar();
  const { t } = useAdminTranslation();
  const location = useLocation();

  const navigationItems = [
    { path: '/admin', label: t('navigation.dashboard'), icon: BarChart3, exact: true },
    { path: '/admin/users', label: t('navigation.users'), icon: Users, exact: false },
    { path: '/admin/receipts', label: t('navigation.receipts'), icon: FileText, exact: false },
    { path: '/admin/analytics', label: t('navigation.analytics'), icon: BarChart3, exact: false },
    { path: '/admin/blog', label: t('navigation.blog'), icon: BookOpen, exact: false },
    { path: '/admin/settings', label: t('navigation.settings'), icon: Settings, exact: false },
  ];

  const isActivePath = (path: string) => {
    return location.pathname.startsWith(path);
  };

  const handleItemClick = () => {
    // Close sidebar on mobile after clicking a link
    if (!isDesktop) {
      toggleSidebar();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isSidebarOpen && !isDesktop && (
        <div
          className="fixed inset-0 bg-black/50 z-30 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={toggleSidebar}
          aria-label="Close admin sidebar overlay"
        />
      )}

      {/* Admin Sidebar */}
      <div
        className={cn(
          "h-full bg-background border-r border-border",
          "transition-all duration-300 ease-in-out",
          // Mobile behavior: fixed positioning with transform
          !isDesktop && [
            "fixed top-0 left-0 z-50 shadow-lg w-64",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          ],
          // Desktop behavior: always visible but can be collapsed
          isDesktop && [
            "relative flex-shrink-0",
            isSidebarOpen ? "w-64" : "w-16"
          ]
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          {(isSidebarOpen || !isDesktop) && (
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h2 className="font-semibold">{t('title')}</h2>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={toggleSidebar}>
            <Shield className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation Items */}
        <nav className="p-4">
          <ul className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? location.pathname === item.path
                : isActivePath(item.path);

              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                      isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground",
                      !isSidebarOpen && isDesktop && "justify-center"
                    )}
                    onClick={handleItemClick}
                    title={!isSidebarOpen && isDesktop ? item.label : undefined}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {(isSidebarOpen || !isDesktop) && <span>{item.label}</span>}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </>
  );
}
