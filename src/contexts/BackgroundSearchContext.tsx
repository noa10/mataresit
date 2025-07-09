import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { UnifiedSearchParams, UnifiedSearchResponse } from '@/types/search';
import { unifiedSearch } from '@/lib/ai-search';
import { searchCache } from '@/lib/searchCache';
import { useAuth } from './AuthContext';
import {
  updateConversationSearchCache,
  getConversationSearchCache,
  updateConversationSearchStatus,
  hasValidSearchCache
} from '@/lib/conversation-history';

// Search states
export type SearchStatus = 'idle' | 'preprocessing' | 'searching' | 'complete' | 'error' | 'cached';

// Background search state
export interface BackgroundSearchState {
  // Active searches by conversation ID
  activeSearches: Map<string, {
    conversationId: string;
    query: string;
    status: SearchStatus;
    progress: string;
    startTime: number;
    searchParams?: UnifiedSearchParams;
    results?: UnifiedSearchResponse;
    error?: string;
  }>;
  
  // Completed searches cache
  completedSearches: Map<string, {
    conversationId: string;
    query: string;
    results: UnifiedSearchResponse;
    completedAt: number;
    searchParams: UnifiedSearchParams;
  }>;
  
  // Global search status for UI indicators
  hasActiveSearches: boolean;
  totalActiveSearches: number;
}

// Actions for the reducer
type BackgroundSearchAction =
  | { type: 'START_SEARCH'; payload: { conversationId: string; query: string; searchParams: UnifiedSearchParams } }
  | { type: 'UPDATE_SEARCH_STATUS'; payload: { conversationId: string; status: SearchStatus; progress?: string } }
  | { type: 'COMPLETE_SEARCH'; payload: { conversationId: string; results: UnifiedSearchResponse } }
  | { type: 'ERROR_SEARCH'; payload: { conversationId: string; error: string } }
  | { type: 'CANCEL_SEARCH'; payload: { conversationId: string } }
  | { type: 'LOAD_CACHED_SEARCH'; payload: { conversationId: string; query: string; results: UnifiedSearchResponse; searchParams: UnifiedSearchParams } }
  | { type: 'CLEAR_COMPLETED_SEARCH'; payload: { conversationId: string } }
  | { type: 'CLEANUP_OLD_SEARCHES' };

// Initial state
const initialState: BackgroundSearchState = {
  activeSearches: new Map(),
  completedSearches: new Map(),
  hasActiveSearches: false,
  totalActiveSearches: 0,
};

// Reducer
function backgroundSearchReducer(state: BackgroundSearchState, action: BackgroundSearchAction): BackgroundSearchState {
  switch (action.type) {
    case 'START_SEARCH': {
      const newActiveSearches = new Map(state.activeSearches);
      newActiveSearches.set(action.payload.conversationId, {
        conversationId: action.payload.conversationId,
        query: action.payload.query,
        status: 'preprocessing',
        progress: 'Starting search...',
        startTime: Date.now(),
        searchParams: action.payload.searchParams,
      });

      return {
        ...state,
        activeSearches: newActiveSearches,
        hasActiveSearches: true,
        totalActiveSearches: newActiveSearches.size,
      };
    }

    case 'UPDATE_SEARCH_STATUS': {
      const newActiveSearches = new Map(state.activeSearches);
      const existing = newActiveSearches.get(action.payload.conversationId);
      if (existing) {
        newActiveSearches.set(action.payload.conversationId, {
          ...existing,
          status: action.payload.status,
          progress: action.payload.progress || existing.progress,
        });
      }

      return {
        ...state,
        activeSearches: newActiveSearches,
      };
    }

    case 'COMPLETE_SEARCH': {
      const newActiveSearches = new Map(state.activeSearches);
      const newCompletedSearches = new Map(state.completedSearches);
      
      const activeSearch = newActiveSearches.get(action.payload.conversationId);
      if (activeSearch) {
        // Move from active to completed
        newCompletedSearches.set(action.payload.conversationId, {
          conversationId: action.payload.conversationId,
          query: activeSearch.query,
          results: action.payload.results,
          completedAt: Date.now(),
          searchParams: activeSearch.searchParams!,
        });
        
        newActiveSearches.delete(action.payload.conversationId);
      }

      return {
        ...state,
        activeSearches: newActiveSearches,
        completedSearches: newCompletedSearches,
        hasActiveSearches: newActiveSearches.size > 0,
        totalActiveSearches: newActiveSearches.size,
      };
    }

    case 'ERROR_SEARCH': {
      const newActiveSearches = new Map(state.activeSearches);
      const existing = newActiveSearches.get(action.payload.conversationId);
      if (existing) {
        newActiveSearches.set(action.payload.conversationId, {
          ...existing,
          status: 'error',
          error: action.payload.error,
        });
      }

      return {
        ...state,
        activeSearches: newActiveSearches,
      };
    }

    case 'CANCEL_SEARCH': {
      const newActiveSearches = new Map(state.activeSearches);
      newActiveSearches.delete(action.payload.conversationId);

      return {
        ...state,
        activeSearches: newActiveSearches,
        hasActiveSearches: newActiveSearches.size > 0,
        totalActiveSearches: newActiveSearches.size,
      };
    }

    case 'LOAD_CACHED_SEARCH': {
      const newCompletedSearches = new Map(state.completedSearches);
      newCompletedSearches.set(action.payload.conversationId, {
        conversationId: action.payload.conversationId,
        query: action.payload.query,
        results: action.payload.results,
        completedAt: Date.now(),
        searchParams: action.payload.searchParams,
      });

      return {
        ...state,
        completedSearches: newCompletedSearches,
      };
    }

    case 'CLEAR_COMPLETED_SEARCH': {
      const newCompletedSearches = new Map(state.completedSearches);
      newCompletedSearches.delete(action.payload.conversationId);

      return {
        ...state,
        completedSearches: newCompletedSearches,
      };
    }

    case 'CLEANUP_OLD_SEARCHES': {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      const newCompletedSearches = new Map(state.completedSearches);
      for (const [conversationId, search] of newCompletedSearches.entries()) {
        if (now - search.completedAt > maxAge) {
          newCompletedSearches.delete(conversationId);
        }
      }

      return {
        ...state,
        completedSearches: newCompletedSearches,
      };
    }

    default:
      return state;
  }
}

