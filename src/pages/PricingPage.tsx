import { Fragment, useState } from "react";
import type { ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  useHomepageTranslation,
  usePricingTranslation,
} from "@/contexts/LanguageContext";
import { useStripe } from "@/contexts/StripeContext";
import { PRICE_IDS } from "@/config/stripe";
import { MarketingCtaBand } from "@/components/marketing/MarketingCtaBand";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { CheckMark } from "@/components/marketing/MarketingIcons";

type PlanId = "free" | "pro" | "max";
type BillingInterval = "monthly" | "annual";
type PlanFeature = { text: string; off: boolean };
type CompareCell = boolean | string;
type CompareRow = {
  label: string;
  free: CompareCell;
  pro: CompareCell;
  max: CompareCell;
};
type CompareGroup = { label: string; rows: CompareRow[] };
type FaqItem = { question: string; answer: string };

const PLAN_PRICES: Record<PlanId, { monthly: number; annual: number }> = {
  free: { monthly: 0, annual: 0 },
  pro: { monthly: 10, annual: 108 },
  max: { monthly: 20, annual: 216 },
};

const TIER_HIERARCHY: Record<PlanId, number> = { free: 0, pro: 1, max: 2 };

const shell = "mx-auto w-full max-w-[1240px] px-5 min-[881px]:px-6";
const eyebrow =
  "font-data text-[0.6875rem] uppercase tracking-[0.16em] text-ledger-muted";
const sectionTitle =
  "font-display text-[clamp(2rem,3.6vw,3rem)] font-normal leading-[1.06] tracking-[-0.02em] text-ledger-ink";
const sectionLede = "text-[1.0625rem] leading-[1.65] text-ledger-muted";
const compareMobileLabel =
  "mb-1 hidden font-data text-[0.5625rem] uppercase leading-[1.4] tracking-[0.08em] max-[760px]:block";
const compareCellClass =
  "border-b border-ledger-line px-[18px] py-3 text-center text-sm leading-[1.6] text-ledger-ink-2 max-[760px]:border-0 max-[760px]:px-3 max-[760px]:py-0 max-[760px]:text-left max-[760px]:leading-[1.4]";

function PlusIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function MinusIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M5 12h14" />
    </svg>
  );
}

function CompareCellValue({
  value,
  strong,
  includedLabel,
  notIncludedLabel,
}: {
  value: CompareCell;
  strong: boolean;
  includedLabel: string;
  notIncludedLabel: string;
}) {
  if (typeof value === "boolean") {
    if (value) {
      return (
        <span className="inline-grid h-[22px] w-[22px] place-items-center rounded-full bg-ledger-accent-soft text-ledger-accent">
          <CheckMark className="h-3.5 w-3.5" strokeWidth={2.4} />
          <span className="sr-only">{includedLabel}</span>
        </span>
      );
    }
    return (
      <>
        <span aria-hidden="true" className="font-data text-ledger-line-strong">
          —
        </span>
        <span className="sr-only">{notIncludedLabel}</span>
      </>
    );
  }

  return (
    <span
      className={
        strong
          ? "text-[0.8125rem] font-medium leading-[1.6] text-ledger-ink-2 max-[760px]:leading-[1.4]"
          : "text-[0.8125rem] leading-[1.6] text-ledger-muted max-[760px]:leading-[1.4]"
      }
    >
      {value}
    </span>
  );
}

