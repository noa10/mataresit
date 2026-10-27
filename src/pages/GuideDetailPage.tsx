import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useDocumentationTranslation, useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Clock,
  User,
  BookOpen,
  ExternalLink,
  Share2,
  Bookmark
} from 'lucide-react';
import { documentationService, DocumentationGuide } from '@/services/documentationService';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';

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

export default function GuideDetailPage() {
  const { guideId } = useParams<{ guideId: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useDocumentationTranslation();
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

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800 border-green-200';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'advanced': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getUserTypeIcon = (userType: string) => {
    switch (userType) {
      case 'new-user': return <User className="h-4 w-4" />;
      case 'team-admin': return <User className="h-4 w-4" />;
      case 'power-user': return <User className="h-4 w-4" />;
      default: return <BookOpen className="h-4 w-4" />;
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

  if (loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div
          role="status"
          aria-label={String(t('guide.loading'))}
          className="flex items-center justify-center min-h-[400px]"
        >
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error || !guide) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">
            {String(t('guide.notFoundTitle'))}
          </h1>
          <p className="text-muted-foreground mt-2 mb-6">
            {String(t('guide.notFoundDescription'))}
          </p>
          <Button onClick={() => navigate('/docs')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {String(t('guide.backToDocs'))}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/docs')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {String(t('guide.backToDocs'))}
          </Button>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              aria-label={String(t('guide.actions.share'))}
              title={String(t('guide.actions.share'))}
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleBookmark}
              aria-label={String(t(bookmarked ? 'guide.actions.bookmarked' : 'guide.actions.bookmark'))}
              aria-pressed={bookmarked}
              title={String(t(bookmarked ? 'guide.actions.bookmarked' : 'guide.actions.bookmark'))}
            >
              <Bookmark className={`h-4 w-4 ${bookmarked ? 'fill-current' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="capitalize">{categoryLabel}</span>
            {subcategoryLabel && (
              <>
                <span>•</span>
                <span className="capitalize">{subcategoryLabel}</span>
              </>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            {guide.title}
          </h1>

          <p className="text-lg text-muted-foreground max-w-3xl">
            {guide.description}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Badge variant="outline" className={getDifficultyColor(guide.difficulty)}>
              {difficultyLabel}
            </Badge>

            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {String(t('guide.readingTime', { count: guide.readingTime }))}
            </div>

            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              {getUserTypeIcon(guide.userType)}
              <span className="capitalize">{userTypeLabel}</span>
            </div>

            <div className="text-sm text-muted-foreground">
              {String(
                t('guide.updated', {
                  date: formatGuideDate(guide.lastUpdated, language),
                })
              )}
            </div>
          </div>

          {guide.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {guide.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <Separator className="mb-8" />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-4 gap-8"
      >
        {/* Main Content */}
        <div className="lg:col-span-3">
          {guide.contentFallback && (
            <div
              role="status"
              className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              {String(t('guide.contentFallback'))}
            </div>
          )}
          <Card>
            <CardContent className="p-8">
              {guide.content ? (
                <MarkdownRenderer content={guide.content} />
              ) : (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {String(t('guide.contentLoadingTitle'))}
                  </h3>
                  <p className="text-muted-foreground">
                    {String(t('guide.contentLoadingDescription'))}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-8 space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">{String(t('guide.quickActions'))}</h3>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={handleViewSource}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {String(t('guide.actions.viewSource'))}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={handleShare}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    {String(t('guide.actions.share'))}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={toggleBookmark}
                    aria-pressed={bookmarked}
                  >
                    <Bookmark className={`h-4 w-4 mr-2 ${bookmarked ? 'fill-current' : ''}`} />
                    {String(t(bookmarked ? 'guide.actions.bookmarked' : 'guide.actions.bookmark'))}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Guide Info */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">{String(t('guide.info.title'))}</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">{String(t('guide.info.category'))}</span>
                    <div className="font-medium capitalize">
                      {categoryLabel}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{String(t('guide.info.difficulty'))}</span>
                    <div className="font-medium capitalize">{difficultyLabel}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{String(t('guide.info.targetUser'))}</span>
                    <div className="font-medium capitalize">
                      {userTypeLabel}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{String(t('guide.info.readingTime'))}</span>
                    <div className="font-medium">
                      {String(t('guide.info.minutes', { count: guide.readingTime }))}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{String(t('guide.info.lastUpdated'))}</span>
                    <div className="font-medium">
                      {formatGuideDate(guide.lastUpdated, language)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
