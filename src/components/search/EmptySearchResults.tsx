import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  X, 
  Filter, 
  Sparkles, 
  RotateCcw,
  AlertCircle,
  ArrowRight,
  ChevronRight
} from 'lucide-react';

export interface EmptySearchResultsProps {
  query: string;
  filters?: {
    dateRange?: boolean;
    amountRange?: boolean;
    categories?: boolean;
    status?: boolean;
  };
  suggestions?: {
    original: string;
    corrected: string;
    confidence: number;
  }[];
  onRefine?: (refinement: string) => void;
  onClearFilters?: () => void;
  onNewSearch?: () => void;
  className?: string;
}

const refineSuggestions = [
  {
    id: 'clear-filters',
    label: 'Clear all filters',
    description: 'Remove active filters to see more results',
    icon: Filter,
    action: 'clear-filters'
  },
  {
    id: 'broader',
    label: 'Broader search',
    description: 'Use fewer or simpler keywords',
    icon: Search,
    action: 'broader'
  },
  {
    id: 'remove-category',
    label: 'Remove category filter',
    description: 'Search across all categories',
    icon: X,
    action: 'remove-category'
  }
];

export function EmptySearchResults({
  query,
  filters = {},
  suggestions = [],
  onRefine,
  onClearFilters,
  onNewSearch,
  className
}: EmptySearchResultsProps) {
  const hasActiveFilters = Object.values(filters).some(Boolean);
  
  const handleSuggestionClick = (suggestion: { corrected: string }) => {
    onRefine?.(suggestion.corrected);
  };

  const handleRefineClick = (action: string) => {
    if (action === 'clear-filters') {
      onClearFilters?.();
    } else {
      onRefine?.(action);
    }
  };

  const formatQuery = (q: string) => {
    if (!q) return 'your search';
    return `"${q.length > 30 ? q.slice(0, 30) + '...' : q}"`;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Main Empty State Card */}
      <Card className="border-dashed">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">No results found</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            We couldn't find anything matching {formatQuery(query)}
          </p>
          
          {/* Query Analysis */}
          <div className="bg-muted/50 rounded-lg p-4 text-left">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Query Analysis</p>
                <p className="text-xs text-muted-foreground">
                  We searched for <span className="font-medium">{formatQuery(query)}</span>
                  {hasActiveFilters && ' with active filters'}
                </p>
                {filters.dateRange && (
                  <Badge variant="outline" className="text-xs mt-1">
                    Date range filter
                  </Badge>
                )}
                {filters.amountRange && (
                  <Badge variant="outline" className="text-xs mt-1">
                    Amount filter
                  </Badge>
                )}
                {filters.categories && (
                  <Badge variant="outline" className="text-xs mt-1">
                    Category filter
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Did You Mean */}
          {suggestions.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 text-left border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Did you mean?</p>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="flex items-center gap-2 w-full text-left hover:underline"
                    >
                      <span className="text-sm text-muted-foreground line-through">
                        {suggestion.original}
                      </span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                        {suggestion.corrected}
                      </span>
                      {suggestion.confidence > 0.8 && (
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(suggestion.confidence * 100)}% match
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refinement Suggestions */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <RotateCcw className="h-4 w-4" />
          Try these refinements
        </h3>
        
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {refineSuggestions.map((suggestion) => {
            const Icon = suggestion.icon;
            const isDisabled = 
              (suggestion.action === 'clear-filters' && !hasActiveFilters) ||
              (suggestion.action === 'remove-category' && !filters.categories);

            return (
              <Button
                key={suggestion.id}
                variant="outline"
                disabled={isDisabled}
                onClick={() => handleRefineClick(suggestion.action)}
                className={cn(
                  "h-auto py-3 px-4 justify-start text-left hover:bg-accent",
                  isDisabled && "opacity-50"
                )}
              >
                <Icon className="h-4 w-4 mr-2 flex-shrink-0" />
                <div className="flex flex-col items-start">
                  <span className="font-medium">{suggestion.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {suggestion.description}
                  </span>
                </div>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Start New Search */}
      {onNewSearch && (
        <div className="flex justify-center pt-2">
          <Button variant="default" onClick={onNewSearch}>
            <Search className="h-4 w-4 mr-2" />
            Start a new search
          </Button>
        </div>
      )}
    </div>
  );
}

export function EmptySearchResultsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6 animate-pulse", className)}>
      <div className="border rounded-lg p-6">
        <div className="h-12 w-12 rounded-full bg-muted mx-auto mb-4" />
        <div className="h-6 w-40 bg-muted rounded mx-auto mb-2" />
        <div className="h-4 w-64 bg-muted rounded mx-auto" />
      </div>
      
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 border rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
