import type { ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  useFeaturesTranslation,
  useHomepageTranslation,
} from "@/contexts/LanguageContext";
import { MarketingCtaBand } from "@/components/marketing/MarketingCtaBand";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { ArrowRight, CheckMark } from "@/components/marketing/MarketingIcons";

type FieldPair = { label: string; value: string };
type ReceiptItem = { name: string; amount: string };
type SearchResult = { title: string; meta: string; amount: string };
type QueueRow = {
  file: string;
  state: string;
  tag: string;
  progress: number;
  tone: string;
};
type TrailStep = { title: string; meta: string };
type SpendCategory = { name: string; amount: string; value: string };
type PlatformItem = { icon: string; title: string; description: string };
type PlanFact = { name: string; price: string; note: string };

const shell = "mx-auto w-full max-w-[1240px] px-5 min-[881px]:px-6";
const eyebrow =
  "font-data text-[0.6875rem] uppercase tracking-[0.16em] text-ledger-muted";
const sectionTitle =
  "font-display text-[clamp(2rem,3.6vw,3rem)] font-normal leading-[1.06] tracking-[-0.02em] text-ledger-ink";
const sectionLede = "text-[1.0625rem] leading-[1.65] text-ledger-muted";
const uiCard =
  "overflow-hidden rounded-xl border border-ledger-line bg-ledger-surface shadow-[0_1px_2px_rgba(18,23,21,0.05),0_18px_40px_-24px_rgba(18,23,21,0.28)]";
const uiHead =
  "flex items-center justify-between gap-4 border-b border-ledger-line px-[18px] py-[13px] font-data text-[0.625rem] uppercase tracking-[0.13em] text-ledger-muted";
const uiFoot =
  "flex flex-wrap justify-between gap-x-3 gap-y-2 border-t border-ledger-line bg-ledger-surface-2 px-[18px] py-[11px] font-data text-[0.6875rem] text-ledger-muted";
const statusDot = "h-1.5 w-1.5 rounded-full bg-ledger-accent";
const statusText = "inline-flex items-center gap-1.5 text-ledger-accent";

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

function FileIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

function PlatformGlyph({ name }: { name: string }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "mb-3 h-5 w-5 text-ledger-accent",
  };

  switch (name) {
    case "categories":
      return (
        <svg {...props}>
          <path d="M3 11V4h7l9 9-6 6-10-9Z" />
          <circle cx="7.5" cy="7.5" r="1.2" />
        </svg>
      );
    case "storage":
      return (
        <svg {...props}>
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      );
    case "notifications":
      return (
        <svg {...props}>
          <path d="M18 8a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
          <path d="M10.5 20a2 2 0 0 0 3 0" />
        </svg>
      );
    case "mobile":
      return (
        <svg {...props}>
          <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
          <path d="M11 18.5h2" />
        </svg>
      );
    case "api":
      return (
        <svg {...props}>
          <path d="M8 3H6a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h2" />
          <path d="M16 3h2a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2" />
        </svg>
      );
    case "subscription":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18" />
        </svg>
      );
    case "help":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 1 1 4 2c-.9.6-1.5 1.2-1.5 2.2" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "export":
      return (
        <svg {...props}>
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M4 20h16" />
        </svg>
      );
    default:
      return null;
  }
}

