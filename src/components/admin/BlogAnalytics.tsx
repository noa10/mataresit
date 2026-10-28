import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Eye, Calendar, TrendingUp, Tag } from 'lucide-react';
import { useAdminTranslation } from '@/contexts/LanguageContext';

export function BlogAnalytics() {
  const { t } = useAdminTranslation();
  // Fetch blog statistics
  const { data: stats, isLoading } = useQuery({
    queryKey: ['blogAnalytics'],
    queryFn: async () => {
      // Get total posts count
      const { count: totalPosts } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true });

      // Get published posts count
      const { count: publishedPosts } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published');

      // Get draft posts count
      const { count: draftPosts } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'draft');

      // Get recent posts (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { count: recentPosts } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Get all tags
      const { data: posts } = await supabase
        .from('posts')
        .select('tags')
        .not('tags', 'is', null);

      const allTags = posts?.flatMap(post => post.tags || []) || [];
      const uniqueTags = new Set(allTags);

      // Get most used tags
      const tagCounts = allTags.reduce((acc: Record<string, number>, tag: string) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {});

      const topTags = Object.entries(tagCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([tag, count]) => ({ tag, count }));

      return {
        totalPosts: totalPosts || 0,
        publishedPosts: publishedPosts || 0,
        draftPosts: draftPosts || 0,
        recentPosts: recentPosts || 0,
        totalTags: uniqueTags.size,
        topTags,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded animate-pulse mb-2" />
              <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: t('diagnostics.blogAnalytics.totalPosts'),
      value: stats?.totalPosts || 0,
      icon: FileText,
      description: t('diagnostics.blogAnalytics.allBlogPosts'),
      color: 'text-blue-600',
    },
    {
      title: t('diagnostics.blogAnalytics.published'),
      value: stats?.publishedPosts || 0,
      icon: Eye,
      description: t('diagnostics.blogAnalytics.liveOnWebsite'),
      color: 'text-green-600',
    },
    {
      title: t('diagnostics.blogAnalytics.drafts'),
      value: stats?.draftPosts || 0,
      icon: Calendar,
      description: t('diagnostics.blogAnalytics.unpublishedPosts'),
      color: 'text-yellow-600',
    },
    {
      title: t('diagnostics.blogAnalytics.recentPosts'),
      value: stats?.recentPosts || 0,
      icon: TrendingUp,
      description: t('diagnostics.blogAnalytics.last30Days'),
      color: 'text-purple-600',
    },
    {
      title: t('diagnostics.blogAnalytics.totalTags'),
      value: stats?.totalTags || 0,
      icon: Tag,
      description: t('diagnostics.blogAnalytics.uniqueTagsUsed'),
      color: 'text-indigo-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Top Tags */}
      {stats?.topTags && stats.topTags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              {t('diagnostics.blogAnalytics.mostUsedTags')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.topTags.map(({ tag, count }) => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <span className="text-xs bg-primary/20 text-primary px-1 rounded">
                    {count}
                  </span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('diagnostics.blogAnalytics.quickActions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <a
              href="/admin/blog"
              className="flex items-center gap-3 p-4 rounded-lg border hover:bg-secondary/50 transition-colors"
            >
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">{t('diagnostics.blogAnalytics.managePosts')}</div>
                <div className="text-sm text-muted-foreground">{t('diagnostics.blogAnalytics.managePostsDescription')}</div>
              </div>
            </a>
            
            <a
              href="/blog"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-lg border hover:bg-secondary/50 transition-colors"
            >
              <Eye className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">{t('diagnostics.blogAnalytics.viewBlog')}</div>
                <div className="text-sm text-muted-foreground">{t('diagnostics.blogAnalytics.viewBlogDescription')}</div>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
