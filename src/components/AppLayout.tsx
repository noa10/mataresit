import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import { MainNavigationSidebar } from "./MainNavigationSidebar";
import { MainNavigationToggle } from "./MainNavigationToggle";
import { useChatControls } from "@/contexts/ChatControlsContext";

export function AppLayout() {
  const [navSidebarOpen, setNavSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const { chatControls } = useChatControls();

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
  };

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
  );
}
