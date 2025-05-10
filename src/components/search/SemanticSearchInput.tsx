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
}

export function SemanticSearchInput({
  onSearch,
  placeholder = 'Search your receipts using natural language...',
  isLoading = false,
  className = '',
}: SemanticSearchInputProps) {
  const [query, setQuery] = useState('');
  const [isNaturalLanguage, setIsNaturalLanguage] = useState(true);

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
      className={`relative flex items-center ${className}`}
    >
      <div className="relative flex-1">
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pr-10 py-6 text-base"
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

      <div className="ml-2 flex items-center space-x-2">
        <Button 
          type="submit" 
          disabled={isLoading || !query.trim()}
          className="whitespace-nowrap"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </Button>

        <Button
          type="button"
          variant={isNaturalLanguage ? "default" : "outline"}
          onClick={() => setIsNaturalLanguage(true)}
          className="whitespace-nowrap"
          size="sm"
          disabled={isLoading}
        >
          Natural Language
        </Button>

        <Button
          type="button"
          variant={!isNaturalLanguage ? "default" : "outline"}
          onClick={() => setIsNaturalLanguage(false)}
          className="whitespace-nowrap"
          size="sm"
          disabled={isLoading}
        >
          Keyword
        </Button>
      </div>
    </form>
  );
}
