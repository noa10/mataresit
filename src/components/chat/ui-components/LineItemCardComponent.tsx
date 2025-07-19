/**
 * Line Item Card UI Component for Chat Interface
 * 
 * Renders an interactive line item card with actions for viewing the parent receipt.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ExternalLink,
  Calendar,
  DollarSign,
  Store,
  Package,
  Receipt as ReceiptIcon,
  Star
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { formatCurrencySafe } from '@/utils/currency';
import { handleReceiptClick, openReceiptInNewWindow } from '@/utils/navigationUtils';

// Line Item Card Data Interface
export interface LineItemCardData {
  line_item_id: string;
  receipt_id?: string;
  description: string;
  amount: number;
  currency: string;
  merchant: string;
  date: string;
  confidence?: number;
  quantity?: number;
}

export interface LineItemCardComponentProps {
  data: LineItemCardData;
  onAction?: (action: string, data?: any) => void;
  compact?: boolean;
  className?: string;
}

export function LineItemCardComponent({
  data,
  onAction,
  compact = false,
  className = ''
}: LineItemCardComponentProps) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  // Format amount with currency
  const formatAmount = (amount: number, currency: string) => {
    return formatCurrencySafe(amount, currency, 'en-US', 'MYR');
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  // Handle action clicks with support for new window opening
  const handleAction = (action: string, event?: React.MouseEvent) => {
    const navigationOptions = {
      from: 'chat',
      itemType: 'line_item_card'
    };

    switch (action) {
      case 'view_receipt':
        if (data.receipt_id) {
          if (event) {
            handleReceiptClick(event, data.receipt_id, navigate, navigationOptions);
          } else {
            navigate(`/receipt/${data.receipt_id}`, {
              state: navigationOptions
            });
          }
        } else {
          toast.error('Receipt not available', {
            description: 'This line item is not linked to a receipt.'
          });
        }
        break;
      case 'view_receipt_new_window':
        if (data.receipt_id) {
          openReceiptInNewWindow(data.receipt_id, navigationOptions);
        } else {
          toast.error('Receipt not available', {
            description: 'This line item is not linked to a receipt.'
          });
        }
        break;
      case 'view_item_details':
        toast.info('Item details', {
          description: `${data.description} - ${formatAmount(data.amount, data.currency)}`
        });
        break;
      default:
        console.log(`Unknown action: ${action}`);
    }

    // Call the onAction callback if provided
    onAction?.(action, { 
      line_item_id: data.line_item_id, 
      receipt_id: data.receipt_id,
      description: data.description, 
      action 
    });
  };

  // Handle context menu for additional actions
  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    // Could implement a context menu here in the future
  };

  if (compact) {
    return (
      <div className={`flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors ${className}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-md">
            <Package className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="font-medium text-sm">{data.description}</p>
            <p className="text-xs text-muted-foreground">{data.merchant}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-semibold text-sm">{formatAmount(data.amount, data.currency)}</p>
          <p className="text-xs text-muted-foreground">{formatDate(data.date)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative group">
      <Card
        className={`border-l-4 border-l-orange-500/60 hover:border-l-orange-500 hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 bg-gradient-to-r from-background to-background/95 ${className}`}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50 transition-colors duration-200">
                <Package className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-foreground group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-200">
                  {data.description}
                </h3>
                <p className="text-sm text-muted-foreground">{data.merchant}</p>
              </div>
            </div>
            {data.confidence && (
              <Badge variant="outline" className={`${getConfidenceColor(data.confidence)} border-current`}>
                <Star className="h-3 w-3 mr-1" />
                {Math.round(data.confidence * 100)}%
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-4">
            {/* Line Item Details */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-2 bg-background/50 rounded-md">
                  <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-md">
                    <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Amount</p>
                    <p className="font-semibold text-green-600 dark:text-green-400">
                      {formatAmount(data.amount, data.currency)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 bg-background/50 rounded-md">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                    <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Date</p>
                    <p className="font-semibold text-blue-600 dark:text-blue-400">
                      {formatDate(data.date)}
                    </p>
                  </div>
                </div>
              </div>

              {data.quantity && data.quantity > 1 && (
                <div className="flex items-center gap-3 p-2 bg-background/50 rounded-md">
                  <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-md">
                    <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Quantity</p>
                    <p className="font-semibold text-purple-600 dark:text-purple-400">
                      {data.quantity}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={(e) => handleAction('view_receipt', e)}
                disabled={!data.receipt_id}
              >
                <ReceiptIcon className="h-4 w-4 mr-2" />
                View Receipt
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => handleAction('view_receipt_new_window', e)}
                disabled={!data.receipt_id}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
