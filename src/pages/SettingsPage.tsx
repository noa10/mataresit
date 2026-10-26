import { useEffect, useMemo, useRef } from "react";
import { Crown, ExternalLink } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ledger/Panel";
import { StatusChip } from "@/components/ledger/StatusChip";
import ApiKeyManagement from "@/components/dashboard/ApiKeyManagement";
import { CategoryManager } from "@/components/categories/CategoryManager";
import { PayerManager } from "@/components/payers/PayerManager";
import { NotificationPreferences } from "@/components/settings/NotificationPreferences";
import { BillingPreferences } from "@/components/settings/BillingPreferences";
import SubscriptionLimitsDisplay from "@/components/SubscriptionLimitsDisplay";
import { useDashboardTranslation, useLanguage, useSettingsTranslation } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useStripe } from "@/contexts/StripeContext";
import { useSubscription } from "@/hooks/useSubscription";
import { SUBSCRIPTION_TIERS } from "@/config/stripe";
import type { SupportedLanguage } from "@/lib/i18n";
import type { ThemeMode } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

type SettingsSection =
  | "preferences"
  | "plan"
  | "api"
  | "categories"
  | "payers"
  | "notifications"
  | "usage";

const SECTION_ORDER: SettingsSection[] = [
  "preferences",
  "plan",
  "api",
  "categories",
  "payers",
  "notifications",
  "usage",
];

const SECTION_LABEL_KEY: Record<SettingsSection, string> = {
  preferences: "workspace.settings.nav.preferences",
  plan: "workspace.settings.nav.plan",
  api: "workspace.settings.nav.api",
  categories: "workspace.settings.nav.categories",
  payers: "workspace.settings.nav.payers",
  notifications: "workspace.settings.nav.notifications",
  usage: "workspace.settings.nav.usage",
};

const mapTabToSection = (tab: string | null): SettingsSection => {
  switch (tab) {
    case "preferences":
    case "theme":
      return "preferences";
    case "api":
    case "api-keys":
      return "api";
    case "categories":
      return "categories";
    case "payers":
      return "payers";
    case "notifications":
      return "notifications";
    case "usage":
      return "usage";
    case "plan":
    case "billing":
    default:
      return "plan";
  }
};

const formatMonthYear = (value: string | null | undefined, language: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(language === "ms" ? "ms-MY" : "en-MY", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return null;
  }
};

const formatStorage = (megabytes: number) => {
  if (!Number.isFinite(megabytes) || megabytes <= 0) return "0 MB";
  if (megabytes >= 1024) return `${(megabytes / 1024).toFixed(1)} GB`;
  return `${Math.round(megabytes)} MB`;
};

const percentOf = (used: number, limit: number) => {
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((used / limit) * 100)));
};

const ProgressBar = ({ value }: { value: number }) => (
  <span className="mt-2.5 block h-[7px] overflow-hidden rounded-full bg-ledger-surface-2">
    <i
      className="block h-full rounded-full bg-ledger-accent"
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </span>
);

const setRowClass =
  "flex flex-wrap items-center justify-between gap-x-[18px] gap-y-3 border-b border-dashed border-ledger-line py-3 last:border-b-0";

const selectClass =
  "h-10 rounded-[8px] border border-ledger-line-strong bg-ledger-surface px-3 text-sm text-ledger-ink outline-none focus-visible:border-ledger-accent focus-visible:ring-2 focus-visible:ring-ledger-accent-soft";

