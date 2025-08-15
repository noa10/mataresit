import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import { ReceiptWithDetails } from '@/types/receipt';
import { fetchReceiptsByIds } from '@/services/receiptService';
import { supabase } from '@/integrations/supabase/client';
import ReceiptViewer from '@/components/ReceiptViewer';
import { formatCurrencySafe } from '@/utils/currency';
import { useTeam } from '@/contexts/TeamContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  onReceiptDeleted?: (deletedId: string) => void;
}

const DailyReceiptBrowserModal: React.FC<DailyReceiptBrowserModalProps> = ({ date, receiptIds, isOpen, onClose, onReceiptDeleted }) => {
  const queryClient = useQueryClient();
  const { currentTeam } = useTeam();
  const isMobile = useIsMobile();

  // Fetch all receipts for the given IDs
  const { data: receiptsData, isLoading, error } = useQuery<ReceiptWithDetails[], Error>({
    queryKey: ['receiptsForDay', date, receiptIds, currentTeam?.id],
    queryFn: () => fetchReceiptsByIds(receiptIds, { currentTeam }),
    enabled: isOpen && receiptIds.length > 0,
    staleTime: 1 * 60 * 1000, // Reduced cache time to 1 minute for fresher data
  });

  // State to track the currently selected receipt ID and local receipts data
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [localReceiptsData, setLocalReceiptsData] = useState<ReceiptWithDetails[] | undefined>(receiptsData);
  // State for collapsible sidebar in mobile view
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      const teamKey = currentTeam?.id ? `dailyReceiptSidebarCollapsed:${currentTeam.id}` : 'dailyReceiptSidebarCollapsed';
      const stored = localStorage.getItem(teamKey);
      return stored ? stored === 'true' : false;
    } catch {
      return false;
    }
  });

  // Persist preference across sessions, namespaced by team
  useEffect(() => {
    try {
      const teamKey = currentTeam?.id ? `dailyReceiptSidebarCollapsed:${currentTeam.id}` : 'dailyReceiptSidebarCollapsed';
      localStorage.setItem(teamKey, String(isSidebarCollapsed));
    } catch {}
  }, [isSidebarCollapsed, currentTeam?.id]);


  // Sync local data with fetched data
  useEffect(() => {
    setLocalReceiptsData(receiptsData);
  }, [receiptsData]);

  // Listen for query invalidations and refresh data
  useEffect(() => {
    const handleQueryInvalidation = () => {
      // Force refetch when queries are invalidated
      queryClient.invalidateQueries({ queryKey: ['receiptsForDay', date, receiptIds] });
    };

    // Set up a listener for query cache changes
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.queryKey[0] === 'receiptsForDay') {
        // Query was updated, sync local data
        const updatedData = event.query.state.data as ReceiptWithDetails[] | undefined;
        if (updatedData) {
          setLocalReceiptsData(updatedData);
        }
      }
    });

    return unsubscribe;
  }, [queryClient, date, receiptIds]);

  // Set up real-time subscription for receipt processing status updates
  useEffect(() => {
    if (!isOpen || !receiptIds.length) return;

    const channel = supabase.channel(`modal-receipts-${date}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'receipts',
          // OPTIMIZATION: Only listen for meaningful status changes and data updates
          // Simplified filter to avoid Realtime binding mismatches - do complex filtering client-side
          filter: `id=in.(${receiptIds.join(',')})`
        },
        (payload) => {
          console.log('📝 Receipt update in modal:', payload.new);
          const updatedReceipt = payload.new as ReceiptWithDetails;

          // OPTIMIZATION: Only update if there are meaningful changes
          const hasSignificantChange =
            updatedReceipt.processing_status === 'complete' ||
            updatedReceipt.processing_status?.includes('failed') ||
            updatedReceipt.merchant ||
            updatedReceipt.total;

          if (hasSignificantChange) {
            // Update local data immediately
            setLocalReceiptsData(prev => {
              if (!prev) return prev;
              return prev.map(r =>
                r.id === updatedReceipt.id ? { ...r, ...updatedReceipt } : r
              );
            });

            // Also invalidate the query to ensure consistency
            queryClient.invalidateQueries({ queryKey: ['receiptsForDay', date, receiptIds] });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [isOpen, receiptIds, date, queryClient]);

  // Handler for when a receipt is updated
  const handleReceiptUpdate = (updatedReceipt: ReceiptWithDetails) => {
    if (localReceiptsData) {
      const updatedData = localReceiptsData.map(r =>
        r.id === updatedReceipt.id ? updatedReceipt : r
      );
      setLocalReceiptsData(updatedData);
    }

    // Invalidate the modal's query to ensure fresh data
    queryClient.invalidateQueries({ queryKey: ['receiptsForDay', date, receiptIds] });
  };

  // Handler for when a receipt is deleted
  const handleReceiptDelete = (deletedId: string) => {
    if (!localReceiptsData) return;
    const idx = localReceiptsData.findIndex(r => r.id === deletedId);
    const newReceipts = localReceiptsData.filter(r => r.id !== deletedId);
    setLocalReceiptsData(newReceipts);

    // Notify parent component about the deletion
    if (onReceiptDeleted) {
      onReceiptDeleted(deletedId);
    }

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
      <DialogContent className="max-w-6xl w-[95vw] h-[90dvh] md:h-[90dvh] max-h-[100dvh] overflow-y-auto flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle>
            {receiptIds.length > 0
              ? `${receiptIds.length} Receipt${receiptIds.length !== 1 ? 's' : ''} - ${formatFullDate(date)}`
              : `Receipts for ${formatFullDate(date)}`
            }
          </DialogTitle>
          <DialogDescription>
            View and manage receipts from this date. Select a receipt from the list to view details.
          </DialogDescription>
        </DialogHeader>

        {/* Main content area: Sidebar (Thumbnails/List) + Viewer */}
        <div className="flex flex-1 min-h-0 flex-col md:flex-row">
          {/* Sidebar for Receipt List/Thumbnails */}
          <div className={`relative w-full ${isSidebarCollapsed ? "md:w-10" : "md:w-64"} border-b md:border-b-0 md:border-r border-border flex flex-col transition-all duration-200 overflow-hidden`}>
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

            {/* Desktop header with toggle (md+) */}
          <div className={`hidden md:flex items-center justify-between p-4 text-sm font-medium text-muted-foreground border-b border-border`}>
            <span className={isSidebarCollapsed ? 'sr-only' : ''}>{localReceiptsData?.length || 0} Receipt{localReceiptsData?.length !== 1 ? 's' : ''}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarCollapsed(prev => !prev)}
              aria-label={isSidebarCollapsed ? 'Expand receipt list' : 'Collapse receipt list'}
              aria-pressed={isSidebarCollapsed ? 'true' : 'false'}
              aria-expanded={!isSidebarCollapsed}
            >
              {isSidebarCollapsed ? (<ChevronRight className="h-4 w-4" />) : (<ChevronLeft className="h-4 w-4" />)}
            </Button>
          </div>

            {/* Collapsible content */}
            <div className={`flex flex-col flex-1 min-h-0 ${isSidebarCollapsed ? 'hidden' : 'flex'}`}>
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground text-sm">Loading receipts...</div>
              ) : error ? (
                <div className="p-4 text-center text-destructive text-sm">Error: {(error as Error).message}</div>
              ) : localReceiptsData && localReceiptsData.length > 0 ? (
                <ScrollArea className="flex-1 h-full">
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
                          if (isMobile) { setIsSidebarCollapsed(true); }
                        }}
                      >
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{receipt.merchant || `Receipt (${receipt.id.substring(0, 6)}...)`}</span>
                          <span className="text-xs text-muted-foreground/80">
                            {receipt.date ? formatFullDate(receipt.date) : 'Unknown Date'} -
                            {receipt.total ? ` ${formatCurrencySafe(receipt.total, receipt.currency, 'en-US', 'MYR')}` : ' N/A'}
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