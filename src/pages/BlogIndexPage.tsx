import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookOpen, Loader2 } from "lucide-react";
import {
  useLanguage,
  useHomepageTranslation,
  useResourcesTranslation,
} from "@/contexts/LanguageContext";
import { BlogSEO } from "@/components/blog/BlogSEO";
import { MarketingCtaBand } from "@/components/marketing/MarketingCtaBand";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingPageHero } from "@/components/marketing/MarketingPageHero";
import { MarketingSearch } from "@/components/marketing/MarketingSearch";
import { getPostPreviews } from "@/services/blogService";
import type { PostPreview } from "@/types/blog";

const shell = "mx-auto w-full max-w-[1240px] px-5 min-[881px]:px-6";

interface ReceiptItem {
  name: string;
  amount: string;
  tax: string;
  taxZero: boolean;
}

function ReceiptVisual({
  labels,
  items,
}: {
  labels: {
    merchant: string;
    address: string;
    totalLabel: string;
    total: string;
    foot: string;
  };
  items: ReceiptItem[];
}) {
  return (
    <figure
      aria-hidden="true"
      className="relative w-full max-w-[340px] justify-self-center rounded-[10px] border border-ledger-line-strong bg-ledger-paper px-[22px] pb-4 pt-[22px] shadow-[0_1px_2px_rgba(18,23,21,0.05),0_24px_48px_-28px_rgba(18,23,21,0.35)]"
    >
      <span className="absolute -top-[7px] left-6 right-6 h-3 rounded-t-md border border-b-0 border-ledger-line-strong bg-ledger-surface" />
      <div className="mb-3 border-b border-dashed border-ledger-line-strong pb-3 text-center">
        <p className="font-data text-xs font-medium tracking-[0.04em] text-ledger-ink">
          {labels.merchant}
        </p>
        <p className="mt-[3px] font-data text-[0.625rem] text-ledger-muted">
          {labels.address}
        </p>
      </div>
      {items.map((item) => (
        <div
          key={item.name}
          className="grid grid-cols-[1fr_auto_auto] items-baseline gap-3 py-[7px] font-data text-[0.6875rem]"
        >
          <span className="text-ledger-ink-2">{item.name}</span>
          <span className="text-ledger-ink">{item.amount}</span>
          <span
            className={
              item.taxZero
                ? "rounded-[4px] bg-ledger-surface-2 px-1.5 py-0.5 text-[0.5625rem] text-ledger-muted"
                : "rounded-[4px] bg-ledger-accent-soft px-1.5 py-0.5 text-[0.5625rem] text-ledger-accent"
            }
          >
            {item.tax}
          </span>
        </div>
      ))}
      <div className="mt-2.5 flex justify-between border-t border-dashed border-ledger-line-strong pt-2.5 font-data text-[0.8125rem] font-medium text-ledger-ink">
        <span>{labels.totalLabel}</span>
        <span>{labels.total}</span>
      </div>
      <p className="mt-3 text-center font-data text-[0.5625rem] tracking-[0.1em] text-ledger-muted">
        {labels.foot}
      </p>
    </figure>
  );
}

function authorName(post: PostPreview) {
  const name = `${post.author?.first_name ?? ""} ${post.author?.last_name ?? ""}`.trim();
  return name;
}

function displayTag(tag: string) {
  return tag.toLowerCase() === "ai"
    ? "AI"
    : tag.charAt(0).toUpperCase() + tag.slice(1);
}

function readingMinutes(post: PostPreview) {
  const words = `${post.title} ${post.excerpt ?? ""}`.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

function usePostDate() {
  const { language } = useLanguage();
  return (value?: string, withYear = true) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(language === "ms" ? "ms-MY" : "en-MY", {
      day: "2-digit",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
    }).format(date);
  };
}

