import { useState, useEffect } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStripe } from "@/contexts/StripeContext";
import { FileText, Sun, Moon, ChevronDown, BrainCircuit, Menu, X, Crown, Zap, Gift, MoreHorizontal, BarChart3, Sparkles, Settings, DollarSign, MessageSquare, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "./ui/dropdown-menu";

interface NavbarProps {
  // Chat-specific props for search page
  chatControls?: {
    sidebarToggle?: React.ReactNode;
    onNewChat?: () => void;
    showChatTitle?: boolean;
  };
}

export default function Navbar({ chatControls }: NavbarProps = {}) {
  const { user, signOut, isAdmin } = useAuth();
  const { subscriptionData } = useStripe();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Check if we're on the search/chat page
  const isSearchPage = location.pathname === '/search';

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

  const getTierIcon = () => {
    switch (subscriptionData?.tier) {
      case 'pro':
        return <Zap className="h-3 w-3" />;
      case 'max':
        return <Crown className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getTierBadge = () => {
    if (!subscriptionData?.tier || subscriptionData.tier === 'free') return null;

    const colors = {
      pro: 'bg-blue-500 text-white',
      max: 'bg-purple-500 text-white'
    };

    return (
      <Badge className={`${colors[subscriptionData.tier as keyof typeof colors]} text-xs px-1.5 py-0.5 ml-2`}>
        {getTierIcon()}
        <span className="ml-1 capitalize">{subscriptionData.tier}</span>
      </Badge>
    );
  };

  return (
    <header className="w-full bg-background border-b relative">
      <div className="container mx-auto flex items-center justify-between py-4 px-4 md:px-8">
        {/* Brand and Chat Controls */}
        <div className="flex items-center space-x-4">
          {/* Chat Sidebar Toggle (if provided) */}
          {chatControls?.sidebarToggle && (
            <div className="flex items-center">
              {chatControls.sidebarToggle}
            </div>
          )}

          {/* Brand */}
          <div className="flex items-center">
            <NavLink to="/" className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <FileText className="h-6 w-6 text-primary" />
              ReceiptScan
            </NavLink>
            {getTierBadge()}
          </div>

          {/* Chat Title (if on search page and enabled) */}
          {chatControls?.showChatTitle && (
            <div className="hidden md:flex items-center space-x-2 ml-4">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-semibold truncate">AI Receipt Assistant</h1>
                <p className="text-xs text-muted-foreground hidden lg:block">
                  Ask me anything about your receipts
                </p>
              </div>
            </div>
          )}

          {/* Mobile Chat Title (simplified for mobile) */}
          {chatControls?.showChatTitle && (
            <div className="flex md:hidden items-center space-x-2 ml-2">
              <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                <MessageSquare className="h-3 w-3 text-primary" />
              </div>
              <span className="text-sm font-medium truncate">AI Chat</span>
            </div>
          )}
        </div>

        {/* Main nav links - Desktop */}
        <nav className="hidden md:flex items-center space-x-8">
          {/* Primary Navigation - Always visible */}
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive
                ? "text-primary font-semibold"
                : "text-foreground hover:text-primary transition-colors"
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              isActive
                ? "text-primary font-semibold"
                : "text-foreground hover:text-primary transition-colors"
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/search"
            className={({ isActive }) =>
              isActive
                ? "text-primary font-semibold flex items-center gap-1"
                : "text-foreground hover:text-primary transition-colors flex items-center gap-1"
            }
          >
            <BrainCircuit className="h-4 w-4" />
            AI Search
          </NavLink>

          {/* Secondary Navigation - Grouped in dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-1 text-foreground hover:text-primary transition-colors"
              >
                <MoreHorizontal className="h-4 w-4" />
                More
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem asChild>
                <Link to="/analysis" className="flex items-center gap-2 w-full">
                  <BarChart3 className="h-4 w-4" />
                  Analysis
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/features" className="flex items-center gap-2 w-full">
                  <Sparkles className="h-4 w-4" />
                  Features
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/pricing" className="flex items-center gap-2 w-full">
                  <DollarSign className="h-4 w-4" />
                  Pricing
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center gap-2 w-full">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Actions: chat controls, mobile menu toggle, theme toggle + user menu */}
        <div className="flex items-center space-x-2 md:space-x-4">
          {/* New Chat Button (if chat controls provided) */}
          {chatControls?.onNewChat && (
            <Button
              variant="outline"
              size="sm"
              onClick={chatControls.onNewChat}
              className="flex items-center space-x-1 shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Chat</span>
            </Button>
          )}

          {/* Mobile menu toggle button */}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="flex items-center">
                  <span className="rounded-full bg-primary text-primary-foreground w-8 h-8 flex items-center justify-center font-bold">
                    {initial}
                  </span>
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => signOut()}>Sign Out</DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/admin">Admin Panel</Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-background border-b shadow-md z-50">
          <nav className="flex flex-col px-4 py-2">
            {/* Primary Navigation */}
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive
                  ? "text-primary font-semibold py-3 border-b border-border"
                  : "text-foreground hover:text-primary transition-colors py-3 border-b border-border"
              }
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </NavLink>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                isActive
                  ? "text-primary font-semibold py-3 border-b border-border"
                  : "text-foreground hover:text-primary transition-colors py-3 border-b border-border"
              }
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/search"
              className={({ isActive }) =>
                isActive
                  ? "text-primary font-semibold py-3 border-b border-border flex items-center gap-2"
                  : "text-foreground hover:text-primary transition-colors py-3 border-b border-border flex items-center gap-2"
              }
              onClick={() => setMobileMenuOpen(false)}
            >
              <BrainCircuit className="h-4 w-4" />
              AI Search
            </NavLink>

            {/* Secondary Navigation */}
            <div className="py-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-0 py-2">
                More
              </div>
              <NavLink
                to="/analysis"
                className={({ isActive }) =>
                  isActive
                    ? "text-primary font-semibold py-3 border-b border-border flex items-center gap-2"
                    : "text-foreground hover:text-primary transition-colors py-3 border-b border-border flex items-center gap-2"
                }
                onClick={() => setMobileMenuOpen(false)}
              >
                <BarChart3 className="h-4 w-4" />
                Analysis
              </NavLink>
              <NavLink
                to="/features"
                className={({ isActive }) =>
                  isActive
                    ? "text-primary font-semibold py-3 border-b border-border flex items-center gap-2"
                    : "text-foreground hover:text-primary transition-colors py-3 border-b border-border flex items-center gap-2"
                }
                onClick={() => setMobileMenuOpen(false)}
              >
                <Sparkles className="h-4 w-4" />
                Features
              </NavLink>
              <NavLink
                to="/pricing"
                className={({ isActive }) =>
                  isActive
                    ? "text-primary font-semibold py-3 border-b border-border flex items-center gap-2"
                    : "text-foreground hover:text-primary transition-colors py-3 border-b border-border flex items-center gap-2"
                }
                onClick={() => setMobileMenuOpen(false)}
              >
                <DollarSign className="h-4 w-4" />
                Pricing
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  isActive
                    ? "text-primary font-semibold py-3 flex items-center gap-2"
                    : "text-foreground hover:text-primary transition-colors py-3 flex items-center gap-2"
                }
                onClick={() => setMobileMenuOpen(false)}
              >
                <Settings className="h-4 w-4" />
                Settings
              </NavLink>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
