import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useBatchFileUpload, type BatchUploadOptions } from '@/hooks/useBatchFileUpload';
import { useSettings } from '@/hooks/useSettings';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The full return type of useBatchFileUpload (inferred). */
export type BatchUploadHookReturn = ReturnType<typeof useBatchFileUpload>;

export interface BackgroundUploadContextType extends BatchUploadHookReturn {
  /** Whether the upload modal is currently visible. */
  isModalOpen: boolean;
  /** Open the upload modal. */
  openModal: () => void;
  /** Close the upload modal WITHOUT aborting uploads. */
  closeModal: () => void;
  /** Whether there is an active or queued upload in the background. */
  hasActiveUpload: boolean;
  /** Callback for when any upload completes – allows pages to refresh data. */
  onUploadCompleteCallback: React.MutableRefObject<(() => void) | null>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const BackgroundUploadContext = createContext<BackgroundUploadContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface BackgroundUploadProviderProps {
  children: ReactNode;
}

export function BackgroundUploadProvider({ children }: BackgroundUploadProviderProps) {
  const { settings } = useSettings();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Mutable ref so pages can register their refresh callback without
  // causing the provider to re-render.
  const onUploadCompleteCallback = useRef<(() => void) | null>(null);

  // Instantiate the batch upload hook at the provider level so state persists
  // across modal open/close cycles.
  const batchUpload = useBatchFileUpload({
    maxConcurrent: settings?.batchUpload?.maxConcurrent || 2,
    autoStart: settings?.batchUpload?.autoStart || false,
    processingStrategy: 'balanced',
    enableRateLimiting: true,
    enableSessionTracking: true,
    enableProgressTracking: true,
    progressTrackingMode: 'enhanced',
    enableETACalculation: true,
    enablePerformanceAlerts: true,
    enableQualityTracking: false,
  });

  const {
    batchUploads,
    isProcessing,
    completedUploads,
    failedUploads,
    activeUploads,
    queuedUploads,
  } = batchUpload;

  // Derived state: are there uploads actively running or waiting?
  const hasActiveUpload =
    isProcessing ||
    activeUploads.length > 0 ||
    queuedUploads.length > 0;

  // -----------------------------------------------------------------------
  // Modal helpers
  // -----------------------------------------------------------------------
  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  // -----------------------------------------------------------------------
  // Completion notification
  // -----------------------------------------------------------------------
  // Track the previous isProcessing value so we can detect the transition
  // from processing → done.
  const wasProcessingRef = useRef(false);

  useEffect(() => {
    const justFinished =
      wasProcessingRef.current &&
      !isProcessing &&
      activeUploads.length === 0 &&
      queuedUploads.length === 0 &&
      (completedUploads.length > 0 || failedUploads.length > 0);

    if (justFinished) {
      const total = completedUploads.length + failedUploads.length;
      const successRate = Math.round((completedUploads.length / total) * 100);

      // Only show the background-notification toast when the modal is closed.
      // When the modal is open, BatchUploadZone already shows its own
      // in-modal completion UI.
      if (!isModalOpen) {
        if (failedUploads.length === 0) {
          toast.success(
            `All ${completedUploads.length} receipts uploaded successfully!`,
            {
              duration: 8000,
              action: {
                label: 'View Results',
                onClick: () => setIsModalOpen(true),
              },
            },
          );
        } else {
          toast.warning(
            `Upload complete: ${completedUploads.length}/${total} succeeded (${successRate}%)`,
            {
              duration: 10000,
              action: {
                label: 'View Results',
                onClick: () => setIsModalOpen(true),
              },
            },
          );
        }
      }

      // Fire the page-level refresh callback (e.g. Dashboard refetch)
      onUploadCompleteCallback.current?.();
    }

    wasProcessingRef.current = isProcessing;
  }, [
    isProcessing,
    activeUploads.length,
    queuedUploads.length,
    completedUploads.length,
    failedUploads.length,
    isModalOpen,
  ]);

  // -----------------------------------------------------------------------
  // Context value
  // -----------------------------------------------------------------------
  const value: BackgroundUploadContextType = {
    ...batchUpload,
    isModalOpen,
    openModal,
    closeModal,
    hasActiveUpload,
    onUploadCompleteCallback,
  };

  return (
    <BackgroundUploadContext.Provider value={value}>
      {children}
    </BackgroundUploadContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBackgroundUpload(): BackgroundUploadContextType {
  const ctx = useContext(BackgroundUploadContext);
  if (!ctx) {
    throw new Error('useBackgroundUpload must be used within a BackgroundUploadProvider');
  }
  return ctx;
}
