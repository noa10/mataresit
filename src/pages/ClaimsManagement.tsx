import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ledger/EmptyState";
import { KpiCard } from "@/components/ledger/KpiCard";
import { Panel } from "@/components/ledger/Panel";
import { StatusChip, type StatusChipTone } from "@/components/ledger/StatusChip";
import { ClaimApprovalDialog } from "@/components/claims/ClaimApprovalDialog";
import { ClaimDetailsDialog } from "@/components/claims/ClaimDetailsDialog";
import { ClaimRejectionDialog } from "@/components/claims/ClaimRejectionDialog";
import { ClaimSubmissionDialog } from "@/components/claims/ClaimSubmissionDialog";
import { CreateClaimDialog } from "@/components/claims/CreateClaimDialog";
import { EditClaimDialog } from "@/components/claims/EditClaimDialog";
import { useDashboardTranslation, useLanguage } from "@/contexts/LanguageContext";
import { useTeam } from "@/contexts/TeamContext";
import { claimService } from "@/services/claimService";
import type { Claim, ClaimPriority, ClaimStatus } from "@/types/claims";
import { cn } from "@/lib/utils";
import { formatCurrencySafe } from "@/utils/currency";

type ClaimTab = "all" | "pending" | "approved" | "draft" | "rejected";

const TAB_ORDER: ClaimTab[] = ["all", "pending", "approved", "draft", "rejected"];
const PENDING_STATUSES: ClaimStatus[] = ["submitted", "under_review"];
const PRIORITIES: ClaimPriority[] = ["low", "medium", "high", "urgent"];
const CLAIM_PAGE_SIZE = 100;
const CLAIM_MAX_ROWS = 2000;

const TAB_LABEL_KEY: Record<ClaimTab, string> = {
  all: "workspace.claims.tabAll",
  pending: "workspace.claims.tabPending",
  approved: "workspace.claims.tabApproved",
  draft: "workspace.claims.tabDraft",
  rejected: "workspace.claims.tabRejected",
};

const STATUS_TONE: Record<ClaimStatus, StatusChipTone> = {
  draft: "neutral",
  submitted: "unreviewed",
  under_review: "unreviewed",
  approved: "reviewed",
  rejected: "danger",
  cancelled: "neutral",
};

const claimRef = (id: string) => `CLM-${id.replace(/-/g, "").slice(0, 5).toUpperCase()}`;

const matchesTab = (claim: Claim, tab: ClaimTab) => {
  if (tab === "all") return true;
  if (tab === "pending") return PENDING_STATUSES.includes(claim.status);
  if (tab === "draft") return claim.status === "draft";
  if (tab === "approved") return claim.status === "approved";
  return claim.status === "rejected";
};

/** Page through the RPC so a team with >100 claims is not silently cut off. */
const fetchAllTeamClaims = async (teamId: string) => {
  const claims: Claim[] = [];
  for (let offset = 0; offset < CLAIM_MAX_ROWS; offset += CLAIM_PAGE_SIZE) {
    const page = await claimService.getTeamClaims(teamId, undefined, CLAIM_PAGE_SIZE, offset);
    claims.push(...page);
    if (page.length < CLAIM_PAGE_SIZE) {
      return { claims, truncated: false };
    }
  }
  return { claims, truncated: claims.length >= CLAIM_MAX_ROWS };
};

