import { useState, useEffect } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStripe } from "@/contexts/StripeContext";
import { FileText, Sun, Moon, ChevronDown, BrainCircuit, Menu, X, Crown, Zap, MoreHorizontal, BarChart3, Sparkles, Settings, DollarSign, MessageSquare, Plus, User, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
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
          {/* Sidebar Toggles (only show on protected pages) */}
          {!isPublicPage && (
            <div className="flex items-center space-x-2">
              {navControls?.navSidebarToggle}
              {isSearchPage && chatControls?.sidebarToggle}
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
                Features
              </NavLink>
              <NavLink
                to="/pricing"
                className={({ isActive }) =>
                  cn("text-sm font-medium transition-colors hover:text-primary",
                  isActive ? "text-primary" : "text-muted-foreground")}
              >
                Pricing
              </NavLink>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors p-0 h-auto">
                    Resources <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link to="/docs" className="flex items-center gap-2 w-full">
                      <FileText className="h-4 w-4" />
                      Documentation
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/help" className="flex items-center gap-2 w-full">
                      <MessageSquare className="h-4 w-4" />
                      Help Center
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/status" className="flex items-center gap-2 w-full">
                      <ShieldCheck className="h-4 w-4" />
                      System Status
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/blog" className="flex items-center gap-2 w-full">
                      <FileText className="h-4 w-4" />
                      Blog
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
                  Dashboard
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
                Dashboard
              </NavLink>
              <NavLink
                to="/search"
                className={({ isActive }) =>
                  cn("text-sm font-medium transition-colors hover:text-primary flex items-center gap-1",
                  isActive ? "text-primary" : "text-muted-foreground")}
              >
                <BrainCircuit className="h-4 w-4" />
                AI Search
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
              New Chat
            </Button>
          )}

          {/* Theme Toggle */}
          <Button variant="ghost" size="sm" onClick={toggleTheme} title="Toggle theme" className="hidden sm:flex">
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* Primary CTA Button (Discord-style) */}
          {!user ? (
            <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4 py-2 rounded-full">
              <Link to="/auth">Get Started</Link>
            </Button>
          ) : (
            <div className="flex items-center space-x-3">
              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 p-2 rounded-full hover:bg-secondary/50">
                    <span className="rounded-full bg-primary text-primary-foreground w-8 h-8 flex items-center justify-center font-bold text-sm">
                      {initial}
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <span className="rounded-full bg-primary text-primary-foreground w-6 h-6 flex items-center justify-center font-bold text-xs">
                      {initial}
                    </span>
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/admin" className="flex items-center gap-2">
                          <Crown className="h-4 w-4" />
                          Admin Panel
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => signOut()} className="text-red-600 focus:text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
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
                    Features
                  </Link>
                  <Link
                    to="/pricing"
                    className="block py-3 px-4 rounded-lg text-sm font-medium text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Pricing
                  </Link>
                  <div className="py-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2">
                      Resources
                    </div>
                    <Link
                      to="/docs"
                      className="block py-2 px-4 ml-4 rounded-lg text-sm text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Documentation
                    </Link>
                    <Link
                      to="/help"
                      className="block py-2 px-4 ml-4 rounded-lg text-sm text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Help Center
                    </Link>
                    <Link
                      to="/status"
                      className="block py-2 px-4 ml-4 rounded-lg text-sm text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      System Status
                    </Link>
                    <Link
                      to="/blog"
                      className="block py-2 px-4 ml-4 rounded-lg text-sm text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Blog
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
                    Dashboard
                  </Link>
                  <Link
                    to="/search"
                    className="flex items-center gap-2 py-3 px-4 rounded-lg text-sm font-medium text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <BrainCircuit className="h-4 w-4" />
                    AI Search
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
                  New Chat
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className="w-full justify-start gap-2"
              >
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {isDarkMode ? 'Light Mode' : 'Dark Mode'}
              </Button>

              {user ? (
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center gap-3 px-4 py-2">
                    <span className="rounded-full bg-primary text-primary-foreground w-8 h-8 flex items-center justify-center font-bold text-sm">
                      {initial}
                    </span>
                    <span className="text-sm font-medium">{user.email}</span>
                  </div>
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 w-full py-2 px-4 rounded-lg text-sm text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </Link>
                  <Link
                    to="/settings"
                    className="flex items-center gap-2 w-full py-2 px-4 rounded-lg text-sm text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="flex items-center gap-2 w-full py-2 px-4 rounded-lg text-sm text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Crown className="h-4 w-4" />
                      Admin Panel
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
                    Sign Out
                  </button>
                </div>
              ) : (
                <Button
                  asChild
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Link to="/auth">Get Started</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
