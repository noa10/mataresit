import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import BatchUploadZone from "@/components/BatchUploadZone";

interface BatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
}

export function BatchUploadModal({ isOpen, onClose, onUploadComplete }: BatchUploadModalProps) {
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
            onUploadComplete={onUploadComplete}
            maxConcurrent={3}
            autoStart={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
