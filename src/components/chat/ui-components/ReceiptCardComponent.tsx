/**
 * Receipt Card UI Component for Chat Interface
 * 
 * Renders an interactive receipt card with actions for viewing, editing, and categorizing receipts.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ExternalLink,
  Edit,
  Tag,
  Calendar,
  DollarSign,
  Store,
  FileText,
  Star,
  ExternalLinkIcon
} from 'lucide-react';
import { ReceiptCardData, UIComponentProps } from '@/types/ui-components';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { formatCurrencySafe } from '@/utils/currency';
import { handleReceiptClick, openReceiptInNewWindow } from '@/utils/navigationUtils';

interface ReceiptCardComponentProps extends Omit<UIComponentProps, 'component'> {
  data: ReceiptCardData;
  onAction?: (action: string, data?: any) => void;
  className?: string;
  compact?: boolean;
}

export function ReceiptCardComponent({
  data,
  onAction,
  className = '',
  compact = false
}: ReceiptCardComponentProps) {
  const navigate = useNavigate();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  // Format the receipt date for Malaysian context (DD/MM/YYYY)
  const formatDate = (dateString: string) => {
    try {
      // Handle various date formats and clean up any template placeholders
      let cleanDateString = dateString;

      // Remove any template placeholders like "{{date}}"
      cleanDateString = cleanDateString.replace(/\{\{date\}\}:?\s*/g, '').trim();

      // If the string is empty after cleanup, return a fallback
      if (!cleanDateString) {
        return 'Date not available';
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
            return parsedDate.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            });
          }
        }
        return cleanDateString; // Return original if can't parse
      }

      // Format as DD/MM/YYYY for Malaysian context
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  // Format currency amount
  const formatAmount = (amount: number, currency: string) => {
    return formatCurrencySafe(amount, currency, 'en-US', 'MYR');
  };

  // Handle action clicks with support for new window opening
  const handleAction = (action: string, event?: React.MouseEvent) => {
    const navigationOptions = {
      from: 'chat',
      itemType: 'receipt_card'
    };

    switch (action) {
      case 'view_receipt':
        if (event) {
          handleReceiptClick(event, data.receipt_id, navigate, navigationOptions);
        } else {
          navigate(`/receipt/${data.receipt_id}`, {
            state: navigationOptions
          });
        }
        break;
      case 'view_receipt_new_window':
        openReceiptInNewWindow(data.receipt_id, navigationOptions);
        break;
      case 'edit_receipt':
        const editOptions = { ...navigationOptions, openEditMode: true };
        if (event) {
          handleReceiptClick(event, data.receipt_id, navigate, editOptions);
        } else {
          navigate(`/receipt/${data.receipt_id}`, {
            state: editOptions
          });
        }
        toast.info('Opening receipt for editing...');
        break;
      case 'categorize_receipt':
        const categoryOptions = { ...navigationOptions, focusCategory: true };
        if (event) {
          handleReceiptClick(event, data.receipt_id, navigate, categoryOptions);
        } else {
          navigate(`/receipt/${data.receipt_id}`, {
            state: categoryOptions
          });
        }
        toast.info('Opening receipt for categorization...');
        break;
      default:
        console.log(`Unknown action: ${action}`);
    }

    // Call the onAction callback if provided
    onAction?.(action, { receipt_id: data.receipt_id, merchant: data.merchant, action });
  };

  // Handle right-click context menu
  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setShowContextMenu(true);
  };

  // Close context menu when clicking elsewhere
  React.useEffect(() => {
    const handleClickOutside = () => setShowContextMenu(false);
    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showContextMenu]);

  // Get confidence color based on confidence score
  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'secondary';
    if (confidence >= 0.9) return 'default';
    if (confidence >= 0.7) return 'secondary';
    return 'outline';
  };

  // Get confidence text
  const getConfidenceText = (confidence?: number) => {
    if (!confidence) return '';
    return `${Math.round(confidence * 100)}% confidence`;
  };

  if (compact) {
    return (
      <div className="relative">
        <Card
          className={`border-l-4 border-l-primary/50 hover:shadow-md transition-shadow ${className}`}
          onContextMenu={handleContextMenu}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Store className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <h4 className="font-medium text-sm truncate">{data.merchant}</h4>
                  {data.confidence && (
                    <Badge variant={getConfidenceColor(data.confidence)} className="text-xs">
                      {Math.round(data.confidence * 100)}%
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {formatAmount(data.total, data.currency)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(data.date)}
                  </span>
                </div>
              </div>
              <div className="flex gap-1 ml-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => handleAction('view_receipt', e)}
                  onMouseDown={(e) => {
                    // Handle middle click
                    if (e.button === 1) {
                      e.preventDefault();
                      handleAction('view_receipt', e);
                    }
                  }}
                  className="flex-shrink-0"
                  title={`View receipt from ${data.merchant} (Ctrl/Cmd+click for new window)`}
                  aria-label={`View receipt from ${data.merchant}`}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAction('view_receipt_new_window')}
                  className="flex-shrink-0 px-2"
                  title={`Open ${data.merchant} receipt in new window`}
                  aria-label={`Open ${data.merchant} receipt in new window`}
                >
                  <ExternalLinkIcon className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Context Menu */}
        {showContextMenu && (
          <div
            className="fixed z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[160px]"
            style={{
              left: contextMenuPosition.x,
              top: contextMenuPosition.y,
            }}
          >
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                handleAction('view_receipt');
                setShowContextMenu(false);
              }}
            >
              Open in Same Window
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                handleAction('view_receipt_new_window');
                setShowContextMenu(false);
              }}
            >
              Open in New Window
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <Card
        className={`border-l-4 border-l-primary/50 hover:shadow-lg transition-all duration-200 ${className}`}
        onContextMenu={handleContextMenu}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-base">{data.merchant}</h3>
            </div>
            {data.confidence && (
              <Badge variant={getConfidenceColor(data.confidence)} className="text-xs">
                <Star className="h-3 w-3 mr-1" />
                {getConfidenceText(data.confidence)}
              </Badge>
            )}
          </div>
        </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Receipt Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Total:</span>
              <span className="font-medium">{formatAmount(data.total, data.currency)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Date:</span>
              <span className="font-medium">{formatDate(data.date)}</span>
            </div>
          </div>

          {/* Optional Details */}
          {(data.category || data.line_items_count) && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {data.category && (
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Category:</span>
                  <Badge variant="outline" className="text-xs">
                    {data.category}
                  </Badge>
                </div>
              )}
              {data.line_items_count && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Items:</span>
                  <span className="font-medium">{data.line_items_count}</span>
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {data.tags && data.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {data.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => handleAction('view_receipt', e)}
              onMouseDown={(e) => {
                // Handle middle click
                if (e.button === 1) {
                  e.preventDefault();
                  handleAction('view_receipt', e);
                }
              }}
              className="flex-1"
              title={`View details for ${data.merchant} receipt (Ctrl/Cmd+click for new window)`}
              aria-label={`View details for ${data.merchant} receipt`}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Details
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => handleAction('edit_receipt', e)}
              onMouseDown={(e) => {
                // Handle middle click
                if (e.button === 1) {
                  e.preventDefault();
                  handleAction('edit_receipt', e);
                }
              }}
              className="flex-1"
              title={`Edit ${data.merchant} receipt (Ctrl/Cmd+click for new window)`}
              aria-label={`Edit ${data.merchant} receipt`}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            {!data.category && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => handleAction('categorize_receipt', e)}
                onMouseDown={(e) => {
                  // Handle middle click
                  if (e.button === 1) {
                    e.preventDefault();
                    handleAction('categorize_receipt', e);
                  }
                }}
                className="flex-1"
                title={`Categorize ${data.merchant} receipt (Ctrl/Cmd+click for new window)`}
                aria-label={`Categorize ${data.merchant} receipt`}
              >
                <Tag className="h-4 w-4 mr-2" />
                Categorize
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAction('view_receipt_new_window')}
              className="px-3"
              title={`Open ${data.merchant} receipt in new window`}
              aria-label={`Open ${data.merchant} receipt in new window`}
            >
              <ExternalLinkIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Context Menu */}
    {showContextMenu && (
      <div
        className="fixed z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[160px]"
        style={{
          left: contextMenuPosition.x,
          top: contextMenuPosition.y,
        }}
      >
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
          onClick={() => {
            handleAction('view_receipt');
            setShowContextMenu(false);
          }}
        >
          Open in Same Window
        </button>
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
          onClick={() => {
            handleAction('view_receipt_new_window');
            setShowContextMenu(false);
          }}
        >
          Open in New Window
        </button>
        <hr className="my-1 border-border" />
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
          onClick={() => {
            handleAction('edit_receipt');
            setShowContextMenu(false);
          }}
        >
          Edit Receipt
        </button>
        {!data.category && (
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              handleAction('categorize_receipt');
              setShowContextMenu(false);
            }}
          >
            Categorize Receipt
          </button>
        )}
      </div>
    )}
  </div>
  );
}
