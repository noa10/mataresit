Okay, let's address the scrolling issues and the cut-off content.

The problem lies primarily with the overflow-hidden CSS property applied to the containers that should be allowing scrolling.

Main Content Scrolling: The main viewer area (<div className="flex-1 overflow-hidden flex flex-col">) has overflow-hidden. This explicitly prevents any content inside it that exceeds its height from being visible or scrollable. This is why the bottom part, likely containing save/edit buttons, is cut off.

Sidebar Scrolling: The sidebar list (<ScrollArea className="flex-1">) already uses ScrollArea and is set to flex-1 within its flex column parent. This structure should make the list scrollable if it exceeds the sidebar's height. If it's not working, there might be a subtle CSS conflict, but the intent is there. Let's ensure the main content fix doesn't negatively impact it, and potentially add overflow-y-auto to the sidebar's parent container as a fallback or belt-and-suspenders approach, though ScrollArea is the intended way.

Parent Container Overflow: The flex container wrapping both the sidebar and the main viewer (<div className="flex flex-1 overflow-hidden">) also has overflow-hidden. This is redundant and can sometimes interfere with scrolling on the children.

Here's how to fix it:

Remove overflow-hidden from the parent flex container.

Change overflow-hidden to overflow-y-auto on the main viewer container. This tells the browser to add a vertical scrollbar if the content overflows.

Keep the ScrollArea in the sidebar as it's the correct shadcn/ui way to handle scrolling with custom scrollbar styling.

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ReceiptWithDetails } from '@/types/receipt';
import { fetchReceiptsByIds } from '@/services/receiptService';
import ReceiptViewer, { ReceiptViewerProps } from '@/components/ReceiptViewer';

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
      {/* Ensure DialogContent allows flex column layout and takes height */}
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0">
        {/* Header - Fixed height */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle>Receipts for {formatFullDate(date)}</DialogTitle>
        </DialogHeader>

        {/* Main content area: Sidebar (Thumbnails/List) + Viewer */}
        {/* This container flexes horizontally and takes remaining vertical space */}
-       <div className="flex flex-1 overflow-hidden">
+       <div className="flex flex-1"> {/* Removed overflow-hidden */}
          {/* Sidebar for Receipt List/Thumbnails */}
          {/* Sidebar is a flex column */}
           <div className="w-64 border-r border-border flex flex-col">
+            {/* Sidebar Header/Count - Fixed height */}
             <div className="p-4 text-sm font-medium text-muted-foreground border-b border-border">
               {receiptsData?.length || 0} Receipt{receiptsData?.length !== 1 ? 's' : ''}
             </div>
             {isLoading ? (
               <div className="p-4 text-center text-muted-foreground text-sm">Loading receipts...</div>
             ) : error ? (
               <div className="p-4 text-center text-destructive text-sm">Error: {(error as Error).message}</div>
             ) : receiptsData && receiptsData.length > 0 ? (
+              {/* Scrollable list area - takes remaining vertical space in sidebar */}
               <ScrollArea className="flex-1"> {/* flex-1 ensures it grows to fill space and allows ScrollArea to work */}
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
+          {/* Main viewer is a flex column and should allow its content to scroll vertically */}
-          <div className="flex-1 overflow-hidden flex flex-col">
+          <div className="flex-1 overflow-y-auto flex flex-col"> {/* Changed overflow-hidden to overflow-y-auto */}
             {currentReceipt ? (
+              {/* ReceiptViewer content will now be scrollable within this container */}
               <ReceiptViewer receipt={currentReceipt} onDelete={handleReceiptDelete} />
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


Explanation of Changes:

DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0": This is already good. It sets a fixed size for the modal content area and makes it a flex column, allowing the header and the main content area (flex-1) to stack vertically.

<div className="flex flex-1">: Removed overflow-hidden. This is the container that holds both the sidebar and the main viewer horizontally. It should allow its children to manage their own overflow.

Sidebar (<div className="w-64 border-r border-border flex flex-col">): This is also a flex column.

The header (<div className="p-4 ...">) has a fixed height.

The ScrollArea className="flex-1" is correctly set up to take the remaining vertical space within the sidebar column and make its content (the list of buttons) scrollable. This part of the original code was likely correct for sidebar list scrolling.

Main Viewer (<div className="flex-1 overflow-y-auto flex flex-col">):

Changed overflow-hidden to overflow-y-auto. This is the key change for the main content. It makes this div a scrollable container.

flex-1 ensures it takes the remaining horizontal space.

flex flex-col ensures that if ReceiptViewer itself contains stacked elements, they behave correctly within this container.

Now, the main viewer area will display a vertical scrollbar when the content rendered by ReceiptViewer exceeds the height of the available space in the modal. This should reveal the cut-off elements like save buttons. The sidebar list, wrapped in ScrollArea, should also scroll independently if the list is long.