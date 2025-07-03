import React from 'react';
import { Loader2, Search, Brain, Database, Sparkles, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface SearchLoadingStateProps {
  status: 'idle' | 'preprocessing' | 'searching' | 'complete' | 'cached' | 'error';
  message?: string;
  progress?: number;
  className?: string;
  variant?: 'default' | 'minimal' | 'detailed';
}

/**
 * Enhanced Search Loading States
 * 
 * Provides rich visual feedback for different search states with
 * appropriate animations, colors, and progress indicators.
 */
export function SearchLoadingState({
  status,
  message,
  progress,
  className = '',
  variant = 'default'
}: SearchLoadingStateProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'preprocessing':
        return {
          icon: Brain,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 border-blue-200',
          title: 'Understanding Your Question',
          description: message || 'Analyzing your search query and extracting key information...',
          progress: progress || 25,
          animated: true
        };
      case 'searching':
        return {
          icon: Search,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50 border-purple-200',
          title: 'Searching Your Data',
          description: message || 'Finding relevant receipts and information...',
          progress: progress || 75,
          animated: true
        };
      case 'complete':
        return {
          icon: Sparkles,
          color: 'text-green-600',
          bgColor: 'bg-green-50 border-green-200',
          title: 'Search Complete',
          description: message || 'Successfully found your results!',
          progress: 100,
          animated: false
        };
      case 'cached':
        return {
          icon: Database,
          color: 'text-emerald-600',
          bgColor: 'bg-emerald-50 border-emerald-200',
          title: 'Results Loaded',
          description: message || 'Loaded results from cache instantly',
          progress: 100,
          animated: false
        };
      case 'error':
        return {
          icon: Search,
          color: 'text-red-600',
          bgColor: 'bg-red-50 border-red-200',
          title: 'Search Failed',
          description: message || 'Please try again or rephrase your question',
          progress: 0,
          animated: false
        };
      default:
        return {
          icon: Search,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50 border-gray-200',
          title: 'Ready to Search',
          description: 'Type your question to get started',
          progress: 0,
          animated: false
        };
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;

  // Minimal variant for inline use
  if (variant === 'minimal') {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {config.animated ? (
          <Loader2 className={cn("h-4 w-4 animate-spin", config.color)} />
        ) : (
          <IconComponent className={cn("h-4 w-4", config.color)} />
        )}
        <span className="text-sm text-muted-foreground">
          {config.description}
        </span>
      </div>
    );
  }

  // Detailed variant with full information
  if (variant === 'detailed') {
    return (
      <div className={cn(
        "p-6 rounded-lg border-2 space-y-4",
        config.bgColor,
        className
      )}>
        <div className="flex items-center gap-3">
          <div className="relative">
            {config.animated ? (
              <Loader2 className={cn("h-6 w-6 animate-spin", config.color)} />
            ) : (
              <IconComponent className={cn("h-6 w-6", config.color)} />
            )}
            {config.animated && (
              <div className="absolute inset-0 rounded-full bg-current opacity-20 animate-ping" />
            )}
          </div>
          <div className="flex-1">
            <h3 className={cn("font-semibold text-lg", config.color)}>
              {config.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {config.description}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className={cn("font-medium", config.color)}>
              {config.progress}%
            </span>
          </div>
          <Progress 
            value={config.progress} 
            className="h-2"
          />
        </div>

        {/* Background processing indicator */}
        {config.animated && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Running in background - you can navigate freely</span>
          </div>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-lg border",
      config.bgColor,
      className
    )}>
      <div className="relative">
        {config.animated ? (
          <Loader2 className={cn("h-5 w-5 animate-spin", config.color)} />
        ) : (
          <IconComponent className={cn("h-5 w-5", config.color)} />
        )}
      </div>
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("font-medium", config.color)}>
            {config.title}
          </span>
          {config.animated && (
            <Badge variant="secondary" className="text-xs">
              {config.progress}%
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {config.description}
        </p>
      </div>
    </div>
  );
}

/**
 * Skeleton Loading State for Search Results
 */
export function SearchResultsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="p-4 border rounded-lg space-y-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded flex-1" />
            <div className="h-4 w-16 bg-gray-200 rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Conversation Loading State
 */
export function ConversationLoadingSkeleton() {
  return (
    <div className="space-y-6 p-4">
      {/* User message skeleton */}
      <div className="flex justify-end">
        <div className="bg-gray-200 rounded-lg p-3 max-w-xs animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-32" />
        </div>
      </div>
      
      {/* AI response skeleton */}
      <div className="flex justify-start">
        <div className="bg-gray-100 rounded-lg p-4 max-w-md space-y-2 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    </div>
  );
}
