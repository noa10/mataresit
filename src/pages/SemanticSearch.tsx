import { useEffect, useState, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { MessageSquare, Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { semanticSearch, SearchParams, SearchResult, unifiedSearch } from '../lib/ai-search';
import { UnifiedSearchParams, UnifiedSearchResponse } from '@/types/unified-search';
import { generateIntelligentResponse, detectUserIntent } from '../lib/chat-response-generator';
import { parseNaturalLanguageQuery } from '../lib/enhanced-query-parser';
import { formatCurrencyAmount } from '../lib/currency-converter';
import { usePersonalizationContext } from '@/contexts/PersonalizationContext';
import { personalizedChatService } from '@/services/personalizedChatService';
import { conversationMemoryService } from '@/services/conversationMemoryService';
import { useBackgroundSearch } from '@/contexts/BackgroundSearchContext';
import { backgroundSearchService } from '@/services/backgroundSearchService';

import { ChatContainer } from '../components/chat/ChatContainer';
import { ChatInput } from '../components/chat/ChatInput';
import { ChatMessage } from '../components/chat/ChatMessage';
import { SidebarToggle } from '../components/chat/SidebarToggle';
import { ConversationManager } from '../components/chat/ConversationManager';
import { StatusIndicator, useStatusIndicator } from '../components/chat/StatusIndicator';
import { useChatControls } from '@/contexts/ChatControlsContext';
import { useAppSidebar } from '@/contexts/AppSidebarContext';
import { SearchPageSidebarContent } from '../components/sidebar/SearchPageSidebarContent';
import { useAuth } from '@/contexts/AuthContext';
import { BackgroundSearchIndicator, SearchProgressIndicator } from '../components/search/BackgroundSearchIndicator';
import {
  SearchStatusToastManager,
  showCacheLoadedToast,
  showBackgroundSearchToast,
  showNavigationFreedomToast
} from '../components/search/SearchStatusToast';
import {
  hasValidSearchCache,
  getConversationSearchCache,
  updateConversationSearchStatus
} from '../lib/conversation-history';

import { useSearchParams } from 'react-router-dom';
import {
  generateConversationId,
  createConversationMetadata,
  getConversation,
  StoredConversation
} from '../lib/conversation-history';
import { useConversationUpdater } from '../hooks/useConversationHistory';

export default function SemanticSearchPage() {
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSearchParams, setLastSearchParams] = useState<SearchParams | null>(null);
  const [currentOffset, setCurrentOffset] = useState(0);

  // Conversation state
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // Status indicator for real-time feedback
  const { status, updateStatus, resetStatus } = useStatusIndicator();

  // URL state management for preserving chat state (optional)
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();

  // Conversation updater for real-time updates
  const { saveConversation: saveConversationWithEvents } = useConversationUpdater();

  // Chat controls context
  const { setChatControls } = useChatControls();

  // Unified sidebar context
  const { isSidebarOpen, toggleSidebar, setSidebarContent, clearSidebarContent } = useAppSidebar();

  // Background search context
  const {
    startBackgroundSearch,
    getSearchStatus,
    getSearchResults,
    isSearchActive,
    isSearchCompleted,
    loadCachedSearch,
    hasActiveSearches
  } = useBackgroundSearch();

  // Auth context
  const { user } = useAuth();

  // Personalization context
  const {
    trackChatMessage,
    trackSearchQuery,
    getAdaptiveResponseConfig,
    profile
  } = usePersonalizationContext();

  // Refs to prevent infinite loops
  const isUpdatingUrlRef = useRef(false);
  const processedQueryRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);

  // Generate unique message ID
  const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Save current conversation with real-time updates
  const saveCurrentConversation = useCallback(() => {
    if (messages.length === 0) return;

    const conversationId = currentConversationId || generateConversationId();
    const metadata = createConversationMetadata(conversationId, messages);
    const conversation: StoredConversation = {
      metadata,
      messages
    };

    // Use the event-based saving to trigger sidebar updates
    saveConversationWithEvents(conversation);

    if (!currentConversationId) {
      setCurrentConversationId(conversationId);
      // Set flag to indicate this is a programmatic URL update
      isUpdatingUrlRef.current = true;
      setUrlSearchParams({ c: conversationId });
      // Reset flag after a brief delay to allow URL update to complete
      setTimeout(() => {
        isUpdatingUrlRef.current = false;
      }, 100);
    }
  }, [messages, currentConversationId, setUrlSearchParams, saveConversationWithEvents]);

  // Load a conversation with background search integration
  const loadConversation = useCallback(async (conversationId: string) => {
    const conversation = getConversation(conversationId);
    if (conversation) {
      setMessages(conversation.messages);
      setCurrentConversationId(conversationId);
      setLastSearchParams(null);
      setCurrentOffset(0);

      // Check if this conversation has cached search results
      if (user && conversation.messages.length > 0) {
        const lastUserMessage = conversation.messages
          .filter(m => m.type === 'user')
          .pop();

        if (lastUserMessage) {
          const searchParams = backgroundSearchService.generateSearchParams(
            lastUserMessage.content,
            conversation.messages
          );

          // Try to load cached results
          const hasCached = await loadCachedSearch(
            conversationId,
            lastUserMessage.content,
            searchParams
          );

          if (hasCached) {
            console.log(`💾 Loaded cached search results for conversation ${conversationId}`);
          }
        }
      }

      // Set flag to indicate this is a programmatic URL update
      isUpdatingUrlRef.current = true;
      setUrlSearchParams({ c: conversationId });
      // Reset flag after a brief delay to allow URL update to complete
      setTimeout(() => {
        isUpdatingUrlRef.current = false;
      }, 100);
    }
  }, [setUrlSearchParams, user, loadCachedSearch]);

  // Handle new chat
  const handleNewChat = useCallback(() => {
    // Save current conversation before starting new one
    if (messages.length > 0) {
      saveCurrentConversation();
    }

    setMessages([]);
    setCurrentConversationId(null);
    setLastSearchParams(null);
    setCurrentOffset(0);
    processedQueryRef.current = null;
    // Set flag to indicate this is a programmatic URL update
    isUpdatingUrlRef.current = true;
    setUrlSearchParams({});
    // Reset flag after a brief delay to allow URL update to complete
    setTimeout(() => {
      isUpdatingUrlRef.current = false;
    }, 100);
  }, [messages, saveCurrentConversation, setUrlSearchParams]);

  // Handle conversation selection
  const handleSelectConversation = useCallback((conversationId: string) => {
    // Save current conversation before switching
    if (messages.length > 0 && currentConversationId !== conversationId) {
      saveCurrentConversation();
    }

    loadConversation(conversationId);
  }, [messages, currentConversationId, saveCurrentConversation, loadConversation]);

  // Inject hybrid sidebar content (navigation + conversation) into the unified sidebar
  // Only when we're actually on the search route
  useEffect(() => {
    // Only set sidebar content if we're on the search route
    if (location.pathname.startsWith('/search')) {
      const sidebarContent = (
        <SearchPageSidebarContent
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          currentConversationId={currentConversationId}
        />
      );

      setSidebarContent(sidebarContent, 'conversation');
    } else {
      // Clear sidebar content if we're not on the search route
      clearSidebarContent();
    }

    // Cleanup when component unmounts or route changes
    return () => {
      clearSidebarContent();
    };
  }, [location.pathname, setSidebarContent, clearSidebarContent, handleNewChat, handleSelectConversation, currentConversationId]);

  // Set up chat controls for the navbar
  useEffect(() => {
    setChatControls({
      sidebarToggle: (
        <SidebarToggle
          isOpen={isSidebarOpen}
          onToggle={toggleSidebar}
          showKeyboardHint={true}
        />
      ),
      onNewChat: handleNewChat,
      onSelectConversation: handleSelectConversation,
      currentConversationId: currentConversationId,
      showChatTitle: true
    });

    // Cleanup when component unmounts
    return () => {
      setChatControls(null);
    };
  }, [isSidebarOpen, toggleSidebar, handleNewChat, handleSelectConversation, currentConversationId, setChatControls]);



  // Enhanced keyboard shortcuts with visual feedback
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // F6 cycles focus between nav, chat container, chat input and chat sidebar
      if (event.key === 'F6') {
        event.preventDefault();
        const order = [
          '[aria-label="Main navigation"]',
          '#chat-scroll-anchor',
          'textarea[name="chat-input"]',
          '[aria-label="Chat history sidebar"]'
        ];
        const idx = order.findIndex(sel => (document.activeElement as HTMLElement | null)?.matches?.(sel));
        const next = order[(idx + 1) % order.length];
        (document.querySelector(next) as HTMLElement | null)?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-save conversation when messages change (more aggressive for real-time updates)
  useEffect(() => {
    if (messages.length > 0) {
      // Immediate save for the first message to create the conversation
      if (messages.length === 1) {
        saveCurrentConversation();
      } else {
        // Debounced save for subsequent messages
        const timeoutId = setTimeout(saveCurrentConversation, 500);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [messages, saveCurrentConversation]);

  // Also save immediately when a new AI response is completed
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.type === 'ai') {
        // Save immediately when AI response is complete
        saveCurrentConversation();
      }
    }
  }, [isLoading, messages, saveCurrentConversation]);

  // Handle sending a new message with background search
  const handleSendMessage = async (content: string) => {
    if (!user) {
      console.error('Cannot send message: user not authenticated');
      return;
    }

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      type: 'user',
      content,
      timestamp: new Date(),
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);

    // Generate or use existing conversation ID
    const conversationId = currentConversationId || generateConversationId();
    if (!currentConversationId) {
      setCurrentConversationId(conversationId);
    }

    // Track chat message for personalization
    const startTime = Date.now();
    try {
      await trackChatMessage(content, conversationId);
    } catch (error) {
      console.error('Error tracking chat message:', error);
    }

    // Update status to show we're starting to process
    updateStatus('preprocessing', 'Understanding your question...');

    try {
      // First check for special intents (help, greetings, etc.)
      const intentCheck = detectUserIntent(content);
      if (intentCheck.intent !== 'search' && intentCheck.response) {
        const aiMessage: ChatMessage = {
          id: generateMessageId(),
          type: 'ai',
          content: intentCheck.response,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, aiMessage]);
        setIsLoading(false);
        resetStatus();
        return;
      }

      // Check if this is a "show more" request
      const isShowMoreRequest = /\b(show\s+more|more\s+results|load\s+more|see\s+more|additional\s+results)\b/i.test(content);

      // 🔍 DEBUG: Add comprehensive logging for monetary queries
      console.log('🔍 DEBUG: Chat message received:', {
        content,
        isShowMoreRequest,
        timestamp: new Date().toISOString()
      });

      // Check if this looks like a monetary query
      const monetaryPatterns = [
        /\b(over|above|more\s+than|greater\s+than)\s*(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)/i,
        /\b(under|below|less\s+than|cheaper\s+than)\s*(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)/i,
        /\b(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)\s*(?:to|[-–])\s*(\$|rm|myr)?\s*(\d+(?:\.\d{2})?)/i
      ];

      const isMonetaryQuery = monetaryPatterns.some(pattern => pattern.test(content));
      console.log('💰 DEBUG: Monetary query detection:', {
        isMonetaryQuery,
        content,
        patterns: monetaryPatterns.map(p => p.source)
      });

      let params: SearchParams;
      let results: SearchResult;
      let parsedQuery: any = null;

      if (isShowMoreRequest && lastSearchParams) {
        // Use previous search parameters with increased offset
        const newOffset = currentOffset + 10;
        params = {
          ...lastSearchParams,
          offset: newOffset
        };

        results = await semanticSearch(params);
        setCurrentOffset(newOffset);

        // If we got results, merge them with a special response
        if (results.results && results.results.length > 0) {
          const aiMessage: ChatMessage = {
            id: generateMessageId(),
            type: 'ai',
            content: `Here are ${results.results.length} additional results:`,
            timestamp: new Date(),
            searchResults: results,
          };

          setMessages(prev => [...prev, aiMessage]);
          setIsLoading(false);
          return;
        } else {
          // No more results
          const aiMessage: ChatMessage = {
            id: generateMessageId(),
            type: 'ai',
            content: "I've shown you all the available results for your previous search. Try a new search query to find different items.",
            timestamp: new Date(),
          };

          setMessages(prev => [...prev, aiMessage]);
          setIsLoading(false);
          return;
        }
      } else {
        // Regular new search - use unified search with enhanced query parsing
        console.log('🔍 Parsing natural language query:', content);

        // Parse the natural language query to extract filters
        parsedQuery = parseNaturalLanguageQuery(content);
        console.log('📊 Parsed query result:', parsedQuery);

        // Convert parsed amount range to unified search filters
        const filters: any = {};

        if (parsedQuery.amountRange) {
          console.log('💰 DEBUG: Amount range detected in SemanticSearch:', {
            amountRange: parsedQuery.amountRange,
            min: parsedQuery.amountRange.min,
            max: parsedQuery.amountRange.max,
            minType: typeof parsedQuery.amountRange.min,
            maxType: typeof parsedQuery.amountRange.max
          });

          // The enhanced query parser now handles currency conversion automatically
          const { min, max, currency, conversionInfo } = parsedQuery.amountRange;

          // Log conversion details if available
          if (conversionInfo && conversionInfo.conversionApplied) {
            console.log(`💱 Currency conversion applied: ${conversionInfo.reasoning}`);
            console.log(`💱 Exchange rate: ${conversionInfo.exchangeRate}`);
          }

          filters.amountRange = {
            min: min || 0,
            max: max || Number.MAX_SAFE_INTEGER,
            currency: currency || 'MYR'
          };

          console.log('💰 DEBUG: Applied amount range to unified search filters:', {
            filters: filters.amountRange,
            minType: typeof filters.amountRange.min,
            maxType: typeof filters.amountRange.max
          });
        }

        if (parsedQuery.dateRange) {
          filters.dateRange = parsedQuery.dateRange;
        }

        if (parsedQuery.merchants && parsedQuery.merchants.length > 0) {
          filters.merchants = parsedQuery.merchants;
        }

        if (parsedQuery.categories && parsedQuery.categories.length > 0) {
          filters.categories = parsedQuery.categories;
        }

        const unifiedParams: UnifiedSearchParams = {
          query: content,
          sources: ['receipts', 'business_directory'], // Default sources
          limit: 10,
          offset: 0,
          filters,
          similarityThreshold: 0.2,
          includeMetadata: true,
          aggregationMode: 'relevance'
        };

        console.log('🚀 Unified search params with filters:', unifiedParams);

        try {
          // Check if we already have cached results for this conversation
          let cachedResults = getSearchResults(conversationId);

          // If not in background search context, check conversation cache
          if (!cachedResults && hasValidSearchCache(conversationId)) {
            const conversationCache = getConversationSearchCache(conversationId);
            if (conversationCache && conversationCache.isValid) {
              cachedResults = conversationCache.results;
              console.log(`💾 Using conversation cache for ${conversationId}`);
            }
          }

          if (cachedResults) {
            console.log(`💾 Using cached search results for conversation ${conversationId}`);
            updateStatus('cached', 'Loading cached results...');
            updateConversationSearchStatus(conversationId, 'cached');

            // Show cache loaded toast
            showCacheLoadedToast(cachedResults.results.length, conversationId);

            // Process cached results immediately
            const results = {
              results: cachedResults.results.map(result => ({
                id: result.sourceId,
                merchant: result.title,
                date: result.metadata?.date || result.createdAt,
                total: result.metadata?.total || 0,
                total_amount: result.metadata?.total || 0,
                currency: result.metadata?.currency || 'MYR',
                similarity_score: result.similarity,
                predicted_category: result.metadata?.predicted_category,
                fullText: result.content,
                ...(result.metadata || {})
              })),
              count: cachedResults.results.length,
              total: cachedResults.totalResults,
              searchParams: {
                query: content,
                isNaturalLanguage: true,
                limit: 10,
                offset: 0,
                searchTarget: 'all'
              },
              searchMetadata: cachedResults.searchMetadata
            };

            // Generate AI response immediately
            const aiResponse = await generateIntelligentResponse(results, content, messages);
            const aiMessage: ChatMessage = {
              id: generateMessageId(),
              type: 'ai',
              content: aiResponse,
              timestamp: new Date(),
              searchResults: results,
            };

            setMessages(prev => [...prev, aiMessage]);
            updateStatus('complete', 'Cached results loaded successfully');
            return;
          }

          // Add enhanced prompting for better LLM preprocessing
          const enhancedParams = {
            ...unifiedParams,
            useEnhancedPrompting: true,
            conversationHistory: messages.slice(-5).map(m => m.content), // Last 5 messages for context
          };

          // Start background search
          console.log(`🚀 Starting background search for conversation ${conversationId}`);
          updateConversationSearchStatus(conversationId, 'processing');

          // Show background search toast
          showBackgroundSearchToast(conversationId);
          showNavigationFreedomToast();

          // Start the background search (non-blocking)
          startBackgroundSearch(conversationId, content, enhancedParams)
            .then(async (searchResults) => {
              // Process results when search completes
              const results = {
                results: searchResults.results.map(result => ({
                  id: result.sourceId,
                  merchant: result.title,
                  date: result.metadata?.date || result.createdAt,
                  total: result.metadata?.total || 0,
                  total_amount: result.metadata?.total || 0,
                  currency: result.metadata?.currency || 'MYR',
                  similarity_score: result.similarity,
                  predicted_category: result.metadata?.predicted_category,
                  fullText: result.content,
                  ...(result.metadata || {})
                })),
                count: searchResults.results.length,
                total: searchResults.totalResults,
                searchParams: {
                  query: content,
                  isNaturalLanguage: true,
                  limit: 10,
                  offset: 0,
                  searchTarget: 'all'
                },
                searchMetadata: searchResults.searchMetadata
              };

              // Generate AI response
              const aiResponse = await generateIntelligentResponse(results, content, messages);
              const aiMessage: ChatMessage = {
                id: generateMessageId(),
                type: 'ai',
                content: aiResponse,
                timestamp: new Date(),
                searchResults: results,
              };

              setMessages(prev => [...prev, aiMessage]);
              updateStatus('complete', 'Search completed successfully');
              updateConversationSearchStatus(conversationId, 'completed');
            })
            .catch((error) => {
              console.error('Background search failed:', error);
              updateStatus('error', 'Search failed', 'Please try again or rephrase your question');
              updateConversationSearchStatus(conversationId, 'error');

              // Generate error response
              const errorMessage: ChatMessage = {
                id: generateMessageId(),
                type: 'ai',
                content: "I'm sorry, I encountered an error while searching your receipts. Please try again or rephrase your question.",
                timestamp: new Date(),
              };

              setMessages(prev => [...prev, errorMessage]);
            });

          // Update status to show search is in progress
          updateStatus('searching', 'Searching through your data...');

          // Don't block - user can navigate freely while search runs in background
          console.log(`✅ Background search initiated for conversation ${conversationId}`);

          // Return early - background search is now handling everything
          return;
        } catch (error) {
          console.error('Error in search setup:', error);
          updateStatus('error', 'Failed to start search', 'Please try again');

          // Generate error message for search setup failure
          const errorMessage: ChatMessage = {
            id: generateMessageId(),
            type: 'ai',
            content: "I'm sorry, I encountered an error while setting up the search. Please try again.",
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      } // Close the inner try block that started at line 482
    } catch (error) {
      console.error('Search error:', error);

      // Update status to show error
      updateStatus('error', 'Something went wrong', 'Please try again or rephrase your question');

      // Generate contextual error message
      let errorContent = "I'm sorry, I encountered an error while searching your receipts.";

      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          errorContent = "I'm having trouble connecting to search your receipts. Please check your internet connection and try again.";
        } else if (error.message.includes('timeout')) {
          errorContent = "The search is taking longer than expected. Please try a simpler query or try again in a moment.";
        } else if (error.message.includes('GEMINI_API_KEY')) {
          errorContent = "I'm having trouble with my AI processing. Please try again, or contact support if the issue persists.";
        }
      }

      errorContent += " You can also try:\n• Using simpler search terms\n• Checking spelling\n• Asking for help with 'how do I search?'";

      const errorMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'ai',
        content: errorContent,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);

      // Reset status after a brief delay to show completion
      setTimeout(() => {
        resetStatus();
      }, 2000);
    }
  };

  // Handle example clicks from welcome screen
  const handleExampleClick = (example: string) => {
    handleSendMessage(example);
  };

  // Handle message actions
  const handleCopy = (content: string) => {
    console.log('Copied:', content);
  };

  const handleFeedback = (messageId: string, feedback: 'positive' | 'negative') => {
    console.log('Feedback:', messageId, feedback);
    // TODO: Implement feedback storage/analytics
  };

  // Initialize from URL if there's a query parameter (after all functions are defined)
  // Modified to prevent navigation locks during background search
  useEffect(() => {
    // Skip if this is a programmatic URL update from within the component
    if (isUpdatingUrlRef.current) {
      return;
    }

    const query = urlSearchParams.get('q');
    const conversationId = urlSearchParams.get('c');

    // Only process on initial load - don't re-trigger searches on navigation back
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;

      if (conversationId) {
        loadConversation(conversationId);
      } else if (query && query !== processedQueryRef.current) {
        processedQueryRef.current = query;
        handleSendMessage(query);
      }
    } else {
      // For subsequent URL changes, only load conversations, don't re-trigger searches
      if (conversationId && conversationId !== currentConversationId) {
        loadConversation(conversationId);
      }
      // Removed automatic search re-triggering to prevent navigation locks
    }
  }, [loadConversation, urlSearchParams, currentConversationId]); // Removed handleSendMessage dependency



  return (
    <div className="min-h-screen bg-background">
      {/* Search Status Toast Manager */}
      <SearchStatusToastManager />

      <Helmet>
        <title>AI Chat - Mataresit</title>
      </Helmet>



      {/* Chat Content Area - Optimized for fixed input */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Chat Container with dynamic centering and bottom padding for fixed input */}
        <div className={`flex-1 overflow-hidden transition-all duration-300 ease-in-out ${
          isSidebarOpen
            ? 'px-4 sm:px-6' // Responsive padding when sidebar is open
            : 'px-4 sm:px-6 lg:px-8 xl:px-12' // Progressive padding when sidebar is closed for better centering
        }`}>
          <div className={`h-full mx-auto transition-all duration-300 ease-in-out ${
            isSidebarOpen
              ? 'max-w-6xl lg:max-w-5xl' // Responsive width when sidebar is open
              : 'max-w-4xl lg:max-w-3xl xl:max-w-4xl' // Optimal responsive width when sidebar is closed
          }`}>
            {/* Enhanced search status indicators */}
            {currentConversationId && (
              <div className="mb-6 space-y-3">
                <BackgroundSearchIndicator
                  conversationId={currentConversationId}
                  variant="detailed"
                  showTimestamp={true}
                  className="justify-center"
                />
                <SearchProgressIndicator
                  conversationId={currentConversationId}
                  className="max-w-md mx-auto"
                />
              </div>
            )}

            <ChatContainer
              messages={messages}
              isLoading={isLoading}
              status={status}
              conversationId={currentConversationId || undefined}
              onExampleClick={handleExampleClick}
              onCopy={handleCopy}
              onFeedback={handleFeedback}
              sidebarOpen={isSidebarOpen}
            />
          </div>
        </div>
      </div>

      {/* Fixed Chat Input at bottom of viewport */}
      <div
        className="fixed bottom-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300 ease-in-out shadow-lg fixed-chat-input"
      >
        <div className={`transition-all duration-300 ease-in-out ${
          isSidebarOpen
            ? 'px-4 sm:px-6' // Responsive padding when sidebar is open
            : 'px-4 sm:px-6 lg:px-8 xl:px-12' // Progressive padding when sidebar is closed
        }`}>
          <div className={`mx-auto py-4 transition-all duration-300 ease-in-out ${
            isSidebarOpen
              ? 'max-w-6xl lg:max-w-5xl' // Responsive width when sidebar is open
              : 'max-w-4xl lg:max-w-3xl xl:max-w-4xl' // Optimal responsive width when sidebar is closed
          }`}>
            <ChatInput
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              placeholder="Ask about your receipts..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
