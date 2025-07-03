import React, { useEffect } from 'react';
import { toast } from 'sonner';
import { Search, CheckCircle, AlertCircle, Database, Zap, Clock } from 'lucide-react';
import { useBackgroundSearch } from '@/contexts/BackgroundSearchContext';

/**
 * Search Status Toast Manager
 * 
 * Provides contextual toast notifications for search operations
 * with appropriate icons, colors, and actions.
 */
export function SearchStatusToastManager() {
  const { state } = useBackgroundSearch();

  useEffect(() => {
    // Monitor active searches for status changes
    state.activeSearches.forEach((search, conversationId) => {
      const toastId = `search-${conversationId}`;
      
      switch (search.status) {
        case 'preprocessing':
          toast.loading('Understanding your question...', {
            id: toastId,
            icon: <Zap className="h-4 w-4 text-blue-500" />,
            description: 'Analyzing your search query',
          });
          break;
          
        case 'searching':
          toast.loading('Searching through your data...', {
            id: toastId,
            icon: <Search className="h-4 w-4 text-purple-500" />,
            description: 'Finding relevant receipts and information',
          });
          break;
          
        case 'error':
          toast.error('Search failed', {
            id: toastId,
            icon: <AlertCircle className="h-4 w-4" />,
            description: search.error || 'Please try again or rephrase your question',
            action: {
              label: 'Retry',
              onClick: () => {
                // Retry logic would go here
                console.log('Retry search for conversation:', conversationId);
              },
            },
          });
          break;
      }
    });

    // Monitor completed searches
    state.completedSearches.forEach((search, conversationId) => {
      const toastId = `search-${conversationId}`;
      
      toast.success('Search completed successfully', {
        id: toastId,
        icon: <CheckCircle className="h-4 w-4 text-green-500" />,
        description: `Found ${search.results.results.length} results`,
        duration: 3000,
      });
    });
  }, [state.activeSearches, state.completedSearches]);

  return null; // This component only manages toasts
}

/**
 * Search Cache Toast Notifications
 * 
 * Shows notifications when cached results are loaded
 */
export function showCacheLoadedToast(resultsCount: number, conversationId: string) {
  toast.success('Results loaded from cache', {
    id: `cache-${conversationId}`,
    icon: <Database className="h-4 w-4 text-emerald-500" />,
    description: `${resultsCount} cached results loaded instantly`,
    duration: 2000,
  });
}

/**
 * Background Search Toast Notifications
 * 
 * Shows notifications when searches start running in background
 */
export function showBackgroundSearchToast(conversationId: string) {
  toast.info('Search running in background', {
    id: `background-${conversationId}`,
    icon: <Clock className="h-4 w-4 text-blue-500" />,
    description: 'You can navigate freely while we search',
    duration: 4000,
    action: {
      label: 'View Progress',
      onClick: () => {
        // Navigate to search page logic would go here
        window.location.href = `/search?c=${conversationId}`;
      },
    },
  });
}

/**
 * Search Error Toast with Retry
 */
export function showSearchErrorToast(
  error: string, 
  conversationId: string, 
  onRetry?: () => void
) {
  toast.error('Search failed', {
    id: `error-${conversationId}`,
    icon: <AlertCircle className="h-4 w-4" />,
    description: error,
    duration: 6000,
    action: onRetry ? {
      label: 'Retry',
      onClick: onRetry,
    } : undefined,
  });
}

/**
 * Search Success Toast with Results Count
 */
export function showSearchSuccessToast(
  resultsCount: number, 
  conversationId: string,
  fromCache: boolean = false
) {
  const icon = fromCache 
    ? <Database className="h-4 w-4 text-emerald-500" />
    : <CheckCircle className="h-4 w-4 text-green-500" />;
    
  const title = fromCache 
    ? 'Cached results loaded'
    : 'Search completed';
    
  const description = fromCache
    ? `${resultsCount} results loaded instantly from cache`
    : `Found ${resultsCount} matching results`;

  toast.success(title, {
    id: `success-${conversationId}`,
    icon,
    description,
    duration: 3000,
  });
}

/**
 * Navigation Freedom Toast
 * 
 * Informs users they can navigate while search runs
 */
export function showNavigationFreedomToast() {
  toast.info('Search running in background', {
    id: 'navigation-freedom',
    icon: <Clock className="h-4 w-4 text-blue-500" />,
    description: 'Feel free to navigate - your search will continue running',
    duration: 5000,
  });
}

/**
 * Cache Invalidation Toast
 * 
 * Notifies users when cache is cleared due to data changes
 */
export function showCacheInvalidationToast(reason: string) {
  toast.info('Search cache updated', {
    id: 'cache-invalidation',
    icon: <Database className="h-4 w-4 text-blue-500" />,
    description: `Cache cleared due to ${reason}`,
    duration: 3000,
  });
}
