import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DuplicateScanConfig, DEFAULT_SCAN_CONFIG } from "./DuplicateScanConfig";
import { DuplicateGroupCard } from "./DuplicateGroupCard";
import {
  useDuplicateScan,
  useDuplicateDelete,
  useDuplicateCheckedState,
} from "@/hooks/useDuplicateDetection";
import type { ScanConfig } from "@/types/duplicateDetection";

const SCAN_FRESHNESS_MS = 5 * 60 * 1000; // 5 minutes

export function DuplicateDetectionPanel() {
  const { t } = useTranslation("duplicateDetection");

  // Config state
  const [config, setConfig] = useState<ScanConfig>(DEFAULT_SCAN_CONFIG);

  // Scan hook
  const { scan, data, isLoading, error, reset } = useDuplicateScan();

  // Delete hook
  const { deleteSelected, deleteAllKeepOldest, isDeleting } = useDuplicateDelete();

  // Checked state
  const { checkedIds, selectedCount, toggleReceipt } = useDuplicateCheckedState();

  // Confirmation dialog
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingDeleteType, setPendingDeleteType] = useState<"selected" | "all" | null>(null);

  // Scan freshness tracking
  const [scanTime, setScanTime] = useState<number | null>(null);
  const isStale = scanTime !== null && Date.now() - scanTime > SCAN_FRESHNESS_MS;

  // Update scan timestamp when data arrives
  useEffect(() => {
    if (data) {
      setScanTime(Date.now());
    }
  }, [data]);

  // Reset checked state when data changes (new scan)
  useEffect(() => {
    if (data) {
      // Checked state is managed by the hook, no reset needed here
      // since it's a fresh scan with new groups
    }
  }, [data]);

  const handleScan = () => {
    reset();
    setScanTime(null);
    scan(config);
  };

  const handleDeleteSelected = () => {
    if (selectedCount === 0) return;
    setPendingDeleteType("selected");
    setShowConfirm(true);
  };

  const handleDeleteAll = () => {
    if (!data?.groups.length) return;
    setPendingDeleteType("all");
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!data) return;

    try {
      if (pendingDeleteType === "selected") {
        await deleteSelected(checkedIds);
      } else if (pendingDeleteType === "all") {
        await deleteAllKeepOldest(data.groups);
      }

      // Reset state after successful delete
      setShowConfirm(false);
      setPendingDeleteType(null);
      reset();
      setScanTime(null);
    } catch (err) {
      // Error is handled by the mutation hook
      console.error("Failed to delete duplicates:", err);
    }
  };

  const formatScanTime = (timestamp: number): string => {
    const minutesAgo = Math.floor((Date.now() - timestamp) / 60000);
    if (minutesAgo < 1) return t("scanFreshnessWarning", { time: "just now" });
    if (minutesAgo < 60) return t("scanFreshnessWarning", { time: `${minutesAgo}m ago` });
    const hoursAgo = Math.floor(minutesAgo / 60);
    return t("scanFreshnessWarning", { time: `${hoursAgo}h ${minutesAgo % 60}m ago` });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <Button onClick={handleScan} disabled={isLoading || isDeleting}>
          {isLoading ? (
            <>
              <Spinner size="sm" className="mr-2" />
              {t("scanning")}
            </>
          ) : (
            t("scanButton")
          )}
        </Button>
      </div>

      {/* Config (collapsible) */}
      <DuplicateScanConfig config={config} onChange={setConfig} />

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Spinner size="lg" />
          <span className="ml-3 text-muted-foreground">{t("scanning")}</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error.message || t("scanError")}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={handleScan}
            >
              {t("scanButton")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {data && data.groups.length > 0 && (
        <>
          {/* Summary */}
          <p className="text-sm text-muted-foreground">
            {t("foundDuplicates", {
              count: data.totalDuplicates,
              groups: data.groups.length,
            })}
          </p>

          {/* Freshness warning */}
          {isStale && (
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-600 dark:text-amber-400">
                {formatScanTime(scanTime!)}
              </AlertDescription>
            </Alert>
          )}

          {/* Group cards */}
          <div className="space-y-3">
            {data.groups.map((group, i) => (
              <DuplicateGroupCard
                key={group.id}
                group={group}
                groupIndex={i}
                checkedIds={checkedIds}
                onToggleReceipt={toggleReceipt}
              />
            ))}
          </div>

          {/* Sticky action bar */}
          <div className="sticky bottom-0 z-10 flex flex-col sm:flex-row gap-2 p-4 bg-background border-t border-border shadow-lg">
            <Button
              onClick={handleDeleteSelected}
              disabled={selectedCount === 0 || isDeleting}
              className="flex-1"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("deleteSelected")} ({selectedCount})
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAll}
              disabled={isDeleting}
              className="flex-1 sm:flex-initial"
            >
              {isDeleting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  {t("deleting")}
                </>
              ) : (
                t("deleteAllKeepOldest")
              )}
            </Button>
          </div>
        </>
      )}

      {/* Empty state */}
      {data && data.groups.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">{t("noDuplicates")}</p>
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDeleteType === "selected"
                ? t("confirmDeleteSelectedTitle")
                : t("confirmDeleteAllTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteType === "selected"
                ? t("confirmDeleteSelected", { count: selectedCount })
                : t("confirmDeleteAll")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  {t("deleting")}
                </>
              ) : (
                t("confirmDelete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
