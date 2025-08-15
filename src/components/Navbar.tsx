import { useState, useEffect } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStripe } from "@/contexts/StripeContext";
import { useTeam } from "@/contexts/TeamContext";
import { useChatControls } from "@/contexts/ChatControlsContext";
import { useNavigationTranslation, useCommonTranslation } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

import { FileText, Sun, Moon, ChevronDown, BrainCircuit, Menu, X, Crown, Zap, MoreHorizontal, BarChart3, Sparkles, Settings, DollarSign, MessageSquare, Plus, User, LogOut, ShieldCheck, Code, Users } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { LanguageSelector } from "@/components/LanguageSelector";
import { TeamSelector } from "@/components/team/TeamSelector";
import { CompactChatHistory } from "@/components/chat/CompactChatHistory";
import { cn } from "@/lib/utils";
import { getAvatarUrl, getUserInitials } from "@/services/avatarService";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "./ui/dropdown-menu";

interface NavbarProps {
  navControls?: {
    navSidebarToggle?: React.ReactNode;
  };
}

export default function Navbar({ navControls }: NavbarProps = {}) {
  const { user, signOut, isAdmin } = useAuth();
  const { subscriptionData } = useStripe();
  const { currentTeam } = useTeam();
  const { chatControls } = useChatControls();
  const { t: tNav } = useNavigationTranslation();
  const { t: tCommon } = useCommonTranslation();
  const { isDarkMode, toggleMode } = useTheme();
  const location = useLocation();

  // Check if we're on the search/chat page
  const isSearchPage = location.pathname === '/search';

  // Check if we're on a public page (outside AppLayout)
  const isPublicPage = ['/', '/pricing', '/help', '/docs', '/status', '/auth', '/auth/callback', '/auth/reset-password', '/payment-success', '/features'].includes(location.pathname);

  // Theme toggle function using the new context
  const handleThemeToggle = async () => {
    await toggleMode();
  };

  const initial = user?.email?.charAt(0).toUpperCase() ?? "";
  const avatarUrl = user ? getAvatarUrl(user) : null;
  const userInitials = user ? getUserInitials(user) : "";

  const getTierBadge = () => {
    if (!subscriptionData?.tier || subscriptionData.tier === 'free') return null;
    const colors = {
      pro: 'bg-blue-500 text-white',
      max: 'bg-purple-500 text-white'
    };
    return (
      <Badge className={`${colors[subscriptionData.tier as keyof typeof colors]} text-xs px-1.5 py-0.5 ml-2`}>
        {subscriptionData.tier === 'pro' ? <Zap className="h-3 w-3" /> : <Crown className="h-3 w-3" />}
        <span className="ml-1 capitalize">{subscriptionData.tier}</span>
      </Badge>
    );
  };

  return (
    <header className="w-full bg-background border-b border-border relative z-30 h-16">
      <div className="container mx-auto flex items-center justify-between h-full px-4 sm:px-6 lg:px-8">
        {/* Left Side: Logo & Brand */}
        <div className="flex items-center space-x-3">
          {/* Unified Sidebar Toggle (only show on protected pages and desktop) */}
          {!isPublicPage && (
            <div className="hidden lg:flex items-center space-x-2">
              {/* Show chat sidebar toggle on search page, otherwise show nav sidebar toggle */}
              {isSearchPage ? chatControls?.sidebarToggle : navControls?.navSidebarToggle}
            </div>
          )}

          <NavLink to="/" className="flex items-center gap-2 text-xl font-bold text-foreground hover:text-primary transition-colors">
            <img src="/mataresit-icon.png" alt="Mataresit Logo" className="h-7 w-7" />
            <span>Mataresit</span>
          </NavLink>

          {getTierBadge()}


        </div>

        {/* Center: Main Navigation (Discord-style) */}
        <nav className="hidden lg:flex items-center space-x-8">
          {isPublicPage ? (
            // Public page navigation
            <>
              <NavLink
                to="/features"
                className={({ isActive }) =>
                  cn("text-sm font-medium transition-colors hover:text-primary",
                  isActive ? "text-primary" : "text-muted-foreground")}
              >
                {tNav('mainMenu.features')}
              </NavLink>
              <NavLink
                to="/pricing"
                className={({ isActive }) =>
                  cn("text-sm font-medium transition-colors hover:text-primary",
                  isActive ? "text-primary" : "text-muted-foreground")}
              >
                {tNav('mainMenu.pricing')}
              </NavLink>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors p-0 h-auto">
                    {tNav('mainMenu.resources')} <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link to="/docs" className="flex items-center gap-2 w-full">
                      <FileText className="h-4 w-4" />
                      {tNav('mainMenu.documentation')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/api-reference" className="flex items-center gap-2 w-full">
                      <Code className="h-4 w-4" />
                      {tNav('mainMenu.apiReference')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/help" className="flex items-center gap-2 w-full">
                      <MessageSquare className="h-4 w-4" />
                      {tNav('mainMenu.help')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/status" className="flex items-center gap-2 w-full">
                      <ShieldCheck className="h-4 w-4" />
                      {tNav('mainMenu.status')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/blog" className="flex items-center gap-2 w-full">
                      <FileText className="h-4 w-4" />
                      {tNav('mainMenu.blog')}
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {user && (
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    cn("text-sm font-medium transition-colors hover:text-primary",
                    isActive ? "text-primary" : "text-muted-foreground")}
                >
                  {tNav('mainMenu.dashboard')}
                </NavLink>
              )}
            </>
          ) : (
            // Protected page navigation (minimal since sidebar handles main nav)
            <>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  cn("text-sm font-medium transition-colors hover:text-primary",
                  isActive ? "text-primary" : "text-muted-foreground")}
              >
                {tNav('mainMenu.dashboard')}
              </NavLink>
              <NavLink
                to="/search"
                className={({ isActive }) =>
                  cn("text-sm font-medium transition-colors hover:text-primary flex items-center gap-1",
                  isActive ? "text-primary" : "text-muted-foreground")}
              >
                <BrainCircuit className="h-4 w-4" />
                {tNav('mainMenu.search')}
              </NavLink>
            </>
          )}
        </nav>

        {/* Right Side: Primary Actions (Discord-style) */}
        <div className="flex items-center space-x-3">
          {/* Search Page New Chat Button */}
          {isSearchPage && chatControls?.onNewChat && (
            <Button variant="outline" size="sm" onClick={chatControls.onNewChat} className="hidden sm:flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {tCommon('buttons.newChat')}
            </Button>
          )}

          {/* Language Selector */}
          <div className="hidden sm:block">
            <LanguageSelector variant="compact" />
          </div>

          {/* Theme Toggle */}
          <Button variant="ghost" size="sm" onClick={handleThemeToggle} title="Toggle theme" className="hidden sm:flex">
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* Mobile Menu for Non-Authenticated Users on Public Pages */}
          {!user && isPublicPage && (
            <div className="lg:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Menu className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] max-w-sm">
                  {/* Public Navigation */}
                  <DropdownMenuItem asChild>
                    <Link to="/features" className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      {tNav('mainMenu.features')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/pricing" className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      {tNav('mainMenu.pricing')}
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Resources */}
                  <div className="px-2 py-1">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                      {tNav('mainMenu.resources')}
                    </div>
                    <DropdownMenuItem asChild>
                      <Link to="/docs" className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {tNav('mainMenu.documentation')}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/help" className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        {tNav('mainMenu.help')}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/status" className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        {tNav('mainMenu.status')}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/blog" className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {tNav('mainMenu.blog')}
                      </Link>
                    </DropdownMenuItem>
                  </div>

                  <DropdownMenuSeparator />

                  {/* Settings */}
                  <div className="px-2 py-1">
                    <LanguageSelector variant="default" className="w-full justify-start" />
                  </div>
                  <DropdownMenuItem onClick={handleThemeToggle}>
                    {isDarkMode ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                    {isDarkMode ? tCommon('theme.light') : tCommon('theme.dark')}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Get Started CTA */}
                  <div className="px-2 py-1">
                    <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium">
                      <Link to="/auth">{tCommon('buttons.getStarted')}</Link>
                    </Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Primary CTA Button (Discord-style) - Desktop */}
          {!user ? (
            <Button asChild className="hidden lg:flex bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4 py-2 rounded-full">
              <Link to="/auth">{tCommon('buttons.getStarted')}</Link>
            </Button>
          ) : (
            <div className="flex items-center space-x-3">
              {/* Notification Center (only show for authenticated users) */}
              <NotificationCenter teamId={currentTeam?.id} />

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 p-2 rounded-full hover:bg-secondary/50">
                    <Avatar className="h-8 w-8">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile picture" />}
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] lg:w-56 max-w-sm lg:max-w-sm p-1 lg:max-h-none max-h-[80vh] lg:overflow-visible overflow-y-auto">
                  {/* Content wrapper for mobile scrolling */}
                      {/* User Info Header */}
                      <DropdownMenuLabel className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile picture" />}
                          <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
                            {userInitials}
                          </AvatarFallback>
                        </Avatar>
                        {user.email}
                      </DropdownMenuLabel>

                  {/* Mobile Navigation - Only show on mobile screens */}
                  <div className="lg:hidden">
                    {isPublicPage ? (
                      <>
                        <DropdownMenuSeparator />

                        {/* Public Page Navigation */}
                        <div className="px-2 py-1">
                          <DropdownMenuItem asChild>
                            <Link to="/features" className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4" />
                              {tNav('mainMenu.features')}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/pricing" className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4" />
                              {tNav('mainMenu.pricing')}
                            </Link>
                          </DropdownMenuItem>
                        </div>

                        <DropdownMenuSeparator />

                        {/* Resources Section */}
                        <div className="px-2 py-1">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                            {tNav('mainMenu.resources')}
                          </div>
                          <DropdownMenuItem asChild>
                            <Link to="/docs" className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              {tNav('mainMenu.documentation')}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/help" className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              {tNav('mainMenu.help')}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/status" className="flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4" />
                              {tNav('mainMenu.status')}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/blog" className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              {tNav('mainMenu.blog')}
                            </Link>
                          </DropdownMenuItem>
                        </div>

                        {user && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link to="/dashboard" className="flex items-center gap-2">
                                <BarChart3 className="h-4 w-4" />
                                Dashboard
                              </Link>
                            </DropdownMenuItem>
                          </>
                        )}

                        <DropdownMenuSeparator />

                        {/* Mobile Actions for Public Pages */}
                        <div className="px-2 py-1">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                            Settings
                          </div>
                          <div className="px-2 py-1">
                            <LanguageSelector variant="default" className="w-full justify-start" />
                          </div>
                          <DropdownMenuItem onClick={handleThemeToggle}>
                            {isDarkMode ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                            {isDarkMode ? tCommon('theme.light') : tCommon('theme.dark')}
                          </DropdownMenuItem>
                        </div>
                      </>
                    ) : (
                      <>
                        <DropdownMenuSeparator />

                        {/* Team Context Section */}
                        <div className="px-2 py-2">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                            Team Workspace
                          </div>
                          <div className="px-2">
                            <TeamSelector showCreateButton={true} />
                          </div>
                        </div>

                        <DropdownMenuSeparator />

                        {/* Core Navigation */}
                        <div className="px-2 py-1">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                            {tNav('sidebar.navigation')}
                          </div>
                          <DropdownMenuItem asChild>
                            <Link to="/dashboard" className="flex items-center gap-2">
                              <BarChart3 className="h-4 w-4" />
                              {tNav('mainMenu.dashboard')}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/search" className="flex items-center gap-2">
                              <BrainCircuit className="h-4 w-4" />
                              {tNav('mainMenu.search')}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/analysis" className="flex items-center gap-2">
                              <BarChart3 className="h-4 w-4" />
                              {tNav('mainMenu.analysis')}
                            </Link>
                          </DropdownMenuItem>
                        </div>

                        <DropdownMenuSeparator />

                        {/* Collaboration Section */}
                        <div className="px-2 py-1">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                            Collaboration
                          </div>
                          <DropdownMenuItem asChild>
                            <Link to="/teams" className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              {tNav('mainMenu.teams')}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/claims" className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              {tNav('mainMenu.claims')}
                            </Link>
                          </DropdownMenuItem>
                        </div>

                        <DropdownMenuSeparator />

                        {/* Tools & Settings Section */}
                        <div className="px-2 py-1">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                            Tools & Settings
                          </div>
                          <DropdownMenuItem asChild>
                            <Link to="/settings" className="flex items-center gap-2">
                              <Settings className="h-4 w-4" />
                              {tNav('mainMenu.settings')}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/api-reference" className="flex items-center gap-2">
                              <Code className="h-4 w-4" />
                              {tNav('mainMenu.apiReference')}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/pricing" className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4" />
                              {tNav('mainMenu.pricing')}
                            </Link>
                          </DropdownMenuItem>
                        </div>

                        <DropdownMenuSeparator />

                        {/* Mobile Actions */}
                        <div className="px-2 py-1">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                            Actions
                          </div>
                          {isSearchPage && chatControls?.onNewChat && (
                            <DropdownMenuItem onClick={chatControls.onNewChat}>
                              <Plus className="h-4 w-4 mr-2" />
                              {tCommon('buttons.newChat')}
                            </DropdownMenuItem>
                          )}
                          <div className="px-2 py-1">
                            <LanguageSelector variant="default" className="w-full justify-start" />
                          </div>
                          <DropdownMenuItem onClick={handleThemeToggle}>
                            {isDarkMode ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                            {isDarkMode ? tCommon('theme.light') : tCommon('theme.dark')}
                          </DropdownMenuItem>
                        </div>

                        <DropdownMenuSeparator />
                      </>
                    )}
                  </div>

                  {/* Chat History Section - Only show on search page */}
                  {isSearchPage && chatControls && (
                    <>
                      <DropdownMenuSeparator />

                      <div className="px-2 py-1">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                          Chat History
                        </div>
                        <div className="lg:max-h-48 max-h-32 overflow-hidden">
                          <CompactChatHistory
                            onNewChat={chatControls.onNewChat || (() => {})}
                            onSelectConversation={chatControls.onSelectConversation || (() => {})}
                            currentConversationId={chatControls.currentConversationId}
                            maxItems={5}
                            className="border-0"
                            maxHeight="lg:12rem 8rem" // Responsive max height
                          />
                        </div>
                      </div>

                      <DropdownMenuSeparator />
                    </>
                  )}

                  {/* User Profile Section - Always visible */}
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {tNav('userMenu.profile')}
                    </Link>
                  </DropdownMenuItem>

                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/admin" className="flex items-center gap-2">
                          <Crown className="h-4 w-4" />
                          {tNav('mainMenu.admin')}
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => signOut()} className="text-red-600 focus:text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    {tNav('userMenu.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}


        </div>
      </div>


    </header>
  );
}
