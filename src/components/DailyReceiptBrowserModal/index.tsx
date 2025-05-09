import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ReceiptWithDetails } from '@/types/receipt';
import { fetchReceiptsByIds } from '@/services/receiptService';
import ReceiptViewer from '@/components/ReceiptViewer';

import './receipt-calendar.css';

// Helper function for date formatting
const formatFullDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return dateString;
  }
};

interface DailyReceiptBrowserModalProps {
  date: string;
  receiptIds: string[];
  isOpen: boolean;
  onClose: () => void;
}

const DailyReceiptBrowserModal: React.FC<DailyReceiptBrowserModalProps> = ({ date, receiptIds, isOpen, onClose }) => {
  // Fetch all receipts for the given IDs
  const { data: receiptsData, isLoading, error } = useQuery<ReceiptWithDetails[], Error>({
    queryKey: ['receiptsForDay', date, receiptIds],
    queryFn: () => fetchReceiptsByIds(receiptIds),
    enabled: isOpen && receiptIds.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // State to track the currently selected receipt ID
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  // Handler for when a receipt is deleted
  const handleReceiptDelete = (deletedId: string) => {
    if (!receiptsData) return;
    const idx = receiptsData.findIndex(r => r.id === deletedId);
    const newReceipts = receiptsData.filter(r => r.id !== deletedId);
    if (newReceipts.length === 0) {
      setSelectedReceiptId(null); // No receipts left
      // Optionally close modal if no receipts remain
      onClose();
    } else {
      // Pick next receipt, or previous if last was deleted
      const nextIdx = idx < newReceipts.length ? idx : newReceipts.length - 1;
      setSelectedReceiptId(newReceipts[nextIdx].id);
    }
  };

  // Effect to set the first receipt as selected when data loads or IDs change
  useEffect(() => {
    if (receiptsData && receiptsData.length > 0 && !selectedReceiptId) {
      setSelectedReceiptId(receiptsData[0].id);
    } else if ((!receiptsData || receiptsData.length === 0) && selectedReceiptId) {
      // Reset if data becomes empty while a receipt was selected
      setSelectedReceiptId(null);
    }
  }, [receiptsData, selectedReceiptId]);

  // Find the currently selected receipt data
  const currentReceipt = receiptsData?.find(r => r.id === selectedReceiptId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle>
            {receiptIds.length > 0
              ? `${receiptIds.length} Receipt${receiptIds.length !== 1 ? 's' : ''} - ${formatFullDate(date)}`
              : `Receipts for ${formatFullDate(date)}`
            }
          </DialogTitle>
        </DialogHeader>

        {/* Main content area: Sidebar (Thumbnails/List) + Viewer */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar for Receipt List/Thumbnails */}
          <div className="w-64 border-r border-border flex flex-col">
            <div className="p-4 text-sm font-medium text-muted-foreground border-b border-border">
              {receiptsData?.length || 0} Receipt{receiptsData?.length !== 1 ? 's' : ''}
            </div>
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground text-sm">Loading receipts...</div>
            ) : error ? (
              <div className="p-4 text-center text-destructive text-sm">Error: {(error as Error).message}</div>
            ) : receiptsData && receiptsData.length > 0 ? (
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {receiptsData.map((receipt) => (
                    <Button
                      key={receipt.id}
                      variant={selectedReceiptId === receipt.id ? 'secondary' : 'ghost'}
                      size="sm"
                      className="w-full justify-start text-left h-auto py-2 text-sm"
                      onClick={() => setSelectedReceiptId(receipt.id)}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{receipt.merchant || `Receipt (${receipt.id.substring(0, 6)}...)`}</span>
                        <span className="text-xs text-muted-foreground/80">
                          {receipt.date ? formatFullDate(receipt.date) : 'Unknown Date'} -
                          {receipt.total ? ` MYR ${receipt.total.toFixed(2)}` : ' N/A'}
                        </span>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="p-4 text-center text-muted-foreground text-sm">No receipts found for this day.</div>
            )}
          </div>

          {/* Main Viewer Area */}
          <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
            {currentReceipt ? (
              <div className="p-4 flex-1 h-full flex flex-col min-h-0">
                <ReceiptViewer receipt={currentReceipt} onDelete={handleReceiptDelete} />
              </div>
            ) : isLoading ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading receipt details...</div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">Select a receipt from the list.</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DailyReceiptBrowserModal;