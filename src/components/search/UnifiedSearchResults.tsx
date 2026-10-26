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
import { useCommonTranslation } from '@/contexts/LanguageContext';

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
  const { t } = useCommonTranslation();

  // Group results by the specified criteria
  const groupedResults = useMemo(() => {
    switch (groupBy) {
      case 'source':
        return groupResultsBySource(results);
      case 'date':
        return groupResultsByDate(results);
      default:
        return { all: results };
    }
  }, [results, groupBy]);

  const getGroupLabel = (groupName: string) => {
    if (groupBy === 'date') {
      return t(`unifiedSearch.results.${groupName}`, { defaultValue: groupName });
    }
    return t(`unifiedSearch.results.sourceNames.${groupName}`, {
      defaultValue: groupName,
    });
  };

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
          <h3 className="text-lg font-semibold">{t('unifiedSearch.results.noResults')}</h3>
          <p className="text-muted-foreground">
            {searchQuery
              ? t('unifiedSearch.results.noResultsFor', { query: searchQuery })
              : t('unifiedSearch.results.noResultsHint')}
          </p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>{t('unifiedSearch.results.suggestions')}</p>
            <ul className="list-disc text-left pl-6 space-y-1">
              <li>{t('unifiedSearch.results.checkSpelling')}</li>
              <li>{t('unifiedSearch.results.differentKeywords')}</li>
              <li>{t('unifiedSearch.results.broaderTerms')}</li>
              <li>{t('unifiedSearch.results.clearFilters')}</li>
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
            {t('unifiedSearch.found', { count: totalResults })}
            {searchQuery && ` ${t('unifiedSearch.results.forQuery', { query: searchQuery })}`}
          </p>
          {Object.keys(groupedResults).length > 1 && (
            <p className="text-xs text-muted-foreground">
              {t('unifiedSearch.results.acrossSources', {
                count: Object.keys(groupedResults).length,
              })}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Label htmlFor="groupBy" className="text-sm">{t('unifiedSearch.results.groupBy')}</Label>
          <Select value={groupBy} onValueChange={(value) => onResultAction('change_grouping', { groupBy: value } as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">{t('unifiedSearch.results.relevance')}</SelectItem>
              <SelectItem value="source">{t('unifiedSearch.results.source')}</SelectItem>
              <SelectItem value="date">{t('unifiedSearch.results.date')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grouped Results */}
      {Object.entries(groupedResults).map(([groupName, groupResults]) => (
        <div key={groupName} className="space-y-4">
          {groupBy !== 'relevance' && (
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{getGroupLabel(groupName)}</h3>
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
                {t('unifiedSearch.results.loadingMore')}
              </>
            ) : (
              t('unifiedSearch.results.loadMore')
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
      groupKey = 'today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = 'yesterday';
    } else if (date >= lastWeek) {
      groupKey = 'thisWeek';
    } else if (date >= lastMonth) {
      groupKey = 'thisMonth';
    } else {
      groupKey = 'older';
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(result);
  });

  // Sort groups by recency
  const sortedGroups: Record<string, UnifiedSearchResult[]> = {};
  const dateOrder = ['today', 'yesterday', 'thisWeek', 'thisMonth', 'older'];
  
  dateOrder.forEach(period => {
    if (groups[period]) {
      sortedGroups[period] = groups[period];
    }
  });

  return sortedGroups;
}