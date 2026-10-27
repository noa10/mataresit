import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  useHomepageTranslation,
  useResourcesTranslation,
} from "@/contexts/LanguageContext";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingPageHero } from "@/components/marketing/MarketingPageHero";
import { MarketingSearch } from "@/components/marketing/MarketingSearch";

const shell = "mx-auto w-full max-w-[1240px] px-5 min-[881px]:px-6";

type CategoryKey = "gettingStarted" | "accountBilling" | "aiProcessing";

interface Faq {
  category: CategoryKey;
  question: string;
  answer: string;
}

const categoryKeys: CategoryKey[] = [
  "gettingStarted",
  "accountBilling",
  "aiProcessing",
];

function CategoryGlyph({ category }: { category: CategoryKey }) {
  const common = {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "h-5 w-5",
  };

  if (category === "gettingStarted") {
    return (
      <svg {...common}>
        <path d="M8.5 1.5 3 9h4l-1 5.5L11.5 7h-4z" />
      </svg>
    );
  }

  if (category === "accountBilling") {
    return (
      <svg {...common}>
        <rect x="2" y="3.5" width="12" height="9.5" rx="1.5" />
        <path d="M2 7h12M5 10.5h3" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="8" cy="8" r="1.6" />
      <ellipse cx="8" cy="8" rx="6.4" ry="2.7" />
      <ellipse cx="8" cy="8" rx="6.4" ry="2.7" transform="rotate(60 8 8)" />
      <ellipse cx="8" cy="8" rx="6.4" ry="2.7" transform="rotate(120 8 8)" />
    </svg>
  );
}

export default function HelpCenter() {
  const { t } = useResourcesTranslation();
  const { t: tHome } = useHomepageTranslation();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryKey | null>(null);

  const copy = (key: string) => String(t(key));
  const faqs = t("help.faqs", { returnObjects: true }) as unknown as Faq[];

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return faqs.filter((faq) => {
      const matchesCategory = !activeCategory || faq.category === activeCategory;
      const matchesQuery =
        !needle ||
        `${faq.question} ${faq.answer}`.toLowerCase().includes(needle);

      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, faqs, query]);

  const filtersActive = query.trim().length > 0 || activeCategory !== null;
  const counts = useMemo(
    () =>
      categoryKeys.reduce<Record<CategoryKey, number>>(
        (accumulator, key) => {
          accumulator[key] = faqs.filter((faq) => faq.category === key).length;
          return accumulator;
        },
        { gettingStarted: 0, accountBilling: 0, aiProcessing: 0 },
      ),
    [faqs],
  );

  const countLabel = (count: number) =>
    copy(
      count === 1 ? "help.search.results_one" : "help.search.results_other",
    ).replace("{{count}}", String(count));

  const clearFilters = () => {
    setQuery("");
    setActiveCategory(null);
  };

  return (
    <div className="min-h-screen bg-ledger-paper leading-[1.6] text-ledger-ink">
      <Helmet>
        <title>{copy("meta.help.title")}</title>
        <meta name="description" content={copy("meta.help.description")} />
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
          eyebrow={copy("help.hero.eyebrow")}
          titleLead={copy("help.hero.titleLead")}
          titleAccent={copy("help.hero.titleAccent")}
          lede={copy("help.hero.lede")}
        >
          <div className="mt-7 max-w-[560px]">
            <MarketingSearch
              value={query}
              onChange={(value) => {
                setQuery(value);
                if (value.trim()) {
                  setActiveCategory(null);
                }
              }}
              placeholder={copy("help.search.placeholder")}
              label={copy("help.search.label")}
            />
            {filtersActive ? (
              <div
                aria-live="polite"
                className="mt-3 flex flex-wrap items-center gap-2.5"
              >
                <span className="rounded-full border border-ledger-line bg-ledger-surface px-2.5 py-1 font-data text-[0.6875rem] text-ledger-ink-2">
                  {countLabel(filtered.length)}
                </span>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-[5px] px-1.5 py-1 text-[0.8125rem] font-semibold text-ledger-accent transition-colors hover:bg-ledger-accent-soft"
                >
                  {copy("help.search.clear")}
                </button>
              </div>
            ) : null}
          </div>
        </MarketingPageHero>

        <section className="border-b border-ledger-line">
          <div className={`${shell} grid gap-11 pb-[88px] pt-10 min-[881px]:gap-14 min-[881px]:pt-[52px]`}>
            <div>
              <p className="mb-4 font-data text-[0.6875rem] uppercase tracking-[0.16em] text-ledger-muted">
                {copy("help.categories.label")}
              </p>
              <div
                role="group"
                aria-label={copy("help.categories.label")}
                className="grid gap-3 min-[881px]:grid-cols-3"
              >
                {categoryKeys.map((key) => {
                  const pressed = activeCategory === key;
                  const count = counts[key];
                  const countText = copy(
                    count === 1
                      ? "help.categories.count_one"
                      : "help.categories.count_other",
                  ).replace("{{count}}", String(count));

                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={pressed}
                      onClick={() => {
                        setQuery("");
                        setActiveCategory((current) => (current === key ? null : key));
                      }}
                      className={
                        pressed
                          ? "grid grid-cols-[44px_1fr] items-center gap-3.5 rounded-2xl border border-ledger-accent bg-ledger-accent-soft px-5 py-[18px] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent/40"
                          : "grid grid-cols-[44px_1fr] items-center gap-3.5 rounded-2xl border border-ledger-line bg-ledger-surface px-5 py-[18px] text-left transition-colors hover:border-ledger-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent/40"
                      }
                    >
                      <span
                        className={
                          pressed
                            ? "grid h-11 w-11 place-items-center rounded-[11px] bg-ledger-surface text-ledger-accent"
                            : "grid h-11 w-11 place-items-center rounded-[11px] bg-ledger-accent-soft text-ledger-accent"
                        }
                      >
                        <CategoryGlyph category={key} />
                      </span>
                      <span>
                        <span className="block text-[0.9375rem] font-semibold leading-[1.4] text-ledger-ink">
                          {copy(`help.categories.${key}.title`)}
                        </span>
                        <span className="mt-0.5 block text-sm leading-[1.45] text-ledger-muted">
                          {copy(`help.categories.${key}.description`)}
                        </span>
                        <span className="mt-[5px] block font-data text-[0.625rem] text-ledger-accent">
                          {countText}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="font-display text-[clamp(1.6rem,2.4vw,2rem)] font-normal leading-[1.12] tracking-[-0.016em] text-ledger-ink">
                {copy("help.faq.title")}
              </h2>
              <p className="mb-[22px] mt-1.5 max-w-[60ch] text-[1.0625rem] leading-[1.6] text-ledger-muted">
                {copy("help.faq.lede")}
              </p>

              {filtered.length > 0 ? (
                <div>
                  {filtered.map((faq) => (
                    <details
                      key={faq.question}
                      className="group border-b border-x border-ledger-line bg-ledger-surface first:rounded-t-[10px] last:rounded-b-[10px]"
                    >
                      <summary className="flex list-none cursor-pointer items-center gap-3.5 px-5 py-[17px] text-[0.9375rem] font-semibold text-ledger-ink transition-colors hover:text-ledger-accent [&::-webkit-details-marker]:hidden">
                        <span className="min-w-0">{faq.question}</span>
                        <span className="hidden flex-none rounded-full bg-ledger-surface-2 px-2.5 py-1 font-data text-[0.5625rem] uppercase tracking-[0.1em] text-ledger-muted min-[881px]:inline-block">
                          {copy(`help.categories.${faq.category}.title`)}
                        </span>
                        <span
                          aria-hidden="true"
                          className="ml-auto font-data text-base text-ledger-muted transition-transform group-open:rotate-45"
                        >
                          +
                        </span>
                      </summary>
                      <div className="max-w-[72ch] px-5 pb-[18px] text-[0.9375rem] leading-[1.65] text-ledger-muted">
                        {faq.answer}
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="rounded-[10px] border border-dashed border-ledger-line px-5 py-10 text-center">
                  <p className="text-[0.9375rem] leading-[1.65] text-ledger-muted">
                    {copy("help.faq.empty")}
                  </p>
                  <a
                    href="#contact"
                    className="mt-2 inline-block text-sm font-semibold text-ledger-accent"
                  >
                    {copy("help.faq.emptyAction")} ↓
                  </a>
                </div>
              )}
            </div>

            <div id="contact" className="scroll-mt-[164px] border-t border-dashed border-ledger-line pt-11 text-center min-[881px]:scroll-mt-[104px]">
              <h2 className="font-display text-[clamp(1.5rem,2.2vw,1.9rem)] font-normal leading-[1.1] tracking-[-0.014em] text-ledger-ink">
                {copy("help.contact.title")}
              </h2>
              <p className="mt-2 text-[1.0625rem] text-ledger-muted">
                {copy("help.contact.lede")}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <a
                  href="mailto:support@mataresit.com"
                  className="inline-flex min-h-[46px] items-center justify-center rounded-lg bg-ledger-accent px-5 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-ledger-accent-hover dark:text-ledger-panel"
                >
                  {copy("help.contact.email")}
                </a>
                <Link
                  to="/auth"
                  className="inline-flex min-h-[46px] items-center justify-center rounded-lg border border-ledger-line-strong bg-ledger-surface px-5 text-[0.9375rem] font-semibold text-ledger-ink transition-colors hover:border-ledger-ink"
                >
                  {copy("help.contact.chat")}
                </Link>
                <Link
                  to="/docs"
                  className="inline-flex min-h-[46px] items-center justify-center rounded-lg px-5 text-[0.9375rem] font-semibold text-ledger-ink-2 transition-colors hover:bg-ledger-surface-2 hover:text-ledger-ink"
                >
                  {copy("help.contact.docs")}
                </Link>
              </div>
              <p className="mt-4 font-data text-[0.6875rem] tracking-[0.03em] text-ledger-muted">
                {copy("help.contact.note")}
              </p>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
