import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
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

  // State to track the currently selected receipt ID and local receipts data
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [localReceiptsData, setLocalReceiptsData] = useState<ReceiptWithDetails[] | undefined>(receiptsData);
  // State for collapsible sidebar in mobile view
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Sync local data with fetched data
  useEffect(() => {
    setLocalReceiptsData(receiptsData);
  }, [receiptsData]);

  // Handler for when a receipt is updated
  const handleReceiptUpdate = (updatedReceipt: ReceiptWithDetails) => {
    if (localReceiptsData) {
      const updatedData = localReceiptsData.map(r =>
        r.id === updatedReceipt.id ? updatedReceipt : r
      );
      setLocalReceiptsData(updatedData);
    }
  };

  // Handler for when a receipt is deleted
  const handleReceiptDelete = (deletedId: string) => {
    if (!localReceiptsData) return;
    const idx = localReceiptsData.findIndex(r => r.id === deletedId);
    const newReceipts = localReceiptsData.filter(r => r.id !== deletedId);
    setLocalReceiptsData(newReceipts);

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
    if (localReceiptsData && localReceiptsData.length > 0 && !selectedReceiptId) {
      setSelectedReceiptId(localReceiptsData[0].id);
    } else if ((!localReceiptsData || localReceiptsData.length === 0) && selectedReceiptId) {
      // Reset if data becomes empty while a receipt was selected
      setSelectedReceiptId(null);
    }
  }, [localReceiptsData, selectedReceiptId]);

  // Find the currently selected receipt data
  const currentReceipt = localReceiptsData?.find(r => r.id === selectedReceiptId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] md:h-[90vh] flex flex-col p-0">
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
        <div className="flex flex-1 min-h-0 flex-col md:flex-row">
          {/* Sidebar for Receipt List/Thumbnails */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border flex flex-col">
            {/* Mobile collapsible header */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                className="w-full p-4 text-sm font-medium text-muted-foreground border-b border-border flex justify-between items-center"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              >
                <span>{localReceiptsData?.length || 0} Receipt{localReceiptsData?.length !== 1 ? 's' : ''}</span>
                {isSidebarCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            </div>

            {/* Desktop header */}
            <div className="hidden md:block p-4 text-sm font-medium text-muted-foreground border-b border-border">
              {localReceiptsData?.length || 0} Receipt{localReceiptsData?.length !== 1 ? 's' : ''}
            </div>

            {/* Collapsible content */}
            <div className={`flex flex-col flex-1 ${isSidebarCollapsed ? 'hidden md:flex' : 'flex'}`}>
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground text-sm">Loading receipts...</div>
              ) : error ? (
                <div className="p-4 text-center text-destructive text-sm">Error: {(error as Error).message}</div>
              ) : localReceiptsData && localReceiptsData.length > 0 ? (
                <ScrollArea className="flex-1 max-h-[200px] md:max-h-none">
                  <div className="p-2 space-y-1">
                    {localReceiptsData.map((receipt) => (
                      <Button
                        key={receipt.id}
                        variant={selectedReceiptId === receipt.id ? 'secondary' : 'ghost'}
                        size="sm"
                        className="w-full justify-start text-left h-auto py-2 text-sm"
                        onClick={() => {
                          setSelectedReceiptId(receipt.id);
                          // Auto-collapse sidebar on mobile after selection
                          setIsSidebarCollapsed(true);
                        }}
                      >
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{receipt.merchant || `Receipt (${receipt.id.substring(0, 6)}...)`}</span>
                          <span className="text-xs text-muted-foreground/80">
                            {receipt.date ? formatFullDate(receipt.date) : 'Unknown Date'} -
                            {receipt.total ? ` ${receipt.currency || 'MYR'} ${receipt.total.toFixed(2)}` : ' N/A'}
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
          </div>

          {/* Main Viewer Area */}
          <div className="flex-1 flex flex-col min-h-0">
            {currentReceipt ? (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-4 min-h-full">
                  <ReceiptViewer
                    receipt={currentReceipt}
                    onDelete={handleReceiptDelete}
                    onUpdate={handleReceiptUpdate}
                  />
                </div>
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