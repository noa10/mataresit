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

import { ChatContainer } from '../components/chat/ChatContainer';
import { ChatInput } from '../components/chat/ChatInput';
import { ChatMessage } from '../components/chat/ChatMessage';
import { SidebarToggle } from '../components/chat/SidebarToggle';
import { ConversationManager } from '../components/chat/ConversationManager';
import { StatusIndicator, useStatusIndicator } from '../components/chat/StatusIndicator';
import { useChatControls } from '@/contexts/ChatControlsContext';
import { useAppSidebar } from '@/contexts/AppSidebarContext';
import { SearchPageSidebarContent } from '../components/sidebar/SearchPageSidebarContent';

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

  // Load a conversation
  const loadConversation = useCallback((conversationId: string) => {
    const conversation = getConversation(conversationId);
    if (conversation) {
      setMessages(conversation.messages);
      setCurrentConversationId(conversationId);
      setLastSearchParams(null);
      setCurrentOffset(0);
      // Set flag to indicate this is a programmatic URL update
      isUpdatingUrlRef.current = true;
      setUrlSearchParams({ c: conversationId });
      // Reset flag after a brief delay to allow URL update to complete
      setTimeout(() => {
        isUpdatingUrlRef.current = false;
      }, 100);
    }
  }, [setUrlSearchParams]);

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
      showChatTitle: true
    });

    // Cleanup when component unmounts
    return () => {
      setChatControls(null);
    };
  }, [isSidebarOpen, toggleSidebar, handleNewChat, setChatControls]);



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

  // Handle sending a new message
  const handleSendMessage = async (content: string) => {
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      type: 'user',
      content,
      timestamp: new Date(),
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Track chat message for personalization
    const startTime = Date.now();
    try {
      await trackChatMessage(content, currentConversationId);
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
          // Update status to show we're searching
          updateStatus('searching', 'Searching through your data...');

          // Add enhanced prompting for better LLM preprocessing
          const enhancedParams = {
            ...unifiedParams,
            useEnhancedPrompting: true,
            conversationHistory: messages.slice(-5).map(m => m.content), // Last 5 messages for context
          };

          console.log('🚀 CHAT: Calling unified-search Edge Function with enhanced params:', {
            enhancedParams,
            hasAmountRange: !!enhancedParams.filters?.amountRange,
            amountRangeDetails: enhancedParams.filters?.amountRange
          });

          console.log('🔍 CHAT: About to call unifiedSearch function...');
          console.log('🔍 CHAT: Enhanced params being sent:', JSON.stringify(enhancedParams, null, 2));

          const unifiedResponse = await unifiedSearch(enhancedParams);

          console.log('🔍 CHAT: unifiedSearch function returned:', {
            success: unifiedResponse?.success,
            hasResults: !!unifiedResponse?.results,
            resultCount: unifiedResponse?.results?.length || 0,
            error: unifiedResponse?.error,
            fullResponse: unifiedResponse
          });

          console.log('📊 CHAT: Unified-search response received:', {
            success: unifiedResponse.success,
            resultsCount: unifiedResponse.results?.length || 0,
            totalResults: unifiedResponse.totalResults,
            searchMetadata: unifiedResponse.searchMetadata,
            sampleResults: unifiedResponse.results?.slice(0, 3).map(r => ({
              id: r.sourceId,
              title: r.title,
              total: r.metadata?.total,
              source: r.source
            }))
          });

          if (unifiedResponse.success) {
            // 🔧 IMPROVED: Better conversion from unified response to chat display format
            results = {
              results: unifiedResponse.results.map(result => ({
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
              count: unifiedResponse.results.length,
              total: unifiedResponse.totalResults,
              searchParams: {
                query: content,
                isNaturalLanguage: true,
                limit: 10,
                offset: 0,
                searchTarget: 'all'
              },
              searchMetadata: unifiedResponse.searchMetadata
            };

            console.log('✅ CHAT: Successfully processed unified-search results:', {
              resultsCount: results.count,
              totalResults: results.total,
              hasMetadata: !!results.searchMetadata
            });
          } else {
            throw new Error(unifiedResponse.error || 'Unified search failed');
          }
        } catch (unifiedError) {
          console.error('❌ CHAT: Unified-search failed:', unifiedError);
          console.error('❌ CHAT: Error details:', {
            message: unifiedError?.message || 'No message',
            stack: unifiedError?.stack || 'No stack',
            name: unifiedError?.name || 'No name',
            cause: unifiedError?.cause || 'No cause',
            toString: unifiedError?.toString() || 'No toString',
            errorType: typeof unifiedError,
            errorConstructor: unifiedError?.constructor?.name || 'Unknown'
          });

          // 🔄 SELECTIVE FALLBACK: Only fall back to ai-search.ts for specific error types
          const errorMessage = unifiedError?.message || unifiedError?.toString() || 'Unknown error';
          const isAuthError = errorMessage.includes('authentication') ||
                             errorMessage.includes('Invalid authentication token') ||
                             errorMessage.includes('401');
          const isCorsError = errorMessage.includes('CORS') ||
                             errorMessage.includes('Failed to fetch') ||
                             errorMessage.includes('Network error');

          console.log('🔍 CHAT: Error type analysis:', {
            isAuthError,
            isCorsError,
            errorMessage,
            willFallback: isAuthError || isCorsError,
            errorStringified: JSON.stringify(unifiedError, null, 2)
          });

          if (isAuthError || isCorsError) {
            console.log('🔄 CHAT: Falling back to ai-search.ts due to:', isAuthError ? 'auth error' : 'CORS error');

            // Fallback to legacy search with parsed query filters applied
            params = {
              query: content,
              isNaturalLanguage: true,
              limit: 10,
              offset: 0,
              searchTarget: 'all'
            };

          // Apply parsed query filters to legacy search if available
          if (parsedQuery?.amountRange) {
            console.log('💰 DEBUG: Parsed amount range for legacy search:', {
              amountRange: parsedQuery.amountRange,
              min: parsedQuery.amountRange.min,
              max: parsedQuery.amountRange.max,
              minType: typeof parsedQuery.amountRange.min,
              maxType: typeof parsedQuery.amountRange.max
            });
            params.minAmount = parsedQuery.amountRange.min;
            params.maxAmount = parsedQuery.amountRange.max;
            console.log('💰 Applied amount range to legacy search params:', {
              minAmount: params.minAmount,
              maxAmount: params.maxAmount
            });
          }

          if (parsedQuery?.dateRange) {
            console.log('📅 Applying date range to legacy search:', parsedQuery.dateRange);
            params.startDate = parsedQuery.dateRange.start;
            params.endDate = parsedQuery.dateRange.end;
          }

          if (parsedQuery?.merchants && parsedQuery.merchants.length > 0) {
            console.log('🏪 Applying merchants to legacy search:', parsedQuery.merchants);
            params.merchants = parsedQuery.merchants;
          }

          if (parsedQuery?.categories && parsedQuery.categories.length > 0) {
            console.log('📂 CHAT: Applying categories to fallback search:', parsedQuery.categories);
            params.categories = parsedQuery.categories;
          }

          results = await semanticSearch(params);
          } else {
            // For other errors, don't fall back - let the user know there's an issue
            throw unifiedError;
          }
        }

        setLastSearchParams(params || {
          query: content,
          isNaturalLanguage: true,
          limit: 10,
          offset: 0,
          searchTarget: 'all'
        });
        setCurrentOffset(0);
      }

      // Update status to show we're generating response
      updateStatus('generating', 'Generating personalized response...');

      // Generate personalized response using the personalization service
      let responseContent: string;
      try {
        responseContent = await personalizedChatService.generatePersonalizedResponse(
          content,
          results,
          currentConversationId
        );

        // Enhance response with filter information if amount filtering was applied
        // Check both parsedQuery (from unified search) and searchMetadata (from fallback search)
        const amountRange = parsedQuery?.amountRange || results.searchMetadata?.monetaryFilter;

        if (amountRange) {
          const { min, max, originalAmount, originalCurrency, conversionInfo } = amountRange;
          const filterInfo = [];

          // Use original currency for user-friendly display
          const displayCurrency = originalCurrency || 'MYR';
          const displayMin = originalAmount || min;
          const displayMax = amountRange.originalMaxAmount || max;

          if (min !== undefined && min > 0) {
            const displayAmount = formatCurrencyAmount({ amount: displayMin, currency: displayCurrency });
            filterInfo.push(`over ${displayAmount}`);
          }
          if (max !== undefined && max < Number.MAX_SAFE_INTEGER) {
            const displayAmount = formatCurrencyAmount({ amount: displayMax, currency: displayCurrency });
            filterInfo.push(`under ${displayAmount}`);
          }

          if (filterInfo.length > 0) {
            const filterText = filterInfo.join(' and ');
            let enhancedResponse = responseContent.replace(
              /I found (\d+) receipts?/i,
              `I found $1 receipts ${filterText}`
            );

            // Also enhance "couldn't find" responses
            enhancedResponse = enhancedResponse.replace(
              /I couldn't find any receipts matching/i,
              `I couldn't find any receipts ${filterText} matching`
            );

            // Add conversion note if currency conversion was applied
            if (conversionInfo && conversionInfo.conversionApplied) {
              enhancedResponse += `\n\n*Note: Converted to ${formatCurrencyAmount(conversionInfo.convertedAmount)} for database search.*`;
            }

            responseContent = enhancedResponse;
            console.log('💰 Enhanced response with monetary filter information:', { filterText, amountRange });
          }
        }

      } catch (error) {
        console.error('Error generating personalized response:', error);
        // Fallback to standard response generation with monetary filter support
        // Check both parsedQuery and searchMetadata for monetary filter information
        const amountRange = parsedQuery?.amountRange || results.searchMetadata?.monetaryFilter;
        const monetaryFilter = amountRange ? {
          min: amountRange.min,
          max: amountRange.max,
          currency: amountRange.currency,
          originalAmount: amountRange.originalAmount,
          originalMaxAmount: amountRange.originalMaxAmount,
          originalCurrency: amountRange.originalCurrency,
          conversionInfo: amountRange.conversionInfo
        } : undefined;

        responseContent = generateIntelligentResponse(results, content, monetaryFilter);
        console.log('💰 Using fallback response generation with monetary filter:', monetaryFilter);
      }

      // Add UI components from search metadata if available
      if (results.searchMetadata?.uiComponents && results.searchMetadata.uiComponents.length > 0) {
        // Append UI component JSON blocks to the response content
        for (const component of results.searchMetadata.uiComponents) {
          responseContent += `\n\n\`\`\`ui_component\n${JSON.stringify(component, null, 2)}\n\`\`\``;
        }
      }

      const aiMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'ai',
        content: responseContent,
        timestamp: new Date(),
        searchResults: results,
      };

      setMessages(prev => [...prev, aiMessage]);

      // Save conversation memory for personalization
      try {
        await conversationMemoryService.saveMemory(
          'conversation_turn',
          `${userMessage.id}_${aiMessage.id}`,
          {
            user_message: content,
            ai_response: responseContent,
            search_results_count: results.results?.length || 0,
            timestamp: new Date().toISOString()
          },
          0.8, // High confidence for actual conversations
          currentConversationId
        );
      } catch (error) {
        console.error('Error saving conversation memory:', error);
      }

      // Track search query for analytics
      try {
        await trackSearchQuery(
          content,
          'semantic',
          results.results?.length || 0
        );
      } catch (error) {
        console.error('Error tracking search query:', error);
      }

      // Calculate response time for analytics
      const responseTime = Date.now() - startTime;

      // Update status to complete
      updateStatus('complete', 'Response generated successfully');

      // If there are more results available, add a system message about it
      if (results.results && results.total && results.results.length < results.total) {
        const moreResultsMessage: ChatMessage = {
          id: generateMessageId(),
          type: 'system',
          content: `Showing ${results.results.length} of ${results.total} results. Ask me to "show more results" to see additional matches.`,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, moreResultsMessage]);
      }

      // Update URL to reflect current query
      processedQueryRef.current = content;
      // Set flag to indicate this is a programmatic URL update
      isUpdatingUrlRef.current = true;
      setUrlSearchParams({ q: content });
      // Reset flag after a brief delay to allow URL update to complete
      setTimeout(() => {
        isUpdatingUrlRef.current = false;
      }, 100);

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
  useEffect(() => {
    // Skip if this is a programmatic URL update from within the component
    if (isUpdatingUrlRef.current) {
      return;
    }

    const query = urlSearchParams.get('q');
    const conversationId = urlSearchParams.get('c');

    // Only process on initial load or when URL changes externally
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;

      if (conversationId) {
        loadConversation(conversationId);
      } else if (query && query !== processedQueryRef.current) {
        processedQueryRef.current = query;
        handleSendMessage(query);
      }
    } else {
      // For subsequent URL changes, only process if it's a different query/conversation
      // and not from our own URL updates
      if (conversationId && conversationId !== currentConversationId) {
        loadConversation(conversationId);
      } else if (query && query !== processedQueryRef.current && !conversationId) {
        processedQueryRef.current = query;
        handleSendMessage(query);
      }
    }
  }, [loadConversation, handleSendMessage, urlSearchParams, currentConversationId]);



  return (
    <div className="min-h-screen bg-background">
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
