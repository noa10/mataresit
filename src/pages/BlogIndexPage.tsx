import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPostPreviews } from '@/services/blogService';
import { BlogCard } from '@/components/blog/BlogCard';
import { BlogSEO } from '@/components/blog/BlogSEO';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, BookOpen, Rss, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BlogIndexPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  const {
    data: posts,
    isLoading,
    error
  } = useQuery({
    queryKey: ['blogPosts'],
    queryFn: getPostPreviews,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Filter posts based on search term and selected tag
  const filteredPosts = posts?.filter(post => {
    const matchesSearch = !searchTerm ||
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.excerpt?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTag = selectedTag === 'all' ||
      post.tags?.includes(selectedTag);

    return matchesSearch && matchesTag;
  }) || [];

  // Get all unique tags from posts
  const allTags = Array.from(
    new Set(posts?.flatMap(post => post.tags || []) || [])
  ).sort();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading blog posts...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to load blog posts</h2>
            <p className="text-muted-foreground">
              We're having trouble loading the blog posts. Please try again later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const featuredPost = filteredPosts[0];
  const otherPosts = filteredPosts.slice(1);

  return (
    <>
      <BlogSEO isIndex />
      <div className="container mx-auto px-4 py-12">
      {/* Header Section */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Rss className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            The Mataresit Blog
          </h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Insights, updates, and expert tips on AI-powered expense management,
          productivity, and digital transformation for modern businesses.
        </p>

        {/* RSS Feed Link */}
        <div className="mt-6">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/blog-rss" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              <Rss className="h-4 w-4" />
              RSS Feed
            </a>
          </Button>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search blog posts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedTag} onValueChange={setSelectedTag}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {allTags.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results count */}
        {(searchTerm || selectedTag !== 'all') && (
          <div className="text-center mt-4 text-sm text-muted-foreground">
            {filteredPosts.length === 0
              ? 'No posts found matching your criteria'
              : `Found ${filteredPosts.length} post${filteredPosts.length === 1 ? '' : 's'}`
            }
          </div>
        )}
      </div>

      {/* Featured Post Section */}
      {featuredPost && (
        <>
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-6">
              <Badge variant="default" className="px-3 py-1">
                Featured
              </Badge>
              <h2 className="text-2xl font-semibold">Latest Post</h2>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              {featuredPost.image_url && (
                <div className="order-2 lg:order-1">
                  <img 
                    src={featuredPost.image_url} 
                    alt={featuredPost.title}
                    className="rounded-lg shadow-lg w-full h-64 lg:h-80 object-cover"
                  />
                </div>
              )}
              
              <div className={`order-1 ${featuredPost.image_url ? 'lg:order-2' : 'lg:col-span-2'}`}>
                <div className="space-y-4">
                  {featuredPost.tags && featuredPost.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {featuredPost.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  <h3 className="text-3xl font-bold leading-tight">
                    {featuredPost.title}
                  </h3>
                  
                  {featuredPost.excerpt && (
                    <p className="text-lg text-muted-foreground leading-relaxed">
                      {featuredPost.excerpt}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {featuredPost.author && (
                      <span>
                        By {featuredPost.author.first_name} {featuredPost.author.last_name}
                      </span>
                    )}
                    {featuredPost.published_at && (
                      <span>
                        {new Date(featuredPost.published_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    )}
                  </div>
                  
                  <a 
                    href={`/blog/${featuredPost.slug}`}
                    className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                  >
                    Read More
                  </a>
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-12" />
        </>
      )}

      {/* Other Posts Section */}
      {otherPosts.length > 0 && (
        <div>
          <h2 className="text-2xl font-semibold mb-8">
            {featuredPost ? 'More Posts' : 'Latest Posts'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {otherPosts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!posts || posts.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">No blog posts yet</h2>
          <p className="text-muted-foreground">
            Check back soon for insights and updates from the Mataresit team.
          </p>
        </div>
      ) : filteredPosts.length === 0 && (searchTerm || selectedTag !== 'all') ? (
        <div className="text-center py-12">
          <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">No posts found</h2>
          <p className="text-muted-foreground">
            Try adjusting your search terms or filters to find what you're looking for.
          </p>
        </div>
      ) : null}
      </div>
    </>
  );
}
