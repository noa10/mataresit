import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";
import {
  useLanguage,
  useHomepageTranslation,
  useResourcesTranslation,
} from "@/contexts/LanguageContext";
import { BlogSEO } from "@/components/blog/BlogSEO";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { getPostBySlug } from "@/services/blogService";
import type { Post } from "@/types/blog";

const shell = "mx-auto w-full max-w-[1240px] px-5 min-[881px]:px-6";

function displayTag(tag: string) {
  return tag.toLowerCase() === "ai"
    ? "AI"
    : tag.charAt(0).toUpperCase() + tag.slice(1);
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguage();
  const { t } = useResourcesTranslation();
  const { t: tHome } = useHomepageTranslation();

  const {
    data: post,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["blogPost", slug],
    queryFn: () => getPostBySlug(slug!),
    enabled: !!slug,
    staleTime: 1000 * 60 * 10,
  });

  const copy = (key: string) => String(t(key));

  const authorName = (value?: Post) => {
    const name = `${value?.author?.first_name ?? ""} ${value?.author?.last_name ?? ""}`.trim();
    return name;
  };

  const formatDate = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(language === "ms" ? "ms-MY" : "en-MY", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  };

  const readMinutes = post
    ? Math.max(1, Math.ceil((post.content ?? "").trim().split(/\s+/).length / 200))
    : 0;

  // Some posts were stored with escaped newlines; normalise so markdown
  // headings, lists and paragraphs render as blocks instead of one run-on line.
  const markdownContent = useMemo(() => {
    const raw = post?.content ?? "";
    if (raw.includes("\n")) return raw;
    return raw.replace(/\\r/g, "").replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  }, [post?.content]);

  return (
    <div className="min-h-screen bg-ledger-paper leading-[1.6] text-ledger-ink">
      {post ? (
        <BlogSEO post={post} />
      ) : (
        <BlogSEO
          title={`${copy("blogPost.notFoundTitle")} — Mataresit`}
          description={copy("meta.blogPost.description")}
        />
      )}

      <a
        href="#main"
        className="absolute left-4 top-[-64px] z-[100] rounded-md bg-ledger-ink px-4 py-2.5 text-sm text-ledger-paper focus:top-3"
      >
        {String(tHome("skipToContent"))}
      </a>

      <MarketingHeader />

      <main id="main">
        {isLoading ? (
          <div className={`${shell} flex min-h-[420px] flex-col items-center justify-center gap-4 text-ledger-muted`}>
            <Loader2 aria-hidden="true" className="h-7 w-7 animate-spin" />
            <p className="text-[0.9375rem]">{copy("blogPost.loading")}</p>
          </div>
        ) : error || !post ? (
          <div className={`${shell} flex min-h-[520px] items-center justify-center py-16`}>
            <div className="max-w-[46ch] text-center">
              <BookOpen
                aria-hidden="true"
                className="mx-auto mb-4 h-10 w-10 text-ledger-muted"
                strokeWidth={1.4}
              />
              <h1 className="font-display text-[clamp(2rem,4vw,2.8rem)] font-normal leading-[1.1] tracking-[-0.02em] text-ledger-ink">
                {copy("blogPost.notFoundTitle")}
              </h1>
              <p className="mt-3 text-[1.0625rem] leading-[1.65] text-ledger-muted">
                {copy("blogPost.notFoundBody")}
              </p>
              <Link
                to="/blog"
                className="mt-6 inline-flex min-h-[46px] items-center justify-center rounded-lg bg-ledger-accent px-5 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-ledger-accent-hover dark:text-ledger-panel"
              >
                {copy("blogPost.notFoundCta")}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <section className="border-b border-ledger-line">
              <div className={`${shell} pb-10 pt-10 min-[881px]:pb-12 min-[881px]:pt-14`}>
                <div className="max-w-[820px]">
                  <Link
                    to="/blog"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-ledger-muted no-underline transition-colors hover:text-ledger-accent"
                  >
                    <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
                    {copy("blogPost.back")}
                  </Link>

                  {post.tags && post.tags.length > 0 ? (
                    <div className="mt-6 flex flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-ledger-accent-soft px-2.5 py-1 font-data text-[0.625rem] uppercase tracking-[0.08em] text-ledger-accent"
                        >
                          {displayTag(tag)}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <h1 className="mt-4 font-display text-[clamp(2.4rem,5vw,3.8rem)] font-normal leading-[1.04] tracking-[-0.025em] text-ledger-ink">
                    {post.title}
                  </h1>

                  {post.excerpt ? (
                    <p className="mt-5 max-w-[64ch] text-[1.125rem] leading-[1.6] text-ledger-muted">
                      {post.excerpt}
                    </p>
                  ) : null}

                  <p className="mt-5 font-data text-[0.6875rem] tracking-[0.03em] text-ledger-muted">
                    {[
                      authorName(post),
                      formatDate(post.published_at),
                      copy("blog.post.minRead").replace(
                        "{{count}}",
                        String(readMinutes),
                      ),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
            </section>

            <article className={`${shell} pb-16 pt-10 min-[881px]:pt-12`}>
              <div className="max-w-[820px]">
                {post.image_url ? (
                  <img
                    src={post.image_url}
                    alt={post.title}
                    className="mb-10 aspect-[16/9] w-full rounded-2xl border border-ledger-line object-cover"
                  />
                ) : null}

                <div className="text-ledger-ink-2">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => (
                        <h2 className="mb-3 mt-12 font-display text-[clamp(1.8rem,3vw,2.3rem)] font-normal leading-[1.12] tracking-[-0.018em] text-ledger-ink">
                          {children}
                        </h2>
                      ),
                      h2: ({ children }) => (
                        <h2 className="mb-3 mt-12 font-display text-[clamp(1.8rem,3vw,2.3rem)] font-normal leading-[1.12] tracking-[-0.018em] text-ledger-ink">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="mb-2 mt-9 text-xl font-semibold leading-[1.35] tracking-[-0.008em] text-ledger-ink">
                          {children}
                        </h3>
                      ),
                      h4: ({ children }) => (
                        <h4 className="mb-2 mt-7 text-[1.0625rem] font-semibold leading-[1.4] text-ledger-ink">
                          {children}
                        </h4>
                      ),
                      p: ({ children }) => (
                        <p className="mt-5 text-[1.0625rem] leading-[1.75] text-ledger-ink-2">
                          {children}
                        </p>
                      ),
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          className="font-medium text-ledger-accent underline underline-offset-[3px]"
                          {...(href?.startsWith("http")
                            ? { target: "_blank", rel: "noopener noreferrer" }
                            : {})}
                        >
                          {children}
                        </a>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-ledger-ink">
                          {children}
                        </strong>
                      ),
                      ul: ({ children }) => (
                        <ul className="mt-5 grid list-disc gap-2 pl-6 text-[1.0625rem] leading-[1.7] text-ledger-ink-2 marker:text-ledger-accent">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="mt-5 grid list-decimal gap-2 pl-6 text-[1.0625rem] leading-[1.7] text-ledger-ink-2 marker:text-ledger-accent">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => <li className="pl-1">{children}</li>,
                      blockquote: ({ children }) => (
                        <blockquote className="my-7 border-l-2 border-ledger-accent pl-5 text-[1.0625rem] italic leading-[1.7] text-ledger-muted">
                          {children}
                        </blockquote>
                      ),
                      code: ({ className, children }) => {
                        const isBlock =
                          Boolean(className?.includes("language-")) ||
                          String(children).includes("\n");
                        if (isBlock) {
                          return (
                            <code className="font-data text-[0.8125rem] leading-[1.65]">
                              {children}
                            </code>
                          );
                        }
                        return (
                          <code className="rounded bg-ledger-surface-2 px-1.5 py-0.5 font-data text-[0.875em] text-ledger-ink">
                            {children}
                          </code>
                        );
                      },
                      pre: ({ children }) => (
                        <pre className="mt-6 overflow-x-auto rounded-[10px] border border-ledger-line bg-ledger-panel p-4 font-data text-[0.8125rem] leading-[1.65] text-ledger-on-panel-muted">
                          {children}
                        </pre>
                      ),
                      hr: () => <hr className="my-10 border-ledger-line" />,
                      table: ({ children }) => (
                        <div className="mt-6 overflow-x-auto rounded-[10px] border border-ledger-line">
                          <table className="w-full border-collapse text-left text-sm">
                            {children}
                          </table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="bg-ledger-surface-2 text-ledger-ink">
                          {children}
                        </thead>
                      ),
                      th: ({ children }) => (
                        <th className="border-b border-ledger-line px-4 py-2.5 font-semibold">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="border-b border-ledger-line px-4 py-2.5 text-ledger-ink-2 last:border-b-0">
                          {children}
                        </td>
                      ),
                      img: ({ src, alt }) => (
                        <img
                          src={src}
                          alt={alt ?? ""}
                          className="mt-6 w-full rounded-xl border border-ledger-line"
                        />
                      ),
                    }}
                  >
                    {markdownContent}
                  </ReactMarkdown>
                </div>

                <div className="mt-12 border-t border-ledger-line pt-8">
                  {post.tags && post.tags.length > 0 ? (
                    <div className="mb-6 flex flex-wrap items-center gap-2">
                      <span className="font-data text-[0.625rem] uppercase tracking-[0.12em] text-ledger-muted">
                        {copy("blogPost.filedUnder")}
                      </span>
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-ledger-line px-2.5 py-1 font-data text-[0.625rem] uppercase tracking-[0.08em] text-ledger-ink-2"
                        >
                          {displayTag(tag)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <p className="max-w-[56ch] text-[0.9375rem] leading-[1.65] text-ledger-muted">
                    {copy("blogPost.endNote")}
                  </p>
                  <Link
                    to="/blog"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ledger-accent underline underline-offset-[3px]"
                  >
                    <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
                    {copy("blogPost.back")}
                  </Link>
                </div>
              </div>
            </article>
          </>
        )}
      </main>

      <MarketingFooter />
    </div>
  );
}
