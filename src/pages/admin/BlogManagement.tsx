import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Eye, Search, Filter, Calendar, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Post } from '@/types/blog';
import { BlogPostEditor } from '@/components/admin/BlogPostEditor';
import { useAdminTranslation } from '@/contexts/LanguageContext';

export default function BlogManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const { toast } = useToast();
  const { t, language } = useAdminTranslation();
  const queryClient = useQueryClient();

  // Fetch all posts (admin can see drafts)
  const { data: posts, isLoading } = useQuery({
    queryKey: ['adminBlogPosts', searchTerm, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('posts')
        .select(`
          id,
          slug,
          title,
          excerpt,
          image_url,
          published_at,
          tags,
          status,
          created_at,
          updated_at,
          author: profiles(first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,excerpt.ilike.%${searchTerm}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Post[];
    },
  });

  // Delete post mutation
  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminBlogPosts'] });
      toast({
        title: t('blogPage.toasts.success'),
        description: t('blogPage.toasts.deleted'),
      });
    },
    onError: (error) => {
      toast({
        title: t('blogPage.toasts.error'),
        description: t('blogPage.toasts.deleteFailed'),
        variant: 'destructive',
      });
    },
  });

  const handleNewPost = () => {
    setSelectedPost(null);
    setIsEditorOpen(true);
  };

  const handleEditPost = (post: Post) => {
    setSelectedPost(post);
    setIsEditorOpen(true);
  };

  const handleDeletePost = (postId: string) => {
    deletePostMutation.mutate(postId);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(
      language === 'ms' ? 'ms-MY' : 'en-MY',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }
    );
  };

  const getStatusBadge = (status: string) => {
    return status === 'published' ? (
      <Badge variant="default">{t('blogPage.statuses.published')}</Badge>
    ) : (
      <Badge variant="secondary">{t('blogPage.statuses.draft')}</Badge>
    );
  };

  if (isEditorOpen) {
    return (
      <BlogPostEditor
        post={selectedPost}
        onClose={() => {
          setIsEditorOpen(false);
          setSelectedPost(null);
        }}
        onSave={() => {
          queryClient.invalidateQueries({ queryKey: ['adminBlogPosts'] });
          setIsEditorOpen(false);
          setSelectedPost(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('blogPage.title')}</h1>
          <p className="text-muted-foreground">{t('blogPage.description')}</p>
        </div>
        <Button onClick={handleNewPost} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t('blogPage.newPost')}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t('blogPage.filters.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('blogPage.filters.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('blogPage.filters.statusPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('blogPage.filters.all')}</SelectItem>
                <SelectItem value="published">
                  {t('blogPage.filters.published')}
                </SelectItem>
                <SelectItem value="draft">{t('blogPage.filters.drafts')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Posts Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t('blogPage.postsTitle', { count: posts?.length || 0 })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : posts && posts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('blogPage.table.title')}</TableHead>
                    <TableHead>{t('blogPage.table.status')}</TableHead>
                    <TableHead>{t('blogPage.table.author')}</TableHead>
                    <TableHead>{t('blogPage.table.published')}</TableHead>
                    <TableHead>{t('blogPage.table.tags')}</TableHead>
                    <TableHead className="text-right">
                      {t('blogPage.table.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{post.title}</div>
                          <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                            {post.excerpt}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(post.status)}</TableCell>
                      <TableCell>
                        {post.author ? 
                          `${post.author.first_name || ''} ${post.author.last_name || ''}`.trim() ||
                          t('blogPage.unknownAuthor')
                          : t('blogPage.unknownAuthor')
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {post.published_at
                            ? formatDate(post.published_at)
                            : t('blogPage.notPublished')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {post.tags?.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {post.tags && post.tags.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{post.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {post.status === 'published' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                            >
                              <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditPost(post)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {t('blogPage.deleteDialog.title')}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('blogPage.deleteDialog.description', {
                                    title: post.title,
                                  })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  {t('blogPage.deleteDialog.cancel')}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeletePost(post.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {t('blogPage.deleteDialog.delete')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-muted-foreground">{t('blogPage.noPosts')}</div>
              <Button onClick={handleNewPost} className="mt-4">
                {t('blogPage.createFirst')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
