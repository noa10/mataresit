import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  X,
  User,
  Mail,
  Crown,
  Shield,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { TeamMemberRole, EnhancedMemberSearchResult } from '@/types/team';
import { useTeam } from '@/contexts/TeamContext';
import { enhancedTeamService } from '@/services/enhancedTeamService';
import { preferenceLearningService } from '@/services/preferenceLearningService';

interface MemberSuggestion {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: TeamMemberRole;
  type: 'member' | 'recent_search' | 'suggestion';
  relevance_score?: number;
}

interface AdvancedMemberSearchInputProps {
  onSearch: (query: string, suggestions?: MemberSuggestion[]) => void;
  onMemberSelect?: (member: MemberSuggestion) => void;
  placeholder?: string;
  isLoading?: boolean;
  showSuggestions?: boolean;
  className?: string;
}

export function AdvancedMemberSearchInput({
  onSearch,
  onMemberSelect,
  placeholder = 'Search team members...',
  isLoading = false,
  showSuggestions = true,
  className
}: AdvancedMemberSearchInputProps) {
  const { currentTeam } = useTeam();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MemberSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  // Load recent searches from localStorage and user preferences
  useEffect(() => {
    loadRecentSearches();
  }, []);

  const loadRecentSearches = async () => {
    try {
      // Load from localStorage
      const localSearches = localStorage.getItem('mataresit-member-searches');
      if (localSearches) {
        setRecentSearches(JSON.parse(localSearches));
      }

      // Load from user preferences
      const preferences = await preferenceLearningService.getUserPreferences('search_behavior', 0.3);
      const searchPrefs = preferences.find(p => p.preference_key === 'recent_member_searches');
      if (searchPrefs?.preference_value?.searches) {
        setRecentSearches(prev => [
          ...new Set([...prev, ...searchPrefs.preference_value.searches])
        ].slice(0, 10));
      }
    } catch (error) {
      console.warn('Failed to load recent searches:', error);
    }
  };

  const saveRecentSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    const updated = [
      searchQuery,
      ...recentSearches.filter(s => s !== searchQuery)
    ].slice(0, 10);
    
    setRecentSearches(updated);
    localStorage.setItem('mataresit-member-searches', JSON.stringify(updated));

    // Save to user preferences
    try {
      await preferenceLearningService.setUserPreference(
        'search_behavior',
        'recent_member_searches',
        { searches: updated },
        0.8,
        'behavioral_analysis'
      );
    } catch (error) {
      console.warn('Failed to save search preference:', error);
    }
  };

  // Debounced search for autocomplete suggestions
  const debouncedSearch = useCallback(async (searchQuery: string) => {
    if (!currentTeam?.id || !searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoadingSuggestions(true);
    
    try {
      const response = await enhancedTeamService.searchMembersAdvanced({
        team_id: currentTeam.id,
        search_query: searchQuery,
        limit: 8,
        offset: 0
      });

      if (response.success && response.data?.members) {
        const memberSuggestions: MemberSuggestion[] = response.data.members.map((member: EnhancedMemberSearchResult) => ({
          id: member.id,
          user_id: member.user_id,
          full_name: member.full_name,
          email: member.email,
          role: member.role,
          type: 'member' as const,
          relevance_score: member.activity_metrics?.activity_score || 0
        }));

        setSuggestions(memberSuggestions);
      }
    } catch (error) {
      console.error('Failed to fetch member suggestions:', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [currentTeam?.id]);

  // Handle input change with debouncing
  const handleInputChange = (value: string) => {
    setQuery(value);
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      if (showSuggestions) {
        debouncedSearch(value);
      }
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    try {
      await onSearch(query.trim(), suggestions);
      await saveRecentSearch(query.trim());
      setSuggestionsOpen(false);

      // Track search interaction
      await preferenceLearningService.trackInteraction(
        'search_query',
        {
          query: query.trim(),
          search_type: 'member_search',
          team_id: currentTeam?.id,
          suggestions_count: suggestions.length
        }
      );
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed. Please try again.');
    }
  };

  const handleSuggestionSelect = async (suggestion: MemberSuggestion) => {
    setQuery(suggestion.full_name);
    setSuggestionsOpen(false);
    
    if (onMemberSelect) {
      onMemberSelect(suggestion);
    }

    // Track suggestion selection
    await preferenceLearningService.trackInteraction(
      'ui_action',
      {
        action: 'member_suggestion_selected',
        member_id: suggestion.user_id,
        suggestion_type: suggestion.type,
        team_id: currentTeam?.id
      }
    );
  };

  const handleRecentSearchSelect = (searchQuery: string) => {
    setQuery(searchQuery);
    setSuggestionsOpen(false);
    onSearch(searchQuery);
  };

  const getRoleIcon = (role: TeamMemberRole) => {
    switch (role) {
      case 'owner': return <Crown className="h-3 w-3" />;
      case 'admin': return <Shield className="h-3 w-3" />;
      case 'member': return <User className="h-3 w-3" />;
      case 'viewer': return <Eye className="h-3 w-3" />;
      default: return <User className="h-3 w-3" />;
    }
  };

  const clearSearch = () => {
    setQuery('');
    setSuggestions([]);
    setSuggestionsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className={cn("relative", className)}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setSuggestionsOpen(true)}
            className="pl-10 pr-20 h-11 text-base"
            disabled={isLoading}
          />
          
          {/* Clear button */}
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="absolute right-12 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          
          {/* Search button */}
          <Button
            type="submit"
            size="sm"
            disabled={isLoading || !query.trim()}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Search className="h-3 w-3" />
            )}
          </Button>
        </div>
      </form>

      {/* Suggestions Popover */}
      {showSuggestions && suggestionsOpen && (query.length >= 2 || recentSearches.length > 0) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1">
          <div className="bg-popover border rounded-md shadow-md max-h-80 overflow-hidden">
            <Command>
              <CommandList>
                {/* Loading state */}
                {isLoadingSuggestions && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Searching members...</span>
                  </div>
                )}

                {/* Member suggestions */}
                {suggestions.length > 0 && (
                  <CommandGroup heading="Team Members">
                    {suggestions.map((suggestion) => (
                      <CommandItem
                        key={suggestion.id}
                        onSelect={() => handleSuggestionSelect(suggestion)}
                        className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          {getRoleIcon(suggestion.role)}
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{suggestion.full_name}</div>
                          <div className="text-sm text-muted-foreground truncate flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {suggestion.email}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {suggestion.role}
                        </Badge>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {/* Recent searches */}
                {recentSearches.length > 0 && query.length < 2 && (
                  <CommandGroup heading="Recent Searches">
                    {recentSearches.slice(0, 5).map((search, index) => (
                      <CommandItem
                        key={index}
                        onSelect={() => handleRecentSearchSelect(search)}
                        className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                      >
                        <History className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 truncate">{search}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {/* Empty state */}
                {!isLoadingSuggestions && suggestions.length === 0 && query.length >= 2 && (
                  <CommandEmpty>
                    <div className="flex flex-col items-center gap-2 py-4">
                      <User className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No members found</p>
                      <p className="text-xs text-muted-foreground">Try a different search term</p>
                    </div>
                  </CommandEmpty>
                )}
              </CommandList>
            </Command>
          </div>
        </div>
      )}
    </div>
  );
}
