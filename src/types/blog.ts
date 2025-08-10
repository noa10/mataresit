// Blog-related type definitions for the Mataresit application (formerly Paperless Maverick)

export interface Post {
  id: string;
  slug: string;
  title: string;
  content?: string;
  excerpt?: string;
  image_url?: string;
  tags?: string[];
  status: 'draft' | 'published';
  published_at?: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  // Author information from joined profiles table
  author?: {
    first_name?: string;
    last_name?: string;
  };
}

export interface BlogPostFormData {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  image_url: string;
  tags: string[];
  status: 'draft' | 'published';
  published_at: string;
}

// For blog post previews (used in blog index)
export interface PostPreview {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  image_url?: string;
  tags?: string[];
  published_at?: string;
  author?: {
    first_name?: string;
    last_name?: string;
  };
}

// For SEO meta tags
export interface BlogSEOProps {
  post?: Post;
  isIndex?: boolean;
}

// For blog card component
export interface BlogCardProps {
  post: PostPreview;
}

// Blog analytics data structure
export interface BlogAnalytics {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  recentPosts: number;
  totalTags: number;
  popularTags: Array<{
    tag: string;
    count: number;
  }>;
  monthlyStats: Array<{
    month: string;
    posts: number;
  }>;
}

// Blog service response types
export interface BlogServiceResponse<T> {
  data: T;
  error?: string;
}

// Blog query filters
export interface BlogFilters {
  searchTerm?: string;
  selectedTag?: string;
  status?: 'all' | 'draft' | 'published';
  author?: string;
}

// Blog pagination
export interface BlogPagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

// Complete blog response with pagination
export interface BlogResponse {
  posts: PostPreview[];
  pagination: BlogPagination;
  filters: BlogFilters;
}

export default Post;
