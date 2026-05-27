import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTeam } from "@/contexts/TeamContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  scanForDuplicates,
  deleteReceipts,
} from "@/services/duplicateDetectionService";
import type { ScanConfig, DuplicateGroup } from "@/types/duplicateDetection";

// ---------------------------------------------------------------------------
// useDuplicateScan
// ---------------------------------------------------------------------------

/**
 * Mutation hook that runs a duplicate receipt scan.
 *
 * Wraps `scanForDuplicates` with React Query so callers get standard
 * loading / error / data states and the mutation can be re-run trivially.
 */
export function useDuplicateScan() {
  const { currentTeam: team } = useTeam();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (config: ScanConfig) =>
      scanForDuplicates(config, team?.id, user?.id ?? ""),
  });

  return {
    /** Trigger a scan with the given configuration. */
    scan: mutation.mutate,
    /** The latest scan result (undefined until a scan completes). */
    data: mutation.data,
    /** True while a scan is in flight. */
    isLoading: mutation.isPending,
    /** The error that occurred during the last scan, if any. */
    error: mutation.error,
    /** Reset the mutation back to its idle state. */
    reset: mutation.reset,
  };
}

// ---------------------------------------------------------------------------
// useDuplicateDelete
// ---------------------------------------------------------------------------

/**
 * Mutation hook that deletes duplicate receipts.
 *
 * Provides two convenience helpers:
 * - `deleteSelected` – deletes every ID in a checked Set.
 * - `deleteAllKeepOldest` – deletes all receipts in each group except the
 *   one designated as the "kept" (oldest) receipt.
 *
 * On success the `["receipts"]` query key is invalidated so the receipt
 * list refreshes automatically.
 */
export function useDuplicateDelete() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (ids: string[]) => deleteReceipts(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
    },
  });

  const deleteSelected = useCallback(
    (checkedIds: Set<string>) => {
      return mutation.mutateAsync(Array.from(checkedIds));
    },
    [mutation],
  );

  const deleteAllKeepOldest = useCallback(
    (groups: DuplicateGroup[]) => {
      const idsToDelete = groups.flatMap((g) =>
        g.receipts
          .filter((r) => r.id !== g.keptReceiptId)
          .map((r) => r.id),
      );
      return mutation.mutateAsync(idsToDelete);
    },
    [mutation],
  );

  return {
    /** Delete every receipt whose ID is present in the checked set. */
    deleteSelected,
    /** For each group, delete all receipts except the oldest (kept) one. */
    deleteAllKeepOldest,
    /** True while a delete operation is in flight. */
    isDeleting: mutation.isPending,
  };
}

// ---------------------------------------------------------------------------
// useDuplicateCheckedState
// ---------------------------------------------------------------------------

/**
 * Manages the set of receipt IDs the user has checked for bulk deletion.
 *
 * The checked set is local-only — it is never persisted to the server.
 */
export function useDuplicateCheckedState() {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const toggleReceipt = useCallback((id: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((groups: DuplicateGroup[]) => {
    const all = new Set<string>();
    for (const g of groups) {
      for (const r of g.receipts) {
        if (r.id !== g.keptReceiptId) {
          all.add(r.id);
        }
      }
    }
    setCheckedIds(all);
  }, []);

  const deselectAll = useCallback(() => {
    setCheckedIds(new Set());
  }, []);

  const keptIds = (groups: DuplicateGroup[]) =>
    new Set(groups.map((g) => g.keptReceiptId));

  return {
    /** The set of currently checked receipt IDs. */
    checkedIds,
    /** Number of checked receipts. */
    selectedCount: checkedIds.size,
    /** Toggle a single receipt on or off. */
    toggleReceipt,
    /** Check every non-kept receipt across all groups. */
    selectAll,
    /** Uncheck every receipt. */
    deselectAll,
    keptIds,
  };
}
