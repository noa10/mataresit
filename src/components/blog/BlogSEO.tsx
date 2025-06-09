import { Helmet } from 'react-helmet-async';
import { BlogSEOProps } from '@/types/blog';

export function BlogSEO({ post, isIndex = false }: BlogSEOProps) {
  // Default SEO values for the blog
  const defaultTitle = 'The Paperless Maverick Blog';
  const defaultDescription = 'Insights, updates, and expert tips on AI-powered expense management, productivity, and digital transformation for modern businesses.';
  const defaultImage = '/og-blog.jpg'; // You can add a default blog OG image
  const siteUrl = window.location.origin;

  // Generate SEO values based on whether it's index or individual post
  const getSEOData = () => {
    if (isIndex) {
      return {
        title: defaultTitle,
        description: defaultDescription,
        url: `${siteUrl}/blog`,
        image: defaultImage,
        type: 'website',
      };
    }

    if (!post) {
      return {
        title: 'Blog Post Not Found | Paperless Maverick',
        description: 'The requested blog post could not be found.',
        url: `${siteUrl}/blog`,
        image: defaultImage,
        type: 'article',
      };
    }

    // Individual post SEO
    const title = `${post.title} | Paperless Maverick Blog`;
    const description = post.excerpt || defaultDescription;
    const url = `${siteUrl}/blog/${post.slug}`;
    const image = post.image_url || defaultImage;

    return {
      title,
      description,
      url,
      image,
      type: 'article',
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      author: post.author ? `${post.author.first_name || ''} ${post.author.last_name || ''}`.trim() : 'Paperless Maverick Team',
      tags: post.tags,
    };
  };

  const seoData = getSEOData();

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{seoData.title}</title>
      <meta name="description" content={seoData.description} />
      <link rel="canonical" href={seoData.url} />

      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={seoData.title} />
      <meta property="og:description" content={seoData.description} />
      <meta property="og:url" content={seoData.url} />
      <meta property="og:image" content={seoData.image} />
      <meta property="og:type" content={seoData.type} />
      <meta property="og:site_name" content="Paperless Maverick" />

      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seoData.title} />
      <meta name="twitter:description" content={seoData.description} />
      <meta name="twitter:image" content={seoData.image} />

      {/* Article-specific Meta Tags */}
      {seoData.type === 'article' && (
        <>
          {seoData.publishedTime && (
            <meta property="article:published_time" content={seoData.publishedTime} />
          )}
          {seoData.modifiedTime && (
            <meta property="article:modified_time" content={seoData.modifiedTime} />
          )}
          {seoData.author && (
            <meta property="article:author" content={seoData.author} />
          )}
          {seoData.tags && seoData.tags.map((tag) => (
            <meta key={tag} property="article:tag" content={tag} />
          ))}
          <meta property="article:section" content="Business Technology" />
        </>
      )}

      {/* Additional SEO Meta Tags */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content={seoData.author || 'Paperless Maverick Team'} />
      
      {/* Schema.org JSON-LD */}
      <script type="application/ld+json">
        {JSON.stringify(
          isIndex
            ? {
                '@context': 'https://schema.org',
                '@type': 'Blog',
                name: defaultTitle,
                description: defaultDescription,
                url: seoData.url,
                publisher: {
                  '@type': 'Organization',
                  name: 'Paperless Maverick',
                  url: siteUrl,
                },
              }
            : post
            ? {
                '@context': 'https://schema.org',
                '@type': 'BlogPosting',
                headline: post.title,
                description: post.excerpt || defaultDescription,
                image: post.image_url || defaultImage,
                url: seoData.url,
                datePublished: post.published_at,
                dateModified: post.updated_at,
                author: {
                  '@type': 'Person',
                  name: seoData.author,
                },
                publisher: {
                  '@type': 'Organization',
                  name: 'Paperless Maverick',
                  url: siteUrl,
                },
                mainEntityOfPage: {
                  '@type': 'WebPage',
                  '@id': seoData.url,
                },
                keywords: post.tags?.join(', ') || '',
              }
            : {}
        )}
      </script>

      {/* Preconnect to external domains for performance */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    </Helmet>
  );
}
