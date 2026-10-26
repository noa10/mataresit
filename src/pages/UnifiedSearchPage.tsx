import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  Filter, 
  Grid3X3, 
  List,
  LayoutGrid,
  Sparkles
} from 'lucide-react';

// Import unified search components
import { UnifiedSearchInput } from '@/components/search/UnifiedSearchInput';
import { UnifiedSearchResults } from '@/components/search/UnifiedSearchResults';
import { SearchTargetSelector } from '@/components/search/SearchTargetSelector';

// Import types and config
import { 
  UnifiedSearchParams, 
  UnifiedSearchResponse, 
  UnifiedSearchResult,
  SearchFilters 
} from '@/types/unified-search';
import { searchTargets, getAvailableTargets, defaultSearchFilters } from '@/config/search-targets';
import { unifiedSearch } from '@/lib/ai-search';
import { useCommonTranslation } from '@/contexts/LanguageContext';

export default function UnifiedSearchPage() {
  const { t } = useCommonTranslation();
  // Search state
  const [searchResults, setSearchResults] = useState<UnifiedSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const [searchMetadata, setSearchMetadata] = useState<any>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<'search' | 'results'>('search');
  const [groupBy, setGroupBy] = useState<'source' | 'relevance' | 'date'>('relevance');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Search configuration
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(defaultSearchFilters);
  const [selectedTargets, setSelectedTargets] = useState<string[]>(['receipts', 'business_directory']);

  // Get available targets based on subscription (TODO: Get from user context)
  const availableTargets = getAvailableTargets('free', false);

  // Handle search execution
  const handleSearch = async (params: UnifiedSearchParams) => {
    setIsLoading(true);
    setActiveTab('results');
    
    try {
      console.log('Executing unified search with params:', params);
      
      const response = await unifiedSearch(params);
      
      if (response.success) {
        setSearchResults(response.results);
        setTotalResults(response.totalResults);
        setHasMore(response.pagination.hasMore);
        setCurrentQuery(params.query);
        setSearchMetadata(response.searchMetadata);
        
        toast.success(t('unifiedSearch.found', { count: response.totalResults }));
      } else {
        throw new Error(response.error || t('unifiedSearch.input.searchFailed'));
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error(
        error instanceof Error ? error.message : t('unifiedSearch.input.searchFailed')
      );
      setSearchResults([]);
      setTotalResults(0);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle load more results
  const handleLoadMore = async () => {
    if (!currentQuery || isLoading) return;

    setIsLoading(true);
    
    try {
      const params: UnifiedSearchParams = {
        query: currentQuery,
        sources: selectedTargets,
        limit: 20,
        offset: searchResults.length,
        filters: searchFilters,
        similarityThreshold: 0.2,
        includeMetadata: true,
        aggregationMode: 'relevance'
      };

      const response = await unifiedSearch(params);
      
      if (response.success) {
        setSearchResults(prev => [...prev, ...response.results]);
        setHasMore(response.pagination.hasMore);
      }
    } catch (error) {
      console.error('Load more error:', error);
      toast.error(t('unifiedSearch.loadMoreFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle result actions
  const handleResultAction = (action: string, result: UnifiedSearchResult | any) => {
    console.log('Result action:', action, result);
    
    switch (action) {
      case 'change_grouping':
        setGroupBy(result.groupBy);
        break;
      case 'view':
        // Handle view action based on result type
        break;
      case 'search_similar':
        // Perform similar search
        if (result.title) {
          handleSearch({
            query: result.title,
            sources: [result.sourceType],
            limit: 20,
            offset: 0,
            filters: searchFilters,
            similarityThreshold: 0.3,
            includeMetadata: true,
            aggregationMode: 'relevance'
          });
        }
        break;
      case 'share':
        // Handle share action
        toast.info(t('unifiedSearch.shareComingSoon'));
        break;
      default:
        console.log('Unhandled action:', action);
    }
  };

  // Handle new search
  const handleNewSearch = () => {
    setActiveTab('search');
    setSearchResults([]);
    setTotalResults(0);
    setCurrentQuery('');
    setSearchMetadata(null);
  };

  return (
    <div className="min-h-screen bg-ledger-paper">
      <Helmet>
        <title>{t('unifiedSearch.metaTitle')}</title>
      </Helmet>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t('unifiedSearch.title')}</h1>
              <p className="text-ledger-muted mt-2">
                {t('unifiedSearch.subtitle')}
              </p>
            </div>
            
            {searchResults.length > 0 && (
              <Button onClick={handleNewSearch} variant="outline">
                <Search className="mr-2 h-4 w-4" />
                {t('unifiedSearch.newSearch')}
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              {t('unifiedSearch.searchTab')}
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              {t('unifiedSearch.resultsTab')}
              {totalResults > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {totalResults}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  {t('unifiedSearch.searchConfig')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <UnifiedSearchInput
                  onSearch={handleSearch}
                  searchTargets={availableTargets}
                  filters={searchFilters}
                  onFiltersChange={setSearchFilters}
                  isLoading={isLoading}
                  placeholder={t('unifiedSearch.searchPlaceholder')}
                  showAdvancedFilters={true}
                />
              </CardContent>
            </Card>

            {/* Quick Search Examples */}
            <Card>
              <CardHeader>
                <CardTitle>{t('unifiedSearch.quickExamples')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {[
                    'recentReceipts',
                    'groceryExpenses',
                    'malaysianRestaurants',
                    'teamClaims',
                    'officeSupplies',
                    'businessContacts'
                  ].map((exampleKey) => {
                    const example = t(`unifiedSearch.examples.${exampleKey}`);
                    return (
                    <Button
                      key={exampleKey}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSearch({
                        query: example,
                        sources: selectedTargets,
                        limit: 20,
                        offset: 0,
                        filters: searchFilters,
                        similarityThreshold: 0.2,
                        includeMetadata: true,
                        aggregationMode: 'relevance'
                      })}
                      className="justify-start text-left h-auto py-2 px-3"
                    >
                      {example}
                    </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="space-y-6">
            {searchMetadata && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between text-sm text-ledger-muted">
                    <div className="flex items-center gap-4">
                      <span>
                        {t('unifiedSearch.searchDuration', {
                          duration: searchMetadata.searchDuration,
                        })}
                      </span>
                      <Separator orientation="vertical" className="h-4" />
                      <span>
                        {t('unifiedSearch.sourcesSearched', {
                          sources: searchMetadata.sourcesSearched.join(', '),
                        })}
                      </span>
                      {searchMetadata.fallbacksUsed.length > 0 && (
                        <>
                          <Separator orientation="vertical" className="h-4" />
                          <span>
                            {t('unifiedSearch.fallbacksUsed', {
                              fallbacks: searchMetadata.fallbacksUsed.join(', '),
                            })}
                          </span>
                        </>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                      >
                        {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <UnifiedSearchResults
              results={searchResults}
              groupBy={groupBy}
              onResultAction={handleResultAction}
              isLoading={isLoading}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
              searchQuery={currentQuery}
              totalResults={totalResults}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
