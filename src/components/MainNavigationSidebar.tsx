import { useState, useEffect } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { TeamSelector } from "@/components/team/TeamSelector";
import { useNavigationTranslation } from "@/contexts/LanguageContext";
import {
  BrainCircuit, BarChart3, Settings,
  DollarSign, ChevronLeft, Menu, X, Users, Crown, FileText
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

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Manage body scroll state for mobile sidebar
  useEffect(() => {
    if (!isDesktop) {
      if (isOpen) {
        document.body.classList.add('sidebar-open');
      } else {
        document.body.classList.remove('sidebar-open');
      }
    } else {
      // Always remove the class on desktop
      document.body.classList.remove('sidebar-open');
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('sidebar-open');
    };
  }, [isOpen, isDesktop]);

  const handleItemClick = () => {
    // Close sidebar on mobile after clicking a link
    if (!isDesktop) {
      onToggle();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && !isDesktop && (
        <div
          className="fixed inset-0 bg-black/50 z-30 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={onToggle}
          aria-label="Close sidebar overlay"
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "h-full bg-background border-r border-border",
          "transition-all duration-300 ease-in-out",
          // Mobile behavior: fixed positioning with transform
          !isDesktop && [
            "fixed top-0 left-0 z-50 shadow-lg w-64",
            isOpen ? "translate-x-0" : "-translate-x-full"
          ],
          // Desktop behavior: always visible but can be collapsed
          isDesktop && [
            "relative flex-shrink-0",
            isOpen ? "w-64" : "w-16"
          ],
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          {(isOpen || !isDesktop) && (
            <h2 className="font-semibold">{tNav('sidebar.navigation')}</h2>
          )}
          <Button variant="ghost" size="sm" onClick={onToggle}>
            {isDesktop ? <ChevronLeft className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </Button>
        </div>

        {/* Team Selector */}
        {(isOpen || !isDesktop) && (
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
                  !isOpen && isDesktop && "justify-center")}
                onClick={handleItemClick}
                title={!isOpen && isDesktop ? tNav('mainMenu.dashboard') : undefined}
              >
                <BarChart3 className="h-4 w-4 flex-shrink-0" />
                {(isOpen || !isDesktop) && <span>{tNav('mainMenu.dashboard')}</span>}
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/search"
                className={({ isActive }) =>
                  cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                  isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground",
                  !isOpen && isDesktop && "justify-center")}
                onClick={handleItemClick}
                title={!isOpen && isDesktop ? tNav('mainMenu.search') : undefined}
              >
                <BrainCircuit className="h-4 w-4 flex-shrink-0" />
                {(isOpen || !isDesktop) && <span>{tNav('mainMenu.search')}</span>}
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/analysis"
                className={({ isActive }) =>
                  cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                  isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground",
                  !isOpen && isDesktop && "justify-center")}
                onClick={handleItemClick}
                title={!isOpen && isDesktop ? tNav('mainMenu.analysis') : undefined}
              >
                <BarChart3 className="h-4 w-4 flex-shrink-0" />
                {(isOpen || !isDesktop) && <span>{tNav('mainMenu.analysis')}</span>}
              </NavLink>
            </li>

            <li>
              <NavLink
                to="/teams"
                className={({ isActive }) =>
                  cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                  isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground",
                  !isOpen && isDesktop && "justify-center")}
                onClick={handleItemClick}
                title={!isOpen && isDesktop ? tNav('mainMenu.teams') : undefined}
              >
                <Users className="h-4 w-4 flex-shrink-0" />
                {(isOpen || !isDesktop) && <span>{tNav('mainMenu.teams')}</span>}
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/claims"
                className={({ isActive }) =>
                  cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                  isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground",
                  !isOpen && isDesktop && "justify-center")}
                onClick={handleItemClick}
                title={!isOpen && isDesktop ? tNav('mainMenu.claims') : undefined}
              >
                <FileText className="h-4 w-4 flex-shrink-0" />
                {(isOpen || !isDesktop) && <span>{tNav('mainMenu.claims')}</span>}
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/pricing"
                className={({ isActive }) =>
                  cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                  isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground",
                  !isOpen && isDesktop && "justify-center")}
                onClick={handleItemClick}
                title={!isOpen && isDesktop ? tNav('mainMenu.pricing') : undefined}
              >
                <DollarSign className="h-4 w-4 flex-shrink-0" />
                {(isOpen || !isDesktop) && <span>{tNav('mainMenu.pricing')}</span>}
              </NavLink>
            </li>

            <li>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                  isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground",
                  !isOpen && isDesktop && "justify-center")}
                onClick={handleItemClick}
                title={!isOpen && isDesktop ? tNav('mainMenu.settings') : undefined}
              >
                <Settings className="h-4 w-4 flex-shrink-0" />
                {(isOpen || !isDesktop) && <span>{tNav('mainMenu.settings')}</span>}
              </NavLink>
            </li>
            {isAdmin && (
              <li>
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                    isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground",
                    !isOpen && isDesktop && "justify-center")}
                  onClick={handleItemClick}
                  title={!isOpen && isDesktop ? tNav('mainMenu.admin') : undefined}
                >
                  <Crown className="h-4 w-4 flex-shrink-0" />
                  {(isOpen || !isDesktop) && <span>{tNav('mainMenu.admin')}</span>}
                </NavLink>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </>
  );
}
