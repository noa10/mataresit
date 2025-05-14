import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Spinner } from '../ui/spinner';
import { toast } from '../ui/use-toast';

interface SemanticSearchInputProps {
  onSearch: (query: string, isNaturalLanguage: boolean) => Promise<void>;
  placeholder?: string;
  isLoading?: boolean;
  className?: string;
  initialQuery?: string;
  initialIsNaturalLanguage?: boolean;
}

export function SemanticSearchInput({
  onSearch,
  placeholder = 'Search your receipts using natural language...',
  isLoading = false,
  className = '',
  initialQuery = '',
  initialIsNaturalLanguage = true,
}: SemanticSearchInputProps) {
  const [query, setQuery] = useState(initialQuery);
  const [isNaturalLanguage, setIsNaturalLanguage] = useState(initialIsNaturalLanguage);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      toast({
        title: 'Please enter a search query',
        variant: 'destructive',
      });
      return;
    }

    try {
      await onSearch(query, isNaturalLanguage);
    } catch (error) {
      console.error('Search error:', error);

      // Provide more specific error messages based on error type
      let errorMessage = 'Failed to search receipts';

      if (error instanceof Error) {
        errorMessage = error.message;

        // Check for common error patterns
        if (errorMessage.includes('Failed to send a request to the Edge Function')) {
          errorMessage = 'Unable to connect to the search service. Please check if the function is deployed and configured correctly.';
        } else if (errorMessage.includes('OPENAI_API_KEY')) {
          errorMessage = 'Missing OpenAI API key. Please set the OPENAI_API_KEY environment variable in Supabase.';
        } else if (errorMessage.includes('FunctionInvocationError')) {
          errorMessage = 'Error in the search function. Check function logs for details.';
        }
      }

      toast({
        title: 'Search error',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative flex flex-col md:flex-row gap-2 ${className}`}
    >
      <div className="relative flex-1 w-full">
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pr-10 py-4 md:py-6 text-base w-full"
          disabled={isLoading}
        />
        <div className="absolute right-3 top-2.5 flex space-x-1 items-center">
          {isLoading ? (
            <Spinner className="h-5 w-5" />
          ) : (
            <Search className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 w-full md:w-auto">
        <Button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="whitespace-nowrap flex-1 md:flex-none"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </Button>

        <div className="flex flex-1 md:flex-none gap-1">
          <Button
            type="button"
            variant={isNaturalLanguage ? "default" : "outline"}
            onClick={() => setIsNaturalLanguage(true)}
            className="whitespace-nowrap flex-1"
            size="sm"
            disabled={isLoading}
          >
            Natural
          </Button>

          <Button
            type="button"
            variant={!isNaturalLanguage ? "default" : "outline"}
            onClick={() => setIsNaturalLanguage(false)}
            className="whitespace-nowrap flex-1"
            size="sm"
            disabled={isLoading}
          >
            Keyword
          </Button>
        </div>
      </div>
    </form>
  );
}
