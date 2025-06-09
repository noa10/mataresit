-- Insert a test blog post to verify the posts table works
-- Run this in the Supabase SQL Editor

-- First, let's check if the posts table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'posts';

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
) ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  excerpt = EXCLUDED.excerpt,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  published_at = EXCLUDED.published_at,
  updated_at = NOW();

-- Verify the post was inserted
SELECT id, slug, title, status, published_at, created_at 
FROM public.posts 
WHERE slug = 'welcome-to-paperless-maverick-blog';

-- Check total post count
SELECT COUNT(*) as total_posts FROM public.posts;
SELECT COUNT(*) as published_posts FROM public.posts WHERE status = 'published';
