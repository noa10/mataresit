import { useState, useEffect } from "react";
import { NavLink, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStripe } from "@/contexts/StripeContext";
import { FileText, Sun, Moon, ChevronDown, BrainCircuit, Menu, X, Crown, Zap, Gift } from "lucide-react";
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

export default function Navbar() {
  const { user, signOut, isAdmin } = useAuth();
  const { subscriptionData } = useStripe();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        {/* Brand */}
        <div className="flex items-center">
          <NavLink to="/" className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <FileText className="h-6 w-6 text-primary" />
            ReceiptScan
          </NavLink>
          {getTierBadge()}
        </div>

        {/* Main nav links - Desktop */}
        <nav className="hidden md:flex items-center space-x-6">
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
            to="/pricing"
            className={({ isActive }) =>
              isActive
                ? "text-primary font-semibold"
                : "text-foreground hover:text-primary transition-colors"
            }
          >
            Pricing
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
            to="/analysis"
            className={({ isActive }) =>
              isActive
                ? "text-primary font-semibold"
                : "text-foreground hover:text-primary transition-colors"
            }
          >
            Analysis
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
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              isActive
                ? "text-primary font-semibold"
                : "text-foreground hover:text-primary transition-colors"
            }
          >
            Settings
          </NavLink>
        </nav>

        {/* Actions: mobile menu toggle, theme toggle + user menu */}
        <div className="flex items-center space-x-2 md:space-x-4">
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
              to="/pricing"
              className={({ isActive }) =>
                isActive
                  ? "text-primary font-semibold py-3 border-b border-border"
                  : "text-foreground hover:text-primary transition-colors py-3 border-b border-border"
              }
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
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
              to="/analysis"
              className={({ isActive }) =>
                isActive
                  ? "text-primary font-semibold py-3 border-b border-border"
                  : "text-foreground hover:text-primary transition-colors py-3 border-b border-border"
              }
              onClick={() => setMobileMenuOpen(false)}
            >
              Analysis
            </NavLink>
            <NavLink
              to="/search"
              className={({ isActive }) =>
                isActive
                  ? "text-primary font-semibold py-3 border-b border-border flex items-center gap-1"
                  : "text-foreground hover:text-primary transition-colors py-3 border-b border-border flex items-center gap-1"
              }
              onClick={() => setMobileMenuOpen(false)}
            >
              <BrainCircuit className="h-4 w-4" />
              AI Search
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                isActive
                  ? "text-primary font-semibold py-3"
                  : "text-foreground hover:text-primary transition-colors py-3"
              }
              onClick={() => setMobileMenuOpen(false)}
            >
              Settings
            </NavLink>
          </nav>
        </div>
      )}
    </header>
  );
}