export default function PricingPage() {
  const { user } = useAuth();
  const {
    createCheckoutSession,
    downgradeSubscription,
    isLoading,
    subscriptionData,
  } = useStripe();
  const { t } = usePricingTranslation();
  const { t: tHome } = useHomepageTranslation();

  const copy = (key: string) => String(t(key));
  const list = <T,>(key: string): T[] =>
    t(key, { returnObjects: true }) as unknown as T[];

  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");
  const [downgradeDialog, setDowngradeDialog] = useState<{
    isOpen: boolean;
    targetTier: PlanId | null;
    tierName: string;
    isProcessing: boolean;
  }>({
    isOpen: false,
    targetTier: null,
    tierName: "",
    isProcessing: false,
  });

  const workspaceTarget = user ? "/dashboard" : "/auth";
  const currentTier = (subscriptionData?.tier || "free") as PlanId;
  const subscriptionActive = subscriptionData?.status === "active";

  const planFeatures = {
    free: list<PlanFeature>("page.plans.free.features"),
    pro: list<PlanFeature>("page.plans.pro.features"),
    max: list<PlanFeature>("page.plans.max.features"),
  };

  const compareGroups = list<CompareGroup>("page.compare.groups");
  const faqItems = list<FaqItem>("page.faq.items");

  const openDowngradeDialog = (tierId: PlanId) => {
    const tierNames: Record<PlanId, string> = {
      free: copy("page.plans.free.name"),
      pro: copy("page.plans.pro.name"),
      max: copy("page.plans.max.name"),
    };
    setDowngradeDialog({
      isOpen: true,
      targetTier: tierId,
      tierName: tierNames[tierId],
      isProcessing: false,
    });
  };

  const handleSubscribe = async (tierId: PlanId) => {
    if (!user) {
      toast.error(copy("page.checkoutError"));
      return;
    }

    const tierNames: Record<PlanId, string> = {
      free: copy("page.plans.free.name"),
      pro: copy("page.plans.pro.name"),
      max: copy("page.plans.max.name"),
    };

    if (TIER_HIERARCHY[tierId] < TIER_HIERARCHY[currentTier]) {
      openDowngradeDialog(tierId);
      return;
    }

    if (tierId === currentTier) {
      toast.success(
        String(t("page.alreadyOnPlan", { plan: tierNames[tierId] })),
      );
      return;
    }

    if (tierId === "free") {
      return;
    }

    try {
      const priceId = PRICE_IDS[tierId][billingInterval];
      await createCheckoutSession(priceId, billingInterval);
    } catch (error) {
      console.error("Error subscribing:", error);
      toast.error(copy("page.checkoutError"));
    }
  };

  const handleDowngradeConfirm = async () => {
    if (!downgradeDialog.targetTier) return;

    setDowngradeDialog((previous) => ({
      ...previous,
      isProcessing: true,
    }));

    try {
      await downgradeSubscription(downgradeDialog.targetTier, true);
      setDowngradeDialog({
        isOpen: false,
        targetTier: null,
        tierName: "",
        isProcessing: false,
      });
    } catch (error) {
      console.error("Error downgrading:", error);
      setDowngradeDialog((previous) => ({
        ...previous,
        isProcessing: false,
      }));
    }
  };

  const handleDowngradeCancel = () => {
    if (downgradeDialog.isProcessing) return;
    setDowngradeDialog({
      isOpen: false,
      targetTier: null,
      tierName: "",
      isProcessing: false,
    });
  };

  const billingNote =
    billingInterval === "monthly"
      ? copy("page.hero.noteMonthly")
      : copy("page.hero.noteAnnual");

  const downgradeWarnings = list<string>(
    downgradeDialog.targetTier === "free"
      ? "page.downgrade.freeWarning"
      : "page.downgrade.paidWarning",
  );

  const renderPlanCta = (planId: PlanId, isCurrent: boolean) => {
    const label = isCurrent
      ? copy("page.current")
      : copy(`page.plans.${planId}.cta`);

    if (!user) {
      return (
        <Button
          asChild
          variant={planId === "free" ? "accent-outline" : planId === "pro" ? "ghost" : "accent"}
          className={
            planId === "free"
              ? "mt-5 h-[46px] w-full rounded-lg border-ledger-line-strong bg-transparent text-[0.9375rem] font-semibold text-ledger-ink hover:bg-ledger-surface-2"
              : planId === "pro"
                ? "mt-5 h-[46px] w-full rounded-lg bg-ledger-on-panel text-[0.9375rem] font-semibold text-[#0A2E23] hover:bg-white hover:text-[#0A2E23]"
                : "mt-5 h-[46px] w-full rounded-lg text-[0.9375rem] font-semibold"
          }
        >
          <Link to="/auth">{label}</Link>
        </Button>
      );
    }

    return (
      <Button
        type="button"
        variant={planId === "free" ? "accent-outline" : planId === "pro" ? "ghost" : "accent"}
        onClick={() => handleSubscribe(planId)}
        disabled={isLoading || isCurrent}
        className={
          planId === "free"
            ? "mt-5 h-[46px] w-full rounded-lg border-ledger-line-strong bg-transparent text-[0.9375rem] font-semibold text-ledger-ink hover:bg-ledger-surface-2"
            : planId === "pro"
              ? "mt-5 h-[46px] w-full rounded-lg bg-ledger-on-panel text-[0.9375rem] font-semibold text-[#0A2E23] hover:bg-white hover:text-[#0A2E23] disabled:opacity-60"
              : "mt-5 h-[46px] w-full rounded-lg text-[0.9375rem] font-semibold"
        }
      >
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {label}
      </Button>
    );
  };

  return (
    <div className="min-h-screen bg-ledger-paper leading-[1.6] text-ledger-ink">
      <Helmet>
        <title>{copy("page.meta.title")}</title>
        <meta name="description" content={copy("page.meta.description")} />
      </Helmet>

      <a
        href="#main"
        className="absolute left-4 top-[-64px] z-[100] rounded-md bg-ledger-ink px-4 py-2.5 text-sm text-ledger-paper focus:top-3"
      >
        {String(tHome("skipToContent"))}
      </a>

      <MarketingHeader active="pricing" />

      <main id="main">
        <section className="border-b border-ledger-line">
          <div
            className={`${shell} pb-[44px] pt-[52px] text-center min-[881px]:pb-[52px] min-[881px]:pt-[72px]`}
          >
            <p className={eyebrow}>{copy("page.hero.eyebrow")}</p>
            <h1 className="mx-auto mb-[18px] mt-4 max-w-[18ch] font-display text-[clamp(2.5rem,11vw,3.4rem)] font-normal leading-[1.02] tracking-[-0.028em] min-[641px]:text-[clamp(2.75rem,5.4vw,4.5rem)]">
              {copy("page.hero.titleLead")}{" "}
              <em className="italic text-ledger-accent">
                {copy("page.hero.titleAccent")}
              </em>
            </h1>
            <p className="mx-auto max-w-[56ch] text-[1.125rem] leading-[1.6] text-ledger-muted">
              {copy("page.hero.lede")}
            </p>

            <div className="mt-[30px] inline-flex flex-col items-center gap-2.5 max-[640px]:mt-6 max-[640px]:flex max-[640px]:w-full">
              <div
                role="group"
                aria-label={copy("page.hero.eyebrow")}
                className="inline-flex gap-1 rounded-[9px] border border-ledger-line-strong bg-ledger-surface p-1 max-[640px]:w-full"
              >
                <button
                  type="button"
                  aria-pressed={billingInterval === "monthly"}
                  onClick={() => setBillingInterval("monthly")}
                  className={
                    billingInterval === "monthly"
                      ? "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-ledger-ink px-4 text-sm font-semibold text-ledger-paper transition-colors max-[640px]:flex-1 max-[640px]:px-2.5"
                      : "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-ledger-muted transition-colors hover:text-ledger-ink max-[640px]:flex-1 max-[640px]:px-2.5"
                  }
                >
                  {copy("page.hero.monthly")}
                </button>
                <button
                  type="button"
                  aria-pressed={billingInterval === "annual"}
                  onClick={() => setBillingInterval("annual")}
                  className={
                    billingInterval === "annual"
                      ? "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-ledger-ink px-4 text-sm font-semibold text-ledger-paper transition-colors max-[640px]:flex-1 max-[640px]:px-2.5"
                      : "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-ledger-muted transition-colors hover:text-ledger-ink max-[640px]:flex-1 max-[640px]:px-2.5"
                  }
                >
                  {copy("page.hero.annual")}
                  <span
                    className={
                      billingInterval === "annual"
                        ? "rounded bg-white/15 px-1.5 py-0.5 font-data text-[0.625rem] font-medium tracking-[0.03em] text-[#CFF1DF] dark:bg-ledger-accent-soft dark:text-ledger-accent"
                        : "rounded bg-ledger-accent-soft px-1.5 py-0.5 font-data text-[0.625rem] font-medium tracking-[0.03em] text-ledger-accent"
                    }
                  >
                    {copy("page.hero.save")}
                  </span>
                </button>
              </div>
              <p className="font-data text-[0.6875rem] tracking-[0.03em] text-ledger-muted">
                {billingNote}
              </p>
            </div>
          </div>
        </section>

        <section aria-label={copy("page.plansLabel")} className="pb-2 pt-[52px] max-[640px]:pt-9">
          <div className={shell}>
            <div className="mx-auto grid max-w-[520px] grid-cols-1 gap-3.5 min-[881px]:max-w-none min-[881px]:grid-cols-3 min-[1025px]:gap-5">
              {(["free", "pro", "max"] as PlanId[]).map((planId) => {
                const isPro = planId === "pro";
                const isCurrent =
                  Boolean(user) &&
                  planId === currentTier &&
                  (planId === "free" || subscriptionActive);

                return (
                  <article
                    key={planId}
                    className={
                      isPro
                        ? "flex flex-col rounded-[14px] border border-[#0A3B2C] bg-[#0A3B2C] px-6 pb-6 pt-6 text-ledger-on-panel shadow-[0_1px_2px_rgba(18,23,21,0.05),0_18px_40px_-24px_rgba(18,23,21,0.28)] min-[881px]:px-[18px] min-[881px]:pb-[22px] min-[881px]:pt-[22px] min-[1025px]:px-6 min-[1025px]:pb-6 min-[1025px]:pt-[26px]"
                        : "flex flex-col rounded-[14px] border border-ledger-line bg-ledger-surface px-6 pb-6 pt-6 min-[881px]:px-[18px] min-[881px]:pb-[22px] min-[881px]:pt-[22px] min-[1025px]:px-6 min-[1025px]:pb-6 min-[1025px]:pt-[26px]"
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h2
                        className={
                          isPro
                            ? "font-display text-[1.75rem] font-normal leading-none tracking-[-0.01em] text-ledger-on-panel"
                            : "font-display text-[1.75rem] font-normal leading-none tracking-[-0.01em] text-ledger-ink"
                        }
                      >
                        {copy(`page.plans.${planId}.name`)}
                      </h2>
                      {isPro && (
                        <span className="whitespace-nowrap rounded bg-ledger-accent-soft px-2 py-1 font-data text-[0.625rem] uppercase tracking-[0.06em] text-ledger-accent">
                          {copy("page.plans.pro.badge")}
                        </span>
                      )}
                    </div>

                    <p
                      className={
                        isPro
                          ? "mt-2.5 text-[0.9375rem] leading-[1.5] text-[#B9CCC2]"
                          : "mt-2.5 text-[0.9375rem] leading-[1.5] text-ledger-muted"
                      }
                    >
                      {copy(`page.plans.${planId}.description`)}
                    </p>

                    <p className="mt-5 flex items-baseline gap-2">
                      <span className="whitespace-nowrap font-data text-[2.5rem] font-medium leading-none tracking-[-0.04em] min-[881px]:text-[2rem] min-[1025px]:text-[2.375rem]">
                        RM{" "}
                        {billingInterval === "monthly"
                          ? PLAN_PRICES[planId].monthly
                          : PLAN_PRICES[planId].annual}
                      </span>
                      <span
                        className={
                          isPro
                            ? "whitespace-nowrap text-sm leading-[1.6] text-[#A8CBB9]"
                            : "whitespace-nowrap text-sm leading-[1.6] text-ledger-muted"
                        }
                      >
                        {planId === "free"
                          ? `/ ${copy("page.forever")}`
                          : billingInterval === "monthly"
                            ? copy("page.perMonth")
                            : copy("page.perYear")}
                      </span>
                    </p>

                    <p
                      className={
                        isPro
                          ? "mt-2 text-xs leading-[1.6] text-[#9FB9AC]"
                          : "mt-2 text-xs leading-[1.6] text-ledger-muted"
                      }
                    >
                      {planId === "free"
                        ? copy("page.plans.free.priceNote")
                        : billingInterval === "monthly"
                          ? copy("page.billedMonthly")
                          : String(
                              t("page.annualMonthly", {
                                amount: `RM ${(PLAN_PRICES[planId].annual / 12).toFixed(2)}`,
                              }),
                            )}
                    </p>

                    {renderPlanCta(planId, isCurrent)}

                    <ul
                      className={
                        isPro
                          ? "mt-[22px] grid gap-2.5 border-t border-[rgba(241,242,238,0.18)] pt-[18px]"
                          : "mt-[22px] grid gap-2.5 border-t border-ledger-line pt-[18px]"
                      }
                    >
                      {planFeatures[planId].map((feature) =>
                        feature.off ? (
                          <li
                            key={feature.text}
                            className={
                              isPro
                                ? "flex items-start gap-[9px] text-sm leading-[1.45] text-[#87A497]"
                                : "flex items-start gap-[9px] text-sm leading-[1.45] text-ledger-muted"
                            }
                          >
                            <MinusIcon
                              className={
                                isPro
                                  ? "mt-[3px] h-4 w-4 shrink-0 text-[#87A497]"
                                  : "mt-[3px] h-4 w-4 shrink-0 text-ledger-line-strong"
                              }
                            />
                            <span>{feature.text}</span>
                          </li>
                        ) : (
                          <li
                            key={feature.text}
                            className={
                              isPro
                                ? "flex items-start gap-[9px] text-sm leading-[1.45] text-[#D7E3DC]"
                                : "flex items-start gap-[9px] text-sm leading-[1.45] text-ledger-ink-2"
                            }
                          >
                            <CheckMark
                              className={
                                isPro
                                  ? "mt-[3px] h-4 w-4 shrink-0 text-[#8FE0B7]"
                                  : "mt-[3px] h-4 w-4 shrink-0 text-ledger-accent"
                              }
                            />
                            <span>{feature.text}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </article>
                );
              })}
            </div>
            <p className="mt-6 text-center text-[0.8125rem] text-ledger-muted">
              {copy("page.note")}
            </p>
          </div>
        </section>

        <section
          id="compare"
          className="scroll-mt-[164px] border-t border-ledger-line py-14 min-[881px]:scroll-mt-[84px] min-[881px]:py-[72px]"
        >
          <div className={shell}>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-8">
              <div>
                <p className={eyebrow}>{copy("page.compare.eyebrow")}</p>
                <h2 className={`${sectionTitle} mt-3.5`}>
                  {copy("page.compare.title")}
                </h2>
              </div>
              <p className={`${sectionLede} max-w-[44ch]`}>
                {copy("page.compare.lede")}
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-ledger-line bg-ledger-surface max-[760px]:rounded-[10px]">
              <div
                className="overflow-x-auto outline-offset-[-2px]"
                tabIndex={0}
                role="region"
                aria-label={copy("page.compare.tableLabel")}
              >
                <table className="w-full border-separate border-spacing-0 max-[760px]:block max-[760px]:min-w-0">
                  <caption className="sr-only">
                    {copy("page.compare.caption")}
                  </caption>
                  <thead className="max-[760px]:sr-only">
                    <tr>
                      <th
                        scope="col"
                        className="w-[280px] border-b border-ledger-line bg-ledger-surface-2 px-[18px] py-3.5 text-left font-data text-[0.625rem] uppercase tracking-[0.12em] text-ledger-muted"
                      >
                        {copy("page.compare.columns.feature")}
                      </th>
                      <th
                        scope="col"
                        className="border-b border-ledger-line bg-ledger-surface-2 px-[18px] py-3.5 text-center font-data text-[0.625rem] uppercase tracking-[0.12em] text-ledger-muted"
                      >
                        {copy("page.compare.columns.free")}
                      </th>
                      <th
                        scope="col"
                        className="border-b border-ledger-line bg-ledger-surface-2 px-[18px] py-3.5 text-center font-data text-[0.625rem] uppercase tracking-[0.12em] text-ledger-muted"
                      >
                        {copy("page.compare.columns.pro")}
                      </th>
                      <th
                        scope="col"
                        className="border-b border-ledger-line bg-ledger-surface-2 px-[18px] py-3.5 text-center font-data text-[0.625rem] uppercase tracking-[0.12em] text-ledger-muted"
                      >
                        {copy("page.compare.columns.max")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="max-[760px]:block">
                    {compareGroups.map((group) => (
                      <Fragment key={group.label}>
                        <tr className="max-[760px]:block">
                          <th
                            colSpan={4}
                            scope="colgroup"
                            className="bg-ledger-surface-2 px-[18px] py-2.5 text-center font-data text-[0.625rem] font-medium uppercase tracking-[0.12em] text-ledger-muted max-[760px]:block max-[760px]:border-b max-[760px]:border-ledger-line max-[760px]:px-4 max-[760px]:text-[0.5625rem] max-[760px]:tracking-[0.09em]"
                          >
                            {group.label}
                          </th>
                        </tr>
                        {group.rows.map((row, rowIndex) => (
                          <tr
                            key={row.label}
                            className="max-[760px]:grid max-[760px]:grid-cols-3 max-[760px]:border-b max-[760px]:border-ledger-line max-[760px]:pb-3 max-[760px]:pt-3.5 max-[760px]:last:border-b-0 [&:last-child>th]:border-b-0 [&:last-child>td]:border-b-0"
                          >
                            <th
                              scope="row"
                              className="sticky left-0 z-[1] min-w-[240px] border-b border-r border-ledger-line bg-ledger-surface px-[18px] py-3 text-left text-sm font-medium leading-[1.6] text-ledger-ink-2 max-[760px]:static max-[760px]:col-span-3 max-[760px]:min-w-0 max-[760px]:border-0 max-[760px]:bg-transparent max-[760px]:px-4 max-[760px]:pb-2.5 max-[760px]:pt-0 max-[760px]:text-[0.9375rem] max-[760px]:font-semibold max-[760px]:text-ledger-ink"
                            >
                              {row.label}
                            </th>
                            <td className={`${compareCellClass} max-[760px]:pl-4`}>
                              <span
                                aria-hidden="true"
                                className={`${compareMobileLabel} text-ledger-muted`}
                              >
                                {copy("page.compare.columns.free")}
                              </span>
                              <CompareCellValue
                                value={row.free}
                                strong={rowIndex === 0}
                                includedLabel={copy("page.compare.included")}
                                notIncludedLabel={copy("page.compare.notIncluded")}
                              />
                            </td>
                            <td className={compareCellClass}>
                              <span
                                aria-hidden="true"
                                className={`${compareMobileLabel} max-[760px]:font-medium max-[760px]:text-ledger-accent`}
                              >
                                {copy("page.compare.columns.pro")}
                              </span>
                              <CompareCellValue
                                value={row.pro}
                                strong={rowIndex === 0}
                                includedLabel={copy("page.compare.included")}
                                notIncludedLabel={copy("page.compare.notIncluded")}
                              />
                            </td>
                            <td className={`${compareCellClass} max-[760px]:pr-4`}>
                              <span
                                aria-hidden="true"
                                className={`${compareMobileLabel} text-ledger-muted`}
                              >
                                {copy("page.compare.columns.max")}
                              </span>
                              <CompareCellValue
                                value={row.max}
                                strong={rowIndex === 0}
                                includedLabel={copy("page.compare.included")}
                                notIncludedLabel={copy("page.compare.notIncluded")}
                              />
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-ledger-line py-[72px]">
          <div
            className={`${shell} grid grid-cols-1 items-start gap-7 min-[881px]:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] min-[881px]:gap-14`}
          >
            <div>
              <p className={eyebrow}>{copy("page.faq.eyebrow")}</p>
              <h2 className={`${sectionTitle} mb-4 mt-3.5`}>
                {copy("page.faq.title")}
              </h2>
              <p className={`${sectionLede} max-w-[46ch]`}>
                {copy("page.faq.lede")}
              </p>
            </div>

            <div className="border-t border-ledger-line-strong">
              {faqItems.map((item) => (
                <details
                  key={item.question}
                  className="group border-b border-ledger-line"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-[18px] text-base font-semibold leading-[1.6] text-ledger-ink [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <PlusIcon className="h-[18px] w-[18px] shrink-0 text-ledger-muted transition-transform group-open:rotate-45" />
                  </summary>
                  <div className="max-w-[62ch] pb-5 text-[0.9375rem] leading-[1.65] text-ledger-muted">
                    <p>{item.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <MarketingCtaBand
          eyebrow={copy("page.cta.eyebrow")}
          title={copy("page.cta.title")}
          lede={copy("page.cta.lede")}
          primary={{ label: copy("page.cta.workspace"), to: workspaceTarget }}
          secondary={{ label: copy("page.cta.features"), to: "/features" }}
        />
      </main>

      <MarketingFooter />

      <Dialog
        open={downgradeDialog.isOpen}
        onOpenChange={(open) =>
          !open && !downgradeDialog.isProcessing && handleDowngradeCancel()
        }
      >
        <DialogContent className="border-ledger-line bg-ledger-surface text-ledger-ink sm:max-w-[470px]">
          <DialogHeader>
            <DialogTitle className="font-display text-[2rem] font-normal leading-[1.05] tracking-[-0.02em]">
              {copy("page.downgrade.title")}
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-sm text-ledger-muted">
              {String(
                t("page.downgrade.description", {
                  plan: downgradeDialog.tierName,
                }),
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="my-1 rounded-lg border border-ledger-line bg-ledger-surface-2 p-4">
            <h4 className="mb-3 text-sm font-semibold text-ledger-ink">
              {downgradeDialog.targetTier === "free"
                ? copy("page.downgrade.freeWarningTitle")
                : String(
                    t("page.downgrade.paidWarningTitle", {
                      plan: downgradeDialog.tierName,
                    }),
                  )}
            </h4>
            <ul className="grid gap-2">
              {downgradeWarnings.map((warning) => (
                <li
                  key={warning}
                  className="flex items-start gap-2 text-[0.8125rem] leading-[1.5] text-ledger-ink-2"
                >
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ledger-accent"
                  />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs leading-[1.55] text-ledger-muted">
            {copy("page.downgrade.billingNote")}
          </p>

          <DialogFooter className="mt-1 gap-2 sm:gap-2">
            <Button
              type="button"
              variant="accent-outline"
              onClick={handleDowngradeCancel}
              disabled={downgradeDialog.isProcessing}
              className="h-[46px] rounded-lg border-ledger-line-strong px-5 text-[0.9375rem] font-semibold"
            >
              {copy("page.downgrade.cancel")}
            </Button>
            <Button
              type="button"
              variant="accent"
              onClick={handleDowngradeConfirm}
              disabled={downgradeDialog.isProcessing}
              className="h-[46px] rounded-lg px-5 text-[0.9375rem] font-semibold"
            >
              {downgradeDialog.isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {copy("page.downgrade.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
