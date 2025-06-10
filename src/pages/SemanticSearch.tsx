import { useEffect, useState, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { MessageSquare, Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { semanticSearch, SearchParams, SearchResult } from '../lib/ai-search';
import { generateIntelligentResponse, detectUserIntent } from '../lib/chat-response-generator';

import { ChatContainer } from '../components/chat/ChatContainer';
import { ChatInput } from '../components/chat/ChatInput';
import { ChatMessage } from '../components/chat/ChatMessage';
import { ConversationSidebar } from '../components/chat/ConversationSidebar';
import { SidebarToggle } from '../components/chat/SidebarToggle';
import { useChatControls } from '@/contexts/ChatControlsContext';
import { useMainNav } from '../components/AppLayout';

import { useSearchParams } from 'react-router-dom';
import {
  generateConversationId,
  createConversationMetadata,
  getConversation,
  StoredConversation
} from '../lib/conversation-history';
import { useConversationUpdater } from '../hooks/useConversationHistory';

export default function SemanticSearchPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSearchParams, setLastSearchParams] = useState<SearchParams | null>(null);
  const [currentOffset, setCurrentOffset] = useState(0);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);

  // URL state management for preserving chat state (optional)
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();

  // Conversation updater for real-time updates
  const { saveConversation: saveConversationWithEvents } = useConversationUpdater();

  // Chat controls context
  const { setChatControls } = useChatControls();

  // Main navigation context
  const { navSidebarOpen, isDesktop: isMainNavDesktop, navSidebarWidth } = useMainNav();

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

  // Enhanced sidebar handlers with focus management
  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen(prev => {
      const newState = !prev;

      // Focus management for accessibility
      if (newState && isDesktop) {
        // When opening sidebar on desktop, focus the first interactive element
        setTimeout(() => {
          const sidebar = document.querySelector('[role="complementary"]');
          const firstFocusable = sidebar?.querySelector('button, input, [tabindex]:not([tabindex="-1"])') as HTMLElement;
          firstFocusable?.focus();
        }, 300);
      } else if (!newState && !isDesktop) {
        // When closing sidebar on mobile, return focus to toggle button
        setTimeout(() => {
          const toggleButton = document.querySelector('[aria-label*="sidebar"]') as HTMLElement;
          toggleButton?.focus();
        }, 100);
      }

      return newState;
    });
  }, [isDesktop]);

  // Set up chat controls for the navbar
  useEffect(() => {
    setChatControls({
      sidebarToggle: (
        <SidebarToggle
          isOpen={sidebarOpen}
          onToggle={handleToggleSidebar}
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
  }, [sidebarOpen, handleToggleSidebar, handleNewChat, setChatControls]);

  // Initialize sidebar state based on screen size and localStorage preference
  useEffect(() => {
    const handleResize = () => {
      const isLargeScreen = window.innerWidth >= 1024;
      setIsDesktop(isLargeScreen);

      if (isLargeScreen) {
        // On large screens, check localStorage preference or default to open
        const savedState = localStorage.getItem('chat-sidebar-open');
        setSidebarOpen(savedState !== null ? savedState === 'true' : true);
      } else {
        // On mobile/tablet, always start closed
        setSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save sidebar state to localStorage when it changes (only on large screens)
  useEffect(() => {
    if (isDesktop) {
      localStorage.setItem('chat-sidebar-open', sidebarOpen.toString());
    }
  }, [sidebarOpen, isDesktop]);

  // Enhanced keyboard shortcuts with visual feedback
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+B or Cmd+B to toggle sidebar (standard shortcut)
      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        handleToggleSidebar();

        // Show visual feedback
        const feedback = document.createElement('div');
        feedback.className = 'fixed top-4 right-4 bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm font-medium z-50 animate-in fade-in slide-in-from-top-2 duration-200';
        feedback.textContent = `Sidebar ${!sidebarOpen ? 'opened' : 'closed'}`;
        document.body.appendChild(feedback);

        setTimeout(() => {
          feedback.classList.add('animate-out', 'fade-out', 'slide-out-to-top-2');
          setTimeout(() => document.body.removeChild(feedback), 200);
        }, 1500);
      }

      // Escape key to close sidebar on mobile
      if (event.key === 'Escape' && sidebarOpen && !isDesktop) {
        event.preventDefault();
        handleToggleSidebar();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen, isDesktop, handleToggleSidebar]);



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
        return;
      }

      // Check if this is a "show more" request
      const isShowMoreRequest = /\b(show\s+more|more\s+results|load\s+more|see\s+more|additional\s+results)\b/i.test(content);

      let params: SearchParams;
      let results: SearchResult;

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
        // Regular new search
        params = {
          query: content,
          isNaturalLanguage: true, // Default to natural language in chat
          limit: 10,
          offset: 0,
          searchTarget: 'all'
        };

        results = await semanticSearch(params);
        setLastSearchParams(params);
        setCurrentOffset(0);
      }

      // Create AI response message with intelligent response generation
      const aiMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'ai',
        content: generateIntelligentResponse(results, content),
        timestamp: new Date(),
        searchResults: results,
      };

      setMessages(prev => [...prev, aiMessage]);

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



  // Handle sidebar width changes
  const handleSidebarWidthChange = useCallback((width: number) => {
    setSidebarWidth(width);
  }, []);

  const handleSelectConversation = (conversationId: string) => {
    // Save current conversation before switching
    if (messages.length > 0 && currentConversationId !== conversationId) {
      saveCurrentConversation();
    }

    loadConversation(conversationId);
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
    <div className="min-h-screen bg-background flex">
      <Helmet>
        <title>AI Chat - ReceiptScan</title>
      </Helmet>

      {/* Conversation Sidebar */}
      <ConversationSidebar
        isOpen={sidebarOpen}
        onToggle={handleToggleSidebar}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        currentConversationId={currentConversationId}
        className={sidebarOpen ? "lg:relative" : ""}
        onWidthChange={handleSidebarWidthChange}
        mainNavWidth={navSidebarWidth}
        mainNavOpen={navSidebarOpen}
      />

      {/* Main Content Area */}
      <div
        className="flex-1 flex flex-col min-w-0 relative transition-all duration-300 ease-in-out"
        style={{
          marginLeft: isMainNavDesktop ?
            (sidebarOpen && isDesktop ? `${sidebarWidth}px` : '0px')
            : (sidebarOpen && isDesktop ? `${sidebarWidth}px` : '0px')
        }}
      >

        {/* Chat Content Area - Optimized for fixed input */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* Chat Container with dynamic centering and bottom padding for fixed input */}
          <div className={`flex-1 overflow-hidden transition-all duration-300 ease-in-out ${
            sidebarOpen
              ? 'px-4 sm:px-6' // Responsive padding when sidebar is open
              : 'px-4 sm:px-6 lg:px-8 xl:px-12' // Progressive padding when sidebar is closed for better centering
          }`}>
            <div className={`h-full mx-auto transition-all duration-300 ease-in-out ${
              sidebarOpen
                ? 'max-w-6xl lg:max-w-5xl' // Responsive width when sidebar is open
                : 'max-w-4xl lg:max-w-3xl xl:max-w-4xl' // Optimal responsive width when sidebar is closed
            }`}>
              <ChatContainer
                messages={messages}
                isLoading={isLoading}
                onExampleClick={handleExampleClick}
                onCopy={handleCopy}
                onFeedback={handleFeedback}
                sidebarOpen={sidebarOpen}
              />
            </div>
          </div>
        </div>

        {/* Fixed Chat Input at bottom of viewport */}
        <div
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300 ease-in-out shadow-lg"
          style={{
            left: isMainNavDesktop ?
              (sidebarOpen && isDesktop ? `${navSidebarWidth + sidebarWidth}px` : `${navSidebarWidth}px`)
              : (sidebarOpen && isDesktop ? `${sidebarWidth}px` : '0')
          }}
        >
          <div className={`transition-all duration-300 ease-in-out ${
            sidebarOpen
              ? 'px-4 sm:px-6' // Responsive padding when sidebar is open
              : 'px-4 sm:px-6 lg:px-8 xl:px-12' // Progressive padding when sidebar is closed
          }`}>
            <div className={`mx-auto py-4 transition-all duration-300 ease-in-out ${
              sidebarOpen
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
    </div>
  );
}
