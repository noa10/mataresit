/**
 * Optimized Chat Message Component
 * 
 * Performance-optimized version of ChatMessage with lazy loading,
 * memoization, and efficient rendering for large content.
 */

import React, { useState, useEffect, useMemo, Suspense, lazy, memo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { User, Bot, Copy, ThumbsUp, ThumbsDown, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { UIComponent } from '@/types/ui-components';
import { UIComponentRenderer } from './ui-components/UIComponentRenderer';
import { handleReceiptClick, openReceiptInNewWindow } from '@/utils/navigationUtils';
import { FeedbackButtons } from './FeedbackButtons';
import { ChatMarkdownRenderer } from '../ui/MarkdownRenderer';
import { 
  useOptimizedParsing, 
  useLazyComponents, 
  useRenderPerformance 
} from '@/hooks/useFormattingPerformance';

// Lazy load heavy components
const VirtualizedDataTable = lazy(() => 
  import('./ui-components/VirtualizedDataTable').then(m => ({ default: m.VirtualizedDataTable }))
);

const EnhancedSearchResults = lazy(() => 
  import('../search/EnhancedSearchResults').then(m => ({ default: m.EnhancedSearchResults }))
);

export interface OptimizedChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  searchResults?: any;
  isLoading?: boolean;
  uiComponents?: UIComponent[];
}

interface OptimizedChatMessageProps {
  message: OptimizedChatMessage;
  conversationId?: string;
  onCopy?: (content: string) => void;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative') => void;
  enablePerformanceMode?: boolean;
  lazyLoadThreshold?: number;
}

// Memoized component renderer with error boundary
const MemoizedComponentRenderer = memo(({ 
  component, 
  onAction 
}: { 
  component: UIComponent; 
  onAction?: (action: string, data?: any) => void;
}) => {
  const { startRender, endRender } = useRenderPerformance(`UIComponent-${component.component}`);
  
  useEffect(() => {
    startRender();
    return () => endRender();
  }, [startRender, endRender]);

  // Use virtualized table for large datasets
  if (component.component === 'data_table' && component.data.rows?.length > 50) {
    return (
      <Suspense fallback={<TableSkeleton />}>
        <VirtualizedDataTable
          data={component.data}
          onAction={onAction}
          enableVirtualization={true}
          virtualizationThreshold={50}
        />
      </Suspense>
    );
  }

  return (
    <UIComponentRenderer
      component={component}
      onAction={onAction}
    />
  );
});

MemoizedComponentRenderer.displayName = 'MemoizedComponentRenderer';

// Loading skeleton for tables
const TableSkeleton = () => (
  <div className="space-y-3">
    <Skeleton className="h-10 w-full" />
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  </div>
);

// Loading skeleton for components
const ComponentSkeleton = () => (
  <div className="space-y-3">
    <Skeleton className="h-6 w-3/4" />
    <Skeleton className="h-20 w-full" />
  </div>
);

export const OptimizedChatMessage = memo<OptimizedChatMessageProps>(({ 
  message, 
  conversationId, 
  onCopy, 
  onFeedback,
  enablePerformanceMode = true,
  lazyLoadThreshold = 3
}) => {
  const { startRender, endRender, metrics } = useRenderPerformance('OptimizedChatMessage');
  const [displayedText, setDisplayedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    startRender();
    return () => endRender();
  }, [startRender, endRender]);

  // Optimized parsing with caching
  const { components, cleanedContent, metrics: parseMetrics, fromCache } = useOptimizedParsing(
    message.content,
    {
      enableCache: enablePerformanceMode,
      performanceTracking: process.env.NODE_ENV === 'development'
    }
  );

  // Lazy loading for components
  const { 
    visibleComponents, 
    hasMore, 
    isLoading: isLoadingMore, 
    loadMore 
  } = useLazyComponents(
    message.uiComponents || components, 
    lazyLoadThreshold
  );

  // Memoized content processing
  const processedContent = useMemo(() => {
    if (message.type === 'ai' && message.content) {
      return cleanedContent || message.content;
    }
    return message.content;
  }, [message.type, message.content, cleanedContent]);

  // Handle streaming effect for AI messages
  useEffect(() => {
    if (message.type === 'ai' && processedContent && !message.isLoading) {
      setIsStreaming(true);
      setDisplayedText('');
      
      const streamText = async () => {
        const text = processedContent;
        const words = text.split(' ');
        
        for (let i = 0; i <= words.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 20));
          setDisplayedText(words.slice(0, i).join(' '));
        }
        
        setIsStreaming(false);
      };
      
      streamText();
    } else {
      setDisplayedText(processedContent);
      setIsStreaming(false);
    }
  }, [message.type, processedContent, message.isLoading]);

  // Handle component actions
  const handleComponentAction = (action: string, data?: any) => {
    switch (action) {
      case 'receipt_click':
        if (data?.receiptId) {
          handleReceiptClick(data.receiptId);
        }
        break;
      case 'external_link':
        if (data?.url) {
          openReceiptInNewWindow(data.url);
        }
        break;
      case 'cell_click':
        // Handle table cell clicks
        console.log('Cell clicked:', data);
        break;
      default:
        console.log('Component action:', action, data);
    }
  };

  // Copy message content
  const handleCopy = () => {
    const textToCopy = processedContent;
    navigator.clipboard.writeText(textToCopy);
    toast.success('Message copied to clipboard');
    onCopy?.(textToCopy);
  };

  const isUser = message.type === 'user';
  const isSystem = message.type === 'system';

  return (
    <div className={cn(
      "flex gap-3 p-4",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
        isUser ? "bg-primary text-primary-foreground" : 
        isSystem ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground"
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message Content */}
      <div className={cn(
        "flex-1 space-y-2",
        isUser ? "items-end" : "items-start"
      )}>
        {/* Message Header */}
        <div className={cn(
          "flex items-center gap-2 text-xs text-muted-foreground",
          isUser ? "flex-row-reverse" : "flex-row"
        )}>
          <span>{isUser ? 'You' : isSystem ? 'System' : 'Mataresit AI'}</span>
          <span>•</span>
          <span>{formatDistanceToNow(message.timestamp, { addSuffix: true })}</span>
          {enablePerformanceMode && process.env.NODE_ENV === 'development' && parseMetrics && (
            <>
              <span>•</span>
              <Badge variant="outline" className="text-xs">
                {fromCache ? 'Cached' : `${parseMetrics.parseTime.toFixed(1)}ms`}
              </Badge>
            </>
          )}
        </div>

        {/* Message Body */}
        <Card className={cn(
          "max-w-4xl",
          isUser ? "ml-auto bg-primary text-primary-foreground" : "mr-auto"
        )}>
          <CardContent className="p-4 space-y-4">
            {/* Loading State */}
            {message.isLoading && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}

            {/* Text Content */}
            {displayedText && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ChatMarkdownRenderer
                  content={displayedText}
                  isStreaming={isStreaming}
                />
              </div>
            )}

            {/* UI Components */}
            {visibleComponents.length > 0 && (
              <div className="space-y-4">
                {visibleComponents.map((component, index) => (
                  <Suspense key={`${component.component}-${index}`} fallback={<ComponentSkeleton />}>
                    <MemoizedComponentRenderer
                      component={component}
                      onAction={handleComponentAction}
                    />
                  </Suspense>
                ))}
                
                {/* Load More Button */}
                {hasMore && (
                  <div className="text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadMore}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Loading...
                        </>
                      ) : (
                        `Load More Components (${(message.uiComponents || components).length - visibleComponents.length} remaining)`
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Search Results */}
            {message.searchResults && (
              <Suspense fallback={<ComponentSkeleton />}>
                <EnhancedSearchResults searchResults={message.searchResults} />
              </Suspense>
            )}
          </CardContent>
        </Card>

        {/* Message Actions */}
        {!isUser && !message.isLoading && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 px-2"
            >
              <Copy className="h-3 w-3" />
            </Button>
            
            {onFeedback && (
              <FeedbackButtons
                messageId={message.id}
                onFeedback={onFeedback}
                size="sm"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
});

OptimizedChatMessage.displayName = 'OptimizedChatMessage';
