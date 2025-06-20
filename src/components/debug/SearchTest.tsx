import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { semanticSearch } from '@/lib/ai-search';
import { callEdgeFunction } from '@/lib/edge-function-utils';
import { supabase } from '@/lib/supabase';

export function SearchTest() {
  const [query, setQuery] = useState('groceries');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testSearch = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      console.log('Testing search with query:', query);
      
      // Test the semanticSearch function
      const searchResults = await semanticSearch({
        query,
        searchTarget: 'all',
        limit: 5,
        offset: 0,
        isNaturalLanguage: true
      });

      console.log('Search results:', searchResults);
      setResults(searchResults);
    } catch (err) {
      console.error('Search test error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const testDirectDatabase = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      console.log('Testing direct database query with query:', query);

      // Test direct database access
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', session ? 'authenticated' : 'not authenticated');

      if (!session) {
        throw new Error('User not authenticated');
      }

      // Test simple receipt query
      const { data: receipts, error } = await supabase
        .from('receipts')
        .select('id, merchant, date, total, predicted_category')
        .ilike('merchant', `%${query}%`)
        .order('date', { ascending: false })
        .limit(5);

      if (error) {
        throw error;
      }

      console.log('Direct database results:', receipts);
      setResults({
        type: 'direct_database',
        receipts: receipts || [],
        count: receipts?.length || 0,
        session: session ? 'authenticated' : 'not authenticated'
      });
    } catch (err) {
      console.error('Direct database test error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Search Functionality Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter search query..."
            className="flex-1"
          />
          <Button onClick={testSearch} disabled={loading}>
            Test Search
          </Button>
          <Button onClick={testDirectDatabase} disabled={loading} variant="outline">
            Test Database
          </Button>
        </div>

        {loading && (
          <div className="text-center py-4">
            <div className="text-sm text-muted-foreground">Testing search...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-red-800 font-medium">Error:</div>
            <div className="text-red-600 text-sm mt-1">{error}</div>
          </div>
        )}

        {results && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="text-green-800 font-medium mb-2">Results:</div>
            <pre className="text-xs text-green-700 overflow-auto max-h-96">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
