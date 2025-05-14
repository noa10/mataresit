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
import { useSearchParams, useLocation } from 'react-router-dom';

export default function SemanticSearchPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searchParams, setSearchParams] = useState<SearchParams | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isNaturalLanguage, setIsNaturalLanguage] = useState(true);
  const resultsPerPage = 10;

  // Use URL search params to persist search state
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const location = useLocation();

  // Initialize state from URL parameters on component mount
  useEffect(() => {
    const query = urlSearchParams.get('q');
    const natural = urlSearchParams.get('natural') !== 'false'; // Default to true
    const page = parseInt(urlSearchParams.get('page') || '1', 10);

    if (query) {
      setSearchQuery(query);
      setIsNaturalLanguage(natural);
      setCurrentPage(page);

      // If we have a query in the URL, perform the search
      performSearch(query, natural, page);
    }
  }, []);

  // This effect resets pagination and results when a new search is performed
  useEffect(() => {
    setCurrentPage(1);
    if (!searchQuery) {
      setSearchResults(null);
    }
  }, [searchQuery]);

  // Helper function to perform search and update state
  const performSearch = async (query: string, isNaturalLang: boolean, page: number = 1) => {
    try {
      setIsLoading(true);

      const offset = (page - 1) * resultsPerPage;

      const params: SearchParams = {
        query,
        isNaturalLanguage: isNaturalLang,
        limit: resultsPerPage,
        offset: offset,
        searchTarget: 'all' // Use 'all' to search both receipts and line items
      };
      setSearchParams(params);

      const results = await semanticSearch(params);
      setSearchResults(results);

      // Update URL parameters to reflect the search state
      setUrlSearchParams({
        q: query,
        natural: isNaturalLang.toString(),
        page: page.toString()
      });
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (query: string, isNaturalLang: boolean) => {
    setSearchQuery(query);
    setIsNaturalLanguage(isNaturalLang);
    await performSearch(query, isNaturalLang);
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

      // Combine all results (both receipts and line items)
      setSearchResults({
        ...searchResults,
        results: [...(searchResults.results || []), ...(moreResults.results || [])],
        count: (searchResults.results?.length || 0) + (moreResults.results?.length || 0),
        total: moreResults.total // Use total from the latest call as it might be more accurate
      });

      setCurrentPage(nextPage);

      // Update URL parameters with the new page number
      setUrlSearchParams({
        q: searchQuery,
        natural: (searchParams.isNaturalLanguage ?? true).toString(),
        page: nextPage.toString()
      });
    } catch (error) {
      console.error('Load more error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if there are more results to load
  const hasMoreResults = searchResults
    ? (searchResults.results?.length || 0) < (searchResults.total || 0)
    : false;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Semantic Search - Paperless Maverick</title>
      </Helmet>

      <Navbar />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-4 sm:py-6 max-w-7xl">

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">AI Semantic Search</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Search your receipts using natural language and AI-powered semantic understanding
          </p>
        </div>
        <BrainCircuit className="h-8 w-8 sm:h-10 sm:w-10 text-primary mt-1 sm:mt-0" />
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
              initialQuery={searchQuery}
              initialIsNaturalLanguage={isNaturalLanguage}
            />
          </div>
        </CardContent>
      </Card>

      {!searchResults && !isLoading && (
        <Card className="border-dashed border-muted">
          <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center text-center">
            <Info className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold">
              Discover insights in your receipts and line items
            </h3>
            <p className="text-muted-foreground mt-1 max-w-lg">
              Our AI-powered semantic search understands natural language queries to help you find exactly what you're looking for.
            </p>
            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium">Try asking questions like:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  "coffee shops from last month",
                  "grocery receipts over $50",
                  "coffee items",
                  "bread or pastries",
                  "items over $10",
                  "restaurants in New York"
                ].map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSearch(suggestion, true)}
                    className="text-xs sm:text-sm px-2 py-1 h-auto"
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
            results={searchResults?.results || []}
            isLoading={isLoading}
            totalResults={searchResults?.total || 0}
            searchQuery={searchQuery}
            onLoadMore={handleLoadMore}
            hasMoreResults={hasMoreResults}
          />
        </div>
      )}
        </div>
      </main>

      <footer className="border-t border-border/40 mt-8 sm:mt-12">
        <div className="container px-4 py-4 sm:py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-xs sm:text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Paperless Maverick. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