function FeatureBlock({
  id,
  tint = false,
  reverse = false,
  num,
  title,
  lede,
  checks,
  children,
}: {
  id: string;
  tint?: boolean;
  reverse?: boolean;
  num: string;
  title: string;
  lede: string;
  checks: string[];
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-[164px] border-b border-ledger-line py-16 min-[881px]:scroll-mt-[84px] min-[881px]:py-[88px] ${
        tint ? "bg-ledger-surface" : ""
      }`}
    >
      <div
        className={`${shell} grid grid-cols-1 items-center gap-9 min-[881px]:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] min-[881px]:gap-10 min-[1025px]:gap-16`}
      >
        <div className={reverse ? "min-[881px]:order-2" : ""}>
          <p className="font-data text-[0.6875rem] uppercase tracking-[0.12em] text-ledger-accent">
            {num}
          </p>
          <h2 className={`${sectionTitle} mb-4 mt-3.5`}>{title}</h2>
          <p className={`${sectionLede} max-w-[46ch]`}>{lede}</p>
          <ul className="mt-6 grid gap-2.5">
            {checks.map((check) => (
              <li
                key={check}
                className="flex items-start gap-2.5 text-[0.9375rem] leading-[1.5] text-ledger-ink-2"
              >
                <CheckMark className="mt-[3px] h-4 w-4 shrink-0 text-ledger-accent" />
                <span>{check}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={reverse ? "min-[881px]:order-1" : ""}>{children}</div>
      </div>
    </section>
  );
}

export default function FeaturesPage() {
  const { user } = useAuth();
  const { t } = useFeaturesTranslation();
  const { t: tHome } = useHomepageTranslation();

  const copy = (key: string) => String(t(key));
  const list = <T,>(key: string): T[] =>
    t(key, { returnObjects: true }) as unknown as T[];

  const workspaceTarget = user ? "/dashboard" : "/auth";

  const extractionFieldKeys = [
    "merchant",
    "date",
    "lineItems",
    "subtotal",
    "sst",
    "total",
    "payment",
    "category",
    "confidence",
  ];

  const extractionFields: FieldPair[] = extractionFieldKeys.map((key) => ({
    label: copy(`page.extractionCard.fields.${key}.label`),
    value: copy(`page.extractionCard.fields.${key}.value`),
  }));

  const extractionReceipt = {
    label: copy("page.blocks.extraction.receipt.label"),
    status: copy("page.blocks.extraction.receipt.status"),
    merchant: copy("page.blocks.extraction.receipt.merchant"),
    meta: copy("page.blocks.extraction.receipt.meta"),
    items: list<ReceiptItem>("page.blocks.extraction.receipt.items"),
    totalLabel: copy("page.blocks.extraction.receipt.totalLabel"),
    total: copy("page.blocks.extraction.receipt.total"),
    fields: ["merchant", "date", "total", "category"].map((key) => ({
      label: copy(`page.blocks.extraction.receipt.fields.${key}.label`),
      value: copy(`page.blocks.extraction.receipt.fields.${key}.value`),
    })),
    footLeft: copy("page.blocks.extraction.receipt.footLeft"),
    footRight: copy("page.blocks.extraction.receipt.footRight"),
  };

  const searchMock = {
    label: copy("page.blocks.search.mock.label"),
    shortcut: copy("page.blocks.search.mock.shortcut"),
    query: copy("page.blocks.search.mock.query"),
    chips: list<string>("page.blocks.search.mock.chips"),
    results: list<SearchResult>("page.blocks.search.mock.results"),
    footLeft: copy("page.blocks.search.mock.footLeft"),
    footRight: copy("page.blocks.search.mock.footRight"),
  };

  const taxRows = list<{ label: string; value: string; total: boolean }>(
    "page.blocks.malaysia.mock.rows",
  );
  const taxTags = list<string>("page.blocks.malaysia.mock.tags");

  const queueRows = list<QueueRow>("page.blocks.batch.mock.rows");

  const trailReceipt = {
    merchant: copy("page.blocks.team.mock.receipt.merchant"),
    meta: copy("page.blocks.team.mock.receipt.meta"),
    amount: copy("page.blocks.team.mock.receipt.amount"),
  };
  const trailSteps = list<TrailStep>("page.blocks.team.mock.trail");

  const spendCategories = list<SpendCategory>(
    "page.blocks.reporting.mock.categories",
  );

  const platformItems = list<PlatformItem>("page.platform.items");
  const planFacts = list<PlanFact>("page.plans.facts");

  const indexLinks = [
    { id: "extraction", label: copy("page.index.extraction") },
    { id: "search", label: copy("page.index.search") },
    { id: "malaysia", label: copy("page.index.malaysia") },
    { id: "batch", label: copy("page.index.batch") },
    { id: "team", label: copy("page.index.team") },
    { id: "reporting", label: copy("page.index.reporting") },
    { id: "platform", label: copy("page.index.platform") },
  ];

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

      <MarketingHeader active="features" />

      <main id="main">
        <section className="overflow-hidden">
          <div
            className={`${shell} grid grid-cols-1 items-center gap-10 pb-12 pt-10 min-[641px]:pb-[56px] min-[641px]:pt-[52px] min-[881px]:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] min-[881px]:pb-[72px] min-[881px]:pt-[72px] min-[1025px]:gap-16`}
          >
            <div>
              <p className={eyebrow}>{copy("page.hero.eyebrow")}</p>
              <h1 className="mb-5 mt-[18px] max-w-[18ch] font-display text-[clamp(2.6rem,5vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.026em] min-[881px]:max-w-[15ch]">
                {copy("page.hero.titleLead")}{" "}
                <em className="italic text-ledger-accent">
                  {copy("page.hero.titleAccent")}
                </em>{" "}
                {copy("page.hero.titleTail")}
              </h1>
              <p className="max-w-[48ch] text-[1.125rem] leading-[1.6] text-ledger-muted">
                {copy("page.hero.lede")}
              </p>
              <div className="mt-[30px] flex flex-wrap gap-3 max-[640px]:flex-col max-[640px]:items-start">
                <Button
                  asChild
                  variant="accent"
                  className="h-[46px] rounded-lg px-5 text-[0.9375rem] font-semibold"
                >
                  <Link to={workspaceTarget}>
                    {copy("page.hero.workspace")}
                    <ArrowRight className="ml-2 h-[18px] w-[18px]" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="accent-outline"
                  className="h-[46px] rounded-lg border-ledger-line-strong px-5 text-[0.9375rem] font-semibold"
                >
                  <Link to="/pricing">{copy("page.hero.pricing")}</Link>
                </Button>
              </div>
              <p className="mt-[26px] border-t border-ledger-line pt-[18px] font-data text-[0.6875rem] tracking-[0.06em] text-ledger-muted">
                {copy("page.hero.note")}
              </p>
            </div>

            <aside
              aria-label={copy("page.extractionCard.label")}
              className="w-full max-w-[560px] overflow-hidden rounded-xl border border-ledger-line bg-ledger-surface shadow-[0_1px_2px_rgba(18,23,21,0.05),0_18px_40px_-24px_rgba(18,23,21,0.28)] min-[881px]:max-w-none"
            >
              <div className="flex items-center justify-between gap-4 border-b border-ledger-line px-[18px] py-3.5 font-data text-[0.625rem] uppercase tracking-[0.14em] text-ledger-muted">
                <span>{copy("page.extractionCard.label")}</span>
                <span className={statusText}>
                  <span aria-hidden="true" className={statusDot} />
                  {copy("page.extractionCard.status")}
                </span>
              </div>
              <div className="px-[18px] py-1">
                {extractionFields.map((field) => (
                  <div
                    key={field.label}
                    className="grid grid-cols-[78px_minmax(0,1fr)_16px] items-center gap-2.5 border-b border-ledger-line py-[9px] last:border-b-0 min-[641px]:grid-cols-[92px_minmax(0,1fr)_16px] min-[641px]:gap-3"
                  >
                    <span className="font-data text-[0.625rem] uppercase tracking-[0.1em] text-ledger-muted">
                      {field.label}
                    </span>
                    <span className="text-[0.9375rem] font-medium">
                      {field.value}
                    </span>
                    <CheckMark className="h-4 w-4 text-ledger-accent" />
                  </div>
                ))}
              </div>
              <p className="border-t border-ledger-line bg-ledger-surface-2 px-[18px] py-3 text-[0.8125rem] text-ledger-muted">
                {copy("page.extractionCard.foot")}
              </p>
            </aside>
          </div>
        </section>

        <nav
          aria-label={copy("page.index.label")}
          className="border-b border-ledger-line bg-ledger-surface"
        >
          <div
            className={`${shell} flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
          >
            <span className="mr-2.5 whitespace-nowrap font-data text-[0.625rem] uppercase tracking-[0.14em] text-ledger-muted">
              {copy("page.index.label")}
            </span>
            {indexLinks.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className="inline-flex min-h-[52px] items-center whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-medium text-ledger-ink-2 transition-colors hover:border-ledger-line-strong hover:text-ledger-accent"
              >
                {link.label}
              </a>
            ))}
          </div>
        </nav>

        <FeatureBlock
          id="extraction"
          num={copy("page.blocks.extraction.num")}
          title={copy("page.blocks.extraction.title")}
          lede={copy("page.blocks.extraction.lede")}
          checks={list<string>("page.blocks.extraction.checks")}
        >
          <div className={uiCard}>
            <div className={uiHead}>
              <span>{extractionReceipt.label}</span>
              <span className={statusText}>
                <span aria-hidden="true" className={statusDot} />
                {extractionReceipt.status}
              </span>
            </div>
            <div className="p-[18px]">
              <div className="rounded-lg border border-dashed border-[#C9CEC4] bg-[#FBFBF7] px-4 py-3.5 font-data text-xs leading-[1.6] text-[#1A211E]">
                <p className="text-center text-xs font-medium uppercase leading-[1.6] tracking-[0.14em]">
                  {extractionReceipt.merchant}
                </p>
                <p className="mt-0.5 text-center text-[0.6875rem] text-[#5F675F]">
                  {extractionReceipt.meta}
                </p>
                <div className="my-2.5 border-t border-dashed border-[#C9CEC4]" />
                <ul className="grid gap-0.5">
                  {extractionReceipt.items.map((item) => (
                    <li
                      key={item.name}
                      className="flex justify-between gap-3 py-0.5"
                    >
                      <span>{item.name}</span>
                      <span>{item.amount}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex justify-between gap-3 border-t border-[#1A211E] pt-1.5 font-medium">
                  <span>{extractionReceipt.totalLabel}</span>
                  <span>{extractionReceipt.total}</span>
                </div>
              </div>
              <ul className="mt-3.5 border-t border-ledger-line">
                {extractionReceipt.fields.map((field) => (
                  <li
                    key={field.label}
                    className="grid grid-cols-[82px_minmax(0,1fr)_16px] items-center gap-2.5 border-b border-ledger-line py-2 text-sm leading-[1.6] last:border-b-0"
                  >
                    <span className="font-data text-[0.625rem] uppercase tracking-[0.1em] text-ledger-muted">
                      {field.label}
                    </span>
                    <b className="font-medium">{field.value}</b>
                    <CheckMark className="h-4 w-4 text-ledger-accent" />
                  </li>
                ))}
              </ul>
            </div>
            <div className={uiFoot}>
              <span>{extractionReceipt.footLeft}</span>
              <span>{extractionReceipt.footRight}</span>
            </div>
          </div>
        </FeatureBlock>

        <FeatureBlock
          id="search"
          tint
          reverse
          num={copy("page.blocks.search.num")}
          title={copy("page.blocks.search.title")}
          lede={copy("page.blocks.search.lede")}
          checks={list<string>("page.blocks.search.checks")}
        >
          <div className={uiCard}>
            <div className={uiHead}>
              <span>{searchMock.label}</span>
              <span className="rounded border border-ledger-line px-1.5 py-0.5 font-data text-[0.625rem] text-ledger-muted">
                {searchMock.shortcut}
              </span>
            </div>
            <div className="p-[18px]">
              <div className="flex items-center gap-2.5 rounded-lg border border-ledger-line-strong bg-ledger-surface-2 px-3 py-2.5">
                <SearchIcon className="h-4 w-4 text-ledger-muted" />
                <span className="text-[0.9375rem] font-medium">
                  {searchMock.query}
                </span>
                <span
                  aria-hidden="true"
                  className="ledger-caret h-[18px] w-px bg-ledger-accent"
                />
              </div>
              <div className="my-3 flex flex-wrap gap-1.5" aria-hidden="true">
                {searchMock.chips.map((chip, index) => (
                  <span
                    key={chip}
                    className={
                      index === 0
                        ? "inline-flex min-h-7 items-center rounded-full border border-[#BBD9C9] bg-ledger-accent-soft px-2.5 text-xs font-semibold text-ledger-accent dark:border-ledger-accent/35"
                        : "inline-flex min-h-7 items-center rounded-full border border-ledger-line bg-ledger-surface px-2.5 text-xs text-ledger-muted"
                    }
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <ul className="grid">
                {searchMock.results.map((result) => (
                  <li
                    key={result.title}
                    className="flex items-center justify-between gap-4 border-t border-ledger-line py-2.5"
                  >
                    <div className="min-w-0">
                      <b className="block text-sm font-semibold leading-[1.6]">
                        {result.title}
                      </b>
                      <span className="block text-xs leading-[1.6] text-ledger-muted">
                        {result.meta}
                      </span>
                    </div>
                    <span className="whitespace-nowrap font-data text-[0.8125rem] text-ledger-ink">
                      {result.amount}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={uiFoot}>
              <span>{searchMock.footLeft}</span>
              <span>{searchMock.footRight}</span>
            </div>
          </div>
        </FeatureBlock>

        <FeatureBlock
          id="malaysia"
          num={copy("page.blocks.malaysia.num")}
          title={copy("page.blocks.malaysia.title")}
          lede={copy("page.blocks.malaysia.lede")}
          checks={list<string>("page.blocks.malaysia.checks")}
        >
          <div className={uiCard}>
            <div className={uiHead}>
              <span>{copy("page.blocks.malaysia.mock.label")}</span>
              <span>{copy("page.blocks.malaysia.mock.date")}</span>
            </div>
            <div className="p-[18px]">
              <dl className="grid gap-2.5">
                {taxRows.map((row) => (
                  <div
                    key={row.label}
                    className={
                      row.total
                        ? "mt-0.5 flex items-baseline justify-between gap-4 border-t border-ledger-ink pt-2.5"
                        : "flex items-baseline justify-between gap-4"
                    }
                  >
                    <dt
                      className={
                        row.total
                          ? "font-semibold text-ledger-ink"
                          : "text-sm text-ledger-muted"
                      }
                    >
                      {row.label}
                    </dt>
                    <dd
                      className={
                        row.total
                          ? "font-data text-lg font-semibold text-ledger-ink"
                          : "font-data text-[0.9375rem] text-ledger-ink"
                      }
                    >
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-[18px] flex flex-wrap gap-1.5">
                {taxTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex min-h-7 items-center rounded-full border border-ledger-line bg-ledger-surface-2 px-2.5 text-xs text-ledger-ink-2"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className={uiFoot}>
              <span>{copy("page.blocks.malaysia.mock.footLeft")}</span>
              <span>{copy("page.blocks.malaysia.mock.footRight")}</span>
            </div>
          </div>
        </FeatureBlock>

        <FeatureBlock
          id="batch"
          tint
          reverse
          num={copy("page.blocks.batch.num")}
          title={copy("page.blocks.batch.title")}
          lede={copy("page.blocks.batch.lede")}
          checks={list<string>("page.blocks.batch.checks")}
        >
          <div className={uiCard}>
            <div className={uiHead}>
              <span>{copy("page.blocks.batch.mock.label")}</span>
              <span>{copy("page.blocks.batch.mock.count")}</span>
            </div>
            <div className="p-[18px]">
              <div className="grid gap-3.5">
                {queueRows.map((row) => (
                  <div
                    key={row.file}
                    className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1"
                  >
                    <FileIcon className="h-4 w-4 text-ledger-muted" />
                    <div>
                      <b className="block text-[0.8125rem] font-semibold">
                        {row.file}
                      </b>
                      <span className="block text-xs leading-[1.6] text-ledger-muted">
                        {row.state}
                      </span>
                    </div>
                    <span
                      className={
                        row.tone === "reading"
                          ? "font-data text-[0.625rem] uppercase tracking-[0.06em] text-ledger-accent"
                          : "font-data text-[0.625rem] uppercase tracking-[0.06em] text-ledger-muted"
                      }
                    >
                      {row.tag}
                    </span>
                    <div className="col-[2/-1] h-1 overflow-hidden rounded-sm bg-ledger-surface-2">
                      <span
                        className={
                          row.tone === "wait"
                            ? "block h-full bg-ledger-line-strong"
                            : "block h-full bg-ledger-accent"
                        }
                        style={{ width: `${row.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={uiFoot}>
              <span>{copy("page.blocks.batch.mock.footLeft")}</span>
              <span>{copy("page.blocks.batch.mock.footRight")}</span>
            </div>
          </div>
        </FeatureBlock>

        <FeatureBlock
          id="team"
          num={copy("page.blocks.team.num")}
          title={copy("page.blocks.team.title")}
          lede={copy("page.blocks.team.lede")}
          checks={list<string>("page.blocks.team.checks")}
        >
          <div className={uiCard}>
            <div className={uiHead}>
              <span>{copy("page.blocks.team.mock.label")}</span>
              <span className={statusText}>
                <span aria-hidden="true" className={statusDot} />
                {copy("page.blocks.team.mock.status")}
              </span>
            </div>
            <div className="p-[18px]">
              <div className="flex items-center justify-between gap-4 border-b border-ledger-line pb-3.5">
                <div>
                  <b className="block text-[0.9375rem] font-semibold">
                    {trailReceipt.merchant}
                  </b>
                  <span className="block text-xs leading-[1.6] text-ledger-muted">
                    {trailReceipt.meta}
                  </span>
                </div>
                <strong className="whitespace-nowrap font-data text-[0.9375rem] font-medium">
                  {trailReceipt.amount}
                </strong>
              </div>
              <ol className="mt-1.5 grid">
                {trailSteps.map((step) => (
                  <li
                    key={step.title}
                    className="relative flex gap-3 py-3 [&:not(:last-child)]:before:absolute [&:not(:last-child)]:before:bottom-[-4px] [&:not(:last-child)]:before:left-[5px] [&:not(:last-child)]:before:top-[30px] [&:not(:last-child)]:before:w-px [&:not(:last-child)]:before:bg-ledger-line"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-ledger-accent bg-ledger-surface"
                    />
                    <div>
                      <b className="block text-[0.8125rem] font-semibold">
                        {step.title}
                      </b>
                      <span className="block text-xs leading-[1.6] text-ledger-muted">
                        {step.meta}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </FeatureBlock>

        <FeatureBlock
          id="reporting"
          tint
          reverse
          num={copy("page.blocks.reporting.num")}
          title={copy("page.blocks.reporting.title")}
          lede={copy("page.blocks.reporting.lede")}
          checks={list<string>("page.blocks.reporting.checks")}
        >
          <div className={uiCard}>
            <div className={uiHead}>
              <span>{copy("page.blocks.reporting.mock.label")}</span>
              <span>{copy("page.blocks.reporting.mock.total")}</span>
            </div>
            <div className="p-[18px]">
              <svg
                className="h-auto w-full"
                viewBox="0 0 320 170"
                role="img"
                aria-label={copy("page.blocks.reporting.mock.chartLabel")}
              >
                <line
                  x1="20"
                  y1="36"
                  x2="304"
                  y2="36"
                  stroke="var(--ledger-line)"
                />
                <line
                  x1="20"
                  y1="68"
                  x2="304"
                  y2="68"
                  stroke="var(--ledger-line)"
                />
                <line
                  x1="20"
                  y1="100"
                  x2="304"
                  y2="100"
                  stroke="var(--ledger-line)"
                />
                <line
                  x1="20"
                  y1="132"
                  x2="304"
                  y2="132"
                  stroke="var(--ledger-line-strong)"
                />
                <rect
                  x="44"
                  y="36"
                  width="56"
                  height="96"
                  rx="2"
                  fill="var(--ledger-chart-1)"
                />
                <rect
                  x="136"
                  y="65"
                  width="56"
                  height="67"
                  rx="2"
                  fill="var(--ledger-chart-2)"
                />
                <rect
                  x="228"
                  y="96"
                  width="56"
                  height="36"
                  rx="2"
                  fill="var(--ledger-chart-3)"
                />
                <text
                  x="72"
                  y="27"
                  textAnchor="middle"
                  fontFamily="IBM Plex Mono, monospace"
                  fontSize="9"
                  fill="var(--ledger-ink-2)"
                >
                  {spendCategories[0]?.amount}
                </text>
                <text
                  x="164"
                  y="56"
                  textAnchor="middle"
                  fontFamily="IBM Plex Mono, monospace"
                  fontSize="9"
                  fill="var(--ledger-ink-2)"
                >
                  {spendCategories[1]?.amount}
                </text>
                <text
                  x="256"
                  y="87"
                  textAnchor="middle"
                  fontFamily="IBM Plex Mono, monospace"
                  fontSize="9"
                  fill="var(--ledger-ink-2)"
                >
                  {spendCategories[2]?.amount}
                </text>
                <text
                  x="72"
                  y="148"
                  textAnchor="middle"
                  fontFamily="IBM Plex Mono, monospace"
                  fontSize="9"
                  fill="var(--ledger-muted)"
                >
                  {spendCategories[0]?.name}
                </text>
                <text
                  x="164"
                  y="148"
                  textAnchor="middle"
                  fontFamily="IBM Plex Mono, monospace"
                  fontSize="9"
                  fill="var(--ledger-muted)"
                >
                  {spendCategories[1]?.name}
                </text>
                <text
                  x="256"
                  y="148"
                  textAnchor="middle"
                  fontFamily="IBM Plex Mono, monospace"
                  fontSize="9"
                  fill="var(--ledger-muted)"
                >
                  {spendCategories[2]?.name}
                </text>
              </svg>
              <ul className="mt-3.5 grid gap-2">
                {spendCategories.map((category, index) => (
                  <li
                    key={category.name}
                    className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2 text-[0.8125rem] text-ledger-ink-2"
                  >
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-[2px]"
                      style={{
                        backgroundColor: `var(--ledger-chart-${index + 1})`,
                      }}
                    />
                    <span>{category.name}</span>
                    <b className="font-data font-medium">{category.value}</b>
                  </li>
                ))}
              </ul>
            </div>
            <div className={uiFoot}>
              <span>{copy("page.blocks.reporting.mock.footLeft")}</span>
              <span>{copy("page.blocks.reporting.mock.footRight")}</span>
            </div>
          </div>
        </FeatureBlock>

        <section
          id="platform"
          className="scroll-mt-[164px] border-b border-ledger-line bg-ledger-surface py-16 min-[881px]:scroll-mt-[84px] min-[881px]:py-[88px]"
        >
          <div className={shell}>
            <div className="mb-10 flex flex-wrap items-end justify-between gap-8">
              <div>
                <p className={eyebrow}>{copy("page.platform.eyebrow")}</p>
                <h2 className={`${sectionTitle} mt-3.5`}>
                  {copy("page.platform.title")}
                </h2>
              </div>
              <p className={`${sectionLede} max-w-[46ch]`}>
                {copy("page.platform.lede")}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-x-8 min-[641px]:grid-cols-2 min-[1025px]:grid-cols-4">
              {platformItems.map((item) => (
                <article
                  key={item.title}
                  className="border-t border-ledger-line pb-2.5 pt-5"
                >
                  <PlatformGlyph name={item.icon} />
                  <h3 className="mb-1.5 text-base font-semibold leading-[1.6] tracking-[-0.005em]">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-[1.55] text-ledger-muted">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div
            className={`${shell} grid grid-cols-1 items-center gap-8 min-[881px]:grid-cols-2 min-[881px]:gap-10 min-[1025px]:gap-16`}
          >
            <div>
              <p className={eyebrow}>{copy("page.plans.eyebrow")}</p>
              <h2 className={`${sectionTitle} mb-4 mt-3.5`}>
                {copy("page.plans.title")}
              </h2>
              <p className={`${sectionLede} max-w-[54ch]`}>
                {copy("page.plans.lede")}
              </p>
              <Button
                asChild
                variant="accent"
                className="mt-6 h-[46px] rounded-lg px-5 text-[0.9375rem] font-semibold"
              >
                <Link to="/pricing">{copy("page.plans.cta")}</Link>
              </Button>
            </div>
            <div className="grid border-t border-ledger-line">
              {planFacts.map((fact) => (
                <div
                  key={fact.name}
                  className="grid grid-cols-[56px_minmax(0,1fr)] items-baseline gap-x-4 gap-y-4 border-b border-ledger-line py-4 min-[641px]:grid-cols-[64px_minmax(0,1fr)_auto]"
                >
                  <span className="font-data text-[0.6875rem] uppercase tracking-[0.12em] text-ledger-muted">
                    {fact.name}
                  </span>
                  <span className="font-data text-base font-medium leading-[1.6]">
                    {fact.price}
                  </span>
                  <span className="col-start-2 text-[0.8125rem] text-ledger-muted min-[641px]:col-start-3 min-[641px]:text-right">
                    {fact.note}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <MarketingCtaBand
          eyebrow={copy("page.cta.eyebrow")}
          title={copy("page.cta.title")}
          lede={copy("page.cta.lede")}
          primary={{ label: copy("page.cta.workspace"), to: workspaceTarget }}
          secondary={{ label: copy("page.cta.pricing"), to: "/pricing" }}
        />
      </main>

      <MarketingFooter />
    </div>
  );
}
