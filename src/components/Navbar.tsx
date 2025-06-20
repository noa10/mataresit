import { useState, useEffect } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStripe } from "@/contexts/StripeContext";
import { useTeam } from "@/contexts/TeamContext";
import { useNavigationTranslation, useCommonTranslation } from "@/contexts/LanguageContext";

import { FileText, Sun, Moon, ChevronDown, BrainCircuit, Menu, X, Crown, Zap, MoreHorizontal, BarChart3, Sparkles, Settings, DollarSign, MessageSquare, Plus, User, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { LanguageSelector } from "@/components/LanguageSelector";
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
  chatControls?: {
    sidebarToggle?: React.ReactNode;
    onNewChat?: () => void;
    showChatTitle?: boolean;
  };
  navControls?: {
    navSidebarToggle?: React.ReactNode;
  };
}

export default function Navbar({ chatControls, navControls }: NavbarProps = {}) {
  const { user, signOut, isAdmin } = useAuth();
  const { subscriptionData } = useStripe();
  const { currentTeam } = useTeam();
  const { t: tNav } = useNavigationTranslation();
  const { t: tCommon } = useCommonTranslation();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Check if we're on the search/chat page
  const isSearchPage = location.pathname === '/search';

  // Check if we're on a public page (outside AppLayout)
  const isPublicPage = ['/', '/pricing', '/help', '/docs', '/status', '/auth', '/auth/callback', '/auth/reset-password', '/payment-success'].includes(location.pathname);

  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
    setIsDarkMode(!isDarkMode);
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
    <header className="w-full bg-background border-b relative z-30">
      <div className="container mx-auto flex items-center justify-between py-4 px-6">
        {/* Left Side: Logo & Brand */}
        <div className="flex items-center space-x-3">
          {/* Unified Sidebar Toggle (only show on protected pages) */}
          {!isPublicPage && (
            <div className="flex items-center space-x-2">
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
          <Button variant="ghost" size="sm" onClick={toggleTheme} title="Toggle theme" className="hidden sm:flex">
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* Primary CTA Button (Discord-style) */}
          {!user ? (
            <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4 py-2 rounded-full">
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
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile picture" />}
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
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

          {/* Mobile Menu Toggle */}
          <div className="lg:hidden">
            <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu (Discord-style) */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-background border-b shadow-lg z-50">
          <div className="container mx-auto py-6 px-6 space-y-6">
            {/* Mobile Navigation */}
            <nav className="space-y-1">
              {isPublicPage ? (
                <>
                  <Link
                    to="/features"
                    className="block py-3 px-4 rounded-lg text-sm font-medium text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {tNav('mainMenu.features')}
                  </Link>
                  <Link
                    to="/pricing"
                    className="block py-3 px-4 rounded-lg text-sm font-medium text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {tNav('mainMenu.pricing')}
                  </Link>
                  <div className="py-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2">
                      {tNav('mainMenu.resources')}
                    </div>
                    <Link
                      to="/docs"
                      className="block py-2 px-4 ml-4 rounded-lg text-sm text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {tNav('mainMenu.documentation')}
                    </Link>
                    <Link
                      to="/help"
                      className="block py-2 px-4 ml-4 rounded-lg text-sm text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {tNav('mainMenu.help')}
                    </Link>
                    <Link
                      to="/status"
                      className="block py-2 px-4 ml-4 rounded-lg text-sm text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {tNav('mainMenu.status')}
                    </Link>
                    <Link
                      to="/blog"
                      className="block py-2 px-4 ml-4 rounded-lg text-sm text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {tNav('mainMenu.blog')}
                    </Link>
                  </div>
                  {user && (
                    <Link
                      to="/dashboard"
                      className="block py-3 px-4 rounded-lg text-sm font-medium text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Link
                    to="/dashboard"
                    className="block py-3 px-4 rounded-lg text-sm font-medium text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {tNav('mainMenu.dashboard')}
                  </Link>
                  <Link
                    to="/search"
                    className="flex items-center gap-2 py-3 px-4 rounded-lg text-sm font-medium text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <BrainCircuit className="h-4 w-4" />
                    {tNav('mainMenu.search')}
                  </Link>
                </>
              )}
            </nav>

            {/* Mobile Actions */}
            <div className="space-y-3 pt-4 border-t border-border">
              {isSearchPage && chatControls?.onNewChat && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    chatControls.onNewChat();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full justify-start gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {tCommon('buttons.newChat')}
                </Button>
              )}

              <div className="w-full">
                <LanguageSelector variant="default" className="w-full justify-start" />
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className="w-full justify-start gap-2"
              >
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {isDarkMode ? tCommon('theme.light') : tCommon('theme.dark')}
              </Button>

              {user ? (
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center gap-3 px-4 py-2">
                    <Avatar className="h-8 w-8">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile picture" />}
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{user.email}</span>
                  </div>
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 w-full py-2 px-4 rounded-lg text-sm text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <User className="h-4 w-4" />
                    {tNav('userMenu.profile')}
                  </Link>

                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="flex items-center gap-2 w-full py-2 px-4 rounded-lg text-sm text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Crown className="h-4 w-4" />
                      {tNav('mainMenu.admin')}
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      signOut();
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-2 w-full py-2 px-4 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    {tNav('userMenu.logout')}
                  </button>
                </div>
              ) : (
                <Button
                  asChild
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Link to="/auth">{tCommon('buttons.getStarted')}</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
