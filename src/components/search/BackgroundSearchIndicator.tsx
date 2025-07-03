import React from 'react';
import { Search, CheckCircle, AlertCircle, Loader2, Clock, Zap, Database, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBackgroundSearch } from '@/contexts/BackgroundSearchContext';
import { cn } from '@/lib/utils';

interface BackgroundSearchIndicatorProps {
  conversationId?: string;
  className?: string;
  variant?: 'default' | 'compact' | 'detailed';
  showProgress?: boolean;
  showTimestamp?: boolean;
}

/**
 * Background Search Indicator
 * 
 * Shows the status of background searches and allows users to see
 * search progress without being locked to the search page.
 */
export function BackgroundSearchIndicator({
  conversationId,
  className = '',
  variant = 'default',
  showProgress = false,
  showTimestamp = false
}: BackgroundSearchIndicatorProps) {
  const {
    hasActiveSearches,
    totalActiveSearches,
    getSearchStatus,
    isSearchActive,
    isSearchCompleted
  } = useBackgroundSearch();

  // If no conversation ID provided, show global status
  if (!conversationId) {
    if (!hasActiveSearches) return null;

    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          {totalActiveSearches} search{totalActiveSearches > 1 ? 'es' : ''} running
        </Badge>
      </div>
    );
  }

  // Show status for specific conversation
  const status = getSearchStatus(conversationId);
  const isActive = isSearchActive(conversationId);
  const isCompleted = isSearchCompleted(conversationId);

  if (status === 'idle') return null;

  const getStatusIcon = () => {
    const iconSize = variant === 'compact' ? 'h-3 w-3' : 'h-4 w-4';

    switch (status) {
      case 'preprocessing':
        return <Zap className={`${iconSize} animate-pulse text-blue-500`} />;
      case 'searching':
        return <Loader2 className={`${iconSize} animate-spin text-purple-500`} />;
      case 'complete':
        return <CheckCircle className={`${iconSize} text-green-500`} />;
      case 'cached':
        return <Database className={`${iconSize} text-emerald-500`} />;
      case 'error':
        return <AlertCircle className={`${iconSize} text-red-500`} />;
      default:
        return <Search className={`${iconSize} text-muted-foreground`} />;
    }
  };

  const getStatusText = () => {
    if (variant === 'compact') {
      switch (status) {
        case 'preprocessing':
          return 'Processing';
        case 'searching':
          return 'Searching';
        case 'complete':
          return 'Complete';
        case 'cached':
          return 'Cached';
        case 'error':
          return 'Failed';
        default:
          return 'Unknown';
      }
    }

    switch (status) {
      case 'preprocessing':
        return 'Understanding your question...';
      case 'searching':
        return 'Searching through your data...';
      case 'complete':
        return 'Search completed successfully';
      case 'cached':
        return 'Results loaded from cache';
      case 'error':
        return 'Search failed - please try again';
      default:
        return 'Search status unknown';
    }
  };

  const getStatusVariant = () => {
    switch (status) {
      case 'preprocessing':
        return 'secondary';
      case 'searching':
        return 'secondary';
      case 'complete':
        return 'default';
      case 'cached':
        return 'outline';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusColors = () => {
    switch (status) {
      case 'preprocessing':
        return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'searching':
        return 'border-purple-200 bg-purple-50 text-purple-700';
      case 'complete':
        return 'border-green-200 bg-green-50 text-green-700';
      case 'cached':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'error':
        return 'border-red-200 bg-red-50 text-red-700';
      default:
        return 'border-gray-200 bg-gray-50 text-gray-700';
    }
  };

  // Compact variant for sidebar items
  if (variant === 'compact') {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Badge
          variant={getStatusVariant()}
          className={cn(
            "flex items-center gap-1 text-xs px-1.5 py-0.5 h-5",
            getStatusColors()
          )}
        >
          {getStatusIcon()}
          {getStatusText()}
        </Badge>
      </div>
    );
  }

  // Detailed variant with more information
  if (variant === 'detailed') {
    return (
      <div className={cn("flex flex-col gap-2 p-3 rounded-lg border", getStatusColors(), className)}>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium text-sm">{getStatusText()}</span>
        </div>

        {isActive && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Running in background</span>
          </div>
        )}

        {showTimestamp && (
          <div className="text-xs text-muted-foreground">
            {new Date().toLocaleTimeString()}
          </div>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge
        variant={getStatusVariant()}
        className={cn(
          "flex items-center gap-2 px-3 py-1",
          getStatusColors()
        )}
      >
        {getStatusIcon()}
        <span className="font-medium">{getStatusText()}</span>
      </Badge>

      {isActive && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Running in background</span>
        </div>
      )}
    </div>
  );
}

/**
 * Global Background Search Status
 *
 * Shows a floating indicator when searches are running in the background.
 * This allows users to see search progress even when they navigate away.
 */
export function GlobalBackgroundSearchStatus() {
  const { hasActiveSearches, totalActiveSearches } = useBackgroundSearch();

  if (!hasActiveSearches) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 duration-300">
      <Badge
        variant="secondary"
        className={cn(
          "flex items-center gap-3 px-4 py-3 shadow-xl border-2",
          "bg-background/95 backdrop-blur-sm",
          "border-purple-200 bg-purple-50 text-purple-700",
          "hover:bg-purple-100 transition-colors duration-200",
          "animate-pulse"
        )}
      >
        <div className="relative">
          <Loader2 className="h-5 w-5 animate-spin" />
          <div className="absolute inset-0 rounded-full bg-purple-400 opacity-20 animate-ping" />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-sm">
            {totalActiveSearches} search{totalActiveSearches > 1 ? 'es' : ''} running
          </span>
          <span className="text-xs opacity-75">
            You can navigate freely
          </span>
        </div>
      </Badge>
    </div>
  );
}

/**
 * Search Progress Indicator
 *
 * Shows detailed progress for active searches with progress bars
 */
export function SearchProgressIndicator({
  conversationId,
  className = ''
}: {
  conversationId: string;
  className?: string;
}) {
  const { getSearchStatus, isSearchActive } = useBackgroundSearch();
  const status = getSearchStatus(conversationId);
  const isActive = isSearchActive(conversationId);

  if (!isActive || status === 'idle') return null;

  const getProgressValue = () => {
    switch (status) {
      case 'preprocessing':
        return 25;
      case 'searching':
        return 75;
      case 'complete':
      case 'cached':
        return 100;
      default:
        return 0;
    }
  };

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Search Progress</span>
        <span className="font-medium">{getProgressValue()}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-500 ease-out rounded-full",
            status === 'preprocessing' && "bg-blue-500",
            status === 'searching' && "bg-purple-500",
            (status === 'complete' || status === 'cached') && "bg-green-500",
            status === 'error' && "bg-red-500"
          )}
          style={{ width: `${getProgressValue()}%` }}
        />
      </div>
    </div>
  );
}
