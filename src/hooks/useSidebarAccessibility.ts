import { useEffect, useCallback } from 'react';
import { useAppSidebar } from '@/contexts/AppSidebarContext';

interface SidebarAccessibilityOptions {
  sidebarId: string;
  autoFocus?: boolean;
  trapFocus?: boolean;
  announceStateChanges?: boolean;
}

/**
 * Hook for enhanced sidebar accessibility features including:
 * - Focus management and trapping
 * - Screen reader announcements
 * - Keyboard navigation support
 * - ARIA live region updates
 */
export function useSidebarAccessibility({
  sidebarId,
  autoFocus = true,
  trapFocus = true,
  announceStateChanges = true
}: SidebarAccessibilityOptions) {
  const { isSidebarOpen, isDesktop, sidebarContentType } = useAppSidebar();

  // Announce sidebar state changes to screen readers
  const announceStateChange = useCallback((isOpen: boolean, contentType: string) => {
    if (!announceStateChanges) return;

    const message = isOpen 
      ? `${contentType} sidebar opened` 
      : `${contentType} sidebar closed`;
    
    // Create or update ARIA live region
    let liveRegion = document.getElementById('sidebar-announcements');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'sidebar-announcements';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
    }
    
    liveRegion.textContent = message;
  }, [announceStateChanges]);

  // Focus management when sidebar opens/closes
  useEffect(() => {
    if (!autoFocus) return;

    if (isSidebarOpen && !isDesktop) {
      // Focus first interactive element when opening on mobile
      setTimeout(() => {
        const sidebar = document.getElementById(sidebarId);
        const firstFocusable = sidebar?.querySelector(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) as HTMLElement;
        
        if (firstFocusable) {
          firstFocusable.focus();
        }
      }, 300);
    } else if (!isSidebarOpen && !isDesktop) {
      // Return focus to main content when closing on mobile
      setTimeout(() => {
        const mainContent = document.querySelector('main') as HTMLElement;
        if (mainContent) {
          mainContent.focus();
        }
      }, 100);
    }
  }, [isSidebarOpen, isDesktop, autoFocus, sidebarId]);

  // Announce state changes
  useEffect(() => {
    announceStateChange(isSidebarOpen, sidebarContentType);
  }, [isSidebarOpen, sidebarContentType, announceStateChange]);

  // Focus trap for mobile sidebar
  useEffect(() => {
    if (!trapFocus || !isSidebarOpen || isDesktop) return;

    const sidebar = document.getElementById(sidebarId);
    if (!sidebar) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusableElements = sidebar.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen, isDesktop, trapFocus, sidebarId]);

  // Cleanup ARIA live region on unmount
  useEffect(() => {
    return () => {
      const liveRegion = document.getElementById('sidebar-announcements');
      if (liveRegion && !document.querySelector('[data-sidebar-accessibility]')) {
        document.body.removeChild(liveRegion);
      }
    };
  }, []);

  return {
    sidebarProps: {
      'data-sidebar-accessibility': true,
      'aria-hidden': !isSidebarOpen,
      'aria-expanded': isSidebarOpen,
    }
  };
}
