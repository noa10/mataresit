import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LogOut, Menu, User, X, Settings, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toggleTheme } from "@/lib/theme";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Initialize state based on current theme
    if (typeof window !== 'undefined' && localStorage.theme) {
      return localStorage.theme === 'dark';
    }
    // Check system preference if no localStorage theme is set
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const location = useLocation();
  const { user, signOut } = useAuth();
  
  // Close mobile menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Update state if theme changes elsewhere (e.g., system setting)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      // Only update if localStorage isn't explicitly set
      if (!localStorage.getItem('theme')) {
        setIsDarkMode(mediaQuery.matches);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Update state when localStorage changes (e.g., from toggleTheme)
  useEffect(() => {
    const handleStorageChange = () => {
      if (localStorage.theme === 'dark') {
        setIsDarkMode(true);
      } else if (localStorage.theme === 'light') {
        setIsDarkMode(false);
      }
    };
    window.addEventListener('storage', handleStorageChange); // Listen for changes in other tabs/windows
    // Also handle direct calls to toggleTheme in the same window
    const handleThemeChange = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    // If toggleTheme dispatches an event, listen for it:
    // window.addEventListener('themeChanged', handleThemeChange);
    
    // For simplicity, we can directly check the class on mount/update too
    handleThemeChange(); // Check on initial load

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      // window.removeEventListener('themeChanged', handleThemeChange);
    };
  }, []);

  // Navigation links
  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/dashboard", label: "Dashboard", auth: true },
    { href: "/analysis", label: "Analysis", auth: true },
  ];

  // Filter links based on authentication status
  const filteredLinks = navLinks.filter(link => 
    !link.auth || (link.auth && user)
  );

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return "U";
    return user.email?.charAt(0).toUpperCase() || "U";
  };

  // Theme toggle handler
  const handleThemeToggle = () => {
    toggleTheme();
    setIsDarkMode(!isDarkMode); // Update local state immediately
  };

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="glass border-b border-border/40 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Link 
              to="/" 
              className="flex items-center gap-2 transition-transform duration-300 ease-in-out hover:scale-105"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                <span className="font-semibold text-2xl">R</span>
              </motion.div>
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="font-medium text-xl"
              >
                ReceiptScan
              </motion.span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {filteredLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "link-hover text-sm font-medium transition-colors",
                  location.pathname === link.href
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}

            {!user ? (
              <Button asChild variant="secondary" size="sm">
                <Link to="/auth">Sign In</Link>
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handleThemeToggle} title="Toggle Theme">
                  {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{getUserInitials()}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild className="font-normal">
                      <Link to="/profile">
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="font-normal">
                      <Link to="/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </nav>

          {/* Mobile Menu Toggle */}
          <div className="flex md:hidden items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleThemeToggle} title="Toggle Theme">
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{getUserInitials()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild className="font-normal">
                    <Link to="/profile">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="font-normal">
                    <Link to="/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button
              className="flex p-2 rounded-md hover:bg-accent"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle Menu"
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-background md:hidden border-b border-border/40 overflow-hidden"
          >
            <div className="container py-4 flex flex-col space-y-4">
              {filteredLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    "px-2 py-2 text-sm font-medium rounded-md transition-colors",
                    location.pathname === link.href
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  {link.label}
                </Link>
              ))}
              
              {!user && (
                <Link
                  to="/auth"
                  className="px-2 py-2 text-sm font-medium bg-secondary text-secondary-foreground rounded-md"
                >
                  Sign In
                </Link>
              )}
              
              {user && (
                <>
                  <Link
                    to="/profile"
                    className="px-2 py-2 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  >
                    Profile
                  </Link>
                  <Link
                    to="/settings"
                    className="px-2 py-2 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  >
                    Settings
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
