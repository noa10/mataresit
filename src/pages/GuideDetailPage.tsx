import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useDocumentationTranslation, useLanguage, useHomepageTranslation } from '@/contexts/LanguageContext';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { documentationService, DocumentationGuide } from '@/services/documentationService';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import {
  ArrowLeft,
  Clock,
  User,
  BookOpen,
  ExternalLink,
  Share2,
  Bookmark
} from 'lucide-react';

const shell = 'mx-auto w-full max-w-[1240px] px-5 min-[881px]:px-6';

const BOOKMARK_STORAGE_KEY = 'mataresit_guide_bookmarks';

const USER_TYPE_KEYS: Record<DocumentationGuide['userType'], string> = {
  'new-user': 'newUser',
  'regular-user': 'regularUser',
  'team-admin': 'teamAdmin',
  'power-user': 'powerUser',
  all: 'all',
};

const readBookmarks = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(BOOKMARK_STORAGE_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
};

const formatGuideDate = (value: string, language: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  try {
    return new Intl.DateTimeFormat(language === 'ms' ? 'ms-MY' : 'en-MY', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
};

const difficultyTone: Record<string, string> = {
  beginner: 'bg-ledger-accent-soft text-ledger-accent',
  intermediate: 'bg-ledger-amber-soft text-ledger-amber',
  advanced: 'bg-ledger-danger-soft text-ledger-danger',
};

const actionButtonClass =
  'flex w-full items-center gap-2 rounded-[7px] border border-ledger-line bg-ledger-surface px-3 py-2 text-left text-[0.8125rem] font-medium text-ledger-ink-2 no-underline transition-colors hover:border-ledger-line-strong hover:text-ledger-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent/40';

const utilityButtonClass =
  'grid h-9 w-9 place-items-center rounded-lg text-ledger-ink-2 transition-colors hover:bg-ledger-surface-2 hover:text-ledger-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent/40';

export default function GuideDetailPage() {
  const { guideId } = useParams<{ guideId: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useDocumentationTranslation();
  const { t: tHome } = useHomepageTranslation();
  const [guide, setGuide] = useState<DocumentationGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    if (!guideId) return;

    let cancelled = false;
    // Route param/language changes reset the guide before the new fetch lands.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGuide(null);
    setLoading(true);
    setError(false);

    documentationService
      .getGuide(guideId, language)
      .then((guideData) => {
        if (cancelled) return;
        if (!guideData) {
          setError(true);
          return;
        }
        setGuide(guideData);
      })
      .catch((err) => {
        console.error('Failed to load guide:', err);
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [guideId, language]);

  useEffect(() => {
    // Bookmarks live in localStorage, outside React's state tree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBookmarked(guideId ? readBookmarks().includes(guideId) : false);
  }, [guideId]);

  const getUserTypeIcon = (userType: string) => {
    switch (userType) {
      case 'new-user': return <User className="h-3.5 w-3.5" aria-hidden="true" />;
      case 'team-admin': return <User className="h-3.5 w-3.5" aria-hidden="true" />;
      case 'power-user': return <User className="h-3.5 w-3.5" aria-hidden="true" />;
      default: return <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />;
    }
  };

  const handleShare = async () => {
    if (!guide) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: guide.title,
          text: guide.description,
          url: window.location.href,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard is unavailable');
      }
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t('guide.actions.linkCopied'));
    } catch (err) {
      console.error('Failed to copy guide link:', err);
      toast.error(t('guide.actions.copyFailed'));
    }
  };

  const handleViewSource = () => {
    if (!guide) return;
    const sourcePath = guide.sourcePath ?? guide.path;
    window.open(sourcePath, '_blank', 'noopener,noreferrer');
  };

  const toggleBookmark = () => {
    if (!guide) return;

    const next = new Set(readBookmarks());
    if (next.has(guide.id)) {
      next.delete(guide.id);
    } else {
      next.add(guide.id);
    }

    try {
      localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify([...next]));
      setBookmarked(next.has(guide.id));
      toast.success(
        t(next.has(guide.id) ? 'guide.actions.bookmarkAdded' : 'guide.actions.bookmarkRemoved')
      );
    } catch (err) {
      console.error('Failed to update guide bookmarks:', err);
      toast.error(t('guide.actions.bookmarkFailed'));
    }
  };

  const categoryLabel = guide
    ? String(
        t(`guide.categories.${guide.category}.title`, {
          defaultValue: guide.category.replace(/-/g, ' '),
        })
      )
    : '';
  const subcategoryLabel = guide?.subcategory?.replace(/-/g, ' ') ?? '';
  const difficultyLabel = guide ? String(t(`guide.difficulty.${guide.difficulty}`)) : '';
  const userTypeLabel = guide
    ? String(t(`guide.userType.${USER_TYPE_KEYS[guide.userType]}`))
    : '';

  const backLink = (
    <Link
      to="/docs"
      className="inline-flex items-center gap-1.5 rounded-md font-data text-[0.6875rem] uppercase tracking-[0.12em] text-ledger-muted no-underline transition-colors hover:text-ledger-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent/40"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
      {String(t('guide.backToDocs'))}
    </Link>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-ledger-paper leading-[1.6] text-ledger-ink">
        <MarketingHeader />
        <main id="main" className={`${shell} py-14`}>
          {backLink}
          <div
            role="status"
            aria-label={String(t('guide.loading'))}
            className="flex min-h-[320px] items-center justify-center"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-ledger-line border-b-ledger-accent" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !guide) {
    return (
      <div className="min-h-screen bg-ledger-paper leading-[1.6] text-ledger-ink">
        <MarketingHeader />
        <main id="main" className={`${shell} py-14`}>
          {backLink}
          <div className="mt-10 rounded-2xl border border-ledger-line bg-ledger-surface px-6 py-12 text-center">
            <h1 className="font-display text-[clamp(1.7rem,2.6vw,2.2rem)] font-normal leading-[1.1] tracking-[-0.018em] text-ledger-ink">
              {String(t('guide.notFoundTitle'))}
            </h1>
            <p className="mx-auto mt-3 max-w-[52ch] text-[0.9375rem] leading-[1.65] text-ledger-muted">
              {String(t('guide.notFoundDescription'))}
            </p>
            <button
              type="button"
              onClick={() => navigate('/docs')}
              className="mt-6 inline-flex items-center gap-2 rounded-[7px] bg-ledger-accent px-4 py-2.5 text-sm font-semibold text-ledger-paper transition-colors hover:bg-ledger-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent/40"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {String(t('guide.backToDocs'))}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ledger-paper leading-[1.6] text-ledger-ink">
      <Helmet>
        <title>{guide.title}</title>
        <meta name="description" content={guide.description} />
      </Helmet>

      <a
        href="#main"
        className="absolute left-4 top-[-64px] z-[100] rounded-md bg-ledger-ink px-4 py-2.5 text-sm text-ledger-paper focus:top-3"
      >
        {String(tHome('skipToContent'))}
      </a>

      <MarketingHeader />

      <main id="main">
        {/* Guide header */}
        <section className="border-b border-ledger-line">
          <div className={`${shell} pb-10 pt-10 min-[881px]:pb-12 min-[881px]:pt-12`}>
            <div className="flex items-center justify-between gap-4">
              {backLink}

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label={String(t('guide.actions.share'))}
                  title={String(t('guide.actions.share'))}
                  className={utilityButtonClass}
                >
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={toggleBookmark}
                  aria-label={String(
                    t(bookmarked ? 'guide.actions.bookmarked' : 'guide.actions.bookmark')
                  )}
                  aria-pressed={bookmarked}
                  title={String(
                    t(bookmarked ? 'guide.actions.bookmarked' : 'guide.actions.bookmark')
                  )}
                  className={utilityButtonClass}
                >
                  <Bookmark
                    className={`h-4 w-4 ${bookmarked ? 'fill-current' : ''}`}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-2 gap-y-1 font-data text-[0.6875rem] uppercase tracking-[0.1em] text-ledger-muted">
              <span>{categoryLabel}</span>
              {subcategoryLabel ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{subcategoryLabel}</span>
                </>
              ) : null}
            </div>

            <h1 className="mt-3 font-display text-[clamp(2.1rem,4vw,3.25rem)] font-normal leading-[1.05] tracking-[-0.024em] text-ledger-ink">
              {guide.title}
            </h1>

            <p className="mt-[18px] max-w-[68ch] text-[1.0625rem] leading-[1.6] text-ledger-muted">
              {guide.description}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-2.5 py-1 font-data text-[0.625rem] font-medium uppercase tracking-[0.08em] ${
                  difficultyTone[guide.difficulty] ?? 'bg-ledger-surface-2 text-ledger-ink-2'
                }`}
              >
                {difficultyLabel}
              </span>

              <span className="flex items-center gap-1.5 text-sm text-ledger-muted">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {String(t('guide.readingTime', { count: guide.readingTime }))}
              </span>

              <span className="flex items-center gap-1.5 text-sm text-ledger-muted">
                {getUserTypeIcon(guide.userType)}
                <span className="capitalize">{userTypeLabel}</span>
              </span>

              <span className="text-sm text-ledger-muted">
                {String(
                  t('guide.updated', {
                    date: formatGuideDate(guide.lastUpdated, language),
                  })
                )}
              </span>
            </div>

            {guide.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {guide.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-ledger-line bg-ledger-surface px-2.5 py-1 font-data text-[0.6875rem] text-ledger-ink-2"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {/* Guide body */}
        <section className="border-b border-ledger-line">
          <div
            className={`${shell} grid grid-cols-1 gap-8 pb-[88px] pt-10 min-[881px]:grid-cols-[minmax(0,1fr)_220px] min-[881px]:gap-14 min-[881px]:pt-14`}
          >
            <div className="min-w-0">
              {guide.contentFallback ? (
                <div
                  role="status"
                  className="mb-5 rounded-[10px] border border-ledger-line bg-ledger-amber-soft px-4 py-3 text-sm leading-[1.55] text-ledger-amber"
                >
                  {String(t('guide.contentFallback'))}
                </div>
              ) : null}

              <article className="rounded-2xl border border-ledger-line bg-ledger-surface px-5 py-6 min-[881px]:px-9 min-[881px]:py-9">
                {guide.content ? (
                  <MarkdownRenderer content={guide.content} />
                ) : (
                  <div className="py-12 text-center">
                    <BookOpen className="mx-auto mb-4 h-12 w-12 text-ledger-muted" aria-hidden="true" />
                    <h3 className="mb-2 font-display text-xl text-ledger-ink">
                      {String(t('guide.contentLoadingTitle'))}
                    </h3>
                    <p className="text-ledger-muted">
                      {String(t('guide.contentLoadingDescription'))}
                    </p>
                  </div>
                )}
              </article>
            </div>

            {/* Guide sidebar */}
            <aside className="min-[881px]:sticky min-[881px]:top-[104px] min-[881px]:self-start">
              <div className="grid gap-4">
                <div className="rounded-xl border border-ledger-line bg-ledger-surface p-4">
                  <h2 className="mb-3 font-data text-[0.625rem] uppercase tracking-[0.14em] text-ledger-muted">
                    {String(t('guide.quickActions'))}
                  </h2>
                  <div className="grid gap-1.5">
                    <button type="button" className={actionButtonClass} onClick={handleViewSource}>
                      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {String(t('guide.actions.viewSource'))}
                    </button>
                    <button type="button" className={actionButtonClass} onClick={handleShare}>
                      <Share2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {String(t('guide.actions.share'))}
                    </button>
                    <button
                      type="button"
                      className={actionButtonClass}
                      onClick={toggleBookmark}
                      aria-pressed={bookmarked}
                    >
                      <Bookmark
                        className={`h-4 w-4 shrink-0 ${bookmarked ? 'fill-current' : ''}`}
                        aria-hidden="true"
                      />
                      {String(
                        t(bookmarked ? 'guide.actions.bookmarked' : 'guide.actions.bookmark')
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-ledger-line bg-ledger-surface p-4">
                  <h2 className="mb-3 font-data text-[0.625rem] uppercase tracking-[0.14em] text-ledger-muted">
                    {String(t('guide.info.title'))}
                  </h2>
                  <dl className="grid gap-2.5 text-sm">
                    {[
                      [String(t('guide.info.category')), categoryLabel],
                      [String(t('guide.info.difficulty')), difficultyLabel],
                      [String(t('guide.info.targetUser')), userTypeLabel],
                      [String(t('guide.info.readingTime')), String(t('guide.info.minutes', { count: guide.readingTime }))],
                      [String(t('guide.info.lastUpdated')), formatGuideDate(guide.lastUpdated, language)],
                    ].map(([label, value]) => (
                      <div key={label} className="grid gap-0.5">
                        <dt className="text-xs text-ledger-muted">{label}</dt>
                        <dd className="capitalize text-[0.875rem] text-ledger-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
