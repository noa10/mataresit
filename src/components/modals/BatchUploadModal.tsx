import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import BatchUploadZone from "@/components/BatchUploadZone";
import { useCallback } from "react";

interface BatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
}

export function BatchUploadModal({ isOpen, onClose, onUploadComplete }: BatchUploadModalProps) {
  // Create a custom upload complete handler that doesn't close the modal
  const handleUploadComplete = useCallback(() => {
    // Call the original onUploadComplete callback to refresh data
    // but don't close the modal
    if (onUploadComplete) {
      onUploadComplete();
    }

    // We're intentionally NOT closing the modal here
    // This allows users to see the results and take further actions
    console.log("Batch upload complete, keeping modal open for review");
  }, [onUploadComplete]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] h-[80vh] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Batch Upload Receipts</DialogTitle>
          <DialogDescription>
            Upload and process multiple receipts at once. You can add files to the queue and process them in batches.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-auto">
          <BatchUploadZone
            onUploadComplete={handleUploadComplete}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
