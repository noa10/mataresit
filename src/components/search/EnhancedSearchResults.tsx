import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, 
  ChevronUp, 
  Grid3X3, 
  List, 
  Filter,
  SortAsc,
  SortDesc,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { SearchResultsSummary } from './SearchResultsSummary';
import { SearchResultsSkeleton } from './SearchResultsSkeleton';
import { SearchResultsActions } from './SearchResultsActions';
import { UIComponentRenderer } from '@/components/chat/ui-components/UIComponentRenderer';
import { cn } from '@/lib/utils';

interface EnhancedSearchResultsProps {
  results: any[];
  uiComponents?: any[];
  searchQuery: string;
  totalResults: number;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onExport?: (format: 'csv' | 'pdf') => void;
  onCreateClaim?: () => void;
  onSaveSearch?: () => void;
  className?: string;
}

type ViewMode = 'grid' | 'list';
type SortOption = 'relevance' | 'date' | 'amount' | 'merchant';
type SortDirection = 'asc' | 'desc';
type GroupBy = 'none' | 'merchant' | 'date' | 'amount';

export function EnhancedSearchResults({
  results,
  uiComponents = [],
  searchQuery,
  totalResults,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onExport,
  onCreateClaim,
  onSaveSearch,
  className
}: EnhancedSearchResultsProps) {
  // 🔍 DEBUG: Log enhanced search results data
  console.log('🔍 DEBUG: EnhancedSearchResults received:', {
    resultsLength: results?.length || 0,
    uiComponentsLength: uiComponents?.length || 0,
    uiComponentsPreview: uiComponents?.map((comp, idx) => ({
      index: idx,
      type: comp.type,
      component: comp.component,
      hasData: !!comp.data,
      dataKeys: comp.data ? Object.keys(comp.data) : []
    })),
    searchQuery,
    totalResults,
    isLoading
  });

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [showSummary, setShowSummary] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Sort and organize results
  const sortedResults = useMemo(() => {
    if (!results || results.length === 0) return [];

    const sorted = [...results].sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.date || a.metadata?.date || 0).getTime();
          bValue = new Date(b.date || b.metadata?.date || 0).getTime();
          break;
        case 'amount':
          aValue = a.total || a.total_amount || a.metadata?.total || 0;
          bValue = b.total || b.total_amount || b.metadata?.total || 0;
          break;
        case 'merchant':
          aValue = (a.merchant || a.metadata?.merchant || '').toLowerCase();
          bValue = (b.merchant || b.metadata?.merchant || '').toLowerCase();
          break;
        case 'relevance':
        default:
          aValue = a.similarity_score || a.similarity || 0;
          bValue = b.similarity_score || b.similarity || 0;
          break;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return sorted;
  }, [results, sortBy, sortDirection]);

  // Group results
  const groupedResults = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Results': sortedResults };
    }

    const groups: Record<string, any[]> = {};

    sortedResults.forEach(result => {
      let groupKey: string;

      switch (groupBy) {
        case 'merchant':
          groupKey = result.merchant || result.metadata?.merchant || 'Unknown Merchant';
          break;
        case 'date':
          const date = new Date(result.date || result.metadata?.date || 0);
          groupKey = date.toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'long'
          });
          break;
        case 'amount':
          const amount = result.total || result.total_amount || result.metadata?.total || 0;
          if (amount >= 100) groupKey = 'High Value (≥ MYR 100)';
          else if (amount >= 50) groupKey = 'Medium Value (MYR 50-99)';
          else if (amount >= 10) groupKey = 'Low Value (MYR 10-49)';
          else groupKey = 'Minimal Value (< MYR 10)';
          break;
        default:
          groupKey = 'Other';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(result);
    });

    // Sort groups by size (largest first)
    const sortedGroups = Object.entries(groups)
      .sort(([, a], [, b]) => b.length - a.length)
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {} as Record<string, any[]>);

    return sortedGroups;
  }, [sortedResults, groupBy]);

  const toggleCardExpansion = (cardId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(cardId)) {
      newExpanded.delete(cardId);
    } else {
      newExpanded.add(cardId);
    }
    setExpandedCards(newExpanded);
  };

  const toggleGroupExpansion = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  // Show loading skeleton
  if (isLoading && totalResults === 0) {
    return (
      <SearchResultsSkeleton
        count={6}
        showSummary={true}
        viewMode={viewMode}
        className={className}
      />
    );
  }

  if (totalResults === 0 && !isLoading) {
    return (
      <div className={cn("space-y-6", className)}>
        <SearchResultsSummary
          results={[]}
          searchQuery={searchQuery}
          totalResults={0}
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Summary Section */}
      <AnimatePresence>
        {showSummary && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <SearchResultsSummary
              results={results}
              searchQuery={searchQuery}
              totalResults={totalResults}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions Bar */}
      {totalResults > 0 && (
        <SearchResultsActions
          results={results}
          searchQuery={searchQuery}
          totalAmount={results.reduce((sum, r) => sum + (r.total || r.total_amount || r.metadata?.total || 0), 0)}
          currency={results[0]?.currency || results[0]?.metadata?.currency || 'MYR'}
          onExport={onExport}
          onCreateClaim={onCreateClaim}
          onSaveSearch={onSaveSearch}
        />
      )}

      {/* Controls */}
      {totalResults > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSummary(!showSummary)}
                  className="text-xs"
                >
                  {showSummary ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                  {showSummary ? 'Hide' : 'Show'} Summary
                </Button>
                <Separator orientation="vertical" className="h-4" />
                <Badge variant="secondary" className="text-xs">
                  {totalResults} result{totalResults !== 1 ? 's' : ''}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                {/* Group Controls */}
                <Select value={groupBy} onValueChange={(value: GroupBy) => setGroupBy(value)}>
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue placeholder="Group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Group</SelectItem>
                    <SelectItem value="merchant">Merchant</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="amount">Amount</SelectItem>
                  </SelectContent>
                </Select>

                {/* Sort Controls */}
                <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="amount">Amount</SelectItem>
                    <SelectItem value="merchant">Merchant</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  className="p-1 h-8 w-8"
                >
                  {sortDirection === 'asc' ? 
                    <SortAsc className="h-4 w-4" /> : 
                    <SortDesc className="h-4 w-4" />
                  }
                </Button>

                <Separator orientation="vertical" className="h-4" />

                {/* View Mode Toggle */}
                <div className="flex border rounded-md">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="p-1 h-8 w-8 rounded-r-none"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="p-1 h-8 w-8 rounded-l-none"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {uiComponents && uiComponents.length > 0 ? (
        <div className="space-y-6">
          {/* 🔧 TEMP FIX: Render all UI components directly without complex matching */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "grid gap-4",
              viewMode === 'grid'
                ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                : "grid-cols-1"
            )}
          >
            {uiComponents.map((component, index) => {
              // Only render line_item_card and receipt_card components
              if (component.component === 'line_item_card' || component.component === 'receipt_card') {
                return (
                  <motion.div
                    key={`component-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="w-full"
                  >
                    <UIComponentRenderer
                      components={[component]}
                      compact={viewMode === 'list'}
                    />
                  </motion.div>
                );
              }
              return null;
            })}
          </motion.div>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>No UI components to display</p>
        </div>
      )}

      {/* Load More */}
      {hasMore && onLoadMore && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center pt-4"
        >
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoading}
            className="min-w-32 transition-all duration-200"
          >
            {isLoading ? (
              <motion.div
                className="flex items-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                Loading...
              </motion.div>
            ) : (
              'Load More'
            )}
          </Button>
        </motion.div>
      )}

      {/* Progressive Loading Indicator */}
      {isLoading && totalResults > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <motion.div
              key={`loading-${index}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <SearchResultsSkeleton count={1} showSummary={false} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
