-- Insert a test blog post to verify the posts table works
-- This migration will create a sample blog post for testing

-- Insert a test blog post (only if it doesn't exist)
INSERT INTO public.posts (
  slug, 
  title, 
  content, 
  excerpt, 
  tags, 
  status, 
  published_at, 
  author_id
) 
SELECT 
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
WHERE NOT EXISTS (
  SELECT 1 FROM public.posts WHERE slug = 'welcome-to-paperless-maverick-blog'
);
