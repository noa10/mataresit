import {
  MobileDialog as Dialog,
  MobileDialogContent as DialogContent,
  MobileDialogHeader as DialogHeader,
  MobileDialogTitle as DialogTitle,
  MobileDialogDescription as DialogDescription
} from "@/components/ui/mobile-dialog";
import BatchUploadZone from "@/components/BatchUploadZone";
import { useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBackgroundUpload } from "@/contexts/BackgroundUploadContext";

interface BatchUploadModalProps {
  onUploadComplete?: () => void;
}

export function BatchUploadModal({ onUploadComplete }: BatchUploadModalProps) {
  const isMobile = useIsMobile();

  // Consume upload state & modal control from the background context.
  // The context persists state across modal open/close cycles.
  const backgroundUpload = useBackgroundUpload();
  const { isModalOpen, closeModal } = backgroundUpload;

  // Create a custom upload complete handler that doesn't close the modal
  const handleUploadComplete = useCallback(() => {
    // Call the original onUploadComplete callback to refresh data
    // but don't close the modal
    if (onUploadComplete) {
      onUploadComplete();
    }

    // We're intentionally NOT closing the modal here
    // This allows users to see the results and take further actions
    console.log("Upload complete, keeping modal open for review");
  }, [onUploadComplete]);

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className={`
        ${isMobile
          ? "w-full h-full max-w-none max-h-none p-4"
          : "sm:max-w-[900px] w-[95vw] max-w-[95vw] h-[85vh] max-h-[95vh] min-h-[600px] p-6"
        }
        flex flex-col overflow-hidden border-ledger-line bg-ledger-paper
      `}>
        <DialogHeader className={`flex-shrink-0 border-b border-ledger-line ${isMobile ? "pb-2" : "pb-4"}`}>
          <p className="font-data text-[0.58rem] uppercase tracking-[0.18em] text-ledger-muted">
            Add to the ledger
          </p>
          <DialogTitle
            className={`font-display text-ledger-ink ${isMobile ? "text-xl" : "text-[1.7rem] leading-tight"}`}
          >
            Upload Receipts
          </DialogTitle>
          <DialogDescription className="text-sm text-ledger-muted">
            Add one receipt or many — drop them here and the batch queue handles the rest.
          </DialogDescription>
        </DialogHeader>

        <div className={`flex-grow flex flex-col min-h-0 pt-4 ${isMobile ? "h-full overflow-y-auto" : "overflow-hidden"}`}>
          <BatchUploadZone
            onUploadComplete={handleUploadComplete}
            backgroundUpload={backgroundUpload}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
