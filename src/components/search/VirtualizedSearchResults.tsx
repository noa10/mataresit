/**
 * Virtualized Search Results Component
 * High-performance search results with virtualization, lazy loading, and optimized rendering
 */

import React, { memo, useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { FixedSizeList as List, VariableSizeList, ListChildComponentProps } from 'react-window';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Grid, List as ListIcon, Filter, SortAsc } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRenderOptimization, useVirtualizedList, useOptimizedMemo } from '@/lib/ui-performance-optimizer';
import { useOptimizedAnimation, OPTIMIZED_VARIANTS } from '@/lib/optimized-animations';
import { OptimizedLoading, SearchResultSkeleton } from '@/components/ui/OptimizedLoadingStates';
import { UnifiedSearchResult } from '@/types/unified-search';

// Virtualization configuration
interface VirtualizationConfig {
  itemHeight: number;
  containerHeight: number;
  overscan: number;
  enableVariableHeight: boolean;
  enableInfiniteScroll: boolean;
  loadMoreThreshold: number;
}

// Search result item props
interface SearchResultItemProps {
  result: UnifiedSearchResult;
  index: number;
  isSelected: boolean;
  viewMode: 'grid' | 'list';
  onSelect: (result: UnifiedSearchResult) => void;
  onAction: (action: string, result: UnifiedSearchResult) => void;
}

