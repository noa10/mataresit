import { useState, useEffect, createContext, useContext } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import { MainNavigationSidebar } from "./MainNavigationSidebar";
import { MainNavigationToggle } from "./MainNavigationToggle";
import { useChatControls } from "@/contexts/ChatControlsContext";

// Context for main navigation state
interface MainNavContextType {
  navSidebarOpen: boolean;
  isDesktop: boolean;
  navSidebarWidth: number;
}

const MainNavContext = createContext<MainNavContextType | undefined>(undefined);

export function useMainNav() {
  const context = useContext(MainNavContext);
  if (context === undefined) {
    throw new Error('useMainNav must be used within MainNavContext');
  }
  return context;
}

export function AppLayout() {
  const [navSidebarOpen, setNavSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const { chatControls } = useChatControls();

  // Calculate navigation sidebar width based on state
  const navSidebarWidth = isDesktop ? (navSidebarOpen ? 256 : 64) : 0;

  // Initialize sidebar state based on screen size
  useEffect(() => {
    const handleResize = () => {
      const isLargeScreen = window.innerWidth >= 1024;
      setIsDesktop(isLargeScreen);

      if (isLargeScreen) {
        // On large screens, check localStorage preference or default to closed
        const savedState = localStorage.getItem('nav-sidebar-open');
        setNavSidebarOpen(savedState !== null ? savedState === 'true' : false);
      } else {
        // On mobile/tablet, always start closed
        setNavSidebarOpen(false);

        // Update CSS var immediately on resize
        document.documentElement.style.setProperty(
          '--nav-width',
          isLargeScreen ? `${(isLargeScreen ? (navSidebarOpen ? 256 : 64) : 0)}px` : '0px'
        );
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Toggle navigation sidebar
  const toggleNavSidebar = () => {
    const newState = !navSidebarOpen;
    setNavSidebarOpen(newState);

    // Save preference to localStorage
    if (isDesktop) {
      localStorage.setItem('nav-sidebar-open', String(newState));
    }

    // Update CSS variable
    document.documentElement.style.setProperty(
      '--nav-width',
      isDesktop ? `${(newState ? 256 : 64)}px` : '0px'
    );
  };

  // Sync CSS variable for layout shift
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--nav-width',
      isDesktop ? `${navSidebarWidth}px` : '0px'
    );
  }, [isDesktop, navSidebarOpen, navSidebarWidth]);

  // Enhanced keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+N or Cmd+N to toggle navigation sidebar
      if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault();
        toggleNavSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <MainNavContext.Provider value={{ navSidebarOpen, isDesktop, navSidebarWidth }}>
      <div className="flex min-h-screen bg-background">
        {/* Main Navigation Sidebar */}
        <MainNavigationSidebar
          isOpen={navSidebarOpen}
          onToggle={toggleNavSidebar}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar
            navControls={{
              navSidebarToggle: (
                <MainNavigationToggle
                  isOpen={navSidebarOpen}
                  onToggle={toggleNavSidebar}
                />
              )
            }}
            chatControls={chatControls}
          />
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </MainNavContext.Provider>
  );
}
