import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EnhancedSearchResults } from '@/components/search/EnhancedSearchResults';
import { SearchResultsSkeleton } from '@/components/search/SearchResultsSkeleton';

// Mock data for testing
const mockSearchResults = [
  {
    id: '1',
    merchant: 'SUPER SEVEN CASH & CARRY SDN BHD',
    total: 55.40,
    currency: 'MYR',
    date: '2025-05-26',
    category: 'Groceries',
    similarity_score: 1.0
  },
  {
    id: '2', 
    merchant: 'SUPER SEVEN CASH & CARRY SDN BHD',
    total: 29.80,
    currency: 'MYR',
    date: '2025-06-05',
    category: 'Groceries',
    similarity_score: 1.0
  },
  {
    id: '3',
    merchant: 'POWERCAT CAFE',
    total: 17.90,
    currency: 'MYR', 
    date: '2025-04-17',
    category: 'Food & Beverage',
    similarity_score: 0.95
  },
  {
    id: '4',
    merchant: 'POWERCAT ENTERPRISE',
    total: 76.70,
    currency: 'MYR',
    date: '2025-04-08',
    category: 'Food & Beverage', 
    similarity_score: 0.95
  },
  {
    id: '5',
    merchant: 'POWERCAT STORE',
    total: 138.40,
    currency: 'MYR',
    date: '2025-04-30',
    category: 'Retail',
    similarity_score: 0.90
  }
];

const mockUIComponents = mockSearchResults.map(result => ({
  type: 'ui_component' as const,
  component: 'receipt_card',
  data: {
    receipt_id: result.id,
    merchant: result.merchant,
    total: result.total,
    currency: result.currency,
    date: result.date,
    category: result.category,
    confidence: result.similarity_score,
    line_items_count: Math.floor(Math.random() * 10) + 1
  },
  metadata: {
    title: 'Receipt Card',
    interactive: true,
    actions: ['view_receipt', 'edit_receipt']
  }
}));

export function TestEnhancedSearch() {
  const [searchQuery, setSearchQuery] = useState('powercat');
  const [isLoading, setIsLoading] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [currentResults, setCurrentResults] = useState(mockSearchResults);
  const [currentUIComponents, setCurrentUIComponents] = useState(mockUIComponents);

  const handleSearch = () => {
    setIsLoading(true);

    // Simulate search with different results based on query
    setTimeout(() => {
      if (searchQuery.toLowerCase().includes('powercat')) {
        const powercatResults = mockSearchResults.filter(r =>
          r.merchant.toLowerCase().includes('powercat')
        );
        setCurrentResults(powercatResults);
        setCurrentUIComponents(mockUIComponents.filter((_, index) =>
          mockSearchResults[index]?.merchant.toLowerCase().includes('powercat')
        ));
      } else {
        setCurrentResults(mockSearchResults);
        setCurrentUIComponents(mockUIComponents);
      }
      setIsLoading(false);
    }, 1500);
  };

  const toggleSkeleton = () => {
    setShowSkeleton(!showSkeleton);
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    console.log(`Exporting ${currentResults.length} results as ${format}`);
  };

  const handleCreateClaim = () => {
    console.log('Creating claim from search results');
  };

  const handleSaveSearch = () => {
    console.log('Saving search:', searchQuery);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🧪 Enhanced Search Results Test
            <Badge variant="secondary">Demo</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter search query..."
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? 'Searching...' : 'Search'}
            </Button>
            <Button variant="outline" onClick={toggleSkeleton}>
              {showSkeleton ? 'Hide' : 'Show'} Skeleton
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            This page demonstrates the enhanced search results presentation with:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Comprehensive summary with key metrics</li>
              <li>Enhanced receipt card design with better visual hierarchy</li>
              <li>Sorting and grouping options</li>
              <li>Smooth animations and transitions</li>
              <li>Loading states and skeleton UI</li>
              <li>Responsive grid/list view modes</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Show skeleton or enhanced results */}
      {showSkeleton ? (
        <SearchResultsSkeleton
          count={5}
          showSummary={true}
          viewMode="grid"
        />
      ) : (
        <EnhancedSearchResults
          results={currentResults}
          uiComponents={currentUIComponents}
          searchQuery={searchQuery}
          totalResults={currentResults.length}
          isLoading={isLoading}
          hasMore={false}
          onExport={handleExport}
          onCreateClaim={handleCreateClaim}
          onSaveSearch={handleSaveSearch}
        />
      )}
    </div>
  );
}
