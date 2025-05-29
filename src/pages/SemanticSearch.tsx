import { useEffect, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { MessageSquare, Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { semanticSearch, SearchParams, SearchResult } from '../lib/ai-search';
import { generateIntelligentResponse, detectUserIntent } from '../lib/chat-response-generator';
import Navbar from "@/components/Navbar";
import { ChatContainer } from '../components/chat/ChatContainer';
import { ChatInput } from '../components/chat/ChatInput';
import { ChatMessage } from '../components/chat/ChatMessage';
import { ConversationSidebar } from '../components/chat/ConversationSidebar';
import { SidebarToggle } from '../components/chat/SidebarToggle';

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

  // URL state management for preserving chat state (optional)
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();

  // Conversation updater for real-time updates
  const { saveConversation: saveConversationWithEvents } = useConversationUpdater();

  // Initialize sidebar state based on screen size
  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth >= 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'H') {
        event.preventDefault();
        setSidebarOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize from URL if there's a query parameter
  useEffect(() => {
    const query = urlSearchParams.get('q');
    const conversationId = urlSearchParams.get('c');

    if (conversationId) {
      loadConversation(conversationId);
    } else if (query) {
      handleSendMessage(query);
    }
  }, []);

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
      setUrlSearchParams({ c: conversationId });
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
      setUrlSearchParams({ c: conversationId });
    }
  }, [setUrlSearchParams]);

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
      setUrlSearchParams({ q: content });

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
    setUrlSearchParams({});
  }, [messages, saveCurrentConversation, setUrlSearchParams]);

  // Sidebar handlers
  const handleToggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  const handleSelectConversation = (conversationId: string) => {
    // Save current conversation before switching
    if (messages.length > 0 && currentConversationId !== conversationId) {
      saveCurrentConversation();
    }

    loadConversation(conversationId);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Helmet>
        <title>AI Chat - Paperless Maverick</title>
      </Helmet>

      {/* Conversation Sidebar */}
      <ConversationSidebar
        isOpen={sidebarOpen}
        onToggle={handleToggleSidebar}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        currentConversationId={currentConversationId}
        className={sidebarOpen ? "lg:relative" : ""}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        {/* Chat Header */}
        <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-3 max-w-4xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <SidebarToggle
                  isOpen={sidebarOpen}
                  onToggle={handleToggleSidebar}
                />
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold">AI Receipt Assistant</h1>
                  <p className="text-xs text-muted-foreground">
                    Ask me anything about your receipts
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNewChat}
                className="flex items-center space-x-1"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Chat</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <ChatContainer
          messages={messages}
          isLoading={isLoading}
          onExampleClick={handleExampleClick}
          onCopy={handleCopy}
          onFeedback={handleFeedback}
        />

        {/* Chat Input */}
        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          placeholder="Ask about your receipts..."
        />
      </div>
    </div>
  );
}
