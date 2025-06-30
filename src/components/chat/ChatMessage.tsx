import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { User, Bot, Copy, ThumbsUp, ThumbsDown, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { SearchResult, ReceiptWithSimilarity, LineItemSearchResult } from '@/lib/ai-search';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useChatTranslation } from '@/contexts/LanguageContext';
import { UIComponent } from '@/types/ui-components';
import { parseUIComponents } from '@/lib/ui-component-parser';
import { UIComponentRenderer } from './ui-components/UIComponentRenderer';
import { FeedbackButtons } from './FeedbackButtons';

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  searchResults?: SearchResult;
  isLoading?: boolean;
  uiComponents?: UIComponent[];
}

interface ChatMessageProps {
  message: ChatMessage;
  conversationId?: string;
  onCopy?: (content: string) => void;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative') => void;
}

export function ChatMessage({ message, conversationId, onCopy, onFeedback }: ChatMessageProps) {
  const navigate = useNavigate();
  const { t } = useChatTranslation();
  const [displayedText, setDisplayedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [parsedComponents, setParsedComponents] = useState<UIComponent[]>([]);
  const [cleanedContent, setCleanedContent] = useState('');

  // Parse UI components and handle streaming for AI messages
  useEffect(() => {
    if (message.type === 'ai' && message.content) {
      // Parse UI components from message content
      const parseResult = parseUIComponents(message.content);
      setParsedComponents(parseResult.components);
      setCleanedContent(parseResult.cleanedContent);

      // Use cleaned content for streaming (without JSON blocks)
      const textToStream = parseResult.cleanedContent;

      setIsStreaming(true);
      setDisplayedText('');

      let currentIndex = 0;

      const streamInterval = setInterval(() => {
        if (currentIndex < textToStream.length) {
          setDisplayedText(textToStream.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          setIsStreaming(false);
          clearInterval(streamInterval);
        }
      }, 20); // Adjust speed as needed

      return () => clearInterval(streamInterval);
    } else {
      // For non-AI messages, just set the content directly
      setDisplayedText(message.content);
      setCleanedContent(message.content);
      setParsedComponents([]);
      setIsStreaming(false);
    }
  }, [message.content, message.type]);

  const handleCopy = () => {
    // Copy the cleaned content (without JSON blocks) for better user experience
    const contentToCopy = cleanedContent || message.content;
    navigator.clipboard.writeText(contentToCopy);
    toast.success(t('messages.actions.copied'));
    onCopy?.(contentToCopy);
  };

  // Handle UI component actions
  const handleComponentAction = (action: string, data?: any) => {
    console.log('🔧 Chat UI Component Action:', action, data);

    // Track specific actions for analytics and user feedback
    switch (action) {
      case 'view_receipt':
        console.log(`📄 Viewing receipt ${data?.receipt_id} from chat interface`);
        break;
      case 'edit_receipt':
        console.log(`✏️ Editing receipt ${data?.receipt_id} from chat interface`);
        break;
      case 'categorize_receipt':
        console.log(`🏷️ Categorizing receipt ${data?.receipt_id} from chat interface`);
        break;
      default:
        console.log(`🔧 Unknown action: ${action}`);
    }

    // You can add more specific handling here:
    // - Analytics tracking
    // - State updates
    // - User behavior logging
  };

  const handleViewReceipt = (receiptId: string, itemType?: string) => {
    // Enhanced validation with better error messages
    if (!receiptId || receiptId.trim() === '') {
      console.error('Cannot navigate to receipt: ID is undefined or empty', { receiptId, itemType });
      return;
    }

    // Validate that the ID looks like a valid UUID or receipt ID
    if (receiptId.length < 10) {
      console.error('Cannot navigate to receipt: ID appears invalid', { receiptId, itemType });
      return;
    }

    try {
      console.log(`Navigating to receipt: ${receiptId} (from chat ${itemType || 'unknown'})`);
      navigate(`/receipt/${receiptId}`, {
        state: {
          from: 'chat',
          itemType: itemType
        }
      });
    } catch (error) {
      console.error('Error navigating to receipt from chat:', error);
    }
  };

  // Helper function to clean and format dates (similar to ReceiptCardComponent)
  const formatReceiptDate = (dateString: string) => {
    try {
      // Handle various date formats and clean up any template placeholders
      let cleanDateString = dateString;

      // Remove any template placeholders like "{{date}}"
      cleanDateString = cleanDateString.replace(/\{\{date\}\}:?\s*/g, '').trim();

      // If the string is empty after cleanup, return null
      if (!cleanDateString) {
        return null;
      }

      const date = new Date(cleanDateString);

      // Check if date is valid
      if (isNaN(date.getTime())) {
        // Try to parse DD/MM/YYYY or DD-MM-YYYY format
        const ddmmyyyyMatch = cleanDateString.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (ddmmyyyyMatch) {
          const [, day, month, year] = ddmmyyyyMatch;
          const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
          }
        }
        return null; // Return null if can't parse
      }

      return date;
    } catch {
      return null;
    }
  };

  const renderSearchResults = () => {
    if (!message.searchResults?.results) return null;

    // Don't render traditional search results if UI components are present
    // This prevents duplicate receipt cards from being displayed
    const hasReceiptUIComponents = parsedComponents.some(c => c.component === 'receipt_card');
    if (hasReceiptUIComponents) {
      return null;
    }

    return (
      <div className="mt-4 space-y-3">
        <div className="text-sm text-muted-foreground">
          Found {message.searchResults.total} results:
        </div>

        {message.searchResults.results.map((result, index) => {
          // Check if it's a receipt or line item result
          const isReceipt = 'merchant' in result;

          if (isReceipt) {
            const receipt = result as ReceiptWithSimilarity;
            const receiptDate = receipt.date ? formatReceiptDate(receipt.date) : null;
            const similarityScore = receipt.similarity_score || 0;
            const formattedScore = Math.round(similarityScore * 100);

            return (
              <Card key={receipt.id} className="border-l-4 border-l-primary/50">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-sm">{receipt.merchant || t('results.unknownMerchant')}</h4>
                    {similarityScore > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {formattedScore}% {t('results.match')}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    {receiptDate && (
                      <div>{t('results.date')}: {receiptDate.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}</div>
                    )}
                    {(receipt.total_amount || receipt.total) && (
                      <div>{t('results.total')}: {receipt.currency || 'MYR'} {
                        (receipt.total_amount || receipt.total || 0).toFixed ?
                        (receipt.total_amount || receipt.total).toFixed(2) :
                        (receipt.total_amount || receipt.total)
                      }</div>
                    )}
                    {receipt.notes && (
                      <div className="text-xs">{t('results.notes')}: {receipt.notes}</div>
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => handleViewReceipt(receipt.id, 'receipt')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View Receipt
                  </Button>
                </CardContent>
              </Card>
            );
          } else {
            const lineItem = result as LineItemSearchResult;
            const receiptDate = lineItem.parent_receipt_date ? formatReceiptDate(lineItem.parent_receipt_date) : null;
            const similarityScore = lineItem.similarity_score || 0;
            const formattedScore = Math.round(similarityScore * 100);

            return (
              <Card key={lineItem.line_item_id} className="border-l-4 border-l-secondary/50">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-sm">{lineItem.line_item_description || t('results.unknownItem')}</h4>
                    {similarityScore > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {formattedScore}% {t('results.match')}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>{t('results.from')}: {lineItem.parent_receipt_merchant || t('results.unknownMerchant')}</div>
                    {receiptDate && (
                      <div>{t('results.date')}: {receiptDate.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}</div>
                    )}
                    {lineItem.line_item_amount && (
                      <div>{t('results.amount')}: {lineItem.currency || 'MYR'} {lineItem.line_item_amount.toFixed(2)}</div>
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => handleViewReceipt(lineItem.parent_receipt_id || lineItem.receipt_id, 'line_item')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View Parent Receipt
                  </Button>
                </CardContent>
              </Card>
            );
          }
        })}
      </div>
    );
  };

  if (message.type === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="flex items-start space-x-2 max-w-[80%]">
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2">
            <p className="text-sm">{message.content}</p>
          </div>
          <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-primary-foreground" />
          </div>
        </div>
      </div>
    );
  }

  if (message.type === 'ai') {
    return (
      <div className="flex justify-start mb-4">
        <div className="flex items-start space-x-2 max-w-[80%]">
          <div className="flex-shrink-0 w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
            <Bot className="h-4 w-4 text-secondary-foreground" />
          </div>
          <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-2 flex-1">
            <p className="text-sm mb-2">
              {displayedText}
              {isStreaming && <span className="animate-pulse">|</span>}
            </p>
            {!isStreaming && renderSearchResults()}

            {/* Render UI Components after streaming is complete */}
            {!isStreaming && parsedComponents.length > 0 && (
              <div className="mt-4">
                <UIComponentRenderer
                  components={parsedComponents}
                  onAction={handleComponentAction}
                  compact={false}
                />
              </div>
            )}
            
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
              <div className="text-xs text-muted-foreground">
                {formatDistanceToNow(message.timestamp, { addSuffix: true })}
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <FeedbackButtons
                  messageId={message.id}
                  conversationId={conversationId}
                  onFeedback={onFeedback}
                  size="sm"
                  variant="ghost"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // System messages
  return (
    <div className="flex justify-center mb-4">
      <div className="bg-muted rounded-lg px-3 py-1 text-xs text-muted-foreground">
        {message.content}
      </div>
    </div>
  );
}