export default function SettingsPage() {
  const { t } = useDashboardTranslation();
  const { t: ts } = useSettingsTranslation();
  const { language, changeLanguage } = useLanguage();
  const { theme, setMode } = useTheme();
  const { subscriptionData, createPortalSession } = useStripe();
  const { limits, usage, isLoading: usageLoading, getCurrentTier, isFeatureAvailable } = useSubscription();
  const [searchParams, setSearchParams] = useSearchParams();
  const section = mapTabToSection(searchParams.get("tab"));
  const sectionsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const active = sectionsRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [section]);

  useEffect(() => {
    if (searchParams.get("simulated") === "true") {
      toast.info(ts("billing.simulatedNotice", { defaultValue: "You are viewing simulated billing information. Upgrade to a paid plan to access the full Stripe billing portal." }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSectionChange = (key: SettingsSection) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("tab", key);
        return next;
      },
      { replace: true }
    );
  };

  const tier = getCurrentTier() as keyof typeof SUBSCRIPTION_TIERS;
  const tierConfig = SUBSCRIPTION_TIERS[tier] ?? SUBSCRIPTION_TIERS.free;
  const tierLabel = tierConfig.name;
  const isFree = tier === "free";
  const hasApiAccess = isFeatureAvailable("api_access");

  const status = subscriptionData?.status ?? "active";
  const statusLabel = status === "active" ? t("workspace.settings.active") : status;

  const renewalDate = useMemo(
    () => formatMonthYear(subscriptionData?.subscriptionEndDate, language),
    [subscriptionData?.subscriptionEndDate, language]
  );

  const receiptsUsed = usage?.receiptsUsedThisMonth ?? subscriptionData?.receiptsUsedThisMonth ?? 0;
  const receiptsLimit = limits?.monthlyReceipts ?? tierConfig.monthlyReceipts;
  const storageUsed = usage?.storageUsedMB ?? 0;
  const storageLimit = limits?.storageLimitMB ?? tierConfig.storageLimitMB;
  const batchLimit = limits?.batchUploadLimit ?? tierConfig.batchUploadLimit;
  const unlimited = (value: number) => !Number.isFinite(value) || value < 0;

  const handleBillingPortal = async () => {
    if (isFree) return;
    try {
      await createPortalSession();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open the billing portal");
    }
  };

  const handleLanguageChange = (value: string) => {
    void changeLanguage(value as SupportedLanguage);
  };

  const handleThemeChange = (value: string) => {
    void setMode(value as ThemeMode);
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-14 pt-8 md:px-7">
      <header className="flex flex-wrap items-end justify-between gap-[18px]">
        <div className="min-w-0">
          <p className="font-data text-[0.625rem] uppercase tracking-[0.16em] text-ledger-muted">
            {t("workspace.settings.eyebrow")}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(2rem,3.2vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-ledger-ink">
            {t("workspace.settings.title")}
          </h1>
          <p className="mt-2 max-w-[58ch] text-[0.9375rem] leading-relaxed text-ledger-muted">
            {t("workspace.settings.lede")}
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8">
        <nav
          ref={sectionsRef}
          aria-label={t("workspace.settings.sections")}
          className="flex gap-1 overflow-x-auto border-b border-ledger-line pb-2 lg:sticky lg:top-[88px] lg:flex-col lg:gap-0.5 lg:self-start lg:overflow-visible lg:border-b-0 lg:pb-0"
        >
          {SECTION_ORDER.map((key) => {
            const active = key === section;
            return (
              <button
                key={key}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => handleSectionChange(key)}
                className={cn(
                  "shrink-0 rounded-[7px] px-3 py-2 text-left text-sm font-medium transition-colors",
                  active
                    ? "bg-ledger-accent-soft text-ledger-accent"
                    : "text-ledger-ink-2 hover:bg-ledger-surface-2 hover:text-ledger-ink"
                )}
              >
                {t(SECTION_LABEL_KEY[key])}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {section === "plan" && (
            <>
            <Panel
              title={t("workspace.settings.planTitle")}
              action={
                isFree ? (
                  <Button variant="accent-outline" size="app" asChild>
                    <Link to="/pricing">{t("workspace.settings.upgrade")}</Link>
                  </Button>
                ) : (
                  <Button variant="accent-outline" size="app" onClick={handleBillingPortal}>
                    {t("workspace.settings.billingPortal")}
                    <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </Button>
                )
              }
            >
              <div className="grid gap-0.5">
                <div className={setRowClass}>
                  <span className="min-w-0">
                    <span className="block text-[0.9375rem] font-medium text-ledger-ink">
                      {isFree
                        ? t("workspace.settings.freePlan")
                        : t("workspace.settings.planName", { tier: tierLabel })}
                    </span>
                    <span className="mt-0.5 block text-sm text-ledger-muted">
                      {isFree
                        ? t("workspace.settings.freeForever")
                        : renewalDate
                          ? t("workspace.settings.renews", { date: renewalDate })
                          : t("workspace.settings.renews", { date: "—" })}
                    </span>
                  </span>
                  <StatusChip tone={status === "active" ? "reviewed" : "unreviewed"} label={statusLabel} />
                </div>

                <div className={setRowClass}>
                  <span className="min-w-[200px] flex-1">
                    <span className="block text-[0.9375rem] font-medium text-ledger-ink">
                      {t("workspace.settings.receiptsThisMonth")}
                    </span>
                    {usageLoading ? (
                      <span className="mt-2.5 block h-[7px] animate-pulse rounded-full bg-ledger-surface-2" />
                    ) : !unlimited(receiptsLimit) ? (
                      <ProgressBar value={percentOf(receiptsUsed, receiptsLimit)} />
                    ) : null}
                  </span>
                  <span className="font-data text-[0.75rem] text-ledger-muted">
                    {usageLoading
                      ? "—"
                      : unlimited(receiptsLimit)
                        ? t("workspace.settings.unlimited")
                        : t("workspace.settings.usageMeta", {
                            used: receiptsUsed,
                            limit: receiptsLimit,
                          })}
                  </span>
                </div>

                <div className={setRowClass}>
                  <span className="min-w-[200px] flex-1">
                    <span className="block text-[0.9375rem] font-medium text-ledger-ink">
                      {t("workspace.settings.batchQueue")}
                    </span>
                    <span className="mt-0.5 block text-sm text-ledger-muted">
                      {t("workspace.settings.batchLimit", { limit: batchLimit })}
                    </span>
                  </span>
                  <span className="font-data text-[0.75rem] text-ledger-muted">
                    {t("workspace.settings.batchValue", { limit: batchLimit })}
                  </span>
                </div>

                <div className={setRowClass}>
                  <span className="min-w-[200px] flex-1">
                    <span className="block text-[0.9375rem] font-medium text-ledger-ink">
                      {t("workspace.settings.storage")}
                    </span>
                    {usageLoading ? (
                      <span className="mt-2.5 block h-[7px] animate-pulse rounded-full bg-ledger-surface-2" />
                    ) : !unlimited(storageLimit) ? (
                      <ProgressBar value={percentOf(storageUsed, storageLimit)} />
                    ) : null}
                  </span>
                  <span className="font-data text-[0.75rem] text-ledger-muted">
                    {usageLoading
                      ? "—"
                      : unlimited(storageLimit)
                        ? t("workspace.settings.unlimited")
                        : t("workspace.settings.storageMeta", {
                            used: formatStorage(storageUsed),
                            limit: formatStorage(storageLimit),
                          })}
                  </span>
                </div>
              </div>
            </Panel>
            <div className="mt-5">
              <BillingPreferences />
            </div>
            </>
          )}

          {section === "preferences" && (
            <Panel title={t("workspace.settings.preferencesTitle")}>
              <div className="grid gap-0.5">
                <div className={setRowClass}>
                  <span>
                    <span className="block text-[0.9375rem] font-medium text-ledger-ink">
                      {t("workspace.settings.currency")}
                    </span>
                    <span className="mt-0.5 block text-sm text-ledger-muted">
                      {t("workspace.settings.currencyLede")}
                    </span>
                  </span>
                  <span className="font-data text-[0.75rem] text-ledger-ink-2">
                    {t("workspace.settings.currencyValue")}
                  </span>
                </div>

                <div className={setRowClass}>
                  <span>
                    <span className="block text-[0.9375rem] font-medium text-ledger-ink">
                      {t("workspace.settings.language")}
                    </span>
                    <span className="mt-0.5 block text-sm text-ledger-muted">
                      {t("workspace.settings.languageLede")}
                    </span>
                  </span>
                  <select
                    aria-label={t("workspace.settings.language")}
                    className={selectClass}
                    value={language}
                    onChange={(event) => handleLanguageChange(event.target.value)}
                  >
                    <option value="en">English</option>
                    <option value="ms">Bahasa Melayu</option>
                  </select>
                </div>

                <div className={setRowClass}>
                  <span>
                    <span className="block text-[0.9375rem] font-medium text-ledger-ink">
                      {t("workspace.settings.theme")}
                    </span>
                    <span className="mt-0.5 block text-sm text-ledger-muted">
                      {t("workspace.settings.themeLede")}
                    </span>
                  </span>
                  <select
                    aria-label={t("workspace.settings.theme")}
                    className={selectClass}
                    value={theme.mode}
                    onChange={(event) => handleThemeChange(event.target.value)}
                  >
                    <option value="light">{t("workspace.settings.light")}</option>
                    <option value="dark">{t("workspace.settings.dark")}</option>
                    <option value="auto">{t("workspace.settings.auto")}</option>
                  </select>
                </div>
              </div>
            </Panel>
          )}

          {section === "api" &&
            (hasApiAccess ? (
              <ApiKeyManagement />
            ) : (
              <Panel title={t("workspace.settings.apiTitle")} description={t("workspace.settings.apiLede")}>
                <div className="flex flex-wrap items-start gap-4 rounded-[8px] border border-dashed border-ledger-line bg-ledger-surface-2/60 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ledger-accent-soft text-ledger-accent">
                    <Crown className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <div className="min-w-[220px] flex-1">
                    <h3 className="text-sm font-semibold text-ledger-ink">
                      {ts("apiKeys.upgrade.title", { defaultValue: "Max Plan Required" })}
                    </h3>
                    <p className="mt-1 max-w-[58ch] text-sm leading-relaxed text-ledger-muted">
                      {ts("apiKeys.upgrade.description", {
                        defaultValue:
                          "API key management is available exclusively for Max plan subscribers. Create and manage API keys to integrate with external applications and services.",
                      })}
                    </p>
                    <p className="mt-3 font-data text-[0.625rem] uppercase tracking-[0.12em] text-ledger-muted">
                      {ts("apiKeys.upgrade.currentPlan", {
                        defaultValue: "Current Plan: {{tier}}",
                        tier: tierLabel,
                      })}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="accent" size="app" asChild>
                        <Link to="/pricing">
                          <Crown className="mr-2 h-4 w-4" />
                          {ts("apiKeys.upgrade.actions.upgrade", { defaultValue: "Upgrade to Max Plan" })}
                        </Link>
                      </Button>
                      <Button variant="accent-outline" size="app" asChild>
                        <Link to="/api-reference">
                          {ts("apiKeys.upgrade.actions.viewDocs", {
                            defaultValue: "View API Documentation",
                          })}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </Panel>
            ))}

          {section === "categories" && <CategoryManager />}

          {section === "payers" && <PayerManager />}

          {section === "notifications" && <NotificationPreferences />}

          {section === "usage" && (
            <Panel
              title={ts("usage.title", { defaultValue: "Usage" })}
              description={ts("usage.description", { defaultValue: "Your plan limits and current consumption." })}
            >
              <SubscriptionLimitsDisplay showUpgradePrompts={true} />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