export default function BlogIndexPage() {
  const { t } = useResourcesTranslation();
  const { t: tHome } = useHomepageTranslation();
  const formatDate = usePostDate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");

  const {
    data: posts,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["blogPosts"],
    queryFn: getPostPreviews,
    staleTime: 1000 * 60 * 5,
  });

  const copy = (key: string) => String(t(key));
  const receiptLabels = {
    merchant: copy("blog.receipt.merchant"),
    address: copy("blog.receipt.address"),
    totalLabel: copy("blog.receipt.totalLabel"),
    total: copy("blog.receipt.total"),
    foot: copy("blog.receipt.foot"),
  };
  const receiptItems = t("blog.receipt.items", {
    returnObjects: true,
  }) as unknown as ReceiptItem[];

  const allTags = useMemo(
    () =>
      Array.from(new Set(posts?.flatMap((post) => post.tags ?? []) ?? [])).sort(
        (a, b) => a.localeCompare(b),
      ),
    [posts],
  );

  const filteredPosts = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return (posts ?? []).filter((post) => {
      const matchesSearch =
        !needle ||
        `${post.title} ${post.excerpt ?? ""} ${(post.tags ?? []).join(" ")}`
          .toLowerCase()
          .includes(needle);
      const matchesTag =
        selectedTag === "all" || (post.tags ?? []).includes(selectedTag);
      return matchesSearch && matchesTag;
    });
  }, [posts, searchTerm, selectedTag]);

  const filtersActive = searchTerm.trim().length > 0 || selectedTag !== "all";
  const featuredPost = filteredPosts[0];
  const otherPosts = filteredPosts.slice(1);

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedTag("all");
  };

  const postMeta = (post: PostPreview, withYear = true) => {
    const date = formatDate(post.published_at, withYear);
    const author = authorName(post);
    const minutes = readingMinutes(post);
    return [author, date, copy("blog.post.minRead").replace("{{count}}", String(minutes))]
      .filter(Boolean)
      .join(" · ");
  };

  return (
    <div className="min-h-screen bg-ledger-paper leading-[1.6] text-ledger-ink">
      <BlogSEO
        isIndex
        title={copy("meta.blog.title")}
        description={copy("meta.blog.description")}
      />

      <a
        href="#main"
        className="absolute left-4 top-[-64px] z-[100] rounded-md bg-ledger-ink px-4 py-2.5 text-sm text-ledger-paper focus:top-3"
      >
        {String(tHome("skipToContent"))}
      </a>

      <MarketingHeader />

      <main id="main">
        <MarketingPageHero
          eyebrow={copy("blog.hero.eyebrow")}
          titleLead={copy("blog.hero.titleLead")}
          titleAccent={copy("blog.hero.titleAccent")}
          lede={copy("blog.hero.lede")}
        />

        <section className="border-b border-ledger-line">
          <div className={`${shell} grid gap-11 pb-[88px] pt-10 min-[881px]:gap-14 min-[881px]:pt-[52px]`}>
            {isLoading ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 text-ledger-muted">
                <Loader2 aria-hidden="true" className="h-7 w-7 animate-spin" />
                <p className="text-[0.9375rem]">{copy("blog.states.loading")}</p>
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-ledger-line bg-ledger-surface px-6 py-16 text-center">
                <BookOpen
                  aria-hidden="true"
                  className="mx-auto mb-4 h-10 w-10 text-ledger-muted"
                  strokeWidth={1.4}
                />
                <h2 className="font-display text-2xl font-normal text-ledger-ink">
                  {copy("blog.states.errorTitle")}
                </h2>
                <p className="mx-auto mt-2 max-w-[46ch] text-[0.9375rem] leading-[1.65] text-ledger-muted">
                  {copy("blog.states.errorBody")}
                </p>
              </div>
            ) : !posts || posts.length === 0 ? (
              <div className="rounded-2xl border border-ledger-line bg-ledger-surface px-6 py-16 text-center">
                <BookOpen
                  aria-hidden="true"
                  className="mx-auto mb-4 h-10 w-10 text-ledger-muted"
                  strokeWidth={1.4}
                />
                <h2 className="font-display text-2xl font-normal text-ledger-ink">
                  {copy("blog.states.emptyTitle")}
                </h2>
                <p className="mx-auto mt-2 max-w-[46ch] text-[0.9375rem] leading-[1.65] text-ledger-muted">
                  {copy("blog.states.emptyBody")}
                </p>
              </div>
            ) : (
              <>
                {featuredPost ? (
                  <article className="grid items-center gap-10 rounded-2xl border border-ledger-line bg-ledger-surface p-6 shadow-[0_1px_2px_rgba(18,23,21,0.05),0_18px_40px_-24px_rgba(18,23,21,0.28)] min-[881px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[881px]:p-8">
                    <ReceiptVisual labels={receiptLabels} items={receiptItems} />
                    <div>
                      <div className="mb-4 flex flex-wrap gap-2">
                        {(featuredPost.tags ?? []).slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-ledger-accent-soft px-2.5 py-[5px] font-data text-[0.625rem] uppercase tracking-[0.08em] text-ledger-accent"
                          >
                            {displayTag(tag)}
                          </span>
                        ))}
                        <span className="rounded-full border border-ledger-line px-2.5 py-[5px] font-data text-[0.625rem] uppercase tracking-[0.08em] text-ledger-muted">
                          {copy("blog.featured.latest")}
                        </span>
                      </div>
                      <h2 className="font-display text-[clamp(1.7rem,3vw,2.4rem)] font-normal leading-[1.08] tracking-[-0.02em] text-ledger-ink">
                        <Link
                          to={`/blog/${featuredPost.slug}`}
                          className="no-underline transition-colors hover:text-ledger-accent"
                        >
                          {featuredPost.title}
                        </Link>
                      </h2>
                      {featuredPost.excerpt ? (
                        <p className="mt-3.5 max-w-[56ch] text-[1.0625rem] leading-[1.65] text-ledger-muted">
                          {featuredPost.excerpt}
                        </p>
                      ) : null}
                      <p className="mt-[18px] font-data text-[0.6875rem] tracking-[0.03em] text-ledger-muted">
                        {postMeta(featuredPost)}
                      </p>
                      <div className="mt-[22px]">
                        <Link
                          to={`/blog/${featuredPost.slug}`}
                          className="inline-flex min-h-[46px] items-center justify-center rounded-lg bg-ledger-accent px-5 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-ledger-accent-hover dark:text-ledger-panel"
                        >
                          {copy("blog.featured.read")}
                        </Link>
                      </div>
                    </div>
                  </article>
                ) : null}

                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="mb-4 font-data text-[0.6875rem] uppercase tracking-[0.16em] text-ledger-muted">
                      {copy("blog.filter.label")}
                    </p>
                    <div
                      role="group"
                      aria-label={copy("blog.filter.label")}
                      className="flex flex-wrap gap-2"
                    >
                      {["all", ...allTags].map((tag) => {
                        const pressed = selectedTag === tag;
                        return (
                          <button
                            key={tag}
                            type="button"
                            aria-pressed={pressed}
                            onClick={() => setSelectedTag(tag)}
                            className={
                              pressed
                                ? "rounded-full border border-ledger-ink bg-ledger-ink px-3.5 py-2 font-data text-[0.6875rem] tracking-[0.06em] text-ledger-paper transition-colors"
                                : "rounded-full border border-ledger-line-strong bg-transparent px-3.5 py-2 font-data text-[0.6875rem] tracking-[0.06em] text-ledger-ink-2 transition-colors hover:border-ledger-ink hover:bg-ledger-surface"
                            }
                          >
                            {tag === "all" ? copy("blog.filter.all") : displayTag(tag)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <MarketingSearch
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder={copy("blog.filter.searchPlaceholder")}
                    label={copy("blog.filter.searchLabel")}
                    className="w-full min-[641px]:w-[280px]"
                    inputClassName="min-h-10 rounded-full py-2 text-sm"
                  />
                </div>

                {filtersActive && filteredPosts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-ledger-line px-6 py-12 text-center">
                    <p className="text-[0.9375rem] leading-[1.65] text-ledger-muted">
                      {searchTerm.trim()
                        ? copy("blog.filter.noSearch")
                        : copy("blog.filter.empty")}
                    </p>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-2 text-sm font-semibold text-ledger-accent hover:underline"
                    >
                      {copy("blog.filter.emptyAction")}
                    </button>
                  </div>
                ) : null}

                {otherPosts.length > 0 ? (
                  <div className="grid gap-3 min-[641px]:grid-cols-2 min-[1025px]:grid-cols-3">
                    {otherPosts.map((post) => (
                      <Link
                        key={post.id}
                        to={`/blog/${post.slug}`}
                        className="grid content-start rounded-2xl border border-ledger-line bg-ledger-surface px-[22px] pb-[18px] pt-[22px] no-underline transition-all hover:-translate-y-0.5 hover:border-ledger-line-strong hover:shadow-[0_1px_2px_rgba(18,23,21,0.05),0_18px_40px_-24px_rgba(18,23,21,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent/40"
                      >
                        <div>
                          {post.tags && post.tags.length > 0 ? (
                            <span className="mb-3.5 inline-block w-fit rounded-full bg-ledger-accent-soft px-2.5 py-1 font-data text-[0.5625rem] uppercase tracking-[0.1em] text-ledger-accent">
                              {displayTag(post.tags[0])}
                            </span>
                          ) : null}
                          <h3 className="font-display text-[1.35rem] font-normal leading-[1.15] tracking-[-0.012em] text-ledger-ink">
                            {post.title}
                          </h3>
                          {post.excerpt ? (
                            <p className="mt-2.5 text-sm leading-[1.6] text-ledger-muted">
                              {post.excerpt}
                            </p>
                          ) : null}
                        </div>
                        <div className="mt-4 flex justify-between gap-3 border-t border-dashed border-ledger-line pt-3.5 font-data text-[0.625rem] text-ledger-muted">
                          <span className="truncate">
                            {authorName(post) ? `${authorName(post)} · ` : ""}
                            {formatDate(post.published_at, false)}
                          </span>
                          <span className="shrink-0 font-medium text-ledger-accent">
                            {copy("blog.post.minRead").replace(
                              "{{count}}",
                              String(readingMinutes(post)),
                            )}{" "}
                            →
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>

        <MarketingCtaBand
          eyebrow={copy("blog.cta.eyebrow")}
          title={copy("blog.cta.title")}
          lede={copy("blog.cta.lede")}
          primary={{ label: copy("blog.cta.primary"), to: "/auth" }}
          secondary={{ label: copy("blog.cta.secondary"), to: "/pricing" }}
        />
      </main>

      <MarketingFooter />
    </div>
  );
}
