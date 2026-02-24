import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import { useBackgroundUpload } from '@/contexts/BackgroundUploadContext';
import { Button } from '@/components/ui/button';

/**
 * A floating pill that appears in the bottom-right corner when an upload is
 * running in the background (i.e. the modal is closed but uploads are active).
 *
 * Clicking it re-opens the upload modal.
 */
export function BackgroundUploadIndicator() {
    const {
        isModalOpen,
        openModal,
        hasActiveUpload,
        isProcessing,
        totalProgress,
        batchUploads,
        completedUploads,
        failedUploads,
        activeUploads,
        queuedUploads,
    } = useBackgroundUpload();

    // Only show when the modal is closed AND there are uploads in progress or
    // recently completed (but not yet reviewed).
    const hasUploads = batchUploads.length > 0;
    const isComplete =
        !isProcessing &&
        activeUploads.length === 0 &&
        queuedUploads.length === 0 &&
        (completedUploads.length > 0 || failedUploads.length > 0);

    const shouldShow = !isModalOpen && hasUploads && (hasActiveUpload || isComplete);

    // Status label
    let statusLabel = '';
    let StatusIcon = Upload;
    let pillColor = 'bg-primary text-primary-foreground';

    if (isComplete) {
        if (failedUploads.length > 0) {
            statusLabel = `${completedUploads.length}/${batchUploads.length} done`;
            StatusIcon = AlertCircle;
            pillColor = 'bg-yellow-500 text-white';
        } else {
            statusLabel = `${completedUploads.length} uploaded`;
            StatusIcon = CheckCircle2;
            pillColor = 'bg-green-600 text-white';
        }
    } else if (hasActiveUpload) {
        statusLabel = `${totalProgress}%`;
        StatusIcon = Loader2;
        pillColor = 'bg-primary text-primary-foreground';
    }

    return (
        <AnimatePresence>
            {shouldShow && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="fixed bottom-6 right-6 z-50"
                >
                    <Button
                        onClick={openModal}
                        className={`
              ${pillColor}
              rounded-full pl-3 pr-4 py-2 h-auto
              shadow-lg hover:shadow-xl
              transition-shadow duration-200
              flex items-center gap-2 text-sm font-medium
            `}
                    >
                        <StatusIcon
                            size={16}
                            className={StatusIcon === Loader2 ? 'animate-spin' : ''}
                        />
                        <span>{statusLabel}</span>

                        {/* Mini progress bar for active uploads */}
                        {hasActiveUpload && !isComplete && (
                            <div className="w-16 h-1.5 bg-white/30 rounded-full overflow-hidden ml-1">
                                <motion.div
                                    className="h-full bg-white rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${totalProgress}%` }}
                                    transition={{ duration: 0.3, ease: 'easeOut' }}
                                />
                            </div>
                        )}
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
