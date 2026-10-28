import { useBatchFileUpload } from "@/hooks/useBatchFileUpload";
import { useSettings } from "@/hooks/useSettings";
import type { BatchUploadHookReturn } from "@/contexts/BackgroundUploadContext";
import { BatchUploadSheet } from "@/components/upload/batch/BatchUploadSheet";

interface BatchUploadZoneProps {
  onUploadComplete?: () => void;
  /**
   * When provided, use the shared upload state from BackgroundUploadContext so
   * the batch survives the modal closing. Otherwise the component owns a local
   * hook instance for standalone/test usage.
   */
  backgroundUpload?: BatchUploadHookReturn;
  onRequestClose?: () => void;
  onOpenReceipt?: (receiptId: string) => void;
}

function BatchUploadZone({
  onUploadComplete,
  backgroundUpload,
  onRequestClose,
  onOpenReceipt,
}: BatchUploadZoneProps) {
  const { settings } = useSettings();

  const localUpload = useBatchFileUpload(
    backgroundUpload
      ? undefined
      : {
          maxConcurrent: settings?.batchUpload?.maxConcurrent || 2,
          autoStart: settings?.batchUpload?.autoStart || false,
          processingStrategy: "balanced",
          enableRateLimiting: true,
          enableSessionTracking: true,
          enableProgressTracking: true,
          progressTrackingMode: "enhanced",
          enableETACalculation: true,
          enablePerformanceAlerts: true,
          enableQualityTracking: false,
        }
  );

  return (
    <BatchUploadSheet
      upload={backgroundUpload || localUpload}
      onUploadComplete={onUploadComplete}
      onRequestClose={onRequestClose}
      onOpenReceipt={onOpenReceipt}
    />
  );
}

export default BatchUploadZone;
export { BatchUploadZone };
