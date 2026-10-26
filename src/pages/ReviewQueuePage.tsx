import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Check, ClipboardCheck, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfidenceBar } from "@/components/ledger/ConfidenceBar";
import { EmptyState } from "@/components/ledger/EmptyState";
import { MonogramTile } from "@/components/ledger/MonogramTile";
import { ReceiptDetailSheet } from "@/components/receipts/ReceiptDetailSheet";
import { useAuth } from "@/contexts/AuthContext";
import { useBackgroundUpload } from "@/contexts/BackgroundUploadContext";
import { useDashboardTranslation } from "@/contexts/LanguageContext";
import { useTeam } from "@/contexts/TeamContext";
import { getReceiptConfidence, REVIEW_CONFIDENCE_THRESHOLD } from "@/lib/receipts/confidence";
import { fetchCategoriesForDisplay } from "@/services/categoryService";
import {
  fetchReceiptsPage,
  updateReceiptStatus,
  type ReceiptListResult,
} from "@/services/receiptService";
import type { CustomCategory, Receipt } from "@/types/receipt";
import { formatCurrencySafe } from "@/utils/currency";

const REVIEW_QUEUE_LIMIT = 50;

const formatReviewDate = (value: string | null | undefined): string => {
  if (!value) return "—";
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "dd MMM yyyy");
};

const categoryLabel = (receipt: Receipt, categories: CustomCategory[]): string | null => {
  const match = receipt.custom_category_id
    ? categories.find((category) => category.id === receipt.custom_category_id)
    : null;
  return match?.name || receipt.predicted_category || null;
};