// Context interface
interface BackgroundSearchContextType {
  state: BackgroundSearchState;
  
  // Search management
  startBackgroundSearch: (conversationId: string, query: string, searchParams: UnifiedSearchParams) => Promise<void>;
  cancelSearch: (conversationId: string) => void;
  getSearchStatus: (conversationId: string) => SearchStatus;
  getSearchResults: (conversationId: string) => UnifiedSearchResponse | null;
  isSearchActive: (conversationId: string) => boolean;
  isSearchCompleted: (conversationId: string) => boolean;
  
  // Cache management
  loadCachedSearch: (conversationId: string, query: string, searchParams: UnifiedSearchParams) => Promise<boolean>;
  clearCompletedSearch: (conversationId: string) => void;
  
  // Global state
  hasActiveSearches: boolean;
  totalActiveSearches: number;
}

// Create context
const BackgroundSearchContext = createContext<BackgroundSearchContextType | undefined>(undefined);

// Provider component
export function BackgroundSearchProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(backgroundSearchReducer, initialState);
  const { user } = useAuth();
  const cleanupIntervalRef = useRef<NodeJS.Timeout>();

  // Cleanup old searches periodically
  useEffect(() => {
    cleanupIntervalRef.current = setInterval(() => {
      dispatch({ type: 'CLEANUP_OLD_SEARCHES' });
    }, 60 * 60 * 1000); // Every hour

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, []);

  // Start a background search
  const startBackgroundSearch = useCallback(async (
    conversationId: string,
    query: string,
    searchParams: UnifiedSearchParams
  ) => {
    console.log('🔍 DEBUG: BackgroundSearchContext.startBackgroundSearch called:', {
      conversationId,
      query,
      searchParams,
      hasUser: !!user,
      userId: user?.id
    });

    if (!user) {
      console.error('🔍 DEBUG: Cannot start search: user not authenticated');
      return;
    }

    // Check if search is already active
    if (state.activeSearches.has(conversationId)) {
      console.log(`🔍 DEBUG: Search already active for conversation ${conversationId}`);
      return;
    }

    // Start the search
    console.log('🔍 DEBUG: Dispatching START_SEARCH action');
    dispatch({
      type: 'START_SEARCH',
      payload: { conversationId, query, searchParams }
    });

    try {
      // Update status to searching
      console.log('🔍 DEBUG: Updating search status to searching');
      dispatch({
        type: 'UPDATE_SEARCH_STATUS',
        payload: { conversationId, status: 'searching', progress: 'Searching through your data...' }
      });

      // Perform the actual search
      console.log('🔍 DEBUG: Calling unifiedSearch with params:', searchParams);
      const results = await unifiedSearch(searchParams);

      console.log('🔍 DEBUG: unifiedSearch returned:', {
        hasResults: !!results,
        resultType: typeof results,
        success: results?.success,
        resultsLength: results?.results?.length,
        error: results?.error,
        resultKeys: results && typeof results === 'object' ? Object.keys(results) : [],
        fullResults: results // Log full results for debugging
      });

      // 🔧 DEBUG: Additional validation of results structure
      if (!results) {
        console.error('🔍 DEBUG: unifiedSearch returned null/undefined');
        throw new Error('Search returned no response');
      }

      if (typeof results !== 'object') {
        console.error('🔍 DEBUG: unifiedSearch returned non-object:', typeof results);
        throw new Error('Search returned invalid response type');
      }

      if (results.success) {
        console.log('🔍 DEBUG: Search successful, caching results');
        // Cache the results in both regular cache and conversation-specific cache
        await searchCache.setForConversation(conversationId, searchParams, user.id, results);

        // Update conversation metadata with search cache
        updateConversationSearchCache(conversationId, searchParams, results, 'completed');

        // Complete the search
        console.log('🔍 DEBUG: Dispatching COMPLETE_SEARCH action');
        dispatch({
          type: 'COMPLETE_SEARCH',
          payload: { conversationId, results }
        });

        console.log(`✅ Background search completed for conversation ${conversationId}:`, {
          resultsCount: results.results?.length || 0,
          totalResults: results.totalResults || 0,
          hasEnhancedResponse: !!results.enhancedResponse,
          searchMetadata: results.searchMetadata
        });
      } else {
        console.log('🔍 DEBUG: Search failed with error:', results.error);
        throw new Error(results.error || 'Search failed');
      }
    } catch (error) {
      console.error(`🔍 DEBUG: Background search failed for conversation ${conversationId}:`, {
        errorType: error?.constructor?.name,
        errorMessage: error?.message,
        errorStack: error?.stack
      });
      dispatch({
        type: 'ERROR_SEARCH',
        payload: {
          conversationId,
          error: error instanceof Error ? error.message : 'Search failed'
        }
      });
    }
  }, [user, state.activeSearches]);

  // Load cached search results
  const loadCachedSearch = useCallback(async (
    conversationId: string,
    query: string,
    searchParams: UnifiedSearchParams
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      // First check conversation-specific cache
      let cachedResults = await searchCache.getForConversation(conversationId, searchParams, user.id);

      // If not found, check conversation metadata cache
      if (!cachedResults) {
        const conversationCache = getConversationSearchCache(conversationId);
        if (conversationCache && conversationCache.isValid) {
          cachedResults = conversationCache.results;
          console.log(`💾 Found conversation metadata cache for ${conversationId}`);
        }
      }

      if (cachedResults) {
        dispatch({
          type: 'LOAD_CACHED_SEARCH',
          payload: { conversationId, query, results: cachedResults, searchParams }
        });

        // Update conversation status to cached
        updateConversationSearchStatus(conversationId, 'cached');

        console.log(`💾 Loaded cached search for conversation ${conversationId}`);
        return true;
      }
    } catch (error) {
      console.error('Failed to load cached search:', error);
    }

    return false;
  }, [user]);

  // Other methods
  const cancelSearch = useCallback((conversationId: string) => {
    dispatch({ type: 'CANCEL_SEARCH', payload: { conversationId } });
  }, []);

  const getSearchStatus = useCallback((conversationId: string): SearchStatus => {
    const active = state.activeSearches.get(conversationId);
    if (active) return active.status;
    
    const completed = state.completedSearches.get(conversationId);
    if (completed) return 'cached';
    
    return 'idle';
  }, [state.activeSearches, state.completedSearches]);

  const getSearchResults = useCallback((conversationId: string): UnifiedSearchResponse | null => {
    const completed = state.completedSearches.get(conversationId);
    return completed?.results || null;
  }, [state.completedSearches]);

  const isSearchActive = useCallback((conversationId: string): boolean => {
    return state.activeSearches.has(conversationId);
  }, [state.activeSearches]);

  const isSearchCompleted = useCallback((conversationId: string): boolean => {
    return state.completedSearches.has(conversationId);
  }, [state.completedSearches]);

  const clearCompletedSearch = useCallback((conversationId: string) => {
    dispatch({ type: 'CLEAR_COMPLETED_SEARCH', payload: { conversationId } });
  }, []);

  const contextValue: BackgroundSearchContextType = {
    state,
    startBackgroundSearch,
    cancelSearch,
    getSearchStatus,
    getSearchResults,
    isSearchActive,
    isSearchCompleted,
    loadCachedSearch,
    clearCompletedSearch,
    hasActiveSearches: state.hasActiveSearches,
    totalActiveSearches: state.totalActiveSearches,
  };

  return (
    <BackgroundSearchContext.Provider value={contextValue}>
      {children}
    </BackgroundSearchContext.Provider>
  );
}

// Hook to use the context
export function useBackgroundSearch() {
  const context = useContext(BackgroundSearchContext);
  if (context === undefined) {
    throw new Error('useBackgroundSearch must be used within a BackgroundSearchProvider');
  }
  return context;
}
