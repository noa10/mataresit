import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Check,
  ExternalLink,
  FileText,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { CreateClaimDialog } from "@/components/claims/CreateClaimDialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConfidenceBar } from "@/components/ledger/ConfidenceBar";
import { EmptyState } from "@/components/ledger/EmptyState";
import { ReceiptPaper } from "@/components/ledger/ReceiptPaper";
import { StatusChip } from "@/components/ledger/StatusChip";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardTranslation } from "@/contexts/LanguageContext";
import { useTeam } from "@/contexts/TeamContext";
import { getReceiptConfidence } from "@/lib/receipts/confidence";
import {
  deleteReceipt,
  fetchReceiptById,
  updateReceiptStatus,
} from "@/services/receiptService";
import type { ReceiptStatus } from "@/types/receipt";
import { formatCurrencySafe } from "@/utils/currency";

interface ReceiptDetailSheetProps {
  receiptId: string | null;
  onOpenChange: (open: boolean) => void;
}

const formatDetailDate = (value: string | null | undefined): string => {
  if (!value) return "—";
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "dd MMM yyyy");
};

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-3 px-4 py-3">
      <dt className="font-data text-[0.6rem] uppercase tracking-[0.12em] text-ledger-muted">
        {label}
      </dt>
      <dd className="min-w-0 text-sm text-ledger-ink">{children}</dd>
    </div>
  );
}

/**
 * Fast review surface for a single receipt. Keeps the full editor one click
 * away for corrections that need the image and the complete form.
 */
