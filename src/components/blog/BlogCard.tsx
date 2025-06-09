import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, User, Clock, ArrowRight } from 'lucide-react';
import { BlogCardProps } from '@/types/blog';

export function BlogCard({ post }: BlogCardProps) {
  // Format the published date
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Get author name
  const getAuthorName = () => {
    if (!post.author) return 'Anonymous';
    const { first_name, last_name } = post.author;
    if (first_name && last_name) {
      return `${first_name} ${last_name}`;
    }
    return first_name || last_name || 'Anonymous';
  };

  // Get author initials
  const getAuthorInitials = () => {
    const authorName = getAuthorName();
    if (authorName === 'Anonymous') return 'A';
    
    const names = authorName.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return authorName[0]?.toUpperCase() || 'A';
  };

  // Calculate reading time (rough estimate: 200 words per minute)
  const getReadingTime = () => {
    if (!post.excerpt) return '2 min read';
    const wordCount = post.excerpt.split(' ').length;
    const readingTime = Math.ceil(wordCount / 50); // Assuming excerpt is ~50 words per minute to read
    return `${readingTime} min read`;
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden">
      {/* Featured Image */}
      {post.image_url && (
        <div className="relative h-48 overflow-hidden">
          <img
            src={post.image_url}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              // Hide image container if image fails to load
              const target = e.target as HTMLImageElement;
              const container = target.parentElement;
              if (container) {
                container.style.display = 'none';
              }
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
      )}

      <CardHeader className="pb-3">
        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {post.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {post.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{post.tags.length - 3} more
              </Badge>
            )}
          </div>
        )}

        {/* Title */}
        <Link to={`/blog/${post.slug}`} className="group/title">
          <h3 className="text-xl font-semibold leading-tight group-hover/title:text-primary transition-colors duration-200 line-clamp-2">
            {post.title}
          </h3>
        </Link>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-muted-foreground mb-4 line-clamp-3 leading-relaxed">
            {post.excerpt}
          </p>
        )}

        {/* Author and Meta Info */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            {/* Author */}
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {getAuthorInitials()}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{getAuthorName()}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Reading Time */}
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{getReadingTime()}</span>
            </div>

            {/* Published Date */}
            {post.published_at && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(post.published_at)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Read More Link */}
        <div className="mt-4 pt-4 border-t">
          <Link
            to={`/blog/${post.slug}`}
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors duration-200 font-medium group/link"
          >
            Read More
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/link:translate-x-1" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
