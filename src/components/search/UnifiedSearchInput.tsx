import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { 
  Search, 
  Loader2, 
  Settings,
  History,
  Sparkles,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { UnifiedSearchInputProps, UnifiedSearchParams } from '@/types/unified-search';
import { SearchTargetSelector, SearchTargetQuickSelect } from './SearchTargetSelector';
import { AdvancedFilterPanel } from './AdvancedFilterPanel';
import { defaultSearchFilters } from '@/config/search-targets';

export function UnifiedSearchInput({
  onSearch,
  searchTargets,
  filters,
  onFiltersChange,
  isLoading = false,
  placeholder = 'Search across all your data...',
  showAdvancedFilters = true,
  suggestions = [],
  className
}: UnifiedSearchInputProps) {
  const [query, setQuery] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<string[]>(['receipts', 'business_directory']);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('mataresit-recent-searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (error) {
        console.warn('Failed to load recent searches:', error);
      }
    }
  }, []);

  // Save recent searches to localStorage
  const saveRecentSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    const updated = [
      searchQuery,
      ...recentSearches.filter(s => s !== searchQuery)
    ].slice(0, 10); // Keep last 10 searches
    
    setRecentSearches(updated);
    localStorage.setItem('mataresit-recent-searches', JSON.stringify(updated));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    if (selectedTargets.length === 0) {
      toast.error('Please select at least one search target');
      return;
    }

    try {
      const searchParams: UnifiedSearchParams = {
        query: query.trim(),
        sources: selectedTargets,
        limit: 20,
        offset: 0,
        filters: {
          ...defaultSearchFilters,
          ...filters
        },
        similarityThreshold: 0.2,
        includeMetadata: true,
        aggregationMode: 'relevance'
      };

      await onSearch(searchParams);
      saveRecentSearch(query.trim());
      setSuggestionsOpen(false);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed. Please try again.');
    }
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setQuery(suggestion);
    setSuggestionsOpen(false);
    inputRef.current?.focus();
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('mataresit-recent-searches');
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.dateRange) count++;
    if (filters.amountRange) count++;
    if (filters.categories?.length) count++;
    if (filters.teamId) count++;
    return count;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search Input */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSuggestionsOpen(true)}
            className="pl-10 pr-24 h-12 text-base"
            disabled={isLoading}
          />
          
          {/* Search Button */}
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setQuery('')}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !query.trim()}
              className="h-8"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Search Suggestions Dropdown */}
        {suggestionsOpen && (query || recentSearches.length > 0 || suggestions.length > 0) && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1">
            <Command className="rounded-lg border shadow-md bg-background">
              <CommandList>
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <CommandGroup heading="Recent Searches">
                    {recentSearches.map((search, index) => (
                      <CommandItem
                        key={index}
                        onSelect={() => handleSuggestionSelect(search)}
                        className="cursor-pointer"
                      >
                        <History className="mr-2 h-4 w-4 text-muted-foreground" />
                        {search}
                      </CommandItem>
                    ))}
                    <CommandItem
                      onSelect={clearRecentSearches}
                      className="cursor-pointer text-muted-foreground"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Clear recent searches
                    </CommandItem>
                  </CommandGroup>
                )}

                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <CommandGroup heading="Suggestions">
                    {suggestions.map((suggestion) => (
                      <CommandItem
                        key={suggestion.id}
                        onSelect={() => handleSuggestionSelect(suggestion.text)}
                        className="cursor-pointer"
                      >
                        <Sparkles className="mr-2 h-4 w-4 text-muted-foreground" />
                        {suggestion.text}
                        {suggestion.metadata?.resultCount && (
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {suggestion.metadata.resultCount} results
                          </Badge>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {query && !recentSearches.includes(query) && (
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => handleSuggestionSelect(query)}
                      className="cursor-pointer"
                    >
                      <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                      Search for "{query}"
                    </CommandItem>
                  </CommandGroup>
                )}

                {!query && recentSearches.length === 0 && suggestions.length === 0 && (
                  <CommandEmpty>No suggestions available</CommandEmpty>
                )}
              </CommandList>
            </Command>
          </div>
        )}
      </form>

      {/* Search Targets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Search In:</label>
          <SearchTargetQuickSelect
            targets={searchTargets}
            selectedTargets={selectedTargets}
            onSelectionChange={setSelectedTargets}
            subscriptionTier="free" // TODO: Get from user context
          />
        </div>
        
        <SearchTargetSelector
          targets={searchTargets}
          selectedTargets={selectedTargets}
          onSelectionChange={setSelectedTargets}
          subscriptionTier="free" // TODO: Get from user context
          layout="horizontal"
        />
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
              {getActiveFilterCount() > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {getActiveFilterCount()} active
                </Badge>
              )}
            </div>
          </div>

          <AdvancedFilterPanel
            filters={filters}
            onFiltersChange={onFiltersChange}
            availableCategories={[]} // TODO: Get from context
            availableTeams={[]} // TODO: Get from context
            isOpen={filtersOpen}
            onToggle={() => setFiltersOpen(!filtersOpen)}
            subscriptionFeatures={['advanced_filters']} // TODO: Get from user context
          />
        </div>
      )}

      {/* Search Summary */}
      {selectedTargets.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Searching in {selectedTargets.length} source{selectedTargets.length !== 1 ? 's' : ''}
          {getActiveFilterCount() > 0 && ` with ${getActiveFilterCount()} filter${getActiveFilterCount() !== 1 ? 's' : ''}`}
        </div>
      )}
    </div>
  );
}

// Click outside handler for suggestions
function useClickOutside(ref: React.RefObject<HTMLElement>, handler: () => void) {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref, handler]);
}
