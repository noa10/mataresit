import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, X } from "lucide-react";
import { toast } from "sonner";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DailyReceiptBrowserModal from "@/components/DailyReceiptBrowserModal";
import { useSettings } from "@/hooks/useSettings";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { useReceiptsTranslation } from "@/contexts/LanguageContext";
import type { BatchUploadHookReturn } from "@/contexts/BackgroundUploadContext";

import { BatchFooter } from "./BatchFooter";
import { BatchLedger } from "./BatchLedger";
import { BatchProgressBand } from "./BatchProgressBand";
import { BatchResultsBand } from "./BatchResultsBand";
import { BatchSummaryBand } from "./BatchSummaryBand";
import { BatchTrayDrop } from "./BatchTrayDrop";
import { useBatchFileIntake } from "./useBatchFileIntake";
import { type BatchFilter, formatBatchDate, formatEta } from "./utils";
import "./batch-upload.css";

interface BatchUploadSheetProps {
  upload: BatchUploadHookReturn;
  onUploadComplete?: () => void;
  onRequestClose?: () => void;
  onOpenReceipt?: (receiptId: string) => void;
}

export function BatchUploadSheet({
  upload,
  onUploadComplete,
  onRequestClose,
  onOpenReceipt,
}: BatchUploadSheetProps) {
  const { t, language } = useReceiptsTranslation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { limits, getCurrentTier } = useSubscription();
  const { isAdmin } = useAuth();

  const {
    batchUploads,
    queuedUploads,
    activeUploads,
    completedUploads,
    failedUploads,
    isProcessing,
    isPaused,
    totalProgress,
    etaCalculation,
    fileProgressDetails,
    receiptIds,
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    fileInputRef,
    addToBatchQueue,
    removeFromBatchQueue,
    updateBatchCategory,
    clearBatchQueue,
    clearAllUploads,
    startBatchProcessing,
    pauseBatchProcessing,
    cancelUpload,
    retryUpload,
    batchSession,
  } = upload;

  const [mode, setMode] = useState<"queue" | "results">("queue");
  const [filter, setFilter] = useState<BatchFilter>("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    () => batchUploads.find((item) => item.categoryId)?.categoryId ?? null
  );
  const [showReceiptBrowser, setShowReceiptBrowser] = useState(false);
  const [browserReceiptIds, setBrowserReceiptIds] = useState<string[]>([]);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);
  const notifiedRef = useRef(false);

  const batchLimit = limits?.batchUploadLimit ?? 5;
  const capacityUsed = batchUploads.length;
  const remainingSlots = Math.max(0, batchLimit - capacityUsed);
  const atCapacity = capacityUsed >= batchLimit;
  const fileCount = batchUploads.length;
  const ready = completedUploads.length;
  const failed = failedUploads.length;
  const working = activeUploads.length;
  const queued = queuedUploads.length;
  const resultsTotal = ready + failed;
  const allComplete =
    !isProcessing &&
    working === 0 &&
    queued === 0 &&
    resultsTotal > 0;

  const intake = useBatchFileIntake({
    addToBatchQueue,
    categoryId: selectedCategoryId,
    remainingSlots,
    onError: (message) => {
      if (fileCount > 0) toast.error(message);
    },
  });

  const percent = Math.round(totalProgress);
  const etaText = allComplete
    ? null
    : formatEta(etaCalculation?.estimatedTimeRemainingMs, t);
  const tier = getCurrentTier();
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const batchName =
    batchSession?.sessionName ||
    (fileCount === 0 ? t("batch.newBatch") : t("batch.batch"));
  const batchDate = formatBatchDate(
    batchSession?.createdAt,
    language === "ms" ? "ms-MY" : "en-MY"
  );

  const displayMode = batchUploads.length === 0 ? "queue" : mode;
  const resultUploads =
    filter === "ready"
      ? completedUploads
      : filter === "failed"
        ? failedUploads
        : batchUploads.filter(
            (item) => item.status === "completed" || item.status === "error"
          );

  const ledgerUploads = displayMode === "results" ? resultUploads : batchUploads;
  const emptyMessage =
    filter === "failed"
      ? t("batch.ledger.noFailed")
      : filter === "ready"
        ? t("batch.ledger.noPosted")
        : t("batch.ledger.noReceipts");

  const totalBytes = batchUploads.reduce(
    (sum, item) => sum + item.file.size,
    0
  );

  useEffect(() => {
    if (!allComplete) {
      notifiedRef.current = false;
      return;
    }
    if (!notifiedRef.current) {
      notifiedRef.current = true;
      onUploadComplete?.();
    }
  }, [allComplete, onUploadComplete]);

  const handleChoose = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setMode("queue");
    setFilter("all");
    void intake.handleFiles(event.target.files);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setMode("queue");
    setFilter("all");
    void intake.handleFiles(event.dataTransfer.files);
  };

  const handleCategoryChange = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
    updateBatchCategory(categoryId);
  };

  const handleRetry = (uploadId: string) => {
    retryUpload(uploadId);
    if (displayMode === "results") {
      setMode("queue");
      setFilter("all");
    }
  };

  const retryAllFailed = () => {
    failedUploads.forEach((item) => retryUpload(item.id));
    if (displayMode === "results" && failedUploads.length > 0) {
      setMode("queue");
      setFilter("all");
    }
  };

  const handleOpenReceipts = () => {
    const ids = completedUploads
      .map((item) => receiptIds[item.id])
      .filter(Boolean) as string[];

    if (ids.length === 0) {
      toast.info(t("batch.toast.noPosted"));
      return;
    }

    setBrowserReceiptIds(ids);
    setShowReceiptBrowser(true);
  };

  const handleViewReceipt = (receiptId: string) => {
    if (onOpenReceipt) {
      onOpenReceipt(receiptId);
      return;
    }
    navigate(`/receipt/${receiptId}`);
  };

  const handleOpenSettings = () => {
    window.open("/admin/settings", "_blank", "noopener,noreferrer");
  };

  const handleUploadMore = () => {
    clearAllUploads();
    setMode("queue");
    setFilter("all");
    setSelectedCategoryId(null);
  };

  const handleClearBatch = () => {
    clearAllUploads();
    setClearConfirmOpen(false);
    setMode("queue");
    setFilter("all");
    setSelectedCategoryId(null);
  };

  const liveMessage = intake.isCompressing
    ? t("batch.live.optimising")
    : isProcessing
      ? t("batch.live.posted", { ready, total: fileCount })
      : allComplete
        ? t("batch.live.complete")
        : fileCount > 0
          ? t("batch.live.readyProcess")
          : t("batch.live.readyAdd");

  return (
    <div
      ref={sheetRef}
      className="batch-sheet"
      data-mode={fileCount === 0 ? "empty" : displayMode}
      aria-busy={isProcessing || intake.isCompressing}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="batch-file-input"
        multiple
        accept="image/jpeg,image/png,application/pdf"
        onChange={handleFileInputChange}
        aria-hidden="true"
      />

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>

      <header className="batch-head">
        <div className="batch-head-top">
          <p className="batch-eyebrow">{t("batch.eyebrow")}</p>
          <div className="batch-head-tools">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="batch-icon-btn"
                  aria-label={t("batch.moreActions")}
                >
                  <MoreHorizontal className="h-[18px] w-[18px]" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="batch-menu-pop w-56">
                <DropdownMenuItem
                  className="batch-menu-item"
                  onSelect={handleChoose}
                  disabled={atCapacity || intake.isCompressing}
                >
                  {t("batch.menu.add")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="batch-menu-item"
                  onSelect={retryAllFailed}
                  disabled={failed === 0}
                >
                  {t("batch.menu.retryAll")}
                  <span className="batch-menu-count mono">{failed}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="batch-menu-item"
                  onSelect={() => clearBatchQueue()}
                  disabled={queued === 0}
                >
                  {t("batch.menu.clearQueued")}
                  <span className="batch-menu-count mono">{queued}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="batch-menu-item batch-menu-danger"
                  onSelect={() => setClearConfirmOpen(true)}
                  disabled={isProcessing}
                >
                  {t("batch.menu.clearBatch")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {onRequestClose && (
              <button
                type="button"
                className="batch-icon-btn"
                onClick={onRequestClose}
                aria-label={t("batch.close")}
              >
                <X className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <h2 className="batch-title">{t("batch.title")}</h2>
        <p className="batch-desc">{t("batch.description")}</p>
      </header>

      <BatchSummaryBand
        batchName={batchName}
        batchDate={batchDate}
        fileCount={fileCount}
        capacityUsed={capacityUsed}
        batchLimit={batchLimit}
        totalBytes={totalBytes}
        tierLabel={tierLabel}
        selectedCategoryId={selectedCategoryId}
        onCategoryChange={handleCategoryChange}
        categoryDisabled={
          displayMode === "results" ||
          batchUploads.some((item) => item.status !== "pending")
        }
        maxConcurrent={settings?.batchUpload?.maxConcurrent || 2}
        autoStart={settings?.batchUpload?.autoStart || false}
        timeoutSeconds={settings?.batchUpload?.timeoutSeconds || 120}
        onOpenSettings={isAdmin ? handleOpenSettings : undefined}
      />

      {displayMode === "results" ? (
        <BatchResultsBand
          ready={ready}
          total={resultsTotal}
          failed={failed}
          filter={filter}
          onFilter={setFilter}
          batchName={batchName}
          batchDate={batchDate}
        />
      ) : fileCount > 0 ? (
        <BatchProgressBand
          percent={percent}
          etaMs={allComplete ? null : etaCalculation?.estimatedTimeRemainingMs}
          ready={ready}
          working={working}
          queued={queued}
          failed={failed}
        />
      ) : null}

      {fileCount === 0 ? (
        <BatchTrayDrop
          isDragging={isDragging}
          isCompressing={intake.isCompressing}
          disabled={atCapacity}
          error={intake.error}
          capacityUsed={capacityUsed}
          batchLimit={batchLimit}
          onChoose={handleChoose}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        />
      ) : (
        <BatchLedger
          uploads={ledgerUploads}
          mode={displayMode}
          receiptIds={receiptIds}
          details={fileProgressDetails}
          emptyMessage={emptyMessage}
          onRemove={removeFromBatchQueue}
          onCancel={cancelUpload}
          onRetry={handleRetry}
          onView={handleViewReceipt}
        />
      )}

      {fileCount > 0 && (
        <BatchFooter
          mode={displayMode}
          allComplete={allComplete}
          isProcessing={isProcessing}
          isPaused={isPaused}
          queued={queued}
          failed={failed}
          ready={ready}
          total={displayMode === "results" ? resultsTotal : fileCount}
          percent={percent}
          etaText={etaText}
          batchName={batchName}
          batchDate={batchDate}
          fileCount={fileCount}
          atCapacity={atCapacity}
          isCompressing={intake.isCompressing}
          onStart={() => void startBatchProcessing()}
          onPause={pauseBatchProcessing}
          onReview={() => {
            setMode("results");
            setFilter("all");
          }}
          onAdd={handleChoose}
          onUploadMore={handleUploadMore}
          onOpenReceipts={handleOpenReceipts}
          onRetryAll={retryAllFailed}
        />
      )}

      <DailyReceiptBrowserModal
        date={new Date().toISOString().split("T")[0]}
        receiptIds={browserReceiptIds}
        isOpen={showReceiptBrowser}
        onClose={() => setShowReceiptBrowser(false)}
      />

      <AlertDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
      >
        <AlertDialogContent className="z-[70] border-ledger-line bg-ledger-surface sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-normal text-ledger-ink">
              {t("batch.clear.title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-ledger-muted">
              {t("batch.clear.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("batch.clear.keep")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-ledger-danger text-white hover:bg-ledger-danger/90 dark:text-ledger-panel"
              onClick={handleClearBatch}
            >
              {t("batch.clear.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
