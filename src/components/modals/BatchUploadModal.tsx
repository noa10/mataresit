import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  MobileDialog as Dialog,
  MobileDialogContent as DialogContent,
  MobileDialogHeader as DialogHeader,
  MobileDialogTitle as DialogTitle,
  MobileDialogDescription as DialogDescription,
} from "@/components/ui/mobile-dialog";
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
import BatchUploadZone from "@/components/BatchUploadZone";
import { useReceiptsTranslation } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBackgroundUpload } from "@/contexts/BackgroundUploadContext";
import { cn } from "@/lib/utils";

interface BatchUploadModalProps {
  onUploadComplete?: () => void;
}

export function BatchUploadModal({ onUploadComplete }: BatchUploadModalProps) {
  const { t } = useReceiptsTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const backgroundUpload = useBackgroundUpload();
  const { isModalOpen, closeModal, hasActiveUpload } = backgroundUpload;
  const [confirmClose, setConfirmClose] = useState(false);

  const handleUploadComplete = useCallback(() => {
    // Refresh the workspace data but keep the sheet open for review.
    onUploadComplete?.();
  }, [onUploadComplete]);

  const requestClose = useCallback(() => {
    if (hasActiveUpload) {
      setConfirmClose(true);
      return;
    }
    closeModal();
  }, [closeModal, hasActiveUpload]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) requestClose();
    },
    [requestClose]
  );

  const handleOpenReceipt = useCallback(
    (receiptId: string) => {
      closeModal();
      navigate(`/receipt/${receiptId}`);
    },
    [closeModal, navigate]
  );

  return (
    <Dialog open={isModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        hideClose
        className={cn(
          "flex flex-col gap-0 overflow-hidden border-ledger-line-strong bg-ledger-surface p-0",
          isMobile
            ? "h-full w-full max-h-none max-w-none rounded-none"
            : "h-[85vh] min-h-[520px] max-h-[860px] w-[95vw] max-w-[1000px] sm:max-w-[1000px]"
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t("batch.title")}</DialogTitle>
          <DialogDescription>{t("batch.description")}</DialogDescription>
        </DialogHeader>

        <BatchUploadZone
          onUploadComplete={handleUploadComplete}
          backgroundUpload={backgroundUpload}
          onRequestClose={requestClose}
          onOpenReceipt={handleOpenReceipt}
        />
      </DialogContent>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent className="z-[70] border-ledger-line bg-ledger-surface sm:max-w-[440px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-normal text-ledger-ink">
              {t("batch.modal.closeTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-ledger-muted">
              {t("batch.modal.closeDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("batch.modal.keepUploading")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-ledger-accent text-white hover:bg-ledger-accent-hover dark:text-ledger-panel"
              onClick={() => {
                setConfirmClose(false);
                closeModal();
              }}
            >
              {t("batch.modal.closeAndContinue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
