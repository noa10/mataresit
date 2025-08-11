import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigationTranslation } from '@/contexts/LanguageContext';
import { useAppSidebar } from '@/contexts/AppSidebarContext';
import { CompactChatHistory } from '../chat/CompactChatHistory';
import { TeamSelector } from '@/components/team/TeamSelector';
import {
  BrainCircuit, BarChart3, Settings,
  DollarSign, ChevronLeft, X, Users, Crown, FileText,
  MessageSquare
} from 'lucide-react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';

import { cn } from '@/lib/utils';

interface SearchPageSidebarContentProps {
  onNewChat: () => void;
  onSelectConversation: (conversationId: string) => void;
  currentConversationId?: string;
  className?: string;
}

/**
 * Hybrid sidebar content for the search page that combines main navigation
 * with conversation history. This ensures users always have access to main
 * navigation while also being able to manage their chat conversations.
 */
export function SearchPageSidebarContent({
  onNewChat,
  onSelectConversation,
  currentConversationId,
  className
}: SearchPageSidebarContentProps) {
  const { isAdmin } = useAuth();
  const { t: tNav } = useNavigationTranslation();
  const { isSidebarOpen, toggleSidebar } = useAppSidebar();
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);


  React.useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleItemClick = () => {
    // Close sidebar on mobile after clicking a link
    if (!isDesktop) {
      toggleSidebar();
    }
  };

  return (
    <>
      {/* Mobile Overlay - Enhanced with backdrop blur and scroll prevention */}
      {isSidebarOpen && !isDesktop && (
        <div
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm animate-in fade-in duration-300 overscroll-behavior-contain"
          onClick={toggleSidebar}
          aria-label="Close sidebar overlay"
          style={{ touchAction: 'none' }} // Prevent scrolling on overlay
        />
      )}

      <div
        className={cn(
          "bg-background border-r border-border flex flex-col overflow-hidden",
          "transition-all duration-300 ease-in-out",
          // Mobile behavior: fixed positioning with transform and proper viewport handling
          !isDesktop && [
            "fixed top-0 left-0 z-50 shadow-xl w-80",
            "h-full max-h-screen", // Ensure it doesn't exceed viewport
            "overscroll-behavior-y-contain", // Prevent body scroll when scrolling sidebar
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          ],
          // Desktop behavior: always visible but can be collapsed
          isDesktop && [
            "relative flex-shrink-0 h-full max-h-screen",
            isSidebarOpen ? "w-80" : "w-16"
          ],
          className
        )}
        role="complementary"
        aria-label="Search page sidebar with navigation and chat history"
      >
      {/* Header - Enhanced styling with flex-shrink-0 */}
      <div className="flex-shrink-0 flex items-center justify-between h-16 px-4 border-b border-border bg-background/50">
        {(isSidebarOpen || !isDesktop) && (
          <h2 className="font-semibold text-foreground">Navigation & Chat</h2>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="hover:bg-secondary/50 transition-colors"
        >
          {isDesktop ? <ChevronLeft className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </Button>
      </div>

      {/* Content - Enhanced with smooth animations and proper scrolling */}
      {(isSidebarOpen || !isDesktop) && (
        <div className="flex flex-col min-h-0 flex-1 overflow-hidden animate-in slide-in-from-left duration-300">
          {/* Team Selector - Enhanced spacing */}
          <div className="flex-shrink-0 p-4 border-b bg-background/30">
            <TeamSelector showCreateButton={true} />
          </div>

          {/* Main Navigation Section - Enhanced visual hierarchy with scrolling */}
          <div className="flex-shrink-0 border-b">
            <div className="flex items-center space-x-2 p-4 pb-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-foreground">Main Navigation</span>
            </div>
            {/* Scrollable Navigation Area - Enhanced for mobile touch */}
            <ScrollArea className="max-h-64 px-4 pb-4" style={{ touchAction: 'pan-y' }}>
              <nav>
                <ul className="space-y-2">
                  <li>
                    <NavLink
                      to="/dashboard"
                      className={({ isActive }) =>
                        cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                        isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground")}
                      onClick={handleItemClick}
                    >
                      <BarChart3 className="h-4 w-4 flex-shrink-0" />
                      <span>{tNav('mainMenu.dashboard')}</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/search"
                      className={({ isActive }) =>
                        cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                        isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground")}
                      onClick={handleItemClick}
                    >
                      <BrainCircuit className="h-4 w-4 flex-shrink-0" />
                      <span>{tNav('mainMenu.search')}</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/teams"
                      className={({ isActive }) =>
                        cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                        isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground")}
                      onClick={handleItemClick}
                    >
                      <Users className="h-4 w-4 flex-shrink-0" />
                      <span>{tNav('mainMenu.teams')}</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/claims"
                      className={({ isActive }) =>
                        cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                        isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground")}
                      onClick={handleItemClick}
                    >
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <span>{tNav('mainMenu.claims')}</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/settings"
                      className={({ isActive }) =>
                        cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                        isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground")}
                      onClick={handleItemClick}
                    >
                      <Settings className="h-4 w-4 flex-shrink-0" />
                      <span>{tNav('mainMenu.settings')}</span>
                    </NavLink>
                  </li>
                  {isAdmin && (
                    <li>
                      <NavLink
                        to="/admin"
                        className={({ isActive }) =>
                          cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary/50 transition-colors",
                          isActive ? "bg-secondary/70 text-primary font-semibold" : "text-foreground")}
                        onClick={handleItemClick}
                      >
                        <Crown className="h-4 w-4 flex-shrink-0" />
                        <span>{tNav('mainMenu.admin')}</span>
                      </NavLink>
                    </li>
                  )}
                </ul>
              </nav>
            </ScrollArea>
          </div>

          {/* Visual Separator with enhanced styling */}
          <Separator className="bg-border/60 flex-shrink-0" />

          {/* Compact Chat History Section - Enhanced integration with proper flex behavior */}
          <div className="flex-1 flex flex-col min-h-0 bg-background/20">
            <CompactChatHistory
              onNewChat={onNewChat}
              onSelectConversation={onSelectConversation}
              currentConversationId={currentConversationId}
              maxItems={10}
              className="flex-1 min-h-0"
            />
          </div>
        </div>
      )}

      {/* Collapsed state - Enhanced minimal icons with proper overflow handling */}
      {!isSidebarOpen && isDesktop && (
        <div className="flex-1 flex flex-col p-3 space-y-3 overflow-y-auto">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-12 p-0 hover:bg-secondary/50 transition-colors"
            onClick={toggleSidebar}
            title="Expand sidebar"
          >
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-12 p-0 hover:bg-secondary/50 transition-colors"
            onClick={onNewChat}
            title="New Chat"
          >
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
      )}
      </div>
    </>
  );
}
