import { supabase } from '@/integrations/supabase/client';
import { Post, PostPreview, BlogAnalytics } from '@/types/blog';

/**
 * Fetch published blog posts for public viewing (blog index page)
 * Only returns published posts with author information
 */
export const getPostPreviews = async (): Promise<PostPreview[]> => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        slug,
        title,
        excerpt,
        image_url,
        tags,
        published_at,
        author_id
      `)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false });

    if (error) {
      console.error('Error fetching blog post previews:', error);
      throw new Error(`Failed to fetch blog posts: ${error.message}`);
    }

    // Return data with simplified author info for now
    return (data || []).map(post => ({
      ...post,
      author: {
        first_name: 'Admin',
        last_name: 'User'
      }
    }));
  } catch (error) {
    console.error('Error in getPostPreviews:', error);
    throw error;
  }
};

/**
 * Fetch a single blog post by slug for public viewing
 * Only returns published posts with full content
 */
export const getPostBySlug = async (slug: string): Promise<Post> => {
  try {
    if (!slug) {
      throw new Error('Slug is required');
    }

    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        slug,
        title,
        content,
        excerpt,
        image_url,
        tags,
        status,
        published_at,
        author_id,
        created_at,
        updated_at
      `)
      .eq('slug', slug)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Blog post not found');
      }
      console.error('Error fetching blog post by slug:', error);
      throw new Error(`Failed to fetch blog post: ${error.message}`);
    }

    if (!data) {
      throw new Error('Blog post not found');
    }

    // Return data with simplified author info for now
    return {
      ...data,
      author: {
        first_name: 'Admin',
        last_name: 'User'
      }
    };
  } catch (error) {
    console.error('Error in getPostBySlug:', error);
    throw error;
  }
};

/**
 * Fetch all posts for admin management (includes drafts)
 * Used by admin components - requires authentication
 */
export const getAllPostsForAdmin = async (): Promise<Post[]> => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        slug,
        title,
        content,
        excerpt,
        image_url,
        tags,
        status,
        published_at,
        author_id,
        created_at,
        updated_at,
        profiles!posts_author_id_fkey(first_name, last_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all posts for admin:', error);
      throw new Error(`Failed to fetch posts: ${error.message}`);
    }

    // Transform the data to match our expected structure
    return (data || []).map(post => ({
      ...post,
      author: post.profiles ? {
        first_name: post.profiles.first_name,
        last_name: post.profiles.last_name
      } : null
    }));
  } catch (error) {
    console.error('Error in getAllPostsForAdmin:', error);
    throw error;
  }
};

/**
 * Get blog analytics data for admin dashboard
 */
export const getBlogAnalytics = async (): Promise<BlogAnalytics> => {
  try {
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

    // Get all tags for tag analysis
    const { data: postsWithTags } = await supabase
      .from('posts')
      .select('tags')
      .not('tags', 'is', null);

    // Process tags
    const tagCounts: Record<string, number> = {};
    postsWithTags?.forEach(post => {
      post.tags?.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const popularTags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalPosts: totalPosts || 0,
      publishedPosts: publishedPosts || 0,
      draftPosts: draftPosts || 0,
      recentPosts: recentPosts || 0,
      totalTags: Object.keys(tagCounts).length,
      popularTags,
      monthlyStats: [] // Can be implemented later if needed
    };
  } catch (error) {
    console.error('Error in getBlogAnalytics:', error);
    throw error;
  }
};

/**
 * Search published posts by title or content
 */
export const searchPosts = async (query: string): Promise<PostPreview[]> => {
  try {
    if (!query.trim()) {
      return getPostPreviews();
    }

    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        slug,
        title,
        excerpt,
        image_url,
        tags,
        published_at,
        profiles!posts_author_id_fkey(first_name, last_name)
      `)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .or(`title.ilike.%${query}%,excerpt.ilike.%${query}%,content.ilike.%${query}%`)
      .order('published_at', { ascending: false });

    if (error) {
      console.error('Error searching posts:', error);
      throw new Error(`Failed to search posts: ${error.message}`);
    }

    // Transform the data to match our expected structure
    return (data || []).map(post => ({
      ...post,
      author: post.profiles ? {
        first_name: post.profiles.first_name,
        last_name: post.profiles.last_name
      } : null
    }));
  } catch (error) {
    console.error('Error in searchPosts:', error);
    throw error;
  }
};

/**
 * Get posts by tag
 */
export const getPostsByTag = async (tag: string): Promise<PostPreview[]> => {
  try {
    if (!tag) {
      return getPostPreviews();
    }

    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        slug,
        title,
        excerpt,
        image_url,
        tags,
        published_at,
        profiles!posts_author_id_fkey(first_name, last_name)
      `)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .contains('tags', [tag])
      .order('published_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts by tag:', error);
      throw new Error(`Failed to fetch posts by tag: ${error.message}`);
    }

    // Transform the data to match our expected structure
    return (data || []).map(post => ({
      ...post,
      author: post.profiles ? {
        first_name: post.profiles.first_name,
        last_name: post.profiles.last_name
      } : null
    }));
  } catch (error) {
    console.error('Error in getPostsByTag:', error);
    throw error;
  }
};

/**
 * Get all unique tags from published posts
 */
export const getAllTags = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('tags')
      .eq('status', 'published')
      .not('tags', 'is', null);

    if (error) {
      console.error('Error fetching tags:', error);
      throw new Error(`Failed to fetch tags: ${error.message}`);
    }

    // Flatten and deduplicate tags
    const allTags = new Set<string>();
    data?.forEach(post => {
      post.tags?.forEach(tag => allTags.add(tag));
    });

    return Array.from(allTags).sort();
  } catch (error) {
    console.error('Error in getAllTags:', error);
    throw error;
  }
};
