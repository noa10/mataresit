import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertCircle, Loader2, RefreshCw, X, ChevronUp, ChevronDown, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useBulkReprocess } from '@/contexts/BulkReprocessContext';
import { useState } from 'react';
import DailyReceiptBrowserModal from '@/components/DailyReceiptBrowserModal';

export function BulkReprocessProgressPanel() {
    const {
        items,
        isProcessing,
        isPanelVisible,
        dismissPanel,
        retryFailed,
        clearAll,
        queuedCount,
        activeCount,
        succeededCount,
        failedCount,
        totalCount,
        progress,
        succeededReceiptIds,
    } = useBulkReprocess();

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isReviewOpen, setIsReviewOpen] = useState(false);

    if (!isPanelVisible || totalCount === 0) return null;

    const isComplete = !isProcessing && queuedCount === 0 && activeCount === 0;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.95 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border bg-card/95 backdrop-blur-md shadow-2xl"
                data-testid="bulk-reprocess-panel"
            >
                {/* Header */}
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
                    <div className="flex items-center gap-2 min-w-0">
                        {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                        ) : failedCount > 0 ? (
                            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                        ) : (
                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                        )}
                        <span className="text-sm font-medium truncate">
                            {isProcessing
                                ? 'Reprocessing receipts…'
                                : failedCount > 0
                                    ? `${failedCount} failed`
                                    : 'Reprocessing complete'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                        >
                            {isCollapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={dismissPanel}
                            aria-label="Dismiss"
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>

                {/* Body */}
                {!isCollapsed && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="px-4 py-3 space-y-3">
                            {/* Progress bar */}
                            <div className="space-y-1.5">
                                <Progress value={progress} className="h-2" />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>{progress}% complete</span>
                                    <span>{succeededCount + failedCount}/{totalCount}</span>
                                </div>
                            </div>

                            {/* Counters */}
                            <div className="grid grid-cols-4 gap-2 text-center">
                                <div className="space-y-0.5">
                                    <div className="text-lg font-semibold tabular-nums">{queuedCount}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Queued</div>
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-lg font-semibold tabular-nums text-primary">{activeCount}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Active</div>
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-lg font-semibold tabular-nums text-green-500">{succeededCount}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Done</div>
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-lg font-semibold tabular-nums text-destructive">{failedCount}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Failed</div>
                                </div>
                            </div>

                            {/* Actions */}
                            {isComplete && (
                                <div className="space-y-2 pt-1">
                                    {/* Review All Processed Receipts button */}
                                    {succeededCount > 0 && (
                                        <Button
                                            variant="default"
                                            size="sm"
                                            className="w-full gap-1.5"
                                            onClick={() => setIsReviewOpen(true)}
                                        >
                                            <ClipboardList className="h-3.5 w-3.5" />
                                            Review All Processed Receipts
                                        </Button>
                                    )}
                                    <div className="flex gap-2">
                                        {failedCount > 0 && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 gap-1.5"
                                                onClick={retryFailed}
                                            >
                                                <RefreshCw className="h-3.5 w-3.5" />
                                                Retry Failed ({failedCount})
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="flex-1"
                                            onClick={clearAll}
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </motion.div>

            {/* Review Modal */}
            <DailyReceiptBrowserModal
                date={new Date().toISOString().split('T')[0]}
                receiptIds={succeededReceiptIds}
                isOpen={isReviewOpen}
                onClose={() => setIsReviewOpen(false)}
            />
        </AnimatePresence>
    );
}
