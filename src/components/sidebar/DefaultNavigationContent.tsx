import React from 'react';
import { MainNavigationSidebar } from '../MainNavigationSidebar';
import { useAppSidebar } from '@/contexts/AppSidebarContext';

/**
 * Default navigation sidebar content wrapper for the unified sidebar system.
 * This component wraps the MainNavigationSidebar to work with the AppSidebarContext.
 */
export function DefaultNavigationContent() {
  const { isSidebarOpen, toggleSidebar } = useAppSidebar();

  return (
    <MainNavigationSidebar
      isOpen={isSidebarOpen}
      onToggle={toggleSidebar}
    />
  );
}
