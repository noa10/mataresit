import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  useLanguage,
  useHomepageTranslation,
  useResourcesTranslation,
} from "@/contexts/LanguageContext";
import { MarketingCtaBand } from "@/components/marketing/MarketingCtaBand";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingPageHero } from "@/components/marketing/MarketingPageHero";
import { MarketingSearch } from "@/components/marketing/MarketingSearch";
import {
  documentationService,
  type DocumentationGuide,
  type DocumentationStructure,
} from "@/services/documentationService";

const shell = "mx-auto w-full max-w-[1240px] px-5 min-[881px]:px-6";

type DocFeature = { title: string; description: string };
type DocStep = { title: string; description: string };
type DocFaq = { question: string; answer: string };
type GlossaryItem = { term: string; definition: string };

const tocItems = [
  { id: "overview", number: "01", key: "docs.toc.overview" },
  { id: "getting-started", number: "02", key: "docs.toc.gettingStarted" },
  { id: "core-features", number: "03", key: "docs.toc.coreFeatures" },
  { id: "troubleshooting", number: "04", key: "docs.toc.troubleshooting" },
  { id: "glossary", number: "05", key: "docs.toc.glossary" },
] as const;

function DocSection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-[164px] border-t border-ledger-line pt-7 min-[881px]:scroll-mt-[104px]"
    >
      <h2 className="font-display text-[clamp(1.7rem,2.6vw,2.2rem)] font-normal leading-[1.1] tracking-[-0.018em] text-ledger-ink">
        <span className="mr-2.5 align-super font-data text-[0.55em] tracking-normal text-ledger-accent">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function GuideCard({
  guide,
  difficultyLabel,
  readingLabel,
  openLabel,
}: {
  guide: DocumentationGuide;
  difficultyLabel: string;
  readingLabel: string;
  openLabel: string;
}) {
  return (
    <Link
      to={`/docs/guide/${guide.id}`}
      className="group grid content-start gap-1.5 rounded-xl border border-ledger-line bg-ledger-surface p-4 no-underline transition-colors hover:border-ledger-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent/40"
    >
      <span className="text-[0.9375rem] font-semibold leading-[1.4] text-ledger-ink">
        {guide.title}
      </span>
      <span className="line-clamp-2 text-sm leading-[1.55] text-ledger-muted">
        {guide.description}
      </span>
      <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-data text-[0.625rem] uppercase tracking-[0.08em] text-ledger-muted">
        <span>{difficultyLabel}</span>
        <span aria-hidden="true">·</span>
        <span>{readingLabel}</span>
        <span className="ml-auto inline-flex items-center gap-1 normal-case tracking-normal text-ledger-accent">
          {openLabel}
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </span>
    </Link>
  );
}

