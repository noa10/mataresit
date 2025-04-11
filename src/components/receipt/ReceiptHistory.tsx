
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Check, X, Clock, Eye, Loader2 } from "lucide-react";

interface HistoryEntry {
  id: string;
  timestamp: string;
  action: 'create' | 'edit' | 'process' | 'sync';
  user: string;
  details?: string;
  changes?: Array<{
    field: string;
    previous?: string | number;
    current: string | number;
  }>;
}

interface ReceiptHistoryProps {
  receiptId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReceiptHistory({ receiptId, open, onOpenChange }: ReceiptHistoryProps) {
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  
  // Mock fetch history data - in a real app this would call an API
  React.useEffect(() => {
    if (open) {
      setIsLoading(true);
      
      // Simulate API call
      setTimeout(() => {
        // This is mock data - in a real app you'd fetch this from your API
        const mockHistory: HistoryEntry[] = [
          {
            id: '1',
            timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
            action: 'edit',
            user: 'You',
            changes: [
              { field: 'merchant', previous: 'StarCoffee', current: 'Star Coffee' },
              { field: 'total', previous: 24.99, current: 24.95 }
            ]
          },
          {
            id: '2',
            timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
            action: 'process',
            user: 'System',
            details: 'Receipt processed with OCR + AI'
          },
          {
            id: '3',
            timestamp: new Date(Date.now() - 1000 * 60 * 65).toISOString(), // 1 hour 5 minutes ago
            action: 'create',
            user: 'You',
            details: 'Receipt created and image uploaded'
          }
        ];
        
        setHistory(mockHistory);
        setIsLoading(false);
      }, 1500);
    }
  }, [open, receiptId]);
  
  // Format the timestamp to a readable date
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: 'numeric', 
      hour12: true 
    });
  };
  
  // Get the action badge props - fixing the "success" variant issue
  const getActionBadge = (action: HistoryEntry['action']) => {
    switch (action) {
      case 'create':
        return { variant: 'default' as const, children: 'Created' };
      case 'edit':
        return { variant: 'outline' as const, children: 'Edited' };
      case 'process':
        return { variant: 'secondary' as const, children: 'Processed' };
      case 'sync':
        return { variant: 'secondary' as const, children: 'Synced' };
      default:
        return { variant: 'outline' as const, children: action };
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg md:max-w-xl">
        <DialogHeader>
          <DialogTitle>Receipt History</DialogTitle>
          <DialogDescription>
            View the history of changes and updates to this receipt
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading history...</p>
          </div>
        ) : (
          <>
            {history.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No history available for this receipt</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-4 py-2">
                  {history.map((entry) => (
                    <div key={entry.id} className="border border-border/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge {...getActionBadge(entry.action)} />
                          <span className="text-sm font-medium">{entry.user}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          <Clock className="inline h-3 w-3 mr-1" />
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>
                      
                      {entry.details && (
                        <p className="text-sm text-muted-foreground">{entry.details}</p>
                      )}
                      
                      {entry.changes && entry.changes.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {entry.changes.map((change, idx) => (
                            <div key={idx} className="text-sm">
                              <span className="font-medium">{change.field.charAt(0).toUpperCase() + change.field.slice(1)}</span>
                              <div className="grid grid-cols-2 gap-2 mt-1">
                                <div className="text-destructive flex items-center">
                                  <X className="h-3 w-3 mr-1" /> 
                                  {change.previous?.toString() || 'empty'}
                                </div>
                                <div className="text-green-500 flex items-center">
                                  <Check className="h-3 w-3 mr-1" /> 
                                  {change.current.toString()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            
            <div className="mt-4 flex justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1" 
                onClick={() => onOpenChange(false)}
              >
                <Eye size={14} />
                View Receipt
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
