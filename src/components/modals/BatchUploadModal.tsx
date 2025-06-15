import {
  MobileDialog as Dialog,
  MobileDialogContent as DialogContent,
  MobileDialogHeader as DialogHeader,
  MobileDialogTitle as DialogTitle,
  MobileDialogDescription as DialogDescription
} from "@/components/ui/mobile-dialog";
import BatchUploadZone from "@/components/BatchUploadZone";
import UploadZone from "@/components/UploadZone";
import { useCallback, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Files } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface BatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
}

export function BatchUploadModal({ isOpen, onClose, onUploadComplete }: BatchUploadModalProps) {
  const [activeTab, setActiveTab] = useState<string>("single");
  const isMobile = useIsMobile();

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={`
        ${isMobile
          ? "w-full h-full max-w-none max-h-none p-4"
          : "sm:max-w-[900px] w-[95vw] max-w-[95vw] h-[85vh] max-h-[95vh] min-h-[600px] p-6"
        }
        flex flex-col overflow-hidden
      `}>
        <DialogHeader className={`flex-shrink-0 ${isMobile ? "pb-2" : "pb-4"}`}>
          <DialogTitle className={isMobile ? "text-lg" : "text-xl"}>Upload Receipts</DialogTitle>
          <DialogDescription className="text-sm">
            Upload and process your receipts. You can upload a single receipt or process multiple receipts at once.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="single"
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-grow flex flex-col min-h-0 overflow-hidden"
        >
          <TabsList className={`${isMobile ? "mb-2" : "mb-4"} self-center flex-shrink-0 ${isMobile ? "w-full" : "w-auto"}`}>
            <TabsTrigger
              value="single"
              className={`flex items-center gap-1 sm:gap-2 ${isMobile ? "flex-1" : "flex-initial"} text-xs sm:text-sm`}
            >
              <Upload size={isMobile ? 14 : 16} />
              {isMobile ? "Single" : "Single Upload"}
            </TabsTrigger>
            <TabsTrigger
              value="batch"
              className={`flex items-center gap-1 sm:gap-2 ${isMobile ? "flex-1" : "flex-initial"} text-xs sm:text-sm`}
            >
              <Files size={isMobile ? 14 : 16} />
              {isMobile ? "Batch" : "Batch Upload"}
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="single"
            className="flex-grow data-[state=active]:flex flex-col min-h-0 mt-0 overflow-hidden"
          >
            <div className={`flex-grow min-h-0 overflow-y-auto overflow-x-hidden ${isMobile ? "h-full" : ""}`}>
              <UploadZone
                onUploadComplete={handleUploadComplete}
              />
            </div>
          </TabsContent>

          <TabsContent
            value="batch"
            className="flex-grow data-[state=active]:flex flex-col min-h-0 mt-0 overflow-hidden"
          >
            <div className={`flex-grow min-h-0 overflow-y-auto overflow-x-hidden ${isMobile ? "h-full" : ""}`}>
              <BatchUploadZone
                onUploadComplete={handleUploadComplete}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
