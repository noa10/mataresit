import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowUpRight, Terminal } from "lucide-react";
import {
  useHomepageTranslation,
  useResourcesTranslation,
} from "@/contexts/LanguageContext";
import { MarketingCodeCard } from "@/components/marketing/MarketingCodeCard";
import { MarketingCtaBand } from "@/components/marketing/MarketingCtaBand";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingPageHero } from "@/components/marketing/MarketingPageHero";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const API_BASE_URL =
  "https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/external-api/api/v1";

const shell = "mx-auto w-full max-w-[1240px] px-5 min-[881px]:px-6";

type HttpMethod = "GET" | "POST";

interface Endpoint {
  key: string;
  method: HttpMethod;
  path: string;
  body?: Record<string, unknown>;
}

const endpointGroups: Array<{ key: string; items: Endpoint[] }> = [
  {
    key: "health",
    items: [{ key: "health", method: "GET", path: "/health" }],
  },
  {
    key: "receipts",
    items: [
      { key: "receiptsList", method: "GET", path: "/receipts" },
      {
        key: "receiptCreate",
        method: "POST",
        path: "/receipts",
        body: {
          merchant: "Nasi Kandar Pelita",
          date: "2026-10-24",
          currency: "MYR",
          total: 27.56,
          category: "meals",
          payment_method: "card",
        },
      },
      {
        key: "receiptsBatch",
        method: "POST",
        path: "/receipts/batch",
        body: {
          receipts: [
            {
              merchant: "Nasi Kandar Pelita",
              date: "2026-10-24",
              currency: "MYR",
              total: 27.56,
            },
          ],
        },
      },
    ],
  },
  {
    key: "search",
    items: [
      {
        key: "searchSuggestions",
        method: "GET",
        path: "/search/suggestions?q=coffee&limit=5",
      },
      { key: "searchSources", method: "GET", path: "/search/sources" },
    ],
  },
  {
    key: "teams",
    items: [
      { key: "teamsList", method: "GET", path: "/teams" },
      { key: "teamDetails", method: "GET", path: "/teams/{id}" },
      { key: "teamStats", method: "GET", path: "/teams/{id}/stats" },
    ],
  },
  {
    key: "claims",
    items: [
      { key: "claimsList", method: "GET", path: "/claims?status=pending" },
      {
        key: "claimsCreate",
        method: "POST",
        path: "/claims",
        body: {
          title: "October client lunch",
          amount: 27.56,
          currency: "MYR",
          receipt_ids: ["rcpt_8Fj2kQ"],
        },
      },
    ],
  },
  {
    key: "analytics",
    items: [
      {
        key: "analyticsSpending",
        method: "GET",
        path: "/analytics/spending?group_by=category",
      },
      {
        key: "analyticsTrends",
        method: "GET",
        path: "/analytics/trends?period=month",
      },
    ],
  },
];

const requestExample = JSON.stringify(
  {
    merchant: "Nasi Kandar Pelita",
    date: "2026-10-24",
    currency: "MYR",
    total: 27.56,
    category: "meals",
    payment_method: "card",
  },
  null,
  2,
);

const responseExample = JSON.stringify(
  {
    id: "rcpt_8Fj2kQ",
    merchant: "Nasi Kandar Pelita",
    total: 27.56,
    currency: "MYR",
    status: "processed",
    confidence: 0.96,
    created_at: "2026-10-24T09:41:02Z",
  },
  null,
  2,
);

const baseUrlExample =
  "https://mpmkbtsufihzdelrlszs.supabase.co\n  /functions/v1/external-api/api/v1";

function buildCurl(endpoint: Endpoint) {
  const lines = [
    `curl '${API_BASE_URL}${endpoint.path}' \\`,
    "  -H 'Authorization: Bearer <access-token>' \\",
    "  -H 'X-API-Key: <api-key>'",
  ];

  if (endpoint.method === "POST") {
    lines[2] += " \\";
    lines.push("  -H 'Content-Type: application/json' \\");
    lines.push(`  -d '${JSON.stringify(endpoint.body ?? {}, null, 2)}'`);
  }

  return lines.join("\n");
}