export default function NewDocumentationPage() {
  const { language } = useLanguage();
  const { t } = useResourcesTranslation();
  const { t: tHome } = useHomepageTranslation();

  const copy = (key: string) => String(t(key));
  const list = <T,>(key: string): T[] =>
    t(key, { returnObjects: true }) as unknown as T[];

  const [documentation, setDocumentation] = useState<DocumentationStructure | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DocumentationGuide[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;

    documentationService
      .getDocumentationStructure(language)
      .then((structure) => {
        if (!cancelled) {
          setDocumentation(structure);
          setLoadFailed(false);
        }
      })
      .catch((error) => {
        console.error("Failed to load documentation:", error);
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [language]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(() => {
      documentationService
        .searchGuides(trimmed, language)
        .then((found) => {
          if (!cancelled) {
            setResults(found);
          }
        })
        .catch((error) => {
          console.error("Documentation search failed:", error);
          if (!cancelled) {
            setResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearching(false);
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, language]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
  };

  const features = list<DocFeature>("docs.overview.features");
  const steps = list<DocStep>("docs.gettingStarted.steps");
  const dashboardItems = list<string>("docs.gettingStarted.dashboardItems");
  const queries = list<string>("docs.coreFeatures.queries");
  const faqs = list<DocFaq>("docs.troubleshooting.items");
  const glossary = list<GlossaryItem>("docs.glossary.items");

  const searchActive = query.trim().length > 0;

  return (
    <div className="min-h-screen bg-ledger-paper leading-[1.6] text-ledger-ink">
      <Helmet>
        <title>{copy("meta.docs.title")}</title>
        <meta name="description" content={copy("meta.docs.description")} />
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
          eyebrow={copy("docs.hero.eyebrow")}
          titleLead={copy("docs.hero.titleLead")}
          titleAccent={copy("docs.hero.titleAccent")}
          lede={copy("docs.hero.lede")}
          note={copy("docs.hero.note")}
        >
          <MarketingSearch
            value={query}
            onChange={handleQueryChange}
            placeholder={copy("docs.search.placeholder")}
            label={copy("docs.search.label")}
            className="mt-7 max-w-[560px]"
            inputClassName="min-h-[52px]"
          />
        </MarketingPageHero>

        <section className="border-b border-ledger-line">
          <div className="mx-auto grid w-full max-w-[1240px] grid-cols-1 gap-8 px-5 pb-[88px] pt-10 min-[881px]:grid-cols-[220px_minmax(0,1fr)] min-[881px]:gap-14 min-[881px]:px-6 min-[881px]:pt-14">
            <nav
              aria-label={copy("docs.toc.title")}
              className="flex gap-1 overflow-x-auto border-b border-ledger-line pb-2 [scrollbar-width:none] min-[881px]:sticky min-[881px]:top-[104px] min-[881px]:block min-[881px]:self-start min-[881px]:border-0 min-[881px]:pb-0 [&::-webkit-scrollbar]:hidden"
            >
              <p className="mb-2.5 hidden font-data text-[0.6875rem] uppercase tracking-[0.14em] text-ledger-muted min-[881px]:block">
                {copy("docs.toc.title")}
              </p>
              {tocItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="grid shrink-0 grid-cols-[22px_1fr] items-baseline gap-2.5 rounded-[7px] px-2.5 py-2 text-sm text-ledger-ink-2 no-underline transition-colors hover:bg-ledger-surface-2 hover:text-ledger-ink"
                >
                  <span className="font-data text-[0.6875rem] text-ledger-muted">{item.number}</span>
                  <span>{copy(item.key)}</span>
                </a>
              ))}
            </nav>

            <div className="grid min-w-0 gap-16">
              {searchActive ? (
                <section
                  id="search-results"
                  aria-live="polite"
                  className="scroll-mt-[164px] rounded-2xl border border-ledger-line bg-ledger-surface p-5 min-[881px]:scroll-mt-[104px] min-[881px]:p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <h2 className="font-display text-2xl font-normal leading-[1.1] tracking-[-0.014em] text-ledger-ink">
                        {copy("docs.search.results")}
                      </h2>
                      <span className="rounded-full border border-ledger-line bg-ledger-surface-2 px-2.5 py-1 font-data text-[0.625rem] text-ledger-ink-2">
                        {searching
                          ? copy("docs.search.searching")
                          : copy(
                              results.length === 1
                                ? "docs.search.count_one"
                                : "docs.search.count_other",
                            ).replace("{{count}}", String(results.length))}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQueryChange("")}
                      className="rounded-md px-2 py-1 text-sm font-semibold text-ledger-accent transition-colors hover:bg-ledger-accent-soft"
                    >
                      {copy("docs.search.clear")}
                    </button>
                  </div>

                  {!searching && results.length > 0 ? (
                    <div className="mt-4 grid gap-2 min-[641px]:grid-cols-2 min-[1025px]:grid-cols-3">
                      {results.map((guide) => (
                        <GuideCard
                          key={guide.id}
                          guide={guide}
                          difficultyLabel={copy(`docs.difficulty.${guide.difficulty}`)}
                          readingLabel={copy("docs.readingTime").replace(
                            "{{count}}",
                            String(guide.readingTime),
                          )}
                          openLabel={copy("shared.openGuide")}
                        />
                      ))}
                    </div>
                  ) : null}

                  {!searching && results.length === 0 ? (
                    <p className="mt-4 text-[0.9375rem] leading-[1.65] text-ledger-muted">
                      {copy("docs.search.empty")}{" "}
                      <Link to="/help" className="font-semibold text-ledger-accent">
                        {copy("docs.cta.secondary")} →
                      </Link>
                    </p>
                  ) : null}

                  {loadFailed ? (
                    <p className="mt-4 text-sm text-ledger-muted">{copy("docs.search.error")}</p>
                  ) : null}
                </section>
              ) : null}

              <div>
                <DocSection
                  id="overview"
                  number="01"
                  title={copy("docs.overview.title")}
                >
                  <h3 className="mt-[22px] text-[1.0625rem] font-semibold tracking-[-0.008em] text-ledger-ink">
                    {copy("docs.overview.whatIsTitle")}
                  </h3>
                  <p className="mt-3 max-w-[68ch] text-[1.0625rem] leading-[1.7] text-ledger-ink-2">
                    {copy("docs.overview.whatIsLede")}
                  </p>

                  <h3 className="mt-[34px] text-[1.0625rem] font-semibold tracking-[-0.008em] text-ledger-ink">
                    {copy("docs.overview.keyFeaturesTitle")}
                  </h3>
                  <div className="mt-5 grid gap-2 min-[881px]:grid-cols-2">
                    {features.map((feature) => (
                      <div
                        key={feature.title}
                        className="rounded-[10px] border border-ledger-line bg-ledger-surface px-[18px] py-4"
                      >
                        <p className="flex items-center gap-2 text-[0.9375rem] font-semibold leading-[1.5] text-ledger-ink">
                          <span
                            aria-hidden="true"
                            className="h-[7px] w-[7px] shrink-0 rounded-[2px] bg-ledger-accent"
                          />
                          {feature.title}
                        </p>
                        <p className="mt-1.5 text-sm leading-[1.55] text-ledger-muted">
                          {feature.description}
                        </p>
                      </div>
                    ))}
                  </div>

                  {documentation?.quickStart?.length ? (
                    <div className="mt-9">
                      <h3 className="text-[1.0625rem] font-semibold tracking-[-0.008em] text-ledger-ink">
                        {copy("docs.overview.quickStartTitle")}
                      </h3>
                      <p className="mt-1.5 text-sm text-ledger-muted">
                        {copy("docs.overview.quickStartLede")}
                      </p>
                      <div className="mt-4 grid gap-2 min-[641px]:grid-cols-2 min-[1025px]:grid-cols-4">
                        {documentation.quickStart.map((guide) => (
                          <GuideCard
                            key={guide.id}
                            guide={guide}
                            difficultyLabel={copy(`docs.difficulty.${guide.difficulty}`)}
                            readingLabel={copy("docs.readingTime").replace(
                              "{{count}}",
                              String(guide.readingTime),
                            )}
                            openLabel={copy("shared.openGuide")}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </DocSection>

                <DocSection
                  id="getting-started"
                  number="02"
                  title={copy("docs.gettingStarted.title")}
                >
                  <h3 className="mt-[22px] text-[1.0625rem] font-semibold tracking-[-0.008em] text-ledger-ink">
                    {copy("docs.gettingStarted.firstUploadTitle")}
                  </h3>
                  <ol className="mt-[18px] grid gap-0.5">
                    {steps.map((step, index) => (
                      <li
                        key={step.title}
                        className="grid grid-cols-[34px_1fr] gap-3.5 border-b border-dashed border-ledger-line px-1 py-[13px] last:border-b-0"
                      >
                        <span
                          aria-hidden="true"
                          className="grid h-[34px] w-[34px] place-items-center rounded-[7px] bg-ledger-accent-soft font-data text-xs text-ledger-accent"
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <b className="block text-[0.9375rem] font-semibold leading-[1.5] text-ledger-ink">
                            {step.title}
                          </b>
                          <span className="mt-0.5 block text-sm leading-[1.55] text-ledger-muted">
                            {step.description}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>

                  <h3 className="mt-[34px] text-[1.0625rem] font-semibold tracking-[-0.008em] text-ledger-ink">
                    {copy("docs.gettingStarted.dashboardTitle")}
                  </h3>
                  <ul className="mt-[18px] grid gap-0.5">
                    {dashboardItems.map((item) => (
                      <li
                        key={item}
                        className="relative border-b border-dashed border-ledger-line px-1 py-2.5 pl-9 text-[0.9375rem] leading-[1.6] text-ledger-ink-2 last:border-b-0"
                      >
                        <span
                          aria-hidden="true"
                          className="absolute left-1 top-[11px] font-data text-ledger-accent"
                        >
                          —
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </DocSection>

                <DocSection
                  id="core-features"
                  number="03"
                  title={copy("docs.coreFeatures.title")}
                >
                  <h3 className="mt-[22px] text-[1.0625rem] font-semibold tracking-[-0.008em] text-ledger-ink">
                    {copy("docs.coreFeatures.batchTitle")}
                  </h3>
                  <p className="mt-3 max-w-[68ch] leading-[1.7] text-ledger-ink-2">
                    {copy("docs.coreFeatures.batchBody")}
                  </p>

                  <h3 className="mt-[34px] text-[1.0625rem] font-semibold tracking-[-0.008em] text-ledger-ink">
                    {copy("docs.coreFeatures.confidenceTitle")}
                  </h3>
                  <p className="mt-3 max-w-[68ch] leading-[1.7] text-ledger-ink-2">
                    {copy("docs.coreFeatures.confidenceBody")}
                  </p>

                  <div className="mt-[18px] grid gap-3.5 rounded-2xl border border-ledger-line bg-ledger-surface px-5 py-[22px] min-[881px]:px-6">
                    {[
                      {
                        label: copy("docs.coreFeatures.high"),
                        range: copy("docs.coreFeatures.highRange"),
                        width: "92%",
                        color: "bg-ledger-accent",
                      },
                      {
                        label: copy("docs.coreFeatures.medium"),
                        range: copy("docs.coreFeatures.mediumRange"),
                        width: "70%",
                        color: "bg-ledger-amber",
                      },
                      {
                        label: copy("docs.coreFeatures.low"),
                        range: copy("docs.coreFeatures.lowRange"),
                        width: "45%",
                        color: "bg-ledger-danger",
                      },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="grid grid-cols-[96px_1fr_76px] items-center gap-2.5 min-[881px]:grid-cols-[130px_1fr_92px] min-[881px]:gap-4"
                      >
                        <span className="text-sm font-semibold text-ledger-ink">{row.label}</span>
                        <span className="h-2 overflow-hidden rounded bg-ledger-surface-2">
                          <span
                            aria-hidden="true"
                            className={`block h-full rounded ${row.color}`}
                            style={{ width: row.width }}
                          />
                        </span>
                        <span className="text-right font-data text-[0.6875rem] text-ledger-muted">
                          {row.range}
                        </span>
                      </div>
                    ))}
                    <p className="border-t border-dashed border-ledger-line pt-3 font-data text-[0.6875rem] tracking-[0.03em] text-ledger-muted">
                      {copy("docs.coreFeatures.confidenceNote")}
                    </p>
                  </div>

                  <h3 className="mt-[34px] text-[1.0625rem] font-semibold tracking-[-0.008em] text-ledger-ink">
                    {copy("docs.coreFeatures.visionTitle")}
                  </h3>
                  <p className="mt-3 max-w-[68ch] leading-[1.7] text-ledger-ink-2">
                    {copy("docs.coreFeatures.visionBody")}
                  </p>

                  <h3 className="mt-[34px] text-[1.0625rem] font-semibold tracking-[-0.008em] text-ledger-ink">
                    {copy("docs.coreFeatures.searchTitle")}
                  </h3>
                  <p className="mt-3 max-w-[68ch] leading-[1.7] text-ledger-ink-2">
                    {copy("docs.coreFeatures.searchBody")}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {queries.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-ledger-line bg-ledger-surface px-3 py-[7px] font-data text-xs text-ledger-ink-2"
                      >
                        {item}
                      </span>
                    ))}
                  </div>

                  {documentation?.featured?.length ? (
                    <div className="mt-9">
                      <h3 className="text-[1.0625rem] font-semibold tracking-[-0.008em] text-ledger-ink">
                        {copy("docs.coreFeatures.featuredTitle")}
                      </h3>
                      <p className="mt-1.5 text-sm text-ledger-muted">
                        {copy("docs.coreFeatures.featuredLede")}
                      </p>
                      <div className="mt-4 grid gap-2 min-[641px]:grid-cols-2">
                        {documentation.featured.map((guide) => (
                          <GuideCard
                            key={guide.id}
                            guide={guide}
                            difficultyLabel={copy(`docs.difficulty.${guide.difficulty}`)}
                            readingLabel={copy("docs.readingTime").replace(
                              "{{count}}",
                              String(guide.readingTime),
                            )}
                            openLabel={copy("shared.openGuide")}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </DocSection>

                <DocSection
                  id="troubleshooting"
                  number="04"
                  title={copy("docs.troubleshooting.title")}
                >
                  <div className="mt-[18px]">
                    {faqs.map((faq) => (
                      <details key={faq.question} className="group border-b border-ledger-line first:border-t">
                        <summary className="flex cursor-pointer list-none items-baseline gap-3.5 px-0.5 py-4 text-[0.9375rem] font-semibold text-ledger-ink transition-colors hover:text-ledger-accent [&::-webkit-details-marker]:hidden">
                          {faq.question}
                          <span
                            aria-hidden="true"
                            className="ml-auto font-data text-base text-ledger-muted transition-transform group-open:rotate-45"
                          >
                            +
                          </span>
                        </summary>
                        <div className="max-w-[66ch] px-0.5 pb-[18px] text-[0.9375rem] leading-[1.65] text-ledger-muted">
                          {faq.answer}
                        </div>
                      </details>
                    ))}
                  </div>
                </DocSection>

                <DocSection
                  id="glossary"
                  number="05"
                  title={copy("docs.glossary.title")}
                >
                  <dl className="mt-[18px] grid">
                    {glossary.map((item) => (
                      <div
                        key={item.term}
                        className="grid gap-1 border-b border-dashed border-ledger-line px-0.5 py-3.5 last:border-b-0 min-[881px]:grid-cols-[180px_1fr] min-[881px]:gap-[18px]"
                      >
                        <dt className="pt-0.5 font-data text-xs text-ledger-accent">{item.term}</dt>
                        <dd className="text-[0.9375rem] leading-[1.6] text-ledger-ink-2">
                          {item.definition}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </DocSection>
              </div>
            </div>
          </div>
        </section>

        <MarketingCtaBand
          eyebrow={copy("docs.cta.eyebrow")}
          title={copy("docs.cta.title")}
          lede={copy("docs.cta.lede")}
          primary={{ label: copy("docs.cta.primary"), to: "/auth" }}
          secondary={{ label: copy("docs.cta.secondary"), to: "/help" }}
        />
      </main>

      <MarketingFooter />
    </div>
  );
}
