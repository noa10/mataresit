import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { UnifiedSearchResultsProps, UnifiedSearchResult } from '@/types/unified-search';
import { ResultCard } from './ResultCard';

export function UnifiedSearchResults({
  results,
  groupBy,
  onResultAction,
  isLoading,
  hasMore,
  onLoadMore,
  searchQuery,
  totalResults,
  className
}: UnifiedSearchResultsProps) {

  // Group results by the specified criteria
  const groupedResults = useMemo(() => {
    switch (groupBy) {
      case 'source':
        return groupResultsBySource(results);
      case 'date':
        return groupResultsByDate(results);
      default:
        return { 'All Results': results };
    }
  }, [results, groupBy]);

  // Loading skeleton
  if (isLoading && results.length === 0) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-32" />
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // No results state
  if (!isLoading && results.length === 0) {
    return (
      <div className={cn("text-center py-12", className)}>
        <div className="max-w-md mx-auto space-y-4">
          <div className="text-6xl">🔍</div>
          <h3 className="text-lg font-semibold">No results found</h3>
          <p className="text-muted-foreground">
            {searchQuery 
              ? `No results found for "${searchQuery}". Try adjusting your search terms or filters.`
              : 'Try entering a search query to find your data.'
            }
          </p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Suggestions:</p>
            <ul className="list-disc text-left pl-6 space-y-1">
              <li>Check your spelling</li>
              <li>Try different keywords</li>
              <li>Use broader search terms</li>
              <li>Clear some filters</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Results Summary and Controls */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Found {totalResults.toLocaleString()} result{totalResults !== 1 ? 's' : ''}
            {searchQuery && ` for "${searchQuery}"`}
          </p>
          {Object.keys(groupedResults).length > 1 && (
            <p className="text-xs text-muted-foreground">
              Across {Object.keys(groupedResults).length} source{Object.keys(groupedResults).length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Label htmlFor="groupBy" className="text-sm">Group by:</Label>
          <Select value={groupBy} onValueChange={(value) => onResultAction('change_grouping', { groupBy: value } as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="source">Source</SelectItem>
              <SelectItem value="date">Date</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grouped Results */}
      {Object.entries(groupedResults).map(([groupName, groupResults]) => (
        <div key={groupName} className="space-y-4">
          {groupBy !== 'relevance' && (
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{formatGroupName(groupName)}</h3>
              <Badge variant="secondary">{groupResults.length}</Badge>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groupResults.map((result) => (
              <ResultCard
                key={`${result.sourceType}-${result.sourceId}`}
                result={result}
                onAction={onResultAction}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center pt-6">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoading}
            className="w-full md:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading more...
              </>
            ) : (
              'Load More Results'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// Helper function to group results by source
function groupResultsBySource(results: UnifiedSearchResult[]): Record<string, UnifiedSearchResult[]> {
  const groups: Record<string, UnifiedSearchResult[]> = {};
  
  results.forEach(result => {
    const sourceKey = result.sourceType;
    if (!groups[sourceKey]) {
      groups[sourceKey] = [];
    }
    groups[sourceKey].push(result);
  });

  // Sort groups by priority
  const sortedGroups: Record<string, UnifiedSearchResult[]> = {};
  const sourceOrder = ['receipts', 'claims', 'team_members', 'custom_categories', 'business_directory', 'conversations'];
  
  sourceOrder.forEach(source => {
    if (groups[source]) {
      sortedGroups[source] = groups[source];
    }
  });

  // Add any remaining sources
  Object.keys(groups).forEach(source => {
    if (!sortedGroups[source]) {
      sortedGroups[source] = groups[source];
    }
  });

  return sortedGroups;
}

// Helper function to group results by date
function groupResultsByDate(results: UnifiedSearchResult[]): Record<string, UnifiedSearchResult[]> {
  const groups: Record<string, UnifiedSearchResult[]> = {};
  
  results.forEach(result => {
    const date = new Date(result.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    let groupKey: string;
    if (date.toDateString() === today.toDateString()) {
      groupKey = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = 'Yesterday';
    } else if (date >= lastWeek) {
      groupKey = 'This Week';
    } else if (date >= lastMonth) {
      groupKey = 'This Month';
    } else {
      groupKey = 'Older';
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(result);
  });

  // Sort groups by recency
  const sortedGroups: Record<string, UnifiedSearchResult[]> = {};
  const dateOrder = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];
  
  dateOrder.forEach(period => {
    if (groups[period]) {
      sortedGroups[period] = groups[period];
    }
  });

  return sortedGroups;
}

// Helper function to format group names
function formatGroupName(groupName: string): string {
  const formatMap: Record<string, string> = {
    'receipts': 'Receipts',
    'claims': 'Claims',
    'team_members': 'Team Members',
    'custom_categories': 'Categories',
    'business_directory': 'Business Directory',
    'conversations': 'Conversations'
  };

  return formatMap[groupName] || groupName;
}
