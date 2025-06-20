import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

// Sidebar content types for different routes
export type SidebarContentType = 'navigation' | 'conversation' | 'admin' | 'custom';

interface AppSidebarContextType {
  // Sidebar state
  isSidebarOpen: boolean;
  isDesktop: boolean;
  sidebarWidth: number;
  
  // Sidebar content management
  sidebarContent: ReactNode;
  sidebarContentType: SidebarContentType;
  
  // Actions
  toggleSidebar: () => void;
  setSidebarContent: (content: ReactNode, type?: SidebarContentType) => void;
  clearSidebarContent: () => void;
  setSidebarWidth: (width: number) => void;
}

const AppSidebarContext = createContext<AppSidebarContextType | undefined>(undefined);

interface AppSidebarProviderProps {
  children: ReactNode;
}

export function AppSidebarProvider({ children }: AppSidebarProviderProps) {
  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [sidebarWidth, setSidebarWidthState] = useState(256);
  
  // Content management
  const [sidebarContent, setSidebarContentState] = useState<ReactNode>(null);
  const [sidebarContentType, setSidebarContentType] = useState<SidebarContentType>('navigation');

  // Initialize sidebar state based on screen size and localStorage
  useEffect(() => {
    const handleResize = () => {
      const isLargeScreen = window.innerWidth >= 1024;
      setIsDesktop(isLargeScreen);

      if (isLargeScreen) {
        // On large screens, check localStorage preference or default to closed
        const savedState = localStorage.getItem('app-sidebar-open');
        setIsSidebarOpen(savedState !== null ? savedState === 'true' : false);
      } else {
        // On mobile/tablet, always start closed
        setIsSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Toggle sidebar with localStorage persistence
  const toggleSidebar = useCallback(() => {
    const newState = !isSidebarOpen;
    setIsSidebarOpen(newState);

    // Save preference to localStorage on desktop
    if (isDesktop) {
      localStorage.setItem('app-sidebar-open', String(newState));
    }

    // Update CSS variable for layout calculations
    updateCSSVariable(newState, sidebarWidth, isDesktop);
  }, [isSidebarOpen, isDesktop, sidebarWidth]);

  // Set sidebar content with optional type
  const setSidebarContent = useCallback((content: ReactNode, type: SidebarContentType = 'custom') => {
    setSidebarContentState(content);
    setSidebarContentType(type);
  }, []);

  // Clear sidebar content (revert to default navigation)
  const clearSidebarContent = useCallback(() => {
    setSidebarContentState(null);
    setSidebarContentType('navigation');
  }, []);

  // Set sidebar width with CSS variable update
  const setSidebarWidth = useCallback((width: number) => {
    setSidebarWidthState(width);
    updateCSSVariable(isSidebarOpen, width, isDesktop);
  }, [isSidebarOpen, isDesktop]);

  // Update CSS variable for layout calculations
  const updateCSSVariable = useCallback((isOpen: boolean, width: number, desktop: boolean) => {
    const value = desktop ? (isOpen ? `${width}px` : '64px') : '0px';
    document.documentElement.style.setProperty('--sidebar-width', value);
  }, []);

  // Visual feedback for keyboard shortcuts
  const showKeyboardShortcutFeedback = useCallback((message: string) => {
    const feedback = document.createElement('div');
    feedback.className = 'fixed top-4 right-4 bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm font-medium z-50 animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none';
    feedback.textContent = message;
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');

    document.body.appendChild(feedback);

    setTimeout(() => {
      feedback.classList.add('animate-out', 'fade-out', 'slide-out-to-top-2');
      setTimeout(() => {
        if (document.body.contains(feedback)) {
          document.body.removeChild(feedback);
        }
      }, 200);
    }, 1500);
  }, []);

  // Sync CSS variable when state changes
  useEffect(() => {
    updateCSSVariable(isSidebarOpen, sidebarWidth, isDesktop);
  }, [isSidebarOpen, sidebarWidth, isDesktop, updateCSSVariable]);

  // Enhanced keyboard shortcuts and accessibility
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + B to toggle sidebar
      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        toggleSidebar();

        // Show visual feedback for keyboard shortcut
        showKeyboardShortcutFeedback('Sidebar toggled');
        return;
      }

      // Escape key to close sidebar on mobile
      if (event.key === 'Escape' && isSidebarOpen && !isDesktop) {
        event.preventDefault();
        toggleSidebar();

        // Return focus to the main content area
        setTimeout(() => {
          const mainContent = document.querySelector('main');
          if (mainContent) {
            (mainContent as HTMLElement).focus();
          }
        }, 300);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar, isSidebarOpen, isDesktop]);

  // Mobile swipe-to-close support
  useEffect(() => {
    if (!isSidebarOpen || isDesktop) return;

    let startX = 0;
    let startY = 0;
    let isDragging = false;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) {
        const deltaX = e.touches[0].clientX - startX;
        const deltaY = Math.abs(e.touches[0].clientY - startY);

        // Only start dragging if horizontal movement is greater than vertical
        if (Math.abs(deltaX) > deltaY && Math.abs(deltaX) > 10) {
          isDragging = true;
        }
      }

      // Close sidebar if swiping left more than 50px
      if (isDragging && e.touches[0].clientX - startX < -50) {
        toggleSidebar();
        showKeyboardShortcutFeedback('Sidebar closed');
      }
    };

    const handleTouchEnd = () => {
      isDragging = false;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isSidebarOpen, isDesktop, toggleSidebar, showKeyboardShortcutFeedback]);

  const contextValue: AppSidebarContextType = {
    // State
    isSidebarOpen,
    isDesktop,
    sidebarWidth,
    
    // Content
    sidebarContent,
    sidebarContentType,
    
    // Actions
    toggleSidebar,
    setSidebarContent,
    clearSidebarContent,
    setSidebarWidth,
  };

  return (
    <AppSidebarContext.Provider value={contextValue}>
      {children}
    </AppSidebarContext.Provider>
  );
}

export function useAppSidebar() {
  const context = useContext(AppSidebarContext);
  if (context === undefined) {
    throw new Error('useAppSidebar must be used within an AppSidebarProvider');
  }
  return context;
}

// Hook for backward compatibility with existing MainNav usage
export function useMainNav() {
  const { isSidebarOpen, isDesktop, sidebarWidth } = useAppSidebar();
  
  return {
    navSidebarOpen: isSidebarOpen,
    isDesktop,
    navSidebarWidth: sidebarWidth,
  };
}