export default function ClaimsManagement() {
  const { t } = useDashboardTranslation();
  const { language } = useLanguage();
  const { currentTeam, teamMembers } = useTeam();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ClaimTab>("all");
  const [priorityFilter, setPriorityFilter] = useState<ClaimPriority | "all">("all");
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [submissionDialogOpen, setSubmissionDialogOpen] = useState(false);

  const claimsKey = ["workspace", "claims", currentTeam?.id ?? null] as const;

  const { data: claimsResult, isLoading, isError, refetch } = useQuery({
    queryKey: claimsKey,
    queryFn: () => fetchAllTeamClaims(currentTeam!.id),
    enabled: Boolean(currentTeam?.id),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const claims = claimsResult?.claims ?? [];
  const claimsTruncated = claimsResult?.truncated ?? false;

  const counts = useMemo(() => {
    const base: Record<ClaimTab, number> = {
      all: claims.length,
      pending: 0,
      approved: 0,
      draft: 0,
      rejected: 0,
    };
    for (const claim of claims) {
      if (PENDING_STATUSES.includes(claim.status)) base.pending += 1;
      else if (claim.status === "approved") base.approved += 1;
      else if (claim.status === "draft") base.draft += 1;
      else if (claim.status === "rejected") base.rejected += 1;
    }
    return base;
  }, [claims]);

  const approvedAmount = useMemo(
    () =>
      claims
        .filter((claim) => claim.status === "approved")
        .reduce((sum, claim) => sum + (Number(claim.amount) || 0), 0),
    [claims]
  );

  const visibleClaims = useMemo(
    () =>
      claims.filter(
        (claim) =>
          matchesTab(claim, activeTab) &&
          (priorityFilter === "all" || claim.priority === priorityFilter)
      ),
    [claims, activeTab, priorityFilter]
  );

  const approverName = (claim: Claim) => {
    const id = claim.approved_by || claim.reviewed_by;
    if (!id) return null;
    const member = teamMembers.find((entry) => entry.user_id === id);
    if (!member) return null;
    const name = [member.first_name, member.last_name].filter(Boolean).join(" ").trim();
    return name || member.email || null;
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    try {
      return new Intl.DateTimeFormat(language === "ms" ? "ms-MY" : "en-MY", {
        day: "numeric",
        month: "short",
      }).format(date);
    } catch {
      return "—";
    }
  };

  const statusLabel = (status: ClaimStatus) => t(`workspace.claims.statuses.${status}`);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: claimsKey });
  };

  const handleCreateSuccess = () => {
    invalidate();
  };

  const handleViewClaim = (claim: Claim) => {
    setSelectedClaim(claim);
    setDetailsDialogOpen(true);
  };

  const handleEditClaim = (claim: Claim) => {
    setSelectedClaim(claim);
    setDetailsDialogOpen(false);
    setEditDialogOpen(true);
  };

  const handleSubmitClaim = (claim: Claim) => {
    setSelectedClaim(claim);
    setDetailsDialogOpen(false);
    setSubmissionDialogOpen(true);
  };

  const handleApproveClaim = (claim: Claim) => {
    setSelectedClaim(claim);
    setDetailsDialogOpen(false);
    setApprovalDialogOpen(true);
  };

  const handleRejectClaim = (claim: Claim) => {
    setSelectedClaim(claim);
    setDetailsDialogOpen(false);
    setRejectionDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    invalidate();
    setSelectedClaim(null);
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-14 pt-8 md:px-7">
      <header className="flex flex-wrap items-end justify-between gap-[18px]">
        <div className="min-w-0">
          <p className="font-data text-[0.625rem] uppercase tracking-[0.16em] text-ledger-muted">
            {t("workspace.claims.eyebrow", { count: counts.all })}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(2rem,3.2vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-ledger-ink">
            {t("workspace.claims.title")}
          </h1>
          <p className="mt-2 max-w-[58ch] text-[0.9375rem] leading-relaxed text-ledger-muted">
            {t("workspace.claims.lede")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="accent"
            size="app"
            onClick={() => setCreateDialogOpen(true)}
            disabled={!currentTeam}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("workspace.claims.create")}
          </Button>
        </div>
      </header>

      {!currentTeam ? (
        <div className="mt-7">
          <EmptyState
            title={t("workspace.claims.noTeamTitle")}
            description={t("workspace.claims.noTeamLede")}
          />
        </div>
      ) : (
        <>
          <div className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KpiCard
              label={t("workspace.claims.total")}
              value={counts.all}
              meta={t("workspace.claims.totalMeta")}
            />
            <KpiCard
              label={t("workspace.claims.pending")}
              value={counts.pending}
              meta={t("workspace.claims.pendingMeta")}
              tone={counts.pending > 0 ? "amber" : "default"}
            />
            <KpiCard
              label={t("workspace.claims.approvedAmount")}
              value={formatCurrencySafe(approvedAmount, claims[0]?.currency || "MYR")}
              meta={t("workspace.claims.approvedMeta")}
            />
            <KpiCard
              label={t("workspace.claims.drafts")}
              value={counts.draft}
              meta={t("workspace.claims.draftsMeta")}
              tone={counts.draft > 0 ? "amber" : "default"}
            />
          </div>

          <Panel
            className="mt-3"
            title={t("workspace.claims.listTitle")}
            flush
          >
            {claimsTruncated && (
              <p
                role="status"
                className="border-b border-ledger-line px-[18px] py-2 text-xs text-ledger-muted"
              >
                {t("workspace.claims.truncated")}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 px-[18px] pb-3 pt-4">
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label={t("workspace.claims.status")}
              >
                {TAB_ORDER.map((tab) => {
                  const active = tab === activeTab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "rounded-full border px-3.5 py-2 font-data text-[0.6875rem] tracking-[0.06em] transition-colors",
                        active
                          ? "border-ledger-ink bg-ledger-ink text-ledger-paper"
                          : "border-ledger-line-strong text-ledger-ink-2 hover:border-ledger-accent hover:text-ledger-accent"
                      )}
                    >
                      {t(TAB_LABEL_KEY[tab])} · {counts[tab]}
                    </button>
                  );
                })}
              </div>
              <Select
                value={priorityFilter}
                onValueChange={(value) => setPriorityFilter(value as ClaimPriority | "all")}
              >
                <SelectTrigger
                  aria-label={t("workspace.claims.priority")}
                  className="h-8 w-[150px] rounded-full border-ledger-line-strong bg-transparent font-data text-[0.6875rem] text-ledger-ink-2"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("workspace.claims.allPriorities")}</SelectItem>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {t(`workspace.claims.priorities.${priority}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="divide-y divide-ledger-line border-t border-ledger-line" aria-hidden="true">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="h-[58px] animate-pulse bg-ledger-surface-2/60" />
                ))}
              </div>
            ) : isError ? (
              <div className="border-t border-ledger-line px-[18px] py-10 text-center">
                <p className="text-sm text-ledger-muted">{t("workspace.claims.noMatchLede")}</p>
                <Button variant="accent-outline" size="app" className="mt-3" onClick={() => refetch()}>
                  {t("workspace.claims.retry")}
                </Button>
              </div>
            ) : visibleClaims.length === 0 ? (
              <div className="border-t border-ledger-line p-[18px]">
                <EmptyState
                  title={claims.length === 0 ? t("workspace.claims.emptyTitle") : t("workspace.claims.noMatch")}
                  description={
                    claims.length === 0 ? t("workspace.claims.emptyLede") : t("workspace.claims.noMatchLede")
                  }
                  action={
                    claims.length === 0 ? (
                      <Button variant="accent" size="app" onClick={() => setCreateDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        {t("workspace.claims.create")}
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="border-t border-ledger-line">
                <div className="hidden grid-cols-[118px_minmax(0,1.5fr)_92px_110px_84px_130px_96px] items-center gap-3.5 border-b border-ledger-line bg-ledger-surface-2 px-4 py-2.5 lg:grid">
                  <span className="font-data text-[0.58rem] uppercase tracking-[0.16em] text-ledger-muted">
                    {t("workspace.claims.claimNumber")}
                  </span>
                  <span className="font-data text-[0.58rem] uppercase tracking-[0.16em] text-ledger-muted">
                    {t("workspace.claims.titleColumn")}
                  </span>
                  <span className="font-data text-[0.58rem] uppercase tracking-[0.16em] text-ledger-muted">
                    {t("workspace.claims.amount")}
                  </span>
                  <span className="font-data text-[0.58rem] uppercase tracking-[0.16em] text-ledger-muted">
                    {t("workspace.claims.category")}
                  </span>
                  <span className="font-data text-[0.58rem] uppercase tracking-[0.16em] text-ledger-muted">
                    {t("workspace.claims.submitted")}
                  </span>
                  <span className="font-data text-[0.58rem] uppercase tracking-[0.16em] text-ledger-muted">
                    {t("workspace.claims.status")}
                  </span>
                  <span className="font-data text-[0.58rem] uppercase tracking-[0.16em] text-ledger-muted">
                    {t("workspace.claims.approver")}
                  </span>
                </div>

                <div className="divide-y divide-ledger-line">
                  {visibleClaims.map((claim) => (
                    <button
                      key={claim.id}
                      type="button"
                      onClick={() => handleViewClaim(claim)}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto_16px] items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-ledger-surface-2/70 lg:grid-cols-[118px_minmax(0,1.5fr)_92px_110px_84px_130px_96px]"
                    >
                      <span className="hidden font-data text-[0.75rem] text-ledger-ink lg:block">
                        {claimRef(claim.id)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ledger-ink">
                          {claim.title}
                        </span>
                        <span className="mt-0.5 block truncate font-data text-[0.625rem] text-ledger-muted">
                          {claim.claimant_name || claim.claimant_email || claimRef(claim.id)}
                        </span>
                      </span>
                      <span className="text-right font-data text-[0.75rem] text-ledger-ink lg:text-left">
                        {formatCurrencySafe(Number(claim.amount) || 0, claim.currency || "MYR")}
                      </span>
                      <span className="hidden truncate text-sm text-ledger-ink-2 lg:block">
                        {claim.category || "—"}
                      </span>
                      <span className="hidden font-data text-[0.6875rem] text-ledger-muted lg:block">
                        {formatDate(claim.submitted_at)}
                      </span>
                      <span>
                        <StatusChip
                          tone={STATUS_TONE[claim.status] ?? "neutral"}
                          label={statusLabel(claim.status)}
                        />
                      </span>
                      <span className="hidden truncate text-sm text-ledger-ink-2 lg:block">
                        {approverName(claim) || "—"}
                      </span>
                      <ChevronRight className="h-4 w-4 text-ledger-muted lg:hidden" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </>
      )}

      <CreateClaimDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />

      <ClaimDetailsDialog
        claim={selectedClaim}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        onEdit={handleEditClaim}
        onSubmit={handleSubmitClaim}
        onApprove={handleApproveClaim}
        onReject={handleRejectClaim}
        onRefresh={handleDialogSuccess}
      />

      <EditClaimDialog
        claim={selectedClaim}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleDialogSuccess}
      />

      <ClaimSubmissionDialog
        claim={selectedClaim}
        open={submissionDialogOpen}
        onOpenChange={setSubmissionDialogOpen}
        onSuccess={handleDialogSuccess}
      />

      <ClaimApprovalDialog
        claim={selectedClaim}
        open={approvalDialogOpen}
        onOpenChange={setApprovalDialogOpen}
        onSuccess={handleDialogSuccess}
      />

      <ClaimRejectionDialog
        claim={selectedClaim}
        open={rejectionDialogOpen}
        onOpenChange={setRejectionDialogOpen}
        onSuccess={handleDialogSuccess}
      />
    </div>
  );
}
