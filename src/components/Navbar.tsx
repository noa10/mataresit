import { useState, useEffect } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStripe } from "@/contexts/StripeContext";
import { FileText, Sun, Moon, ChevronDown, BrainCircuit, Menu, X, Crown, Zap, MoreHorizontal, BarChart3, Sparkles, Settings, DollarSign, MessageSquare, Plus } from "lucide-react";
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
  chatControls?: {
    sidebarToggle?: React.ReactNode;
    onNewChat?: () => void;
    showChatTitle?: boolean; // This will no longer be used but is kept for prop compatibility
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
      <div className="container mx-auto flex items-center justify-between py-3 px-4">
        {/* Left Side: Contextual Controls & Brand */}
        <div className="flex items-center space-x-2 md:space-x-4">
          {isSearchPage && chatControls?.sidebarToggle}

          <NavLink to="/" className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <FileText className="h-6 w-6 text-primary" />
            <span className="hidden sm:inline">ReceiptScan</span>
          </NavLink>

          {getTierBadge()}
        </div>

        {/* Center: Main Navigation (Desktop) */}
        <nav className="hidden lg:flex items-center space-x-6">
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? "text-primary font-semibold" : "text-foreground hover:text-primary transition-colors"}>Dashboard</NavLink>
          <NavLink to="/search" className={({ isActive }) => `flex items-center gap-1 ${isActive ? "text-primary font-semibold" : "text-foreground hover:text-primary transition-colors"}`}>
            <BrainCircuit className="h-4 w-4" /> AI Search
          </NavLink>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-1 text-foreground hover:text-primary transition-colors">
                <MoreHorizontal className="h-4 w-4" /> More <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem asChild><Link to="/analysis" className="flex items-center gap-2 w-full"><BarChart3 className="h-4 w-4" />Analysis</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/features" className="flex items-center gap-2 w-full"><Sparkles className="h-4 w-4" />Features</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/pricing" className="flex items-center gap-2 w-full"><DollarSign className="h-4 w-4" />Pricing</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/settings" className="flex items-center gap-2 w-full"><Settings className="h-4 w-4" />Settings</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Right Side: Actions */}
        <div className="flex items-center space-x-2">
          {isSearchPage && chatControls?.onNewChat && (
            <Button variant="outline" size="sm" onClick={chatControls.onNewChat} className="flex items-center space-x-1">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Chat</span>
            </Button>
          )}

          <div className="hidden sm:flex items-center space-x-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center p-1 rounded-full">
                    <span className="rounded-full bg-primary text-primary-foreground w-8 h-8 flex items-center justify-center font-bold">{initial}</span>
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to="/profile">Profile</Link></DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => signOut()}>Sign Out</DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild><Link to="/admin">Admin Panel</Link></DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="lg:hidden">
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-background border-b shadow-md z-20">
          <nav className="flex flex-col px-4 py-2">
            <NavLink to="/dashboard" className={({ isActive }) => `py-3 border-b border-border ${isActive ? "text-primary font-semibold" : "text-foreground"}`} onClick={() => setMobileMenuOpen(false)}>Dashboard</NavLink>
            <NavLink to="/search" className={({ isActive }) => `py-3 border-b border-border flex items-center gap-2 ${isActive ? "text-primary font-semibold" : "text-foreground"}`} onClick={() => setMobileMenuOpen(false)}><BrainCircuit className="h-4 w-4" />AI Search</NavLink>
            <NavLink to="/analysis" className={({ isActive }) => `py-3 border-b border-border flex items-center gap-2 ${isActive ? "text-primary font-semibold" : "text-foreground"}`} onClick={() => setMobileMenuOpen(false)}><BarChart3 className="h-4 w-4" />Analysis</NavLink>
            <NavLink to="/settings" className={({ isActive }) => `py-3 border-b border-border flex items-center gap-2 ${isActive ? "text-primary font-semibold" : "text-foreground"}`} onClick={() => setMobileMenuOpen(false)}><Settings className="h-4 w-4" />Settings</NavLink>

            <div className="border-t border-border my-2"></div>

            <div className="py-2">
              <div className="px-0 py-1.5 text-sm font-semibold">Account</div>
              {user ? (
                <>
                  <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-foreground hover:text-primary transition-colors">Profile</Link>
                  <button onClick={() => { signOut(); setMobileMenuOpen(false); }} className="block py-2 text-foreground hover:text-primary transition-colors w-full text-left">Sign Out</button>
                </>
              ) : (
                 <Link to="/auth" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-foreground hover:text-primary transition-colors">Sign In</Link>
              )}
            </div>

            <div className="border-t border-border my-2"></div>

            <button onClick={() => { toggleTheme(); setMobileMenuOpen(false); }} className="flex items-center gap-2 py-2 text-foreground hover:text-primary transition-colors w-full text-left">
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              Toggle Theme
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
