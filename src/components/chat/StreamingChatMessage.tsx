/**
 * Streaming Chat Message Component
 * Optimized for progressive response streaming with smooth animations and efficient rendering
 */

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Bot, User, Copy, ThumbsUp, ThumbsDown, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  StreamChunk, 
  ProgressiveLoadingState, 
  progressiveResponseStreamer 
} from '@/lib/progressive-response-streamer';
import { ChatMarkdownRenderer } from '../ui/MarkdownRenderer';
import { UIComponentRenderer } from './ui-components/UIComponentRenderer';
import { EnhancedSearchResults } from '../search/EnhancedSearchResults';

// Message interface for streaming
export interface StreamingChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  searchResults?: any;
  isLoading?: boolean;
  isStreaming?: boolean;
  streamId?: string;
  uiComponents?: any[];
}

interface StreamingChatMessageProps {
  message: StreamingChatMessage;
  conversationId?: string;
  onCopy?: (content: string) => void;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative') => void;
  enableStreaming?: boolean;
  enableProgressiveLoading?: boolean;
}

export const StreamingChatMessage = memo<StreamingChatMessageProps>(({ 
  message, 
  conversationId, 
  onCopy, 
  onFeedback,
  enableStreaming = true,
  enableProgressiveLoading = true
}) => {
  // Streaming state
  const [streamingState, setStreamingState] = useState<ProgressiveLoadingState>({
    searchMetadata: null,
    partialResults: [],
    aiResponse: '',
    uiComponents: [],
    isComplete: false,
    loadingProgress: 0
  });

  const [displayedText, setDisplayedText] = useState('');
  const [isActivelyStreaming, setIsActivelyStreaming] = useState(false);
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null);
  const [timeToFirstByte, setTimeToFirstByte] = useState<number | null>(null);

  // Memoized values
  const isUser = message.type === 'user';
  const isSystem = message.type === 'system';
  const isAI = message.type === 'ai';

  /**
   * Handle streaming chunks
   */
  const handleStreamChunk = useCallback((chunk: StreamChunk) => {
    console.log(`📦 Received chunk: ${chunk.type} (sequence: ${chunk.sequence})`);

    // Record TTFB for first chunk
    if (chunk.sequence === 0 && streamStartTime) {
      const ttfb = performance.now() - streamStartTime;
      setTimeToFirstByte(ttfb);
      console.log(`⚡ Time to first byte: ${ttfb.toFixed(2)}ms`);
    }

    setStreamingState(prev => {
      const newState = { ...prev };

      switch (chunk.type) {
        case 'metadata':
          newState.searchMetadata = chunk.data;
          newState.loadingProgress = 10;
          break;

        case 'ai_response':
          if (chunk.data.isPartial) {
            // Progressive text building
            newState.aiResponse = prev.aiResponse + ' ' + chunk.data.chunk;
          } else {
            newState.aiResponse = chunk.data.chunk;
          }
          newState.loadingProgress = Math.min(40, 10 + (chunk.data.currentWord / chunk.data.totalWords) * 30);
          break;

        case 'partial_results':
          newState.partialResults = [...prev.partialResults, ...chunk.data.results];
          newState.loadingProgress = Math.min(80, 40 + (chunk.data.endIndex / chunk.data.totalResults) * 40);
          break;

        case 'ui_components':
          newState.uiComponents = [...prev.uiComponents, chunk.data.component];
          newState.loadingProgress = Math.min(95, 80 + (newState.uiComponents.length / (message.uiComponents?.length || 1)) * 15);
          break;

        case 'complete':
          newState.isComplete = true;
          newState.loadingProgress = 100;
          setIsActivelyStreaming(false);
          break;
      }

      return newState;
    });
  }, [streamStartTime, message.uiComponents?.length]);

  /**
   * Handle streaming completion
   */
  const handleStreamComplete = useCallback((finalState: ProgressiveLoadingState) => {
    console.log('✅ Streaming completed:', finalState);
    setStreamingState(finalState);
    setIsActivelyStreaming(false);
  }, []);

  /**
   * Handle streaming errors
   */
  const handleStreamError = useCallback((error: Error) => {
    console.error('❌ Streaming error:', error);
    setIsActivelyStreaming(false);
    toast.error('Failed to stream response');
  }, []);

  /**
   * Start streaming for AI messages
   */
  useEffect(() => {
    if (isAI && message.isStreaming && enableStreaming && !isActivelyStreaming) {
      setIsActivelyStreaming(true);
      setStreamStartTime(performance.now());

      // Start progressive streaming
      progressiveResponseStreamer.streamSearchResponse(
        message.searchResults || { success: true, results: [], totalResults: 0, pagination: { hasMore: false, nextOffset: 0, totalPages: 0 }, searchMetadata: {} },
        message.content,
        message.uiComponents || [],
        handleStreamChunk,
        handleStreamComplete,
        handleStreamError
      );
    } else if (!message.isStreaming) {
      // For non-streaming messages, set content directly
      setDisplayedText(message.content);
      setStreamingState({
        searchMetadata: message.searchResults?.searchMetadata || null,
        partialResults: message.searchResults?.results || [],
        aiResponse: message.content,
        uiComponents: message.uiComponents || [],
        isComplete: true,
        loadingProgress: 100
      });
    }
  }, [message.isStreaming, message.content, message.searchResults, message.uiComponents, isAI, enableStreaming, isActivelyStreaming, handleStreamChunk, handleStreamComplete, handleStreamError]);

  /**
   * Update displayed text based on streaming state
   */
  useEffect(() => {
    if (isActivelyStreaming && streamingState.aiResponse) {
      setDisplayedText(streamingState.aiResponse);
    } else if (!isActivelyStreaming && !message.isStreaming) {
      setDisplayedText(message.content);
    }
  }, [streamingState.aiResponse, isActivelyStreaming, message.isStreaming, message.content]);

  /**
   * Handle copy action
   */
  const handleCopy = useCallback(() => {
    const contentToCopy = streamingState.isComplete ? streamingState.aiResponse : message.content;
    navigator.clipboard.writeText(contentToCopy);
    toast.success('Message copied to clipboard');
    onCopy?.(contentToCopy);
  }, [streamingState.isComplete, streamingState.aiResponse, message.content, onCopy]);

  /**
   * Handle feedback
   */
  const handleFeedback = useCallback((feedback: 'positive' | 'negative') => {
    onFeedback?.(message.id, feedback);
    toast.success(`Feedback recorded: ${feedback}`);
  }, [message.id, onFeedback]);

  /**
   * Render loading indicator
   */
  const renderLoadingIndicator = useMemo(() => {
    if (!message.isLoading && !isActivelyStreaming) return null;

    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {isActivelyStreaming ? (
          <div className="flex items-center gap-2">
            <span>Streaming response...</span>
            <Badge variant="outline" className="text-xs">
              {streamingState.loadingProgress.toFixed(0)}%
            </Badge>
            {timeToFirstByte && (
              <Badge variant="outline" className="text-xs">
                TTFB: {timeToFirstByte.toFixed(0)}ms
              </Badge>
            )}
          </div>
        ) : (
          <span>Thinking...</span>
        )}
      </div>
    );
  }, [message.isLoading, isActivelyStreaming, streamingState.loadingProgress, timeToFirstByte]);

  /**
   * Render search results progressively
   */
  const renderSearchResults = useMemo(() => {
    if (!enableProgressiveLoading || streamingState.partialResults.length === 0) {
      return message.searchResults ? (
        <div className="mt-4">
          <EnhancedSearchResults 
            results={message.searchResults} 
            conversationId={conversationId}
          />
        </div>
      ) : null;
    }

    // Progressive loading of search results
    return (
      <div className="mt-4">
        <EnhancedSearchResults 
          results={{
            ...message.searchResults,
            results: streamingState.partialResults,
            total: streamingState.partialResults.length
          }} 
          conversationId={conversationId}
          isStreaming={isActivelyStreaming}
        />
      </div>
    );
  }, [enableProgressiveLoading, streamingState.partialResults, message.searchResults, conversationId, isActivelyStreaming]);

  /**
   * Render UI components progressively
   */
  const renderUIComponents = useMemo(() => {
    if (!streamingState.isComplete && streamingState.uiComponents.length === 0) {
      return null;
    }

    const componentsToRender = enableProgressiveLoading 
      ? streamingState.uiComponents 
      : (message.uiComponents || []);

    if (componentsToRender.length === 0) return null;

    return (
      <div className="mt-4">
        <UIComponentRenderer
          components={componentsToRender}
          onAction={() => {}}
          compact={false}
          isStreaming={isActivelyStreaming}
        />
      </div>
    );
  }, [streamingState.isComplete, streamingState.uiComponents, enableProgressiveLoading, message.uiComponents, isActivelyStreaming]);

  /**
   * Render message actions
   */
  const renderActions = useMemo(() => {
    if (isUser || message.isLoading || isActivelyStreaming) return null;

    return (
      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-8 w-8 p-0"
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleFeedback('positive')}
          className="h-8 w-8 p-0"
        >
          <ThumbsUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleFeedback('negative')}
          className="h-8 w-8 p-0"
        >
          <ThumbsDown className="h-3 w-3" />
        </Button>
      </div>
    );
  }, [isUser, message.isLoading, isActivelyStreaming, handleCopy, handleFeedback]);

  // User message rendering
  if (isUser) {
    return (
      <div className="flex justify-end mb-4 group">
        <div className="flex items-start space-x-2 max-w-[80%]">
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2">
            <div className="text-sm">{message.content}</div>
            <div className="text-xs opacity-70 mt-1">
              {formatDistanceToNow(message.timestamp, { addSuffix: true })}
            </div>
          </div>
          <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-primary-foreground" />
          </div>
        </div>
      </div>
    );
  }

  // AI/System message rendering
  return (
    <div className="flex justify-start mb-4 group">
      <div className="flex items-start space-x-2 max-w-[80%]">
        <div className="flex-shrink-0 w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
          <Bot className="h-4 w-4 text-secondary-foreground" />
        </div>
        <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-2 flex-1">
          {/* Message header */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <span>{isSystem ? 'System' : 'Mataresit AI'}</span>
            <span>•</span>
            <span>{formatDistanceToNow(message.timestamp, { addSuffix: true })}</span>
            {process.env.NODE_ENV === 'development' && timeToFirstByte && (
              <>
                <span>•</span>
                <Badge variant="outline" className="text-xs">
                  TTFB: {timeToFirstByte.toFixed(0)}ms
                </Badge>
              </>
            )}
          </div>

          {/* Loading indicator */}
          {renderLoadingIndicator}

          {/* Message content */}
          {displayedText && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ChatMarkdownRenderer
                content={displayedText}
                isStreaming={isActivelyStreaming}
              />
            </div>
          )}

          {/* Search results */}
          {!isActivelyStreaming && renderSearchResults}

          {/* UI Components */}
          {renderUIComponents}

          {/* Actions */}
          {renderActions}
        </div>
      </div>
    </div>
  );
});

StreamingChatMessage.displayName = 'StreamingChatMessage';
