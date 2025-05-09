import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import BatchUploadZone from "@/components/BatchUploadZone";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
}

export function BatchUploadModal({ isOpen, onClose, onUploadComplete }: BatchUploadModalProps) {
  const navigate = useNavigate();

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

  // Handler for View All Receipts button
  const handleViewAllReceipts = useCallback(() => {
    // Navigate to dashboard and close the modal
    navigate('/dashboard');
    onClose();
    console.log("Navigating to dashboard from BatchUploadModal");
  }, [navigate, onClose]);

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

        <div className="flex justify-between items-center pt-4 border-t mt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleViewAllReceipts}>
            View All Receipts
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
