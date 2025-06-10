import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import BatchUploadZone from "@/components/BatchUploadZone";
import UploadZone from "@/components/UploadZone";
import { useCallback, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Files } from "lucide-react";

interface BatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
}

export function BatchUploadModal({ isOpen, onClose, onUploadComplete }: BatchUploadModalProps) {
  const [activeTab, setActiveTab] = useState<string>("single");

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
      <DialogContent className="sm:max-w-[900px] w-[95vw] h-[85vh] max-h-[95vh] min-h-[500px] sm:min-h-[600px] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle>Upload Receipts</DialogTitle>
          <DialogDescription>
            Upload and process your receipts. You can upload a single receipt or process multiple receipts at once.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="single"
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-grow flex flex-col min-h-0 overflow-hidden"
        >
          <TabsList className="mb-4 self-center flex-shrink-0">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <Upload size={16} />
              Single Upload
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex items-center gap-2">
              <Files size={16} />
              Batch Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="flex-grow data-[state=active]:flex flex-col min-h-0 mt-0 overflow-hidden">
            <div className="flex-grow min-h-0 overflow-y-auto overflow-x-hidden">
              <UploadZone
                onUploadComplete={handleUploadComplete}
              />
            </div>
          </TabsContent>

          <TabsContent value="batch" className="flex-grow data-[state=active]:flex flex-col min-h-0 mt-0 overflow-hidden">
            <div className="flex-grow min-h-0 overflow-y-auto overflow-x-hidden">
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
