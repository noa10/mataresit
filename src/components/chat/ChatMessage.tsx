import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { User, Bot, Copy, ThumbsUp, ThumbsDown, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { SearchResult, ReceiptWithSimilarity, LineItemSearchResult } from '@/lib/ai-search';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  searchResults?: SearchResult;
  isLoading?: boolean;
}

interface ChatMessageProps {
  message: ChatMessage;
  onCopy?: (content: string) => void;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative') => void;
}

export function ChatMessage({ message, onCopy, onFeedback }: ChatMessageProps) {
  const navigate = useNavigate();
  const [displayedText, setDisplayedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // Streaming effect for AI messages
  useEffect(() => {
    if (message.type === 'ai' && message.content) {
      setIsStreaming(true);
      setDisplayedText('');

      const text = message.content;
      let currentIndex = 0;

      const streamInterval = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          setIsStreaming(false);
          clearInterval(streamInterval);
        }
      }, 20); // Adjust speed as needed

      return () => clearInterval(streamInterval);
    } else {
      setDisplayedText(message.content);
      setIsStreaming(false);
    }
  }, [message.content, message.type]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast.success('Message copied to clipboard');
    onCopy?.(message.content);
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

  const renderSearchResults = () => {
    if (!message.searchResults?.results) return null;

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
            const receiptDate = receipt.date ? new Date(receipt.date) : null;
            const similarityScore = receipt.similarity_score || 0;
            const formattedScore = Math.round(similarityScore * 100);

            return (
              <Card key={receipt.id} className="border-l-4 border-l-primary/50">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-sm">{receipt.merchant || 'Unknown Merchant'}</h4>
                    {similarityScore > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {formattedScore}% match
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    {receiptDate && (
                      <div>Date: {receiptDate.toLocaleDateString()}</div>
                    )}
                    {receipt.total_amount && (
                      <div>Total: ${receipt.total_amount.toFixed(2)}</div>
                    )}
                    {receipt.notes && (
                      <div className="text-xs">Notes: {receipt.notes}</div>
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
            const receiptDate = lineItem.parent_receipt_date ? new Date(lineItem.parent_receipt_date) : null;
            const similarityScore = lineItem.similarity_score || 0;
            const formattedScore = Math.round(similarityScore * 100);

            return (
              <Card key={lineItem.line_item_id} className="border-l-4 border-l-secondary/50">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-sm">{lineItem.line_item_description || 'Unknown Item'}</h4>
                    {similarityScore > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {formattedScore}% match
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>From: {lineItem.parent_receipt_merchant || 'Unknown Merchant'}</div>
                    {receiptDate && (
                      <div>Date: {receiptDate.toLocaleDateString()}</div>
                    )}
                    {lineItem.line_item_amount && (
                      <div>Amount: ${lineItem.line_item_amount.toFixed(2)}</div>
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
                {onFeedback && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onFeedback(message.id, 'positive')}
                      className="h-6 w-6 p-0"
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onFeedback(message.id, 'negative')}
                      className="h-6 w-6 p-0"
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </Button>
                  </>
                )}
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
