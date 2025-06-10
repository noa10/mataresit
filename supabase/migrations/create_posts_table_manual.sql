-- Manual SQL script to create posts table in Supabase SQL Editor
-- Copy and paste this into the Supabase SQL Editor and run it

-- Create posts table for blog functionality
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT,
  excerpt TEXT,
  image_url TEXT,
  tags TEXT[],
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMP WITH TIME ZONE,
  author_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on posts table
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_slug ON public.posts (slug);
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts (status);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON public.posts (published_at);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts (author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts (created_at);

-- Create GIN index for tags array
CREATE INDEX IF NOT EXISTS idx_posts_tags ON public.posts USING GIN (tags);

-- RLS Policies

-- Public can read published posts
DROP POLICY IF EXISTS "Anyone can read published posts" ON public.posts;
CREATE POLICY "Anyone can read published posts" ON public.posts
FOR SELECT TO public USING (status = 'published');

-- Authenticated users can read published posts
DROP POLICY IF EXISTS "Authenticated users can read published posts" ON public.posts;
CREATE POLICY "Authenticated users can read published posts" ON public.posts
FOR SELECT TO authenticated USING (status = 'published');

-- Authors can read their own posts (including drafts)
DROP POLICY IF EXISTS "Authors can read their own posts" ON public.posts;
CREATE POLICY "Authors can read their own posts" ON public.posts
FOR SELECT TO authenticated USING (auth.uid() = author_id);

-- Authors can insert their own posts
DROP POLICY IF EXISTS "Authors can insert their own posts" ON public.posts;
CREATE POLICY "Authors can insert their own posts" ON public.posts
FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

-- Authors can update their own posts
DROP POLICY IF EXISTS "Authors can update their own posts" ON public.posts;
CREATE POLICY "Authors can update their own posts" ON public.posts
FOR UPDATE TO authenticated USING (auth.uid() = author_id);

-- Authors can delete their own posts
DROP POLICY IF EXISTS "Authors can delete their own posts" ON public.posts;
CREATE POLICY "Authors can delete their own posts" ON public.posts
FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS posts_updated_at ON public.posts;
CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Insert a test blog post
INSERT INTO public.posts (
  slug, 
  title, 
  content, 
  excerpt, 
  tags, 
  status, 
  published_at, 
  author_id
) VALUES (
  'welcome-to-paperless-maverick-blog',
  'Welcome to the Paperless Maverick Blog',
  '# Welcome to Our Blog

We''re excited to launch the Paperless Maverick blog! This is where we''ll share insights, updates, and expert tips on AI-powered expense management.

## What You Can Expect

- **Product Updates**: Stay informed about new features and improvements
- **Best Practices**: Learn how to maximize your productivity with our platform
- **Industry Insights**: Discover trends in digital transformation and expense management
- **Tips & Tricks**: Get the most out of your paperless workflow

## Getting Started

Our AI-powered platform makes expense management effortless. Whether you''re a small business owner or managing expenses for a large organization, we''ve got you covered.

Stay tuned for more exciting content!',
  'Welcome to the Paperless Maverick blog! Discover insights, updates, and expert tips on AI-powered expense management, productivity, and digital transformation.',
  ARRAY['announcement', 'welcome', 'getting-started'],
  'published',
  NOW(),
  (SELECT id FROM auth.users LIMIT 1)
) ON CONFLICT (slug) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE public.posts IS 'Blog posts table with support for drafts and published posts';
COMMENT ON COLUMN public.posts.slug IS 'URL-friendly unique identifier for the post';
COMMENT ON COLUMN public.posts.status IS 'Post status: draft or published';
COMMENT ON COLUMN public.posts.tags IS 'Array of tags associated with the post';
COMMENT ON COLUMN public.posts.published_at IS 'Timestamp when the post was published (null for drafts)';

-- Verify the table was created successfully
SELECT 'Posts table created successfully!' as message;
SELECT COUNT(*) as post_count FROM public.posts;