export function ReceiptDetailSheet({ receiptId, onOpenChange }: ReceiptDetailSheetProps) {
  const { t } = useDashboardTranslation();
  const { user } = useAuth();
  const { currentTeam, hasPermission } = useTeam();
  const queryClient = useQueryClient();
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data: receipt, isLoading, isError, refetch } = useQuery({
    queryKey: ["receipt", receiptId, currentTeam?.id ?? null],
    queryFn: () => fetchReceiptById(receiptId as string, { currentTeam }),
    enabled: Boolean(receiptId && user),
    staleTime: 0,
    retry: 1,
  });

  const statusMutation = useMutation({
    mutationFn: async (nextStatus: ReceiptStatus) => {
      if (!receipt) throw new Error("No receipt loaded");
      const ok = await updateReceiptStatus(receipt.id, nextStatus, { silent: true });
      if (!ok) throw new Error("Status update failed");
      return nextStatus;
    },
    onSuccess: async (nextStatus) => {
      if (nextStatus === "reviewed") {
        toast.success(t("workspace.review.approvedToast"), {
          description: t("workspace.review.approvedDescription", {
            merchant: receipt?.merchant ?? "",
          }),
        });
      } else {
        toast.success(t("workspace.detail.movedToReview"));
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["receipts"] }),
        queryClient.invalidateQueries({ queryKey: ["receipt"] }),
        queryClient.invalidateQueries({ queryKey: ["receipt-counts"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);

      onOpenChange(false);
    },
    onError: () => {
      toast.error(t("workspace.review.failedToast"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!receipt) throw new Error("No receipt loaded");
      const deleted = await deleteReceipt(receipt.id, { silent: true });
      if (!deleted) throw new Error("Delete failed");
      return receipt.id;
    },
    onSuccess: async () => {
      toast.success(t("workspace.detail.deletedToast"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["receipts"] }),
        queryClient.invalidateQueries({ queryKey: ["receipt"] }),
        queryClient.invalidateQueries({ queryKey: ["receipt-counts"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t("workspace.detail.deleteFailedToast"));
    },
  });

  const confidence = receipt ? getReceiptConfidence(receipt) : null;
  const category = receipt?.custom_category?.name || receipt?.predicted_category || null;
  const isReviewed = receipt?.status === "reviewed";
  const isPending = statusMutation.isPending;
  const canCreateClaim =
    Boolean(currentTeam) && hasPermission?.("create_claims") === true;

  return (
    <>
      <Sheet open={Boolean(receiptId)} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto border-l border-ledger-line bg-ledger-paper p-0 sm:max-w-[920px] [&>button]:z-20"
      >
        <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-ledger-line bg-ledger-paper/95 px-6 py-5 pr-14 backdrop-blur">
          <div className="min-w-0 flex-1">
            <p className="font-data text-[0.58rem] uppercase tracking-[0.18em] text-ledger-muted">
              {t("workspace.detail.title")}
            </p>
            <SheetTitle className="mt-1 truncate font-display text-[1.55rem] leading-tight text-ledger-ink">
              {receipt?.merchant || t("workspace.detail.title")}
            </SheetTitle>
            <SheetDescription className="mt-0.5 truncate text-sm text-ledger-muted">
              {receipt
                ? `${formatDetailDate(receipt.date)}${category ? ` · ${category}` : ""}`
                : t("workspace.detail.title")}
            </SheetDescription>
          </div>
          {receipt && (
            <StatusChip
              tone={isReviewed ? "reviewed" : "unreviewed"}
              label={
                isReviewed
                  ? t("workspace.status.approved")
                  : t("workspace.status.review")
              }
              className="mt-1 shrink-0"
            />
          )}
        </header>

        {isLoading ? (
          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]" aria-hidden="true">
            <div className="mx-auto h-[420px] w-full max-w-[340px] animate-pulse rounded-[10px] bg-ledger-surface-2 lg:mx-0" />
            <div className="space-y-4">
              <div className="h-[220px] animate-pulse rounded-[10px] bg-ledger-surface-2" />
              <div className="h-[92px] animate-pulse rounded-[10px] bg-ledger-surface-2" />
            </div>
          </div>
        ) : isError || !receipt ? (
          <div className="px-6 py-8">
            <EmptyState
              title={t("workspace.detail.notFound")}
              description={t("workspace.detail.loadError")}
              action={
                <Button variant="accent-outline" size="app" onClick={() => refetch()}>
                  {t("workspace.detail.retry")}
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <div className="mx-auto w-full max-w-[340px] lg:mx-0">
              <ReceiptPaper
                merchant={receipt.merchant || t("workspace.detail.unknown")}
                date={receipt.date}
                items={(receipt.lineItems ?? []).map((item) => ({
                  name: item.description,
                  price: item.amount,
                }))}
                tax={receipt.tax ?? null}
                total={receipt.total}
                currency={receipt.currency}
                payment={receipt.payment_method || null}
              />
            </div>

            <div className="space-y-4">
              <dl className="divide-y divide-ledger-line rounded-[10px] border border-ledger-line bg-ledger-surface">
                <FieldRow label={t("workspace.detail.merchant")}>
                  {receipt.merchant || t("workspace.detail.unknown")}
                </FieldRow>
                <FieldRow label={t("workspace.detail.date")}>
                  {formatDetailDate(receipt.date)}
                </FieldRow>
                <FieldRow label={t("workspace.detail.category")}>
                  {category || t("workspace.detail.unknown")}
                </FieldRow>
                <FieldRow label={t("workspace.detail.payment")}>
                  {receipt.payment_method || t("workspace.detail.unknown")}
                </FieldRow>
                <FieldRow label={t("workspace.detail.tax")}>
                  {receipt.tax
                    ? formatCurrencySafe(receipt.tax, receipt.currency)
                    : t("workspace.detail.unknown")}
                </FieldRow>
                <FieldRow label={t("workspace.detail.total")}>
                  <span className="font-data tabular-nums">
                    {formatCurrencySafe(receipt.total, receipt.currency)}
                  </span>
                </FieldRow>
              </dl>

              <div className="rounded-[10px] border border-ledger-line bg-ledger-surface p-4">
                <p className="font-data text-[0.6rem] uppercase tracking-[0.12em] text-ledger-muted">
                  {t("workspace.detail.confidence")}
                </p>
                <ConfidenceBar value={confidence} className="mt-2" />
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {isReviewed ? (
                    <Button
                      variant="accent-outline"
                      size="app"
                      onClick={() => statusMutation.mutate("unreviewed")}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-2 h-4 w-4" />
                      )}
                      {t("workspace.detail.moveToReview")}
                    </Button>
                  ) : (
                    <Button
                      variant="accent"
                      size="app"
                      onClick={() => statusMutation.mutate("reviewed")}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      {isPending
                        ? t("workspace.review.approving")
                        : t("workspace.detail.approve")}
                    </Button>
                  )}

                  {canCreateClaim && (
                    <Button
                      variant="accent-outline"
                      size="app"
                      onClick={() => setClaimDialogOpen(true)}
                      disabled={isPending || deleteMutation.isPending}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      {t("workspace.detail.createClaim")}
                    </Button>
                  )}

                  <Button variant="accent-outline" size="app" asChild>
                    <Link to={`/receipt/${receipt.id}`} onClick={() => onOpenChange(false)}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {t("workspace.detail.openEditor")}
                    </Link>
                  </Button>
                </div>

                <div className="border-t border-ledger-line pt-3">
                  <Button
                    variant="ghost"
                    size="app"
                    className="w-full justify-start text-ledger-danger hover:bg-ledger-danger-soft hover:text-ledger-danger sm:w-auto"
                    onClick={() => setDeleteConfirmOpen(true)}
                    disabled={deleteMutation.isPending || isPending}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    {t("workspace.detail.deleteReceipt")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>

    {receipt && canCreateClaim && (
      <CreateClaimDialog
        open={claimDialogOpen}
        onOpenChange={setClaimDialogOpen}
        prefilledData={{
          title: `Expense - ${receipt.merchant || t("workspace.detail.unknown")}`,
          description: `Expense claim for ${
            receipt.merchant || t("workspace.detail.unknown")
          } on ${formatDetailDate(receipt.date)}`,
          amount: receipt.total,
          currency: receipt.currency || "MYR",
          category:
            receipt.predicted_category ||
            receipt.custom_category?.name ||
            undefined,
          attachedReceipts: [receipt],
        }}
        onSuccess={() => {
          setClaimDialogOpen(false);
          void queryClient.invalidateQueries({ queryKey: ["claims"] });
          void queryClient.invalidateQueries({
            queryKey: ["receipt-claims", receipt.id],
          });
          void queryClient.invalidateQueries({ queryKey: ["receipt-usage"] });
        }}
      />
    )}

    <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
      <AlertDialogContent className="border-ledger-line bg-ledger-surface">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl font-normal text-ledger-ink">
            {t("workspace.detail.deleteConfirmTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed text-ledger-muted">
            {t("workspace.detail.deleteConfirmDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("workspace.detail.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-ledger-danger text-white hover:bg-ledger-danger/90 dark:text-ledger-panel"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t("workspace.detail.deleteConfirmAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
);
}
