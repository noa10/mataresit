import React, { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useSaveStatus, useQueueStatus } from '@/contexts/SaveStatusContext';
import { SaveOperation } from '@/services/backgroundSaveService';
import { CheckCircle, AlertCircle, Clock, RotateCcw, X } from 'lucide-react';

interface ToastTracker {
  operationId: string;
  toastId: string | number;
  status: 'saving' | 'completed' | 'failed';
}

export function SaveStatusToastManager() {
  const { state, retryOperation, cancelOperation } = useSaveStatus();
  const { queueStatus, isProcessing } = useQueueStatus();
  const toastTracker = useRef<Map<string, ToastTracker>>(new Map());
  const queueToastId = useRef<string | number | null>(null);

  // Handle individual operation status changes
  useEffect(() => {
    const operations = Array.from(state.operations.values());
    
    operations.forEach((operation) => {
      const existingToast = toastTracker.current.get(operation.id);
      
      switch (operation.status) {
        case 'pending':
        case 'processing':
          if (!existingToast || existingToast.status !== 'saving') {
            // Dismiss any existing toast for this operation
            if (existingToast) {
              toast.dismiss(existingToast.toastId);
            }
            
            // Show saving toast
            const toastId = toast.loading(
              `Saving ${getReceiptDisplayName(operation)}...`,
              {
                id: `save-${operation.id}`,
                icon: <Clock className="h-4 w-4 text-blue-500" />,
                duration: Infinity, // Keep until status changes
              }
            );
            
            toastTracker.current.set(operation.id, {
              operationId: operation.id,
              toastId,
              status: 'saving',
            });
          }
          break;

        case 'completed':
          if (!existingToast || existingToast.status !== 'completed') {
            // Dismiss saving toast
            if (existingToast) {
              toast.dismiss(existingToast.toastId);
            }
            
            // Show success toast
            const toastId = toast.success(
              `${getReceiptDisplayName(operation)} saved successfully`,
              {
                id: `success-${operation.id}`,
                icon: <CheckCircle className="h-4 w-4 text-green-500" />,
                duration: 3000,
              }
            );
            
            toastTracker.current.set(operation.id, {
              operationId: operation.id,
              toastId,
              status: 'completed',
            });
            
            // Clean up tracker after toast duration
            setTimeout(() => {
              toastTracker.current.delete(operation.id);
            }, 3500);
          }
          break;

        case 'failed':
          if (!existingToast || existingToast.status !== 'failed') {
            // Dismiss saving toast
            if (existingToast) {
              toast.dismiss(existingToast.toastId);
            }
            
            // Show error toast with retry option
            const toastId = toast.error(
              `Failed to save ${getReceiptDisplayName(operation)}`,
              {
                id: `error-${operation.id}`,
                icon: <AlertCircle className="h-4 w-4 text-red-500" />,
                description: operation.error || 'Unknown error occurred',
                duration: Infinity, // Keep until manually dismissed
                action: {
                  label: 'Retry',
                  onClick: () => {
                    retryOperation(operation.id);
                    toast.dismiss(toastId);
                  },
                },
                cancel: {
                  label: 'Dismiss',
                  onClick: () => {
                    cancelOperation(operation.id);
                    toast.dismiss(toastId);
                  },
                },
              }
            );
            
            toastTracker.current.set(operation.id, {
              operationId: operation.id,
              toastId,
              status: 'failed',
            });
          }
          break;
      }
    });

    // Clean up toasts for operations that no longer exist
    const currentOperationIds = new Set(operations.map(op => op.id));
    for (const [operationId, tracker] of toastTracker.current) {
      if (!currentOperationIds.has(operationId)) {
        toast.dismiss(tracker.toastId);
        toastTracker.current.delete(operationId);
      }
    }
  }, [state.operations, retryOperation, cancelOperation]);

  // Handle queue status notifications
  useEffect(() => {
    const { pendingOperations, processingOperations, failedOperations } = queueStatus;
    const totalActive = pendingOperations + processingOperations;

    // Show queue status toast when there are multiple operations
    if (totalActive > 1) {
      if (queueToastId.current) {
        // Update existing queue toast
        toast.loading(
          `Processing ${totalActive} receipts...`,
          {
            id: queueToastId.current,
            icon: <Clock className="h-4 w-4 text-blue-500" />,
            description: `${processingOperations} saving, ${pendingOperations} queued`,
            duration: Infinity,
          }
        );
      } else {
        // Create new queue toast
        queueToastId.current = toast.loading(
          `Processing ${totalActive} receipts...`,
          {
            icon: <Clock className="h-4 w-4 text-blue-500" />,
            description: `${processingOperations} saving, ${pendingOperations} queued`,
            duration: Infinity,
          }
        );
      }
    } else if (queueToastId.current && totalActive <= 1) {
      // Dismiss queue toast when only one or no operations remain
      toast.dismiss(queueToastId.current);
      queueToastId.current = null;
    }

    // Show summary toast when all operations complete (if there were multiple)
    if (totalActive === 0 && queueToastId.current) {
      toast.dismiss(queueToastId.current);
      queueToastId.current = null;
      
      if (queueStatus.totalOperations > 1) {
        const completedCount = queueStatus.completedOperations;
        const failedCount = queueStatus.failedOperations;
        
        if (failedCount === 0) {
          toast.success(
            `All ${completedCount} receipts saved successfully`,
            {
              icon: <CheckCircle className="h-4 w-4 text-green-500" />,
              duration: 4000,
            }
          );
        } else {
          toast.error(
            `${completedCount} receipts saved, ${failedCount} failed`,
            {
              icon: <AlertCircle className="h-4 w-4 text-orange-500" />,
              description: 'Check individual receipts for details',
              duration: 5000,
            }
          );
        }
      }
    }
  }, [queueStatus]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Dismiss all tracked toasts
      for (const tracker of toastTracker.current.values()) {
        toast.dismiss(tracker.toastId);
      }
      if (queueToastId.current) {
        toast.dismiss(queueToastId.current);
      }
      toastTracker.current.clear();
    };
  }, []);

  return null; // This component only manages toasts, no UI
}

