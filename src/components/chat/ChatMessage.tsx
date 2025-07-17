import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { User, Bot, Copy, ThumbsUp, ThumbsDown, ExternalLink, ExternalLinkIcon } from 'lucide-react';
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
import { handleReceiptClick, openReceiptInNewWindow } from '@/utils/navigationUtils';
import { FeedbackButtons } from './FeedbackButtons';
import { EnhancedSearchResults } from '../search/EnhancedSearchResults';
import { ChatMarkdownRenderer, MarkdownRenderer } from '../ui/MarkdownRenderer';

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
      let contentToStream = message.content;

      // Use UI components from message if available, otherwise parse from content
      if (message.uiComponents && message.uiComponents.length > 0) {
        setParsedComponents(message.uiComponents);
        setCleanedContent(message.content);
        contentToStream = message.content;
      } else {
        // Parse UI components from message content
        const parseResult = parseUIComponents(message.content);
        setParsedComponents(parseResult.components);

        // Clean up the content to remove redundant headers and improve structure
        let cleanedText = parseResult.cleanedContent;

        // Remove standalone section headers that are now represented as components
        const standaloneHeaderPatterns = [
          /^Financial Analysis Summary:?\s*$/gm,
          /^Spending Overview:?\s*$/gm,
          /^Transaction Breakdown:?\s*$/gm,
          /^Insights & Trends:?\s*$/gm,
          /^Recommendations:?\s*$/gm,
          /^Key Insights:?\s*$/gm,
          /^Summary:?\s*$/gm,
          /^Analysis:?\s*$/gm,
          // Remove duplicate titles that appear as both headers and text
          /^"[^"]*"\s+(Chill Purchases|Analysis|Summary|Overview|Breakdown|Insights|Recommendations)$/gm
        ];

        standaloneHeaderPatterns.forEach(pattern => {
          cleanedText = cleanedText.replace(pattern, '');
        });

        // Remove excessive line breaks and clean up spacing
        cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
        cleanedText = cleanedText.replace(/^\s*\n+/gm, '\n');

        // Trim whitespace
        cleanedText = cleanedText.trim();

        setCleanedContent(cleanedText);
        contentToStream = cleanedText;
      }

      // Use cleaned content for streaming (without JSON blocks)
      const textToStream = contentToStream;

      // 🔧 FIX: Skip streaming for cached messages or messages with search results
      // These are already complete and don't need the streaming animation
      const shouldSkipStreaming = message.searchResults || message.uiComponents?.length > 0;

      if (shouldSkipStreaming) {
        setIsStreaming(false);
        setDisplayedText(textToStream);
      } else {
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
        }, 20);

        return () => clearInterval(streamInterval);
      }
    } else {
      // For non-AI messages, just set the content directly
      setDisplayedText(message.content);
      setCleanedContent(message.content);
      setParsedComponents([]);
      setIsStreaming(false);
    }
  }, [message.content, message.type, message.uiComponents]);

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

  const handleViewReceipt = (receiptId: string, itemType?: string, event?: React.MouseEvent) => {
    const navigationOptions = {
      from: 'chat',
      itemType: itemType
    };

    // If event is provided, use the enhanced click handler
    if (event) {
      handleReceiptClick(event, receiptId, navigate, navigationOptions);
      return;
    }

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
        state: navigationOptions
      });
    } catch (error) {
      console.error('Error navigating to receipt from chat:', error);
    }
  };

  const handleViewReceiptNewWindow = (receiptId: string, itemType?: string) => {
    openReceiptInNewWindow(receiptId, {
      from: 'chat',
      itemType: itemType
    });
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

    // 🔍 DEBUG: Log search results and UI components for debugging
    console.log('🔍 DEBUG: ChatMessage renderSearchResults called with:', {
      hasSearchResults: !!message.searchResults,
      resultsLength: message.searchResults?.results?.length || 0,
      hasUIComponents: !!message.uiComponents,
      uiComponentsLength: message.uiComponents?.length || 0,
      parsedComponentsLength: parsedComponents.length,
      messageId: message.id,
      messageType: message.type,
      searchResultsStructure: message.searchResults ? Object.keys(message.searchResults) : [],
      uiComponentTypes: message.uiComponents?.map(c => c.component) || [],
      parsedComponentTypes: parsedComponents.map(c => c.component),
      firstResult: message.searchResults?.results?.[0] ? {
        id: message.searchResults.results[0].id,
        merchant: message.searchResults.results[0].merchant,
        sourceType: message.searchResults.results[0].sourceType,
        contentType: message.searchResults.results[0].contentType
      } : null
    });

    // Use enhanced search results if UI components are present
    // Check for both receipt_card and line_item_card components
    const hasUIComponents = parsedComponents.some(c =>
      c.component === 'receipt_card' || c.component === 'line_item_card'
    );



    // 🔧 FIX: Generate UI components from search results if missing
    if (message.searchResults?.results && message.searchResults.results.length > 0) {
      let uiComponentsToUse = message.uiComponents || [];

      // 🔍 DEBUG: Log UI component generation attempt
      console.log('🔍 DEBUG: ChatMessage attempting UI component generation:', {
        hasUIComponents: uiComponentsToUse.length > 0,
        uiComponentsLength: uiComponentsToUse.length,
        searchResultsLength: message.searchResults.results.length,
        firstResultType: message.searchResults.results[0]?.sourceType,
        firstResultMerchant: message.searchResults.results[0]?.merchant,
        firstResultDescription: message.searchResults.results[0]?.line_item_description
      });

      // If UI components are missing but we have search results, generate them
      if (uiComponentsToUse.length === 0) {


        // 🔍 DEBUG: Log search results before filtering
        const firstResult = message.searchResults.results[0];
        console.log('🔍 DEBUG: Search results before filtering:', {
          totalResults: message.searchResults.results.length,
          firstResult: firstResult,
          firstResultKeys: firstResult ? Object.keys(firstResult) : [],
          lineItemResults: message.searchResults.results.filter(r => r.sourceType === 'line_item').length
        });

        // 🔍 DEBUG: Log actual type values
        const sourceTypes = message.searchResults.results.map(r => r.sourceType);
        const uniqueSourceTypes = [...new Set(sourceTypes)];
        console.log('🔍 DEBUG: Actual result types:');
        console.log('  - First 5 sourceTypes:', sourceTypes.slice(0, 5));
        console.log('  - Unique sourceTypes:', uniqueSourceTypes);
        console.log('  - First result full object:', message.searchResults.results[0]);

        // 🔧 FIX: Handle both line_item and receipt type results
        // Since the current results have type: "receipt" and sourceType: undefined,
        // we need to adapt to the actual data structure
        uiComponentsToUse = message.searchResults.results
          .map(result => {
            // 🔍 DEBUG: Log each result being processed
            console.log('🔍 DEBUG: Processing search result:', {
              id: result.id,
              type: result.type,
              sourceType: result.sourceType,
              title: result.title,
              content: result.content,
              hasMetadata: !!result.metadata,
              metadataKeys: result.metadata ? Object.keys(result.metadata) : [],
              metadata: result.metadata
            });

            // For receipt-type results, create a line item card with available data
            return {
              type: 'ui_component' as const,
              component: 'line_item_card',
              data: {
                line_item_id: result.id,
                receipt_id: result.id,
                description: result.title || result.metadata?.description || 'Unknown Item',
                amount: result.metadata?.amount || result.metadata?.total || 0,
                currency: result.metadata?.currency || 'MYR',
                merchant: result.metadata?.merchant || result.metadata?.store_name || 'Unknown Merchant',
                date: result.metadata?.date || result.createdAt,
                confidence: result.similarity || 0.8,
                quantity: result.metadata?.quantity || 1
              }
            };
          });

        // 🔍 DEBUG: Log generated UI components
        console.log('🔍 DEBUG: Generated UI components:', {
          generatedCount: uiComponentsToUse.length,
          componentTypes: uiComponentsToUse.map(c => c.component)
        });


      }

      if (uiComponentsToUse.length > 0) {


        // Extract search query from message content or use a default
        const searchQuery = message.content.match(/search.*?["']([^"']+)["']/i)?.[1] ||
                           message.content.match(/looking for\s+([^\s.!?]+)/i)?.[1] ||
                           'search results';

        return (
          <EnhancedSearchResults
            results={message.searchResults.results}
            uiComponents={uiComponentsToUse}
            searchQuery={searchQuery}
            totalResults={message.searchResults.total || message.searchResults.results.length}
            className="mt-4"
          />
        );
      }
    }

    if (hasUIComponents) {
      // Extract search query from message content or use a default
      const searchQuery = message.content.match(/search.*?["']([^"']+)["']/i)?.[1] ||
                         message.content.match(/looking for\s+([^\s.!?]+)/i)?.[1] ||
                         'search results';

      return (
        <EnhancedSearchResults
          results={message.searchResults.results}
          uiComponents={parsedComponents}
          searchQuery={searchQuery}
          totalResults={message.searchResults.total || message.searchResults.results.length}
          className="mt-4"
        />
      );
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
                  
                  <div className="flex mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleViewReceiptNewWindow(receipt.id, 'receipt')}
                      title={`View receipt details from ${receipt.merchant || 'Unknown'} in new tab`}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View Details
                    </Button>
                  </div>
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
                  
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => handleViewReceipt(lineItem.parent_receipt_id || lineItem.receipt_id, 'line_item', e)}
                      onMouseDown={(e) => {
                        // Handle middle click
                        if (e.button === 1) {
                          e.preventDefault();
                          handleViewReceipt(lineItem.parent_receipt_id || lineItem.receipt_id, 'line_item', e);
                        }
                      }}
                      title={`View parent receipt from ${lineItem.parent_receipt_merchant || 'Unknown'} (Ctrl/Cmd+click for new window)`}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View Parent Receipt
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2"
                      onClick={() => handleViewReceiptNewWindow(lineItem.parent_receipt_id || lineItem.receipt_id, 'line_item')}
                      title={`Open ${lineItem.parent_receipt_merchant || 'Unknown'} receipt in new window`}
                    >
                      <ExternalLinkIcon className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          }

          // Fallback for unknown result types
          return null;
        })}
      </div>
    );
  };

  if (message.type === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="flex items-start space-x-2 max-w-[80%]">
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2">
            <MarkdownRenderer
              content={message.content}
              variant="compact"
              className="text-primary-foreground [&_code]:bg-primary-foreground/20 [&_pre]:bg-primary-foreground/20"
            />
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
            <ChatMarkdownRenderer
              content={displayedText}
              isStreaming={isStreaming}
              className="text-sm mb-2"
            />
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