function SectionHeading({ title, lede }: { title: string; lede?: string }) {
  return (
    <div>
      <h2 className="font-display text-[clamp(1.6rem,2.4vw,2rem)] font-normal leading-[1.12] tracking-[-0.016em] text-ledger-ink">
        {title}
      </h2>
      {lede ? (
        <p className="mt-2 max-w-[66ch] text-[1.0625rem] leading-[1.6] text-ledger-muted">
          {lede}
        </p>
      ) : null}
    </div>
  );
}

export default function ApiReferencePage() {
  const { t } = useResourcesTranslation();
  const { t: tHome } = useHomepageTranslation();
  const [selected, setSelected] = useState<Endpoint | null>(null);

  const copy = (key: string) => String(t(key));
  const plans = t("api.plans.rows", { returnObjects: true }) as unknown as Array<{
    plan: string;
    access: string;
    rate: string;
    batch: string;
  }>;
  const errors = t("api.meta.errors", { returnObjects: true }) as unknown as Array<{
    code: string;
    text: string;
  }>;
  const scopes = t("api.auth.scopes", { returnObjects: true }) as unknown as string[];
  const headers = t("api.auth.headers", { returnObjects: true }) as unknown as Array<{
    name: string;
    value: string;
  }>;

  const quickTest = useMemo(
    () =>
      [
        `curl '${API_BASE_URL}/health' \\`,
        "  -H 'Authorization: Bearer <access-token>' \\",
        "  -H 'X-API-Key: <api-key>'",
        String(t("api.quickStart.testComment")),
      ].join("\n"),
    [t],
  );

  const selectedCopy = selected
    ? {
        desc: copy(`api.endpoints.items.${selected.key}.desc`),
        params: copy(`api.endpoints.items.${selected.key}.params`),
        group: copy(
          `api.endpoints.groups.${
            endpointGroups.find((group) =>
              group.items.some((item) => item.key === selected.key),
            )?.key ?? "health"
          }`,
        ),
      }
    : null;

  return (
    <div className="min-h-screen bg-ledger-paper leading-[1.6] text-ledger-ink">
      <Helmet>
        <title>{copy("meta.api.title")}</title>
        <meta name="description" content={copy("meta.api.description")} />
      </Helmet>

      <a
        href="#main"
        className="absolute left-4 top-[-64px] z-[100] rounded-md bg-ledger-ink px-4 py-2.5 text-sm text-ledger-paper focus:top-3"
      >
        {String(tHome("skipToContent"))}
      </a>

      <MarketingHeader />

      <main id="main">
        <MarketingPageHero
          eyebrow={copy("api.hero.eyebrow")}
          titleLead={copy("api.hero.titleLead")}
          titleAccent={copy("api.hero.titleAccent")}
          lede={copy("api.hero.lede")}
          note={copy("api.hero.note")}
        />

        <section className="border-b border-ledger-line">
          <div className={`${shell} grid gap-12 py-10 min-[881px]:gap-16 min-[881px]:py-14`}>
            <div className="grid gap-6">
              <SectionHeading
                title={copy("api.quickStart.title")}
                lede={copy("api.quickStart.lede")}
              />
              <div className="grid gap-3 min-[881px]:grid-cols-[1fr_1.4fr]">
                <MarketingCodeCard
                  title={copy("api.quickStart.baseUrlLabel")}
                  meta={copy("api.quickStart.baseUrlMeta")}
                  code={baseUrlExample}
                  copyLabel={copy("shared.copy")}
                  copiedLabel={copy("shared.copied")}
                />
                <MarketingCodeCard
                  title={copy("api.quickStart.testLabel")}
                  meta={copy("api.quickStart.testMeta")}
                  code={quickTest}
                  copyLabel={copy("shared.copy")}
                  copiedLabel={copy("shared.copied")}
                />
              </div>
            </div>

            <div className="grid gap-6">
              <SectionHeading
                title={copy("api.auth.title")}
                lede={copy("api.auth.lede")}
              />
              <div className="grid gap-2">
                {headers.map((header) => (
                  <div
                    key={header.name}
                    className="grid items-center gap-1 rounded-[10px] border border-ledger-line bg-ledger-surface px-4 py-3.5 min-[881px]:grid-cols-[150px_1fr] min-[881px]:gap-3.5"
                  >
                    <span className="font-data text-xs font-medium text-ledger-accent">
                      {header.name}
                    </span>
                    <span className="break-words font-data text-xs text-ledger-muted">
                      {header.value}
                    </span>
                  </div>
                ))}
              </div>

              <div>
                <p className="font-data text-[0.6875rem] uppercase tracking-[0.14em] text-ledger-muted">
                  {copy("api.auth.scopesLabel")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {scopes.map((scope) => (
                    <span
                      key={scope}
                      className="rounded-full bg-ledger-accent-soft px-2.5 py-1.5 font-data text-[0.6875rem] text-ledger-accent"
                    >
                      {scope}
                    </span>
                  ))}
                </div>
              </div>

              <p className="max-w-[70ch] text-[0.9375rem] leading-[1.65] text-ledger-muted">
                {copy("api.auth.note")}
              </p>
            </div>

            <div className="grid gap-6">
              <SectionHeading
                title={copy("api.endpoints.title")}
                lede={copy("api.endpoints.lede")}
              />

              <div className="grid gap-[34px]">
                {endpointGroups.map((group) => (
                  <div key={group.key}>
                    <p className="mb-2.5 flex items-center gap-2.5 font-data text-[0.6875rem] uppercase tracking-[0.14em] text-ledger-muted">
                      {copy(`api.endpoints.groups.${group.key}`)}
                      <span aria-hidden="true" className="h-px flex-1 bg-ledger-line" />
                    </p>
                    <div className="overflow-hidden rounded-[10px] border border-ledger-line">
                      {group.items.map((endpoint) => (
                        <button
                          key={endpoint.key}
                          type="button"
                          onClick={() => setSelected(endpoint)}
                          className="grid w-full grid-cols-[56px_minmax(0,1fr)] items-center gap-x-4 gap-y-1 bg-ledger-surface px-4 py-[13px] text-left transition-colors hover:bg-ledger-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ledger-accent/40 min-[881px]:grid-cols-[74px_250px_1fr_auto]"
                        >
                          <span
                            className={
                              endpoint.method === "GET"
                                ? "w-14 rounded-md bg-ledger-accent-soft px-2 py-1 text-center font-data text-[0.625rem] font-medium tracking-[0.08em] text-ledger-accent"
                                : "w-14 rounded-md bg-ledger-panel px-2 py-1 text-center font-data text-[0.625rem] font-medium tracking-[0.08em] text-ledger-on-panel"
                            }
                          >
                            {endpoint.method}
                          </span>
                          <span className="truncate font-data text-[0.8125rem] text-ledger-ink">
                            {endpoint.path}
                          </span>
                          <span className="col-span-2 text-sm leading-[1.5] text-ledger-muted min-[881px]:col-span-1">
                            {copy(`api.endpoints.items.${endpoint.key}.desc`)}
                          </span>
                          <ArrowUpRight
                            aria-hidden="true"
                            className="hidden h-3.5 w-3.5 text-ledger-muted min-[881px]:block"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <p className="inline-block justify-self-start rounded-[7px] bg-ledger-amber-soft px-3 py-2 font-data text-[0.6875rem] text-ledger-amber">
                {copy("api.endpoints.note")}
              </p>
            </div>

            <div className="grid gap-6">
              <SectionHeading
                title={copy("api.example.title")}
                lede={copy("api.example.lede")}
              />
              <div className="grid gap-3 min-[881px]:grid-cols-[1fr_1.4fr]">
                <MarketingCodeCard
                  title={copy("api.example.requestCaption")}
                  meta={copy("api.example.requestMeta")}
                  code={requestExample}
                  copyLabel={copy("shared.copy")}
                  copiedLabel={copy("shared.copied")}
                />
                <MarketingCodeCard
                  title={copy("api.example.responseCaption")}
                  meta={copy("api.example.responseMeta")}
                  code={responseExample}
                  copyLabel={copy("shared.copy")}
                  copiedLabel={copy("shared.copied")}
                />
              </div>
            </div>

            <div className="grid gap-6">
              <SectionHeading title={copy("api.meta.errorsTitle")} />
              <div className="grid gap-3 min-[881px]:grid-cols-2">
                <div className="rounded-[10px] border border-ledger-line bg-ledger-surface px-5 py-[18px]">
                  <h3 className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ledger-ink">
                    <span
                      aria-hidden="true"
                      className="h-[7px] w-[7px] rounded-[2px] bg-ledger-accent"
                    />
                    {copy("api.meta.errorsTitle")}
                  </h3>
                  <ul className="mt-3 grid gap-[7px]">
                    {errors.map((error) => (
                      <li
                        key={error.code}
                        className="grid grid-cols-[46px_1fr] gap-2.5 text-sm leading-[1.5] text-ledger-ink-2"
                      >
                        <span className="w-fit rounded-[5px] bg-ledger-surface-2 px-1.5 py-0.5 font-data text-[0.6875rem] text-ledger-ink">
                          {error.code}
                        </span>
                        <span>{error.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[10px] border border-ledger-line bg-ledger-surface px-5 py-[18px]">
                  <h3 className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ledger-ink">
                    <span
                      aria-hidden="true"
                      className="h-[7px] w-[7px] rounded-[2px] bg-ledger-accent"
                    />
                    {copy("api.meta.limitsTitle")}
                  </h3>
                  <p className="mt-3 text-sm leading-[1.6] text-ledger-muted">
                    {copy("api.meta.limitsBody")}
                  </p>
                  <p className="mt-2.5 break-words font-data text-[0.6875rem] leading-[1.6] text-ledger-muted">
                    {copy("api.meta.openapiCommand")}
                  </p>
                  <a
                    href="/docs/api/openapi.yaml"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ledger-accent underline underline-offset-[3px]"
                  >
                    {copy("api.meta.openapiLink")}
                    <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>

            <div className="grid gap-6">
              <SectionHeading
                title={copy("api.plans.title")}
                lede={copy("api.plans.lede")}
              />

              <div className="hidden overflow-hidden rounded-[10px] border border-ledger-line min-[761px]:block">
                <div className="grid grid-cols-[0.7fr_2fr_1.2fr_0.9fr] gap-4 border-b border-ledger-line bg-ledger-surface-2 px-4 py-3 font-data text-[0.6875rem] uppercase tracking-[0.1em] text-ledger-muted">
                  <span>{copy("api.plans.plan")}</span>
                  <span>{copy("api.plans.access")}</span>
                  <span>{copy("api.plans.rate")}</span>
                  <span>{copy("api.plans.batch")}</span>
                </div>
                {plans.map((row) => (
                  <div
                    key={row.plan}
                    className="grid grid-cols-[0.7fr_2fr_1.2fr_0.9fr] gap-4 border-b border-ledger-line bg-ledger-surface px-4 py-3.5 text-sm last:border-b-0"
                  >
                    <span className="font-semibold text-ledger-ink">{row.plan}</span>
                    <span className="leading-[1.5] text-ledger-ink-2">{row.access}</span>
                    <span className="font-data text-[0.75rem] leading-[1.6] text-ledger-muted">
                      {row.rate}
                    </span>
                    <span className="font-data text-[0.75rem] leading-[1.6] text-ledger-muted">
                      {row.batch}
                    </span>
                  </div>
                ))}
              </div>

              <div className="grid gap-2 min-[761px]:hidden">
                {plans.map((row) => (
                  <div
                    key={row.plan}
                    className="rounded-[10px] border border-ledger-line bg-ledger-surface p-4"
                  >
                    <p className="text-[0.9375rem] font-semibold text-ledger-ink">{row.plan}</p>
                    <dl className="mt-2 grid gap-1.5">
                      <div className="grid grid-cols-[72px_1fr] gap-2">
                        <dt className="font-data text-[0.625rem] uppercase tracking-[0.08em] text-ledger-muted">
                          {copy("api.plans.access")}
                        </dt>
                        <dd className="text-sm leading-[1.5] text-ledger-ink-2">{row.access}</dd>
                      </div>
                      <div className="grid grid-cols-[72px_1fr] gap-2">
                        <dt className="font-data text-[0.625rem] uppercase tracking-[0.08em] text-ledger-muted">
                          {copy("api.plans.rate")}
                        </dt>
                        <dd className="font-data text-xs leading-[1.6] text-ledger-ink-2">
                          {row.rate}
                        </dd>
                      </div>
                      <div className="grid grid-cols-[72px_1fr] gap-2">
                        <dt className="font-data text-[0.625rem] uppercase tracking-[0.08em] text-ledger-muted">
                          {copy("api.plans.batch")}
                        </dt>
                        <dd className="font-data text-xs leading-[1.6] text-ledger-ink-2">
                          {row.batch}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <MarketingCtaBand
          eyebrow={copy("api.cta.eyebrow")}
          title={copy("api.cta.title")}
          lede={copy("api.cta.lede")}
          primary={{ label: copy("api.cta.primary"), to: "/auth" }}
          secondary={{ label: copy("api.cta.secondary"), to: "/docs" }}
        />
      </main>

      <MarketingFooter />

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="block max-h-[90dvh] w-[calc(100%-2rem)] max-w-[620px] rounded-2xl border-ledger-line bg-ledger-paper p-0 text-ledger-ink">
          {selected && selectedCopy ? (
            <div className="p-5 min-[641px]:p-6">
              <DialogHeader className="text-left">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={
                      selected.method === "GET"
                        ? "rounded-md bg-ledger-accent-soft px-2 py-1 font-data text-[0.625rem] font-medium tracking-[0.08em] text-ledger-accent"
                        : "rounded-md bg-ledger-panel px-2 py-1 font-data text-[0.625rem] font-medium tracking-[0.08em] text-ledger-on-panel"
                    }
                  >
                    {selected.method}
                  </span>
                  <span className="font-data text-[0.8125rem] text-ledger-ink">
                    {selected.path}
                  </span>
                  <span className="rounded-full border border-ledger-line bg-ledger-surface-2 px-2 py-0.5 font-data text-[0.625rem] uppercase tracking-[0.08em] text-ledger-muted">
                    {selectedCopy.group}
                  </span>
                </div>
                <DialogTitle className="sr-only">{copy("api.endpoints.dialog.title")}</DialogTitle>
                <DialogDescription className="pt-2 text-sm leading-[1.6] text-ledger-muted">
                  {selectedCopy.desc}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-5">
                <p className="font-data text-[0.625rem] uppercase tracking-[0.12em] text-ledger-muted">
                  {copy("api.endpoints.dialog.parameters")}
                </p>
                <p className="mt-1.5 font-data text-xs leading-[1.7] text-ledger-ink-2">
                  {selectedCopy.params}
                </p>
              </div>

              <div className="mt-5">
                <p className="mb-2 flex items-center gap-1.5 font-data text-[0.625rem] uppercase tracking-[0.12em] text-ledger-muted">
                  <Terminal aria-hidden="true" className="h-3 w-3" />
                  {copy("api.endpoints.dialog.sample")}
                </p>
                <MarketingCodeCard
                  title={`${selected.method} ${selected.path.split("?")[0]}`}
                  meta="curl"
                  code={buildCurl(selected)}
                  copyLabel={copy("shared.copy")}
                  copiedLabel={copy("shared.copied")}
                  preClassName="max-h-[240px] text-[0.75rem]"
                />
              </div>

              <p className="mt-4 text-xs leading-[1.6] text-ledger-muted">
                {copy("api.endpoints.dialog.auth")}
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ledger-line pt-4">
                <Link
                  to="/docs"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-ledger-accent"
                >
                  {copy("api.cta.secondary")}
                  <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="min-h-9 rounded-md border border-ledger-line-strong px-3.5 text-sm font-semibold text-ledger-ink transition-colors hover:bg-ledger-surface-2"
                >
                  {copy("api.endpoints.dialog.close")}
                </button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
