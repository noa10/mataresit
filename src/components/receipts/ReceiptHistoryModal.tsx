import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Correction, ProcessingLog } from '@/types/receipt';
import { fetchCorrections } from '@/services/receiptService';
import { Loader2 } from 'lucide-react';

interface ReceiptHistoryModalProps {
  receiptId: string;
  processingLogs: ProcessingLog[]; // Pass existing logs if available
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ReceiptHistoryModal: React.FC<ReceiptHistoryModalProps> = ({
  receiptId,
  processingLogs,
  open,
  onOpenChange,
}) => {
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && receiptId) {
      setIsLoading(true);
      setError(null);
      fetchCorrections(receiptId)
        .then(data => {
          setCorrections(data);
        })
        .catch(err => {
          console.error("Failed to fetch corrections:", err);
          setError("Failed to load correction history.");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, receiptId]);

  // Combine and sort logs and corrections by date
  const combinedHistory = [...processingLogs, ...corrections]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Receipt History</DialogTitle>
          <DialogDescription>
            View the processing logs and manual corrections made to this receipt.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {isLoading && (
            <div className="flex justify-center items-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading history...</span>
            </div>
          )}
          {error && <p className="text-red-500 text-center">{error}</p>}
          {!isLoading && !error && combinedHistory.length === 0 && (
            <p className="text-muted-foreground text-center">No history available for this receipt.</p>
          )}
          {!isLoading && !error && combinedHistory.length > 0 && (
            <ul className="space-y-4">
              {combinedHistory.map((item, index) => (
                <li key={index} className="border-l-2 pl-4 py-2">
                  <p className="text-sm text-muted-foreground">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                  {'status_message' in item ? ( // Check if it's a ProcessingLog
                    <div>
                      <p className="font-medium">Processing Log</p>
                      <p>Status: {item.status_message}</p>
                      {item.step_name && <p>Step: {item.step_name}</p>}
                    </div>
                  ) : ( // It's a Correction
                    <div>
                       <p className="font-medium">Manual Correction</p>
                       <p>Field: <span className="font-semibold">{item.field_name}</span></p>
                       <p>Original: <span className="text-muted-foreground line-through">{item.original_value ?? 'N/A'}</span></p>
                       {item.ai_suggestion && <p>AI Suggestion: <span className="text-blue-500">{item.ai_suggestion}</span></p>}
                       <p>Corrected: <span className="text-green-600 font-semibold">{item.corrected_value}</span></p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 