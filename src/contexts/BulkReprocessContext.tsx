import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { bulkReprocessReceipts, type ProcessingOptions, type BulkReprocessResult } from '@/services/receiptService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReprocessItemStatus = 'queued' | 'in-progress' | 'succeeded' | 'failed';

export interface ReprocessItem {
    id: string; // unique queue item ID
    receiptId: string;
    status: ReprocessItemStatus;
    error?: string;
}

export interface BulkReprocessContextType {
    /** All items in the current batch */
    items: ReprocessItem[];
    /** Whether there is an active batch running */
    isProcessing: boolean;
    /** Enqueue receipt IDs for reprocessing (duplicates silently ignored) */
    enqueueReceipts: (receiptIds: string[], options?: ProcessingOptions) => void;
    /** Retry all failed items */
    retryFailed: () => void;
    /** Clear all completed/failed items and hide the panel */
    clearAll: () => void;
    /** Whether the progress panel should be visible */
    isPanelVisible: boolean;
    /** Dismiss the panel (processing continues) */
    dismissPanel: () => void;
    /** Show the panel */
    showPanel: () => void;
    // Derived counts
    queuedCount: number;
    activeCount: number;
    succeededCount: number;
    failedCount: number;
    totalCount: number;
    progress: number; // 0–100
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const BulkReprocessContext = createContext<BulkReprocessContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface BulkReprocessProviderProps {
    children: ReactNode;
}

export function BulkReprocessProvider({ children }: BulkReprocessProviderProps) {
    const queryClient = useQueryClient();
    const [items, setItems] = useState<ReprocessItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isPanelVisible, setIsPanelVisible] = useState(false);

    // Track IDs already enqueued to prevent duplicates
    const enqueuedIds = useRef(new Set<string>());
    // Pending options for retry
    const lastOptions = useRef<ProcessingOptions | undefined>(undefined);

    // Derived counts
    const queuedCount = items.filter(i => i.status === 'queued').length;
    const activeCount = items.filter(i => i.status === 'in-progress').length;
    const succeededCount = items.filter(i => i.status === 'succeeded').length;
    const failedCount = items.filter(i => i.status === 'failed').length;
    const totalCount = items.length;
    const completedCount = succeededCount + failedCount;
    const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    const dismissPanel = useCallback(() => setIsPanelVisible(false), []);
    const showPanel = useCallback(() => setIsPanelVisible(true), []);

    const runBatch = useCallback(async (receiptIds: string[], options?: ProcessingOptions) => {
        if (receiptIds.length === 0) return;

        setIsProcessing(true);

        await bulkReprocessReceipts(
            receiptIds,
            options,
            {
                onItemStart: (receiptId) => {
                    setItems(prev => prev.map(item =>
                        item.receiptId === receiptId && item.status === 'queued'
                            ? { ...item, status: 'in-progress' as const }
                            : item
                    ));
                },
                onItemComplete: (receiptId) => {
                    setItems(prev => prev.map(item =>
                        item.receiptId === receiptId && item.status === 'in-progress'
                            ? { ...item, status: 'succeeded' as const }
                            : item
                    ));
                },
                onItemError: (receiptId, error) => {
                    setItems(prev => prev.map(item =>
                        item.receiptId === receiptId && item.status === 'in-progress'
                            ? { ...item, status: 'failed' as const, error }
                            : item
                    ));
                },
            },
            2, // maxConcurrent
        );

        setIsProcessing(false);

        // Refresh receipt list
        queryClient.invalidateQueries({ queryKey: ['receipts'] });
    }, [queryClient]);

    // Completion notification
    const wasProcessingRef = useRef(false);
    useEffect(() => {
        if (wasProcessingRef.current && !isProcessing && totalCount > 0) {
            const sCount = items.filter(i => i.status === 'succeeded').length;
            const fCount = items.filter(i => i.status === 'failed').length;

            if (fCount === 0 && sCount > 0) {
                toast.success(`All ${sCount} receipt${sCount !== 1 ? 's' : ''} reprocessed successfully!`, {
                    duration: 8000,
                    action: { label: 'View', onClick: () => setIsPanelVisible(true) },
                });
            } else if (fCount > 0) {
                toast.warning(
                    `Reprocessing complete: ${sCount}/${sCount + fCount} succeeded`,
                    {
                        duration: 10000,
                        action: { label: 'View Details', onClick: () => setIsPanelVisible(true) },
                    },
                );
            }
        }
        wasProcessingRef.current = isProcessing;
    }, [isProcessing, totalCount, items]);

    const enqueueReceipts = useCallback((receiptIds: string[], options?: ProcessingOptions) => {
        // Filter out already-enqueued IDs
        const newIds = receiptIds.filter(id => !enqueuedIds.current.has(id));
        if (newIds.length === 0) {
            toast.info('All selected receipts are already queued for reprocessing');
            return;
        }

        // Track
        newIds.forEach(id => enqueuedIds.current.add(id));
        lastOptions.current = options;

        // Build new items
        const newItems: ReprocessItem[] = newIds.map(receiptId => ({
            id: `reprocess-${receiptId}-${Date.now()}`,
            receiptId,
            status: 'queued' as const,
        }));

        setItems(prev => [...prev, ...newItems]);
        setIsPanelVisible(true);

        // Start processing (non-blocking)
        runBatch(newIds, options);
    }, [runBatch]);

    const retryFailed = useCallback(() => {
        const failedIds = items
            .filter(i => i.status === 'failed')
            .map(i => i.receiptId);

        if (failedIds.length === 0) return;

        // Reset failed items to queued
        setItems(prev => prev.map(item =>
            item.status === 'failed'
                ? { ...item, status: 'queued' as const, error: undefined }
                : item
        ));

        // Re-run
        runBatch(failedIds, lastOptions.current);
    }, [items, runBatch]);

    const clearAll = useCallback(() => {
        setItems([]);
        enqueuedIds.current.clear();
        setIsPanelVisible(false);
    }, []);

    const value: BulkReprocessContextType = {
        items,
        isProcessing,
        enqueueReceipts,
        retryFailed,
        clearAll,
        isPanelVisible,
        dismissPanel,
        showPanel,
        queuedCount,
        activeCount,
        succeededCount,
        failedCount,
        totalCount,
        progress,
    };

    return (
        <BulkReprocessContext.Provider value={value}>
            {children}
        </BulkReprocessContext.Provider>
    );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBulkReprocess(): BulkReprocessContextType {
    const ctx = useContext(BulkReprocessContext);
    if (!ctx) {
        throw new Error('useBulkReprocess must be used within a BulkReprocessProvider');
    }
    return ctx;
}