// Optimized search result item
const SearchResultItem = memo<SearchResultItemProps>(({
  result,
  index,
  isSelected,
  viewMode,
  onSelect,
  onAction
}) => {
  const { elementRef, shouldRender } = useRenderOptimization(`search-result-${result.id}`, 1, 2);
  const entranceAnimation = useOptimizedAnimation('fadeInUp');

  const handleClick = useCallback(() => {
    onSelect(result);
  }, [result, onSelect]);

  const handleAction = useCallback((action: string) => {
    onAction(action, result);
  }, [result, onAction]);

  // Memoized content to prevent unnecessary re-renders
  const content = useOptimizedMemo(() => {
    const amount = result.metadata?.amount;
    const currency = result.metadata?.currency || 'MYR';
    const date = result.metadata?.date;
    const similarity = result.similarity || 0;

    return {
      amount: amount ? `${currency} ${amount.toFixed(2)}` : null,
      date: date ? new Date(date).toLocaleDateString() : null,
      similarity: Math.round(similarity * 100),
      truncatedContent: result.content.length > 150 ? 
        result.content.substring(0, 150) + '...' : result.content
    };
  }, [result.metadata, result.similarity, result.content]);

  if (!shouldRender) {
    return <div ref={elementRef} className="h-24 bg-muted rounded animate-pulse" />;
  }

  if (viewMode === 'list') {
    return (
      <motion.div
        ref={elementRef}
        {...entranceAnimation}
        className={cn(
          'flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-colors',
          isSelected ? 'bg-primary/10 border-primary' : 'bg-card hover:bg-muted/50'
        )}
        onClick={handleClick}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-sm truncate">{result.title}</h3>
            <Badge variant="outline" className="text-xs">
              {content.similarity}%
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {content.truncatedContent}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {content.amount && <span>{content.amount}</span>}
          {content.date && <span>{content.date}</span>}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={elementRef}
      {...entranceAnimation}
      className={cn(
        'group cursor-pointer',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={handleClick}
    >
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-medium text-sm line-clamp-2">{result.title}</h3>
            <Badge variant="outline" className="text-xs ml-2">
              {content.similarity}%
            </Badge>
          </div>
          
          <p className="text-xs text-muted-foreground line-clamp-3 mb-3">
            {content.truncatedContent}
          </p>
          
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              {content.date && <span>{content.date}</span>}
              {result.type && (
                <Badge variant="secondary" className="text-xs">
                  {result.type}
                </Badge>
              )}
            </div>
            {content.amount && (
              <span className="font-medium text-primary">{content.amount}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

SearchResultItem.displayName = 'SearchResultItem';

// Virtualized list item renderer
const VirtualizedItem = memo<ListChildComponentProps>(({ index, style, data }) => {
  const { results, viewMode, selectedResults, onSelect, onAction } = data;
  const result = results[index];
  
  if (!result) {
    return (
      <div style={style}>
        <SearchResultSkeleton />
      </div>
    );
  }

  return (
    <div style={style} className="px-2 py-1">
      <SearchResultItem
        result={result}
        index={index}
        isSelected={selectedResults.has(result.id)}
        viewMode={viewMode}
        onSelect={onSelect}
        onAction={onAction}
      />
    </div>
  );
});

VirtualizedItem.displayName = 'VirtualizedItem';

// Main virtualized search results component
interface VirtualizedSearchResultsProps {
  results: UnifiedSearchResult[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onSelect?: (result: UnifiedSearchResult) => void;
  onAction?: (action: string, result: UnifiedSearchResult) => void;
  className?: string;
  virtualizationConfig?: Partial<VirtualizationConfig>;
}

export const VirtualizedSearchResults = memo<VirtualizedSearchResultsProps>(({
  results,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onSelect = () => {},
  onAction = () => {},
  className,
  virtualizationConfig = {}
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'amount'>('relevance');
  const listRef = useRef<List>(null);

  const config: VirtualizationConfig = {
    itemHeight: viewMode === 'list' ? 80 : 200,
    containerHeight: 600,
    overscan: 5,
    enableVariableHeight: false,
    enableInfiniteScroll: true,
    loadMoreThreshold: 10,
    ...virtualizationConfig
  };

  const { elementRef, shouldRender } = useRenderOptimization('virtualized-search-results', results.length, 3);

  // Memoized sorted results
  const sortedResults = useOptimizedMemo(() => {
    return [...results].sort((a, b) => {
      switch (sortBy) {
        case 'relevance':
          return (b.similarity || 0) - (a.similarity || 0);
        case 'date':
          const dateA = new Date(a.metadata?.date || 0).getTime();
          const dateB = new Date(b.metadata?.date || 0).getTime();
          return dateB - dateA;
        case 'amount':
          const amountA = a.metadata?.amount || 0;
          const amountB = b.metadata?.amount || 0;
          return amountB - amountA;
        default:
          return 0;
      }
    });
  }, [results, sortBy]);

  // Handle result selection
  const handleSelect = useCallback((result: UnifiedSearchResult) => {
    setSelectedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(result.id)) {
        newSet.delete(result.id);
      } else {
        newSet.add(result.id);
      }
      return newSet;
    });
    onSelect(result);
  }, [onSelect]);

  // Handle infinite scroll
  const handleItemsRendered = useCallback(({ visibleStopIndex }: { visibleStopIndex: number }) => {
    if (
      config.enableInfiniteScroll &&
      hasMore &&
      !isLoading &&
      onLoadMore &&
      visibleStopIndex >= sortedResults.length - config.loadMoreThreshold
    ) {
      onLoadMore();
    }
  }, [config.enableInfiniteScroll, hasMore, isLoading, onLoadMore, sortedResults.length, config.loadMoreThreshold]);

  // Virtualized list data
  const listData = useMemo(() => ({
    results: sortedResults,
    viewMode,
    selectedResults,
    onSelect: handleSelect,
    onAction
  }), [sortedResults, viewMode, selectedResults, handleSelect, onAction]);

  if (!shouldRender) {
    return <div ref={elementRef} className="h-96 bg-muted rounded animate-pulse" />;
  }

  if (results.length === 0 && !isLoading) {
    return (
      <div ref={elementRef} className={cn('text-center py-12', className)}>
        <p className="text-muted-foreground">No search results found</p>
      </div>
    );
  }

  return (
    <div ref={elementRef} className={cn('space-y-4', className)}>
      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {sortedResults.length} results
          </span>
          {selectedResults.size > 0 && (
            <Badge variant="secondary">
              {selectedResults.size} selected
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Sort controls */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="relevance">Relevance</option>
            <option value="date">Date</option>
            <option value="amount">Amount</option>
          </select>

          {/* View mode toggle */}
          <div className="flex border rounded">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Virtualized results */}
      <div className="border rounded-lg overflow-hidden">
        {viewMode === 'grid' ? (
          // Grid view with CSS Grid virtualization
          <div 
            className="grid gap-4 p-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              height: config.containerHeight,
              overflow: 'auto'
            }}
          >
            {sortedResults.map((result, index) => (
              <SearchResultItem
                key={result.id}
                result={result}
                index={index}
                isSelected={selectedResults.has(result.id)}
                viewMode={viewMode}
                onSelect={handleSelect}
                onAction={onAction}
              />
            ))}
          </div>
        ) : (
          // List view with react-window virtualization
          <List
            ref={listRef}
            height={config.containerHeight}
            itemCount={sortedResults.length + (hasMore ? 1 : 0)}
            itemSize={config.itemHeight}
            itemData={listData}
            overscanCount={config.overscan}
            onItemsRendered={handleItemsRendered}
          >
            {VirtualizedItem}
          </List>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="p-4 border-t">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading more results...</span>
            </div>
          </div>
        )}
      </div>

      {/* Load more button */}
      {hasMore && !isLoading && (
        <div className="text-center">
          <Button variant="outline" onClick={onLoadMore}>
            Load More Results
          </Button>
        </div>
      )}
    </div>
  );
});

VirtualizedSearchResults.displayName = 'VirtualizedSearchResults';

// Hook for managing virtualized search results
export function useVirtualizedSearchResults(
  initialResults: UnifiedSearchResult[] = [],
  pageSize: number = 20
) {
  const [results, setResults] = useState<UnifiedSearchResult[]>(initialResults);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    
    try {
      // Simulate API call - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Add more results (simulated)
      const newResults = Array.from({ length: pageSize }, (_, i) => ({
        id: `result-${page * pageSize + i}`,
        type: 'receipt' as const,
        title: `Result ${page * pageSize + i + 1}`,
        content: `Content for result ${page * pageSize + i + 1}`,
        similarity: Math.random(),
        metadata: {
          amount: Math.random() * 100,
          currency: 'MYR',
          date: new Date().toISOString()
        }
      }));

      setResults(prev => [...prev, ...newResults]);
      setPage(prev => prev + 1);
      
      // Simulate end of results
      if (page >= 5) {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load more results:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, page, pageSize]);

  const reset = useCallback(() => {
    setResults(initialResults);
    setPage(0);
    setHasMore(true);
    setIsLoading(false);
  }, [initialResults]);

  return {
    results,
    isLoading,
    hasMore,
    loadMore,
    reset,
    setResults
  };
}
