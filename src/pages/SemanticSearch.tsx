import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { BrainCircuit, Info, Database, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { SemanticSearchInput } from '../components/search/SemanticSearchInput';
import { SearchResults } from '../components/search/SearchResults';
import { semanticSearch, SearchParams, SearchResult, ReceiptWithSimilarity, LineItemSearchResult } from '../lib/ai-search';
import Navbar from "@/components/Navbar";
import { CombinedVectorStatus } from '../components/search/CombinedVectorStatus';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SemanticSearchPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searchParams, setSearchParams] = useState<SearchParams | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTarget, setSearchTarget] = useState<'receipts' | 'line_items'>('receipts');
  const resultsPerPage = 10;

  // This effect resets pagination and results when a new search is performed or target changes
  useEffect(() => {
    setCurrentPage(1);
    setSearchResults(null);
  }, [searchQuery, searchTarget]);

  const handleSearch = async (query: string, isNaturalLanguage: boolean) => {
    try {
      setIsLoading(true);
      setSearchQuery(query);

      const params: SearchParams = {
        query,
        isNaturalLanguage,
        limit: resultsPerPage,
        offset: 0,
        searchTarget // Include the current search target (receipts or line_items)
      };
      setSearchParams(params);

      const results = await semanticSearch(params);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!searchParams || !searchResults || isLoading) return;

    try {
      setIsLoading(true);
      const nextPage = currentPage + 1;

      const moreParams: SearchParams = {
        ...searchParams,
        offset: (nextPage - 1) * resultsPerPage // Correct offset calculation
      };

      const moreResults = await semanticSearch(moreParams);

      // Determine if we are loading more receipts or line items
      if (searchTarget === 'receipts' && moreResults.receipts && searchResults.receipts) {
        setSearchResults({
          ...searchResults,
          receipts: [...searchResults.receipts, ...moreResults.receipts],
          count: searchResults.receipts.length + moreResults.receipts.length,
          total: moreResults.total // Use total from the latest call as it might be more accurate
        });
      } else if (searchTarget === 'line_items' && moreResults.lineItems && searchResults.lineItems) {
        setSearchResults({
          ...searchResults,
          lineItems: [...searchResults.lineItems, ...moreResults.lineItems],
          count: searchResults.lineItems.length + moreResults.lineItems.length,
          total: moreResults.total
        });
      }

      setCurrentPage(nextPage);
    } catch (error) {
      console.error('Load more error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if there are more results to load
  const hasMoreResults = searchResults
    ? searchTarget === 'receipts'
      ? searchResults.receipts.length < searchResults.total
      : searchResults.lineItems.length < searchResults.total
    : false;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Semantic Search - Paperless Maverick</title>
      </Helmet>

      <Navbar />

      <main className="flex-1">
        <div className="container mx-auto py-6 max-w-7xl">

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Semantic Search</h1>
          <p className="text-muted-foreground mt-1">
            Search your receipts using natural language and AI-powered semantic understanding
          </p>
        </div>
        <BrainCircuit className="h-10 w-10 text-primary" />
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Ask questions about your receipts</CardTitle>
          <CardDescription>
            Try natural language queries like "coffee shops from last month" or "grocery expenses over $50"
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <SemanticSearchInput
              onSearch={handleSearch}
              isLoading={isLoading}
            />
            <div className="flex items-center gap-2">
              <label htmlFor="searchTarget" className="text-sm font-medium text-muted-foreground">
                Search In:
              </label>
              <Select 
                value={searchTarget} 
                onValueChange={(value: 'receipts' | 'line_items') => setSearchTarget(value)}
              >
                <SelectTrigger id="searchTarget" className="w-[180px]">
                  <SelectValue placeholder="Select target" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receipts">Receipts</SelectItem>
                  <SelectItem value="line_items">Line Items</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!searchResults && !isLoading && (
        <Card className="border-dashed border-muted">
          <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center text-center">
            <Info className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold">
              {searchTarget === 'receipts' 
                ? 'Discover insights in your receipts' 
                : 'Search within individual line items'}
            </h3>
            <p className="text-muted-foreground mt-1 max-w-lg">
              Our AI-powered semantic search understands natural language queries to help you find exactly what you're looking for.
            </p>
            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium">Try asking questions like:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {(searchTarget === 'receipts' ? [
                  "coffee shops from last month",
                  "grocery receipts over $50",
                  "receipts from Target in 2024",
                  "restaurants in New York",
                  "gas station receipts from summer"
                ] : [
                  "coffee items",
                  "bread or pastries",
                  "items over $10",
                  "milk products",
                  "fruits and vegetables"
                ]).map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSearch(suggestion, true)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {(searchResults || isLoading) && (
        <div className="mt-6">
          <SearchResults
            receiptResults={searchTarget === 'receipts' ? searchResults?.receipts || [] : []}
            lineItemResults={searchTarget === 'line_items' ? searchResults?.lineItems || [] : []}
            isLoading={isLoading}
            totalResults={searchResults?.total || 0}
            searchQuery={searchQuery}
            searchTarget={searchTarget}
            onLoadMore={handleLoadMore}
            hasMoreResults={hasMoreResults}
          />
        </div>
      )}
        </div>
      </main>

      <footer className="border-t border-border/40 mt-12">
        <div className="container px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Paperless Maverick. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
