import { useState, useEffect } from "react";
import { NavLink, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Sun, Moon, ChevronDown, BrainCircuit } from "lucide-react";
import { Button } from "./ui/button";
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
  const [isDarkMode, setIsDarkMode] = useState(false);

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

  return (
    <header className="w-full bg-background border-b">
      <div className="container mx-auto flex items-center justify-between py-4 px-4 md:px-8">
        {/* Brand */}
        <NavLink to="/" className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <FileText className="h-6 w-6 text-primary" />
          ReceiptScan
        </NavLink>

        {/* Main nav links */}
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

        {/* Actions: theme toggle + user menu */}
        <div className="flex items-center space-x-4">
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
    </header>
  );
}
