import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { BrainCircuit, Info, Database, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { SemanticSearchInput } from '../components/search/SemanticSearchInput';
import { SearchResults } from '../components/search/SearchResults';
import { semanticSearch, SearchParams, SearchResult } from '../lib/ai-search';
import Navbar from "@/components/Navbar";
import { CombinedVectorStatus } from '../components/search/CombinedVectorStatus';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function SemanticSearchPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searchParams, setSearchParams] = useState<SearchParams | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const resultsPerPage = 10;

  // This effect resets pagination when a new search is performed
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleSearch = async (query: string, isNaturalLanguage: boolean) => {
    try {
      setIsLoading(true);
      setSearchQuery(query);

      const params: SearchParams = {
        query,
        isNaturalLanguage,
        limit: resultsPerPage,
        offset: 0
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
        offset: nextPage * resultsPerPage
      };

      const moreResults = await semanticSearch(moreParams);

      // Combine the results
      setSearchResults({
        ...moreResults,
        receipts: [...searchResults.receipts, ...moreResults.receipts],
        count: searchResults.receipts.length + moreResults.receipts.length
      });

      setCurrentPage(nextPage);
    } catch (error) {
      console.error('Load more error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if there are more results to load
  const hasMoreResults = searchResults
    ? searchResults.receipts.length < searchResults.total
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
          <SemanticSearchInput
            onSearch={handleSearch}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {!searchResults && !isLoading && (
        <Card className="border-dashed border-muted">
          <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center text-center">
            <Info className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold">Discover insights in your receipts</h3>
            <p className="text-muted-foreground mt-1 max-w-lg">
              Our AI-powered semantic search understands natural language queries to help you find exactly what you're looking for.
            </p>
            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium">Try asking questions like:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  "coffee shops from last month",
                  "grocery receipts over $50",
                  "receipts from Target in 2024",
                  "restaurants in New York",
                  "gas station receipts from summer"
                ].map((suggestion) => (
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
            results={searchResults?.receipts || []}
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
