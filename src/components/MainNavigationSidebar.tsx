import { useState, useEffect } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { TeamSelector } from "@/components/team/TeamSelector";
import { useNavigationTranslation } from "@/contexts/LanguageContext";
import { useSidebarAccessibility } from "@/hooks/useSidebarAccessibility";
import {
  BrainCircuit, BarChart3, Settings,
  DollarSign, ChevronLeft, Menu, X, Users, Crown, FileText, Code
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface MainNavigationSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export function MainNavigationSidebar({
  isOpen,
  onToggle,
  className
}: MainNavigationSidebarProps) {
  const { isAdmin } = useAuth();
  const { t: tNav } = useNavigationTranslation();
  const location = useLocation();
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  // Enhanced accessibility support
  const { sidebarProps } = useSidebarAccessibility({
    sidebarId: 'main-navigation-sidebar',
    autoFocus: true,
    trapFocus: true,
    announceStateChanges: true
  });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleItemClick = () => {
    // No special mobile handling needed since sidebar is desktop-only
  };

  // Hide sidebar completely on mobile devices (< lg breakpoint)
  if (!isDesktop) {
    return null;
  }

  return (
    <div
      id="main-navigation-sidebar"
      role="navigation"
      aria-label="Main navigation"
      {...sidebarProps}
      className={cn(
        "h-full bg-background border-r border-border",
        "transition-all duration-300 ease-in-out",
        // Desktop behavior: always visible but can be collapsed
        "relative flex-shrink-0",
        isOpen ? "w-64" : "w-16",
        className
      )}
    >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          {isOpen && (
            <h2 className="font-semibold">{tNav('sidebar.navigation')}</h2>
          )}
          <Button variant="ghost" size="sm" onClick={onToggle}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Team Selector */}
        {isOpen && (
          <div className="p-4 border-b">
            <TeamSelector showCreateButton={true} />
          </div>
        )}

        {/* Navigation Items */}
        <nav className="p-4">
          <ul className="space-y-2">
            <li>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                  isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground",
                  !isOpen && "justify-center")}
                onClick={handleItemClick}
                title={!isOpen ? tNav('mainMenu.dashboard') : undefined}
              >
                <BarChart3 className="h-4 w-4 flex-shrink-0" />
                {isOpen && <span>{tNav('mainMenu.dashboard')}</span>}
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/search"
                className={({ isActive }) =>
                  cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                  isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground",
                  !isOpen && "justify-center")}
                onClick={handleItemClick}
                title={!isOpen ? tNav('mainMenu.search') : undefined}
              >
                <BrainCircuit className="h-4 w-4 flex-shrink-0" />
                {isOpen && <span>{tNav('mainMenu.search')}</span>}
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/analysis"
                className={({ isActive }) =>
                  cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                  isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground",
                  !isOpen && "justify-center")}
                onClick={handleItemClick}
                title={!isOpen ? tNav('mainMenu.analysis') : undefined}
              >
                <BarChart3 className="h-4 w-4 flex-shrink-0" />
                {isOpen && <span>{tNav('mainMenu.analysis')}</span>}
              </NavLink>
            </li>

            <li>
              <NavLink
                to="/teams"
                className={({ isActive }) =>
                  cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                  isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground",
                  !isOpen && "justify-center")}
                onClick={handleItemClick}
                title={!isOpen ? tNav('mainMenu.teams') : undefined}
              >
                <Users className="h-4 w-4 flex-shrink-0" />
                {isOpen && <span>{tNav('mainMenu.teams')}</span>}
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/claims"
                className={({ isActive }) =>
                  cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                  isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground",
                  !isOpen && "justify-center")}
                onClick={handleItemClick}
                title={!isOpen ? tNav('mainMenu.claims') : undefined}
              >
                <FileText className="h-4 w-4 flex-shrink-0" />
                {isOpen && <span>{tNav('mainMenu.claims')}</span>}
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/pricing"
                className={({ isActive }) =>
                  cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                  isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground",
                  !isOpen && "justify-center")}
                onClick={handleItemClick}
                title={!isOpen ? tNav('mainMenu.pricing') : undefined}
              >
                <DollarSign className="h-4 w-4 flex-shrink-0" />
                {isOpen && <span>{tNav('mainMenu.pricing')}</span>}
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/api-reference"
                className={({ isActive }) =>
                  cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                  isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground",
                  !isOpen && "justify-center")}
                onClick={handleItemClick}
                title={!isOpen ? tNav('mainMenu.apiReference') : undefined}
              >
                <Code className="h-4 w-4 flex-shrink-0" />
                {isOpen && <span>{tNav('mainMenu.apiReference')}</span>}
              </NavLink>
            </li>

            <li>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                  isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground",
                  !isOpen && "justify-center")}
                onClick={handleItemClick}
                title={!isOpen ? tNav('mainMenu.settings') : undefined}
              >
                <Settings className="h-4 w-4 flex-shrink-0" />
                {isOpen && <span>{tNav('mainMenu.settings')}</span>}
              </NavLink>
            </li>
            {isAdmin && (
              <li>
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                    isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground",
                    !isOpen && "justify-center")}
                  onClick={handleItemClick}
                  title={!isOpen ? tNav('mainMenu.admin') : undefined}
                >
                  <Crown className="h-4 w-4 flex-shrink-0" />
                  {isOpen && <span>{tNav('mainMenu.admin')}</span>}
                </NavLink>
              </li>
            )}
          </ul>
        </nav>
      </div>
  );
}