export default function ReviewQueuePage() {
  const { t } = useDashboardTranslation();
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const { openModal } = useBackgroundUpload();
  const queryClient = useQueryClient();
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  const queueKey = ["receipts", "review-queue", currentTeam?.id ?? null] as const;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queueKey,
    queryFn: () =>
      fetchReceiptsPage(
        {
          page: 1,
          limit: REVIEW_QUEUE_LIMIT,
          status: "unreviewed",
          sortOrder: "oldest",
        },
        { currentTeam }
      ),
    enabled: Boolean(user),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["displayCategories", currentTeam?.id],
    queryFn: () => fetchCategoriesForDisplay({ currentTeam }),
    enabled: Boolean(user),
  });

  // Oldest-first is the queue's contract: the service sorts by date ascending,
  // so do not re-sort the page by confidence (that would hide newer receipts).
  const receipts = data?.receipts ?? [];
  const totalPending = data?.total ?? receipts.length;
  const loadError = data?.error ?? null;

  const approveMutation = useMutation({
    mutationFn: async (receipt: Receipt) => {
      const ok = await updateReceiptStatus(receipt.id, "reviewed", { silent: true });
      if (!ok) throw new Error("Could not approve receipt");
      return receipt;
    },
    onMutate: async (receipt) => {
      await queryClient.cancelQueries({ queryKey: queueKey });
      const previous = queryClient.getQueryData<ReceiptListResult>(queueKey);
      if (previous) {
        queryClient.setQueryData<ReceiptListResult>(queueKey, {
          ...previous,
          receipts: previous.receipts.filter((row) => row.id !== receipt.id),
          total: Math.max(previous.total - 1, 0),
        });
      }
      return { previous };
    },
    onSuccess: (receipt) => {
      toast.success(t("workspace.review.approvedToast"), {
        description: t("workspace.review.approvedDescription", {
          merchant: receipt.merchant,
        }),
      });
    },
    onError: (_error, _receipt, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queueKey, context.previous);
      }
      toast.error(t("workspace.review.failedToast"));
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["receipts"] }),
        queryClient.invalidateQueries({ queryKey: ["receipt-counts"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
    },
  });

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-14 pt-8 md:px-7">
      <header>
        <p className="font-data text-[0.625rem] uppercase tracking-[0.16em] text-ledger-muted">
          {t("workspace.review.eyebrow")}
        </p>
        <div className="mt-1.5 flex flex-wrap items-end justify-between gap-[18px]">
          <div>
            <h1 className="font-display text-[clamp(2rem,3.2vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-ledger-ink">
              {t("workspace.review.title")}
            </h1>
            <p className="mt-2 max-w-[58ch] text-[0.9375rem] leading-relaxed text-ledger-muted">
              {t("workspace.review.lede")}
            </p>
          </div>
          <Button variant="accent-outline" size="app" asChild>
            <Link to="/receipts">{t("workspace.review.openInbox")}</Link>
          </Button>
        </div>
      </header>

      <div className="mt-7 flex items-center justify-between gap-3 pb-2.5">
        <h2 className="text-[1rem] font-semibold text-ledger-ink">
          {t("workspace.review.waitingOnYou")}
        </h2>
        {totalPending > 0 && (
          <span className="font-data text-[0.6875rem] tracking-[0.04em] text-ledger-muted">
            {t("workspace.review.count", { count: totalPending })}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {isLoading ? (
          [0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-[148px] animate-pulse rounded-[10px] border border-ledger-line bg-ledger-surface-2"
              aria-hidden="true"
            />
          ))
        ) : isError || loadError ? (
          <EmptyState
            title={t("workspace.review.loadErrorTitle")}
            description={t("workspace.review.loadErrorDescription")}
            action={
              <Button variant="accent-outline" size="app" onClick={() => refetch()}>
                {t("workspace.review.tryAgain")}
              </Button>
            }
          />
        ) : receipts.length === 0 ? (
          <EmptyState
            title={t("workspace.review.emptyTitle")}
            description={t("workspace.review.emptyDescription")}
            icon={<ClipboardCheck className="h-7 w-7" />}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="accent" size="app" onClick={openModal}>
                  <Upload className="mr-2 h-4 w-4" />
                  {t("workspace.receipts.upload")}
                </Button>
                <Button variant="accent-outline" size="app" asChild>
                  <Link to="/receipts">{t("workspace.overview.seeAllReceipts")}</Link>
                </Button>
              </div>
            }
          />
        ) : (
          receipts.map((receipt) => {
            const confidence = getReceiptConfidence(receipt);
            const category = categoryLabel(receipt, categories);
            const isApproving =
              approveMutation.isPending && approveMutation.variables?.id === receipt.id;

            return (
              <article
                key={receipt.id}
                className="rounded-[10px] border border-ledger-line bg-ledger-surface p-5"
              >
                <div className="flex items-start gap-3">
                  <MonogramTile name={receipt.merchant} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[0.98rem] font-medium text-ledger-ink">
                      {receipt.merchant || "Unknown merchant"}
                    </h2>
                    <p className="mt-0.5 truncate text-xs text-ledger-muted">
                      {formatReviewDate(receipt.date)}
                      {category ? ` · ${category}` : ""}
                      {receipt.payment_method ? ` · ${receipt.payment_method}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-xl leading-none tabular-nums text-ledger-ink">
                      {formatCurrencySafe(receipt.total, receipt.currency)}
                    </p>
                    <p className="mt-1 font-data text-[0.6rem] uppercase tracking-[0.1em] text-ledger-muted">
                      {confidence === null
                        ? t("workspace.review.noConfidence")
                        : confidence < REVIEW_CONFIDENCE_THRESHOLD
                          ? `${confidence}% ${t("workspace.review.fieldMatch")}`
                          : `${confidence}%`}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-ledger-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <ConfidenceBar value={confidence} className="sm:max-w-[220px]" />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="accent-outline"
                      size="app"
                      onClick={() => setSelectedReceiptId(receipt.id)}
                    >
                      {t("workspace.review.reviewFields")}
                    </Button>
                    <Button
                      variant="accent"
                      size="app"
                      onClick={() => approveMutation.mutate(receipt)}
                      disabled={isApproving}
                    >
                      {isApproving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      {isApproving
                        ? t("workspace.review.approving")
                        : t("workspace.review.approve")}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      <ReceiptDetailSheet
        receiptId={selectedReceiptId}
        onOpenChange={(open) => {
          if (!open) setSelectedReceiptId(null);
        }}
      />
    </div>
  );
}
