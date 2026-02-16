import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { 
  Search, 
  Loader2, 
  History,
  X,
  Clock,
  Sparkles,
  Keyboard
} from 'lucide-react';

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'suggested' | 'popular';
  metadata?: {
    resultCount?: number;
    lastUsed?: string;
  };
}

interface SearchInputProps {
  onSearch: (query: string) => void | Promise<void>;
  suggestions?: SearchSuggestion[];
  placeholder?: string;
  isLoading?: boolean;
  className?: string;
  autoFocus?: boolean;
  debounceMs?: number;
}

const STORAGE_KEY = 'mataresit-search-history';
const MAX_HISTORY = 10;

export function SearchInput({
  onSearch,
  suggestions = [],
  placeholder = 'Search...',
  isLoading = false,
  className,
  autoFocus = false,
  debounceMs = 300
}: SearchInputProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  const saveToHistory = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    const updated = [
      searchQuery.trim(),
      ...history.filter(h => h !== searchQuery.trim())
    ].slice(0, MAX_HISTORY);
    
    setHistory(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, [history]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const handleSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim() || isLoading) return;
    
    setQuery(searchQuery.trim());
    setIsOpen(false);
    saveToHistory(searchQuery.trim());
    
    const result = onSearch(searchQuery.trim());
    if (result instanceof Promise) {
      result.catch(console.error);
    }
  }, [onSearch, saveToHistory, isLoading]);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setHighlightedIndex(-1);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    if (value.trim()) {
      debounceRef.current = setTimeout(() => {
        setIsOpen(true);
      }, debounceMs);
    } else {
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'Enter' && query.trim()) {
        handleSearch(query);
      }
      return;
    }

    const allSuggestions = [
      ...history.map(text => ({ id: text, text, type: 'recent' as const })),
      ...suggestions
    ];

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < allSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < allSuggestions.length) {
          handleSearch(allSuggestions[highlightedIndex].text);
        } else if (query.trim()) {
          handleSearch(query);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const allSuggestions = [
    ...history.map(text => ({ id: text, text, type: 'recent' as const })),
    ...suggestions
  ];

  return (
    <div className={cn("relative w-full", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim() && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          className="pl-10 pr-20 h-10 text-sm"
          disabled={isLoading}
        />
        
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              {query && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-6 w-6 p-0 hover:bg-transparent"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Keyboard shortcut hint */}
      {!query && !isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1">
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      )}

      {/* Suggestions dropdown */}
      {isOpen && allSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1">
          <Command className="rounded-lg border shadow-md bg-background">
            <CommandList>
              {history.length > 0 && (
                <CommandGroup heading="Recent Searches">
                  {history.map((item, index) => (
                    <CommandItem
                      key={item}
                      onSelect={() => handleSearch(item)}
                      className={cn(
                        "cursor-pointer",
                        highlightedIndex === index && "bg-accent"
                      )}
                    >
                      <History className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">{item}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          const updated = history.filter(h => h !== item);
                          setHistory(updated);
                          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                        }}
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </CommandItem>
                  ))}
                  <CommandItem
                    onSelect={clearHistory}
                    className="cursor-pointer text-muted-foreground"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Clear history
                  </CommandItem>
                </CommandGroup>
              )}

              {suggestions.length > 0 && (
                <CommandGroup heading="Suggestions">
                  {suggestions.map((suggestion) => (
                    <CommandItem
                      key={suggestion.id}
                      onSelect={() => handleSearch(suggestion.text)}
                      className={cn(
                        "cursor-pointer",
                        highlightedIndex === history.length + suggestions.indexOf(suggestion) && "bg-accent"
                      )}
                    >
                      <Sparkles className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">{suggestion.text}</span>
                      {suggestion.metadata?.resultCount && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {suggestion.metadata.resultCount}
                        </Badge>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}

export function SearchHistoryChips({
  history,
  onSelect,
  onClear,
  className
}: {
  history: string[];
  onSelect: (query: string) => void;
  onClear?: () => void;
  className?: string;
}) {
  if (history.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>Recent:</span>
      </div>
      {history.slice(0, 5).map((item) => (
        <Badge
          key={item}
          variant="outline"
          className="cursor-pointer hover:bg-accent"
          onClick={() => onSelect(item)}
        >
          {item}
        </Badge>
      ))}
      {onClear && history.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-6 px-2 text-xs text-muted-foreground"
        >
          Clear
        </Button>
      )}
    </div>
  );
}