// Helper function to get a display name for a receipt
function getReceiptDisplayName(operation: SaveOperation): string {
  const merchant = operation.receiptData.merchant;
  if (merchant && merchant.trim()) {
    return merchant.length > 20 ? `${merchant.substring(0, 20)}...` : merchant;
  }
  return `Receipt (${operation.receiptId.substring(0, 6)}...)`;
}

// Additional component for showing save status indicators in UI
export function SaveStatusIndicator({ receiptId }: { receiptId: string }) {
  const { isReceiptSaving, getReceiptSaveStatus } = useSaveStatus();
  const isSaving = isReceiptSaving(receiptId);
  const status = getReceiptSaveStatus(receiptId);

  if (!isSaving && status === 'idle') {
    return null;
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'saving':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'saved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'saving':
        return 'Saving...';
      case 'saved':
        return 'Saved';
      case 'failed':
        return 'Save failed';
      default:
        return '';
    }
  };

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      {getStatusIcon()}
      <span>{getStatusText()}</span>
    </div>
  );
}

// Component for showing queue status in the UI
export function QueueStatusIndicator() {
  const { queueStatus, isProcessing } = useQueueStatus();
  
  if (!isProcessing && queueStatus.totalOperations === 0) {
    return null;
  }

  const { pendingOperations, processingOperations, failedOperations } = queueStatus;
  const totalActive = pendingOperations + processingOperations;

  if (totalActive === 0 && failedOperations === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
      {totalActive > 0 && (
        <>
          <Clock className="h-3 w-3 text-blue-500" />
          <span>{totalActive} saving</span>
        </>
      )}
      {failedOperations > 0 && (
        <>
          <AlertCircle className="h-3 w-3 text-red-500" />
          <span>{failedOperations} failed</span>
        </>
      )}
    </div>
  );
}
