import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppSidebar } from '@/contexts/AppSidebarContext';

/**
 * Route-aware sidebar manager that automatically switches sidebar content
 * based on the current route. This component should be placed in the AppLayout
 * to automatically manage sidebar content without requiring individual pages
 * to handle sidebar injection.
 *
 * Note: Admin routes (/admin/*) use their own AdminLayout with separate
 * SidebarProvider and don't go through AppLayout, so this manager clears
 * any AppLayout sidebar content when navigating to admin routes to ensure
 * clean transitions.
 */
export function RouteAwareSidebarManager() {
  const location = useLocation();
  const { clearSidebarContent, sidebarContentType } = useAppSidebar();

  useEffect(() => {
    // Determine the sidebar type for the current route
    const currentSidebarType = getSidebarTypeForPath(location.pathname);

    // Clear any custom sidebar content when navigating to routes that should use default navigation
    const shouldUseDefaultNavigation = [
      '/dashboard',
      '/settings',
      '/profile',
      '/analysis',
      '/features',
      '/teams',
      '/claims',
      '/receipt'
    ].some(path => location.pathname.startsWith(path));

    // Clear sidebar content when:
    // 1. Moving to default navigation routes and currently showing custom content
    // 2. Moving to admin routes (they use their own layout, so clear any AppLayout sidebar content)
    if ((shouldUseDefaultNavigation && sidebarContentType !== 'navigation') ||
        (currentSidebarType === 'admin')) {
      clearSidebarContent();
    }
  }, [location.pathname, clearSidebarContent, sidebarContentType]);

  // This component doesn't render anything, it just manages sidebar state
  return null;
}

/**
 * Route configuration for sidebar content types.
 * This can be extended to support more complex routing logic.
 */
export const SIDEBAR_ROUTE_CONFIG = {
  // Routes that should show default navigation
  navigation: [
    '/dashboard',
    '/settings',
    '/profile',
    '/analysis',
    '/teams',
    '/claims',
    '/receipt',
    '/api-reference'
  ],
  
  // Routes that should show conversation sidebar
  conversation: [
    '/search'
  ],
  
  // Routes that use their own layout (admin)
  admin: [
    '/admin'
  ]
} as const;

/**
 * Helper function to determine what type of sidebar should be shown for a given path
 */
export function getSidebarTypeForPath(pathname: string): 'navigation' | 'conversation' | 'admin' | 'custom' {
  if (SIDEBAR_ROUTE_CONFIG.admin.some(path => pathname.startsWith(path))) {
    return 'admin';
  }
  
  if (SIDEBAR_ROUTE_CONFIG.conversation.some(path => pathname.startsWith(path))) {
    return 'conversation';
  }
  
  if (SIDEBAR_ROUTE_CONFIG.navigation.some(path => pathname.startsWith(path))) {
    return 'navigation';
  }
  
  return 'custom';
}
